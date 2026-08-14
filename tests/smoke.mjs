/**
 * End-to-end smoke test against the REAL rc.6 runtime packages
 * (@deepseek-ai/dsh-tools + schemastery symlinked from the installed dsh):
 * registers every tool through the actual defineTool/schemastery compilers
 * and executes the write pipeline with an in-memory fs.
 *
 * Run: node tests/smoke.mjs
 */
import { apply, Config } from '../src/index.js'
import { openVault } from '../src/engine.js'

// --- minimal in-memory fs (same contract as engine tests) ---
class StubFs {
  constructor() { this.files = new Map(); this.dirs = new Set(); this.symlinks = new Set(); this.versions = new Map() }
  ensureDirs(p) { const parts = p.split('/').filter(Boolean); let acc = ''; for (const part of parts) { acc += '/' + part; this.dirs.add(acc) } }
  resolve(path) { return { targetKey: path, path } }
  processPath(t) { return t.targetKey }
  lstat(path) { if (this.symlinks.has(path)) return { type: 'symlink' }; if (this.files.has(path)) return { type: 'file', size: this.files.get(path).length }; if (this.dirs.has(path)) return { type: 'directory' }; return undefined }
  stat(target) { const p = target.targetKey; if (this.files.has(p)) return { version: this.versions.get(p) ?? '0', type: 'file', size: this.files.get(p).length }; if (this.dirs.has(p)) return { version: '0', type: 'directory' }; return undefined }
  contains(a, b) { const pp = a.targetKey; const cp = b.targetKey; return cp === pp || cp.startsWith(pp + '/') }
  readText(t) { const p = t.targetKey; if (!this.files.has(p)) throw new Error('ENOENT ' + p); return this.files.get(p) }
  childrenOf(d) { const out = []; const seen = new Set(); const pre = d.endsWith('/') ? d : d + '/'; for (const p of this.files.keys()) { if (!p.startsWith(pre)) continue; const rest = p.slice(pre.length); if (rest.includes('/') || seen.has(rest)) continue; seen.add(rest); out.push({ name: rest, type: 'file', target: this.resolve(p) }) } for (const dd of this.dirs) { if (dd === d || !dd.startsWith(pre)) continue; const rest = dd.slice(pre.length); if (rest.includes('/') || seen.has(rest)) continue; seen.add(rest); out.push({ name: rest, type: 'directory', target: this.resolve(dd) }) } return out }
  listDir(t) { const p = t.targetKey; if (!this.dirs.has(p)) return []; return this.childrenOf(p) }
  writeText(t, content, expected) { const p = t.targetKey; const exists = this.files.has(p); if (expected?.kind === 'createIfAbsent' && exists) { const e = new Error('exists'); e.code = 'FS_NOT_OBSERVED'; throw e } if (expected?.kind === 'replaceIfVersion' && (!exists || (this.versions.get(p) ?? '0') !== expected.version)) { const e = new Error('stale'); e.code = 'FS_STALE_VERSION'; throw e } const before = exists ? this.files.get(p) : null; const v = String((parseInt(this.versions.get(p) ?? '0', 10)) + 1); this.files.set(p, content); this.versions.set(p, v); this.ensureDirs(p.slice(0, p.lastIndexOf('/'))); return { operation: exists ? 'update' : 'create', version: v, before, after: content } }
  rename(f, t) { this.files.set(t, this.files.get(f)); this.files.delete(f); this.versions.set(t, String((parseInt(this.versions.get(t) ?? '0', 10)) + 1)); this.versions.delete(f); this.ensureDirs(t.slice(0, t.lastIndexOf('/'))) }
  mkdirP(d) { this.ensureDirs(d) }
  rmrf(d) { for (const p of [...this.files.keys()]) if (p === d || p.startsWith(d + '/')) { this.files.delete(p); this.versions.delete(p) } for (const p of [...this.dirs]) if (p === d || p.startsWith(d + '/')) this.dirs.delete(p) }
}

const fs = new StubFs()
fs.mkdirP('/vault')

// config validation through the REAL schemastery
const parsed = Config({ vaultDir: '/vault', writePolicy: 'per-write', excludes: [], journalRetentionDays: 30 })
console.log('Config parsed:', JSON.stringify(parsed))

let approvalOutcome = 'allowed-once'

const registered = {}
const ctx = {
  config: parsed,
  fs,
  tools: { register: (def) => { registered[def.name] = def } },
  approval: {
    request: async (req) => {
      console.log('approval.request called for', req.toolName, '| reason:', req.reason?.slice(0, 80))
      return approvalOutcome
    },
  },
}

apply(ctx, parsed)

const names = Object.keys(registered).sort()
console.log('registered tools (' + names.length + '):', names.join(', '))

const expected = [
  'obsidian_read', 'obsidian_note_create', 'obsidian_note_update',
  'obsidian_note_append', 'obsidian_note_delete', 'obsidian_batch',
  'obsidian_history', 'obsidian_undo', 'obsidian_rollback', 'obsidian_restore',
]
for (const n of expected) {
  if (!registered[n]) throw new Error('missing tool: ' + n)
}

const exec = { signal: undefined, callId: 'c1', rootCallId: 'r1', agent: { session: { id: 's1' } } }

// --- output schema conformance checker (mirrors the harness-side validator) ---
// The real harness rejects any tool result whose shape violates the declared
// output schema (additionalProperties: false at object roots). Calling the
// compiled .execute() directly bypasses that layer, so we re-assert it here.
function conform(schema, value, where) {
  if (value === undefined || value === null) return
  if (schema.type === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) throw new Error(where + ': expected object, got ' + JSON.stringify(value))
    if (schema.additionalProperties === false) {
      const declared = new Set(Object.keys(schema.properties ?? {}))
      for (const k of Object.keys(value)) {
        if (!declared.has(k)) throw new Error(where + ': undeclared property "' + k + '" (additionalProperties: false)')
      }
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (value[k] !== undefined && value[k] !== null) conform(sub, value[k], where + '.' + k)
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) throw new Error(where + ': expected array')
    for (let i = 0; i < value.length; i++) conform(schema.items ?? {}, value[i], where + '[' + i + ']')
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') throw new Error(where + ': expected boolean, got ' + JSON.stringify(value))
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') throw new Error(where + ': expected string, got ' + JSON.stringify(value))
  } else if (schema.type === 'number') {
    if (typeof value !== 'number') throw new Error(where + ': expected number, got ' + JSON.stringify(value))
  }
}

// full pipeline through the REAL defineTool execute + schemastery validation
const created = await registered['obsidian_note_create'].execute({ vaultDir: '/vault', path: 'Notes/demo.md', content: '# Demo', frontmatter: { tags: ['t'] } }, exec)
console.log('create:', JSON.stringify(created))
if (created.ok !== true) throw new Error('create failed')

const read = await registered['obsidian_read'].execute({ vaultDir: '/vault', path: 'Notes/demo.md' }, exec)
console.log('read:', JSON.stringify({ ok: read.ok, path: read.path, title: read.title, version: read.version }))

const updated = await registered['obsidian_note_update'].execute({ vaultDir: '/vault', path: 'Notes/demo.md', content: '# Demo 2', baseVersion: read.version }, exec)
console.log('update:', JSON.stringify({ ok: updated.ok, action: updated.action, opId: updated.opId }))
if (updated.ok !== true) throw new Error('update failed')

const undo = await registered['obsidian_undo'].execute({ vaultDir: '/vault', path: 'Notes/demo.md' }, exec)
console.log('undo:', JSON.stringify(undo))
if (undo.ok !== true) throw new Error('undo failed')
if (fs.files.get('/vault/Notes/demo.md') !== '---\ntags: [t]\n---\n# Demo') throw new Error('undo did not restore bytes')

const history = await registered['obsidian_history'].execute({ vaultDir: '/vault', limit: 10 }, exec)
console.log('history entries:', history.entries?.length)
if (history.ok !== true || history.entries.length < 2) throw new Error('history failed')

const denied = await registered['obsidian_note_create'].execute({ vaultDir: '/vault', path: 'escape/../x.md', content: 'no' }, exec)
conform(registered['obsidian_note_create'].output.schema, denied, 'traversal')
console.log('traversal blocked:', JSON.stringify({ ok: denied.ok, action: denied.action, message: denied.message }))
if (denied.ok !== false) throw new Error('traversal not blocked')

// --- error / rejection / noop paths (the shapes the harness validator sees) ---
{
  // read a note that does not exist -> errTurn path (the rc.6 schema bug lived here)
  const r1 = await registered['obsidian_read'].execute({ vaultDir: '/vault', path: 'missing.md' }, exec)
  conform(registered['obsidian_read'].output.schema, r1, 'read-missing')
  if (r1.ok !== false || r1.code !== 'NOT_FOUND') throw new Error('read-missing shape wrong: ' + JSON.stringify(r1))
  console.log('read-missing:', JSON.stringify({ ok: r1.ok, code: r1.code, message: r1.message }))

  // write rejected by the approval seam -> denied shape, nothing written (fail-closed)
  approvalOutcome = 'rejected'
  const d1 = await registered['obsidian_note_create'].execute({ vaultDir: '/vault', path: 'Notes/blocked.md', content: 'x' }, exec)
  conform(registered['obsidian_note_create'].output.schema, d1, 'create-denied')
  if (d1.ok !== false || d1.action !== 'denied' || d1.outcome !== 'rejected') throw new Error('create-denied shape wrong: ' + JSON.stringify(d1))
  if (fs.files.has('/vault/Notes/blocked.md')) throw new Error('denied write must not touch the vault')
  approvalOutcome = 'allowed-once'
  console.log('create-denied:', JSON.stringify({ ok: d1.ok, action: d1.action, outcome: d1.outcome }))

  // append to a missing note -> engine error shape
  const a1 = await registered['obsidian_note_append'].execute({ vaultDir: '/vault', path: 'nope.md', content: 'x' }, exec)
  conform(registered['obsidian_note_append'].output.schema, a1, 'append-missing')
  if (a1.ok !== false || a1.action !== 'error') throw new Error('append-missing shape wrong: ' + JSON.stringify(a1))

  // delete a missing note -> engine error shape
  const x1 = await registered['obsidian_note_delete'].execute({ vaultDir: '/vault', path: 'nope.md' }, exec)
  conform(registered['obsidian_note_delete'].output.schema, x1, 'delete-missing')
  if (x1.ok !== false) throw new Error('delete-missing shape wrong: ' + JSON.stringify(x1))

  // undo on a path with no journal -> noop shape
  const u1 = await registered['obsidian_undo'].execute({ vaultDir: '/vault', path: 'never-touched.md' }, exec)
  conform(registered['obsidian_undo'].output.schema, u1, 'undo-noop')
  if (u1.ok !== true || u1.action !== 'noop') throw new Error('undo-noop shape wrong: ' + JSON.stringify(u1))

  // batch with an unknown op -> errTurn shape
  const b1 = await registered['obsidian_batch'].execute({ vaultDir: '/vault', ops: [{ action: 'explode' }] }, exec)
  conform(registered['obsidian_batch'].output.schema, b1, 'batch-unknown')
  if (b1.ok !== false) throw new Error('batch-unknown shape wrong: ' + JSON.stringify(b1))

  // restore with no deletion record -> error shape
  const rs1 = await registered['obsidian_restore'].execute({ vaultDir: '/vault', path: 'nope.md' }, exec)
  conform(registered['obsidian_restore'].output.schema, rs1, 'restore-missing')
  if (rs1.ok !== false) throw new Error('restore-missing shape wrong: ' + JSON.stringify(rs1))

  // plain note: no H1, no frontmatter -> optional fields must be ABSENT, not null
  await registered['obsidian_note_create'].execute({ vaultDir: '/vault', path: 'Plain/plain.md', content: 'just text, no title' }, exec)
  const rp = await registered['obsidian_read'].execute({ vaultDir: '/vault', path: 'Plain/plain.md' }, exec)
  conform(registered['obsidian_read'].output.schema, rp, 'read-plain')
  if ('title' in rp || 'frontmatter' in rp) throw new Error('read-plain must omit null title/frontmatter: ' + JSON.stringify(rp))
  console.log('read-plain:', JSON.stringify({ ok: rp.ok, hasTitle: 'title' in rp, hasFrontmatter: 'frontmatter' in rp }))

  // no-op update (same content) -> skip path with opId omitted, not null
  const sk = await registered['obsidian_note_update'].execute({ vaultDir: '/vault', path: 'Plain/plain.md', content: 'just text, no title' }, exec)
  conform(registered['obsidian_note_update'].output.schema, sk, 'update-skip')
  if (sk.ok !== true || sk.action !== 'skip' || 'opId' in sk) throw new Error('update-skip shape wrong: ' + JSON.stringify(sk))
  console.log('update-skip:', JSON.stringify({ ok: sk.ok, action: sk.action, message: sk.message }))
}

console.log('SMOKE OK — all tools register and the full pipeline works against rc.6')
