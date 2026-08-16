/**
 * Hand a prompt to a NEW session on the vault workspace.
 *
 * Opening the sidebar surface does not create a workspace. Talking does
 * (create({path}) is idempotent). Each click starts a fresh session — never
 * the conversation that was current, and never the previous vault session.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

interface WorkspaceRow {
  workspaceId: string
  path?: string
  sessionIds?: readonly string[]
}

interface WorkspaceListSnap {
  items?: readonly WorkspaceRow[]
}

interface SessionsFace {
  list?: { getSnapshot?: () => { current?: string } }
  open?: (id: string) => void
  create?: (args: { workspaceId: string; cwd?: string; agentPreset?: string }) => Promise<unknown>
  scope?: (id: string) => object | undefined
}

interface ConversationFace {
  input?: {
    for: (actx: object) => {
      setDraft?: (text: string) => void
      state?: { getSnapshot?: () => { draft?: string } }
    }
  }
}

interface WorkspacesFace {
  list?: { getSnapshot?: () => WorkspaceListSnap }
  create?: (args: { path: string }) => Promise<{ workspaceId?: string; workspace?: { workspaceId?: string } }>
  startSession?: (id: string) => void
}

interface ConnectionFace {
  api?: {
    sessions?: {
      create?: (args: { workspaceId: string; agentPreset?: string }) => Promise<unknown>
    }
  }
}

export function samePath(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const norm = (p: string) => p.replace(/\/+$/, '')
  return norm(a) === norm(b)
}

export function workspaceIdForVault(snap: WorkspaceListSnap, vaultDir: string): string | undefined {
  return (snap.items ?? []).find((row) => samePath(row.path, vaultDir))?.workspaceId
}

function sessionIdsOf(snap: WorkspaceListSnap, workspaceId: string): readonly string[] {
  return (snap.items ?? []).find((item) => item.workspaceId === workspaceId)?.sessionIds ?? []
}

function sessionIdFrom(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') return value
  if (typeof value !== 'object' || value === null) return undefined
  const rec = value as Record<string, unknown>
  if (typeof rec.sessionId === 'string') return rec.sessionId
  if (rec.value !== undefined) return sessionIdFrom(rec.value)
  if (rec.result !== undefined) return sessionIdFrom(rec.result)
  return undefined
}

async function fillComposerDraft(
  sessions: SessionsFace,
  conversation: ConversationFace | undefined,
  sessionId: string,
  text: string,
): Promise<boolean> {
  const input = conversation?.input
  if (input === undefined || typeof sessions.scope !== 'function') return false
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const actx = sessions.scope(sessionId)
    if (actx !== undefined) {
      try {
        const shell = input.for(actx)
        if (typeof shell?.setDraft === 'function') {
          shell.setDraft(text)
          return true
        }
      } catch { /* session input not ready yet */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

function fillComposerDom(text: string): boolean {
  const root = document.querySelector<HTMLElement>('[data-pane="conversation"], [class*="centerCol"]')
  const area = root?.querySelector<HTMLTextAreaElement>('textarea')
  if (area === null || area === undefined) return false
  const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
  proto?.set?.call(area, text)
  area.dispatchEvent(new Event('input', { bubbles: true }))
  area.dispatchEvent(new Event('change', { bubbles: true }))
  area.focus()
  return true
}

async function resolveVaultWorkspace(
  workspaces: WorkspacesFace,
  vaultDir: string,
): Promise<string | undefined> {
  const existing = workspaceIdForVault(workspaces.list?.getSnapshot?.() ?? {}, vaultDir)
  if (existing !== undefined) return existing
  if (typeof workspaces.create !== 'function') return undefined
  const created = await workspaces.create({ path: vaultDir })
  return created?.workspaceId ?? created?.workspace?.workspaceId
}

async function createVaultSession(
  workspaces: WorkspacesFace,
  sessions: SessionsFace,
  connection: ConnectionFace | undefined,
  workspaceId: string,
): Promise<string | undefined> {
  const before = new Set(sessionIdsOf(workspaces.list?.getSnapshot?.() ?? {}, workspaceId))

  const apiCreate = connection?.api?.sessions?.create
  if (typeof apiCreate === 'function') {
    const created = sessionIdFrom(await apiCreate({ workspaceId, agentPreset: 'obsidian' }))
    if (created !== undefined && !before.has(created)) return created
    if (created !== undefined) return created
  }

  if (typeof sessions.create === 'function') {
    const created = sessionIdFrom(await sessions.create({ workspaceId, agentPreset: 'obsidian' }))
    if (created !== undefined && !before.has(created)) return created
    if (created !== undefined) return created
  }

  if (typeof workspaces.startSession !== 'function') return undefined
  workspaces.startSession(workspaceId)
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const later = workspaces.list?.getSnapshot?.() ?? {}
    const nowIds = sessionIdsOf(later, workspaceId)
    const fresh = nowIds.find((id) => !before.has(id))
    if (fresh !== undefined) return fresh
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return undefined
}

/**
 * Open a new vault session and put `text` in the composer. Does not send.
 * Returns an error message on failure (never throws).
 */
export async function handoffToAgent(
  ctx: ClientContext,
  text: string,
  vaultDir?: string,
): Promise<string | undefined> {
  const trimmed = text.trim()
  if (trimmed === '') return 'empty prompt'
  const dir = vaultDir?.trim() ?? ''
  if (dir === '') return 'no vault bound'

  const sessions = ctx.sessions as SessionsFace | undefined
  const workspaces = ctx.workspaces as WorkspacesFace | undefined
  const connection = ctx.connection as ConnectionFace | undefined
  const conversation = (ctx as ClientContext & { conversation?: ConversationFace }).conversation
  if (sessions === undefined || workspaces === undefined) return 'sessions/workspaces unavailable'

  let workspaceId: string
  try {
    const resolved = await resolveVaultWorkspace(workspaces, dir)
    if (resolved === undefined) return 'could not open the vault workspace'
    workspaceId = resolved
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }

  let sessionId: string
  try {
    const opened = await createVaultSession(workspaces, sessions, connection, workspaceId)
    if (opened === undefined) return 'could not open a new Obsidian session'
    sessionId = opened
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }

  if (typeof sessions.open === 'function') sessions.open(sessionId)

  const filled = await fillComposerDraft(sessions, conversation, sessionId, trimmed)
  if (!filled) {
    // Composer is still under the panel; retry after the surface closes.
    window.setTimeout(() => {
      void fillComposerDraft(sessions, conversation, sessionId, trimmed).then((ok) => {
        if (!ok) fillComposerDom(trimmed)
      })
    }, 50)
  }
  return undefined
}
