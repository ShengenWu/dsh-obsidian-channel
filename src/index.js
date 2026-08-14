/**
 * dsh-obsidian-channel — DeepSeek Harness plugin (M1 host half).
 *
 * Mounts the Obsidian vault write-side toolset with the official seams:
 *   ctx.fs       — FileSystem seam (all note/journal I/O)
 *   ctx.approval — one-shot approval seam (fail-closed) for every mutation
 *   ctx.tools    — tool registry
 *
 * Write policy (config.writePolicy):
 *   per-write — every mutating call asks approval (default, safest)
 *   per-turn  — grant once per (session, model request, tool); resets on the
 *               next user request (rootCallId changes)
 *   auto      — no prompts (user opts in explicitly)
 *
 * @module dsh-obsidian-channel
 */

import z from '@deepseek-ai/schemastery'
import { registerObsidianChannelTools } from './tools.js'

export const name = 'dsh-obsidian-channel'

/** Cordis service injection: tools + fs + approval. */
export const inject = ['tools', 'fs', 'approval']

/** Plugin config (schemastery). */
export const Config = z.object({
  vaultDir: z.string().default(''),
  writePolicy: z.union(['per-write', 'per-turn', 'auto']).default('per-write'),
  excludes: z.array(z.string()).default([]),
  journalRetentionDays: z.number().default(30),
})

export function apply(ctx, config) {
  // per-turn grant cache: sessionId + rootCallId + toolName -> true
  const turnGrants = new Map()

  /**
   * Approval adapter handed to every tool: consults writePolicy, then the
   * official approval seam. Everything except 'allowed-once' fails closed.
   */
  const makeApprover = async (_ctx, exec, toolName, plan) => {
    const policy = config.writePolicy ?? 'per-write'
    if (policy === 'auto') return 'allowed-once'

    const agent = exec.agent
    if (agent === undefined) return 'unavailable' // no agent: fail closed

    if (policy === 'per-turn') {
      const sessionId = typeof agent.session?.id === 'string' ? agent.session.id : ''
      const key = sessionId + '|' + (exec.rootCallId ?? exec.callId ?? '') + '|' + toolName
      if (turnGrants.has(key)) return 'allowed-once'
      const outcome = await ctx.approval.request({
        agent,
        toolName,
        callId: exec.callId,
        reason: 'Obsidian vault write: ' + toolName + ' on ' + (plan.path ?? '(unknown path)')
          + ' (' + (plan.kind ?? 'mutation') + ', ' + (plan.size ?? 0) + ' bytes after change)',
        signal: exec.signal,
      })
      if (outcome === 'allowed-once') turnGrants.set(key, true)
      return outcome
    }

    // per-write (default)
    return ctx.approval.request({
      agent,
      toolName,
      callId: exec.callId,
      reason: 'Obsidian vault write: ' + toolName + ' on ' + (plan.path ?? '(unknown path)')
        + ' (' + (plan.kind ?? 'mutation') + ', ' + (plan.size ?? 0) + ' bytes after change)',
      signal: exec.signal,
    })
  }

  registerObsidianChannelTools(ctx, config, makeApprover)
}

export default apply
