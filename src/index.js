import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
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

export function apply(ctx, config) {
  const turnGrants = new Map()

  let currentConfig = () => config
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => { currentConfig = source },
    onChange: () => { turnGrants.clear() },
  })

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

  registerObsidianChannelTools(ctx, currentConfig, makeApprover)

  ctx.inject(['connection'], (cctx) => {
    const host = hostOf()
    cctx.connection.rpc.handle('/obsidian', async (endpoint, payload, signal) => {
      const p = (payload ?? null)
      try {
        const cfg = currentConfig()
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
