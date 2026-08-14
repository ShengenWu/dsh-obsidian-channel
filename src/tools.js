/**
 * dsh-obsidian-channel — tool definitions (M1, thin wiring).
 *
 * Every tool funnels into the pure engine (src/engine.js). This file only
 * owns schema validation, presentation, and the approval adapter.
 *
 * @module dsh-obsidian-channel/tools
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  openVault, resolveNotePath, parseNote, sha256, SafeError,
  mutateNote, deleteNote, batchMutate, listJournal, rollbackEntry, restoreFromTrash,
} from './engine.js'

const READ_SIZE_LIMIT = 5 * 1024 * 1024

/** Standard failure shape shared by every tool result. */
function errTurn(message, code = 'error') {
  return { ok: false, action: 'error', code, message }
}

/** A single text-block renderer for tool cards. */
function textBlock(text) {
  return [{ type: 'text', text }]
}

/** Resolve vaultDir argument or throw a SafeError. */
async function vaultOf(ctx, args) {
  const dir = args.vaultDir ?? ctx.config?.vaultDir ?? ''
  return openVault(ctx.fs, dir)
}

/** Sanitize a value that must serialize to JSON for journal args. */
function jsonSafe(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null))
  } catch {
    return null
  }
}

/** Host-side adapter for trash moves (fs seam has no remove/move). */
function hostOf() {
  return {
    rename: async (from, to) => {
      const { rename } = await import('node:fs/promises')
      await rename(from, to)
    },
    mkdirP: async (dir) => {
      const { mkdir } = await import('node:fs/promises')
      await mkdir(dir, { recursive: true })
    },
    rmrf: async (dir) => {
      const { rm } = await import('node:fs/promises')
      await rm(dir, { recursive: true, force: true })
    },
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export function registerObsidianChannelTools(ctx, config, makeApprover) {
  const host = hostOf()
  const sessionIdOf = (exec) => (typeof exec.agent?.session?.id === 'string' ? exec.agent.session.id : null)

  const common = (toolName, describe) => ({
    vaultDir: {
      type: 'string',
      description: 'Obsidian vault root directory. Omit to use the plugin-configured default.',
    },
    path: {
      type: 'string',
      description: describe,
    },
    dryRun: {
      type: 'boolean',
      description: 'When true, compute the full plan (including before/after) without writing anything and without asking for approval.',
    },
  })

  const sizeOutcome = (res) => {
    // Drop bulky before/after images from model-facing results (journal keeps them).
    if (res.plan !== undefined) {
      const { before, after, ...rest } = res.plan
      return { ...res, plan: rest }
    }
    return res
  }

  // ---- obsidian_read (returns the fs version token for guarded updates) ----
  ctx.tools.register(defineTool({
    name: 'obsidian_read',
    description: [
      'Read one note from the Obsidian vault. Returns the parsed frontmatter,',
      'first H1 title, inline tags, and wikilink targets, plus the full body.',
      'IMPORTANT: the returned version token must be passed as baseVersion',
      'to obsidian_note_update so a write is rejected if the file changed',
      'since you read it (no silent overwrites).',
    ].join(' '),
    parameters: {
      vaultDir: { type: 'string', description: 'Obsidian vault root directory. Omit to use the plugin-configured default.' },
      path: { type: 'string', description: 'Note path relative to the vault root, e.g. "Projects/demo.md".' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          action: { type: 'string', required: true },
          path: { type: 'string' },
          version: { type: 'string' },
          hash: { type: 'string' },
          title: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          wikilinks: { type: 'array', items: { type: 'string' } },
          frontmatter: { type: 'object', additionalProperties: true },
          body: { type: 'string' },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => textBlock('obsidian_read -> ' + value.path + (value.title ? ' / ' + value.title : '')),
    },
    async execute(args, exec) {
      try {
        const vault = await vaultOf(ctx, args)
        const loc = await resolveNotePath(ctx.fs, vault, args.path, config.excludes)
        const statInfo = await ctx.fs.stat(loc.target)
        if (statInfo === undefined) return errTurn('note does not exist: ' + loc.rel, 'NOT_FOUND')
        if ((statInfo.size ?? 0) > READ_SIZE_LIMIT) return errTurn('note exceeds the read size limit', 'SIZE_LIMIT')
        const text = await ctx.fs.readText(loc.target, exec.signal)
        const parsed = parseNote(text)
        return {
          ok: true,
          action: 'read',
          path: loc.rel,
          version: String(statInfo.version),
          hash: sha256(text),
          title: parsed.title ?? null,
          tags: parsed.tags,
          wikilinks: parsed.wikilinks,
          frontmatter: parsed.frontmatter ?? null,
          body: parsed.body,
        }
      } catch (err) {
        return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Read note', kind: 'other', rawInput: { path: args.path } }),
  }))

  // ---- write tools ----
  const registerWrite = (toolName, kind, description, extraParams = {}) => {
    ctx.tools.register(defineTool({
      name: toolName,
      description,
      parameters: {
        ...common(toolName, 'Note path relative to the vault root, e.g. "Projects/demo.md".'),
        ...extraParams,
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ok: { type: 'boolean', required: true },
            action: { type: 'string', required: true },
            path: { type: 'string' },
            opId: { type: 'string' },
            beforeHash: { type: 'string' },
            afterHash: { type: 'string' },
            trashRel: { type: 'string' },
            plan: { type: 'object', additionalProperties: true },
            outcome: { type: 'string' },
            message: { type: 'string' },
          },
        },
        render: (_args, value) => textBlock(
          toolName + ' -> ' + (value.action ?? '?') + (value.path ? ' / ' + value.path : '')
            + (value.message ? '\n' + value.message : ''),
        ),
      },
      async execute(args, exec) {
        try {
          const vault = await vaultOf(ctx, args)
          const res = await mutateNote(ctx.fs, host, vault, {
            rel: args.path,
            kind,
            tool: toolName,
            content: args.content,
            frontmatter: args.frontmatter,
            frontmatterUpdates: args.frontmatterUpdates,
            frontmatterDeletes: args.frontmatterDeletes,
            section: args.section,
            baseVersion: args.baseVersion,
            dryRun: args.dryRun === true,
            sessionId: sessionIdOf(exec),
            excludes: config.excludes,
            journalRetentionDays: config.journalRetentionDays,
            argsSanitized: jsonSafe(args),
            onApprove: (plan) => makeApprover(ctx, exec, toolName, plan),
          })
          return sizeOutcome(res)
        } catch (err) {
          return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
        }
      },
      presentCall: (args) => ({
        card: 'generic',
        title: kind === 'create' ? 'Create note' : kind === 'update' ? 'Update note' : 'Append to note',
        kind: 'other',
        rawInput: { path: args.path },
      }),
    }))
  }

  registerWrite('obsidian_note_create', 'create', [
    'Create a NEW note in the vault. Fails if the target already exists.',
    'The note is rendered as optional YAML frontmatter plus the body content.',
    'Every creation is journaled and can be undone with obsidian_undo.',
    'Read operations are free; this write goes through the approval gate',
    'unless the configured write policy allows it.',
  ].join(' '), {
    content: { type: 'string', description: 'Note body (markdown). May be empty.' },
    frontmatter: { type: 'object', additionalProperties: true, description: 'Optional YAML frontmatter as a flat object of scalar values (strings, numbers, booleans, string arrays).' },
  })

  registerWrite('obsidian_note_update', 'update', [
    'Update an existing note. Either replace the whole content (content +',
    'optional frontmatter) or perform a surgical frontmatter edit via',
    'frontmatterUpdates / frontmatterDeletes — every byte you do not mention',
    'is preserved exactly.',
    'Pass baseVersion (from obsidian_read) to be rejected if the file changed',
    'since you read it; never overwrites silently.',
  ].join(' '), {
    content: { type: 'string', description: 'Full replacement body (markdown). Omit to do a frontmatter-only edit.' },
    frontmatter: { type: 'object', additionalProperties: true, description: 'Replacement frontmatter, used only together with content.' },
    frontmatterUpdates: { type: 'object', additionalProperties: true, description: 'Key to new value map; null removes the key. Byte-preserving merge.' },
    frontmatterDeletes: { type: 'array', items: { type: 'string' }, description: 'Frontmatter keys to delete.' },
    baseVersion: { type: 'string', description: 'Version token from a previous obsidian_read; guards against overwriting concurrent edits.' },
  })

  registerWrite('obsidian_note_append', 'append', [
    'Append content to an existing note (end of file, or inside a specific',
    'section heading anchor). Never touches existing bytes.',
  ].join(' '), {
    content: { type: 'string', description: 'Markdown content to append.' },
    section: { type: 'string', description: 'Optional section heading (e.g. "Ideas"); content is inserted before the next section.' },
  })

  ctx.tools.register(defineTool({
    name: 'obsidian_note_delete',
    description: [
      'Delete a note from the vault. It is NEVER unlinked: the file moves to',
      '.dsh-obsidian/trash with its full path recorded in the journal, so',
      'obsidian_undo or obsidian_restore can bring it back byte-identically.',
    ].join(' '),
    parameters: { ...common('obsidian_note_delete', 'Note path relative to the vault root.') },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          action: { type: 'string', required: true },
          path: { type: 'string' },
          opId: { type: 'string' },
          beforeHash: { type: 'string' },
          trashRel: { type: 'string' },
          plan: { type: 'object', additionalProperties: true },
          outcome: { type: 'string' },
          message: { type: 'string' },
        },
      },
      render: (_args, value) => textBlock('obsidian_note_delete -> ' + (value.action ?? '?') + (value.path ? ' / ' + value.path : '')),
    },
    async execute(args, exec) {
      try {
        const vault = await vaultOf(ctx, args)
        const res = await deleteNote(ctx.fs, host, vault, {
          rel: args.path,
          dryRun: args.dryRun === true,
          sessionId: sessionIdOf(exec),
          excludes: config.excludes,
          journalRetentionDays: config.journalRetentionDays,
          argsSanitized: jsonSafe(args),
          onApprove: (plan) => makeApprover(ctx, exec, 'obsidian_note_delete', plan),
        })
        return sizeOutcome(res)
      } catch (err) {
        return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Delete note (to trash)', kind: 'other', rawInput: { path: args.path } }),
  }))

  ctx.tools.register(defineTool({
    name: 'obsidian_batch',
    description: [
      'Run several vault mutations in order: each op is an object with an',
      'action field ("create", "update", "append" or "delete") plus the',
      'parameters of the corresponding single tool.',
      'Each op journals independently and can be rolled back individually.',
      'With dryRun=true nothing is written and you get the full plan preview.',
    ].join(' '),
    parameters: {
      vaultDir: { type: 'string', description: 'Obsidian vault root directory. Omit to use the plugin-configured default.' },
      ops: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
        description: 'Ordered list of operations, each with an action plus the parameters of the corresponding single tool.',
      },
      dryRun: { type: 'boolean', description: 'Preview the whole batch without writing or asking for approval.' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        action: { type: 'string', required: true },
        results: { type: 'array', items: { type: 'object', additionalProperties: true } },
        message: { type: 'string' },
      } },
      render: (_args, value) => textBlock('obsidian_batch -> ' + ((value.results ?? []).length) + ' op(s), ok=' + value.ok),
    },
    async execute(args, exec) {
      try {
        const vault = await vaultOf(ctx, args)
        return await batchMutate(ctx.fs, host, vault, {
          ops: args.ops ?? [],
          dryRun: args.dryRun === true,
          sessionId: sessionIdOf(exec),
          excludes: config.excludes,
          journalRetentionDays: config.journalRetentionDays,
          onApprove: (plan) => makeApprover(ctx, exec, plan.tool ?? 'obsidian_batch', plan),
        })
      } catch (err) {
        return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Batch vault mutation', kind: 'other', rawInput: { ops: args.ops?.length } }),
  }))

  // ---- rollback tools ----
  const registerRollback = (toolName, description, opIdMode) => {
    ctx.tools.register(defineTool({
      name: toolName,
      description,
      parameters: {
        vaultDir: { type: 'string', description: 'Obsidian vault root directory. Omit to use the plugin-configured default.' },
        path: { type: 'string', description: 'Note path relative to the vault root (ignored when an opId is given).' },
        opId: { type: 'string', description: 'Exact journal operation id (from a previous result or obsidian_history).' },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: {
          ok: { type: 'boolean', required: true },
          action: { type: 'string', required: true },
          path: { type: 'string' },
          opId: { type: 'string' },
          message: { type: 'string' },
        } },
        render: (_args, value) => textBlock(toolName + ' -> ' + (value.action ?? '?') + (value.path ? ' / ' + value.path : '')),
      },
      async execute(args, exec) {
        try {
          const vault = await vaultOf(ctx, args)
          const res = opIdMode
            ? await rollbackEntry(ctx.fs, host, vault, { opId: args.opId, sessionId: sessionIdOf(exec), journalRetentionDays: config.journalRetentionDays })
            : await rollbackEntry(ctx.fs, host, vault, { relPath: args.path, sessionId: sessionIdOf(exec), journalRetentionDays: config.journalRetentionDays })
          return res
        } catch (err) {
          return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
        }
      },
      presentCall: (args) => ({ card: 'generic', title: toolName === 'obsidian_undo' ? 'Undo last change' : 'Rollback entry', kind: 'other', rawInput: { path: args.path } }),
    }))
  }

  registerRollback('obsidian_undo', [
    'Undo the most recent committed change on one note. Restores the exact',
    'previous bytes. Refuses (conflict) when the file changed after that',
    'operation. The undo itself is journaled, so undo can be undone.',
  ].join(' '), false)

  registerRollback('obsidian_rollback', [
    'Roll back one exact journal operation by its opId (see obsidian_history).',
    'Same guarantees as obsidian_undo: byte-exact restore, conflict-refusing,',
    'itself journaled.',
  ].join(' '), true)

  ctx.tools.register(defineTool({
    name: 'obsidian_history',
    description: [
      'List recent journal entries (newest first): every committed create/update/',
      'append/delete/undo/rollback/restore with its opId, path, kind, time and',
      'session. Use opIds with obsidian_rollback.',
    ].join(' '),
    parameters: {
      vaultDir: { type: 'string', description: 'Obsidian vault root directory. Omit to use the plugin-configured default.' },
      path: { type: 'string', description: 'Only show entries for this note path.' },
      limit: { type: 'number', description: 'Maximum entries to return (default 50).' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        action: { type: 'string', required: true },
        entries: { type: 'array', items: { type: 'object', additionalProperties: true } },
        message: { type: 'string' },
      } },
      render: (_args, value) => textBlock('obsidian_history -> ' + ((value.entries ?? []).length) + ' entries'),
    },
    async execute(args) {
      try {
        const vault = await vaultOf(ctx, args)
        const entries = await listJournal(ctx.fs, vault, { relPath: args.path, limit: args.limit ?? 50 })
        const slim = entries.map((e) => ({
          opId: e.opId,
          ts: e.ts,
          path: e.path,
          kind: e.kind,
          status: e.status,
          tool: e.tool,
          sessionId: e.sessionId,
          beforeHash: e.beforeHash ?? null,
          afterHash: e.afterHash ?? null,
        }))
        return { ok: true, action: 'history', entries: slim }
      } catch (err) {
        return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Vault change history', kind: 'other', rawInput: { path: args.path } }),
  }))

  ctx.tools.register(defineTool({
    name: 'obsidian_restore',
    description: [
      'Restore a deleted note from the trash back to its original path.',
      'Refuses when a file already exists at the path.',
    ].join(' '),
    parameters: {
      vaultDir: { type: 'string', description: 'Obsidian vault root directory. Omit to use the plugin-configured default.' },
      path: { type: 'string', description: 'Original note path (as deleted).' },
    },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: {
        ok: { type: 'boolean', required: true },
        action: { type: 'string', required: true },
        path: { type: 'string' },
        opId: { type: 'string' },
        message: { type: 'string' },
      } },
      render: (_args, value) => textBlock('obsidian_restore -> ' + (value.action ?? '?') + (value.path ? ' / ' + value.path : '')),
    },
    async execute(args, exec) {
      try {
        const vault = await vaultOf(ctx, args)
        return await restoreFromTrash(ctx.fs, host, vault, { relPath: args.path, sessionId: sessionIdOf(exec) })
      } catch (err) {
        return errTurn(err instanceof SafeError ? err.message : String(err?.message ?? err))
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Restore note', kind: 'other', rawInput: { path: args.path } }),
  }))
}
