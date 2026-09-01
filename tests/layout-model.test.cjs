const test = require('node:test')
const assert = require('node:assert/strict')
const {
  clampGroupDelta,
  findSegmentOverlaps,
  getPageSliceCount,
  getPageSlicePlacement,
  getSegmentHorizontalGeometry,
  isDocumentSegment,
  rectangleOverlapRatio,
  rectanglesIntersect,
  resolveVerticalOverlaps,
  screenDeltaToDocument,
} = require('../public/layout-model.js')

test('separates visual zoom from document geometry', () => {
  assert.equal(screenDeltaToDocument(100, 2), 50)
  assert.equal(screenDeltaToDocument(100, 0.5), 200)
  assert.equal(screenDeltaToDocument(100, 0.25), 400)
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

test('turns overflowing source content into separate visual pages', () => {
  assert.equal(getPageSliceCount(2244, 1122), 2)
  assert.equal(getPageSliceCount(1122, 1122, 3300), 3)
  assert.deepEqual(getPageSlicePlacement(1280, 80, 1122, 2, 64), {
    sliceIndex: 1,
    y: 158,
  })
  assert.deepEqual(getPageSlicePlacement(1100, 80, 1122, 2, 64), {
    sliceIndex: 1,
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
