import test from 'node:test'
import assert from 'node:assert/strict'
import { sameAbsPath, sessionCwd, sessionIsBlank, shouldDefaultObsidianPreset, guidanceForAssembly, vaultGuidance } from '../src/prompt.js'

test('sameAbsPath ignores trailing slashes', () => {
  assert.equal(sameAbsPath('/Users/me/obsidian', '/Users/me/obsidian/'), true)
  assert.equal(sameAbsPath('/Users/me/obsidian', '/Users/me/code'), false)
  assert.equal(sameAbsPath('', '/x'), false)
})

test('guidanceForAssembly is empty outside the vault session', () => {
  const vault = '/Users/me/obsidian'
  assert.equal(guidanceForAssembly({}, vault), '')
  assert.equal(guidanceForAssembly({ agent: { session: { header: { cwd: '/Users/me/code' } } } }, vault), '')
  assert.equal(guidanceForAssembly({ agent: { session: { header: { cwd: vault } } } }, ''), '')
})

test('guidanceForAssembly emits write-tool rules in a vault session', () => {
  const vault = '/Users/me/obsidian'
  const text = guidanceForAssembly({ agent: { session: { header: { cwd: vault } } } }, vault)
  assert.equal(text, vaultGuidance(vault, undefined))
  assert.match(text, /obsidian_note_create/)
  assert.match(text, /obsidian_search/)
  assert.match(text, /obsidian_move/)
  assert.doesNotMatch(text, /today's note path/)
})

test('vaultGuidance mentions daily notes only when a habit exists', () => {
  const vault = '/Users/me/obsidian'
  const bare = vaultGuidance(vault, { source: 'none', todayRel: null })
  assert.doesNotMatch(bare, /Daily notes/)
  const withHabit = vaultGuidance(vault, {
    source: 'obsidian',
    folder: 'Daily',
    format: 'MM-DD-YYYY',
    todayRel: 'Daily/08-16-2026.md',
  })
  assert.match(withHabit, /today's note path: Daily\/08-16-2026\.md/)
  assert.match(withHabit, /daily-notes\.json/)
})

test('sessionCwd reads header.cwd', () => {
  assert.equal(sessionCwd({ session: { header: { cwd: '/v' } } }), '/v')
  assert.equal(sessionCwd({}), '')
})

test('sessionIsBlank is true only when the log is present and has no turn', () => {
  assert.equal(sessionIsBlank({ session: { events: [] } }), true)
  assert.equal(sessionIsBlank({ session: { events: [{ type: 'session/title' }] } }), true)
  assert.equal(sessionIsBlank({ session: { events: [{ type: 'turn/start' }] } }), false)
  assert.equal(sessionIsBlank({}), false)
})

test('shouldDefaultObsidianPreset only for blank vault sessions off the preset', () => {
  const vault = '/Users/me/obsidian'
  const blank = { session: { header: { cwd: vault }, events: [] } }
  const used = { session: { header: { cwd: vault }, events: [{ type: 'turn/start' }] } }
  const other = { session: { header: { cwd: '/Users/me/code' }, events: [] } }
  assert.equal(shouldDefaultObsidianPreset(blank, vault, undefined, 'obsidian'), true)
  assert.equal(shouldDefaultObsidianPreset(blank, vault, 'obsidian', 'obsidian'), false)
  assert.equal(shouldDefaultObsidianPreset(used, vault, 'standard', 'obsidian'), false)
  assert.equal(shouldDefaultObsidianPreset(other, vault, undefined, 'obsidian'), false)
})
