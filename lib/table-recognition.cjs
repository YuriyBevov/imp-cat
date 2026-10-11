// Runs on fresh agent output, before translation and layout. Saved scenes are
// deliberately not migrated: a user's edits are not recognition evidence.
function bounds(segment) {
  const regions = segment.regions || []
  if (!regions.length) return null
  const x = Math.min(...regions.map(region => region.x))
  const y = Math.min(...regions.map(region => region.y))
  return {
    x, y,
    width: Math.max(...regions.map(region => region.x + region.width)) - x,
    height: Math.max(...regions.map(region => region.y + region.height)) - y,
  }
}

const signature = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

function columnTemplates(pages) {
  const templates = []
  for (const page of pages) {
    const groups = new Map()
    for (const segment of page.segments || []) {
      if (segment.type !== 'table_cell' || !Number.isInteger(segment.columnIndex) || !Number.isInteger(segment.rowIndex)) continue
      const key = segment.tableId || segment.flowGroup
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(segment)
    }
    for (const cells of groups.values()) {
      // A complete row of physical cells provides unambiguous column tracks.
      const rows = [...new Set(cells.map(cell => cell.rowIndex))].sort((a, b) => a - b)
      for (const row of rows) {
        const tracks = cells.filter(cell => cell.rowIndex === row).sort((a, b) => a.columnIndex - b.columnIndex)
        if (tracks.length < 2 || tracks.some((cell, index) => cell.columnIndex !== index || (cell.columnSpan || 1) !== 1 || (cell.rowSpan || 1) !== 1)) continue
        const rectangles = tracks.map(bounds)
        if (rectangles.some(rect => !rect || rect.width <= 0 || rect.height <= 0)) continue
        const left = rectangles[0].x
        const right = rectangles.at(-1).x + rectangles.at(-1).width
        if (rectangles.some((rect, index) => index && Math.abs(rectangles[index - 1].x + rectangles[index - 1].width - rect.x) > .003)) continue
        if (Math.max(...rectangles.map(rect => rect.y)) - Math.min(...rectangles.map(rect => rect.y)) > .003) continue
        const columns = rectangles.map(rect => ({ start: (rect.x - left) / (right - left), end: (rect.x + rect.width - left) / (right - left) }))
        templates.push({ pageIndex: page.index, tableId: tracks[0].tableId, flowGroup: tracks[0].flowGroup, rowIndex: row, columns, labels: tracks.map(cell => signature(cell.sourceText)) })
        break
      }
    }
  }
  return templates
}

function parseRows(segment) {
  const text = String(segment.sourceText || '')
  const lines = text.split(/\r?\n/u)
  // Newlines inside individual physical cells are never passed to this parser.
  const delimiter = text.includes('\t') ? '\t' : text.includes('|') ? '|' : null
  if (!delimiter || /\\\|/u.test(text)) return null
  const rows = lines.map(line => line.split(delimiter).map(field => field.trim()))
  if (rows.some(row => row.length < 2)) return null
  return rows
}

function recoverDelimitedTableSegments(analysis) {
  const pages = analysis.pages || []
  const templates = columnTemplates(pages)
  let segmentCount = pages.reduce((count, page) => count + (page.segments || []).length, 0)
  const usedIds = new Set(pages.flatMap(page => (page.segments || []).map(segment => segment.segmentId)))
  const uniqueId = (parent, row, column) => {
    const base = `${String(parent.segmentId || 'table').slice(0, 90)}-r${row}-c${column}`
    let id = base
    let suffix = 2
    while (usedIds.has(id)) id = `${base}-${suffix++}`
    usedIds.add(id)
    return id
  }
  return {
    ...analysis,
    pages: pages.map(page => {
      const groups = new Map()
      for (const segment of page.segments || []) {
        if (segment.type !== 'table') continue
        const key = segment.tableId || segment.flowGroup || segment.segmentId
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(segment)
      }
      const replacements = new Map()
      for (const [key, group] of groups) {
        const ordered = [...group].sort((a, b) => (bounds(a)?.y || 0) - (bounds(b)?.y || 0) || a.readingOrder - b.readingOrder)
        const parsed = new Map(ordered.map(segment => [segment, parseRows(segment)]))
        const bodyRows = ordered.flatMap(segment => parsed.get(segment) || [])
        if (!bodyRows.length) {
          if (ordered.some(segment => /[|\t]/u.test(String(segment.sourceText || '')))) {
            for (const segment of ordered) replacements.set(segment, [{ ...segment, needsReview: true,
              notes: [segment.notes, 'Структура таблицы неоднозначна: разделители не задают полные строки. Проверьте распознавание по оригиналу.'].filter(Boolean).join('\n') }])
          }
          continue
        }
        const count = Math.max(...bodyRows.map(row => row.length))
        const physical = (page.segments || []).filter(segment => segment.type === 'table_cell'
          && (segment.tableId === key || segment.flowGroup === key
            || group.some(part => part.flowGroup && part.flowGroup === segment.flowGroup)))
        const physicalRows = [...new Set(physical.map(cell => cell.rowIndex))]
        const containers = ordered.filter(segment => !String(segment.sourceText || '').trim())
        const plain = ordered.filter(segment => !parsed.get(segment) && !containers.includes(segment))
        const header = plain.length === 1 ? plain[0] : null
        const labels = header ? String(header.sourceText || '').split(/\r?\n/u).map(field => field.trim()) : []
        const valid = count >= 2 && count <= 100 && bodyRows.every(row => row.length === count)
          && (!plain.length || (labels.length === count && labels.every(Boolean) && ordered[0] === header))
          && (bodyRows.length >= 2 || labels.length === count)
          && containers.every(container => {
            const outer = bounds(container)
            return outer && ordered.filter(segment => parsed.get(segment)).every(segment => {
              const inner = bounds(segment)
              return inner && inner.x >= outer.x - .003 && inner.y >= outer.y - .003
                && inner.x + inner.width <= outer.x + outer.width + .003
                && inner.y + inner.height <= outer.y + outer.height + .003
            })
          })
          && ordered.every(segment => {
            const rect = bounds(segment)
            return rect && rect.width > 0 && rect.height > 0
          })
          && (!physical.length || (physicalRows.length === 1 && physical.length === count && !header
            && physical.every(cell => Number.isInteger(cell.rowIndex) && (cell.rowSpan || 1) === 1
              && bounds(cell)?.y + bounds(cell)?.height <= Math.min(...ordered.filter(part => parsed.get(part)).map(part => bounds(part)?.y ?? 0)) + .003)))
        if (!valid) {
          for (const segment of ordered) replacements.set(segment, [{ ...segment, needsReview: true,
            notes: [segment.notes, 'Структура таблицы неоднозначна: число полей строк и заголовков не совпадает. Проверьте распознавание по оригиналу.'].filter(Boolean).join('\n') }])
          continue
        }
        const localTemplate = physical.length ? templates.find(template => template.pageIndex === page.index
          && template.columns.length === count && template.rowIndex === physicalRows[0]
          && (template.tableId === physical[0].tableId || template.flowGroup === physical[0].flowGroup)) : null
        if (physical.length && !localTemplate) {
          for (const segment of ordered) replacements.set(segment, [{ ...segment, needsReview: true,
            notes: [segment.notes, 'Не удалось подтвердить колонки по ячейкам шапки. Проверьте структуру таблицы.'].filter(Boolean).join('\n') }])
          continue
        }
        const referenceLabels = labels.length ? labels : bodyRows[0]
        const compatible = templates.filter(template => template.columns.length === count
          && referenceLabels.every((label, index) => signature(label) && signature(label) === template.labels[index]))
        const candidates = compatible.sort((a, b) => Math.abs(a.pageIndex - page.index) - Math.abs(b.pageIndex - page.index))
        const template = localTemplate || candidates[0] || null
        const columns = template?.columns || Array.from({ length: count }, (_, index) => ({ start: index / count, end: (index + 1) / count }))
        segmentCount += (bodyRows.length + (header ? 1 : 0)) * count - group.length
        if (segmentCount > 10_000) throw new Error('После восстановления таблиц документ превышает предел в 10000 сегментов')
        let rowIndex = physical.length ? physicalRows[0] + 1 : 0
        const recoveredTableId = String(physical[0]?.tableId || group.find(part => part.tableId)?.tableId || `recovered-${page.index}-${key}`).slice(0, 120)
        for (const segment of ordered) {
          if (containers.includes(segment)) { replacements.set(segment, []); continue }
          const rect = bounds(segment)
          const rows = segment === header ? [labels] : parsed.get(segment)
          const cells = []
          for (const [localRow, fields] of rows.entries()) {
            for (const [columnIndex, text] of fields.entries()) {
              const column = columns[columnIndex]
              cells.push({
                ...segment,
                segmentId: uniqueId(segment, rowIndex, columnIndex),
                type: 'table_cell', sourceText: text, borders: null,
                tableId: recoveredTableId,
                rowIndex, columnIndex, rowSpan: 1, columnSpan: 1,
                regions: [{ x: rect.x + rect.width * column.start, y: rect.y + rect.height * localRow / rows.length,
                  width: rect.width * (column.end - column.start), height: rect.height / rows.length }],
                needsReview: Boolean(segment.needsReview || !template),
                notes: [segment.notes, template
                  ? 'Структура восстановлена из разделителей; ширины взяты из таблицы с совпадающими колонками в этом документе.'
                  : 'Структура восстановлена из разделителей. Точные ширины колонок не определены: проверьте равномерную сетку по оригиналу.'].filter(Boolean).join('\n'),
              })
            }
            rowIndex += 1
          }
          replacements.set(segment, cells)
        }
      }
      const segments = (page.segments || []).flatMap(segment => replacements.get(segment) || [segment])
      return { ...page, segments }
    }),
  }
}

module.exports = { recoverDelimitedTableSegments }
