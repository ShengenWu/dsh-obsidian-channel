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
const parsed = Config({ vaultDir: '/vault', writePolicy: 'auto', excludes: [], journalRetentionDays: 30 })
console.log('Config parsed:', JSON.stringify(parsed))

const registered = {}
const ctx = {
  config: parsed,
  fs,
  tools: { register: (def) => { registered[def.name] = def } },
  approval: {
    request: async (req) => {
      console.log('approval.request called for', req.toolName, '| reason:', req.reason?.slice(0, 80))
      return 'allowed-once'
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
console.log('traversal blocked:', JSON.stringify({ ok: denied.ok, action: denied.action, message: denied.message }))
if (denied.ok !== false) throw new Error('traversal not blocked')

console.log('SMOKE OK — all tools register and the full pipeline works against rc.6')
