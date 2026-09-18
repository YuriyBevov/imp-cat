const test = require('node:test')
const assert = require('node:assert/strict')
const {
  alignTableColumnsToGrid,
  captureZoomAnchor,
  clampGroupDelta,
  createSegmentMergePlan,
  findNearestFreeGridRect,
  findSegmentOverlaps,
  getFlowPageCount,
  getFlowPagePlacement,
  getMergeSeparator,
  getPhysicalPageSize,
  getSegmentActionTargets,
  getSegmentHorizontalGeometry,
  getZoomScrollAdjustment,
  isDocumentSegment,
  isPageEmpty,
  layoutSequentialFlowBoxes,
  layoutSourceFlow,
  rectangleOverlapRatio,
  rectanglesIntersect,
  resolveVerticalOverlaps,
  remapPageIndexAfterRemoval,
  screenDeltaToDocument,
  surfacePointFromCoordinates,
} = require('../public/layout-model.js')

test('separates visual zoom from document geometry', () => {
  assert.equal(screenDeltaToDocument(100, 2), 50)
  assert.equal(screenDeltaToDocument(100, 0.5), 200)
  assert.equal(screenDeltaToDocument(100, 0.25), 400)
})

test('updates the dragged document point when its scroll surface moves under a fixed cursor', () => {
  const beforeScroll = surfacePointFromCoordinates(
    { left: 100, top: 200 }, 300, 500, 2, 800, 1100,
  )
  const afterScroll = surfacePointFromCoordinates(
    { left: 100, top: 120 }, 300, 500, 2, 800, 1100,
  )
  assert.deepEqual(beforeScroll, { x: 100, y: 150 })
  assert.deepEqual(afterScroll, { x: 100, y: 190 })
})

test('keeps the document point under the cursor while zooming', () => {
  const anchor = captureZoomAnchor(
    { left: 100, top: 50, width: 800, height: 1200 },
    500,
    350,
  )
  assert.deepEqual(anchor, {
    clientX: 500,
    clientY: 350,
    ratioX: 0.5,
    ratioY: 0.25,
  })
  assert.deepEqual(getZoomScrollAdjustment(anchor, {
    left: 80,
    top: 20,
    width: 1200,
    height: 1800,
  }), {
    x: 180,
    y: 120,
  })
})

test('detects and vertically resolves meaningful segment overlaps', () => {
  const segments = [
    { id: 'first', pageIndex: 0, x: 10, y: 10, width: 200, height: 50, zIndex: 1 },
    { id: 'second', pageIndex: 0, x: 20, y: 30, width: 160, height: 40, zIndex: 2 },
    { id: 'other-column', pageIndex: 0, x: 300, y: 20, width: 100, height: 40, zIndex: 3 },
  ]
  assert.equal(rectangleOverlapRatio(segments[0], segments[1]), 0.75)
  assert.equal(findSegmentOverlaps(segments, 0.12).length, 1)
  const placements = resolveVerticalOverlaps(segments, 4, 0.12)
  assert.equal(placements.get('first'), 10)
  assert.equal(placements.get('second'), 64)
  assert.equal(placements.get('other-column'), 20)
})

test('places a grid-aligned segment below its anchor before changing the recognized column', () => {
  const placement = findNearestFreeGridRect(
    { left: 2, top: 3, right: 6, bottom: 5 },
    [{ left: 2, top: 3, right: 6, bottom: 6 }],
    12,
    16,
  )
  assert.deepEqual(placement, { left: 2, top: 6, right: 6, bottom: 8 })
})

test('returns no placement when the grid has no free rectangle of the requested size', () => {
  assert.equal(findNearestFreeGridRect(
    { left: 0, top: 0, right: 2, bottom: 2 },
    [{ left: 0, top: 0, right: 2, bottom: 2 }],
    2,
    2,
  ), null)
})

test('source flow keeps columns, exact content dimensions, and adds continuation pages', () => {
  const area = { x: 40, y: 40, width: 600, height: 300 }
  const box = (id, x, y, width, height) => ({ id, x, width, height, anchor: { x, y, width: 200, height: 20 } })
  const result = layoutSourceFlow([
    box('left-a', 40, 40, 183.5, 180),
    box('right-a', 360, 40, 192.2, 20),
    box('left-b', 40, 90, 151.7, 140),
    box('right-b', 360, 90, 163.2, 30),
    box('left-c', 40, 140, 153.7, 100),
  ], area)
  assert.equal(result.pageCount, 2)
  assert.equal(result.placements.get('left-b').pageOffset, 1)
  assert.equal(result.placements.get('left-b').y, 40)
  assert.equal(result.placements.get('left-c').pageOffset, 1)
  assert.equal(result.placements.get('right-b').pageOffset, 0, 'independent column stays on its source page')
  assert.equal(result.placements.get('left-a').width, 183.5)
  assert.equal(result.placements.get('left-b').x, 40)
  const placed = [...result.placements.values()]
  for (let index = 0; index < placed.length; index += 1) {
    const current = placed[index]
    assert.ok(current.y + current.height <= 340)
    for (const other of placed.slice(index + 1)) {
      if (current.pageOffset === other.pageOffset) assert.equal(rectanglesIntersect(current, other), false)
    }
  }
})

test('source flow leaves an independent column anchored and respects fixed obstacles', () => {
  const area = { x: 0, y: 0, width: 400, height: 300 }
  const result = layoutSourceFlow([
    { id: 'a', x: 0, width: 100, height: 200, anchor: { x: 0, y: 0, width: 100, height: 20 } },
    { id: 'b', x: 250, width: 100, height: 40, anchor: { x: 250, y: 50, width: 100, height: 20 } },
    { id: 'c', x: 0, width: 100, height: 180, anchor: { x: 0, y: 80, width: 100, height: 20 } },
  ], area, [{ x: 250, y: 50, width: 100, height: 50 }])
  assert.equal(result.placements.get('c').pageOffset, 1)
  assert.equal(result.placements.get('b').pageOffset, 0)
  assert.equal(result.placements.get('b').y, 102)
})

test('source flow refuses an oversized indivisible block without mutating input', () => {
  const boxes = [{ id: 'large', x: 0, width: 100, height: 400, anchor: { x: 0, y: 0, width: 100, height: 20 } }]
  const before = JSON.stringify(boxes)
  assert.throws(() => layoutSourceFlow(boxes, { x: 0, y: 0, width: 300, height: 300 }), /больше целой страницы/)
  assert.equal(JSON.stringify(boxes), before)
})

test('source flow carries a table row together and gives every cell the complete row height', () => {
  const boxes = [
    { id: 'a', x: 0, width: 100, height: 120, rowGroup: 'table:1', anchor: { x: 0, y: 230, width: 100, height: 30 } },
    { id: 'b', x: 120, width: 100, height: 30, rowGroup: 'table:1', anchor: { x: 120, y: 232, width: 100, height: 30 } },
  ]
  const result = layoutSourceFlow(boxes, { x: 0, y: 0, width: 400, height: 300 })
  assert.equal(result.pageCount, 2)
  assert.equal(result.placements.get('a').pageOffset, 1)
  assert.equal(result.placements.get('b').pageOffset, 1)
  assert.equal(result.placements.get('a').y, result.placements.get('b').y)
  assert.equal(result.placements.get('a').height, 120)
  assert.equal(result.placements.get('b').height, 120)
})

test('table columns share grid boundaries without overlap and reserve their minimum content width', () => {
  const boxes = [
    { id: 'a1', tableId: 't1', columnIndex: 0, columnSpan: 1, minimumWidth: 22, x: 42, width: 29, anchor: { x: 42, y: 20, width: 29, height: 20 } },
    { id: 'b1', tableId: 't1', columnIndex: 1, columnSpan: 1, minimumWidth: 52, x: 71, width: 36, anchor: { x: 71, y: 20, width: 36, height: 20 } },
    { id: 'c1', tableId: 't1', columnIndex: 2, columnSpan: 1, minimumWidth: 30, x: 107, width: 43, anchor: { x: 107, y: 20, width: 43, height: 20 } },
    { id: 'a2', tableId: 't1', columnIndex: 0, columnSpan: 1, minimumWidth: 18, x: 43, width: 28, anchor: { x: 43, y: 60, width: 28, height: 20 } },
    { id: 'b2', tableId: 't1', columnIndex: 1, columnSpan: 1, minimumWidth: 40, x: 71, width: 36, anchor: { x: 71, y: 60, width: 36, height: 20 } },
    { id: 'c2', tableId: 't1', columnIndex: 2, columnSpan: 1, minimumWidth: 28, x: 107, width: 43, anchor: { x: 107, y: 60, width: 43, height: 20 } },
  ]
  const aligned = alignTableColumnsToGrid(boxes, { x: 40, y: 10, width: 170, height: 200 }, 17)
  const firstRow = aligned.slice(0, 3)
  const secondRow = aligned.slice(3)
  assert.deepEqual(secondRow.map(box => [box.x, box.width]), firstRow.map(box => [box.x, box.width]))
  assert.ok(firstRow.every(box => (box.x - 40) % 17 === 0 && box.width % 17 === 0))
  assert.ok(firstRow.every(box => box.width >= box.minimumWidth))
  assert.equal(firstRow[0].x + firstRow[0].width, firstRow[1].x)
  assert.equal(firstRow[1].x + firstRow[1].width, firstRow[2].x)
})

test('table columns stay on shared grid boundaries when all minimum widths cannot fit', () => {
  const boxes = [
    { id: 'a', tableId: 'wide', columnIndex: 0, minimumWidth: 68, anchor: { x: 40, y: 20, width: 34, height: 20 } },
    { id: 'b', tableId: 'wide', columnIndex: 1, minimumWidth: 102, anchor: { x: 74, y: 20, width: 51, height: 20 } },
    { id: 'c', tableId: 'wide', columnIndex: 2, minimumWidth: 85, anchor: { x: 125, y: 20, width: 51, height: 20 } },
  ]
  const aligned = alignTableColumnsToGrid(boxes, { x: 40, y: 10, width: 136, height: 200 }, 17)
  assert.equal(aligned.reduce((sum, box) => sum + box.width, 0), 136)
  assert.ok(aligned.every(box => (box.x - 40) % 17 === 0 && box.width % 17 === 0))
  assert.equal(aligned[0].x + aligned[0].width, aligned[1].x)
  assert.equal(aligned[1].x + aligned[1].width, aligned[2].x)
})

test('scans dense multi-page layouts without mixing unrelated page rows', () => {
  const segments = Array.from({ length: 2_000 }, (_, index) => ({
    id: `segment-${index}`,
    pageIndex: Math.floor(index / 100),
    x: 20,
    y: (index % 100) * 10,
    width: 740,
    height: 8,
  }))
  assert.equal(findSegmentOverlaps(segments, 0.12).length, 0)
})

test('selects intersecting rectangles and clamps a group to the physical page', () => {
  assert.equal(rectanglesIntersect(
    { x: 0, y: 0, width: 40, height: 40 },
    { x: 30, y: 30, width: 40, height: 40 },
  ), true)
  assert.equal(rectanglesIntersect(
    { x: 0, y: 0, width: 20, height: 20 },
    { x: 20, y: 20, width: 20, height: 20 },
  ), false)

  const delta = clampGroupDelta([
    { x: 20, y: 30, width: 40, height: 50 },
    { x: 80, y: 90, width: 30, height: 20 },
  ], 200, -100, 160, 140)
  assert.deepEqual(delta, { x: 50, y: -30 })
})

test('uses the full content width for body paragraphs but preserves contained geometry', () => {
  const rectangle = { left: 380, width: 120 }
  const contentBounds = { x: 64, width: 666 }

  assert.deepEqual(
    getSegmentHorizontalGeometry(rectangle, 100, 794, contentBounds, true),
    { x: 64, width: 666 },
  )
  assert.deepEqual(
    getSegmentHorizontalGeometry(rectangle, 100, 794, contentBounds, false),
    { x: 280, width: 120 },
  )
})

test('uses the declared Word page size instead of overflowing DOM height', () => {
  assert.deepEqual(getPhysicalPageSize(794, 1122, 794, 2244), {
    width: 794,
    height: 1122,
  })
  assert.deepEqual(getPhysicalPageSize(0, 0, 816, 1056), {
    width: 816,
    height: 1056,
  })
})

test('moves overflowing flow to continuation pages without bottom stacking', () => {
  assert.equal(getFlowPageCount(1123, 1122, 64), 1)
  assert.equal(getFlowPageCount(1180, 1122, 64), 2)
  assert.equal(getFlowPageCount(2300, 1122, 64), 3)

  assert.deepEqual(getFlowPagePlacement(1280, 80, 1122, 3, 64), {
    pageOffset: 1,
    y: 222,
  })
  assert.deepEqual(getFlowPagePlacement(1100, 80, 1122, 3, 64), {
    pageOffset: 1,
    y: 64,
  })
  assert.deepEqual(getFlowPagePlacement(2180, 60, 1122, 3, 64), {
    pageOffset: 2,
    y: 64,
  })
})

test('keeps parked and detached segments outside the document model', () => {
  assert.equal(isDocumentSegment({ deleted: false, parked: false, pageIndex: 0, pageId: 'page-1' }), true)
  assert.equal(isDocumentSegment({ deleted: false, parked: true, pageIndex: null }), false)
  assert.equal(isDocumentSegment({ deleted: false, parked: false, pageIndex: null, pageId: null }), false)
  assert.equal(isDocumentSegment({ deleted: false, parked: false, pageIndex: 0, pageId: null }), false)
  assert.equal(isDocumentSegment({ deleted: true, parked: false, pageIndex: 0, pageId: 'page-1' }), false)
})

test('moves following flow blocks after a paragraph is carried to the next page', () => {
  const result = layoutSequentialFlowBoxes([
    { id: 'before-break', y: 900, height: 180, order: 0 },
    { id: 'following', y: 1090, height: 80, order: 1 },
  ], 1122, 70, 1050)

  assert.deepEqual(result.placements.get('before-break'), { pageOffset: 1, y: 70 })
  assert.deepEqual(result.placements.get('following'), { pageOffset: 1, y: 260 })
  assert.equal(result.pageCount, 2)
})

test('uses the Word text bottom instead of placing flow text in the bottom margin', () => {
  const result = layoutSequentialFlowBoxes([
    { id: 'paragraph', y: 980, height: 100, order: 0 },
  ], 1122, 70, 1050)

  assert.deepEqual(result.placements.get('paragraph'), { pageOffset: 1, y: 70 })
  assert.equal(result.pageCount, 2)
})

test('allows removing only empty pages and remaps surviving page references', () => {
  const segments = [
    { deleted: false, parked: false, pageIndex: 0, pageId: 'page-1' },
    { deleted: true, parked: false, pageIndex: 1, pageId: 'page-2' },
    { deleted: false, parked: true, pageIndex: null, pageId: null },
  ]
  assert.equal(isPageEmpty(segments, 0), false)
  assert.equal(isPageEmpty(segments, 1), true)
  assert.equal(remapPageIndexAfterRemoval(0, 1, 2), 0)
  assert.equal(remapPageIndexAfterRemoval(1, 1, 2), 1)
  assert.equal(remapPageIndexAfterRemoval(2, 1, 2), 1)
  assert.equal(remapPageIndexAfterRemoval(null, 1, 2), null)
})

test('applies a menu action to the selected group when its member opens the menu', () => {
  const segments = [
    { id: 'first', deleted: false },
    { id: 'second', deleted: false },
    { id: 'third', deleted: false },
    { id: 'deleted', deleted: true },
  ]
  assert.deepEqual(
    getSegmentActionTargets(segments, new Set(['first', 'second', 'deleted']), 'second')
      .map((segment) => segment.id),
    ['first', 'second'],
  )
  assert.deepEqual(
    getSegmentActionTargets(segments, new Set(['first', 'second']), 'third')
      .map((segment) => segment.id),
    ['third'],
  )
})

test('orders same-page segments for merging and returns their shared bounds', () => {
  const segments = [
    { id: 'right', pageIndex: 0, parked: false, x: 220, y: 40, width: 80, height: 24, zIndex: 2 },
    { id: 'next-line', pageIndex: 0, parked: false, x: 40, y: 100, width: 180, height: 30, zIndex: 3 },
    { id: 'left', pageIndex: 0, parked: false, x: 40, y: 42, width: 120, height: 24, zIndex: 1 },
  ]
  const plan = createSegmentMergePlan(segments)

  assert.equal(plan.valid, true)
  assert.deepEqual(plan.ordered.map(segment => segment.id), ['left', 'right', 'next-line'])
  assert.deepEqual(plan.bounds, { x: 40, y: 40, width: 260, height: 90 })
  assert.deepEqual(getMergeSeparator(segments[2], segments[0]), { text: '\t', tabWidthPx: 60 })
  assert.deepEqual(getMergeSeparator(segments[0], segments[1]), { text: '\n', tabWidthPx: 0 })
})

test('rejects merging segments from different pages', () => {
  const plan = createSegmentMergePlan([
    { id: 'one', pageIndex: 0, parked: false, x: 0, y: 0, width: 20, height: 20 },
    { id: 'two', pageIndex: 1, parked: false, x: 0, y: 0, width: 20, height: 20 },
  ])
  assert.deepEqual(plan, { valid: false, reason: 'different-surfaces', ordered: [] })
})
