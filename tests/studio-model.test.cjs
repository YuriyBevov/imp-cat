const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildScene,
  buildOcrReview,
  classifyText,
  findMemoryMatches,
  validateScene,
} = require('../lib/studio-model.cjs')
const { createTranslationBatches, normalizeScene, parseJsonArray } = require('../lib/studio.cjs')

function analysisFixture() {
  return {
    pages: [{
      index: 0,
      width: 1_600,
      height: 2_260,
      lines: [
        { text: 'POWER OF ATTORNEY', confidence: .98, x: 400, y: 100, width: 800, height: 60 },
        { text: 'First line of the body', confidence: .96, x: 160, y: 300, width: 1_100, height: 36 },
        { text: 'continues on the next line.', confidence: .95, x: 160, y: 345, width: 1_050, height: 36 },
        { text: 'Signature', confidence: .72, x: 1_180, y: 2_000, width: 220, height: 32 },
      ],
    }],
  }
}

test('buildScene preserves page ratio, groups body lines, and classifies service labels', () => {
  const scene = buildScene(analysisFixture(), { documentId: 'a'.repeat(32), title: 'Fixture' })
  assert.equal(scene.gridSize, 8)
  assert.equal(scene.snapToGrid, true)
  assert.equal(scene.pages.length, 1)
  assert.equal(scene.pages[0].widthPx, 794)
  assert.ok(Math.abs(scene.pages[0].heightPx - 1121.53) < .1)
  assert.equal(scene.objects.length, 3)
  assert.match(scene.objects[1].sourceText, /First line[\s\S]*continues/)
  assert.equal(scene.objects[2].type, 'signature')
  assert.equal(scene.objects[2].translation, '/Подпись/')
})

test('buildScene fits standalone raster sources onto an undistorted A4 workspace', () => {
  const scene = buildScene(analysisFixture(), { documentId: 'e'.repeat(32), fitRasterToA4: true })
  const page = scene.pages[0]
  assert.equal(page.widthPx, 794)
  assert.equal(page.heightPx, 1123)
  assert.ok(page.sourceFrame.x >= 39)
  assert.ok(page.sourceFrame.y > 39)
  assert.ok(Math.abs(page.sourceFrame.width / page.sourceFrame.height - 1600 / 2260) < .001)
})

test('service classification covers stamps, seals, and signatures', () => {
  assert.equal(classifyText('/Штамп: № 18871/'), 'stamp')
  assert.equal(classifyText('/Круглая печать/'), 'seal')
  assert.equal(classifyText('İmza'), 'signature')
  assert.equal(classifyText('Обычный абзац'), 'text')
})

test('translation memory prioritizes exact matches and supports fuzzy matches', () => {
  const entries = [
    { id: 'one', sourceText: 'Power of attorney', translation: 'Доверенность', targetLanguage: 'ru', updatedAt: '2026-01-01' },
    { id: 'two', sourceText: 'Attorney legal powers', translation: 'Полномочия поверенного', targetLanguage: 'ru', updatedAt: '2026-01-02' },
  ]
  const exact = findMemoryMatches(entries, 'Power of attorney', 'ru')
  assert.equal(exact[0].id, 'one')
  assert.equal(exact[0].score, 1)
  const fuzzy = findMemoryMatches(entries, 'legal powers of attorney', 'ru')
  assert.ok(fuzzy.length >= 1)
})

test('QA reports untranslated, low-confidence, outside, overflow, and overlap issues', () => {
  const scene = buildScene(analysisFixture(), { documentId: 'b'.repeat(32) })
  scene.objects[0].x = -5
  scene.objects[0].width = 30
  scene.objects[0].height = 12
  scene.objects[1].x = scene.objects[0].x
  scene.objects[1].y = scene.objects[0].y
  const report = validateScene(scene)
  const codes = new Set(report.warnings.map(item => item.code))
  assert.ok(codes.has('missing-translation'))
  assert.ok(codes.has('low-confidence'))
  assert.ok(codes.has('outside-page'))
  assert.ok(codes.has('text-overflow'))
  assert.ok(codes.has('overlap'))
})

test('normalizeScene constrains data and restores server-owned image URLs', () => {
  const input = buildScene(analysisFixture(), { documentId: 'c'.repeat(32) })
  input.pages[0].imageUrl = 'https://invalid.example/source.png'
  input.objects[0].style.color = 'javascript:red'
  const normalized = normalizeScene(input, 'd'.repeat(32), 'Title')
  assert.equal(normalized.pages[0].imageUrl, `/api/studio/documents/${'d'.repeat(32)}/pages/0/image`)
  assert.equal(normalized.objects[0].style.color, '#111827')
  assert.equal(normalized.gridSize, 8)
  assert.equal(normalized.snapToGrid, true)
})

test('OCR review flags low-confidence alternatives, joined words, and sparse pages', () => {
  const scene = buildScene(analysisFixture(), { documentId: 'f'.repeat(32) })
  scene.objects[0].sourceText = 'PowerOf attorney'
  scene.objects[0].confidence = .7
  scene.objects[0].ocrAlternatives = ['Power of attorney']
  scene.pages.push({ index: 1, widthPx: 794, heightPx: 1123 })
  const report = buildOcrReview(scene)
  const kinds = new Set(report.suggestions.map(item => item.kind))
  assert.ok(kinds.has('ocr-alternative'))
  assert.ok(kinds.has('joined-words'))
  assert.ok(kinds.has('page-completeness'))
  assert.ok(report.counts.applicable >= 2)
})

test('OCR review catches contextual university and law misrecognitions', () => {
  const scene = buildScene(analysisFixture(), { documentId: '7'.repeat(32) })
  scene.objects[0].sourceText = 'Hatersity uf New Hampshire'
  scene.objects[1].sourceText = 'Franklin Pierce School of tau'
  const report = buildOcrReview(scene)
  const proposed = report.suggestions.map(item => item.suggestedText)
  assert.ok(proposed.includes('University of New Hampshire'))
  assert.ok(proposed.includes('Franklin Pierce School of Law'))
})

test('normalizeScene preserves safe inline text styles and OCR alternatives', () => {
  const input = buildScene(analysisFixture(), { documentId: '9'.repeat(32) })
  input.objects[0].sourceTextStyles = [{ start: 0, end: 5, fontSizePx: 22, fontWeight: 700 }]
  input.objects[0].ocrAlternatives = ['POWER 0F ATTORNEY']
  const normalized = normalizeScene(input, '8'.repeat(32), 'Title')
  assert.deepEqual(normalized.objects[0].sourceTextStyles[0], { start: 0, end: 5, fontSizePx: 22, fontWeight: 700 })
  assert.deepEqual(normalized.objects[0].ocrAlternatives, ['POWER 0F ATTORNEY'])
})

test('parseJsonArray accepts plain and fenced provider responses', () => {
  assert.deepEqual(parseJsonArray('[{"id":"1","translatedText":"Да"}]')[0], { id: '1', translatedText: 'Да' })
  assert.equal(parseJsonArray('```json\n[{"id":"2","translatedText":"Нет"}]\n```')[0].id, '2')
  assert.throws(() => parseJsonArray('not json'), /некорректный JSON/)
})

test('translation batches respect object and character limits', () => {
  const objects = Array.from({ length: 25 }, (_, index) => ({ id: String(index), sourceText: 'x'.repeat(3_000) }))
  const batches = createTranslationBatches(objects)
  assert.deepEqual(batches.map(batch => batch.length), [16, 9])
  assert.ok(batches.every(batch => batch.reduce((sum, item) => sum + item.sourceText.length, 0) <= 50_000))
})
