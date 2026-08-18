/**
 * dsh-obsidian-channel — pure core engine (M1).
 *
 * Framework-free: every I/O goes through the injected adapters so the whole
 * safety kernel (boundary, conflict detection, journal, rollback, trash,
 * frontmatter merge) is unit-testable against an in-memory stub.
 *
 * Adapter contracts:
 *   fs   — the dsh FileSystem seam subset:
 *          resolve(path) → target          (opaque; absent paths resolvable)
 *          processPath(target) → abs path
 *          lstat(path) → { type: 'file'|'directory'|'symlink'|'other' } | undefined
 *          stat(target) → { version, type, size? } | undefined
 *          contains(parentTarget, childTarget) → boolean
 *          readText(target) → string
 *          listDir(target) → [{ name, type, target }]
 *          writeText(target, content, expected?) → { operation, version, before, after }
 *            (throws { code: 'FS_STALE_VERSION' | 'FS_NOT_OBSERVED' } on guard failure)
 *   host  — guarded host-side file operations (only used for trash moves,
 *          which the fs seam deliberately cannot express):
 *          rename(sourceAbs, destAbs) → Promise<void>
 *          mkdirP(dirAbs) → Promise<void>
 *          rmrf(dirAbs) → Promise<void>   (journal pruning; optional)
 *
 * @module dsh-obsidian-channel/engine
 */

import { createHash, randomUUID } from 'node:crypto'
import { HOME_WIDGETS_NEED_WALK, resolveWidgetIds } from './home-catalog.js'

// ---------------------------------------------------------------------------
// Constants & errors
// ---------------------------------------------------------------------------

/** Plugin-owned admin area inside the vault (json only, no .md pollution). */
export const ADMIN_DIR = '.dsh-obsidian'
export const JOURNAL_DIR = '.dsh-obsidian/journal'
export const TRASH_DIR = '.dsh-obsidian/trash'

/** Built-in excluded directory names (always added to config.excludes). */
export const DEFAULT_EXCLUDES = ['.obsidian', '.git', '.dsh-obsidian', '.trash']

/** Model-facing error taxonomy. */
export class SafeError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'SafeError'
    this.code = code
  }
}

export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Validation regex for frontmatter keys we touch. */
const FM_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/

/** Frontmatter block at the very start of a note. */
const FM_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

const WRITE_SIZE_LIMIT = 2 * 1024 * 1024 // 2 MB per note write

// ---------------------------------------------------------------------------
// Path utilities (pure)
// ---------------------------------------------------------------------------

/**
 * Normalize a model-supplied relative path into a safe relative path.
 * Rejects absolute paths, drive prefixes, backslash tricks, .. traversal,
 * empty segments, and leading dots (hidden entries).
 */
export function sanitizeRelPath(rel) {
  if (typeof rel !== 'string' || rel.trim() === '') {
    throw new SafeError('path must be a non-empty relative path', 'INVALID_PATH')
  }
  if (rel.includes('\u0000')) throw new SafeError('path contains a NUL byte', 'INVALID_PATH')
  if (rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) throw new SafeError('absolute paths are not allowed', 'INVALID_PATH')
  const norm = rel.replace(/\\\\/g, '/').replace(/\\+/g, '/')
  const segments = norm.split('/').filter((s) => s !== '' && s !== '.')
  if (segments.length === 0) throw new SafeError('path is empty', 'INVALID_PATH')
  for (const seg of segments) {
    if (seg === '..') throw new SafeError('path traversal is not allowed', 'INVALID_PATH')
    if (seg.startsWith('.')) throw new SafeError('hidden paths are not allowed', 'INVALID_PATH')
    if (seg.length > 200) throw new SafeError('path segment too long', 'INVALID_PATH')
    if (/[<>:"|?*\u0000-\u001f]/.test(seg)) throw new SafeError('path contains invalid characters', 'INVALID_PATH')
  }
  return segments.join('/')
}

/** Whether a relative path lives inside one of the excluded directories. */
export function relExcluded(rel, excludes = []) {
  const top = rel.split('/')[0]
  return [...DEFAULT_EXCLUDES, ...excludes].includes(top)
}

// ---------------------------------------------------------------------------
// Vault & boundary
// ---------------------------------------------------------------------------

/**
 * Open the vault root: resolve, verify presence and directory-ness.
 */
export async function openVault(fs, vaultDir) {
  if (typeof vaultDir !== 'string' || vaultDir.trim() === '') {
    throw new SafeError('vaultDir is required (configure the plugin or pass it per call)', 'VAULT_REQUIRED')
  }
  const vaultTarget = await fs.resolve(vaultDir)
  const info = await fs.stat(vaultTarget)
  if (info === undefined) throw new SafeError('vault not found: ' + vaultDir, 'VAULT_NOT_FOUND')
  if (info.type !== 'directory') throw new SafeError('vault path is not a directory', 'VAULT_NOT_DIR')
  return { vaultTarget, vaultAbs: fs.processPath(vaultTarget) }
}

/**
 * Resolve a model-supplied relative path against the vault with the full L0
 * boundary: sanitize, exclude check, symlink-escape rejection, canonical
 * containment. This is the single gate every read/write funnels through.
 */
export async function resolveNotePath(fs, vault, relPath, excludes = []) {
  const rel = sanitizeRelPath(relPath)
  if (relExcluded(rel, excludes)) {
    throw new SafeError('path is inside an excluded directory: ' + rel, 'EXCLUDED')
  }
  const abs = vault.vaultAbs + '/' + rel
  const lp = await fs.lstat(abs)
  if (lp !== undefined && lp.type === 'symlink') {
    throw new SafeError('symlink paths are not allowed inside the vault', 'SYMLINK')
  }
  const target = await fs.resolve(abs)
  if (!fs.contains(vault.vaultTarget, target)) {
    throw new SafeError('path escapes the vault boundary: ' + rel, 'BOUNDARY')
  }
  return { target, rel, abs }
}

// ---------------------------------------------------------------------------
// Note parsing & frontmatter
// ---------------------------------------------------------------------------

/**
 * Parse a note into frontmatter / body / metadata. Byte-preserving: body is
 * exactly the text after the frontmatter block (or the whole text).
 */
export function parseNote(text) {
  const result = { frontmatter: null, body: text, title: null, tags: [], wikilinks: [] }
  const m = FM_BLOCK_RE.exec(text)
  if (m !== null) {
    result.body = text.slice(m[0].length)
    const fm = {}
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line)
      if (kv !== null) {
        const raw = kv[2]
        fm[kv[1]] = raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
          ? raw.slice(1, -1)
          : raw
      }
    }
    result.frontmatter = fm
  }
  const h1 = /^#[ \t]+(.+?)[ \t]*$/m.exec(result.body)
  if (h1 !== null) result.title = h1[1]
  const fmTagStr = (typeof result.frontmatter?.tags === 'string' ? result.frontmatter.tags : '').replace(/^\[|\]$/g, '')
  const fmTagList = fmTagStr.split(/[,\s]+/).filter(Boolean)
  const fmTags = Array.isArray(result.frontmatter?.tags) ? result.frontmatter.tags.map(String) : []
  const inlineTags = [...result.body.matchAll(/(?:^|[ \t])#([A-Za-z0-9_\u4e00-\u9fff/-]+)/gm)].map((x) => x[1])
  result.tags = [...new Set([...fmTags, ...fmTagList, ...inlineTags])]
  result.wikilinks = [...result.body.matchAll(/\[\[([^\]|#^]+)(?:[|#][^\]]*)?\]\]/g)].map((x) => x[1].trim())
  return result
}

/** Serialize a frontmatter object for NEW notes (scalar values only). */
export function renderFrontmatter(fm) {
  if (fm === null || fm === undefined) return ''
  if (typeof fm !== 'object' || Array.isArray(fm)) throw new SafeError('frontmatter must be an object', 'INVALID_ARGS')
  if (Object.keys(fm).length === 0) return ''
  const lines = ['---']
  for (const [k, v] of Object.entries(fm)) {
    if (!FM_KEY_RE.test(k)) throw new SafeError('invalid frontmatter key: ' + k, 'INVALID_ARGS')
    if (v === null || v === undefined) continue
    let rendered
    if (typeof v === 'number' || typeof v === 'boolean') rendered = String(v)
    else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      rendered = '[' + v.map((x) => (x.includes(',') ? JSON.stringify(x) : x)).join(', ') + ']'
    } else if (typeof v === 'string') {
      rendered = /^[A-Za-z0-9_./# -]+$/.test(v) ? v : JSON.stringify(v)
    } else {
      throw new SafeError('unsupported frontmatter value type for key ' + k, 'INVALID_ARGS')
    }
    lines.push(k + ': ' + rendered)
  }
  lines.push('---', '')
  return lines.join('\n')
}

/**
 * Line-based frontmatter edit: byte-preserving merge.
 * - updates: { key: stringValue | null } — null removes the key
 * - deletes: [key, ...]
 * Only listed keys change; every other byte (body, unknown keys, comments,
 * ordering) is preserved exactly.
 */
export function applyFrontmatterEdit(originalText, updates = {}, deletes = []) {
  const updateKeys = Object.keys(updates ?? {})
  const deleteKeys = deletes ?? []
  const allKeys = [...new Set([...updateKeys, ...deleteKeys])]
  if (allKeys.length === 0) return { text: originalText, changed: false, edits: [] }
  for (const k of allKeys) {
    if (!FM_KEY_RE.test(k)) throw new SafeError('invalid frontmatter key: ' + k, 'INVALID_ARGS')
  }
  const m = FM_BLOCK_RE.exec(originalText)
  if (m === null) throw new SafeError('note has no frontmatter block to edit', 'NO_FRONTMATTER')
  const block = m[1]
  const newline = m[0].includes('\r\n') ? '\r\n' : '\n'
  const edits = []
  const kept = []
  const seen = new Set()
  for (const line of block.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(line)
    if (kv !== null && allKeys.includes(kv[1])) {
      seen.add(kv[1])
      const target = updateKeys.includes(kv[1]) ? updates[kv[1]] : null
      if (target !== null && target !== undefined) {
        const safe = typeof target === 'string' && !/^[A-Za-z0-9_./# -]+$/.test(target)
          ? JSON.stringify(target)
          : String(target)
        kept.push(kv[1] + ': ' + safe)
        edits.push({ key: kv[1], kind: 'update' })
      } else {
        edits.push({ key: kv[1], kind: 'delete' })
      }
      continue
    }
    kept.push(line)
  }
  for (const k of updateKeys) {
    if (seen.has(k)) continue
    const target = updates[k]
    if (target === null || target === undefined) continue
    const safe = typeof target === 'string' && !/^[A-Za-z0-9_./# -]+$/.test(target)
      ? JSON.stringify(target)
      : String(target)
    kept.push(k + ': ' + safe)
    edits.push({ key: k, kind: 'add' })
  }
  const newBlock = kept.join(newline)
  const innerStart = m[0].indexOf(m[1])
  const head = m[0].slice(0, innerStart)
  const tail = m[0].slice(innerStart + m[1].length)
  const text = head + newBlock + tail + originalText.slice(m[0].length)
  return { text, changed: edits.length > 0, edits }
}

/**
 * Literal string replacement (iamzcr-style). oldString must appear exactly
 * once unless replaceAll is set.
 */
export function applyLiteralReplace(current, oldString, newString, replaceAll = false) {
  if (typeof oldString !== 'string' || oldString === '') {
    throw new SafeError('oldString must be a non-empty string', 'INVALID_ARGS')
  }
  const next = String(newString ?? '')
  const idx = current.indexOf(oldString)
  if (idx < 0) throw new SafeError('oldString not found in the note', 'NOT_FOUND')
  if (!replaceAll && current.indexOf(oldString, idx + oldString.length) >= 0) {
    throw new SafeError('oldString appears multiple times; set replaceAll or disambiguate', 'AMBIGUOUS')
  }
  const text = replaceAll
    ? current.split(oldString).join(next)
    : current.slice(0, idx) + next + current.slice(idx + oldString.length)
  return { nextText: text, changed: text !== current }
}

/** Rewrite wikilinks that pointed at fromRel so they point at toRel. */
export function rewriteWikilinks(text, fromRel, toRel) {
  const fromStem = stemOf(fromRel)
  const toStem = stemOf(toRel)
  const fromBase = baseOf(fromRel)
  const toBase = baseOf(toRel)
  if (fromStem === toStem && fromBase === toBase) return text
  return text.replace(/\[\[([^\]|#\n]+)((?:#[^\]|\n]*)?)((?:\|[^\]]*)?)\]\]/g, (all, target, hash = '', alias = '') => {
    const t = String(target ?? '').replace(/\\/g, '/').replace(/\.md$/i, '').trim()
    let next = null
    if (t === fromStem) next = toStem
    else if (t === fromBase && fromBase !== fromStem) next = toBase
    else if (t === fromBase) next = toBase
    if (next === null) return all
    return '[[' + next + hash + alias + ']]'
  })
}

// ---------------------------------------------------------------------------
// Journal (L3) & trash (L4)
// ---------------------------------------------------------------------------

export const journalEntryId = () => randomUUID()

/** Monotonic wall clock: two entries never share a timestamp. */
let lastMonotonicTs = 0
export function monotonicNow() {
  const t = Date.now()
  lastMonotonicTs = Math.max(t, lastMonotonicTs + 1)
  return lastMonotonicTs
}

const pad = (n) => String(n).padStart(2, '0')

function journalRelPath(entry) {
  const d = new Date(entry.ts ?? Date.now())
  const day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
  return JOURNAL_DIR + '/' + day + '/' + entry.opId + '.json'
}

function serializeEntry(entry) {
  return JSON.stringify(entry, (_k, v) => (v === undefined ? null : v), 2)
}

/** Write a journal entry (create) — writeText creates parent dirs on the local backend. */
export async function writeJournalEntry(fs, vault, entry, sandboxPolicy) {
  const rel = journalRelPath(entry)
  const target = await fs.resolve(vault.vaultAbs + '/' + rel)
  const content = serializeEntry(entry)
  if (content.length > WRITE_SIZE_LIMIT) throw new SafeError('journal entry exceeds size limit', 'SIZE_LIMIT')
  await fs.writeText(target, content, { kind: 'createIfAbsent' }, undefined, sandboxPolicy)
  return rel
}

/** Update an existing journal entry in place (status transition planned → done). */
export async function updateJournalEntry(fs, vault, entry, prevVersion, sandboxPolicy) {
  const rel = journalRelPath(entry)
  const target = await fs.resolve(vault.vaultAbs + '/' + rel)
  const expected = prevVersion === undefined ? undefined : { kind: 'replaceIfVersion', version: prevVersion }
  await fs.writeText(target, serializeEntry(entry), expected, undefined, sandboxPolicy)
}

async function safeListDir(fs, target) {
  try {
    return await fs.listDir(target)
  } catch {
    return []
  }
}

/** List journal entries (newest first), optionally filtered to one path. */
export async function listJournal(fs, vault, { relPath, limit = 50 } = {}) {
  const root = await fs.resolve(vault.vaultAbs + '/' + JOURNAL_DIR)
  const out = []
  const days = (await safeListDir(fs, root)).filter((d) => d.type === 'directory').sort((a, b) => (a.name < b.name ? 1 : -1))
  for (const day of days) {
    if (out.length >= limit) break
    const files = (await safeListDir(fs, day.target)).filter((f) => f.type === 'file' && f.name.endsWith('.json'))
    for (const f of files.sort((a, b) => (a.name < b.name ? 1 : -1))) {
      if (out.length >= limit) break
      const text = await fs.readText(f.target)
      let entry
      try { entry = JSON.parse(text) } catch { continue }
      if (relPath !== undefined && entry.path !== relPath) continue
      out.push(entry)
    }
  }
  out.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
  return out
}

/** Fetch one journal entry by opId. */
export async function journalEntry(fs, vault, opId) {
  const entries = await listJournal(fs, vault, { limit: 10000 })
  return entries.find((e) => e.opId === opId) ?? null
}

/** Find the latest DONE entry for a path (undo target). */
export async function latestDoneEntry(fs, vault, relPath) {
  const entries = await listJournal(fs, vault, { relPath, limit: 200 })
  return entries.find((e) => e.status === 'done') ?? null
}

/** Collision-safe trash location for a delete: preserves the original path. */
export function trashRelPath(rel, opId) {
  return TRASH_DIR + '/' + rel.split('/').join('__') + '.' + opId + '.md'
}

// ---------------------------------------------------------------------------
// Mutations (the L1/L2/L3 core)
// ---------------------------------------------------------------------------

/**
 * Compute the next note text for a mutation.
 */
export function computeNextText(kind, current, opts) {
  if (kind === 'create') {
    const fm = renderFrontmatter(opts.frontmatter ?? {})
    return { nextText: fm + String(opts.content ?? ''), changed: true }
  }
  if (kind === 'update') {
    const hasContent = opts.content !== undefined && opts.content !== null
    const hasFmEdit = Object.keys(opts.frontmatterUpdates ?? {}).length > 0 || (opts.frontmatterDeletes ?? []).length > 0
    if (hasContent) {
      const fm = renderFrontmatter(opts.frontmatter ?? null)
      const nextText = fm + String(opts.content)
      return { nextText, changed: nextText !== current }
    }
    if (opts.oldString !== undefined && opts.oldString !== null) {
      return applyLiteralReplace(current, opts.oldString, opts.newString ?? '', opts.replaceAll === true)
    }
    if (hasFmEdit) {
      return applyFrontmatterEdit(current, opts.frontmatterUpdates, opts.frontmatterDeletes)
    }
    throw new SafeError('update requires content, oldString, frontmatterUpdates or frontmatterDeletes', 'INVALID_ARGS')
  }
  const addition = String(opts.content ?? '')
  if (addition === '') return { nextText: current, changed: false }
  let nextText
  if (opts.section !== undefined && opts.section !== null && opts.section !== '') {
    const anchor = '## ' + opts.section
    const idx = current.indexOf(anchor)
    if (idx === -1) {
      nextText = current.endsWith('\n') ? current + anchor + '\n\n' + addition : current + '\n\n' + anchor + '\n\n' + addition
    } else {
      const afterAnchor = current.indexOf('\n## ', idx + anchor.length)
      const insertAt = afterAnchor === -1 ? current.length : afterAnchor
      const head = current.slice(0, insertAt).replace(/\n+$/, '\n\n')
      const tail = current.slice(insertAt)
      nextText = head + addition + (tail === '' || tail.startsWith('\n') ? '' : '\n') + tail
    }
  } else {
    nextText = current.endsWith('\n') ? current + addition : current + '\n\n' + addition
  }
  return { nextText, changed: nextText !== current }
}

/**
 * The single mutation pipeline every write tool funnels through.
 *
 * Flow: boundary → read → plan (dry-run) → approval callback → journal
 * (planned) → guarded atomic write → journal (done). A stale guard reports a
 * conflict and never touches the file.
 */
export async function mutateNote(fs, host, vault, opts) {
  const { rel: relPath, kind } = opts
  const loc = await resolveNotePath(fs, vault, relPath, opts.excludes)
  const statInfo = await fs.stat(loc.target)
  const exists = statInfo !== undefined

  if (kind === 'create' && exists) {
    return { ok: false, action: 'conflict', path: relPath, message: 'note already exists; use update' }
  }
  if (kind !== 'create' && !exists) {
    return { ok: false, action: 'error', path: relPath, message: 'note does not exist' }
  }

  const current = exists ? await fs.readText(loc.target) : ''
  if (exists && current.length > WRITE_SIZE_LIMIT) {
    return { ok: false, action: 'error', path: relPath, message: 'note exceeds the size limit' }
  }
  const currentHash = exists ? sha256(current) : null
  const { nextText, changed } = computeNextText(kind, current, opts)
  const nextHash = sha256(nextText)
  const beforeHash = kind === 'create' ? null : currentHash

  const plan = {
    tool: opts.tool ?? 'obsidian_mutate',
    path: relPath,
    kind,
    beforeHash,
    afterHash: changed ? nextHash : beforeHash,
    before: kind === 'create' ? null : current,
    after: changed ? nextText : current,
    changed,
    size: nextText.length,
  }

  if (plan.size > WRITE_SIZE_LIMIT) {
    return { ok: false, action: 'error', path: relPath, message: 'resulting note exceeds the size limit' }
  }
  if (!plan.changed) return { ok: true, action: 'skip', path: relPath, opId: null, message: 'no change needed' }

  if (opts.dryRun === true) {
    return { ok: true, action: 'dry-run', path: relPath, plan }
  }

  // L2: approval gate (fail closed)
  const outcome = await (opts.onApprove ?? (async () => 'unavailable'))(plan)
  if (outcome !== 'allowed-once') {
    return { ok: false, action: 'denied', path: relPath, outcome, message: 'approval outcome: ' + outcome }
  }

  // L3: journal BEFORE the change (status planned)
  const opId = journalEntryId()
  const entry = {
    opId,
    ts: monotonicNow(),
    sessionId: opts.sessionId ?? null,
    tool: plan.tool,
    path: relPath,
    kind,
    status: 'planned',
    beforeHash,
    before: kind === 'create' ? null : current,
    afterHash: null,
    args: { ...(opts.argsSanitized ?? {}) },
  }
  await writeJournalEntry(fs, vault, entry, opts.sandboxPolicy)

  try {
    // Guard against the version the model SAW (baseVersion from obsidian_read),
    // falling back to the just-statted version (read-now-write-now race guard).
    // create on an absent file has no version to guard (createIfAbsent is the guard).
    const guardVersion = kind === 'create' ? undefined : (opts.baseVersion ?? statInfo.version)
    const intent = kind === 'create'
      ? { kind: 'createIfAbsent' }
      : { kind: 'replaceIfVersion', version: guardVersion }
    const outcomeWrite = await fs.writeText(loc.target, nextText, intent, undefined, opts.sandboxPolicy)
    entry.status = 'done'
    entry.afterHash = nextHash
    entry.before = outcomeWrite.before ?? entry.before
    entry.after = outcomeWrite.after
    await updateJournalEntry(fs, vault, entry, undefined, opts.sandboxPolicy)
    await pruneJournal(fs, host, vault, opts.journalRetentionDays ?? 30)
    return {
      ok: true,
      action: kind,
      path: relPath,
      opId,
      beforeHash,
      afterHash: nextHash,
      message: kind + ' committed (opId ' + opId + ')',
    }
  } catch (err) {
    if (err?.code === 'FS_STALE_VERSION' || err?.code === 'FS_NOT_OBSERVED') {
      return {
        ok: false,
        action: 'conflict',
        path: relPath,
        opId,
        message: 'file changed since it was read; nothing was written (re-read and retry)',
      }
    }
    throw err
  }
}

/**
 * Delete = move to trash (never unlink). Host-side rename, guarded by the
 * same boundary check; the move stays inside the vault.
 */
export async function deleteNote(fs, host, vault, opts) {
  const { rel: relPath } = opts
  const loc = await resolveNotePath(fs, vault, relPath, opts.excludes)
  const statInfo = await fs.stat(loc.target)
  if (statInfo === undefined) {
    return { ok: false, action: 'error', path: relPath, message: 'note does not exist' }
  }
  const current = await fs.readText(loc.target)
  const beforeHash = sha256(current)
  const plan = {
    tool: 'obsidian_note_delete',
    path: relPath,
    kind: 'delete',
    beforeHash,
    afterHash: null,
    before: current,
    after: null,
    changed: true,
    size: current.length,
  }
  if (opts.dryRun === true) return { ok: true, action: 'dry-run', path: relPath, plan }
  const outcome = await (opts.onApprove ?? (async () => 'unavailable'))(plan)
  if (outcome !== 'allowed-once') {
    return { ok: false, action: 'denied', path: relPath, outcome, message: 'approval outcome: ' + outcome }
  }

  const opId = journalEntryId()
  const trashRel = trashRelPath(relPath, opId)
  const entry = {
    opId,
    ts: monotonicNow(),
    sessionId: opts.sessionId ?? null,
    tool: plan.tool,
    path: relPath,
    kind: 'delete',
    status: 'planned',
    beforeHash,
    before: current,
    afterHash: null,
    trashRel,
    args: { ...(opts.argsSanitized ?? {}) },
  }
  await writeJournalEntry(fs, vault, entry, opts.sandboxPolicy)
  const trashAbs = vault.vaultAbs + '/' + trashRel
  await host.mkdirP(trashAbs.slice(0, trashAbs.lastIndexOf('/')))
  await host.rename(loc.abs, trashAbs)
  entry.status = 'done'
  await updateJournalEntry(fs, vault, entry, undefined, opts.sandboxPolicy)
  await pruneJournal(fs, host, vault, opts.journalRetentionDays ?? 30)
  return { ok: true, action: 'delete', path: relPath, opId, trashRel, beforeHash, afterHash: null, message: 'moved to trash (opId ' + opId + ')' }
}

/**
 * Move / rename a note and rewrite wikilinks that pointed at it.
 * Journaled as kind=move so rollback can restore the path and the rewrites.
 */
export async function moveNote(fs, host, vault, opts) {
  const fromLoc = await resolveNotePath(fs, vault, opts.from, opts.excludes)
  const toLoc = await resolveNotePath(fs, vault, opts.to, opts.excludes)
  if (fromLoc.rel === toLoc.rel) {
    return { ok: true, action: 'skip', path: toLoc.rel, message: 'source and destination are the same' }
  }
  const fromInfo = await fs.stat(fromLoc.target)
  if (fromInfo === undefined) return { ok: false, action: 'error', path: fromLoc.rel, message: 'note does not exist' }
  const toInfo = await fs.stat(toLoc.target)
  if (toInfo !== undefined) return { ok: false, action: 'conflict', path: toLoc.rel, message: 'destination already exists' }
  const current = await fs.readText(fromLoc.target)
  const beforeHash = sha256(current)
  const { notes } = await walkVaultNotes(fs, vault, { excludes: opts.excludes ?? [] })
  const rewrites = []
  for (const note of notes) {
    if (note.rel === fromLoc.rel) continue
    let text
    try { text = await fs.readText(note.target) } catch { continue }
    if (typeof text !== 'string' || text.length > NOTE_READ_CAP) continue
    const next = rewriteWikilinks(text, fromLoc.rel, toLoc.rel)
    if (next === text) continue
    rewrites.push({
      path: note.rel,
      before: text,
      after: next,
      beforeHash: sha256(text),
      afterHash: sha256(next),
    })
  }
  const plan = {
    tool: 'obsidian_move',
    path: toLoc.rel,
    kind: 'move',
    from: fromLoc.rel,
    to: toLoc.rel,
    beforeHash,
    afterHash: beforeHash,
    before: current,
    after: current,
    changed: true,
    size: current.length,
    updatedLinks: rewrites.length,
    rewrites: rewrites.map((r) => ({ path: r.path, beforeHash: r.beforeHash, afterHash: r.afterHash })),
  }
  if (opts.dryRun === true) return { ok: true, action: 'dry-run', path: toLoc.rel, plan }
  const outcome = await (opts.onApprove ?? (async () => 'unavailable'))(plan)
  if (outcome !== 'allowed-once') {
    return { ok: false, action: 'denied', path: toLoc.rel, outcome, message: 'approval outcome: ' + outcome }
  }
  const opId = journalEntryId()
  const entry = {
    opId,
    ts: monotonicNow(),
    sessionId: opts.sessionId ?? null,
    tool: 'obsidian_move',
    path: toLoc.rel,
    kind: 'move',
    status: 'planned',
    from: fromLoc.rel,
    to: toLoc.rel,
    beforeHash,
    before: current,
    afterHash: beforeHash,
    after: current,
    rewrites,
    args: { ...(opts.argsSanitized ?? {}), from: fromLoc.rel, to: toLoc.rel },
  }
  await writeJournalEntry(fs, vault, entry, opts.sandboxPolicy)
  const destParent = toLoc.abs.slice(0, toLoc.abs.lastIndexOf('/'))
  if (destParent !== '' && destParent !== vault.vaultAbs) await host.mkdirP(destParent)
  await host.rename(fromLoc.abs, toLoc.abs)
  for (const rw of rewrites) {
    const loc = await resolveNotePath(fs, vault, rw.path, opts.excludes)
    const info = await fs.stat(loc.target)
    const intent = info === undefined ? { kind: 'createIfAbsent' } : { kind: 'replaceIfVersion', version: info.version }
    await fs.writeText(loc.target, rw.after, intent, undefined, opts.sandboxPolicy)
  }
  entry.status = 'done'
  await updateJournalEntry(fs, vault, entry, undefined, opts.sandboxPolicy)
  await pruneJournal(fs, host, vault, opts.journalRetentionDays ?? 30)
  return {
    ok: true,
    action: 'move',
    path: toLoc.rel,
    from: fromLoc.rel,
    to: toLoc.rel,
    opId,
    updatedLinks: rewrites.length,
    beforeHash,
    afterHash: beforeHash,
    message: 'moved ' + fromLoc.rel + ' -> ' + toLoc.rel + ' (' + rewrites.length + ' links updated, opId ' + opId + ')',
  }
}

// ---------------------------------------------------------------------------
// Rollback (L4)
// ---------------------------------------------------------------------------

/**
 * Roll back one journal entry (by opId) or the latest done entry for a path
 * (undo). Inverse ops are themselves journaled (kind undo/rollback) so every
 * rollback is re-doable.
 */
export async function rollbackEntry(fs, host, vault, { relPath, opId, journalRetentionDays = 30, sessionId, sandboxPolicy }) {
  const entry = opId !== undefined
    ? await journalEntry(fs, vault, opId)
    : await latestDoneEntry(fs, vault, relPath)
  if (entry === null || entry === undefined) {
    return { ok: true, action: 'noop', message: 'no journal entry to roll back' }
  }
  const undoKind = opId !== undefined ? 'rollback' : 'undo'
  const targetRel = entry.path
  const loc = await resolveNotePath(fs, vault, targetRel, DEFAULT_EXCLUDES)
  const statInfo = await fs.stat(loc.target)
  const current = statInfo === undefined ? null : await fs.readText(loc.target)
  const currentHash = current === null ? null : sha256(current)

  // Never clobber concurrent changes: the file must still be exactly what the
  // entry produced (update/append) or absent (create/delete).
  if (entry.kind === 'move') {
    const destCurrent = current
    const destHash = currentHash
    if (destCurrent === null || destHash !== entry.afterHash) {
      return { ok: false, action: 'conflict', path: targetRel, message: 'moved note changed after the recorded operation; refusing to roll back' }
    }
    const fromLoc = await resolveNotePath(fs, vault, entry.from, DEFAULT_EXCLUDES)
    const fromStat = await fs.stat(fromLoc.target)
    if (fromStat !== undefined) {
      return { ok: false, action: 'conflict', path: entry.from, message: 'source path is occupied again; refusing to roll back the move' }
    }
    for (const rw of entry.rewrites ?? []) {
      const rloc = await resolveNotePath(fs, vault, rw.path, DEFAULT_EXCLUDES)
      let now
      try { now = await fs.readText(rloc.target) } catch {
        return { ok: false, action: 'conflict', path: rw.path, message: 'a rewritten note is missing; refusing to roll back the move' }
      }
      if (sha256(now) !== rw.afterHash) {
        return { ok: false, action: 'conflict', path: rw.path, message: 'a rewritten note changed after the move; refusing to roll back' }
      }
    }
  } else if (entry.kind === 'delete') {
    if (current !== null) {
      return { ok: false, action: 'conflict', path: targetRel, message: 'file exists at the deleted path (someone recreated it); manual review required' }
    }
  } else if (currentHash !== entry.afterHash) {
    return {
      ok: false,
      action: 'conflict',
      path: targetRel,
      message: 'file changed after the recorded operation; refusing to roll back (compare manually or undo a newer entry first)',
    }
  }

  const rollbackOpId = journalEntryId()
  const rollbackEntryBase = {
    opId: rollbackOpId,
    ts: monotonicNow(),
    sessionId: sessionId ?? null,
    tool: undoKind === 'undo' ? 'obsidian_undo' : 'obsidian_rollback',
    path: targetRel,
    kind: undoKind,
    status: 'planned',
    beforeHash: currentHash,
    before: current,
    afterHash: null,
    targetOpId: entry.opId,
    args: { opId: entry.opId },
  }
  await writeJournalEntry(fs, vault, rollbackEntryBase, sandboxPolicy)

  let message
  if (entry.kind === 'create') {
    const trashAbs = vault.vaultAbs + '/' + trashRelPath(targetRel, rollbackOpId)
    await host.mkdirP(trashAbs.slice(0, trashAbs.lastIndexOf('/')))
    await host.rename(loc.abs, trashAbs)
    rollbackEntryBase.afterHash = null
    rollbackEntryBase.after = null
    message = 'create undone (note moved to trash)'
  } else if (entry.kind === 'delete') {
    const trashAbs = vault.vaultAbs + '/' + entry.trashRel
    await host.rename(trashAbs, loc.abs)
    rollbackEntryBase.afterHash = entry.beforeHash
    rollbackEntryBase.after = entry.before
    message = 'delete undone (note restored from trash)'
  } else if (entry.kind === 'move') {
    const fromLoc = await resolveNotePath(fs, vault, entry.from, DEFAULT_EXCLUDES)
    const fromParent = fromLoc.abs.slice(0, fromLoc.abs.lastIndexOf('/'))
    if (fromParent !== '' && fromParent !== vault.vaultAbs) await host.mkdirP(fromParent)
    await host.rename(loc.abs, fromLoc.abs)
    for (const rw of entry.rewrites ?? []) {
      const rloc = await resolveNotePath(fs, vault, rw.path, DEFAULT_EXCLUDES)
      const info = await fs.stat(rloc.target)
      const intent = info === undefined ? { kind: 'createIfAbsent' } : { kind: 'replaceIfVersion', version: info.version }
      await fs.writeText(rloc.target, rw.before, intent, undefined, sandboxPolicy)
    }
    rollbackEntryBase.path = entry.from
    rollbackEntryBase.afterHash = entry.beforeHash
    rollbackEntryBase.after = entry.before
    message = 'move undone (' + entry.to + ' -> ' + entry.from + ')'
  } else {
    const beforeText = entry.before ?? ''
    const intent = statInfo === undefined
      ? { kind: 'createIfAbsent' }
      : { kind: 'replaceIfVersion', version: statInfo.version }
    const outcomeWrite = await fs.writeText(loc.target, beforeText, intent, undefined, sandboxPolicy)
    rollbackEntryBase.afterHash = sha256(beforeText)
    rollbackEntryBase.after = outcomeWrite.after
    message = 'content restored to the pre-operation image'
  }
  rollbackEntryBase.status = 'done'
  await updateJournalEntry(fs, vault, rollbackEntryBase, undefined, sandboxPolicy)
  await pruneJournal(fs, host, vault, journalRetentionDays)
  return { ok: true, action: undoKind, path: targetRel, opId: rollbackOpId, message }
}

/**
 * Restore a previously deleted note from trash (explicit restore tool).
 */
export async function restoreFromTrash(fs, host, vault, { relPath, sessionId, sandboxPolicy }) {
  const rel = sanitizeRelPath(relPath)
  const entries = await listJournal(fs, vault, { relPath: rel, limit: 200 })
  const deleted = entries.find((e) => e.kind === 'delete' && e.status === 'done' && e.trashRel !== undefined)
  if (deleted === undefined) return { ok: false, action: 'error', path: rel, message: 'no deletion record for this path' }
  const loc = await resolveNotePath(fs, vault, rel, DEFAULT_EXCLUDES)
  const statInfo = await fs.stat(loc.target)
  if (statInfo !== undefined) {
    return { ok: false, action: 'conflict', path: rel, message: 'a file already exists at this path; restore would clobber it' }
  }
  const trashAbs = vault.vaultAbs + '/' + deleted.trashRel
  const trashInfo = await fs.lstat(trashAbs)
  if (trashInfo === undefined) {
    return { ok: false, action: 'error', path: rel, message: 'trash copy is gone (already restored or pruned)' }
  }
  await host.rename(trashAbs, loc.abs)
  const opId = journalEntryId()
  const entry = {
    opId,
    ts: monotonicNow(),
    sessionId: sessionId ?? null,
    tool: 'obsidian_restore',
    path: rel,
    kind: 'restore',
    status: 'done',
    beforeHash: null,
    before: null,
    afterHash: deleted.beforeHash,
    after: deleted.before,
    targetOpId: deleted.opId,
    args: { path: rel },
  }
  await writeJournalEntry(fs, vault, entry, sandboxPolicy)
  return { ok: true, action: 'restore', path: rel, opId, message: 'note restored from trash' }
}

// ---------------------------------------------------------------------------
// Journal retention
// ---------------------------------------------------------------------------

/** Prune journal day-directories older than retentionDays. */
export async function pruneJournal(fs, host, vault, retentionDays) {
  if (retentionDays === undefined || retentionDays === null) return
  const root = await fs.resolve(vault.vaultAbs + '/' + JOURNAL_DIR)
  const days = await safeListDir(fs, root)
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  for (const day of days ?? []) {
    if (day.type !== 'directory') continue
    const ts = new Date(day.name + 'T00:00:00').getTime()
    if (Number.isFinite(ts) && ts < cutoff && typeof host.rmrf === 'function') {
      await host.rmrf(fs.processPath(day.target))
    }
  }
}

// ---------------------------------------------------------------------------
// Batch (M1: sequential, per-op journal & approval)
// ---------------------------------------------------------------------------

/**
 * Overlay fs for batch dry-run: projects earlier ops onto reads/stat/write so
 * a create + append sequence previews against the would-be state. Writes land
 * in the overlay instead of disk; deletes are recorded by the caller.
 */
function overlayFs(fs, overlay) {
  return {
    resolve: (p, o) => fs.resolve(p, o),
    processPath: (t) => fs.processPath(t),
    lstat: async (p, ...rest) => {
      if (overlay.has(p)) {
        const v = overlay.get(p)
        return v === null ? undefined : { type: 'file', size: v.length }
      }
      return fs.lstat(p, ...rest)
    },
    stat: async (t) => {
      const p = t.targetKey
      if (overlay.has(p)) {
        const v = overlay.get(p)
        return v === null ? undefined : { version: 'overlay', type: 'file', size: v.length }
      }
      return fs.stat(t)
    },
    contains: (a, b) => fs.contains(a, b),
    readText: async (t) => {
      const p = t.targetKey
      if (overlay.has(p)) {
        const v = overlay.get(p)
        if (v === null) throw new Error('ENOENT: ' + p)
        return v
      }
      return fs.readText(t)
    },
    listDir: (t, s) => fs.listDir(t, s),
    writeText: async (t, content, expected) => {
      const p = t.targetKey
      let cur = null
      if (overlay.has(p)) cur = overlay.get(p)
      else {
        const info = await fs.stat(t)
        if (info !== undefined) cur = await fs.readText(t)
      }
      if (expected !== undefined && expected.kind === 'createIfAbsent' && cur !== null) {
        const err = new Error('FS_NOT_OBSERVED: target exists')
        err.code = 'FS_NOT_OBSERVED'
        throw err
      }
      overlay.set(p, content)
      return { operation: cur === null ? 'create' : 'update', version: 'overlay', before: cur, after: content }
    },
  }
}

/**
 * Run a batch: each op goes through the normal pipeline with its own journal
 * entry. A failed op aborts the batch and reports what ran. dryRun projects
 * earlier ops through an overlay so dependent sequences preview correctly.
 */
export async function batchMutate(fs, host, vault, { ops = [], dryRun = false, sessionId, onApprove, excludes, journalRetentionDays, sandboxPolicy }) {
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new SafeError('batch requires at least one operation', 'INVALID_ARGS')
  }
  const overlay = new Map()
  const effectiveFs = dryRun ? overlayFs(fs, overlay) : fs
  const results = []
  for (const op of ops) {
    const { action, path, ...rest } = op
    let res
    if (action === 'delete') {
      res = await deleteNote(effectiveFs, host, vault, { ...rest, rel: path, sessionId, onApprove, excludes, journalRetentionDays, dryRun, sandboxPolicy })
      if (dryRun && res.ok) overlay.set(vault.vaultAbs + '/' + path, null)
    } else if (action === 'move') {
      res = await moveNote(effectiveFs, host, vault, {
        ...rest, from: rest.from ?? path, to: rest.to, sessionId, onApprove, excludes, journalRetentionDays, dryRun, sandboxPolicy,
      })
    } else if (action === 'create' || action === 'update' || action === 'append') {
      res = await mutateNote(effectiveFs, host, vault, { ...rest, rel: path, kind: action, tool: 'obsidian_batch:' + action, sessionId, onApprove, excludes, journalRetentionDays, dryRun, sandboxPolicy })
      if (dryRun && res.ok && res.action === 'dry-run' && res.plan !== undefined) {
        overlay.set(vault.vaultAbs + '/' + path, res.plan.after ?? '')
      }
    } else {
      res = { ok: false, action: 'error', message: 'unknown batch op: ' + action }
    }
    results.push(res)
    if (!res.ok && !dryRun) {
      return { ok: false, action: 'batch', results, message: 'batch aborted at op ' + (results.length - 1) + ': ' + res.message }
    }
  }
  return { ok: true, action: 'batch', results }
}

// ---------------------------------------------------------------------------
// Homepage surface — widget-scoped panel data, not a tool
// ---------------------------------------------------------------------------

const WALK_FILE_LIMIT = 4000
const NOTE_READ_CAP = 512 * 1024

const DEFAULT_DAILY_FORMAT = 'MM-DD-YYYY'
const DEFAULT_DAILY_FOLDER = 'Daily'

/** MM-DD-YYYY in local time (fallback when no format is configured). */
export function todayStamp(now = Date.now()) {
  return formatDailyName(now, DEFAULT_DAILY_FORMAT)
}

/**
 * Format a local date with Obsidian/Moment tokens used by daily-notes.json:
 * YYYY YY MM M DD D. Longer tokens win.
 */
export function formatDailyName(now, format) {
  const d = new Date(now)
  const YYYY = String(d.getFullYear())
  const YY = YYYY.slice(-2)
  const M = String(d.getMonth() + 1)
  const MM = pad(d.getMonth() + 1)
  const D = String(d.getDate())
  const DD = pad(d.getDate())
  const spec = (typeof format === 'string' && format.trim() !== '') ? format.trim() : DEFAULT_DAILY_FORMAT
  return spec
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/M/g, M)
    .replace(/D/g, D)
}

export function dailyRelPath(folder, stamp) {
  const name = stamp + '.md'
  const dir = typeof folder === 'string' ? folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : ''
  return dir === '' ? name : dir + '/' + name
}

/**
 * Privileged read of .obsidian/daily-notes.json (not available to model tools).
 * Returns null when the file is missing or invalid.
 */
export async function readDailyNotesSetting(fs, vault) {
  try {
    const target = await fs.resolve(vault.vaultAbs + '/.obsidian/daily-notes.json')
    const info = await fs.stat(target)
    if (info === undefined || info.type !== 'file') return null
    const json = JSON.parse(await fs.readText(target))
    if (json === null || typeof json !== 'object' || Array.isArray(json)) return null
    return {
      folder: typeof json.folder === 'string' ? json.folder : '',
      format: typeof json.format === 'string' && json.format.trim() !== '' ? json.format.trim() : DEFAULT_DAILY_FORMAT,
      template: typeof json.template === 'string' ? json.template : '',
    }
  } catch {
    return null
  }
}

/** True when a real daily habit exists (Obsidian setting or plugin override). */
export function hasDailyHabit(daily) {
  return daily != null
    && daily.source !== 'none'
    && typeof daily.todayRel === 'string'
    && daily.todayRel !== ''
}

/**
 * Resolve daily folder/format: plugin override if set, else Obsidian's file.
 * Does not invent Daily/MM-DD-YYYY when neither source exists.
 */
export async function loadDailyHabit(fs, vault, cfg = {}, now = Date.now()) {
  const overrideFolder = typeof cfg.dailyFolder === 'string' ? cfg.dailyFolder.trim() : ''
  const overrideFormat = typeof cfg.dailyFormat === 'string' ? cfg.dailyFormat.trim() : ''
  const fromOb = await readDailyNotesSetting(fs, vault)
  const hasOverride = overrideFolder !== '' || overrideFormat !== ''
  if (fromOb === null && !hasOverride) {
    return {
      folder: '',
      format: '',
      template: '',
      source: 'none',
      stamp: formatDailyName(now, DEFAULT_DAILY_FORMAT),
      todayRel: null,
    }
  }
  let folder = DEFAULT_DAILY_FOLDER
  let format = DEFAULT_DAILY_FORMAT
  let source = 'none'
  let template = ''
  if (fromOb !== null) {
    folder = fromOb.folder
    format = fromOb.format
    template = fromOb.template
    source = 'obsidian'
  }
  if (overrideFolder !== '') {
    folder = overrideFolder
    source = 'override'
  }
  if (overrideFormat !== '') {
    format = overrideFormat
    source = 'override'
  }
  const stamp = formatDailyName(now, format)
  return {
    folder,
    format,
    template,
    source,
    stamp,
    todayRel: dailyRelPath(folder, stamp),
  }
}

/** Exact expected daily path, or null. */
export function pickDailyPath(rels, expectedRel) {
  if (typeof expectedRel !== 'string' || expectedRel === '') return null
  return rels.includes(expectedRel) ? expectedRel : null
}

/** Walk vault markdown notes, skipping hidden / excluded directories. */
export async function walkVaultNotes(fs, vault, { excludes = [], fileLimit = WALK_FILE_LIMIT } = {}) {
  const notes = []
  let truncated = false
  const queue = ['']
  while (queue.length > 0) {
    if (notes.length >= fileLimit) { truncated = true; break }
    const relDir = queue.shift()
    const abs = relDir === '' ? vault.vaultAbs : vault.vaultAbs + '/' + relDir
    const target = await fs.resolve(abs)
    const children = await safeListDir(fs, target)
    for (const child of children) {
      if (typeof child.name !== 'string' || child.name.startsWith('.')) continue
      const rel = relDir === '' ? child.name : relDir + '/' + child.name
      if (child.type === 'directory') {
        if (relExcluded(rel, excludes)) continue
        queue.push(rel)
      } else if (child.type === 'file' && child.name.endsWith('.md')) {
        if (notes.length >= fileLimit) { truncated = true; break }
        notes.push({ rel, target: child.target })
      }
    }
  }
  return { notes, truncated }
}

function stemOf(rel) {
  return rel.replace(/\.md$/i, '')
}

function baseOf(rel) {
  const segs = rel.split('/')
  return stemOf(segs[segs.length - 1] ?? rel)
}

/** List/preview name: first H1, else YAML title, else the filename. */
export function displayTitle(parsed, rel) {
  const heading = typeof parsed?.title === 'string' ? parsed.title.trim() : ''
  if (heading !== '') return heading
  const fm = parsed?.frontmatter?.title
  if (typeof fm === 'string' && fm.trim() !== '') return fm.trim()
  return baseOf(rel)
}

function linkHits(target, stems, bases) {
  const raw = String(target ?? '').replace(/\\/g, '/').replace(/\.md$/i, '').trim()
  if (raw === '') return true
  const lower = raw.toLowerCase()
  if (stems.has(lower)) return true
  const base = (lower.split('/').pop() ?? lower)
  return bases.has(base)
}

export function linkTargetMatchesNote(target, noteRel) {
  const t = String(target ?? '').replace(/\\/g, '/').replace(/\.md$/i, '').trim().toLowerCase()
  const stem = stemOf(noteRel).toLowerCase()
  const base = baseOf(noteRel).toLowerCase()
  return t === stem || t === base || t.endsWith('/' + base)
}

function snippetAround(text, needle, radius = 80) {
  const hay = text.toLowerCase()
  const q = needle.toLowerCase()
  const idx = q === '' ? 0 : hay.indexOf(q)
  if (idx < 0) return text.slice(0, radius * 2)
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + q.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ') + (end < text.length ? '…' : '')
}

/**
 * Full-text / title / tag search. JS scan (no rg dependency).
 */
export async function searchNotes(fs, vault, {
  query = '',
  tag,
  dir,
  limit = 50,
  excludes = [],
  fileLimit = WALK_FILE_LIMIT,
} = {}) {
  const q = String(query ?? '').trim().toLowerCase()
  const tagNeedle = typeof tag === 'string' ? tag.replace(/^#/, '').trim().toLowerCase() : ''
  if (q === '' && tagNeedle === '') return []
  const prefix = typeof dir === 'string' ? dir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : ''
  const { notes } = await walkVaultNotes(fs, vault, { excludes, fileLimit })
  const hits = []
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200)
  for (const note of notes) {
    if (hits.length >= cap) break
    if (prefix !== '' && note.rel !== prefix && !note.rel.startsWith(prefix + '/')) continue
    let text
    try { text = await fs.readText(note.target) } catch { continue }
    if (typeof text !== 'string' || text.length > NOTE_READ_CAP) continue
    const parsed = parseNote(text)
    const tags = (parsed.tags ?? []).map((t) => String(t).toLowerCase())
    if (tagNeedle !== '' && !tags.some((t) => t === tagNeedle || t.endsWith('/' + tagNeedle))) continue
    if (q !== '') {
      const title = displayTitle(parsed, note.rel).toLowerCase()
      const hay = title + '\n' + parsed.body.toLowerCase()
      if (!hay.includes(q) && !note.rel.toLowerCase().includes(q)) continue
    }
    hits.push({
      path: note.rel,
      title: displayTitle(parsed, note.rel),
      snippet: q === '' ? (parsed.body ?? '').slice(0, 160).replace(/\s+/g, ' ') : snippetAround(parsed.body ?? '', q),
      tags: parsed.tags ?? [],
    })
  }
  return hits
}

export async function listNotes(fs, vault, { dir, limit = 200, excludes = [], fileLimit = WALK_FILE_LIMIT } = {}) {
  const prefix = typeof dir === 'string' ? dir.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : ''
  const { notes } = await walkVaultNotes(fs, vault, { excludes, fileLimit })
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const out = []
  for (const note of notes) {
    if (prefix !== '' && note.rel !== prefix && !note.rel.startsWith(prefix + '/')) continue
    out.push({ path: note.rel, title: baseOf(note.rel) })
    if (out.length >= cap) break
  }
  return out
}

export async function collectGraph(fs, vault, { excludes = [], fileLimit = WALK_FILE_LIMIT, notes: given } = {}) {
  const { notes, truncated } = given !== undefined
    ? { notes: given, truncated: false }
    : await walkVaultNotes(fs, vault, { excludes, fileLimit })
  const outgoing = new Map()
  const backlinks = new Map()
  const tagCounts = new Map()
  const tagToNotes = new Map()
  for (const note of notes) {
    let text
    try { text = await fs.readText(note.target) } catch { continue }
    if (typeof text !== 'string' || text.length > NOTE_READ_CAP) continue
    const parsed = parseNote(text)
    const out = []
    for (const target of parsed.wikilinks ?? []) {
      out.push(target)
      const list = backlinks.get(target) ?? []
      list.push({ path: note.rel, title: parsed.title ?? baseOf(note.rel), snippet: snippetAround(parsed.body ?? '', target, 40) })
      backlinks.set(target, list)
    }
    outgoing.set(note.rel, out)
    for (const tag of parsed.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      const list = tagToNotes.get(tag) ?? []
      list.push(note.rel)
      tagToNotes.set(tag, list)
    }
  }
  const orphans = []
  for (const note of notes) {
    const hasOut = (outgoing.get(note.rel) ?? []).length > 0
    const hasIn = [...backlinks.entries()].some(([target, from]) => from.length > 0 && linkTargetMatchesNote(target, note.rel))
    if (!hasOut && !hasIn) orphans.push(note.rel)
  }
  const folders = new Map()
  for (const note of notes) {
    const top = note.rel.includes('/') ? note.rel.split('/')[0] : '(root)'
    folders.set(top, (folders.get(top) ?? 0) + 1)
  }
  return {
    notes,
    truncated,
    outgoing,
    backlinks,
    tagCounts,
    tagToNotes,
    orphans,
    folders,
  }
}

export async function backlinksFor(fs, vault, noteRel, { excludes = [] } = {}) {
  const graph = await collectGraph(fs, vault, { excludes })
  const hits = []
  const seen = new Set()
  for (const [target, from] of graph.backlinks) {
    if (!linkTargetMatchesNote(target, noteRel)) continue
    for (const row of from) {
      if (seen.has(row.path)) continue
      seen.add(row.path)
      hits.push(row)
    }
  }
  return hits
}

export function structureFromGraph(graph, { tagLimit = 20, orphanLimit = 20, folderLimit = 24 } = {}) {
  const folders = [...graph.folders.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, folderLimit)
    .map(([name, count]) => ({ name, count }))
  const tags = [...graph.tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, tagLimit)
    .map(([name, count]) => ({ name, count }))
  return {
    folders,
    tags,
    orphans: graph.orphans.slice(0, orphanLimit),
    orphanCount: graph.orphans.length,
    noteCount: graph.notes.length,
    truncated: graph.truncated,
  }
}

async function readTitle(fs, target, rel) {
  if (target === undefined || target === null) return baseOf(rel ?? '')
  try {
    const text = await fs.readText(target)
    if (typeof text !== 'string' || text.length > NOTE_READ_CAP) return baseOf(rel ?? '')
    return displayTitle(parseNote(text), rel ?? '')
  } catch {
    return baseOf(rel ?? '')
  }
}

const CARD_EXCERPT_CAP = 180

async function readExcerpt(fs, target) {
  if (target === undefined || target === null) return ''
  try {
    const text = await fs.readText(target)
    if (typeof text !== 'string' || text.length > NOTE_READ_CAP) return ''
    const body = String(parseNote(text).body ?? '').replace(/\s+/g, ' ').trim()
    return body.length > CARD_EXCERPT_CAP ? body.slice(0, CARD_EXCERPT_CAP) : body
  } catch {
    return ''
  }
}

function coerceMtime(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (raw instanceof Date) return raw.getTime()
  if (typeof raw === 'string' && raw !== '') {
    const asNum = Number(raw)
    if (Number.isFinite(asNum) && asNum > 1e11) return asNum
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/** Best-effort file mtime: fs.stat extras, then host.mtimeMs(abs). */
export async function readMtimeMs(fs, host, note) {
  try {
    const info = await fs.stat(note.target)
    const fromStat = coerceMtime(info?.mtimeMs ?? info?.mtime)
    if (fromStat !== null) return fromStat
  } catch { /* fall through */ }
  if (typeof host?.mtimeMs === 'function') {
    try {
      const abs = typeof fs.processPath === 'function' ? fs.processPath(note.target) : note.target?.targetKey
      const fromHost = coerceMtime(await host.mtimeMs(abs))
      if (fromHost !== null) return fromHost
    } catch { /* ignore */ }
  }
  return 0
}

const PREVIEW_CHAR_CAP = 4000

/**
 * In-page note preview / editor payload. `source` is the full file;
 * `body` stays a capped excerpt for list cards.
 */
export async function previewNote(fs, vault, relPath, excludes = [], opts = {}) {
  const loc = await resolveNotePath(fs, vault, relPath, excludes)
  const info = await fs.stat(loc.target)
  if (info === undefined) {
    if (opts.allowMissing !== true) throw new SafeError('note does not exist: ' + loc.rel, 'NOT_FOUND')
    return {
      path: loc.rel,
      title: displayTitle({ title: null, frontmatter: null }, loc.rel),
      source: '',
      version: null,
      body: '',
      truncated: false,
      missing: true,
      tags: [],
      wikilinks: [],
    }
  }
  const text = await fs.readText(loc.target)
  if (typeof text !== 'string') throw new SafeError('note is not readable: ' + loc.rel, 'NOT_FOUND')
  const parsed = parseNote(text)
  const body = typeof parsed.body === 'string' ? parsed.body : ''
  return {
    path: loc.rel,
    title: displayTitle(parsed, loc.rel),
    source: text,
    version: info.version ?? null,
    body: body.length > PREVIEW_CHAR_CAP ? body.slice(0, PREVIEW_CHAR_CAP) : body,
    truncated: body.length > PREVIEW_CHAR_CAP,
    missing: false,
    tags: parsed.tags ?? [],
    wikilinks: (parsed.wikilinks ?? []).slice(0, 24),
  }
}

const STAT_CONCURRENCY = 16

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next
      next += 1
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

async function collectRecent(fs, host, notes, done, recentLimit) {
  const lastJournal = new Map()
  for (const e of done) {
    if (!lastJournal.has(e.path)) lastJournal.set(e.path, e.ts)
  }
  const mtimes = notes.length === 0 ? [] : await mapPool(notes, STAT_CONCURRENCY, (note) => readMtimeMs(fs, host, note))
  const ranked = []
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    let mtime = mtimes[i] ?? 0
    const journalTs = lastJournal.get(note.rel)
    if (typeof journalTs === 'number' && journalTs > mtime) mtime = journalTs
    ranked.push({ note, mtime })
  }
  ranked.sort((a, b) => b.mtime - a.mtime || a.note.rel.localeCompare(b.note.rel))
  const recent = []
  for (const row of ranked.slice(0, recentLimit)) {
    recent.push({
      path: row.note.rel,
      title: await readTitle(fs, row.note.target, row.note.rel),
    })
  }
  return recent
}

function collectBroken(notes, texts, brokenLimit) {
  const stems = new Set()
  const bases = new Set()
  for (const note of notes) {
    stems.add(stemOf(note.rel).toLowerCase())
    bases.add(baseOf(note.rel).toLowerCase())
  }
  const broken = []
  let brokenCount = 0
  for (const note of notes) {
    const text = texts.get(note.rel)
    if (typeof text !== 'string') continue
    for (const target of parseNote(text).wikilinks) {
      if (linkHits(target, stems, bases)) continue
      brokenCount += 1
      if (broken.length < brokenLimit) broken.push({ from: note.rel, target })
    }
  }
  return { broken, brokenCount }
}

/**
 * Homepage payload. Only computes data for the requested widgets so a closed
 * links/daily module never walks note bodies.
 */
export async function surfaceOverview(fs, vault, {
  excludes = [],
  recentLimit = 8,
  changeLimit = 8,
  brokenLimit = 8,
  fileLimit = WALK_FILE_LIMIT,
  host,
  dailyFolder,
  dailyFormat,
  widgets,
} = {}) {
  const wanted = new Set(resolveWidgetIds(widgets))
  const out = {
    vault: vault.vaultAbs,
    widgets: [...wanted],
  }

  let notes = []
  if ([...wanted].some((id) => HOME_WIDGETS_NEED_WALK.has(id))) {
    const walked = await walkVaultNotes(fs, vault, { excludes, fileLimit })
    notes = walked.notes
    out.noteCount = notes.length
    out.truncated = walked.truncated
  }

  let done = []
  if (wanted.has('continue') || wanted.has('changes')) {
    const journal = await listJournal(fs, vault, { limit: 80 })
    done = journal.filter((e) => e.status === 'done' && typeof e.path === 'string' && e.path !== '')
  }

  if (wanted.has('continue')) {
    out.recent = await collectRecent(fs, host, notes, done, recentLimit)
  }

  if (wanted.has('changes')) {
    out.changes = done.slice(0, changeLimit).map((e) => ({
      opId: e.opId,
      ts: e.ts,
      path: e.path,
      kind: e.kind,
      status: e.status,
    }))
  }

  if (wanted.has('daily')) {
    const daily = await loadDailyHabit(fs, vault, { dailyFolder, dailyFormat })
    out.daily = daily
    out.todayDate = daily.stamp
    if (hasDailyHabit(daily)) {
      out.todayRel = daily.todayRel
      const todayPath = pickDailyPath(notes.map((n) => n.rel), daily.todayRel)
      const byRel = new Map(notes.map((n) => [n.rel, n]))
      out.today = todayPath === null ? null : {
        path: todayPath,
        title: await readTitle(fs, byRel.get(todayPath)?.target, todayPath),
        excerpt: await readExcerpt(fs, byRel.get(todayPath)?.target),
      }
    } else {
      out.todayRel = null
      out.today = null
    }
  }

  const needGraph = wanted.has('links') || wanted.has('structure')
  let graph = null
  if (needGraph) {
    graph = await collectGraph(fs, vault, { excludes, fileLimit, notes })
  }

  if (wanted.has('links') && graph !== null) {
    const stems = new Set()
    const bases = new Set()
    for (const note of graph.notes) {
      stems.add(stemOf(note.rel).toLowerCase())
      bases.add(baseOf(note.rel).toLowerCase())
    }
    const broken = []
    let brokenCount = 0
    for (const [fromRel, targets] of graph.outgoing) {
      for (const target of targets) {
        if (linkHits(target, stems, bases)) continue
        brokenCount += 1
        if (broken.length < brokenLimit) broken.push({ from: fromRel, target })
      }
    }
    out.broken = broken
    out.brokenCount = brokenCount
    out.orphans = graph.orphans.slice(0, brokenLimit)
    out.orphanCount = graph.orphans.length
  }

  if (wanted.has('structure') && graph !== null) {
    const snap = structureFromGraph(graph)
    out.folders = snap.folders
    out.tags = snap.tags
    if (out.orphans === undefined) {
      out.orphans = snap.orphans
      out.orphanCount = snap.orphanCount
    }
  }

  if (wanted.has('inbox')) {
    out.inbox = []
    for (const note of notes) {
      if (note.rel.includes('/')) continue
      out.inbox.push({
        path: note.rel,
        title: await readTitle(fs, note.target, note.rel),
      })
      if (out.inbox.length >= recentLimit) break
    }
  }

  return out
}
