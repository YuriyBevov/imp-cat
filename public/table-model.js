/* Structural operations are pure: callers commit the returned cells as one undo step. */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.IcatTableModel = api
})(typeof window === 'undefined' ? globalThis : window, function () {
  const clone = value => JSON.parse(JSON.stringify(value))
  const endRow = cell => cell.rowIndex + (cell.rowSpan || 1)
  const endColumn = cell => cell.columnIndex + (cell.columnSpan || 1)
  function validate(cells) {
    const occupied = new Set()
    for (const cell of cells) {
      if (!cell.tableId || !Number.isInteger(cell.rowIndex) || cell.rowIndex < 0 || !Number.isInteger(cell.columnIndex) || cell.columnIndex < 0) throw new Error('Укажите таблицу, строку и колонку каждой ячейки.')
      for (const span of [cell.rowSpan ?? 1, cell.columnSpan ?? 1]) if (!Number.isInteger(span) || span < 1 || span > 100) throw new Error('Некорректный размер объединённой ячейки.')
      for (let row = cell.rowIndex; row < endRow(cell); row++) for (let column = cell.columnIndex; column < endColumn(cell); column++) {
        const key = `${cell.pageIndex}:${cell.tableId}:${row}:${column}`
        if (occupied.has(key)) throw new Error(`Ячейки пересекаются: строка ${row + 1}, колонка ${column + 1}.`)
        occupied.add(key)
      }
    }
    return cells
  }
  function geometry(cells) {
    validate(cells)
    const firstRow = Math.min(...cells.map(cell => cell.rowIndex))
    const rows = Math.max(...cells.map(endRow)) - firstRow
    const columns = Math.max(...cells.map(endColumn))
    const x = Math.min(...cells.map(cell => cell.x)), y = Math.min(...cells.map(cell => cell.y))
    const right = Math.max(...cells.map(cell => cell.x + cell.width))
    const boundaries = Array.from({ length: columns + 1 }, () => [])
    const heights = Array(rows).fill(34)
    for (const cell of cells) {
      boundaries[cell.columnIndex].push(cell.x)
      boundaries[endColumn(cell)].push(cell.x + cell.width)
      for (let row = cell.rowIndex; row < endRow(cell); row++) heights[row - firstRow] = Math.max(heights[row - firstRow], cell.height / (cell.rowSpan || 1))
    }
    const edges = boundaries.map(values => values.length ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)] : null)
    edges[0] = x; edges[columns] = right
    for (let start = 0; start < columns;) {
      let end = start + 1
      while (edges[end] == null) end++
      for (let index = start + 1; index < end; index++) edges[index] = edges[start] + (edges[end] - edges[start]) * (index - start) / (end - start)
      start = end
    }
    const widths = edges.slice(1).map((edge, index) => edge - edges[index])
    if (widths.some(width => width <= 0)) throw new Error('Порядок колонок не соответствует их координатам.')
    return { firstRow, rows, columns, x, y, widths, heights }
  }
  function arrange(cells, grid) {
    validate(cells)
    return cells.map(cell => ({ ...cell,
      x: grid.x + grid.widths.slice(0, cell.columnIndex).reduce((a, b) => a + b, 0),
      y: grid.y + grid.heights.slice(0, cell.rowIndex - grid.firstRow).reduce((a, b) => a + b, 0),
      width: grid.widths.slice(cell.columnIndex, endColumn(cell)).reduce((a, b) => a + b, 0),
      height: grid.heights.slice(cell.rowIndex - grid.firstRow, endRow(cell) - grid.firstRow).reduce((a, b) => a + b, 0),
      manualPosition: true, manualWidth: true, manualHeight: true,
    }))
  }
  function blank(template, row, column, id) {
    return { ...clone(template), id, rowIndex: row, columnIndex: column, rowSpan: 1, columnSpan: 1,
      sourceText: '', translation: '', sourceTextStyles: [], translationTextStyles: [], translationUnits: [],
      sourceLineIds: [], sourceRegions: [], sourceRevisionChat: [], revisionChat: [], originalBounds: null,
      translatedSourceText: '', translatedSourceType: 'table_cell', status: 'manual', excluded: false }
  }
  function insert(cells, anchorId, axis, idFactory) {
    cells = clone(cells)
    const grid = geometry(cells), anchor = cells.find(cell => cell.id === anchorId)
    if (!anchor) throw new Error('Выберите ячейку таблицы.')
    const rowAxis = axis === 'row', field = rowAxis ? 'rowIndex' : 'columnIndex', span = rowAxis ? 'rowSpan' : 'columnSpan'
    const at = anchor[field] + (anchor[span] || 1)
    for (const cell of cells) {
      if (cell[field] >= at) cell[field]++
      else if (cell[field] + (cell[span] || 1) > at) cell[span] = (cell[span] || 1) + 1
    }
    if (rowAxis) { grid.heights.splice(at - grid.firstRow, 0, 34); grid.rows++ }
    else { grid.widths.splice(at, 0, grid.widths[Math.max(0, at - 1)]); grid.columns++ }
    for (let index = 0; index < (rowAxis ? grid.columns : grid.rows); index++) {
      const row = rowAxis ? at : grid.firstRow + index, column = rowAxis ? index : at
      if (!cells.some(cell => cell.rowIndex <= row && row < endRow(cell) && cell.columnIndex <= column && column < endColumn(cell))) cells.push(blank(anchor, row, column, idFactory()))
    }
    return arrange(cells, grid)
  }
  function merge(cells, ids) {
    cells = clone(cells)
    const grid = geometry(cells), chosen = cells.filter(cell => ids.includes(cell.id))
    if (chosen.length < 2) throw new Error('Выделите прямоугольник из двух или более ячеек (Shift + щелчок).')
    const row = Math.min(...chosen.map(cell => cell.rowIndex)), column = Math.min(...chosen.map(cell => cell.columnIndex))
    const bottom = Math.max(...chosen.map(endRow)), right = Math.max(...chosen.map(endColumn))
    if (chosen.reduce((sum, cell) => sum + (cell.rowSpan || 1) * (cell.columnSpan || 1), 0) !== (bottom - row) * (right - column)) throw new Error('Для объединения выделите все ячейки прямоугольника.')
    chosen.sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex)
    const target = chosen[0]
    Object.assign(target, { rowIndex: row, columnIndex: column, rowSpan: bottom - row, columnSpan: right - column,
      sourceText: chosen.map(cell => cell.sourceText).filter(Boolean).join('\n'), translation: chosen.map(cell => cell.translation).filter(Boolean).join('\n'),
      sourceTextStyles: [], translationTextStyles: [], translationUnits: [] })
    return arrange(cells.filter(cell => !ids.includes(cell.id) || cell.id === target.id), grid)
  }
  function split(cells, id, idFactory) {
    cells = clone(cells)
    const grid = geometry(cells), target = cells.find(cell => cell.id === id)
    if (!target || (target.rowSpan || 1) * (target.columnSpan || 1) === 1) throw new Error('Выберите объединённую ячейку. Текст останется в верхней левой ячейке.')
    const bottom = endRow(target), right = endColumn(target)
    for (let row = target.rowIndex; row < bottom; row++) for (let column = target.columnIndex; column < right; column++) if (row !== target.rowIndex || column !== target.columnIndex) cells.push(blank(target, row, column, idFactory()))
    target.rowSpan = 1; target.columnSpan = 1
    return arrange(cells, grid)
  }
  return { validate, geometry, arrange, blank, insert, merge, split }
})
