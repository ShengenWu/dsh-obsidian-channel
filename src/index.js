import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { ESCALATION_TARGETS, approveEscalation, escalationHintMarker, sandboxDenialMarker, validateEscalationArgs } from '@deepseek-ai/dsh-sandbox'
import { registerObsidianChannelTools, hostOf } from './tools.js'
import { openVault, listJournal, journalEntry, rollbackEntry, surfaceOverview, loadDailyHabit, previewNote, searchNotes, mutateNote } from './engine.js'
import { installVaultPrompt, shouldDefaultObsidianPreset } from './prompt.js'
import { OBSIDIAN_PRESET_ID, syncObsidianPreset } from './preset-sync.js'
import { HOME_WIDGETS, mergeHomeWidgets, enabledWidgetIds, resolveWidgetIds } from './home-catalog.js'
import { mergeHomeLayout } from './home-layout.js'
import { detectObsidianVaults } from './detect.js'
import { pickFolder, relativeInside } from './pick-folder.js'
import { installObsidianSkill } from './skill.js'

export const name = 'dsh-obsidian-channel'
export const inject = ['tools', 'fs', 'approval']

export const Config = z.object({
  vaultDir: z.string().default('')
    .description('Obsidian vault 根目录（绝对路径）。留空时每次工具调用都需显式传 vaultDir。'),
  writePolicy: z.union(['per-write', 'per-turn', 'auto']).default('per-write')
    .description('写入审批策略：per-write 每次都询问；per-turn 每个会话只询问一次；auto 不询问始终放行。'),
  excludes: z.array(z.string()).default([])
    .description('额外禁止访问的目录名（总是叠加内置名单：.obsidian / .git / .dsh-obsidian / .trash）。'),
  journalRetentionDays: z.number().default(30)
    .description('journal 保留天数（超期的条目在写入时被清理）。'),
  dailyFolder: z.string().default('')
    .description('每日笔记目录（相对 vault）。留空则读取 .obsidian/daily-notes.json；两者都没有则不发明日记路径。'),
  dailyFormat: z.string().default('')
    .description('每日笔记文件名日期格式（Moment 记号，如 MM-DD-YYYY）。留空则读取 Obsidian 设置；两者都没有则不发明日记路径。'),
  homeWidgets: z.array(z.object({
    id: z.string(),
    enabled: z.boolean(),
  })).default(HOME_WIDGETS)
    .description('首页组件开关。壳（顶栏 / 绑定 / 底栏）不可关；其余按 id 开关。'),
  homeLayout: z.array(z.object({
    id: z.string(),
    x: z.number().default(0),
    y: z.number().default(0),
    size: z.union(['s', 'm', 'l']).default('m'),
    cols: z.number().default(2),
  })).default([])
    .description('首页小组件：位置 + 小/中/大。'),
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
    dailyFolder: cfg.dailyFolder ?? '',
    dailyFormat: cfg.dailyFormat ?? '',
    homeWidgets: mergeHomeWidgets(cfg.homeWidgets),
    homeLayout: mergeHomeLayout(cfg.homeLayout),
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
      if (sessionId !== '' && turnGrants.has(sessionId)) return 'allowed-once'
      const outcome = await ctx.approval.request({
        agent, toolName, callId: exec.callId,
        reason: 'Obsidian vault write: ' + toolName + ' on ' + (plan.path ?? '(unknown path)')
          + ' (' + (plan.kind ?? 'mutation') + ', ' + (plan.size ?? 0) + ' bytes after change)',
        signal: exec.signal,
      })
      if (outcome === 'allowed-once' && sessionId !== '') turnGrants.set(sessionId, true)
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

  let lastDaily = null
  const refreshDaily = async () => {
    const cfg = currentConfig()
    if (!cfg.vaultDir) {
      lastDaily = null
      return null
    }
    try {
      const vault = await openVault(ctx.fs, cfg.vaultDir)
      lastDaily = await loadDailyHabit(ctx.fs, vault, cfg)
      return lastDaily
    } catch {
      lastDaily = null
      return null
    }
  }

  registerObsidianChannelTools(ctx, currentConfig, makeApprover, sandbox)
  installVaultPrompt(ctx, currentConfig, () => lastDaily)
  installObsidianSkill(ctx)
  void refreshDaily()

  try {
    syncObsidianPreset()
  } catch (err) {
    console.warn('[dsh-obsidian-channel] failed to sync Obsidian preset:', err?.message ?? err)
  }

  // Vault workspace default: only BLANK agents whose cwd is the bound vault
  // join Obsidian 模式. Recompose is the blank-session contract — applying it
  // to a session that already ran would swap tools under existing history.
  ctx.inject(['agentPresets'], (pctx) => {
    pctx.on('agent/created', (payload) => {
      const agent = payload?.agent
      if (agent === undefined) return
      const current = pctx.agentPresets.composedPreset(agent.ctx)
      if (!shouldDefaultObsidianPreset(agent, currentConfig().vaultDir, current, OBSIDIAN_PRESET_ID)) return
      void pctx.agentPresets.recompose(agent.ctx, OBSIDIAN_PRESET_ID).catch((error) => {
        console.warn('[dsh-obsidian-channel] could not default vault session to Obsidian preset:', error?.message ?? error)
      })
    })
  })

  ctx.inject(['connection'], (cctx) => {
    const host = hostOf()
    cctx.connection.rpc.handle('/obsidian', async (endpoint, payload, signal) => {
      const p = (payload ?? null)
      try {
        const cfg = currentConfig()
        // Config endpoints do not need a readable vault (first-run setup has
        // none yet) and are served before any vault is opened.
        if (endpoint === 'config/get') {
          const view = configView(cfg)
          try {
            view.daily = await refreshDaily()
          } catch {
            view.daily = null
          }
          return { ok: true, value: view }
        }
        if (endpoint === 'vault/detect') {
          const vaults = await detectObsidianVaults()
          return { ok: true, value: { vaults } }
        }
        if (endpoint === 'vault/pick') {
          const kind = p?.kind === 'daily' ? 'daily' : 'vault'
          if (kind === 'daily') {
            const vaultDir = String(cfg.vaultDir ?? '').trim()
            if (vaultDir === '') {
              return { ok: false, error: { code: 'vault-required', message: 'vault required', details: {} } }
            }
            const picked = await pickFolder({ startDir: vaultDir, prompt: '选择日记所在文件夹' })
            if (picked.cancelled === true || !picked.path) {
              return { ok: true, value: { cancelled: true } }
            }
            const rel = relativeInside(vaultDir, picked.path)
            if (rel === null) {
              return { ok: false, error: { code: 'outside-vault', message: 'outside vault', details: {} } }
            }
            return { ok: true, value: { path: rel } }
          }
          const picked = await pickFolder({ prompt: '选择 Obsidian 库' })
          if (picked.cancelled === true || !picked.path) {
            return { ok: true, value: { cancelled: true } }
          }
          return { ok: true, value: { path: picked.path } }
        }
        if (endpoint === 'config/set') {
          const field = typeof p?.field === 'string' ? p.field : ''
          if (field === '') return rpcError('config/set requires a field')
          if (settingsScope === null) return rpcError('settings service is not available')
          const nextValue = field === 'homeWidgets'
            ? mergeHomeWidgets(p?.value)
            : field === 'homeLayout'
              ? mergeHomeLayout(p?.value)
              : p?.value
          await settingsScope.update({ [field]: nextValue })
          const view = configView(currentConfig())
          view.daily = await refreshDaily()
          return { ok: true, value: view }
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
          case 'surface/overview': {
            const widgets = resolveWidgetIds(
              Array.isArray(p?.widgets) ? p.widgets : enabledWidgetIds(cfg.homeWidgets),
            )
            const overview = await surfaceOverview(ctx.fs, vault, {
              excludes: cfg.excludes ?? [],
              host,
              dailyFolder: cfg.dailyFolder,
              dailyFormat: cfg.dailyFormat,
              widgets,
            })
            if (overview.daily !== undefined) lastDaily = overview.daily
            else await refreshDaily()
            return { ok: true, value: overview }
          }
          case 'surface/preview': {
            const path = typeof p?.path === 'string' ? p.path : ''
            if (path === '') return rpcError('surface/preview requires a path')
            const preview = await previewNote(ctx.fs, vault, path, cfg.excludes ?? [], {
              allowMissing: p?.allowMissing === true,
            })
            return { ok: true, value: preview }
          }
          case 'surface/save': {
            const path = typeof p?.path === 'string' ? p.path : ''
            if (path === '') return rpcError('surface/save requires a path')
            const content = typeof p?.content === 'string' ? p.content : null
            if (content === null) return rpcError('surface/save requires content')
            const existing = await previewNote(ctx.fs, vault, path, cfg.excludes ?? [], { allowMissing: true })
            const saved = await mutateNote(ctx.fs, host, vault, {
              rel: path,
              kind: existing.missing === true ? 'create' : 'update',
              content,
              frontmatter: null,
              tool: 'obsidian_surface_save',
              sessionId: null,
              journalRetentionDays: cfg.journalRetentionDays,
              excludes: cfg.excludes ?? [],
              onApprove: async () => 'allowed-once',
              baseVersion: p?.version,
            })
            if (saved.ok !== true) return rpcError(saved.message ?? 'save failed')
            const preview = await previewNote(ctx.fs, vault, path, cfg.excludes ?? [])
            return { ok: true, value: { ...preview, opId: saved.opId ?? null } }
          }
          case 'surface/search': {
            const query = typeof p?.query === 'string' ? p.query : ''
            const tag = typeof p?.tag === 'string' ? p.tag : undefined
            const matches = await searchNotes(ctx.fs, vault, {
              query, tag, limit: p?.limit, excludes: cfg.excludes ?? [],
            })
            return { ok: true, value: { matches } }
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
