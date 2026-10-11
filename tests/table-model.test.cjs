const test = require('node:test')
const assert = require('node:assert/strict')
const model = require('../public/table-model.js')
const fixture = () => Array.from({ length: 4 }, (_, i) => ({ id: `c${i}`, type: 'table_cell', tableId: 't', pageIndex: 0, rowIndex: Math.floor(i / 2) + 13, columnIndex: i % 2, rowSpan: 1, columnSpan: 1, sourceText: `s${i}`, translation: `t${i}`, x: (i % 2) * 100, y: Math.floor(i / 2) * 34, width: 100, height: 34 }))
let counter = 0
const id = () => `new-${counter++}`
test('table operations preserve continuation indices and originals', () => {
  const original = fixture(), before = JSON.stringify(original)
  const inserted = model.insert(original, 'c0', 'row', id)
  assert.equal(inserted.length, 6)
  assert.equal(inserted.find(c => c.id === 'c2').rowIndex, 15)
  assert.equal(inserted.filter(c => c.rowIndex === 14).length, 2)
  assert.ok(inserted.filter(c => c.rowIndex === 14).every(c => c.translation === ''))
  assert.equal(JSON.stringify(original), before)
  const columns = model.insert(original, 'c0', 'column', id)
  assert.equal(columns.length, 6)
  assert.equal(columns.find(c => c.id === 'c1').columnIndex, 2)
  assert.equal(columns.find(c => c.id === 'c1').x, 200)
})
test('row insertion shifts existing rows and appends after the last row', () => {
  const cells = fixture(), before = JSON.stringify(cells)
  const inserted = model.insert(cells, 'c0', 'row', id)
  assert.equal(inserted.find(cell => cell.id === 'c2').y, 68)
  assert.equal(inserted.find(cell => cell.id === 'c3').y, 68)
  assert.equal(inserted.find(cell => cell.id === 'c0').y, 0)
  const appended = model.insert(inserted, 'c2', 'row', id)
  assert.ok(appended.filter(cell => cell.rowIndex === 16).every(cell => cell.y === 102 && cell.height === 34))
  assert.equal(appended.filter(cell => cell.rowIndex === 16).length, 2)
  assert.equal(appended.find(cell => cell.id === 'c2').translation, 't2')
  assert.equal(JSON.stringify(cells), before)
})

test('inserting above the first or middle row preserves continuation indices, text and merged cells', () => {
  const cells = fixture(), before = JSON.stringify(cells)
  const first = model.insert(cells, 'c0', 'row', id, { position: 'before' })
  assert.equal(model.geometry(first).firstRow, 13)
  assert.equal(first.filter(cell => cell.rowIndex === 13).length, 2)
  assert.ok(first.filter(cell => cell.rowIndex === 13).every(cell => cell.sourceText === '' && cell.y === 0))
  assert.equal(first.find(cell => cell.id === 'c0').rowIndex, 14)
  assert.equal(first.find(cell => cell.id === 'c0').y, 34)
  assert.equal(first.find(cell => cell.id === 'c2').y, 68)
  const middle = model.insert(cells, 'c2', 'row', id, { position: 'before' })
  assert.equal(middle.find(cell => cell.id === 'c0').y, 0)
  assert.equal(middle.find(cell => cell.id === 'c2').rowIndex, 15)
  assert.equal(middle.find(cell => cell.id === 'c2').translation, 't2')
  const merged = model.merge(cells, ['c0', 'c2'])
  const extended = model.insert(merged, 'c3', 'row', id, { position: 'before' })
  assert.equal(extended.find(cell => cell.id === 'c0').rowSpan, 3)
  assert.equal(extended.filter(cell => cell.rowIndex === 14 && cell.columnIndex === 1).length, 1)
  model.validate(extended)
  assert.equal(JSON.stringify(cells), before)
})

test('column insertion uses free width then shares a full-width table proportionally', () => {
  const cells = model.arrange(fixture(), { x: 40, y: 40, firstRow: 13, widths: [204, 408], heights: [34, 34] })
  const before = JSON.stringify(cells)
  const roomy = model.insert(cells, 'c0', 'column', id, { maxWidth: 816 })
  assert.deepEqual(model.geometry(roomy).widths, [204, 204, 408])
  const partial = model.insert(cells, 'c0', 'column', id, { maxWidth: 646 })
  assert.deepEqual(model.geometry(partial).widths, [204, 34, 408])
  const full = model.insert(cells, 'c0', 'column', id, { maxWidth: 612 })
  const grid = model.geometry(full)
  assert.deepEqual(grid.widths, [204, 17, 391])
  assert.equal(grid.widths.reduce((sum, width) => sum + width, 0), 612)
  assert.equal(full.find(cell => cell.id === 'c1').columnIndex, 2)
  assert.equal(full.find(cell => cell.id === 'c1').translation, 't1')
  assert.equal(full.find(cell => cell.id === 'c1').x, 261)
  assert.equal(full.find(cell => cell.id === 'c3').x, 261)
  assert.equal(JSON.stringify(cells), before)
})

test('column insertion preserves merged cells and the minimum width without partial mutation', () => {
  const cells = model.arrange(fixture(), { x: 0, y: 0, firstRow: 13, widths: [17, 85], heights: [34, 34] })
  const merged = model.merge(cells, ['c2', 'c3'])
  const inserted = model.insert(merged, 'c0', 'column', id, { maxWidth: 102 })
  assert.deepEqual(model.geometry(inserted).widths, [17, 17, 68])
  assert.equal(inserted.find(cell => cell.id === 'c2').columnSpan, 3)
  assert.equal(inserted.filter(cell => cell.columnIndex === 1).length, 1)
  model.validate(inserted)
  const minimal = model.arrange(fixture(), { x: 0, y: 0, firstRow: 13, widths: [17, 17], heights: [34, 34] })
  const before = JSON.stringify(minimal)
  assert.throws(() => model.insert(minimal, 'c0', 'column', id, { maxWidth: 34 }), /минимум 17/)
  assert.equal(JSON.stringify(minimal), before)
})

test('inserting to the left uses the selected column width and shares full width across existing columns', () => {
  const cells = model.arrange(fixture(), { x: 40, y: 40, firstRow: 13, widths: [204, 408], heights: [34, 34] })
  const before = JSON.stringify(cells)
  const middle = model.insert(cells, 'c1', 'column', id, { position: 'before', maxWidth: 1020 })
  assert.deepEqual(model.geometry(middle).widths, [204, 408, 408])
  assert.equal(middle.find(cell => cell.id === 'c0').columnIndex, 0)
  assert.equal(middle.find(cell => cell.id === 'c1').columnIndex, 2)
  const first = model.insert(cells, 'c0', 'column', id, { position: 'before', maxWidth: 612 })
  assert.deepEqual(model.geometry(first).widths, [17, 204, 391])
  assert.equal(first.find(cell => cell.id === 'c0').x, 57)
  assert.equal(first.find(cell => cell.id === 'c0').columnIndex, 1)
  assert.equal(first.find(cell => cell.id === 'c1').translation, 't1')
  const merged = model.merge(cells, ['c2', 'c3'])
  const extended = model.insert(merged, 'c1', 'column', id, { position: 'before', maxWidth: 612 })
  assert.equal(extended.find(cell => cell.id === 'c2').columnSpan, 3)
  model.validate(extended)
  assert.equal(JSON.stringify(cells), before)
})
test('merge retains all text and split retains the text in the first cell', () => {
  const merged = model.merge(fixture(), ['c0', 'c1', 'c2', 'c3'])
  assert.equal(merged.length, 1)
  assert.equal(merged[0].translation, 't0\nt1\nt2\nt3')
  assert.equal(merged[0].columnSpan, 2)
  const split = model.split(merged, 'c0', id)
  assert.equal(split.length, 4)
  assert.equal(split.filter(c => c.translation).length, 1)
  assert.deepEqual(split.map(c => [c.rowIndex,c.columnIndex]), [[13,0],[13,1],[14,0],[14,1]])
})
test('invalid merges and overlapping addresses fail before mutation', () => {
  const cells = fixture()
  assert.throws(() => model.merge(cells, ['c0', 'c3']), /прямоугольника/)
  assert.throws(() => model.validate([...cells, { ...cells[0], id: 'duplicate' }]), /пересекаются/)
  assert.throws(() => model.validate([{ ...cells[0], rowIndex: -1 }]), /строку/)
})
test('inserting through a merged cell extends its span and fills only uncovered slots', () => {
  const merged = model.merge(fixture(), ['c0', 'c2'])
  const inserted = model.insert(merged, 'c1', 'row', id)
  assert.equal(inserted.find(c => c.id === 'c0').rowSpan, 3)
  assert.equal(inserted.length, 4)
  model.validate(inserted)
})

test('resizing a row or column preserves shared edges, spans and continuation indices', () => {
  const cells = fixture(), before = JSON.stringify(cells)
  const wider = model.resize(cells, 'column', 0, 153)
  assert.equal(wider.find(cell => cell.id === 'c0').width, 153)
  assert.equal(wider.find(cell => cell.id === 'c1').x, 153)
  assert.equal(wider.find(cell => cell.id === 'c2').width, 153)
  const taller = model.resize(cells, 'row', 13, 68)
  assert.equal(taller.find(cell => cell.id === 'c0').height, 68)
  assert.equal(taller.find(cell => cell.id === 'c1').height, 68)
  assert.equal(taller.find(cell => cell.id === 'c2').y, 68)
  const merged = model.merge(cells, ['c0', 'c2'])
  const resized = model.resize(merged, 'row', 14, 51)
  assert.equal(resized.find(cell => cell.id === 'c0').height, 85)
  assert.equal(resized.find(cell => cell.id === 'c3').height, 51)
  assert.equal(JSON.stringify(cells), before)
  assert.throws(() => model.resize(cells, 'row', 0, 34), /строку или колонку/)
})

test('resizing within a full table borrows neighbouring space and respects minimums', () => {
  const cells = fixture()
  const resized = model.resize(cells, 'column', 0, 153, { preserveExtent: true })
  assert.equal(resized[0].width, 153)
  assert.equal(resized[1].width, 47)
  assert.equal(resized[1].x + resized[1].width, 200)
  const taller = model.resize(cells, 'row', 13, 51, { preserveExtent: true, minimumSizes: [17, 17] })
  assert.equal(taller[0].height, 51)
  assert.equal(taller[2].height, 17)
  assert.equal(taller[2].y + taller[2].height, 68)
  assert.throws(() => model.resize(cells, 'row', 13, 68, { preserveExtent: true, minimumSizes: [17, 34] }), /минимального размера/)
})

test('row copy is a detached snapshot and paste inserts text, styles and merges into destination widths', () => {
  const cells = fixture()
  cells[0].style = { fontSizePx: 16, fontWeight: 700 }
  cells[0].translationTextStyles = [{ start: 0, end: 2, style: { fontWeight: 700 } }]
  cells[0].sourceRegions = [{ x: 1 }]
  cells[0].translationUnits = [{ id: 'original-unit' }]
  const snapshot = model.copyRow(cells, 'c0')
  cells[0].translation = 'Edited after copying'
  cells[0].style.fontSizePx = 20
  const before = JSON.stringify(cells), copiedBefore = JSON.stringify(snapshot)
  const destination = model.arrange(cells, { x: 40, y: 40, firstRow: 13, widths: [68, 136], heights: [34, 51] })
  const pasted = model.pasteRow(destination, 'c2', snapshot, id, { position: 'before' })
  const newRow = pasted.filter(cell => cell.rowIndex === 14)
  assert.equal(newRow.length, 2)
  assert.deepEqual(newRow.map(cell => cell.translation), ['t0', 't1'])
  assert.deepEqual(newRow.map(cell => cell.width), [68, 136])
  assert.equal(newRow[0].style.fontSizePx, 16)
  assert.equal(newRow[0].translationTextStyles[0].style.fontWeight, 700)
  assert.deepEqual(newRow[0].sourceRegions, [])
  assert.deepEqual(newRow[0].translationUnits, [])
  assert.equal(newRow[0].originalBounds, null)
  assert.equal(pasted.find(cell => cell.id === 'c2').rowIndex, 15)
  assert.equal(pasted.find(cell => cell.id === 'c2').y, 108)
  assert.equal(model.pasteRow(destination, 'c3', snapshot, id).filter(cell => cell.rowIndex === 15).length, 2)
  assert.equal(JSON.stringify(snapshot), copiedBefore)
  assert.equal(JSON.stringify(cells), before)
  const merged = model.merge(fixture(), ['c0', 'c1'])
  const mergedSnapshot = model.copyRow(merged, 'c0')
  const mergedPaste = model.pasteRow(fixture(), 'c2', mergedSnapshot, id)
  assert.equal(mergedPaste.find(cell => cell.rowIndex === 15).columnSpan, 2)
  model.validate(mergedPaste)
})

test('row paste rejects incompatible columns or a cut through a vertical merge without mutation', () => {
  const snapshot = model.copyRow(fixture(), 'c0')
  const cells = model.merge(fixture(), ['c0', 'c2'])
  const before = JSON.stringify(cells)
  assert.throws(() => model.pasteRow(cells, 'c1', snapshot, id), /вертикально объединённую/)
  assert.throws(() => model.pasteRow(cells, 'c3', { ...snapshot, columns: 3 }, id), /Число колонок/)
  assert.equal(JSON.stringify(cells), before)
  const vertical = model.copyRow(cells, 'c0')
  const pasted = model.pasteRow(fixture(), 'c2', vertical, id)
  assert.equal(pasted.find(cell => cell.rowIndex === 15).rowSpan, 1)
  assert.equal(pasted.find(cell => cell.rowIndex === 15).translation, 't0\nt2')
})

const flowPage = (index, height = 136, width = 204) => ({ index, sourcePageIndex: index, widthPx: width + 80, heightPx: height + 80, imageUrl: `/page-${index}.png`, contentBounds: { x: 40, y: 40, width, height } })
const flowCells = (page, firstRow, rows, tableId = 'flow') => Array.from({ length: rows * 2 }, (_, i) => ({
  ...fixture()[i % 4], id: `${tableId}-${page}-${i}`, pageIndex: page, tableId, rowIndex: firstRow + Math.floor(i / 2),
  x: 40 + i % 2 * 102, y: 40 + Math.floor(i / 2) * 34, width: 102, height: 34,
}))
const flowText = (id, pageIndex, y, height = 34) => ({ id, type: 'text', pageIndex, x: 40, y, width: 204, height, sourceText: id, translation: id })
function assertFlowGeometry(scene) {
  for (const page of scene.pages) {
    const objects = scene.objects.filter(object => !object.excluded && object.pageIndex === page.index), area = page.contentBounds
    for (const object of objects) {
      assert.ok(object.x >= area.x && object.y >= area.y)
      assert.ok(object.x + object.width <= area.x + area.width && object.y + object.height <= area.y + area.height)
    }
    for (let i = 0; i < objects.length; i++) for (let j = i + 1; j < objects.length; j++) {
      const a = objects[i], b = objects[j]
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, `${a.id} overlaps ${b.id}`)
    }
  }
  model.validate(scene.objects.filter(object => object.type === 'table_cell'))
}
test('deleting a row closes the gap, shortens vertical merges, and supports deleting the last row', () => {
  const original = fixture(), before = JSON.stringify(original)
  const removed = model.deleteRow(original, 'c0')
  assert.deepEqual(removed.map(cell => [cell.id, cell.rowIndex, cell.y]), [['c2', 13, 0], ['c3', 13, 0]])
  assert.equal(removed[0].translation, 't2')
  assert.deepEqual(model.deleteRow(removed, 'c2'), [])
  const merged = model.merge(original, ['c0', 'c2'])
  const shortened = model.deleteRow(merged, 'c3')
  assert.equal(shortened.find(cell => cell.id === 'c0').rowSpan, 1)
  assert.equal(shortened.find(cell => cell.id === 'c0').height, 34)
  assert.equal(shortened.find(cell => cell.id === 'c0').translation, 't0\nt2')
  model.validate(shortened)
  assert.equal(JSON.stringify(original), before)
})
test('row insertion cascades across an occupied next page and creates a source-free continuation atomically', () => {
  const cells = flowCells(0, 13, 3), continuation = flowCells(1, 16, 3)
  const scene = { pages: [flowPage(0), flowPage(1)], objects: [...cells, flowText('footer', 0, 142), ...continuation, flowText('next-footer', 1, 142)] }
  const before = JSON.stringify(scene)
  const result = model.reflowRows(scene, cells, model.insert(cells, cells[0].id, 'row', id), { at: 14 })
  assert.equal(result.pages.length, 3)
  assert.equal(result.objects.find(object => object.id === 'footer').pageIndex, 1)
  assert.equal(result.objects.find(object => object.id === continuation[0].id).y, 74)
  assert.equal(result.objects.find(object => object.id === continuation[0].id).rowIndex, 17)
  assert.equal(result.objects.find(object => object.id === 'next-footer').pageIndex, 2)
  assert.equal(result.pages[1].sourcePageIndex, 1)
  assert.equal(result.pages[2].sourcePageIndex, null)
  assert.equal(result.pages[2].imageUrl, null)
  assert.equal(result.pages[2].layoutContinuation, true)
  assert.equal(JSON.stringify(scene), before)
  assertFlowGeometry(result)
})
test('overflow rows stay whole, rebase legacy continuation addresses, and shift all following content', () => {
  const cells = flowCells(0, 0, 4), continuation = flowCells(1, 0, 3)
  const scene = { pages: [flowPage(0), flowPage(1)], objects: [...cells, ...continuation, flowText('later', 1, 142)] }
  const result = model.reflowRows(scene, cells, model.insert(cells, cells[0].id, 'row', id, { position: 'before' }), { at: 0 })
  assert.equal(result.objects.find(object => object.id === cells[6].id).pageIndex, 1)
  assert.equal(result.objects.find(object => object.id === cells[7].id).y, 40)
  assert.equal(result.objects.find(object => object.id === continuation[0].id).rowIndex, 5)
  assert.equal(result.objects.find(object => object.id === continuation[0].id).y, 74)
  assert.equal(result.objects.find(object => object.id === 'later').pageIndex, 2)
  assertFlowGeometry(result)
})
test('vertical spans move as a whole and incompatible next areas receive a matching inserted page', () => {
  const cells = model.merge(flowCells(0, 0, 4), ['flow-0-4', 'flow-0-6'])
  const nextText = { ...flowText('narrow-content', 1, 40), width: 102 }
  const scene = { pages: [flowPage(0), flowPage(1, 136, 102)], objects: [...cells, nextText] }
  const result = model.reflowRows(scene, cells, model.insert(cells, 'flow-0-0', 'row', id), { at: 1 })
  assert.equal(result.pages.length, 3)
  assert.equal(result.pages[1].sourcePageIndex, null)
  assert.equal(result.pages[2].sourcePageIndex, 1)
  assert.equal(result.objects.find(object => object.id === 'flow-0-4').pageIndex, 1)
  assert.equal(result.objects.find(object => object.id === 'flow-0-5').pageIndex, 1)
  assert.equal(result.objects.find(object => object.id === 'flow-0-7').pageIndex, 1)
  assert.equal(result.objects.find(object => object.id === 'narrow-content').pageIndex, 2)
  assertFlowGeometry(result)
})
test('cutting then pasting a detached row relocates its content without erasing destination rows', () => {
  const cells = flowCells(0, 13, 3)
  const scene = { pages: [flowPage(0)], objects: [...cells, flowText('footer', 0, 142)] }
  const copied = model.copyRow(cells, cells[0].id)
  const cut = model.reflowRows(scene, cells, model.deleteRow(cells, cells[0].id), { at: 13 })
  const remaining = cut.objects.filter(object => object.type === 'table_cell')
  assert.equal(cut.objects.find(object => object.id === 'footer').y, 108)
  const pasted = model.pasteRow(remaining, cells[4].id, copied, id)
  const result = model.reflowRows(cut, remaining, pasted, { at: 15 })
  assert.equal(result.objects.find(object => object.id === 'footer').y, 142)
  assert.deepEqual(result.objects.filter(object => object.type === 'table_cell' && object.rowIndex === 15).map(object => object.translation), copied.cells.map(cell => cell.translation))
  assertFlowGeometry(result)
})
test('oversized indivisible rows and page limits reject without mutating the scene', () => {
  const cells = flowCells(0, 0, 4), scene = { pages: [flowPage(0)], objects: cells }
  const before = JSON.stringify(scene), next = model.insert(cells, cells[0].id, 'row', id)
  assert.throws(() => model.reflowRows(scene, cells, next, { maxPages: 1 }), /предел/)
  const huge = model.merge(next, next.map(cell => cell.id))
  assert.throws(() => model.reflowRows(scene, cells, huge), /больше целой/)
  assert.equal(JSON.stringify(scene), before)
})

test('inserting below staggered header blocks preserves all earlier positions', () => {
  const cells = flowCells(0, 0, 2).map(cell => ({ ...cell, y: cell.y + 102 }))
  const header = [
    { ...flowText('header-left', 0, 40), width: 102, height: 34 },
    { ...flowText('header-right', 0, 57), x: 142, width: 102, height: 34 },
    { ...flowText('header-small', 0, 108), width: 102, height: 17 },
  ]
  const scene = { pages: [flowPage(0, 272)], objects: [...header, ...cells, flowText('footer', 0, 227)] }
  const next = model.insert(cells, cells[2].id, 'row', id)
  const result = model.reflowRows(scene, cells, next, { at: 2 })
  for (const object of header) assert.deepEqual(result.objects.find(item => item.id === object.id), object)
  assert.equal(result.objects.find(object => object.id === cells[0].id).y, 142)
  assert.equal(result.objects.find(object => object.id === 'footer').y, 261)
  assertFlowGeometry(result)
})

test('selected rows expand across vertical merges and extract nonadjacent rows without losing IDs or metadata', () => {
  const cells = flowCells(0, 0, 4)
  cells[2].knowledgeMatches = [{ entryId: 'retained' }]
  const merged = model.merge(cells, [cells[2].id, cells[4].id])
  const selection = model.selectedRows(merged, [cells[3].id])
  assert.deepEqual(selection.rows, [1, 2])
  assert.equal(selection.cells.length, 3)
  const extracted = model.extractRows(cells, [cells[0].id, cells[4].id])
  assert.deepEqual(extracted.rows, [0, 2])
  assert.deepEqual(extracted.remaining.map(cell => cell.rowIndex), [0, 0, 1, 1])
  assert.deepEqual(extracted.moved.map(cell => cell.rowIndex), [0, 0, 1, 1])
  assert.deepEqual(extracted.moved.map(cell => cell.id), [cells[0].id, cells[1].id, cells[4].id, cells[5].id])
  model.validate(extracted.remaining); model.validate(extracted.moved)
})
test('moving selected rows into a free working area keeps a single table and pushes existing content down', () => {
  const cells = flowCells(0, 0, 3)
  cells[2].knowledgeMatches = [{ entryId: 'retained' }]
  cells[2].layoutSourcePageIndex = 0
  cells[2].translationUnits = [{ id: 'unit-retained' }]
  const scene = { pages: [flowPage(0), flowPage(1)], objects: [...cells, flowText('footer', 0, 142), flowText('destination-content', 1, 40)] }
  const before = JSON.stringify(scene)
  const result = model.transferRows(scene, cells, [cells[2].id, cells[4].id], { pageIndex: 1, x: 40, y: 40 })
  assert.deepEqual(result.movedIds, cells.slice(2).map(cell => cell.id))
  assert.equal(result.scene.pages.length, 2)
  assert.equal(new Set(result.scene.objects.filter(cell => cell.type === 'table_cell').map(cell => cell.tableId)).size, 1)
  assert.equal(result.scene.objects.find(cell => cell.id === cells[2].id).rowIndex, 1)
  assert.equal(result.scene.objects.find(cell => cell.id === 'footer').y, 74)
  assert.equal(result.scene.objects.find(cell => cell.id === 'destination-content').y, 108)
  const moved = result.scene.objects.find(cell => cell.id === cells[2].id)
  assert.deepEqual(moved.knowledgeMatches, cells[2].knowledgeMatches)
  assert.deepEqual(moved.translationUnits, cells[2].translationUnits)
  assert.equal(moved.layoutSourcePageIndex, 0)
  assert.equal(JSON.stringify(scene), before)
  assertFlowGeometry(result.scene)
})
test('moving rows to an existing continuation reorders one logical table and cascades overflow intact', () => {
  const source = flowCells(0, 0, 3), target = flowCells(1, 3, 3)
  const scene = { pages: [flowPage(0), flowPage(1)], objects: [...source, ...target] }
  const result = model.transferRows(scene, source, [source[2].id, source[4].id], { anchorId: target[0].id, position: 'before' })
  assert.equal(result.scene.pages.length, 3)
  const ordered = result.scene.objects.filter(cell => cell.type === 'table_cell' && cell.columnIndex === 0).sort((a, b) => a.pageIndex - b.pageIndex || a.rowIndex - b.rowIndex)
  assert.deepEqual(ordered.map(cell => cell.id), [source[0].id, source[2].id, source[4].id, target[0].id, target[2].id, target[4].id])
  assert.deepEqual(ordered.map(cell => cell.rowIndex), [0, 1, 2, 3, 4, 5])
  assert.ok(ordered.every(cell => cell.tableId === 'flow'))
  assertFlowGeometry(result.scene)
})
test('moving to another table uses its widths and preserves all destination rows', () => {
  const source = flowCells(0, 0, 3), target = flowCells(1, 0, 2, 'target').map(cell => ({ ...cell, width: 51, x: 40 + cell.columnIndex * 51 }))
  const scene = { pages: [flowPage(0), flowPage(1)], objects: [...source, ...target] }
  const result = model.transferRows(scene, source, [source[2].id], { anchorId: target[2].id })
  assert.ok(result.scene.objects.filter(cell => result.movedIds.includes(cell.id)).every(cell => cell.tableId === 'target' && cell.width === 51 && cell.rowIndex === 1))
  assert.equal(result.scene.objects.find(cell => cell.id === target[2].id).rowIndex, 2)
  assert.equal(result.scene.objects.find(cell => cell.id === target[2].id).translation, target[2].translation)
  assertFlowGeometry(result.scene)
})
test('a failed row transfer leaves the source unchanged, including incompatible targets and selected anchors', () => {
  const source = flowCells(0, 0, 3), target = [{ ...flowCells(1, 0, 1, 'target')[0], width: 204 }]
  const scene = { pages: [flowPage(0), flowPage(1)], objects: [...source, ...target] }, before = JSON.stringify(scene)
  assert.throws(() => model.transferRows(scene, source, [source[2].id], { anchorId: target[0].id }), /одинаковое число колонок/)
  assert.throws(() => model.transferRows(scene, source, [source[2].id], { anchorId: source[2].id }), /за пределами/)
  assert.throws(() => model.transferRows(scene, source, [source[2].id], { pageIndex: 1, x: 0, y: 40 }), /внутри рабочей/)
  assert.equal(JSON.stringify(scene), before)
})
test('compacting a gapped table removes gaps and shifts the footer by the actual physical extent', () => {
  const cells = flowCells(0, 0, 3).map(cell => ({ ...cell, y: cell.y + cell.rowIndex * 17 }))
  const scene = { pages: [flowPage(0, 204)], objects: [...cells, flowText('footer', 0, 193)] }
  const compact = model.arrange(cells, model.geometry(cells))
  const result = model.reflowRows(scene, cells, compact, { at: 0 })
  assert.deepEqual(result.objects.filter(cell => cell.type === 'table_cell' && cell.columnIndex === 0).map(cell => cell.y), [40, 74, 108])
  assert.equal(result.objects.find(cell => cell.id === 'footer').y, 159)
  assertFlowGeometry(result)
})
test('a staggered block next to rows does not insert vertical gaps between those rows', () => {
  const cells = flowCells(0, 0, 3).map(cell => ({ ...cell, width: 51, x: 40 + cell.columnIndex * 51 }))
  const side = { ...flowText('side', 0, 57, 51), x: 159, width: 85 }
  const scene = { pages: [flowPage(0)], objects: [...cells, side] }
  const result = model.reflowRows(scene, cells, model.arrange(cells, model.geometry(cells)), { at: 0 })
  assert.deepEqual(result.objects.filter(cell => cell.type === 'table_cell' && cell.columnIndex === 0).map(cell => cell.y), [40, 74, 108])
  assert.equal(result.objects.find(cell => cell.id === 'side').y, 57)
  assertFlowGeometry(result)
})

test('legacy table frames normalize shared tracks to whole cells and keep merged cells and source data', () => {
  const cells = fixture().map(cell => ({ ...cell, x: 42.2 + cell.columnIndex * 51.5, y: 41.3 + (cell.rowIndex - 13) * 23.2, width: 51.5, height: 23.2,
    originalBounds: { x: 1.2, y: 2.4, width: 3.5, height: 4.8 } }))
  const original = JSON.stringify(cells), area = { x: 40, y: 40, width: 136, height: 68 }
  const next = model.snapToGrid(cells, area)
  assert.equal(next[0].width, 68)
  assert.equal(next[0].height, 34)
  assert.equal(next[1].x, next[0].x + next[0].width)
  assert.equal(next[2].y, next[0].y + next[0].height)
  const merged = model.merge(next, ['c0', 'c1'])
  const fitted = model.snapToGrid(merged, area)
  assert.equal(fitted[0].columnSpan, 2)
  assert.equal(fitted[0].width, 136)
  assert.deepEqual(fitted[0].originalBounds, cells[0].originalBounds)
  assert.equal(JSON.stringify(cells), original)
  assert.deepEqual(model.geometry(model.snapToGrid(cells, { ...area, width: 102 })).widths, [51, 51])
  const tiny = model.snapToGrid([{ ...cells[0], rowIndex: 0, columnIndex: 0, width: 2, height: 3 }], area)[0]
  assert.equal(tiny.width, 17); assert.equal(tiny.height, 17)
})

test('row border toggles update shared edges and preserve other parts and content', () => {
  const cells = fixture().map(cell => ({ ...cell, borders: { top: true, right: true, bottom: true, left: true } }))
  const original = JSON.stringify(cells)
  const hidden = model.setBorders(cells, ['c2', 'c3'], false)
  assert.equal(model.borderState(hidden.slice(2)), 'hidden')
  assert.equal(hidden[0].borders.bottom, false)
  assert.equal(hidden[0].borders.left, true)
  assert.equal(model.borderState(hidden), 'mixed')
  assert.equal(model.borderState(model.setBorders(hidden, hidden.map(cell => cell.id), true)), 'shown')
  assert.equal(JSON.stringify(cells), original)
  assert.deepEqual(hidden.map(cell => cell.translation), cells.map(cell => cell.translation))
})

function linkedScene() {
  return { pages: [0, 1, 2].map(index => ({ index, widthPx: 794, heightPx: 1123, contentBounds: { x: 40, y: 40, width: 680, height: 1020 } })),
    objects: [0, 1, 2].flatMap(pageIndex => fixture().map((cell, index) => ({ ...cell, id: `p${pageIndex}-${index}`,
      pageIndex, rowIndex: cell.rowIndex + pageIndex * 2, x: 40 + index % 2 * 102, y: 40 + Math.floor(index / 2) * 34, width: 102 }))) }
}

test('linked column widths affect three page fragments atomically and preserve row IDs', () => {
  const scene = linkedScene(), before = JSON.stringify(scene)
  const next = model.setLinkedColumnWidths(scene, 't', [136, 85])
  for (const page of [0, 1, 2]) assert.deepEqual(model.geometry(next.objects.filter(cell => cell.pageIndex === page)).widths, [136, 85])
  assert.deepEqual(next.objects.map(cell => cell.id).sort(), scene.objects.map(cell => cell.id).sort())
  assert.equal(JSON.stringify(scene), before)
  scene.pages[2].contentBounds.width = 204
  assert.throws(() => model.setLinkedColumnWidths(scene, 't', [136, 85]), /продолжения/)
})

test('column insertion updates every continuation with the same widths', () => {
  const scene = linkedScene(), before = JSON.stringify(scene)
  const next = model.insertLinkedColumn(scene, 'p1-0', 'after', id)
  assert.equal(next.objects.length, 18)
  const grids = [0, 1, 2].map(page => model.geometry(next.objects.filter(cell => cell.pageIndex === page)))
  assert.ok(grids.every(grid => grid.columns === 3))
  assert.deepEqual(grids[0].widths, grids[1].widths)
  assert.deepEqual(grids[1].widths, grids[2].widths)
  assert.equal(new Set(next.objects.map(cell => cell.id)).size, 18)
  assert.equal(JSON.stringify(scene), before)
})
