/**
 * Find a host node, then stop watching the whole document.
 * A document-wide subtree observer during dsh boot (50+ plugins hydrating)
 * taxes every React mutation; only keep it until the first successful mount.
 */

export function watchUntilFound(
  find: () => HTMLElement | undefined,
  onFound: (el: HTMLElement) => void,
): () => void {
  let armed: MutationObserver | undefined
  let scheduled = false

  const stop = () => {
    armed?.disconnect()
    armed = undefined
  }

  const tick = () => {
    const el = find()
    if (el === undefined) return false
    stop()
    onFound(el)
    return true
  }

  if (tick()) return stop

  armed = new MutationObserver(() => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      tick()
    })
  })
  armed.observe(document.documentElement, { childList: true, subtree: true })
  return stop
}
