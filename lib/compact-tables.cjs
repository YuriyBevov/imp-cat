const { normalizeTableBorders } = require('./table-borders.cjs')

// Shared tracks eliminate contradictory per-cell geometry and repeated styles
// in vision responses. Expand once at the recognition boundary, never on save.
function expandCompactTables(tables, pageIndex = 0, continuations = new Map()) {
  if (tables == null) return []
  if (!Array.isArray(tables) || tables.length > 100) throw new Error('Некорректный список таблиц страницы')
  const segments = [], usedTableIds = new Set()
  for (const [tableIndex, table] of tables.entries()) {
    const id = String(table.tableId || `page-${pageIndex + 1}-table-${tableIndex + 1}`).slice(0, 100)
    if (usedTableIds.has(id)) throw new Error(`Повторяющийся ID таблицы ${id}`)
    usedTableIds.add(id)
    for (const edges of [table.columnEdges, table.rowEdges]) {
      if (!Array.isArray(edges) || edges.length < 2 || edges.length > 1001
        || edges.some((value, index) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1 || (index && value <= edges[index - 1]))) {
        throw new Error(`Таблица ${id}: границы строк и колонок должны идти по возрастанию от 0 до 1`)
      }
    }
    const rows = table.rowEdges.length - 1, columns = table.columnEdges.length - 1
    if (rows * columns > 10_000 || !Array.isArray(table.cells) || table.cells.length > 10_000) throw new Error(`Таблица ${id}: превышен предел ячеек`)
    const prior = continuations.get(id)
    if (prior && prior.columns !== columns) throw new Error(`Таблица ${id}: число колонок меняется между страницами`)
    const rowOffset = prior?.rows || 0
    const headerRows = table.headerRowCount ?? 0
    if (!Number.isInteger(headerRows) || headerRows < 0 || headerRows > rows) throw new Error(`Таблица ${id}: некорректная высота шапки`)
    const occupied = new Set()
    for (const cell of table.cells) {
      const { row, column, rowSpan = 1, columnSpan = 1 } = cell
      if (![row, column, rowSpan, columnSpan].every(Number.isInteger) || row < 0 || column < 0 || rowSpan < 1 || columnSpan < 1 || row + rowSpan > rows || column + columnSpan > columns) throw new Error(`Таблица ${id}: адрес ячейки выходит за границы`)
      for (let r = row; r < row + rowSpan; r++) for (let c = column; c < column + columnSpan; c++) {
        const key = `${r}:${c}`
        if (occupied.has(key)) throw new Error(`Таблица ${id}: пересекаются ячейки ${key}`)
        occupied.add(key)
      }
      segments.push({ segmentId: `${id}-r${row}-c${column}`, type: 'table_cell', tableId: id,
        sourceText: String(cell.text ?? ''), rowIndex: rowOffset + row, columnIndex: column, rowSpan, columnSpan,
        isTableHeader: row + rowSpan <= headerRows,
        flowGroup: id, readingOrder: Number(table.readingOrder || 0),
        regions: [{ x: table.columnEdges[column], y: table.rowEdges[row],
          width: table.columnEdges[column + columnSpan] - table.columnEdges[column],
          height: table.rowEdges[row + rowSpan] - table.rowEdges[row] }],
        style: table.style, borders: normalizeTableBorders(cell.borders ?? table.borders),
        confidence: table.confidence, needsReview: Boolean(table.needsReview), notes: String(table.notes || ''),
      })
    }
    if (occupied.size !== rows * columns) throw new Error(`Таблица ${id}: пропущено ячеек ${rows * columns - occupied.size}, включая пустые`)
    continuations.set(id, { rows: rowOffset + rows, columns })
    if (segments.length > 12_000) throw new Error('Превышен предел ячеек страницы')
  }
  return segments
}
module.exports = { expandCompactTables }
