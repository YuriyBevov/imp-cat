const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildScene,
  buildSceneFromAgent,
  buildTableStructures,
  classifyText,
  fitAgentFontSizePx,
  findMemoryMatches,
  formatServiceTranslation,
  minimumA4PageHeight,
  pageContentBounds,
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
  assert.equal(scene.gridDensity, 'xs')
  assert.equal(scene.snapToGrid, true)
  assert.equal(scene.showSegmentTypeLabels, true)
  assert.equal(scene.workflowVersion, 2)
  assert.equal(scene.workflowStage, 1)
  assert.equal(scene.layoutInitializationVersion, 0)
  assert.equal(scene.pages.length, 1)
  assert.equal(scene.pages[0].widthPx, 794)
  assert.equal(scene.pages[0].heightPx, 1121.53)
  assert.equal(scene.objects.length, 3)
  assert.match(scene.objects[1].sourceText, /First line[\s\S]*continues/)
  assert.equal(scene.objects[2].type, 'signature')
  assert.equal(scene.objects[2].translation, '/Подпись/')
  assert.deepEqual(scene.pages[0].contentBounds, pageContentBounds(scene.pages[0].widthPx, scene.pages[0].heightPx))
})

test('structural table model groups positioned cells by page and table id', () => {
  const tables = buildTableStructures([
    { id: 'a', pageIndex: 0, type: 'table_cell', tableId: 'prices', rowIndex: 0, columnIndex: 0, rowSpan: 1, columnSpan: 1, x: 20, y: 40, width: 100, height: 30 },
    { id: 'b', pageIndex: 0, type: 'table_cell', tableId: 'prices', rowIndex: 0, columnIndex: 1, rowSpan: 1, columnSpan: 1, x: 120, y: 40, width: 180, height: 30 },
    { id: 'c', pageIndex: 0, type: 'table_cell', tableId: 'prices', rowIndex: 1, columnIndex: 0, rowSpan: 1, columnSpan: 2, x: 20, y: 70, width: 280, height: 35 },
  ])
  assert.equal(tables.length, 1)
  assert.equal(tables[0].rowCount, 2)
  assert.equal(tables[0].columnCount, 2)
  assert.deepEqual(tables[0].cells.map(cell => cell.objectId), ['a', 'b', 'c'])
})

test('merged tab-delimited table rows are recovered as individual physical cells', () => {
  const cell = (segmentId, sourceText, pageIndex, columnIndex, region) => ({
    segmentId, type: 'table_cell', sourceText, readingOrder: columnIndex,
    flowGroup: `page-${pageIndex + 1}-table-1`, tableId: `table-${pageIndex + 1}`,
    rowIndex: 0, columnIndex, rowSpan: 1, columnSpan: 1, regions: [region],
    style: { fontFamily: 'Arial', fontSizePt: 10, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
    confidence: .98, needsReview: false, notes: '',
  })
  const scene = buildSceneFromAgent({
    pages: [
      { index: 0, width: 1600, height: 900, segments: [cell('merged', 'First\tSecond', 0, 0, { x: .1, y: .2, width: .8, height: .1 })] },
      { index: 1, width: 1600, height: 900, segments: [
        cell('template-a', 'First', 1, 0, { x: .1, y: .2, width: .25, height: .1 }),
        cell('template-b', 'Second', 1, 1, { x: .35, y: .2, width: .55, height: .1 }),
      ] },
    ],
  }, { documentId: 'c'.repeat(32) })
  const recovered = scene.objects.filter(object => object.pageIndex === 0)
  assert.deepEqual(recovered.map(object => object.sourceText), ['First', 'Second'])
  assert.deepEqual(recovered.map(object => object.columnIndex), [0, 1])
  assert.ok(Math.abs(recovered[0].x + recovered[0].width - recovered[1].x) < .01)
  assert.equal(scene.tables[0].columnCount, 2)
  assert.equal(scene.tableSegmentationVersion, 1)
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

test('buildSceneFromAgent preserves normalized geometry and labels special objects without deleting readable text', () => {
  const scene = buildSceneFromAgent({
    engine: 'Codex Document Agent (gpt-5.6-sol)',
    generatedAt: '2026-09-04T00:00:00.000Z',
    languages: ['tr'],
    pages: [{
      index: 0, width: 1200, height: 1600, image: 'page-001.png', languages: ['tr'],
      segments: [{
        segmentId: 'stamp-1', type: 'stamp', sourceText: 'TÜRKİYE CUMHURİYETİ',
        readingOrder: 3, flowGroup: 'page-1-stamps',
        regions: [{ x: .6, y: .1, width: .25, height: .12 }],
        style: { fontFamily: 'Times New Roman', fontSizePt: 9, fontWeight: 700, fontStyle: 'italic', textAlign: 'center', lineHeight: 1.1, color: '#112233' },
        confidence: .91, needsReview: false, notes: 'Прямоугольный штамп',
      }, {
        segmentId: 'signature-1', type: 'signature', sourceText: '',
        readingOrder: 4, flowGroup: 'page-1-signatures',
        regions: [{ x: .2, y: .8, width: .18, height: .05 }],
        style: { fontFamily: 'Arial', fontSizePt: 10, fontWeight: 400, fontStyle: 'italic', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
        confidence: .5, needsReview: true, notes: 'Текст неразборчив',
      }],
    }],
  }, { documentId: '1'.repeat(32), title: 'Agent fixture' })
  assert.equal(scene.pages[0].heightPx, 1058.67)
  assert.ok(Math.abs(scene.objects[0].x - 476.4) < .01)
  assert.ok(Math.abs(scene.objects[0].width - 198.5) < .01)
  assert.equal(scene.objects[0].translation, '')
  assert.equal(scene.objects[0].sourceText, 'TÜRKİYE CUMHURİYETİ')
  assert.equal(scene.objects[0].style.fontFamily, 'Times New Roman')
  assert.equal(scene.objects[0].style.color, '#112233')
  assert.equal(scene.objects[0].style.lineHeight, 1.1)
  assert.equal(scene.objects[0].style.fontWeight, 700)
  assert.ok(scene.objects[0].style.fontSizePx <= 14)
  assert.equal(scene.objects[1].translation, '/Подпись/')
  assert.equal(scene.objects[1].status, 'needs-review')
  assert.ok(scene.objects.every(object => object.manualPosition === false && object.manualWidth === false && object.manualHeight === false && object.manualTypography === false))
  assert.equal(scene.recognition.mode, 'codex')
})

test('agent font fitting caps oversized typography to the recognized rectangle', () => {
  const fitted = fitAgentFontSizePx('University of New Hampshire', 78, { width: 535, height: 90 }, 1, true)
  assert.ok(fitted < 45)
  assert.ok(fitted >= 6)
  const unchanged = fitAgentFontSizePx('Date', 12, { width: 120, height: 30 }, 1.2)
  assert.ok(Math.abs(unchanged - 12) < .01)
})

test('service classification covers stamps, seals, and signatures', () => {
  assert.equal(classifyText('/Штамп: № 18871/'), 'stamp')
  assert.equal(classifyText('/Круглая печать/'), 'seal')
  assert.equal(classifyText('İmza'), 'signature')
  assert.equal(classifyText('Обычный абзац'), 'text')
  assert.equal(formatServiceTranslation('stamp', '№ 18871'), '/Штамп: № 18871/')
  assert.equal(formatServiceTranslation('seal', '/Печать: Турецкая Республика/'), '/Печать: Турецкая Республика/')
  assert.equal(formatServiceTranslation('signature', 'графический росчерк'), '/Подпись/')
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

test('QA keeps empty structural table cells without reporting missing content or translation', () => {
  const page = { index: 0, widthPx: 794, heightPx: 561, contentBounds: { x: 28, y: 28, width: 738, height: 505 } }
  const emptyCell = {
    id: 'empty-cell', pageIndex: 0, type: 'table_cell', tableId: 'table', rowIndex: 1, columnIndex: 2,
    sourceText: '', translation: '', confidence: 1, x: 100, y: 100, width: 80, height: 24,
    style: { fontSizePx: 12, lineHeight: 1.2 },
  }
  const report = validateScene({ pages: [page], objects: [emptyCell] })
  assert.equal(report.warnings.some(item => item.objectIds.includes('empty-cell')), false)
})

test('normalizeScene constrains data and restores server-owned image URLs', () => {
  const input = buildScene(analysisFixture(), { documentId: 'c'.repeat(32) })
  input.pages[0].imageUrl = 'https://invalid.example/source.png'
  input.objects[0].style.fontFamily = 'Times New Roman'
  input.objects[0].style.color = 'javascript:red'
  input.objects[0].x = -500
  input.objects[0].y = 5_000
  input.objects[0].width = 5_000
  input.objects[0].height = 5_000
  input.snapToGrid = false
  input.acceptedQaWarnings = ['qa-valid', 'qa-valid', '', null, 'x'.repeat(200)]
  input.workflowStage = 99
  const normalized = normalizeScene(input, 'd'.repeat(32), 'Title')
  assert.equal(normalized.pages[0].imageUrl, `/api/studio/documents/${'d'.repeat(32)}/pages/0/image`)
  assert.equal(normalized.objects[0].style.color, '#000000')
  assert.equal(normalized.objects[0].style.fontFamily, 'Times New Roman')
  assert.equal(normalized.gridSize, 8)
  assert.equal(normalized.gridDensity, 'xs')
  assert.deepEqual(normalized.pages[0].contentBounds, pageContentBounds(normalized.pages[0].widthPx, normalized.pages[0].heightPx))
  assert.equal(normalized.objects[0].manualWidth, false)
  assert.equal(normalized.objects[0].manualHeight, false)
  assert.equal(normalized.objects[0].manualPosition, false)
  assert.equal(normalized.objects[0].manualTypography, false)
  assert.equal(normalized.objects[0].x, normalized.pages[0].contentBounds.x)
  assert.equal(normalized.objects[0].y, normalized.pages[0].contentBounds.y)
  assert.equal(normalized.objects[0].width, normalized.pages[0].contentBounds.width)
  assert.equal(normalized.objects[0].height, normalized.pages[0].contentBounds.height)
  assert.equal(normalized.snapToGrid, true)
  assert.equal(normalized.workflowVersion, 2)
  assert.equal(normalized.workflowStage, 4)
  assert.equal(normalized.translationCompleted, true)
  assert.equal(normalized.layoutInitializationVersion, 0)
  assert.deepEqual(normalized.batchRevisionChat, [])
  assert.deepEqual(normalized.acceptedQaWarnings, ['qa-valid', 'x'.repeat(120)])
  assert.ok(normalized.objects.every(object => Array.isArray(object.revisionChat)))
})

test('normalizeScene migrates the removed translation stage without shifting current scenes', () => {
  const legacy = buildScene(analysisFixture(), { documentId: '7'.repeat(32) })
  delete legacy.workflowVersion
  legacy.workflowStage = 3
  assert.equal(normalizeScene(legacy, '7'.repeat(32), 'Legacy').workflowStage, 2)

  const current = buildScene(analysisFixture(), { documentId: '8'.repeat(32) })
  current.workflowStage = 3
  assert.equal(normalizeScene(current, '8'.repeat(32), 'Current').workflowStage, 3)

  const translated = buildScene(analysisFixture(), { documentId: '9'.repeat(32) })
  translated.translationCompleted = true
  translated.workflowStage = 1
  assert.equal(normalizeScene(translated, '9'.repeat(32), 'Translated').translationCompleted, true)
})

test('normalizeScene preserves explicit layout initialization and safely migrates older stages', () => {
  const pending = buildScene(analysisFixture(), { documentId: '4'.repeat(32) })
  pending.workflowStage = 2
  assert.equal(normalizeScene(pending, '4'.repeat(32), 'Pending').layoutInitializationVersion, 0)

  const existingLayout = buildScene(analysisFixture(), { documentId: '5'.repeat(32) })
  existingLayout.workflowStage = 3
  delete existingLayout.layoutInitializationVersion
  assert.equal(normalizeScene(existingLayout, '5'.repeat(32), 'Existing').layoutInitializationVersion, 1)

  existingLayout.layoutInitializationVersion = 0
  assert.equal(normalizeScene(existingLayout, '5'.repeat(32), 'Explicit pending').layoutInitializationVersion, 0)
  existingLayout.layoutInitializationVersion = 2
  existingLayout.pages.push({ ...existingLayout.pages[0], index: 1, isAdded: true, sourcePageIndex: null, imageUrl: null, layoutContinuation: true })
  Object.assign(existingLayout.objects[0], { pageIndex: 1, layoutSourcePageIndex: 0, layoutSourceOrder: 1, layoutWidthLimit: 187.5, layoutContentKey: '42:12345' })
  const restored = normalizeScene(existingLayout, '5'.repeat(32), 'Paginated')
  assert.equal(restored.layoutInitializationVersion, 2)
  assert.equal(restored.pages[1].layoutContinuation, true)
  assert.equal(restored.pages[1].imageUrl, null)
  assert.equal(restored.objects[0].layoutSourcePageIndex, 0)
  assert.equal(restored.objects[0].layoutWidthLimit, 187.5)
  assert.equal(restored.objects[0].layoutContentKey, '42:12345')
})

test('normalizeScene preserves the document-specific segment type label preference', () => {
  const input = buildScene(analysisFixture(), { documentId: '6'.repeat(32) })
  input.showSegmentTypeLabels = false
  assert.equal(normalizeScene(input, '6'.repeat(32), 'Hidden labels').showSegmentTypeLabels, false)

  delete input.showSegmentTypeLabels
  assert.equal(normalizeScene(input, '6'.repeat(32), 'Default labels').showSegmentTypeLabels, true)
})

test('normalizeScene preserves legacy dimensions that differ from original bounds', () => {
  const input = buildScene(analysisFixture(), { documentId: 'e'.repeat(32) })
  const object = input.objects[0]
  delete object.manualWidth
  delete object.manualHeight
  delete object.manualPosition
  object.width += 30
  object.height += 20
  object.x += 20
  const normalized = normalizeScene(input, 'e'.repeat(32), 'Legacy')
  assert.equal(normalized.objects[0].manualWidth, true)
  assert.equal(normalized.objects[0].manualHeight, true)
  assert.equal(normalized.objects[0].manualPosition, true)
})

test('source pages preserve their physical aspect ratio through scene normalization', () => {
  const scene = buildScene({
    pages: [{ index: 0, width: 1600, height: 1200, lines: [] }],
  }, { documentId: 'f'.repeat(32) })
  assert.equal(scene.pages[0].heightPx, 595.5)
  assert.equal(scene.pages[0].sourceFrame.width, 794)
  assert.equal(scene.pages[0].sourceFrame.height, 595.5)

  const normalized = normalizeScene({
    pages: [{
      index: 0, sourcePageIndex: 0, widthPx: 794, heightPx: 600,
      sourceWidth: 1600, sourceHeight: 1200,
      sourceFrame: { x: 0, y: 0, width: 794, height: 595.5 },
    }],
    objects: [],
  }, 'f'.repeat(32), 'Short page')
  assert.equal(normalized.pages[0].heightPx, 595.5)
  assert.equal(normalized.pages[0].sourceFrame.height, 595.5)
  assert.deepEqual(normalized.pages[0].contentBounds, pageContentBounds(794, 595.5))
})

test('normalizeScene preserves a reduced content-area height inside the A4 page', () => {
  const normalized = normalizeScene({
    pages: [{
      index: 0, sourcePageIndex: 0, widthPx: 794, heightPx: 1123,
      contentBounds: { x: 40, y: 40, width: 714, height: 520 },
    }],
    objects: [],
  }, '7'.repeat(32), 'Reduced content area')
  assert.deepEqual(normalized.pages[0].contentBounds, { x: 40, y: 40, width: 714, height: 520 })
})

test('normalizeScene preserves original page images around an inserted blank page', () => {
  const documentId = 'e'.repeat(32)
  const input = buildScene({ pages: [analysisFixture().pages[0], { ...analysisFixture().pages[0], index: 1 }] }, { documentId })
  const blank = {
    ...input.pages[0], index: 1, sourcePageIndex: null, isAdded: true, imageUrl: null,
  }
  input.pages.splice(1, 0, blank)
  input.pages[2].index = 2
  input.pages[2].sourcePageIndex = 1
  const normalized = normalizeScene(input, documentId, 'Title')
  assert.equal(normalized.pages[0].imageUrl, `/api/studio/documents/${documentId}/pages/0/image`)
  assert.equal(normalized.pages[1].imageUrl, null)
  assert.equal(normalized.pages[1].sourcePageIndex, null)
  assert.equal(normalized.pages[1].isAdded, true)
  assert.equal(normalized.pages[2].imageUrl, `/api/studio/documents/${documentId}/pages/1/image`)
})

test('normalizeScene preserves safe inline text styles', () => {
  const input = buildScene(analysisFixture(), { documentId: '9'.repeat(32) })
  input.objects[0].sourceTextStyles = [{ start: 0, end: 5, fontFamily: 'Cambria', fontSizePx: 22, fontWeight: 700, color: '#ff0000' }]
  const normalized = normalizeScene(input, '8'.repeat(32), 'Title')
  assert.deepEqual(normalized.objects[0].sourceTextStyles[0], { start: 0, end: 5, fontSizePx: 22, fontWeight: 700, fontFamily: 'Cambria', color: '#FF0000' })
})

test('normalizeScene preserves internal translation units and derives the exported translation', () => {
  const input = buildScene(analysisFixture(), { documentId: '7'.repeat(32) })
  const object = input.objects[1]
  object.sourceText = 'First sentence. Second sentence.'
  object.translation = ''
  object.translationUnits = [
    { id: 'unit-1', sourceText: 'First sentence.', separatorAfter: ' ', translation: 'Первое предложение.', status: 'machine-translated' },
    { id: 'unit-2', sourceText: 'Second sentence.', separatorAfter: '', translation: 'Второе предложение.', status: 'approved', memoryEntryId: 'entry-2' },
  ]
  const normalized = normalizeScene(input, '6'.repeat(32), 'Title')
  assert.equal(normalized.objects[1].translationUnits.length, 2)
  assert.equal(normalized.objects[1].translation, 'Первое предложение. Второе предложение.')
  assert.equal(normalized.objects[1].translationUnits[1].memoryEntryId, 'entry-2')
})

test('parseJsonArray accepts plain and fenced provider responses', () => {
  assert.deepEqual(parseJsonArray('[{"id":"1","translatedText":"Да"}]')[0], { id: '1', translatedText: 'Да' })
  assert.equal(parseJsonArray('{"revisions":[{"id":"3","translatedText":"Исправлено"}]}')[0].id, '3')
  assert.equal(parseJsonArray('```json\n[{"id":"2","translatedText":"Нет"}]\n```')[0].id, '2')
  assert.throws(() => parseJsonArray('not json'), /некорректный JSON/)
})

test('translation batches respect object and character limits', () => {
  const objects = Array.from({ length: 25 }, (_, index) => ({ id: String(index), sourceText: 'x'.repeat(3_000) }))
  const batches = createTranslationBatches(objects)
  assert.deepEqual(batches.map(batch => batch.length), [16, 9])
  assert.ok(batches.every(batch => batch.reduce((sum, item) => sum + item.sourceText.length, 0) <= 50_000))
})
