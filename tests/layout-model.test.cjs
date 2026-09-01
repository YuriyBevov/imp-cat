const test = require('node:test')
const assert = require('node:assert/strict')
const {
  captureZoomAnchor,
  clampGroupDelta,
  findSegmentOverlaps,
  getFlowPageCount,
  getFlowPagePlacement,
  getPhysicalPageSize,
  getSegmentActionTargets,
  getSegmentHorizontalGeometry,
  getZoomScrollAdjustment,
  isDocumentSegment,
  isPageEmpty,
  layoutSequentialFlowBoxes,
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
