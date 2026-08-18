/**
 * Vault-session prompt: official systemPrompt section + runtime context.
 * Empty text when the assembly is not a vault session (coding sessions
 * keep the stock harness prompt).
 */

import { hasDailyHabit } from './engine.js'

export function sameAbsPath(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a === '' || b === '') return false
  const norm = (p) => p.replace(/\/+$/, '')
  return norm(a) === norm(b)
}

export function sessionCwd(agent) {
  const header = agent?.session?.header
  const cwd = header?.cwd
  return typeof cwd === 'string' ? cwd : ''
}

/** True only when the session log is present and no turn has started. */
export function sessionIsBlank(agent) {
  const events = agent?.session?.events
  if (!Array.isArray(events)) return false
  return !events.some((event) => event?.type === 'turn/start')
}

/** Vault workspace default: only a blank session may join Obsidian 模式. */
export function shouldDefaultObsidianPreset(agent, vaultDir, currentPreset, presetId) {
  if (currentPreset === presetId) return false
  if (!sameAbsPath(sessionCwd(agent), vaultDir)) return false
  return sessionIsBlank(agent)
}

export function vaultGuidance(vaultDir, daily) {
  const vault = String(vaultDir ?? '').trim()
  if (vault === '') return ''
  const lines = [
    'This session is bound to the Obsidian vault at:',
    vault,
    '',
    'Reads (non-invasive): prefer obsidian_search / obsidian_list / obsidian_structure / obsidian_backlinks to find notes. Use obsidian_read when you need the version token for a later guarded update. Native read / grep / glob are fine for one-off inspection.',
    '',
    'Writes (invasive — create / replace / append / delete / move notes) MUST use the vault tools so every change is journaled and can be rolled back:',
    '- obsidian_note_create',
    '- obsidian_note_update (prefer oldString/newString; pass baseVersion from a prior obsidian_read)',
    '- obsidian_note_append',
    '- obsidian_note_delete',
    '- obsidian_move (rewrites [[wikilinks]])',
    '- obsidian_batch',
    'Never use native write, edit, or bash redirection to change notes in this vault.',
    '',
    'History / undo: obsidian_history, obsidian_undo, obsidian_rollback, obsidian_restore.',
    'vaultDir may be omitted; the plugin default is this vault.',
  ]
  if (hasDailyHabit(daily)) {
    const source = daily.source === 'override'
      ? 'plugin settings override'
      : daily.source === 'obsidian'
        ? '.obsidian/daily-notes.json'
        : daily.source
    lines.push(
      '',
      'Daily notes (must match exactly — do not swap day and month):',
      '- folder: ' + (daily.folder === '' ? '(vault root)' : daily.folder),
      '- filename format: ' + daily.format + ' (from ' + source + ')',
      "- today's note path: " + daily.todayRel,
      'Create a missing daily note at that exact path with obsidian_note_create.',
    )
  }
  return lines.join('\n')
}

export function guidanceForAssembly(context, vaultDir, daily) {
  const dir = String(vaultDir ?? '').trim()
  if (dir === '') return ''
  const agent = context?.agent
  if (agent === undefined) return ''
  if (!sameAbsPath(sessionCwd(agent), dir)) return ''
  return vaultGuidance(dir, daily)
}

/** Register section (system prompt) + context (runtime snapshot) for vault sessions. */
export function installVaultPrompt(ctx, currentConfig, getDaily) {
  ctx.inject(['systemPrompt'], (sctx) => {
    const text = (assemble) => guidanceForAssembly(assemble, currentConfig().vaultDir, getDaily?.())
    sctx.systemPrompt.section({
      name: 'dsh-obsidian-channel:vault',
      order: 150,
      text,
    })
    sctx.systemPrompt.context({
      name: 'dsh-obsidian-channel:vault',
      order: 150,
      text,
    })
  })
}
