/**
 * Widget board: 4 columns, three sizes.
 *   small  1×1  = half the previous small (¼ of a row)
 *   medium 2×1  = the previous small (½ of a row)
 *   large  4×2  = full width, two rows
 * The old full-width “medium” (2-col × 1 row) is gone.
 */

export const LAYOUT_COLS = 4
export const LAYOUT_ROW = 210
export const LAYOUT_GAP = 16

export const SIZES = {
  s: { w: 1, h: 1 },
  m: { w: 2, h: 1 },
  l: { w: 4, h: 2 },
}

export const DEFAULT_SIZE = {
  continue: 'm',
  changes: 'm',
  daily: 'm',
  search: 'm',
  structure: 'm',
  inbox: 'm',
  links: 'm',
  actions: 'm',
}

export function coerceSize(value) {
  if (value === 's' || value === 'm' || value === 'l') return value
  return 's'
}

export function inferSize(row) {
  if (row && (row.size === 's' || row.size === 'm' || row.size === 'l')) return row.size
  const w = Number(row?.w)
  // Old 12-column layouts used w=3..12.
  if (Number.isFinite(w) && w > LAYOUT_COLS) return DEFAULT_SIZE[row?.id] ?? 'm'
  const h = Number(row?.h)
  if (Number.isFinite(w) && Number.isFinite(h)) {
    if (w >= 4 && h >= 2) return 'l'
    if (w >= 2 && h >= 2) return 'l'
    if (w >= 2 || h >= 2) return 'm'
  }
  return DEFAULT_SIZE[row?.id] ?? 'm'
}

export function looksLegacy(saved) {
  if (!Array.isArray(saved) || saved.length === 0) return false
  return saved.some((row) => {
    if (row === null || typeof row !== 'object') return false
    const w = Number(row.w)
    const y = Number(row.y)
    if (Number.isFinite(w) && w > LAYOUT_COLS) return true
    if (row.size !== 's' && row.size !== 'm' && row.size !== 'l' && Number.isFinite(w)) return true
    if (Number.isFinite(y) && y > 8) return true
    return false
  })
}

/** Saved rows from the 2-column board have no cols:4 stamp. */
export function looksTwoCol(saved) {
  if (!Array.isArray(saved) || saved.length === 0) return false
  return saved.some((row) => {
    if (row === null || typeof row !== 'object') return false
    if (DEFAULT_SIZE[row.id] === undefined) return false
    return row.cols !== LAYOUT_COLS
  })
}

export function clampX(x, w) {
  const width = Math.max(1, Number(w) || 1)
  const xi = Number.isFinite(Number(x)) ? Math.round(Number(x)) : 0
  return Math.max(0, Math.min(LAYOUT_COLS - width, xi))
}

/** Map a 2-column slot onto the 4-column board: old small → medium. */
export function fromTwoCol(row) {
  const id = typeof row?.id === 'string' ? row.id : ''
  const old = inferSize({ ...row, id })
  const y = Math.max(0, Number(row?.y) || 0)
  if (old === 's') return { id, size: 'm', x: row?.x === 1 ? 2 : 0, y }
  if (old === 'l') return { id, size: 'l', x: 0, y }
  return { id, size: 'm', x: 0, y }
}

export function shiftUp(items) {
  if (!Array.isArray(items) || items.length === 0) return items
  let minY = Infinity
  for (const item of items) minY = Math.min(minY, Math.max(0, Number(item.y) || 0))
  if (!Number.isFinite(minY) || minY <= 0) return items
  return items.map((item) => ({ ...item, y: Math.max(0, (Number(item.y) || 0) - minY) }))
}

export function dimOf(size) {
  return SIZES[coerceSize(size)] ?? SIZES.s
}

export function footprint(item) {
  const dim = dimOf(item.size)
  const x = clampX(item.x, dim.w)
  const y = Math.max(0, Number(item.y) || 0)
  return { id: item.id, x, y, w: dim.w, h: dim.h, size: coerceSize(item.size), cols: LAYOUT_COLS }
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function fitsFree(rect, others) {
  return others.every((item) => item.id === rect.id || !overlaps(rect, item))
}

export function firstFit(size, occupied, startY = 0) {
  const dim = dimOf(size)
  const maxX = LAYOUT_COLS - dim.w
  for (let y = Math.max(0, startY); y < 80; y++) {
    for (let x = 0; x <= maxX; x++) {
      const trial = { id: '_', x, y, w: dim.w, h: dim.h }
      if (fitsFree(trial, occupied)) return { x, y }
    }
  }
  return { x: 0, y: 0 }
}

function placedSlot(id, size, x, y) {
  const dim = dimOf(size)
  return { id, size, x, y, w: dim.w, h: dim.h, cols: LAYOUT_COLS }
}

export function packItems(items) {
  const placed = []
  for (const item of items) {
    const size = coerceSize(item.size)
    const wish = footprint({ ...item, size })
    const pos = fitsFree(wish, placed) ? { x: wish.x, y: wish.y } : firstFit(size, placed, wish.y)
    placed.push(placedSlot(item.id, size, pos.x, pos.y))
  }
  return placed
}

export function compactItems(items) {
  const ordered = [...items].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0) || String(a.id).localeCompare(String(b.id)))
  const placed = []
  for (const item of ordered) {
    const size = coerceSize(item.size)
    const pos = firstFit(size, placed, 0)
    placed.push(placedSlot(item.id, size, pos.x, pos.y))
  }
  return placed
}

export function moveItem(items, id, x, y) {
  const current = items.find((row) => row.id === id)
  if (current === undefined) return items
  const size = coerceSize(current.size)
  const dim = dimOf(size)
  const nx = clampX(x, dim.w)
  const ny = Math.max(0, Math.round(Number(y) || 0))
  const moved = placedSlot(id, size, nx, ny)
  const rest = items
    .filter((row) => row.id !== id)
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
  const placed = [moved]
  for (const item of rest) {
    const nextSize = coerceSize(item.size)
    const wish = footprint(item)
    const pos = fitsFree(wish, placed) ? { x: wish.x, y: wish.y } : firstFit(nextSize, placed, wish.y)
    placed.push(placedSlot(item.id, nextSize, pos.x, pos.y))
  }
  return placed
}

export function resizeItem(items, id, size) {
  const nextSize = coerceSize(size)
  const current = items.find((row) => row.id === id)
  if (current === undefined) return items
  const dim = dimOf(nextSize)
  const wish = footprint({ ...current, size: nextSize, x: dim.w === 2 ? 0 : current.x })
  const others = items.filter((row) => row.id !== id).map(footprint)
  const pos = fitsFree(wish, others) ? { x: wish.x, y: wish.y } : firstFit(nextSize, others, wish.y)
  const resized = { id, size: nextSize, x: pos.x, y: pos.y, w: dim.w, h: dim.h }
  return moveItem(
    items.map((row) => (row.id === id ? resized : row)),
    id,
    resized.x,
    resized.y,
  )
}

function spanOf(items) {
  let max = 0
  for (const item of items) max = Math.max(max, (item.y ?? 0) + dimOf(item.size).h)
  return max
}

export function mergeHomeLayout(saved, ids) {
  const wanted = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && DEFAULT_SIZE[id] !== undefined) : Object.keys(DEFAULT_SIZE)
  const twoCol = looksTwoCol(saved)
  const byId = new Map()
  if (Array.isArray(saved)) {
    for (const row of saved) {
      if (row === null || typeof row !== 'object') continue
      const id = typeof row.id === 'string' ? row.id : ''
      if (DEFAULT_SIZE[id] === undefined) continue
      if (twoCol) {
        byId.set(id, fromTwoCol({ ...row, id }))
        continue
      }
      const size = inferSize({ ...row, id })
      byId.set(id, {
        id,
        size,
        x: clampX(row.x, dimOf(size).w),
        y: Math.max(0, Number(row.y) || 0),
      })
    }
  }
  const rows = wanted.map((id) => byId.get(id) ?? {
    id,
    size: DEFAULT_SIZE[id] ?? 'm',
    x: 0,
    y: 99,
  })
  const placed = rows.filter((row) => row.y < 99)
  const savedHasHidden = Array.isArray(saved) && saved.some((row) => row && DEFAULT_SIZE[row.id] && !wanted.includes(row.id))
  const floated = placed.length > 0 && placed.every((row) => row.y >= 1)
  if (twoCol || looksLegacy(saved) || floated || (savedHasHidden && spanOf(placed) > spanOf(compactItems(placed)))) {
    return compactItems(rows)
  }
  rows.sort((a, b) => a.y - b.y || a.x - b.x)
  return packItems(shiftUp(rows))
}

export function upsertHomeLayout(prev, next) {
  const byId = new Map()
  for (const row of mergeHomeLayout(prev)) byId.set(row.id, row)
  if (Array.isArray(next)) {
    for (const row of next) {
      if (row === null || typeof row !== 'object' || DEFAULT_SIZE[row.id] === undefined) continue
      byId.set(row.id, footprint({ id: row.id, size: inferSize(row), x: row.x, y: row.y }))
    }
  }
  return packItems([...byId.values()])
}

export function layoutBoardHeight(rects) {
  let max = 0
  for (const rect of rects) {
    const dim = dimOf(rect.size)
    max = Math.max(max, (rect.y ?? 0) + dim.h)
  }
  if (max === 0) return 0
  return max * LAYOUT_ROW + (max - 1) * LAYOUT_GAP
}

export function tileStyle(item, colW, z) {
  const dim = dimOf(item.size)
  const x = clampX(item.x, dim.w)
  const y = item.y ?? 0
  return {
    left: x * (colW + LAYOUT_GAP),
    top: y * (LAYOUT_ROW + LAYOUT_GAP),
    width: dim.w * colW + (dim.w - 1) * LAYOUT_GAP,
    height: dim.h * LAYOUT_ROW + (dim.h - 1) * LAYOUT_GAP,
    zIndex: z ?? (20 - y),
  }
}
