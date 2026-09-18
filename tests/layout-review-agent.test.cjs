const test = require('node:test')
const assert = require('node:assert/strict')

const { applyLayoutReview, buildLayoutReviewPrompt, normalizeLayoutReview } = require('../lib/layout-review-agent.cjs')

function fixture() {
  const page = { index: 0, widthPx: 794, heightPx: 1123, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }
  const objects = [{
    id: 'stamp-1', pageIndex: 0, type: 'stamp', sourceText: 'STAMP', translation: '/Штамп: STAMP/',
    x: 100, y: 100, width: 180, height: 40,
    style: { fontSizePx: 14, fontWeight: 400, fontStyle: 'italic', textAlign: 'left' },
  }]
  return { page, objects }
}

test('layout review normalizes only existing object IDs', () => {
  const { page, objects } = fixture()
  const review = normalizeLayoutReview({
    summary: 'Stamp is displaced',
    pages: [{ pageIndex: 0, similarity: 0.7, findings: ['stamp'], adjustments: [
      { objectId: 'stamp-1', x: 300, y: 250, width: null, height: null, fontSizePx: 12, textAlign: 'center', confidence: 0.9, reason: 'Align with original' },
      { objectId: 'unknown', x: 1, y: 1, width: null, height: null, fontSizePx: null, textAlign: null, confidence: 1, reason: 'invalid' },
    ] }],
  }, page, objects)
  assert.equal(review.adjustments.length, 1)
  assert.equal(review.adjustments[0].objectId, 'stamp-1')
  assert.match(buildLayoutReviewPrompt(page, objects), /ОРИГИНАЛ|оригинал/i)
})

test('layout review preserves precise dimensions and recognizes continuation pages', () => {
  const { page, objects } = fixture()
  Object.assign(objects[0], { manualPosition: false, manualWidth: false, manualHeight: false, translation: 'Коротко' })
  page.isAdded = true
  assert.match(buildLayoutReviewPrompt(page, objects), /страница продолжения/)
  const result = applyLayoutReview({ layoutInitializationVersion: 2, pages: [page], objects }, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 100.5, y: 120.5, width: 180.5, height: 40.5, confidence: .95, reason: 'Match source' },
  ] }])
  assert.equal(result.applied.length, 1)
  assert.equal(objects[0].width, 180.5)
  assert.equal(objects[0].height, 40.5)
  assert.equal(objects[0].x, 100.5)
})

test('layout review snaps confident position and typography while preserving legacy user-controlled size', () => {
  const { page, objects } = fixture()
  const scene = { pages: [page], objects }
  const result = applyLayoutReview(scene, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 300, y: 250, width: 200, height: 50, fontSizePx: 12, textAlign: 'center', confidence: 0.91, reason: 'Visual match' },
    { objectId: 'stamp-1', x: 10, y: 10, width: null, height: null, fontSizePx: null, textAlign: null, confidence: 0.4, reason: 'Uncertain' },
  ] }])
  assert.equal(objects[0].x, 295)
  assert.equal(objects[0].y, 244)
  assert.equal(objects[0].width, 180)
  assert.equal(objects[0].height, 40)
  assert.equal(objects[0].style.fontSizePx, 12)
  assert.equal(result.applied.length, 1)
  assert.equal(result.recommendations.length, 2)
  assert.match(result.recommendations[0].reason, /ручные настройки/)
})

test('layout review applies proposed size and fits translated text when dimensions are automatic', () => {
  const { page, objects } = fixture()
  Object.assign(objects[0], { manualPosition: false, manualWidth: false, manualHeight: false, translation: 'Очень длинное неразрывноеслово' })
  const result = applyLayoutReview({ pages: [page], objects }, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 300, y: 250, width: 60, height: 12, fontSizePx: 12, textAlign: 'center', confidence: 0.91, reason: 'Visual match' },
  ] }])
  assert.ok(objects[0].width >= 110)
  assert.ok(objects[0].height >= 17)
  assert.equal(objects[0].x, 295)
  assert.equal(result.applied.length, 1)
})

test('layout review keeps manual position and typography locked', () => {
  const { page, objects } = fixture()
  Object.assign(objects[0], { manualPosition: true, manualWidth: false, manualHeight: false, manualTypography: true })
  const result = applyLayoutReview({ pages: [page], objects }, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 300, y: 250, width: 200, height: 50, fontSizePx: 12, textAlign: 'center', confidence: 0.91, reason: 'Visual match' },
  ] }])
  assert.equal(objects[0].x, 100)
  assert.equal(objects[0].y, 100)
  assert.equal(objects[0].style.fontSizePx, 14)
  assert.equal(objects[0].style.textAlign, 'left')
  assert.match(result.recommendations[0].reason, /положение, типографика/)
})

test('layout review moves an automatic candidate to free grid cells instead of overlapping', () => {
  const { page, objects } = fixture()
  Object.assign(objects[0], { manualPosition: false, manualWidth: false, manualHeight: false })
  objects.push({
    ...structuredClone(objects[0]), id: 'fixed-2', x: 295, y: 244, width: 204, height: 51,
    manualPosition: true, manualWidth: true, manualHeight: true,
  })
  applyLayoutReview({ pages: [page], objects }, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 300, y: 250, width: 200, height: 50, fontSizePx: null, textAlign: null, confidence: 0.91, reason: 'Move' },
  ] }])
  const [moved, fixed] = objects
  const overlaps = moved.x < fixed.x + fixed.width && moved.x + moved.width > fixed.x
    && moved.y < fixed.y + fixed.height && moved.y + moved.height > fixed.y
  assert.equal(overlaps, false)
})

test('layout review uses the same fixed 17 px grid on a landscape workspace', () => {
  const { page, objects } = fixture()
  Object.assign(page, {
    widthPx: 1122.81,
    heightPx: 794,
    contentBounds: { x: 40, y: 40, width: 1020, height: 680 },
    gridAvailableBounds: { width: 1042.81, height: 714 },
  })
  Object.assign(objects[0], { manualPosition: false, manualWidth: true, manualHeight: true })
  applyLayoutReview({ layoutInitializationVersion: 1, pages: [page], objects }, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 111, y: 111, width: null, height: null, confidence: .95, reason: 'Align' },
  ] }])
  assert.equal(objects[0].x, 108)
  assert.equal(objects[0].y, 108)
})
