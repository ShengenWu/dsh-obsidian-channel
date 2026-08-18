/**
 * dsh-obsidian-channel — engine safety-kernel tests (node:test + in-memory fs).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeRelPath, relExcluded, openVault, resolveNotePath, parseNote,
  renderFrontmatter, applyFrontmatterEdit, computeNextText,
  mutateNote, deleteNote, batchMutate,
  listJournal, latestDoneEntry, rollbackEntry, restoreFromTrash,
  pickDailyPath, walkVaultNotes, surfaceOverview, todayStamp,
  formatDailyName, dailyRelPath, loadDailyHabit, previewNote, hasDailyHabit,
  displayTitle, applyLiteralReplace, rewriteWikilinks, searchNotes, listNotes, backlinksFor,
  collectGraph, structureFromGraph, moveNote,
} from '../src/engine.js'
import { mergeHomeWidgets, resolveWidgetIds, enabledWidgetIds } from '../src/home-catalog.js'
import { parseObsidianVaults, obsidianConfigPaths } from '../src/detect.js'

const NL = '\n'

// ---------------------------------------------------------------------------
// In-memory adapter implementing the dsh fs seam subset + host ops
// ---------------------------------------------------------------------------

class StubFs {
  constructor() {
    this.files = new Map()
    this.dirs = new Set()
    this.symlinks = new Set()
    this.versions = new Map()
    this.mtimes = new Map()
  }
  norm(p) { return p.replace(/\\+/g, '/') }
  ensureDirs(p) {
    const parts = this.norm(p).split('/').filter(Boolean)
    let acc = ''
    for (const part of parts) { acc += '/' + part; this.dirs.add(acc) }
  }
  resolve(path) {
    const p = this.norm(path)
    return { targetKey: p, path: p }
  }
  processPath(target) { return target.targetKey }
  lstat(path) {
    const p = this.norm(path)
    if (this.symlinks.has(p)) return { type: 'symlink' }
    if (this.files.has(p)) return { type: 'file', size: this.files.get(p).length }
    if (this.dirs.has(p)) return { type: 'directory' }
    return undefined
  }
  stat(target) {
    const p = target.targetKey
    if (this.files.has(p)) {
      const info = { version: this.versions.get(p) ?? 0, type: 'file', size: this.files.get(p).length }
      if (this.mtimes.has(p)) info.mtimeMs = this.mtimes.get(p)
      return info
    }
    if (this.dirs.has(p)) return { version: 0, type: 'directory' }
    return undefined
  }
  contains(parent, child) {
    const pp = parent.targetKey
    const cp = child.targetKey
    return cp === pp || cp.startsWith(pp.endsWith('/') ? pp : pp + '/')
  }
  readText(target) {
    const p = target.targetKey
    if (!this.files.has(p)) throw new Error('ENOENT: ' + p)
    return this.files.get(p)
  }
  childrenOf(dirPath) {
    const out = []
    const seen = new Set()
    const dirPrefix = dirPath.endsWith('/') ? dirPath : dirPath + '/'
    for (const p of this.files.keys()) {
      if (!p.startsWith(dirPrefix)) continue
      const rest = p.slice(dirPrefix.length)
      if (rest.includes('/')) continue
      if (seen.has(rest)) continue
      seen.add(rest)
      out.push({ name: rest, type: 'file', target: this.resolve(p) })
    }
    for (const d of this.dirs) {
      if (d === dirPath || !d.startsWith(dirPrefix)) continue
      const rest = d.slice(dirPrefix.length)
      if (rest.includes('/')) continue
      if (seen.has(rest)) continue
      seen.add(rest)
      out.push({ name: rest, type: 'directory', target: this.resolve(d) })
    }
    return out
  }
  listDir(target) {
    const p = target.targetKey
    if (!this.dirs.has(p)) return []
    return this.childrenOf(p)
  }
  writeText(target, content, expected) {
    const p = target.targetKey
    const exists = this.files.has(p)
    if (expected !== undefined) {
      if (expected.kind === 'createIfAbsent' && exists) {
        const err = new Error('FS_NOT_OBSERVED: target exists')
        err.code = 'FS_NOT_OBSERVED'
        throw err
      }
      if (expected.kind === 'replaceIfVersion') {
        if (!exists || (this.versions.get(p) ?? 0) !== expected.version) {
          const err = new Error('FS_STALE_VERSION: version mismatch')
          err.code = 'FS_STALE_VERSION'
          throw err
        }
      }
    }
    const before = exists ? this.files.get(p) : null
    const nextVersion = (this.versions.get(p) ?? 0) + 1
    this.files.set(p, content)
    this.versions.set(p, nextVersion)
    this.ensureDirs(p.slice(0, p.lastIndexOf('/')))
    return { operation: exists ? 'update' : 'create', version: nextVersion, before, after: content }
  }
  externalEdit(path, content) {
    const p = this.norm(path)
    this.files.set(p, content)
    this.versions.set(p, (this.versions.get(p) ?? 0) + 1)
  }
  rename(from, to) {
    const f = this.norm(from)
    const t = this.norm(to)
    if (!this.files.has(f)) throw new Error('ENOENT rename ' + f)
    this.files.set(t, this.files.get(f))
    this.files.delete(f)
    this.versions.set(t, (this.versions.get(t) ?? 0) + 1)
    this.versions.delete(f)
    this.ensureDirs(t.slice(0, t.lastIndexOf('/')))
  }
  mkdirP(dir) { this.ensureDirs(this.norm(dir)) }
  rmrf(dir) {
    const d = this.norm(dir)
    for (const p of [...this.files.keys()]) {
      if (p === d || p.startsWith(d + '/')) { this.files.delete(p); this.versions.delete(p) }
    }
    for (const p of [...this.dirs]) {
      if (p === d || p.startsWith(d + '/')) this.dirs.delete(p)
    }
  }
  host() {
    return {
      rename: (a, b) => this.rename(a, b),
      mkdirP: (d) => this.mkdirP(d),
      rmrf: (d) => this.rmrf(d),
      mtimeMs: async (abs) => this.mtimes.get(this.norm(abs)) ?? 0,
    }
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VAULT = '/vault'

async function setup() {
  const fs = new StubFs()
  const host = fs.host()
  fs.mkdirP(VAULT)
  const vault = await openVault(fs, VAULT)
  const allow = async () => 'allowed-once'
  return { fs, host, vault, allow }
}

const opts = (extra) => ({ sessionId: 's1', excludes: [], journalRetentionDays: 30, ...extra })

// ---------------------------------------------------------------------------
// Path safety
// ---------------------------------------------------------------------------

test('sanitizeRelPath rejects traversal, absolute, hidden and bad chars', () => {
  assert.throws(() => sanitizeRelPath('..'), (e) => e.code === 'INVALID_PATH')
  assert.throws(() => sanitizeRelPath('a/../../b'), (e) => e.code === 'INVALID_PATH')
  assert.throws(() => sanitizeRelPath('/etc/passwd'), (e) => e.code === 'INVALID_PATH')
  assert.throws(() => sanitizeRelPath('C:/x'), (e) => e.code === 'INVALID_PATH')
  assert.throws(() => sanitizeRelPath('.hidden'), (e) => e.code === 'INVALID_PATH')
  assert.throws(() => sanitizeRelPath('a< b'), (e) => e.code === 'INVALID_PATH')
  assert.equal(sanitizeRelPath('Notes//a.md'), 'Notes/a.md')
  assert.equal(sanitizeRelPath('a\\b.md'), 'a/b.md')
})

test('relExcluded covers built-in and configured exclusions', () => {
  assert.equal(relExcluded('.obsidian/x.md'), true)
  assert.equal(relExcluded('.git/x'), true)
  assert.equal(relExcluded('.dsh-obsidian/journal/1.json'), true)
  assert.equal(relExcluded('custom/x.md', ['custom']), true)
  assert.equal(relExcluded('Notes/x.md'), false)
})

test('resolveNotePath enforces the vault boundary and rejects symlinks', async () => {
  const { fs, vault } = await setup()
  fs.mkdirP('/outside')
  await assert.rejects(resolveNotePath(fs, vault, '/outside/x.md'), (e) => e.code === 'INVALID_PATH')
  fs.symlinks.add('/vault/link.md')
  await assert.rejects(resolveNotePath(fs, vault, 'link.md'), (e) => e.code === 'SYMLINK')
  // hidden segments are rejected before the exclude check (safe either way)
  await assert.rejects(resolveNotePath(fs, vault, '.obsidian/x.md'), (e) => e.code === 'INVALID_PATH' || e.code === 'EXCLUDED')
  // a configured NON-hidden exclude is caught by the exclude check
  await assert.rejects(resolveNotePath(fs, vault, 'private/x.md', ['private']), (e) => e.code === 'EXCLUDED')
  const ok = await resolveNotePath(fs, vault, 'Notes/a.md')
  assert.equal(ok.rel, 'Notes/a.md')
})

// ---------------------------------------------------------------------------
// Parse & frontmatter
// ---------------------------------------------------------------------------

test('parseNote extracts frontmatter, title, tags and wikilinks', () => {
  const text = [
    '---',
    'tags: [a, b]',
    'alias: "X Y"',
    '---',
    '# Hello',
    'Body with [[Target]] and #inline.',
  ].join(NL)
  const p = parseNote(text)
  assert.equal(p.title, 'Hello')
  assert.deepEqual(p.tags.sort(), ['a', 'b', 'inline'].sort())
  assert.deepEqual(p.wikilinks, ['Target'])
  assert.equal(p.frontmatter.alias, 'X Y')
})

test('renderFrontmatter quotes unsafe values and round-trips scalars', () => {
  const fm = renderFrontmatter({ title: 'safe-name', weird: 'has: colon', n: 3, ok: true, tags: ['a', 'b'] })
  assert.match(fm, /^---\n/)
  assert.match(fm, /weird: "has: colon"/)
  assert.match(fm, /n: 3/)
  assert.match(fm, /ok: true/)
})

test('applyFrontmatterEdit preserves every untouched byte exactly', () => {
  const original = '---\r\ntitle: Keep Me\r\ncustom: {weird: value}\r\n---\r\n\r\nbody text\r\n'
  const { text, changed, edits } = applyFrontmatterEdit(original, { title: 'New', added: 'yes' }, ['custom'])
  assert.equal(changed, true)
  assert.deepEqual(edits.map((e) => e.kind).sort(), ['add', 'delete', 'update'].sort())
  assert.match(text, /\r\n\r\nbody text\r\n$/)
  assert.match(text, /title: New/)
  assert.match(text, /added: yes/)
  assert.equal(text.includes('custom:'), false)
  const same = applyFrontmatterEdit(original, {}, [])
  assert.equal(same.text, original)
  assert.equal(same.changed, false)
})

test('computeNextText: update with identical content reports no change', () => {
  // Regression: the update branch used to hardcode changed=true, so a
  // byte-identical update went through approval and journaled a fake commit.
  const current = 'just text, no title'
  const up = computeNextText('update', current, { content: 'just text, no title' })
  assert.equal(up.nextText, current)
  assert.equal(up.changed, false)

  const changed = computeNextText('update', current, { content: 'different' })
  assert.equal(changed.changed, true)

  const withFm = computeNextText('update', current, { content: 'x', frontmatter: { tags: ['a'] } })
  assert.equal(withFm.nextText, '---\ntags: [a]\n---\nx')
  assert.equal(withFm.changed, true)

  // append of empty content is a no-op
  const ap = computeNextText('append', current, { content: '' })
  assert.equal(ap.nextText, current)
  assert.equal(ap.changed, false)

  // create always reports changed (guarded upstream by the exists check)
  const cr = computeNextText('create', '', { content: 'x' })
  assert.equal(cr.changed, true)
})

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

test('create writes the note, journals done, and can be undone', async () => {
  const { fs, host, vault, allow } = await setup()
  const res = await mutateNote(fs, host, vault, opts({
    rel: 'Notes/n.md', kind: 'create', content: '# hi', frontmatter: { tags: ['t'] },
    tool: 'obsidian_note_create', onApprove: allow,
  }))
  assert.equal(res.ok, true)
  assert.equal(res.action, 'create')
  assert.equal(fs.files.get('/vault/Notes/n.md'), '---\ntags: [t]\n---\n# hi')
  const entries = await listJournal(fs, vault, { relPath: 'Notes/n.md' })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].status, 'done')
  assert.equal(entries[0].kind, 'create')
  const undo = await rollbackEntry(fs, host, vault, { relPath: 'Notes/n.md', sessionId: 's1' })
  assert.equal(undo.ok, true)
  assert.equal(fs.files.has('/vault/Notes/n.md'), false)
  const afterUndo = await listJournal(fs, vault, { relPath: 'Notes/n.md' })
  assert.equal(afterUndo.length, 2)
  assert.equal(afterUndo[0].kind, 'undo')
})

test('create on an existing note reports a conflict without touching it', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'v1', tool: 't', onApprove: allow }))
  const res = await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'v2', tool: 't', onApprove: allow }))
  assert.equal(res.ok, false)
  assert.equal(res.action, 'conflict')
  assert.equal(fs.files.get('/vault/a.md'), 'v1')
})

test('denied approval writes nothing and journals nothing', async () => {
  const { fs, host, vault } = await setup()
  const res = await mutateNote(fs, host, vault, opts({
    rel: 'a.md', kind: 'create', content: 'x', tool: 't', onApprove: async () => 'rejected',
  }))
  assert.equal(res.ok, false)
  assert.equal(res.action, 'denied')
  assert.equal(fs.files.has('/vault/a.md'), false)
  assert.equal((await listJournal(fs, vault, {})).length, 0)
})

test('dry-run produces a full plan and touches nothing', async () => {
  const { fs, host, vault, allow } = await setup()
  let approved = false
  const res = await mutateNote(fs, host, vault, opts({
    rel: 'a.md', kind: 'create', content: 'x', tool: 't', dryRun: true,
    onApprove: async () => { approved = true; return 'allowed-once' },
  }))
  assert.equal(res.ok, true)
  assert.equal(res.action, 'dry-run')
  assert.equal(res.plan.after, 'x')
  assert.equal(approved, false)
  assert.equal(fs.files.has('/vault/a.md'), false)
})

// ---------------------------------------------------------------------------
// Update / append / conflicts
// ---------------------------------------------------------------------------

test('update with a matching baseVersion replaces content and undo restores bytes', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'original', tool: 't', onApprove: allow }))
  const stat = fs.stat(fs.resolve('/vault/a.md'))
  const res = await mutateNote(fs, host, vault, opts({
    rel: 'a.md', kind: 'update', content: 'replaced', baseVersion: stat.version, tool: 't', onApprove: allow,
  }))
  assert.equal(res.ok, true)
  assert.equal(fs.files.get('/vault/a.md'), 'replaced')
  const undo = await rollbackEntry(fs, host, vault, { relPath: 'a.md', sessionId: 's1' })
  assert.equal(undo.ok, true)
  assert.equal(fs.files.get('/vault/a.md'), 'original')
  const redo = await rollbackEntry(fs, host, vault, { relPath: 'a.md', sessionId: 's1' })
  assert.equal(redo.ok, true)
  assert.equal(fs.files.get('/vault/a.md'), 'replaced')
})

test('update with a stale version reports conflict and never writes', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'v1', tool: 't', onApprove: allow }))
  const readVersion = fs.stat(fs.resolve('/vault/a.md')).version
  fs.externalEdit('/vault/a.md', 'v2-user')
  const res = await mutateNote(fs, host, vault, opts({
    rel: 'a.md', kind: 'update', content: 'v3-agent', baseVersion: readVersion, tool: 't', onApprove: allow,
  }))
  assert.equal(res.ok, false)
  assert.equal(res.action, 'conflict')
  assert.equal(fs.files.get('/vault/a.md'), 'v2-user')
  const undo = await rollbackEntry(fs, host, vault, { relPath: 'a.md' })
  assert.equal(undo.action, 'conflict')
  assert.equal(fs.files.get('/vault/a.md'), 'v2-user')
})

test('append adds at the end and undo restores', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'one' + NL, tool: 't', onApprove: allow }))
  const res = await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'append', content: 'two' + NL, tool: 't', onApprove: allow }))
  assert.equal(res.ok, true)
  assert.equal(fs.files.get('/vault/a.md'), 'one' + NL + 'two' + NL)
  await rollbackEntry(fs, host, vault, { relPath: 'a.md' })
  assert.equal(fs.files.get('/vault/a.md'), 'one' + NL)
})

test('append into a section inserts before the next section', async () => {
  const { fs, host, vault, allow } = await setup()
  const body = '# T' + NL + NL + '## Alpha' + NL + NL + 'alpha' + NL + NL + '## Beta' + NL + NL + 'beta' + NL
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: body, tool: 't', onApprove: allow }))
  const res = await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'append', section: 'Alpha', content: 'inserted' + NL, tool: 't', onApprove: allow }))
  assert.equal(res.ok, true)
  const text = fs.files.get('/vault/a.md')
  assert.ok(text.indexOf('inserted') < text.indexOf('## Beta'))
  assert.ok(text.indexOf('inserted') > text.indexOf('## Alpha'))
})

// ---------------------------------------------------------------------------
// Delete / trash / restore
// ---------------------------------------------------------------------------

test('delete moves to trash, undo restores, restore tool works after re-delete', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'Notes/x.md', kind: 'create', content: 'precious', tool: 't', onApprove: allow }))
  const del = await deleteNote(fs, host, vault, opts({ rel: 'Notes/x.md', onApprove: allow }))
  assert.equal(del.ok, true)
  assert.equal(fs.files.has('/vault/Notes/x.md'), false)
  assert.ok(del.trashRel.startsWith('.dsh-obsidian/trash/'))
  assert.equal(fs.files.has('/vault/' + del.trashRel), true)
  const undo = await rollbackEntry(fs, host, vault, { relPath: 'Notes/x.md' })
  assert.equal(undo.ok, true)
  assert.equal(fs.files.get('/vault/Notes/x.md'), 'precious')
  await deleteNote(fs, host, vault, opts({ rel: 'Notes/x.md', onApprove: allow }))
  const rest = await restoreFromTrash(fs, host, vault, { relPath: 'Notes/x.md' })
  assert.equal(rest.ok, true)
  assert.equal(fs.files.get('/vault/Notes/x.md'), 'precious')
})

test('restore refuses to clobber an existing file', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'one', tool: 't', onApprove: allow }))
  await deleteNote(fs, host, vault, opts({ rel: 'a.md', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'two', tool: 't', onApprove: allow }))
  const rest = await restoreFromTrash(fs, host, vault, { relPath: 'a.md' })
  assert.equal(rest.ok, false)
  assert.equal(rest.action, 'conflict')
  assert.equal(fs.files.get('/vault/a.md'), 'two')
})

// ---------------------------------------------------------------------------
// Rollback by opId, history, batch, pruning
// ---------------------------------------------------------------------------

test('rollback by opId refuses when a later change moved the file on', async () => {
  const { fs, host, vault, allow } = await setup()
  const first = await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'v1', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'update', content: 'v2', tool: 't', onApprove: allow }))
  const rb = await rollbackEntry(fs, host, vault, { opId: first.opId })
  assert.equal(rb.ok, false)
  assert.equal(rb.action, 'conflict')
  assert.equal(fs.files.get('/vault/a.md'), 'v2')
})

test('history lists newest first and filters by path', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'x', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'b.md', kind: 'create', content: 'y', tool: 't', onApprove: allow }))
  const all = await listJournal(fs, vault, {})
  assert.ok(all.length >= 2)
  assert.equal(all[0].path, 'b.md')
  const onlyA = await listJournal(fs, vault, { relPath: 'a.md' })
  assert.deepEqual(onlyA.map((e) => e.path), ['a.md'])
  assert.ok(await latestDoneEntry(fs, vault, 'a.md'))
})

test('batch dry-runs the full plan and batch commits each op with journaling', async () => {
  const { fs, host, vault, allow } = await setup()
  const dry = await batchMutate(fs, host, vault, {
    ops: [
      { action: 'create', path: 'x.md', content: 'x' },
      { action: 'append', path: 'x.md', content: 'y' },
    ],
    dryRun: true, onApprove: allow, excludes: [], journalRetentionDays: 30,
  })
  assert.equal(dry.ok, true)
  assert.deepEqual(dry.results.map((r) => r.action), ['dry-run', 'dry-run'])
  assert.equal(fs.files.has('/vault/x.md'), false)

  const run = await batchMutate(fs, host, vault, {
    ops: [
      { action: 'create', path: 'x.md', content: 'x' },
      { action: 'append', path: 'x.md', content: 'y' },
    ],
    onApprove: allow, excludes: [], journalRetentionDays: 30, sessionId: 's1',
  })
  assert.equal(run.ok, true)
  assert.equal(fs.files.get('/vault/x.md'), 'x' + NL + NL + 'y')
  const entries = await listJournal(fs, vault, { relPath: 'x.md' })
  assert.equal(entries.length, 2)
})

test('journal pruning removes old day directories', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'a.md', kind: 'create', content: 'x', tool: 't', onApprove: allow, journalRetentionDays: 0 }))
  const all = await listJournal(fs, vault, {})
  assert.equal(all.length, 0)
})

test('formatDailyName follows Obsidian Moment tokens', () => {
  const noon = new Date(2026, 7, 16, 12, 0, 0).getTime()
  assert.equal(formatDailyName(noon, 'YYYY-MM-DD'), '2026-08-16')
  assert.equal(formatDailyName(noon, 'MM-DD-YYYY'), '08-16-2026')
  assert.equal(formatDailyName(noon, 'DD-MM-YYYY'), '16-08-2026')
  assert.equal(formatDailyName(noon, ''), '08-16-2026')
  assert.equal(dailyRelPath('Daily', '08-16-2026'), 'Daily/08-16-2026.md')
})

test('pickDailyPath matches the expected path only', () => {
  assert.equal(pickDailyPath(['Inbox/x.md'], 'Daily/08-16-2026.md'), null)
  assert.equal(pickDailyPath(['Daily/16-08-2026.md', 'Daily/08-16-2026.md'], 'Daily/08-16-2026.md'), 'Daily/08-16-2026.md')
  assert.equal(pickDailyPath(['Daily/16-08-2026.md'], 'Daily/08-16-2026.md'), null)
})

test('loadDailyHabit reads .obsidian/daily-notes.json', async () => {
  const { fs, vault } = await setup()
  fs.ensureDirs('/vault/.obsidian')
  fs.files.set('/vault/.obsidian/daily-notes.json', JSON.stringify({ format: 'MM-DD-YYYY', folder: 'Daily', template: '' }))
  const noon = new Date(2026, 7, 16, 12, 0, 0).getTime()
  const habit = await loadDailyHabit(fs, vault, {}, noon)
  assert.equal(habit.source, 'obsidian')
  assert.equal(habit.format, 'MM-DD-YYYY')
  assert.equal(habit.folder, 'Daily')
  assert.equal(habit.todayRel, 'Daily/08-16-2026.md')
  assert.equal(hasDailyHabit(habit), true)
})

test('loadDailyHabit does not invent Daily/MM-DD-YYYY when nothing is configured', async () => {
  const { fs, vault } = await setup()
  const habit = await loadDailyHabit(fs, vault, {})
  assert.equal(habit.source, 'none')
  assert.equal(habit.todayRel, null)
  assert.equal(hasDailyHabit(habit), false)
})

test('mergeHomeWidgets keeps catalog order and drops unknown ids', () => {
  const merged = mergeHomeWidgets([
    { id: 'links', enabled: true },
    { id: 'continue', enabled: false },
    { id: 'from-future', enabled: true },
  ])
  assert.deepEqual(merged.find((w) => w.id === 'continue'), { id: 'continue', enabled: false })
  assert.deepEqual(merged.find((w) => w.id === 'changes'), { id: 'changes', enabled: true })
  assert.deepEqual(merged.find((w) => w.id === 'links'), { id: 'links', enabled: true })
  assert.equal(merged.some((w) => w.id === 'from-future'), false)
  assert.deepEqual(enabledWidgetIds(), ['continue', 'changes'])
  assert.deepEqual(resolveWidgetIds(['links', 'nope']), ['links'])
})

test('walkVaultNotes skips hidden/excluded dirs and lists markdown', async () => {
  const { fs, vault } = await setup()
  fs.files.set('/vault/Notes/a.md', '# A')
  fs.files.set('/vault/Notes/skip.txt', 'no')
  fs.files.set('/vault/.obsidian/app.json', '{}')
  fs.files.set('/vault/.git/HEAD', 'ref')
  fs.ensureDirs('/vault/Notes')
  fs.ensureDirs('/vault/.obsidian')
  fs.ensureDirs('/vault/.git')
  const { notes, truncated } = await walkVaultNotes(fs, vault, { excludes: [] })
  assert.equal(truncated, false)
  assert.deepEqual(notes.map((n) => n.rel).sort(), ['Notes/a.md'])
})

test('surfaceOverview default widgets are continue + changes, not daily or links', async () => {
  const { fs, host, vault, allow } = await setup()
  const date = todayStamp()
  await mutateNote(fs, host, vault, opts({
    rel: 'Daily/' + date + '.md', kind: 'create', content: '# Today\nSee [[Missing Note]] and [[Hub]].',
    tool: 't', onApprove: allow,
  }))
  await mutateNote(fs, host, vault, opts({
    rel: 'Hub.md', kind: 'create', content: '# Hub',
    tool: 't', onApprove: allow,
  }))
  const overview = await surfaceOverview(fs, vault, { excludes: [] })
  assert.equal(overview.today, undefined)
  assert.equal(overview.broken, undefined)
  assert.equal(overview.brokenCount, undefined)
  assert.equal(overview.noteCount, 2)
  assert.ok(overview.recent.some((n) => n.path === 'Hub.md'))
  assert.ok(overview.changes.length >= 2)
})

test('surfaceOverview computes daily and links only when those widgets are on', async () => {
  const { fs, host, vault, allow } = await setup()
  fs.ensureDirs('/vault/.obsidian')
  fs.files.set('/vault/.obsidian/daily-notes.json', JSON.stringify({ format: 'YYYY-MM-DD', folder: 'Daily' }))
  const date = formatDailyName(Date.now(), 'YYYY-MM-DD')
  await mutateNote(fs, host, vault, opts({
    rel: 'Daily/' + date + '.md', kind: 'create', content: '# Today\nSee [[Missing Note]] and [[Hub]].',
    tool: 't', onApprove: allow,
  }))
  await mutateNote(fs, host, vault, opts({
    rel: 'Hub.md', kind: 'create', content: '# Hub',
    tool: 't', onApprove: allow,
  }))
  const overview = await surfaceOverview(fs, vault, {
    excludes: [],
    widgets: ['continue', 'changes', 'daily', 'links'],
  })
  assert.equal(overview.today?.path, 'Daily/' + date + '.md')
  assert.equal(overview.today?.title, 'Today')
  assert.equal(overview.brokenCount, 1)
  assert.equal(overview.broken[0].target, 'Missing Note')
  assert.equal(overview.broken[0].from, 'Daily/' + date + '.md')
})

test('surfaceOverview today follows Obsidian MM-DD-YYYY, not the swapped name', async () => {
  const { fs, host, vault, allow } = await setup()
  fs.ensureDirs('/vault/.obsidian')
  fs.files.set('/vault/.obsidian/daily-notes.json', JSON.stringify({ format: 'MM-DD-YYYY', folder: 'Daily' }))
  const stamp = formatDailyName(Date.now(), 'MM-DD-YYYY')
  const swapped = formatDailyName(Date.now(), 'DD-MM-YYYY')
  await mutateNote(fs, host, vault, opts({
    rel: 'Daily/' + swapped + '.md', kind: 'create', content: '# wrong order',
    tool: 't', onApprove: allow,
  }))
  const missing = await surfaceOverview(fs, vault, { excludes: [], widgets: ['daily'] })
  assert.equal(missing.todayRel, 'Daily/' + stamp + '.md')
  assert.equal(missing.today, null)
  await mutateNote(fs, host, vault, opts({
    rel: 'Daily/' + stamp + '.md', kind: 'create', content: '# correct',
    tool: 't', onApprove: allow,
  }))
  const found = await surfaceOverview(fs, vault, { excludes: [], widgets: ['daily'] })
  assert.equal(found.today?.path, 'Daily/' + stamp + '.md')
})

test('surfaceOverview changes-only does not walk recent notes', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'Hub.md', kind: 'create', content: '# Hub', tool: 't', onApprove: allow }))
  const overview = await surfaceOverview(fs, vault, { excludes: [], host, widgets: ['changes'] })
  assert.equal(overview.recent, undefined)
  assert.equal(overview.noteCount, undefined)
  assert.ok(overview.changes.length >= 1)
})

test('applyLiteralReplace is exact-once unless replaceAll', () => {
  const once = applyLiteralReplace('aa bb aa', 'bb', 'CC')
  assert.equal(once.nextText, 'aa CC aa')
  assert.throws(() => applyLiteralReplace('aa aa', 'aa', 'b'), (e) => e.code === 'AMBIGUOUS')
  const all = applyLiteralReplace('aa aa', 'aa', 'b', true)
  assert.equal(all.nextText, 'b b')
})

test('rewriteWikilinks updates stem and basename targets, keeps alias/heading', () => {
  const src = 'See [[Hub]] and [[Hub#x|alias]] and [[Other]].'
  const out = rewriteWikilinks(src, 'Hub.md', 'Archive/Hub2.md')
  assert.match(out, /\[\[Archive\/Hub2\]\]/)
  assert.match(out, /\[\[Archive\/Hub2#x\|alias\]\]/)
  assert.match(out, /\[\[Other\]\]/)
})

test('searchNotes matches title, body and tag', async () => {
  const { fs, vault, host, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'A.md', kind: 'create', content: '# Alpha\n#topic hello world', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'B.md', kind: 'create', content: '# Beta\nnothing', tool: 't', onApprove: allow }))
  const byBody = await searchNotes(fs, vault, { query: 'hello' })
  assert.equal(byBody.length, 1)
  assert.equal(byBody[0].path, 'A.md')
  const byTag = await searchNotes(fs, vault, { tag: 'topic' })
  assert.equal(byTag.length, 1)
  const listed = await listNotes(fs, vault, {})
  assert.deepEqual(listed.map((n) => n.path).sort(), ['A.md', 'B.md'])
})

test('backlinksFor and structure report orphans', async () => {
  const { fs, vault, host, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'Hub.md', kind: 'create', content: '# Hub', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'Spoke.md', kind: 'create', content: 'See [[Hub]]', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'Lonely.md', kind: 'create', content: 'alone', tool: 't', onApprove: allow }))
  const back = await backlinksFor(fs, vault, 'Hub.md')
  assert.equal(back.length, 1)
  assert.equal(back[0].path, 'Spoke.md')
  const graph = await collectGraph(fs, vault, {})
  const snap = structureFromGraph(graph)
  assert.ok(snap.orphans.includes('Lonely.md'))
  assert.equal(snap.orphans.includes('Hub.md'), false)
})

test('moveNote rewrites links, journals, and rollback restores both', async () => {
  const { fs, host, vault, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'Hub.md', kind: 'create', content: '# Hub', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'Spoke.md', kind: 'create', content: 'See [[Hub]]', tool: 't', onApprove: allow }))
  const moved = await moveNote(fs, host, vault, opts({ from: 'Hub.md', to: 'Archive/Hub.md', onApprove: allow }))
  assert.equal(moved.ok, true)
  assert.equal(moved.updatedLinks, 1)
  assert.equal(fs.files.has('/vault/Hub.md'), false)
  assert.match(fs.files.get('/vault/Spoke.md'), /\[\[Archive\/Hub\]\]/)
  const undone = await rollbackEntry(fs, host, vault, { opId: moved.opId })
  assert.equal(undone.ok, true)
  assert.equal(fs.files.has('/vault/Hub.md'), true)
  assert.match(fs.files.get('/vault/Spoke.md'), /\[\[Hub\]\]/)
})

test('parseObsidianVaults prefers open vaults', () => {
  const rows = parseObsidianVaults(JSON.stringify({
    vaults: {
      a: { path: '/notes/a', ts: 1 },
      b: { path: '/notes/b', ts: 2, open: true },
    },
  }))
  assert.equal(rows[0].path, '/notes/b')
  assert.equal(rows[0].open, true)
  assert.deepEqual(obsidianConfigPaths('/Users/me', 'darwin'), ['/Users/me/Library/Application Support/obsidian/obsidian.json'])
})

test('surfaceOverview fills structure and inbox when those widgets are on', async () => {
  const { fs, vault, host, allow } = await setup()
  await mutateNote(fs, host, vault, opts({ rel: 'Loose.md', kind: 'create', content: 'root', tool: 't', onApprove: allow }))
  await mutateNote(fs, host, vault, opts({ rel: 'Notes/A.md', kind: 'create', content: '# A\n#tag', tool: 't', onApprove: allow }))
  const overview = await surfaceOverview(fs, vault, { excludes: [], widgets: ['structure', 'inbox'] })
  assert.ok((overview.inbox ?? []).some((n) => n.path === 'Loose.md'))
  assert.ok((overview.folders ?? []).some((f) => f.name === 'Notes'))
  assert.ok((overview.tags ?? []).some((t) => t.name === 'tag'))
})

test('displayTitle prefers H1 then YAML title then filename', () => {
  assert.equal(displayTitle({ title: '数据构造反而便宜', frontmatter: { title: 'fm' } }, 'Daily/08-12-2026.md'), '数据构造反而便宜')
  assert.equal(displayTitle({ title: null, frontmatter: { title: 'Front' } }, 'Daily/08-12-2026.md'), 'Front')
  assert.equal(displayTitle({ title: null, frontmatter: null }, 'Daily/08-12-2026.md'), '08-12-2026')
})

test('previewNote allowMissing returns an empty draft for a new path', async () => {
  const { fs, vault } = await setup()
  const missing = await previewNote(fs, vault, 'Daily/08-18-2026.md', [], { allowMissing: true })
  assert.equal(missing.missing, true)
  assert.equal(missing.path, 'Daily/08-18-2026.md')
  assert.equal(missing.source, '')
  assert.equal(missing.title, '08-18-2026')
  await assert.rejects(() => previewNote(fs, vault, 'Daily/08-18-2026.md'), /does not exist/)
})

test('previewNote returns title, excerpt and outgoing links', async () => {
  const { fs, vault, host, allow } = await setup()
  await mutateNote(fs, host, vault, opts({
    rel: 'Hub.md', kind: 'create', content: '# Hub\nSee [[Other]] and #tag.',
    tool: 't', onApprove: allow,
  }))
  const preview = await previewNote(fs, vault, 'Hub.md')
  assert.equal(preview.path, 'Hub.md')
  assert.equal(preview.title, 'Hub')
  assert.match(preview.body, /See \[\[Other\]\]/)
  assert.match(preview.source, /# Hub/)
  assert.equal(preview.truncated, false)
  assert.ok(preview.wikilinks.includes('Other'))
  assert.ok(preview.tags.includes('tag'))
})

test('surfaceOverview recent is newest-mtime first, not walk/name order', async () => {
  const { fs, host, vault } = await setup()
  fs.files.set('/vault/0.md', '# Zero')
  fs.files.set('/vault/1.md', '# One')
  fs.files.set('/vault/2.md', '# Two')
  fs.mtimes.set('/vault/0.md', 1000)
  fs.mtimes.set('/vault/1.md', 3000)
  fs.mtimes.set('/vault/2.md', 2000)
  const overview = await surfaceOverview(fs, vault, { excludes: [], host })
  assert.deepEqual(overview.recent.map((n) => n.path), ['1.md', '2.md', '0.md'])
})
