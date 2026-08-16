/**
 * Obsidian surface controller: the single owner of the center-column
 * panel's open/closed state. Framework-free so the sidebar entry and the
 * React view share one subscription surface (same shape as dsh-ssh).
 */

export interface PanelSnapshot {
  panelOpen: boolean
}

export class PanelController {
  private panelOpen = false
  private readonly listeners = new Set<() => void>()

  getSnapshot(): PanelSnapshot {
    return { panelOpen: this.panelOpen }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  open(): void {
    if (this.panelOpen) return
    this.panelOpen = true
    this.notify()
  }

  close(): void {
    if (!this.panelOpen) return
    this.panelOpen = false
    this.notify()
  }

  toggle(): void {
    if (this.panelOpen) this.close()
    else this.open()
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn()
  }
}
