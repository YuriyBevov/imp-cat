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
    const heights = Array(rows).fill(17)
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
  function snapToGrid(cells, area, options = {}) {
    const grid = geometry(cells), step = 17
    grid.widths = grid.widths.map(width => Math.max(step, Math.ceil(width / step - 1e-6) * step))
    if (options.fitWidth !== false && grid.widths.reduce((sum, width) => sum + width, 0) > area.width) grid.widths = proportionalWidths(grid.widths, area.width)
    const width = grid.widths.reduce((sum, value) => sum + value, 0)
    const column = Math.max(0, Math.round((grid.x - area.x) / step))
    grid.x = area.x + (options.clampPosition === false ? column : Math.max(0, Math.min(Math.floor((area.width - width) / step), column))) * step
    grid.y = area.y + Math.max(0, Math.round((grid.y - area.y) / step)) * step
    grid.heights = grid.heights.map(height => Math.max(step, Math.ceil(height / step - 1e-6) * step))
    return arrange(cells, grid)
  }
  function blank(template, row, column, id) {
    return { ...clone(template), id, rowIndex: row, columnIndex: column, rowSpan: 1, columnSpan: 1,
      sourceText: '', translation: '', sourceTextStyles: [], translationTextStyles: [], translationUnits: [],
      sourceLineIds: [], sourceRegions: [], sourceRevisionChat: [], revisionChat: [], originalBounds: null,
      translatedSourceText: '', translatedSourceType: 'table_cell', status: 'manual', excluded: false }
  }
  function resize(cells, axis, index, size, options = {}) {
    const grid = geometry(cells)
    const values = axis === 'column' ? grid.widths : axis === 'row' ? grid.heights : null
    const offset = axis === 'row' ? index - grid.firstRow : index
    if (!values || !Number.isInteger(offset) || offset < 0 || offset >= values.length || !Number.isFinite(size)) throw new Error('Выберите строку или колонку и укажите её размер.')
    const target = Math.max(17, Math.round(size / 17) * 17)
    let delta = target - values[offset]
    if (options.preserveExtent && delta) {
      const neighbours = [...values.keys()].filter(item => item !== offset).sort((a, b) => Math.abs(a - offset) - Math.abs(b - offset) || b - a)
      if (delta < 0 && neighbours.length) {
        values[neighbours[0]] -= delta
        delta = 0
      }
      for (const neighbour of neighbours) {
        if (delta <= 0) break
        const minimum = Math.max(17, options.minimumSizes?.[neighbour] || 17)
        const taken = Math.min(delta, Math.max(0, values[neighbour] - minimum))
        values[neighbour] -= taken
        delta -= taken
      }
      if (Math.abs(delta) > .01) throw new Error('Соседние ячейки достигли минимального размера.')
    }
    values[offset] = target
    return arrange(cells, grid)
  }
  function proportionalWidths(widths, availableWidth) {
    // Apportion whole grid cells, with at least one cell for every column.
    const budget = Math.floor((availableWidth + .000001) / 17)
    if (budget < widths.length) throw new Error('Недостаточно места: каждой колонке нужно минимум 17 px.')
    const shares = Array(widths.length).fill(0)
    let pending = widths.map((_, index) => index), remaining = budget
    while (pending.length) {
      const total = pending.reduce((sum, index) => sum + widths[index], 0)
      const fixed = pending.filter(index => remaining * widths[index] / total < 1)
      if (!fixed.length) {
        for (const index of pending) shares[index] = remaining * widths[index] / total
        break
      }
      for (const index of fixed) shares[index] = 1
      remaining -= fixed.length
      pending = pending.filter(index => !fixed.includes(index))
    }
    const units = shares.map(Math.floor)
    const order = shares.map((share, index) => ({ index, fraction: share - units[index] }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
    const remainder = budget - units.reduce((sum, value) => sum + value, 0)
    for (let index = 0; index < remainder; index++) units[order[index].index]++
    return units.map(value => value * 17)
  }
  function insert(cells, anchorId, axis, idFactory, options = {}) {
    if (!['row', 'column'].includes(axis)) throw new Error('Выберите строку или колонку.')
    const position = options.position ?? 'after'
    if (!['before', 'after'].includes(position)) throw new Error('Выберите сторону вставки.')
    cells = clone(cells)
    const grid = geometry(cells), anchor = cells.find(cell => cell.id === anchorId)
    if (!anchor) throw new Error('Выберите ячейку таблицы.')
    const rowAxis = axis === 'row', field = rowAxis ? 'rowIndex' : 'columnIndex', span = rowAxis ? 'rowSpan' : 'columnSpan'
    const at = anchor[field] + (position === 'before' ? 0 : anchor[span] || 1)
    const preferredColumn = position === 'before' ? anchor.columnIndex : Math.max(0, at - 1)
    for (const cell of cells) {
      if (cell[field] >= at) cell[field]++
      else if (cell[field] + (cell[span] || 1) > at) cell[span] = (cell[span] || 1) + 1
    }
    if (rowAxis) { grid.heights.splice(at - grid.firstRow, 0, 34); grid.rows++ }
    else {
      const totalWidth = grid.widths.reduce((sum, width) => sum + width, 0)
      const availableWidth = options.maxWidth ?? Infinity
      if (!(availableWidth > 0)) throw new Error('Недостаточно места для новой колонки.')
      const preferredWidth = grid.widths[preferredColumn]
      const freeWidth = availableWidth - totalWidth
      const insertedWidth = freeWidth >= preferredWidth ? preferredWidth
        : Math.max(17, Math.floor((freeWidth + .000001) / 17) * 17)
      if (totalWidth + insertedWidth > availableWidth + .000001) {
        grid.widths = proportionalWidths(grid.widths, availableWidth - insertedWidth)
      }
      grid.widths.splice(at, 0, insertedWidth)
      grid.columns++
    }
    for (let index = 0; index < (rowAxis ? grid.columns : grid.rows); index++) {
      const row = rowAxis ? at : grid.firstRow + index, column = rowAxis ? index : at
      if (!cells.some(cell => cell.rowIndex <= row && row < endRow(cell) && cell.columnIndex <= column && column < endColumn(cell))) cells.push(blank(anchor, row, column, idFactory()))
    }
    return arrange(cells, grid)
  }
  function merge(cells, ids) {
    cells = clone(cells)
    const grid = geometry(cells), chosen = cells.filter(cell => ids.includes(cell.id))
    if (chosen.length < 2) throw new Error('Выделите прямоугольник из двух или более ячеек (Ctrl / Cmd + щелчок).')
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
  function copyRow(cells, anchorId) {
    const grid = geometry(cells), anchor = cells.find(cell => cell.id === anchorId)
    if (!anchor) throw new Error('Выберите ячейку строки.')
    const row = anchor.rowIndex
    const copied = cells.filter(cell => cell.rowIndex <= row && row < endRow(cell))
      .sort((a, b) => a.columnIndex - b.columnIndex).map(cell => ({
        columnIndex: cell.columnIndex, columnSpan: cell.columnSpan || 1,
        sourceText: cell.sourceText || '', translation: cell.translation || '',
        style: clone(cell.style || {}), sourceTextStyles: clone(cell.sourceTextStyles || []),
        translationTextStyles: clone(cell.translationTextStyles || []), rotation: cell.rotation || 0,
      }))
    let column = 0
    for (const cell of copied) {
      if (cell.columnIndex !== column) throw new Error('В строке отсутствуют ячейки. Восстановите их перед копированием.')
      column += cell.columnSpan
    }
    if (column !== grid.columns) throw new Error('В строке отсутствуют ячейки. Восстановите их перед копированием.')
    return { columns: grid.columns, height: grid.heights[row - grid.firstRow], cells: copied }
  }
  function pasteRow(cells, anchorId, copied, idFactory, options = {}) {
    const grid = geometry(cells), anchor = cells.find(cell => cell.id === anchorId)
    if (!anchor || !copied?.cells?.length) throw new Error('Сначала скопируйте строку таблицы.')
    if (copied.columns !== grid.columns) throw new Error('Число колонок должно совпадать с числом колонок скопированной строки.')
    const position = options.position ?? 'after'
    if (!['before', 'after'].includes(position)) throw new Error('Выберите сторону вставки.')
    const at = anchor.rowIndex + (position === 'before' ? 0 : anchor.rowSpan || 1)
    if (cells.some(cell => cell.rowIndex < at && endRow(cell) > at)) throw new Error('Место вставки пересекает вертикально объединённую ячейку. Разделите её или выберите строку за пределами объединения.')
    const next = insert(cells, anchorId, 'row', idFactory, { position })
      .filter(cell => cell.rowIndex !== at)
    for (const content of copied.cells) {
      const cell = blank(anchor, at, content.columnIndex, idFactory())
      next.push({ ...cell, ...clone(content), rowSpan: 1, translatedSourceText: content.translation ? content.sourceText : '' })
    }
    grid.heights.splice(at - grid.firstRow, 0, Math.max(17, Math.ceil(copied.height / 17) * 17))
    return arrange(next, grid)
  }
  function deleteRow(cells, anchorId) {
    const grid = geometry(cells), anchor = cells.find(cell => cell.id === anchorId)
    if (!anchor) throw new Error('Выберите ячейку строки.')
    const row = anchor.rowIndex
    const next = clone(cells).filter(cell => {
      if (cell.rowIndex > row) cell.rowIndex--
      else if (endRow(cell) > row) {
        if ((cell.rowSpan || 1) === 1) return false
        cell.rowSpan--
      }
      return true
    })
    grid.heights.splice(row - grid.firstRow, 1)
    return next.length ? arrange(next, grid) : []
  }

  function fitWidth(cells, availableWidth, x = null) {
    const grid = geometry(cells)
    if (grid.widths.reduce((sum, width) => sum + width, 0) > availableWidth) grid.widths = proportionalWidths(grid.widths, availableWidth)
    if (x != null) grid.x = x
    return arrange(cells, grid)
  }

  function selectedRows(cells, ids) {
    const grid = geometry(cells), selected = new Set(ids)
    const rows = new Set()
    for (const cell of cells) if (selected.has(cell.id)) {
      for (let row = cell.rowIndex; row < endRow(cell); row++) rows.add(row)
    }
    if (!rows.size) throw new Error('Выберите строки таблицы.')
    // Never tear a vertical merge apart when moving complete rows.
    let changed = true
    while (changed) {
      changed = false
      for (const cell of cells) {
        if (![...rows].some(row => cell.rowIndex <= row && row < endRow(cell))) continue
        for (let row = cell.rowIndex; row < endRow(cell); row++) if (!rows.has(row)) { rows.add(row); changed = true }
      }
    }
    return { rows: [...rows].sort((a, b) => a - b),
      cells: cells.filter(cell => rows.has(cell.rowIndex)), columns: grid.columns }
  }

  function extractRows(cells, ids) {
    const selection = selectedRows(cells, ids), grid = geometry(cells)
    const chosen = new Set(selection.rows), rank = row => selection.rows.filter(index => index < row).length
    const moved = clone(selection.cells).map(cell => ({ ...cell, rowIndex: rank(cell.rowIndex) }))
    const remaining = clone(cells.filter(cell => !chosen.has(cell.rowIndex)))
      .map(cell => ({ ...cell, rowIndex: cell.rowIndex - rank(cell.rowIndex) }))
    const movedGrid = { ...grid, firstRow: 0, heights: selection.rows.map(row => grid.heights[row - grid.firstRow]) }
    const remainingGrid = { ...grid, heights: grid.heights.filter((_, index) => !chosen.has(grid.firstRow + index)) }
    return { rows: selection.rows, moved: arrange(moved, movedGrid), remaining: remaining.length ? arrange(remaining, remainingGrid) : [] }
  }

  function insertRows(cells, anchorId, incoming, options = {}) {
    const grid = geometry(cells), source = geometry(incoming), anchor = cells.find(cell => cell.id === anchorId)
    if (!anchor) throw new Error('Выберите ячейку места вставки.')
    if (grid.columns !== source.columns) throw new Error('Для переноса в таблицу нужно одинаковое число колонок. Щёлкните свободное место, чтобы создать отдельную таблицу.')
    const at = anchor.rowIndex + (options.position === 'after' ? anchor.rowSpan || 1 : 0)
    if (cells.some(cell => cell.rowIndex < at && endRow(cell) > at)) throw new Error('Место вставки пересекает вертикальное объединение. Выберите строку перед ним или после него.')
    const next = clone(cells).map(cell => ({ ...cell, rowIndex: cell.rowIndex >= at ? cell.rowIndex + source.rows : cell.rowIndex }))
    for (const cell of clone(incoming)) next.push({ ...cell, tableId: anchor.tableId, pageIndex: anchor.pageIndex, rowIndex: at + cell.rowIndex - source.firstRow })
    grid.heights.splice(at - grid.firstRow, 0, ...source.heights)
    return { cells: arrange(next, grid), at }
  }

  function transferRows(scene, sourceCells, ids, destination, options = {}) {
    const sourceIds = new Set(sourceCells.map(cell => cell.id))
    if (ids.some(id => !sourceIds.has(id))) throw new Error('Выберите строки одного фрагмента таблицы на одной странице.')
    const extraction = extractRows(sourceCells, ids)
    const movedIds = extraction.moved.map(cell => cell.id)
    if (movedIds.includes(destination.anchorId)) throw new Error('Выберите место за пределами переносимых строк.')
    let planned = reflowRows(scene, sourceCells, extraction.remaining, { at: extraction.rows[0] })
    const fit = options.fit || (cells => cells)
    let anchor = destination.anchorId ? planned.objects.find(cell => cell.id === destination.anchorId && !cell.excluded && cell.type === 'table_cell') : null
    let position = destination.position
    const tableId = sourceCells[0].tableId
    if (!destination.anchorId) {
      const sameTable = planned.objects.filter(cell => !cell.excluded && cell.type === 'table_cell' && cell.tableId === tableId && cell.pageIndex === destination.pageIndex)
        .sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex)
      anchor = sameTable.find(cell => cell.y >= destination.y) || sameTable.at(-1)
      if (anchor) position = anchor.y >= destination.y ? 'before' : 'after'
    }
    if (destination.anchorId && !anchor) throw new Error('Таблица назначения больше недоступна.')
    if (anchor) {
      const target = planned.objects.filter(cell => !cell.excluded && cell.type === 'table_cell' && cell.tableId === anchor.tableId && cell.pageIndex === anchor.pageIndex)
      const insertion = insertRows(target, anchor.id, extraction.moved, { position })
      planned = reflowRows(planned, target, fit(insertion.cells, target), { at: insertion.at })
    } else {
      const page = planned.pages[destination.pageIndex], area = page?.contentBounds
      if (!area || !Number.isFinite(destination.x) || !Number.isFinite(destination.y)
        || destination.x < area.x || destination.y < area.y || destination.y >= area.y + area.height) throw new Error('Щёлкните внутри рабочей области назначения.')
      const grid = geometry(extraction.moved), available = area.x + area.width - destination.x
      if (grid.widths.reduce((sum, width) => sum + width, 0) > available) grid.widths = proportionalWidths(grid.widths, available)
      const earlier = planned.objects.filter(cell => !cell.excluded && cell.type === 'table_cell' && cell.tableId === tableId && cell.pageIndex < page.index)
      grid.firstRow = earlier.length ? Math.max(...earlier.map(endRow)) : 0
      grid.x = destination.x; grid.y = destination.y
      const moved = arrange(extraction.moved.map(cell => ({ ...cell, pageIndex: page.index, tableId, rowIndex: cell.rowIndex + grid.firstRow })), grid)
      planned = reflowRows(planned, [], fit(moved, []), { at: grid.firstRow })
    }
    return { scene: planned, movedIds }
  }

  function createContinuationPage(reference, index) {
    return {
      index, sourcePageIndex: null, isAdded: true, layoutContinuation: true,
      widthPx: reference.widthPx, heightPx: reference.heightPx,
      sourceWidth: reference.sourceWidth || reference.widthPx, sourceHeight: reference.sourceHeight || reference.heightPx,
      imageUrl: null, sourceFrame: { x: 0, y: 0, width: reference.widthPx, height: reference.heightPx },
      contentBounds: { ...reference.contentBounds },
      gridAvailableBounds: { ...(reference.gridAvailableBounds || reference.contentBounds) },
      languages: [], recognitionStats: { manualPage: true },
    }
  }

  // Plan the entire cascade on a copy. Table rows joined by vertical spans
  // form indivisible bands; other objects follow without losing their gaps.
  function reflowRows(scene, previous, next, options = {}) {
    if (!previous.length && !next.length) throw new Error('Выберите строки таблицы.')
    const oldGrid = previous.length ? geometry(previous) : { ...geometry(next), rows: 0, heights: [] }
    validate(next)
    const reference = previous[0] || next[0]
    const result = clone(scene), startPage = reference.pageIndex, tableId = reference.tableId
    const oldEnd = oldGrid.firstRow + oldGrid.rows
    const newGrid = next.length ? geometry(next) : null
    const rowDelta = (newGrid ? newGrid.firstRow + newGrid.rows : oldGrid.firstRow) - oldEnd
    const oldHeight = previous.length ? Math.max(...previous.map(cell => cell.y + cell.height)) - oldGrid.y : 0
    const heightDelta = (next.length ? Math.max(...next.map(cell => cell.y + cell.height)) - newGrid.y : 0) - oldHeight
    const at = options.at ?? oldGrid.firstRow
    const changeY = oldGrid.y + oldGrid.heights.slice(0, at - oldGrid.firstRow).reduce((sum, value) => sum + value, 0)
    const replaced = new Set(previous.map(cell => cell.id))
    result.objects = result.objects.filter(object => !replaced.has(object.id))
    for (const object of result.objects) {
      if (!object.excluded && object.pageIndex === startPage && object.y >= changeY - .01) object.y += heightDelta
    }
    result.objects.push(...clone(next))
    // Continuation fragments retain one logical row sequence, including old
    // files whose continuation indices incorrectly restarted at zero.
    let tableEnd = oldEnd + rowDelta
    for (let pageIndex = startPage + 1; pageIndex < result.pages.length; pageIndex++) {
      const cells = result.objects.filter(cell => !cell.excluded && cell.type === 'table_cell' && cell.tableId === tableId && cell.pageIndex === pageIndex)
      if (!cells.length) continue
      const first = Math.min(...cells.map(cell => cell.rowIndex))
      const shift = Math.max(tableEnd, first + rowDelta) - first
      for (const cell of cells) cell.rowIndex += shift
      tableEnd = Math.max(...cells.map(endRow))
    }
    const intersects = (a, b) => a.x < b.x + b.width - .01 && a.x + a.width > b.x + .01
      && a.y < b.y + b.height - .01 && a.y + a.height > b.y + .01
    const queues = result.pages.map(page => {
      const active = result.objects.filter(object => !object.excluded && object.pageIndex === page.index)
      const tables = new Map(), units = []
      const unit = objects => {
        const top = Math.min(...objects.map(object => object.y)), bottom = Math.max(...objects.map(object => object.y + object.height))
        return { top, height: bottom - top, reference: page,
          entries: objects.map(object => ({ object, x: object.x - page.contentBounds.x, y: object.y - top })) }
      }
      for (const object of active) {
        if (object.type === 'table_cell' && object.tableId) {
          if (!tables.has(object.tableId)) tables.set(object.tableId, [])
          tables.get(object.tableId).push(object)
        } else units.push(unit([object]))
      }
      for (const cells of tables.values()) {
        validate(cells)
        const ordered = [...cells].sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex)
        for (let index = 0; index < ordered.length;) {
          const group = [ordered[index++]]
          let end = endRow(group[0])
          while (index < ordered.length && ordered[index].rowIndex < end) {
            const cell = ordered[index++]
            group.push(cell); end = Math.max(end, endRow(cell))
          }
          units.push(unit(group))
        }
      }
      units.sort((a, b) => a.top - b.top || Math.min(...a.entries.map(item => item.x)) - Math.min(...b.entries.map(item => item.x)))
      const bands = []
      for (const item of units) {
        const last = bands.at(-1)
        if (last && (Math.abs(last.top - item.top) < .01 || item.top < last.top + last.height - .01)
          && !last.entries.some(a => item.entries.some(b => intersects(a.object, b.object)))) {
          last.entries.push(...item.entries.map(entry => ({ ...entry, y: entry.y + item.top - last.top })))
          last.height = Math.max(last.height, item.top - last.top + item.height)
        } else bands.push(item)
      }
      let bottom = page.contentBounds.y
      for (const band of bands) {
        band.gap = Math.max(0, band.top - bottom)
        bottom = band.top + band.height
      }
      return bands
    })
    const limit = options.maxPages ?? 400
    let carry = []
    for (let pageIndex = startPage; pageIndex === startPage || carry.length; pageIndex++) {
      const first = carry[0]
      const fits = (band, area) => band.height <= area.height + .01 && band.entries.every(entry => entry.x >= -.01 && entry.x + entry.object.width <= area.width + .01)
      if (first && (!result.pages[pageIndex] || !fits(first, result.pages[pageIndex].contentBounds))) {
        if (!fits(first, first.reference.contentBounds)) throw new Error('Строка или связанная группа больше целой рабочей области. Разделите объединение или уменьшите размер.')
        if (result.pages.length >= limit) throw new Error(`Макет превышает предел в ${limit} страниц.`)
        const page = createContinuationPage(first.reference, pageIndex)
        result.pages.splice(pageIndex, 0, page); queues.splice(pageIndex, 0, [])
        for (const object of result.objects) if (object.pageIndex >= pageIndex) object.pageIndex++
        result.pages.forEach((item, index) => { item.index = index })
      }
      const area = result.pages[pageIndex].contentBounds
      let pending = [...carry, ...queues[pageIndex]]
      carry = []
      let cursor = area.y
      if (pageIndex === startPage) {
        // Keep the header and earlier rows at their original coordinates.
        // They may occupy staggered positions in independent columns.
        let cutoff = changeY
        while (true) {
          const crossing = pending.filter(band => band.top < cutoff - .01 && band.top + band.height > cutoff + .01)
          if (!crossing.length) break
          cutoff = Math.min(...crossing.map(band => band.top))
        }
        const fixed = pending.filter(band => band.top < cutoff - .01)
        pending = pending.filter(band => !fixed.includes(band))
        cursor = Math.max(area.y, ...fixed.map(band => band.top + band.height))
        if (pending.length) pending[0] = { ...pending[0], gap: Math.max(0, pending[0].top - cursor) }
      }
      for (let index = 0; index < pending.length; index++) {
        const band = pending[index]
        if (!fits(band, band.reference.contentBounds)) throw new Error('Строка или связанная группа больше целой рабочей области. Разделите объединение или уменьшите размер.')
        const y = cursor + band.gap
        if (!fits(band, area) || y + band.height > area.y + area.height + .01) {
          carry = pending.slice(index)
          carry[0] = { ...carry[0], gap: 0 }
          break
        }
        for (const entry of band.entries) Object.assign(entry.object, {
          pageIndex, x: area.x + entry.x, y: y + entry.y, manualPosition: true,
        })
        cursor = y + band.height
      }
    }
    validate(result.objects.filter(object => !object.excluded && object.type === 'table_cell'))
    return result
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
  return { validate, geometry, arrange, snapToGrid, blank, resize, insert, copyRow, pasteRow, deleteRow, fitWidth, selectedRows, extractRows, insertRows, transferRows, createContinuationPage, reflowRows, merge, split }
})
