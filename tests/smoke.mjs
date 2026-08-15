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

// config validation through the REAL schemastery.
// NOTE: vaultDir starts EMPTY (mirroring cordis.patch.yml) so the smoke test
// must prove the live settings seam supplies it — the exact bug that bit M2.
const parsed = Config({ vaultDir: '', writePolicy: 'per-write', excludes: [], journalRetentionDays: 30 })
console.log('Config parsed:', JSON.stringify(parsed))

let approvalOutcome = 'allowed-once'
let approvalCalls = 0

const registered = {}

// --- M2 optional-service stubs (settings seam + connection RPC) ---
const scopes = {}
const userSettings = {}
const channels = {}
const listeners = {}

const ctx = {
  config: parsed,
  fs,
  tools: { register: (def) => { registered[def.name] = def } },
  approval: {
    request: async (req) => {
      approvalCalls++
      console.log('approval.request called for', req.toolName, '| reason:', req.reason?.slice(0, 80))
      return approvalOutcome
    },
  },
  // settings seam (fake provider): resolved = base entry merged with user layer
  settings: {
    register: (ns, schema, options) => {
      const scope = {
        get: () => ({ ...(options?.base ?? {}), ...(userSettings[ns] ?? {}) }),
        watch: () => () => {},
        update: async (patch) => { userSettings[ns] = { ...(userSettings[ns] ?? {}), ...(patch ?? {}) } },
        replace: async (section) => { userSettings[ns] = { ...(section ?? {}) } },
      }
      scopes[ns] = scope
      return scope
    },
    describe: () => [],
    get: () => undefined,
  },
  // connection RPC registry (fake): captures the /obsidian channel handler
  connection: {
    rpc: {
      handle: (channel, handler, options) => {
        channels[channel] = { handler, options }
        return async () => {}
      },
      intercept: () => async () => {},
    },
  },
  // cordis-style optional inject, ASYNC like the real runtime: the callback is
  // scheduled, not run synchronously. This is what the old sync stub masked —
  // it let `setSource` run before the tools captured `currentConfig`.
  inject: (names, cb) => {
    if (names.every((n) => n in ctx)) queueMicrotask(() => cb(ctx))
  },
  // cordis fiber effect (fake): no-op disposer registration
  effect: () => () => {},
  // event listener registry (fake): capture listeners so the fs write guard
  // can be asserted directly.
  on: (name, listener, options) => {
    listeners[name] = listeners[name] ?? []
    if (options?.prepend) listeners[name].unshift(listener)
    else listeners[name].push(listener)
    return () => {}
  },
}

apply(ctx, parsed)

// Flush the async inject so the settings namespace registers, then seed the
// user layer with vaultDir (the real deployment reads this from settings.yaml).
await Promise.resolve()
if (scopes['dsh-obsidian-channel'] === undefined) throw new Error('settings namespace did not register after async inject')
await scopes['dsh-obsidian-channel'].update({ vaultDir: '/vault' })
console.log('settings scope seeded: vaultDir=/vault via live settings seam')

// fs write guard: native write/edit into the vault must be rejected with a
// tool-redirect message; writes outside the vault pass through untouched.
{
  const guard = (listeners['fs/write-intent'] ?? [])[0]
  if (guard === undefined) throw new Error('fs/write-intent guard not registered')
  let threw = null
  try { await guard({ targetKey: '/vault/Notes/x.md' }, {}, async () => 'intent') } catch (e) { threw = e }
  if (threw === null || !/obsidian_/.test(String(threw.message))) throw new Error('native vault write should be rejected: ' + JSON.stringify(threw))
  const passed = await guard({ targetKey: '/elsewhere/x.md' }, {}, async () => 'intent')
  if (passed !== 'intent') throw new Error('non-vault write should pass through: ' + JSON.stringify(passed))
  console.log('fs write guard: native vault write rejected, outside write passes OK')
}

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
      if (sub.required === true && (value[k] === undefined || value[k] === null)) {
        throw new Error(where + ': missing required property "' + k + '"')
      }
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

  // batch dry-run -> the harness caught this live: the result MUST carry `action`
  const bDry = await registered['obsidian_batch'].execute({ vaultDir: '/vault', dryRun: true, ops: [{ action: 'create', path: 'Batch/dry.md', content: 'x' }] }, exec)
  conform(registered['obsidian_batch'].output.schema, bDry, 'batch-dry-run')
  if (bDry.ok !== true || bDry.action !== 'batch' || !Array.isArray(bDry.results)) throw new Error('batch-dry-run shape wrong: ' + JSON.stringify(bDry))

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

// --- M2 wiring: panel RPC channel + live settings scope ---
{
  if (channels['/obsidian'] === undefined) throw new Error('panel RPC channel /obsidian not registered')
  if (channels['/obsidian'].options.authority !== 'loopback') throw new Error('panel channel must be loopback-only')
  const rpc = channels['/obsidian'].handler

  // config/get + config/set: the Settings page reads/writes config through the
  // plugin's own RPC (settings.describe never exposes third-party namespaces).
  const cfgGet = await rpc('config/get', {}, undefined)
  if (cfgGet.ok !== true || cfgGet.value.vaultDir !== '/vault') throw new Error('config/get failed: ' + JSON.stringify(cfgGet))
  console.log('rpc config/get:', JSON.stringify(cfgGet.value))

  const cfgSet = await rpc('config/set', { field: 'writePolicy', value: 'auto' }, undefined)
  if (cfgSet.ok !== true || cfgSet.value.writePolicy !== 'auto') throw new Error('config/set failed: ' + JSON.stringify(cfgSet))
  await rpc('config/set', { field: 'writePolicy', value: 'per-write' }, undefined)
  console.log('rpc config/set: writePolicy round-trip OK')

  const list = await rpc('history/list', { limit: 10 }, undefined)
  if (list.ok !== true || !Array.isArray(list.value.entries) || list.value.entries.length === 0) throw new Error('history/list failed: ' + JSON.stringify(list))
  console.log('rpc history/list:', list.value.entries.length, 'entries')

  const entryRes = await rpc('history/entry', { opId: list.value.entries[0].opId }, undefined)
  if (entryRes.ok !== true || typeof entryRes.value.after !== 'string') throw new Error('history/entry failed: ' + JSON.stringify(entryRes))
  if (entryRes.value.before !== null && typeof entryRes.value.before !== 'string') throw new Error('history/entry before image must be string or null')
  console.log('rpc history/entry: ok, after image', entryRes.value.after.length, 'bytes')

  const rollbackRes = await rpc('history/rollback', { opId: undo.opId }, undefined)
  if (rollbackRes.ok !== true || rollbackRes.value.action === undefined) throw new Error('history/rollback failed: ' + JSON.stringify(rollbackRes))
  console.log('rpc history/rollback:', JSON.stringify({ ok: rollbackRes.ok, action: rollbackRes.value.action }))

  const check = await rpc('vault/check', {}, undefined)
  if (check.ok !== true || check.value.vault !== '/vault') throw new Error('vault/check failed: ' + JSON.stringify(check))
  console.log('rpc vault/check:', JSON.stringify(check.value))

  const bad = await rpc('nope', {}, undefined)
  if (bad.ok !== false || bad.error.code !== 'internal') throw new Error('unknown endpoint must fail with internal: ' + JSON.stringify(bad))
  console.log('rpc unknown endpoint: internal error OK')

  // live settings vaultDir default: read with NO vaultDir must hit the seeded default
  const rDefault = await registered['obsidian_read'].execute({ path: 'Notes/demo.md' }, exec)
  conform(registered['obsidian_read'].output.schema, rDefault, 'read-default-vault')
  if (rDefault.ok !== true || rDefault.path !== 'Notes/demo.md') throw new Error('settings vaultDir default not applied: ' + JSON.stringify(rDefault))
  console.log('settings vaultDir default: read without vaultDir OK')

  // live settings switch: writePolicy auto must skip the approval seam entirely
  if (scopes['dsh-obsidian-channel'] === undefined) throw new Error('settings namespace not registered')
  await scopes['dsh-obsidian-channel'].update({ writePolicy: 'auto' })
  const callsBefore = approvalCalls
  const autoCreated = await registered['obsidian_note_create'].execute({ vaultDir: '/vault', path: 'Notes/auto.md', content: 'auto' }, exec)
  if (autoCreated.ok !== true) throw new Error('auto-policy create failed: ' + JSON.stringify(autoCreated))
  if (approvalCalls !== callsBefore) throw new Error('auto policy must not call the approval seam')
  await scopes['dsh-obsidian-channel'].update({ writePolicy: 'per-write' })
  console.log('live settings switch: auto write without approval OK')
}

// --- sandbox escalation wiring: confined fs must advertise escalation and map denial ---
{
  const escReg = {}
  const escFs = new StubFs()
  escFs.mkdirP('/vault')     // the workspace root
  escFs.mkdirP('/outside')   // a vault OUTSIDE the workspace
  escFs.sandboxMode = 'workspace-write'
  const escBaseWrite = escFs.writeText.bind(escFs)
  escFs.writeText = (target, content, expected, signal, policy) => {
    const mode = policy?.mode ?? 'workspace-write'
    if (mode === 'danger-full-access') return escBaseWrite(target, content, expected, signal)
    if (!String(target.targetKey).startsWith('/vault')) {
      const e = new Error('cannot write outside workspace')
      e.code = 'FS_SANDBOX_DENIED'
      throw e
    }
    return escBaseWrite(target, content, expected, signal)
  }

  const escCtx = {
    fs: escFs,
    tools: { register: (def) => { escReg[def.name] = def } },
    approval: { request: async () => 'allowed-once' },
    settings: {
      register: (ns, schema, options) => ({
        get: () => ({ ...(options?.base ?? {}) }),
        watch: () => () => {},
        update: async () => {},
        replace: async () => {},
      }),
      describe: () => [],
      get: () => undefined,
    },
    connection: { rpc: { handle: () => async () => {}, intercept: () => async () => {} } },
    inject: (names, cb) => { if (names.every((n) => n in escCtx)) queueMicrotask(() => cb(escCtx)) },
    effect: () => () => {},
    on: () => () => {},
    get: (n) => (n === 'sandboxPolicy' ? { defaultMode: 'workspace-write', resolve: () => ({ mode: 'workspace-write', workspaceRoot: '/vault' }) } : undefined),
  }
  apply(escCtx, Config({ vaultDir: '/outside', writePolicy: 'per-write', excludes: [], journalRetentionDays: 30 }))
  await Promise.resolve()

  const escCreate = escReg['obsidian_note_create']
  const escParams = escCreate.parameters?.properties ?? {}
  if (escParams.sandbox_permissions === undefined || escParams.justification === undefined) {
    throw new Error('write tool must advertise sandbox_permissions/justification when confined')
  }

  const denied = await escCreate.execute({ vaultDir: '/outside', path: 'x.md', content: 'x' }, exec)
  if (denied.ok !== false || denied.code !== 'SANDBOX_DENIED' || !/sandbox: escalation available/.test(denied.message ?? '')) {
    throw new Error('outside-workspace write should map to the escalation hint: ' + JSON.stringify(denied))
  }
  console.log('sandbox escalation: denial mapped to hint OK')

  const allowed = await escCreate.execute({ vaultDir: '/outside', path: 'x.md', content: 'x', sandbox_permissions: 'danger-full-access', justification: 'test write to the vault outside the workspace' }, exec)
  if (allowed.ok !== true) throw new Error('escalated write should succeed: ' + JSON.stringify(allowed))
  console.log('sandbox escalation: approved retry writes OK')
}

console.log('SMOKE OK — all tools register and the full pipeline works against rc.6')
