const test = require('node:test')
const assert = require('node:assert/strict')
const { normalizeExportPayload } = require('../lib/validation.cjs')

test('normalizes a valid page and positioned segment', () => {
  const payload = normalizeExportPayload({
    title: 'Sample',
    gridSize: 8,
    pages: [{ id: 'page-1', widthPx: 800, heightPx: 1100 }],
    segments: [{
      id: 'segment-1', pageIndex: 0, text: 'Hello',
      x: 24, y: 40, width: 300, height: 60, rotation: 12,
      style: {
        fontFamily: 'Arial', fontSizePx: 16, fontWeight: 700,
        color: '#112233', textAlign: 'center', lineHeight: 1.4,
      },
    }],
  })
  assert.equal(payload.segments[0].x, 24)
  assert.equal(payload.segments[0].color, '#112233')
  assert.equal(payload.segments[0].alignment, 'center')
  assert.equal(payload.segments[0].fontWeight, 700)
  assert.equal(payload.segments[0].rotation, 12)
  assert.equal(payload.gridSize, 8)
  assert.equal(payload.segments[0].cellId, 'P1:R6:C4')
})

test('rejects duplicate segment IDs and invalid page references', () => {
  const page = [{ id: 'page-1', widthPx: 800, heightPx: 1100 }]
  assert.throws(() => normalizeExportPayload({
    pages: page,
    segments: [
      { id: 'same', pageIndex: 0, text: 'A' },
      { id: 'same', pageIndex: 0, text: 'B' },
    ],
  }), /Повторяющийся ID/)
  assert.throws(() => normalizeExportPayload({
    pages: page,
    segments: [{ id: 'segment', pageIndex: 3, text: 'A' }],
  }), /Некорректная страница/)
})

test('clamps coordinates inside the selected page', () => {
  const payload = normalizeExportPayload({
    pages: [{ widthPx: 800, heightPx: 1100 }],
    segments: [{ id: 'segment', pageIndex: 0, text: 'A', x: 900, y: -10, width: 200, height: 50 }],
  })
  assert.equal(payload.segments[0].x, 600)
  assert.equal(payload.segments[0].y, 0)
})

test('preserves validated rich text runs and falls back when their text diverges', () => {
  const page = [{ widthPx: 800, heightPx: 1100 }]
  const payload = normalizeExportPayload({
    pages: page,
    segments: [{
      id: 'rich', pageIndex: 0, text: 'Обычный\tжирный',
      style: { fontWeight: 400, fontStyle: 'normal' },
      runs: [
        { text: 'Обычный\t', fontWeight: 400, tabWidthPx: 48, tabStopPx: 180 },
        {
          text: 'жирный', fontFamily: 'Times New Roman', fontSizePx: 20,
          fontWeight: 700, fontStyle: 'italic', color: '#334455', backgroundColor: '#ffff00',
        },
      ],
    }, {
      id: 'fallback', pageIndex: 0, text: 'Актуальный текст',
      runs: [{ text: 'Устаревший текст', fontWeight: 700 }],
    }],
  })

  assert.equal(payload.segments[0].runs.length, 2)
  assert.equal(payload.segments[0].runs[0].tabWidthPx, 48)
  assert.equal(payload.segments[0].runs[0].tabStopPx, 180)
  assert.equal(payload.segments[0].runs[1].fontWeight, 700)
  assert.equal(payload.segments[0].runs[1].fontStyle, 'italic')
  assert.equal(payload.segments[0].runs[1].fontFamily, 'Times New Roman')
  assert.equal(payload.segments[0].runs[1].fontSizePx, 20)
  assert.equal(payload.segments[0].runs[1].color, '#334455')
  assert.equal(payload.segments[0].runs[1].backgroundColor, '#ffff00')
  assert.deepEqual(payload.segments[1].runs, [{
    text: 'Актуальный текст', fontFamily: 'Arial', fontSizePx: 16,
    fontWeight: 400, fontStyle: 'normal', color: '#111827', backgroundColor: null,
  }])
})
