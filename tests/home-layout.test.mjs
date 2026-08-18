import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compactItems,
  dimOf,
  firstFit,
  fromTwoCol,
  inferSize,
  mergeHomeLayout,
  moveItem,
  overlaps,
  packItems,
  resizeItem,
} from '../src/home-layout.js'

test('sizes: small is half of medium, large is full width two rows', () => {
  assert.deepEqual(dimOf('s'), { w: 1, h: 1 })
  assert.deepEqual(dimOf('m'), { w: 2, h: 1 })
  assert.deepEqual(dimOf('l'), { w: 4, h: 2 })
  assert.equal(dimOf('s').w * 2, dimOf('m').w)
  assert.equal(dimOf('m').w * 2, dimOf('l').w)
  assert.equal(dimOf('s').w * dimOf('s').h * 8, dimOf('l').w * dimOf('l').h)
})

test('inferSize reads the size field or old w/h', () => {
  assert.equal(inferSize({ id: 'continue', size: 'l' }), 'l')
  assert.equal(inferSize({ id: 'continue', w: 2, h: 2 }), 'l')
  assert.equal(inferSize({ id: 'continue', w: 2, h: 1 }), 'm')
  assert.equal(inferSize({ id: 'continue' }), 'm')
  assert.equal(inferSize({ id: 'continue', w: 6, h: 5 }), 'm')
})

test('fromTwoCol turns the old small into medium', () => {
  assert.deepEqual(fromTwoCol({ id: 'continue', size: 's', x: 0, y: 0 }), { id: 'continue', size: 'm', x: 0, y: 0 })
  assert.deepEqual(fromTwoCol({ id: 'changes', size: 's', x: 1, y: 0 }), { id: 'changes', size: 'm', x: 2, y: 0 })
  assert.deepEqual(fromTwoCol({ id: 'search', size: 'l', x: 0, y: 1 }), { id: 'search', size: 'l', x: 0, y: 1 })
})

test('packItems puts two smalls side by side and never overlaps', () => {
  const packed = packItems([
    { id: 'continue', size: 's', x: 0, y: 0 },
    { id: 'changes', size: 's', x: 0, y: 0 },
  ])
  assert.equal(packed[0].x, 0)
  assert.equal(packed[1].x, 1)
  assert.equal(packed[0].y, 0)
  assert.equal(packed[1].y, 0)
  assert.equal(overlaps(
    { x: packed[0].x, y: packed[0].y, w: 1, h: 1 },
    { x: packed[1].x, y: packed[1].y, w: 1, h: 1 },
  ), false)
})

test('two mediums share a row', () => {
  const packed = packItems([
    { id: 'structure', size: 'm', y: 0 },
    { id: 'inbox', size: 'm', y: 0 },
  ])
  const structure = packed.find((row) => row.id === 'structure')
  const inbox = packed.find((row) => row.id === 'inbox')
  assert.equal(structure.w, 2)
  assert.equal(inbox.w, 2)
  assert.equal(structure.x, 0)
  assert.equal(inbox.x, 2)
  assert.equal(structure.y, 0)
  assert.equal(inbox.y, 0)
})

test('medium plus small share a row', () => {
  const packed = packItems([
    { id: 'structure', size: 'm', y: 0 },
    { id: 'inbox', size: 's', y: 0 },
  ])
  const structure = packed.find((row) => row.id === 'structure')
  const inbox = packed.find((row) => row.id === 'inbox')
  assert.equal(structure.w, 2)
  assert.equal(inbox.x, 2)
  assert.equal(inbox.y, 0)
})

test('moveItem pushes the occupant instead of covering it', () => {
  const start = packItems([
    { id: 'continue', size: 's', x: 0, y: 0 },
    { id: 'changes', size: 's', x: 1, y: 0 },
  ])
  const moved = moveItem(start, 'changes', 0, 0)
  const continueCard = moved.find((row) => row.id === 'continue')
  const changes = moved.find((row) => row.id === 'changes')
  assert.equal(changes.x, 0)
  assert.equal(changes.y, 0)
  assert.ok(continueCard.y > 0 || continueCard.x >= 1)
  assert.equal(overlaps(
    { id: 'a', ...continueCard, w: 1, h: 1 },
    { id: 'b', ...changes, w: 1, h: 1 },
  ), false)
})

test('resizeItem to large takes the full width and two rows', () => {
  const start = packItems([{ id: 'continue', size: 's', x: 0, y: 0 }, { id: 'changes', size: 's', x: 1, y: 0 }])
  const next = resizeItem(start, 'continue', 'l')
  const continueCard = next.find((row) => row.id === 'continue')
  assert.equal(continueCard.size, 'l')
  assert.equal(continueCard.w, 4)
  assert.equal(continueCard.h, 2)
})

test('compactItems fills from the top', () => {
  const tidy = compactItems([
    { id: 'continue', size: 's', x: 0, y: 4 },
    { id: 'changes', size: 's', x: 1, y: 6 },
  ])
  assert.equal(Math.min(...tidy.map((row) => row.y)), 0)
})

test('mergeHomeLayout keeps a saved 4-col small pair', () => {
  const rows = mergeHomeLayout(
    [
      { id: 'continue', size: 's', x: 0, y: 0, cols: 4 },
      { id: 'changes', size: 's', x: 1, y: 0, cols: 4 },
    ],
    ['continue', 'changes'],
  )
  assert.equal(rows.find((row) => row.id === 'continue')?.size, 's')
  assert.equal(rows.find((row) => row.id === 'continue')?.x, 0)
  assert.equal(rows.find((row) => row.id === 'changes')?.x, 1)
})

test('legacy 2-col smalls become mediums side by side', () => {
  const rows = mergeHomeLayout(
    [
      { id: 'continue', size: 's', x: 0, y: 0 },
      { id: 'changes', size: 's', x: 1, y: 0 },
    ],
    ['continue', 'changes'],
  )
  const continueCard = rows.find((row) => row.id === 'continue')
  const changes = rows.find((row) => row.id === 'changes')
  assert.equal(continueCard.size, 'm')
  assert.equal(changes.size, 'm')
  assert.equal(continueCard.w, 2)
  assert.equal(changes.w, 2)
  assert.equal(continueCard.y, 0)
  assert.equal(changes.y, 0)
  assert.equal(overlaps(
    { x: continueCard.x, y: continueCard.y, w: continueCard.w, h: continueCard.h },
    { x: changes.x, y: changes.y, w: changes.w, h: changes.h },
  ), false)
})

test('legacy 12-column y values compact instead of leaving a hole', () => {
  const rows = mergeHomeLayout(
    [
      { id: 'continue', x: 0, y: 5, w: 6, h: 5 },
      { id: 'search', x: 0, y: 9, w: 6, h: 4 },
    ],
    ['continue', 'search'],
  )
  assert.equal(Math.min(...rows.map((row) => row.y)), 0)
  const continueCard = rows.find((row) => row.id === 'continue')
  const search = rows.find((row) => row.id === 'search')
  assert.equal(overlaps(
    { x: continueCard.x, y: continueCard.y, w: continueCard.w, h: continueCard.h },
    { x: search.x, y: search.y, w: search.w, h: search.h },
  ), false)
})

test('shiftUp pulls a floated pair back to the top', () => {
  const rows = mergeHomeLayout(
    [
      { id: 'continue', size: 's', x: 0, y: 3, cols: 4 },
      { id: 'search', size: 'l', x: 0, y: 3, cols: 4 },
    ],
    ['continue', 'search'],
  )
  assert.equal(Math.min(...rows.map((row) => row.y)), 0)
})

test('firstFit prefers the left cell then the next', () => {
  const pos = firstFit('s', [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }])
  assert.deepEqual(pos, { x: 1, y: 0 })
})
