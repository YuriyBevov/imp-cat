const test = require('node:test')
const assert = require('node:assert/strict')

const { applyLayoutReview, buildLayoutReviewPrompt, normalizeLayoutReview } = require('../lib/layout-review-agent.cjs')

function fixture() {
  const page = { index: 0, widthPx: 794, heightPx: 1123 }
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

test('layout review applies confident geometry and leaves doubtful changes as recommendations', () => {
  const { page, objects } = fixture()
  const scene = { pages: [page], objects }
  const result = applyLayoutReview(scene, [{ pageIndex: 0, adjustments: [
    { objectId: 'stamp-1', x: 300, y: 250, width: 200, height: 50, fontSizePx: 12, textAlign: 'center', confidence: 0.91, reason: 'Visual match' },
    { objectId: 'stamp-1', x: 10, y: 10, width: null, height: null, fontSizePx: null, textAlign: null, confidence: 0.4, reason: 'Uncertain' },
  ] }])
  assert.equal(objects[0].x, 300)
  assert.equal(objects[0].style.fontSizePx, 12)
  assert.equal(result.applied.length, 1)
  assert.equal(result.recommendations.length, 1)
})
