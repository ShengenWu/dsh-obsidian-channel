/**
 * Mount the Obsidian surface into the center column.
 *
 * The conversation slot is single-occupant, so the surface is an extra
 * trailing child React never manages. A html[data-dsh-obsidian-active]
 * stylesheet hides the conversation (and sibling plugin panels) while this
 * surface is open; the conversation subtree stays mounted.
 *
 * Do not remount this root from a MutationObserver: the center column is
 * owned by the shell React tree. Re-entering createRoot/unmount during its
 * commit (settings dialog, session switch) tears down the settings UI.
 */
import { createRoot, type Root } from 'react-dom/client'
import type { PanelController } from './controller.ts'
import { watchUntilFound } from './dom-mount.ts'
import { ObsidianPanel, type RpcFn } from './ObsidianPanel.tsx'
import type { ObsidianKey } from './locales.ts'
import { seatStyles } from './styles.ts'

export const PANEL_VIEW_SELECTOR = '[data-dsh-obsidian-view]'

const CONVERSATION_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'
const ACTIVE_ATTR = 'data-dsh-obsidian-active'
const SIBLING_ATTRS = ['data-dsh-taskboard-active', 'data-dsh-ssh-active'] as const
const ACTIVATE_EVENT = 'dsh-panel-activate'
const PANEL_NAME = 'obsidian'
const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'

function conversationColumn(): HTMLElement | undefined {
  return document.querySelector<HTMLElement>(CONVERSATION_COLUMN_SELECTOR) ?? undefined
}

export interface MountPanelOpts {
  controller: PanelController
  rpc: RpcFn
  t: (key: ObsidianKey, params?: Record<string, unknown>) => string
  onTalk: (text: string, vaultDir?: string) => Promise<string | undefined>
}

export function mountObsidianPanel(opts: MountPanelOpts): () => void {
  seatStyles()
  const { controller } = opts
  let root: Root | undefined
  let container: HTMLDivElement | undefined
  let host: HTMLElement | undefined

  const mountInto = (column: HTMLElement) => {
    if (container !== undefined && column.contains(container)) return
    root?.unmount()
    container?.remove()
    if (host !== undefined) delete host.dataset.dshObsidianHost
    host = column
    host.dataset.dshObsidianHost = ''
    container = document.createElement('div')
    container.dataset.dshObsidianView = ''
    column.appendChild(container)
    root = createRoot(container)
    root.render(
      <ObsidianPanel
        controller={controller}
        rpc={opts.rpc}
        t={opts.t}
        onTalk={opts.onTalk}
      />,
    )
  }

  let evictingSiblings = false

  const applyActive = (): void => {
    if (controller.getSnapshot().panelOpen) {
      const column = conversationColumn()
      if (column !== undefined) mountInto(column)
      // SSH / task-board only evict each other. Fire their names so they
      // close their controllers (and clear sidebar data-active).
      evictingSiblings = true
      document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: 'ssh' }))
      document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: 'taskboard' }))
      evictingSiblings = false
      for (const attr of SIBLING_ATTRS) document.documentElement.removeAttribute(attr)
      document.querySelectorAll('[data-dsh-ssh-entry][data-active], [data-dsh-taskboard-entry][data-active]').forEach((el) => {
        el.removeAttribute('data-active')
      })
      document.documentElement.setAttribute(ACTIVE_ATTR, '')
      document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
    } else {
      document.documentElement.removeAttribute(ACTIVE_ATTR)
    }
  }

  const onOtherActivate = (event: Event): void => {
    if (evictingSiblings) return
    const name = (event as CustomEvent).detail
    if (name !== PANEL_NAME && controller.getSnapshot().panelOpen) {
      controller.close()
    }
  }

  const onClickSidebarRow = (event: MouseEvent): void => {
    if (!controller.getSnapshot().panelOpen) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (target.closest('[data-dsh-obsidian-entry]') !== null) return
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) controller.close()
  }

  document.addEventListener('click', onClickSidebarRow, true)
  document.addEventListener(ACTIVATE_EVENT, onOtherActivate)
  const unsubscribe = controller.subscribe(applyActive)
  const stopWait = watchUntilFound(conversationColumn, (column) => {
    if (controller.getSnapshot().panelOpen) mountInto(column)
    else host = column
  })
  applyActive()

  return () => {
    document.removeEventListener('click', onClickSidebarRow, true)
    document.removeEventListener(ACTIVATE_EVENT, onOtherActivate)
    stopWait()
    unsubscribe()
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    if (host !== undefined) delete host.dataset.dshObsidianHost
    root?.unmount()
    root = undefined
    container?.remove()
    container = undefined
    host = undefined
  }
}
