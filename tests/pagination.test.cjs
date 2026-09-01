const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getWorkspacePageHeight,
  findSegmentOverlaps,
  paginatePages,
  placeSegment,
  rectangleOverlapRatio,
  resolveVerticalOverlaps,
  screenDeltaToDocument,
  MAX_WORD_PAGE_SIZE,
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

test('expands the workspace without cutting off moved segments', () => {
  assert.equal(getWorkspacePageHeight(1122, 2, 900, 4), 2244)
  assert.equal(getWorkspacePageHeight(1122, 1, 1500, 4), 1504)
})

test('splits one long DOM page into Word-sized virtual pages', () => {
  const pagination = paginatePages([
    { id: 'source-page-1', width: 794, height: 9700, nominalHeight: 1122 },
  ])

  assert.equal(pagination.totalPages, 9)
  assert.equal(pagination.sourcePages[0].sliceCount, 9)

  const placement = placeSegment({ pageIndex: 0, x: 64, y: 3500 }, pagination)
  assert.equal(placement.pageIndex, 3)
  assert.equal(placement.x, 64)
  assert.equal(placement.y, 134)
})

test('keeps explicit pages separate and respects the Word page-size limit', () => {
  const pagination = paginatePages([
    { id: 'source-page-1', height: 1122, nominalHeight: 1122 },
    { id: 'source-page-2', height: 1122, nominalHeight: 9999 },
  ])

  assert.equal(pagination.totalPages, 2)
  assert.equal(pagination.sourcePages[1].nominalHeight, MAX_WORD_PAGE_SIZE)
  assert.equal(placeSegment({ pageIndex: 1, x: 10, y: 80 }, pagination).pageIndex, 1)
})

test('moves a tiny tail anchor to the top of the following virtual page', () => {
  const pagination = paginatePages([
    { id: 'source-page-1', height: 2244, nominalHeight: 1122 },
  ])
  const placement = placeSegment({ pageIndex: 0, x: 0, y: 1114 }, pagination, 16)

  assert.equal(placement.pageIndex, 1)
  assert.equal(placement.y, 0)
})
