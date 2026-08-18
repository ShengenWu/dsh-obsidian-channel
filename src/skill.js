/**
 * Runtime skill: available in every session that has ctx.skills
 * (including coding sessions — the cross-session entry we wanted).
 */

export const OBSIDIAN_SKILL_NAME = 'obsidian-vault'

export const OBSIDIAN_SKILL_DESCRIPTION = [
  'Operate the bound local Obsidian vault through journaled obsidian_* tools:',
  'search, read, create, surgical edit, move (rewrites wikilinks), delete-to-trash, undo.',
].join(' ')

export const OBSIDIAN_SKILL_WHEN = [
  'When the user wants to find, read, write, file, rename, or tidy notes in their Obsidian vault,',
  'including from a coding session ("put today\'s work in my daily note").',
].join(' ')

export const OBSIDIAN_SKILL_BODY = `# Obsidian vault

This environment has dsh-obsidian-channel. The vault is a folder of Markdown files.

## Tools

Reads (no approval):
- \`obsidian_search\` — title / body / tag; returns path + snippet + tags
- \`obsidian_list\` — list notes under a folder
- \`obsidian_structure\` — folders, tag counts, orphan notes
- \`obsidian_backlinks\` — notes that \`[[link]]\` to a given note
- \`obsidian_read\` — one note + version token (pass as baseVersion on update)
- \`obsidian_history\` — journal of this plugin's writes

Writes (approval + journal + undo). Never use native write / edit / bash to change the vault:
- \`obsidian_note_create\`
- \`obsidian_note_update\` — whole-file replace, frontmatter merge, or literal \`oldString\`/\`newString\`
- \`obsidian_note_append\`
- \`obsidian_note_delete\` — trash, reversible
- \`obsidian_move\` — rename/move and rewrite \`[[wikilinks]]\`
- \`obsidian_batch\`
- \`obsidian_undo\` / \`obsidian_rollback\` / \`obsidian_restore\`

If vaultDir is omitted, the plugin default is used. If it is empty, ask the user to bind the vault in Settings → Obsidian.

## Daily notes

Only mention a daily path when the plugin/session context gives you one (from \`.obsidian/daily-notes.json\` or a settings override). Do not invent \`Daily/MM-DD-YYYY.md\`.

## Style

Keep YAML frontmatter and existing \`[[wikilinks]]\` unless the user asked to change them. Prefer \`oldString\` replacement over rewriting a whole note. After a write, report the path and opId.
`

export function installObsidianSkill(ctx) {
  ctx.inject(['skills'], (sctx) => {
    sctx.skills.register({
      name: OBSIDIAN_SKILL_NAME,
      description: OBSIDIAN_SKILL_DESCRIPTION,
      whenToUse: OBSIDIAN_SKILL_WHEN,
      source: 'runtime',
      content: OBSIDIAN_SKILL_BODY,
    })
  })
}
