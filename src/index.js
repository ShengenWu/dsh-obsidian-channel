import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { ESCALATION_TARGETS, approveEscalation, escalationHintMarker, sandboxDenialMarker, validateEscalationArgs } from '@deepseek-ai/dsh-sandbox'
import { registerObsidianChannelTools, hostOf } from './tools.js'
import { openVault, listJournal, journalEntry, rollbackEntry } from './engine.js'

export const name = 'dsh-obsidian-channel'
export const inject = ['tools', 'fs', 'approval']

export const Config = z.object({
  vaultDir: z.string().default('')
    .description('Obsidian vault 根目录（绝对路径）。留空时每次工具调用都需显式传 vaultDir。'),
  writePolicy: z.union(['per-write', 'per-turn', 'auto']).default('per-write')
    .description('写入审批策略：per-write 每次写都审批（默认，最安全）；per-turn 每个任务内同工具免重复审批；auto 不审批（显式开启，不建议）。'),
  excludes: z.array(z.string()).default([])
    .description('额外禁止访问的目录名（总是叠加内置名单：.obsidian / .git / .dsh-obsidian / .trash）。'),
  journalRetentionDays: z.number().default(30)
    .description('journal 保留天数（超期的条目在写入时被清理）。'),
})

const NS = settingsNamespace('dsh-obsidian-channel')

function slimEntry(e) {
  return {
    opId: e.opId,
    ts: e.ts,
    path: e.path,
    kind: e.kind,
    status: e.status,
    tool: e.tool,
    sessionId: e.sessionId ?? null,
    beforeHash: e.beforeHash ?? null,
    afterHash: e.afterHash ?? null,
  }
}

function rpcError(message) {
  return { ok: false, error: { code: 'internal', message: String(message ?? 'error'), details: {} } }
}

/** The plugin config fields the Settings page edits, serialized for the client. */
function configView(cfg) {
  return {
    vaultDir: cfg.vaultDir ?? '',
    writePolicy: cfg.writePolicy ?? 'per-write',
    excludes: cfg.excludes ?? [],
    journalRetentionDays: cfg.journalRetentionDays ?? 30,
  }
}

export function apply(ctx, config) {
  const turnGrants = new Map()

  // Stable thunk over a mutable source: tools capture `currentConfig` by value
  // at registration time, so reassigning a `let` here would leave them reading
  // the stale static `config` forever. Reading `source` through a fixed thunk
  // lets the settings seam swap the source after registration.
  //
  // 【DSH 尚未适配】settings namespace 注册在本插件侧是正确且完成的，但 DSH
  // host-apiproxy 对 Web 客户端只暴露一个硬编码白名单 `WEB_SETTINGS_NAMESPACES`
  // （见 dsh-host-apiproxy 源码注释 “Moving that declaration to
  // settings.register() … is deferred work”），第三方 namespace 永远不会出现在
  // `settings.describe` 里。因此客户端配置表单无法用官方 `settingsScope` 通道，
  // 这里退而通过本插件自己的 `/obsidian` RPC（config/get、config/set）读写配置，
  // 持久化仍走官方 `settings.update` seam。**待 DSH 上游支持第三方 namespace
  // 暴露后（届时 `settings.describe` 不再按白名单过滤），应改回官方
  // `installSettingsSection` + 客户端 `settingsScope` 的合规路径。**
  //
  // 这里内联注册（而非 installSettingsSection() helper）仅为捕获返回的
  // `settingsScope` 供 config/set 调用。
  let settingsScope = null
  let source = () => config
  const currentConfig = () => source()
  ctx.inject(['settings'], (sctx) => {
    settingsScope = sctx.settings.register(NS, Config, { base: config })
    source = () => settingsScope.get()
    sctx.effect(() => () => {
      source = () => config
      turnGrants.clear()
    })
    turnGrants.clear()
    settingsScope.watch(() => { turnGrants.clear() })
  })

  // Native-file-write guard: in a vault session the DSH `write`/`edit` tools
  // would bypass the journal/rollback layer, so we reject their mutations
  // inside the vault through the `fs/write-intent` / `fs/edit-intent`
  // waterfalls (the same gate dsh's own fs-observation-policy uses). Our
  // obsidian_* tools call ctx.fs directly and never dispatch these events, so
  // they are unaffected. `prepend` runs before the built-in observation policy.
  const vaultAbs = async () => {
    const dir = currentConfig().vaultDir
    if (!dir) return null
    try {
      return ctx.fs.processPath(await ctx.fs.resolve(dir))
    } catch {
      return null
    }
  }
  const insideVault = (key, root) => root !== null && key === root || (key.startsWith(root + '/'))
  const FORBIDDEN = 'native file writes into the Obsidian vault are disabled — use the obsidian_* tools (obsidian_note_create/update/append/delete/batch) so every change is journaled and rollback-able'
  const FORBIDDEN_EDIT = 'native file edits into the Obsidian vault are disabled — use obsidian_note_update so the change is journaled and rollback-able'
  ctx.on('fs/write-intent', async (target, _exec, next) => {
    if (insideVault(String(target?.targetKey ?? ''), await vaultAbs())) throw new Error(FORBIDDEN)
    return next()
  }, { prepend: true })
  ctx.on('fs/edit-intent', async (target, _exec, next) => {
    if (insideVault(String(target?.targetKey ?? ''), await vaultAbs())) throw new Error(FORBIDDEN_EDIT)
    return next()
  }, { prepend: true })

  const makeApprover = async (_ctx, exec, toolName, plan) => {
    const cfg = currentConfig()
    const policy = cfg.writePolicy ?? 'per-write'
    if (policy === 'auto') return 'allowed-once'
    const agent = exec.agent
    if (agent === undefined) return 'unavailable'
    if (policy === 'per-turn') {
      const sessionId = typeof agent.session?.id === 'string' ? agent.session.id : ''
      const key = sessionId + '|' + (exec.rootCallId ?? exec.callId ?? '') + '|' + toolName
      if (turnGrants.has(key)) return 'allowed-once'
      const outcome = await ctx.approval.request({
        agent, toolName, callId: exec.callId,
        reason: 'Obsidian vault write: ' + toolName + ' on ' + (plan.path ?? '(unknown path)')
          + ' (' + (plan.kind ?? 'mutation') + ', ' + (plan.size ?? 0) + ' bytes after change)',
        signal: exec.signal,
      })
      if (outcome === 'allowed-once') turnGrants.set(key, true)
      return outcome
    }
    return ctx.approval.request({
      agent, toolName, callId: exec.callId,
      reason: 'Obsidian vault write: ' + toolName + ' on ' + (plan.path ?? '(unknown path)')
        + ' (' + (plan.kind ?? 'mutation') + ', ' + (plan.size ?? 0) + ' bytes after change)',
      signal: exec.signal,
    })
  }

  // Sandbox escalation controller: when the mounted filesystem confines
  // (workspace-write), writes to a vault OUTSIDE the workspace are denied by
  // the fs fence. The sanctioned escape is the same `sandbox_permissions`
  // escalation the built-in write/edit/bash tools use — a one-shot wider mode
  // resolved through ctx.approval before anything executes. Built once from
  // the capability facts (ctx.fs.sandboxMode + ctx.sandboxPolicy).
  const sandboxMode = ctx.fs.sandboxMode
  const sandboxPolicyService = sandboxMode === undefined ? undefined : ctx.get('sandboxPolicy')
  if (sandboxMode !== undefined && sandboxPolicyService === undefined) {
    throw new Error('dsh-obsidian-channel: the mounted filesystem confines but ctx.sandboxPolicy is missing')
  }
  const sandbox = {
    confined: sandboxMode !== undefined,
    schemaFields() {
      if (!sandbox.confined) return {}
      return {
        sandbox_permissions: {
          type: 'string',
          enum: [...ESCALATION_TARGETS],
          description: 'The wider sandbox mode this vault write needs. Only valid as a one-shot retry of a write the sandbox just denied; requires justification and user approval.',
        },
        justification: {
          type: 'string',
          description: 'Required with sandbox_permissions: one sentence for the user explaining why this exact vault write needs the wider access.',
        },
      }
    },
    async resolvePolicy(toolName, args, exec) {
      if (!sandbox.confined) return undefined
      validateEscalationArgs(args.sandbox_permissions, args.justification)
      const standing = sandboxPolicyService.resolve(exec.agent !== undefined ? { session: exec.agent.session } : {})
      if (args.sandbox_permissions === undefined) return standing
      const approvedMode = await approveEscalation({
        requestedMode: args.sandbox_permissions,
        justification: args.justification,
        effectiveMode: standing.mode,
        subject: 'operation',
      }, {
        approver: ctx.approval,
        agent: exec.agent,
        callId: exec.callId,
        toolName,
        signal: exec.signal,
      })
      return { ...standing, mode: approvedMode }
    },
    mapError(err, policy) {
      if (err?.code !== 'FS_SANDBOX_DENIED') return null
      const mode = policy?.mode ?? sandboxMode
      return `${sandboxDenialMarker(mode)}\n${escalationHintMarker('operation')}`
    },
  }

  registerObsidianChannelTools(ctx, currentConfig, makeApprover, sandbox)

  ctx.inject(['connection'], (cctx) => {
    const host = hostOf()
    cctx.connection.rpc.handle('/obsidian', async (endpoint, payload, signal) => {
      const p = (payload ?? null)
      try {
        const cfg = currentConfig()
        // Config endpoints do not need a readable vault (first-run setup has
        // none yet) and are served before any vault is opened.
        if (endpoint === 'config/get') {
          return { ok: true, value: configView(cfg) }
        }
        if (endpoint === 'config/set') {
          const field = typeof p?.field === 'string' ? p.field : ''
          if (field === '') return rpcError('config/set requires a field')
          if (settingsScope === null) return rpcError('settings service is not available')
          await settingsScope.update({ [field]: p?.value })
          return { ok: true, value: configView(currentConfig()) }
        }
        const vault = await openVault(ctx.fs, cfg.vaultDir)
        switch (endpoint) {
          case 'history/list': {
            const limit = Math.min(Math.max(Number(p?.limit ?? 100) || 100, 1), 500)
            const entries = await listJournal(ctx.fs, vault, { relPath: typeof p?.path === 'string' ? p.path : undefined, limit })
            return { ok: true, value: { entries: entries.map(slimEntry) } }
          }
          case 'history/entry': {
            const opId = typeof p?.opId === 'string' ? p.opId : ''
            if (opId === '') return rpcError('history/entry requires an opId')
            const entry = await journalEntry(ctx.fs, vault, opId)
            if (entry === null) return rpcError('journal entry not found: ' + opId)
            return {
              ok: true,
              value: {
                ...slimEntry(entry),
                args: entry.args ?? null,
                before: entry.before ?? null,
                after: entry.after ?? null,
              },
            }
          }
          case 'history/rollback': {
            const opId = typeof p?.opId === 'string' ? p.opId : ''
            if (opId === '') return rpcError('history/rollback requires an opId')
            const res = await rollbackEntry(ctx.fs, host, vault, {
              opId, sessionId: null, journalRetentionDays: cfg.journalRetentionDays,
            })
            return { ok: true, value: res }
          }
          case 'vault/check': {
            const root = await ctx.fs.resolve(vault.vaultAbs)
            let topLevel = null
            try {
              const children = await ctx.fs.listDir(root, signal)
              topLevel = Array.isArray(children) ? children.length : null
            } catch { topLevel = null }
            return { ok: true, value: { vault: vault.vaultAbs, topLevel } }
          }
          default:
            return rpcError('unknown /obsidian endpoint: ' + endpoint)
        }
      } catch (err) {
        return rpcError(err?.message ?? err)
      }
    }, { authority: 'loopback' })
  })
}

export default apply
