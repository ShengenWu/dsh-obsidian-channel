/**
 * dsh-obsidian-channel — engine safety-kernel tests (node:test + in-memory fs).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeRelPath, relExcluded, openVault, resolveNotePath, parseNote,
  renderFrontmatter, applyFrontmatterEdit, mutateNote, deleteNote, batchMutate,
  listJournal, latestDoneEntry, rollbackEntry, restoreFromTrash,
} from '../src/engine.js'

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
      return { version: this.versions.get(p) ?? 0, type: 'file', size: this.files.get(p).length }
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
