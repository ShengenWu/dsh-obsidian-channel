import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  compactItems,
  LAYOUT_COLS,
  LAYOUT_GAP,
  LAYOUT_ROW,
  layoutBoardHeight,
  mergeHomeLayout,
  moveItem,
  resizeItem,
  tileStyle,
} from '../home-layout.js'
import type { ObsidianKey } from './locales.ts'

export type WidgetSize = 's' | 'm' | 'l'

interface Slot {
  id: string
  size: WidgetSize
  x: number
  y: number
}

interface DragSession {
  id: string
  pointerId: number
  grabX: number
  grabY: number
  startX: number
  startY: number
  armed: boolean
}

const DRAG_THRESHOLD = 6

export function HomeBoard({
  ids,
  saved,
  onCommit,
  renderTile,
  t,
}: {
  ids: string[]
  saved: Slot[]
  onCommit: (next: Slot[]) => void
  renderTile: (id: string) => ReactNode
  t: (key: ObsidianKey, params?: Record<string, unknown>) => string
}) {
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragSession | null>(null)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  const colWRef = useRef(160)

  const [colW, setColW] = useState(160)
  const [slots, setSlots] = useState<Slot[]>(() => mergeHomeLayout(saved, ids) as Slot[])
  const [dragId, setDragId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  colWRef.current = colW

  const idKey = ids.join('|')
  useEffect(() => {
    if (dragRef.current !== null) return
    setSlots(mergeHomeLayout(saved, ids) as Slot[])
  }, [idKey, saved])

  useEffect(() => {
    const el = boardRef.current
    if (el === null) return
    const measure = () => {
      const width = el.clientWidth
      setColW(Math.max(80, (width - LAYOUT_GAP * (LAYOUT_COLS - 1)) / LAYOUT_COLS))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cellAt = (clientX: number, clientY: number, grabX: number, grabY: number) => {
    const board = boardRef.current
    if (board === null) return { x: 0, y: 0 }
    const box = board.getBoundingClientRect()
    const left = clientX - box.left - grabX
    const top = clientY - box.top - grabY
    const stepX = colWRef.current + LAYOUT_GAP
    const stepY = LAYOUT_ROW + LAYOUT_GAP
    return {
      x: Math.max(0, Math.min(LAYOUT_COLS - 1, Math.round(left / stepX))),
      y: Math.max(0, Math.round(top / stepY)),
    }
  }

  const endDrag = () => {
    if (dragRef.current === null) return
    const wasArmed = dragRef.current.armed
    dragRef.current = null
    setDragId(null)
    if (wasArmed) {
      setSlots((prev) => {
        commitRef.current(prev)
        return prev
      })
    }
  }

  useEffect(() => {
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (drag === null || ev.pointerId !== drag.pointerId) return
      const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY)
      if (!drag.armed) {
        if (dist < DRAG_THRESHOLD) return
        drag.armed = true
        setDragId(drag.id)
        setMenuId(null)
      }
      const cell = cellAt(ev.clientX, ev.clientY, drag.grabX, drag.grabY)
      setSlots((prev) => moveItem(prev, drag.id, cell.x, cell.y) as Slot[])
    }
    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (drag === null || ev.pointerId !== drag.pointerId) return
      endDrag()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', endDrag)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('blur', endDrag)
    }
  }, [])

  useEffect(() => {
    if (menuId === null) return
    const onDown = (ev: PointerEvent) => {
      const target = ev.target as HTMLElement | null
      if (target?.closest('[data-ob-tile-menu]') !== null) return
      setMenuId(null)
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setMenuId(null)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuId])

  const byId = useMemo(() => {
    const map = new Map<string, Slot>()
    for (const slot of slots) map.set(slot.id, slot)
    return map
  }, [slots])

  const commit = (next: Slot[]) => {
    setSlots(next)
    onCommit(next)
  }

  const startDrag = (id: string, ev: ReactPointerEvent) => {
    if (ev.button !== 0) return
    if ((ev.target as HTMLElement | null)?.closest('button') !== null) return
    const tile = ev.currentTarget.parentElement
    if (tile === null) return
    const box = tile.getBoundingClientRect()
    dragRef.current = {
      id,
      pointerId: ev.pointerId,
      grabX: ev.clientX - box.left,
      grabY: ev.clientY - box.top,
      startX: ev.clientX,
      startY: ev.clientY,
      armed: false,
    }
  }

  const height = layoutBoardHeight(slots)

  return (
    <div className="ob-board-wrap">
      <div className="ob-board-bar">
        <button
          type="button"
          className="ob-btn"
          onClick={() => commit(compactItems(slots) as Slot[])}
        >
          {t('home.arrange')}
        </button>
      </div>
      <div ref={boardRef} className="ob-board" style={{ height }}>
        {ids.map((id) => {
          const slot = byId.get(id)
          if (slot === undefined) return null
          return (
            <div
              key={id}
              className={
                'ob-tile'
                + (dragId === id ? ' dragging' : '')
                + (menuId === id ? ' menu-open' : '')
              }
              data-size={slot.size}
              style={tileStyle(slot, colW, dragId === id || menuId === id ? 40 : undefined)}
            >
              <div className="ob-drag" onPointerDown={(ev) => startDrag(id, ev)} />
              <div className="ob-tile-gear" data-ob-tile-menu>
                <button
                  type="button"
                  className={'ob-tile-more' + (menuId === id ? ' on' : '')}
                  aria-label={t('home.tile.menu')}
                  aria-haspopup="menu"
                  aria-expanded={menuId === id}
                  onClick={() => setMenuId((cur) => (cur === id ? null : id))}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                    <circle cx="3" cy="7" r="1.25" fill="currentColor" />
                    <circle cx="7" cy="7" r="1.25" fill="currentColor" />
                    <circle cx="11" cy="7" r="1.25" fill="currentColor" />
                  </svg>
                </button>
                {menuId === id && (
                  <div className="ob-tile-menu" role="menu">
                    {(['s', 'm', 'l'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        role="menuitemradio"
                        aria-checked={slot.size === size}
                        className={'ob-tile-menu-item' + (slot.size === size ? ' on' : '')}
                        onClick={() => {
                          commit(resizeItem(slots, id, size) as Slot[])
                          setMenuId(null)
                        }}
                      >
                        {t(('home.size.' + size) as ObsidianKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {renderTile(id)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
