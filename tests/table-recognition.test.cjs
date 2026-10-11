const test = require('node:test')
const assert = require('node:assert/strict')
const { recoverDelimitedTableSegments } = require('../lib/table-recognition.cjs')
const { buildSceneFromAgent, validateScene } = require('../lib/studio-model.cjs')
const { normalizeScene } = require('../lib/studio.cjs')

function segment(id, text, region, overrides = {}) {
  return { segmentId: id, type: 'table', sourceText: text, flowGroup: 'statement', readingOrder: 1,
    regions: [region], confidence: .98, needsReview: false, notes: '',
    style: { fontFamily: 'Arial', fontSizePt: 8, fontWeight: 400, textAlign: 'left', lineHeight: 1.2, color: '#000000' }, ...overrides }
}

function statementAnalysis() {
  const labels = ['编号 / No.', '说明 / Details', '金额 / Amount']
  return { pages: [0, 1, 2].map(index => ({ index, width: 1600, height: 1131,
    segments: index < 2 ? [
      segment(`title-${index}`, 'Bank statement', { x: .1, y: .05, width: .8, height: .05 }, { type: 'text', flowGroup: 'header', readingOrder: 0 }),
      segment(`header-${index}`, labels.join('\n'), { x: .1, y: .2, width: .8, height: .04 }),
      segment(`body-${index}`, '1 | Payment | \n2 |  | 100.00', { x: .1, y: .24, width: .8, height: .12 }, { readingOrder: 2 }),
    ] : labels.map((label, columnIndex) => segment(`valid-${columnIndex}`, label.replace(' / ', '\n'), {
      x: [.1, .18, .66][columnIndex], y: .2, width: [.08, .48, .24][columnIndex], height: .04,
    }, { type: 'table_cell', tableId: 'valid-table', rowIndex: 0, columnIndex, rowSpan: 1, columnSpan: 1 })) })) }
}

test('fresh recognition reconstructs pipe rows and horizontal headers using a matching later-page table', () => {
  const input = statementAnalysis()
  const untouched = structuredClone(input)
  const recovered = recoverDelimitedTableSegments(input)
  assert.deepEqual(input, untouched)
  for (const page of recovered.pages.slice(0, 2)) {
    const cells = page.segments.filter(item => item.type === 'table_cell')
    assert.equal(cells.length, 9)
    assert.deepEqual(cells.map(cell => cell.sourceText), ['编号 / No.', '说明 / Details', '金额 / Amount', '1', 'Payment', '', '2', '', '100.00'])
    assert.deepEqual(cells.map(cell => [cell.rowIndex, cell.columnIndex]), [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]])
    assert.ok(cells.every(cell => !cell.needsReview))
    for (let row = 0; row < 3; row += 1) {
      const tracks = cells.filter(cell => cell.rowIndex === row).map(cell => cell.regions[0])
      assert.equal(new Set(tracks.map(track => track.y)).size, 1)
      for (let col = 0; col < 2; col += 1) assert.ok(Math.abs(tracks[col].x + tracks[col].width - tracks[col + 1].x) < 1e-8)
      assert.ok(Math.abs(tracks[1].width / tracks[0].width - 6) < 1e-8)
    }
  }
  assert.deepEqual(recovered.pages[2], input.pages[2])
  assert.equal(recovered.pages[2].segments[0], input.pages[2].segments[0])
  assert.deepEqual(recoverDelimitedTableSegments(recovered), recovered)
  const scene = buildSceneFromAgent(input, { documentId: 'a'.repeat(32) })
  assert.equal(scene.tables.length, 3)
  assert.deepEqual(scene.tables.map(table => [table.rowCount, table.columnCount]), [[3, 3], [3, 3], [1, 3]])
  assert.deepEqual(scene.objects.filter(object => object.pageIndex === 2), buildSceneFromAgent({ pages: [input.pages[2]] }).objects)
})

test('tab-separated tables recover without a reference but explicitly require a width check', () => {
  const input = { pages: [{ index: 0, segments: [segment('rows', '1\tText\t\n2\t\tAmount', { x: .1, y: .2, width: .8, height: .2 })] }] }
  const cells = recoverDelimitedTableSegments(input).pages[0].segments
  assert.equal(cells.length, 6)
  assert.deepEqual(cells.map(cell => cell.sourceText), ['1', 'Text', '', '2', '', 'Amount'])
  assert.ok(cells.every(cell => cell.needsReview && /Точные ширины/u.test(cell.notes)))
})

test('inconsistent field counts and ambiguous multiline headers retain all text for review', () => {
  for (const sourceText of ['1 | Text | Amount\n2 | Amount', '1 | Text | Amount\nWrapped paragraph', '1 | Text \\| detail | Amount\n2 | Text | Amount']) {
    const input = { pages: [{ index: 0, segments: [segment('header', 'A\nB\nC', { x: .1, y: .1, width: .8, height: .1 }),
      segment('body', sourceText, { x: .1, y: .2, width: .8, height: .2 })] }] }
    const output = recoverDelimitedTableSegments(input).pages[0].segments
    assert.equal(output.length, 2)
    assert.deepEqual(output.map(cell => cell.sourceText), input.pages[0].segments.map(cell => cell.sourceText))
    assert.ok(output.every(cell => cell.type === 'table'))
    assert.ok(output.every(cell => cell.needsReview))
  }
})

test('unrelated tables with the same column count cannot supply column widths', () => {
  const input = statementAnalysis()
  input.pages[2].segments.forEach((cell, index) => { cell.sourceText = ['Unrelated', 'Different', 'Labels'][index] })
  const cells = recoverDelimitedTableSegments(input).pages[0].segments.filter(cell => cell.type === 'table_cell')
  assert.ok(cells.every(cell => cell.needsReview))
  assert.ok(Math.abs(cells[0].regions[0].width - cells[1].regions[0].width) < 1e-8)
})

test('physical cells with literal pipes, newlines and spans are preserved', () => {
  const input = statementAnalysis()
  input.pages = [input.pages[2]]
  Object.assign(input.pages[0].segments[0], { sourceText: 'A | B\nC', columnSpan: 2, rowSpan: 2 })
  assert.deepEqual(recoverDelimitedTableSegments(input), input)
})

test('recovered IDs are unique and uncertain recognition is visible to QA', () => {
  const input = statementAnalysis()
  input.pages.pop()
  input.pages[0].segments.push(segment('header-0-r0-c0', 'Independent text', { x: .1, y: .8, width: .8, height: .1 }, { type: 'text' }))
  const scene = buildSceneFromAgent(input)
  assert.equal(new Set(scene.objects.map(object => object.id)).size, scene.objects.length)
  assert.ok(validateScene(scene).warnings.some(warning => warning.code === 'table-recognition'))
})

test('saved user scenes are not reconstructed by read or save normalization', () => {
  const scene = buildSceneFromAgent(statementAnalysis(), { documentId: 'a'.repeat(32) })
  const cell = scene.objects.find(object => object.type === 'table_cell')
  Object.assign(cell, { type: 'table', sourceText: '1 | Text | Amount\n2 | Text | Amount', translation: 'Пользовательский перевод',
    tableId: null, rowIndex: null, columnIndex: null, rowSpan: null, columnSpan: null,
    manualPosition: true, manualWidth: true, manualHeight: true })
  scene.layoutInitializationVersion = 4
  const normalized = normalizeScene(scene, 'a'.repeat(32))
  assert.equal(normalized.objects.length, scene.objects.length)
  const unchanged = normalized.objects.find(object => object.id === cell.id)
  assert.equal(unchanged.type, 'table')
  assert.equal(unchanged.sourceText, cell.sourceText)
  assert.equal(unchanged.translation, cell.translation)
  assert.deepEqual([unchanged.x, unchanged.y, unchanged.width, unchanged.height], [cell.x, cell.y, cell.width, cell.height])
})

test('large reconstructed tables respect the scene object limit before allocation', () => {
  const input = { pages: [{ index: 0, segments: [segment('rows', 'a | b | c\n'.repeat(3400).trim(), { x: .1, y: .1, width: .8, height: .8 })] }] }
  assert.throws(() => recoverDelimitedTableSegments(input), /10000 сегментов/u)
})
