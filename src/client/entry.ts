/**
 * Sidebar entry injection for the Obsidian vault.
 *
 * dsh's sidebar shell exposes no slot an external plugin can register into, so
 * (following the task-board / ssh precedent of DOM-level extension) the entry
 * row is injected between the shell's New Session button and the workspace
 * browser. It is a plain DOM button (no React tree) so it never disturbs the
 * shell reconciliation; a MutationObserver self-heals by re-inserting the row
 * whenever a React re-render displaces it.
 *
 * The entry is NOT a dependency on the web-ui group — it only coordinates with
 * sibling entries through their DOM markers (`data-dsh-taskboard-entry` /
 * `data-dsh-ssh-entry`) so the three can coexist without importing them.
 * Clicking the entry makes the vault a DSH workspace and opens a session in it
 * (config-guided on first use); the safety layer (journal + rollback) stays
 * underwater.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** Stable data attribute identifying the injected entry row. */
export const ENTRY_SELECTOR = '[data-dsh-obsidian-entry]'

/** Inline icon (a flat Obsidian-style rhombus outline, matching the shell's 16px nav-icon look). */
const ICON = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5 14.5 8 8 14.5 1.5 8Z"/></svg>`

const LABEL = 'Obsidian'

/** Find the sidebar shell root element, or undefined while not yet mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** The New Session button row (nested in the logo row on current shells). */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** The family block of plugin entries (ours + task-board + ssh). */
function familyBlock(root: HTMLElement): HTMLElement[] {
  return Array.from(root.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement
      && el.matches('[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-obsidian-entry]'),
  )
}

/** Build the entry row (a detached button; insert once the shell is up). */
function createEntry(onClick: () => void): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshObsidianEntry = ''
  entry.setAttribute('aria-label', LABEL)
  entry.innerHTML = `<span class="entryIcon">${ICON}</span><span class="entryLabel">${LABEL}</span>`
  entry.addEventListener('click', onClick)
  return entry
}

/** Insert the entry after the last family member (stable sibling order). */
function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    const row = button.closest('[class*="logoRow"]')
    const base = (row !== null && row.parentElement === root) ? row : button
    const family = familyBlock(root)
    const anchor = family.length > 0 ? (family[family.length - 1]?.nextElementSibling ?? null) : base.nextElementSibling
    root.insertBefore(entry, anchor)
  }
  return true
}

/** Close any sibling center-column panels so the conversation is visible again. */
function dismissSiblingPanels(): void {
  document.documentElement.removeAttribute('data-dsh-taskboard-active')
  document.documentElement.removeAttribute('data-dsh-ssh-active')
  document.dispatchEvent(new CustomEvent('dsh-panel-activate', { detail: 'obsidian' }))
}

/**
 * Mount the Obsidian sidebar entry.
 *
 * The click handler reads the configured vault through the plugin's own
 * `/obsidian` RPC (config/get). On first use it prompts for the vault path and
 * persists it (config/set); once configured, the vault is registered as a DSH
 * workspace (`workspaces.create`) and a session is opened there
 * (`workspaces.startSession`) — i.e. the entry behaves like a native workspace.
 *
 * @param ctx - client root context (services: workspaces, connection).
 * @returns disposer removing the entry and its observers.
 */
export function mountObsidianEntry(ctx: ClientContext): () => void {
  if (typeof document !== 'undefined' && document.querySelector(ENTRY_SELECTOR) !== null) {
    return () => {}
  }

  const openVault = async (vaultDir: string): Promise<void> => {
    try {
      const ws = await ctx.workspaces.create({ path: vaultDir })
      dismissSiblingPanels()
      // WorkspaceView carries `workspaceId` (not `id`); passing `undefined`
      // here would make startSession fall back to the current workspace.
      ctx.workspaces.startSession(ws.workspaceId)
    } catch (error) {
      console.error('[dsh-obsidian-channel] failed to open vault session:', error)
    }
  }

  const onClick = (): void => {
    void (async () => {
      const res = await ctx.connection.rpc.call('/obsidian', 'config/get', null)
      if (!res.ok) {
        console.error('[dsh-obsidian-channel] config/get failed:', (res as { error?: { message?: string } }).error?.message)
        return
      }
      const vaultDir = (res.value as { vaultDir?: string } | undefined)?.vaultDir
      if (vaultDir) {
        await openVault(vaultDir)
        return
      }
      // First use: no vault configured — guide the user to enter the path.
      const path = window.prompt('请输入你的 Obsidian vault 绝对路径：', '')
      if (path === null || path.trim() === '') return
      const setRes = await ctx.connection.rpc.call('/obsidian', 'config/set', { field: 'vaultDir', value: path.trim() })
      if (!setRes.ok) {
        console.error('[dsh-obsidian-channel] config/set failed:', (setRes as { error?: { message?: string } }).error?.message)
        return
      }
      await openVault(path.trim())
    })()
  }

  const entry = createEntry(onClick)
  let root: HTMLElement | undefined
  let placed = false
  let rootObserver: MutationObserver | undefined

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver?.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) return
      rootObserver?.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    placed = placeEntry(root, entry)
    if (placed && rootObserver === undefined) {
      rootObserver = new MutationObserver(() => {
        if (root === undefined || !root.isConnected) {
          placed = false
          tryPlace()
          return
        }
        if (!root.contains(entry)) placed = placeEntry(root, entry)
      })
      rootObserver.observe(root, { childList: true, subtree: true })
    }
  }

  const waitObserver = new MutationObserver(() => { tryPlace() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver?.disconnect()
    entry.remove()
  }
}
