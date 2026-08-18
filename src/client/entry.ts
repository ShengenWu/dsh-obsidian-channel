/**
 * Sidebar entry injection for the Obsidian surface.
 *
 * dsh's sidebar shell exposes no slot an external plugin can register into, so
 * (following the task-board / ssh precedent of DOM-level extension) the entry
 * row is injected between the shell's New Session button and the workspace
 * browser. It is a plain DOM button (no React tree) so it never disturbs the
 * shell reconciliation; a MutationObserver self-heals by re-inserting the row
 * whenever a React re-render displaces it.
 *
 * Clicking toggles the center-column Obsidian surface. It does not create a
 * workspace.
 */
import type { PanelController } from './controller.ts'
import { watchUntilFound } from './dom-mount.ts'
import { seatStyles } from './styles.ts'

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

/**
 * Mount the Obsidian sidebar entry. Clicking toggles the center-column surface.
 *
 * @param controller - the panel controller the entry toggles.
 * @returns disposer removing the entry and its observers.
 */
export function mountObsidianEntry(controller: PanelController): () => void {
  seatStyles()
  if (typeof document !== 'undefined' && document.querySelector(ENTRY_SELECTOR) !== null) {
    return () => {}
  }

  const entry = createEntry(() => { controller.toggle() })
  let root: HTMLElement | undefined
  let rootObserver: MutationObserver | undefined
  let stopWait: (() => void) | undefined

  const watchRoot = (host: HTMLElement) => {
    rootObserver?.disconnect()
    root = host
    placeEntry(host, entry)
    rootObserver = new MutationObserver(() => {
      if (root === undefined || !root.isConnected) {
        rootObserver?.disconnect()
        rootObserver = undefined
        root = undefined
        stopWait?.()
        stopWait = watchUntilFound(sidebarRoot, watchRoot)
        return
      }
      if (entry.parentElement !== root) {
        queueMicrotask(() => {
          if (root !== undefined && root.isConnected && entry.parentElement !== root) placeEntry(root, entry)
        })
      }
    })
    // childList only: the session list lives under this root; subtree would
    // fire on every session-row render and stall the whole sidebar.
    rootObserver.observe(host, { childList: true })
  }

  stopWait = watchUntilFound(sidebarRoot, watchRoot)

  const syncActive = () => {
    if (controller.getSnapshot().panelOpen) entry.dataset.active = 'true'
    else delete entry.dataset.active
  }
  const unsubscribe = controller.subscribe(syncActive)
  syncActive()

  return () => {
    stopWait?.()
    rootObserver?.disconnect()
    unsubscribe()
    entry.remove()
  }
}
