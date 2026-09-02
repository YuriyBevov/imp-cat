const MAX_PAGES = 400
const MAX_SEGMENTS = 10_000
const MAX_TEXT_LENGTH = 100_000
const MAX_RUNS_PER_SEGMENT = 5_000
const DEFAULT_GRID_SIZE = 4

function validationError(message) {
  const error = new Error(message)
  error.code = 'VALIDATION_ERROR'
  return error
}

function finiteNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function normalizeExportPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Некорректное тело запроса')
  }
  if (!Array.isArray(body.pages) || body.pages.length === 0 || body.pages.length > MAX_PAGES) {
    throw validationError(`Документ должен содержать от 1 до ${MAX_PAGES} страниц`)
  }
  if (!Array.isArray(body.segments) || body.segments.length === 0 || body.segments.length > MAX_SEGMENTS) {
    throw validationError(`Документ должен содержать от 1 до ${MAX_SEGMENTS} сегментов`)
  }

  const gridSize = finiteNumber(body.gridSize, DEFAULT_GRID_SIZE, 1, 96)
  const pages = body.pages.map((page, index) => ({
    id: String(page?.id || `page-${index + 1}`).slice(0, 100),
    index,
    widthPx: finiteNumber(page?.widthPx, 793.7, 200, 2_112),
    heightPx: finiteNumber(page?.heightPx, 1122.5, 200, 2_112),
  }))

  const seenIds = new Set()
  const segments = body.segments.map((segment, index) => {
    const id = String(segment?.id || `segment-${index + 1}`).slice(0, 100)
    if (seenIds.has(id)) throw validationError(`Повторяющийся ID сегмента: ${id}`)
    seenIds.add(id)

    const pageIndex = Number.parseInt(segment?.pageIndex, 10)
    if (!Number.isInteger(pageIndex) || !pages[pageIndex]) {
      throw validationError(`Некорректная страница сегмента ${id}`)
    }
    if (typeof segment?.text !== 'string' || segment.text.length > MAX_TEXT_LENGTH) {
      throw validationError(`Некорректный текст сегмента ${id}`)
    }

    const page = pages[pageIndex]
    const style = segment?.style && typeof segment.style === 'object' ? segment.style : segment
    const width = finiteNumber(segment.width, Math.min(600, page.widthPx), 16, page.widthPx)
    const height = finiteNumber(segment.height, 32, 16, page.heightPx)
    const x = finiteNumber(segment.x, 0, 0, Math.max(0, page.widthPx - width))
    const y = finiteNumber(segment.y, 0, 0, Math.max(0, page.heightPx - height))
    const color = /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : '#111827'
    const requestedAlignment = style.textAlign || style.alignment
    const alignment = ['left', 'center', 'right', 'justify'].includes(requestedAlignment)
      ? requestedAlignment
      : 'left'
    const fontWeight = finiteNumber(style.fontWeight, 400, 100, 900)
    const fontStyleValue = String(style.fontStyle || '').toLowerCase()
    const fontStyle = fontStyleValue === 'italic' || fontStyleValue.startsWith('oblique') ? 'italic' : 'normal'
    let runs = Array.isArray(segment.runs)
      ? segment.runs.slice(0, MAX_RUNS_PER_SEGMENT).map(run => {
        const normalizedRun = {
          text: typeof run?.text === 'string' ? run.text : '',
          fontFamily: String(run?.fontFamily || style.fontFamily || 'Arial').slice(0, 200),
          fontSizePx: finiteNumber(run?.fontSizePx, style.fontSizePx || 16, 6, 96),
          fontWeight: finiteNumber(run?.fontWeight, fontWeight, 100, 900),
          fontStyle: String(run?.fontStyle || '').toLowerCase() === 'italic'
            || String(run?.fontStyle || '').toLowerCase().startsWith('oblique') ? 'italic' : 'normal',
          color: /^#[0-9a-f]{6}$/i.test(run?.color) ? run.color : color,
          backgroundColor: /^#[0-9a-f]{6}$/i.test(run?.backgroundColor) ? run.backgroundColor : null,
        }
        const tabWidthPx = finiteNumber(run?.tabWidthPx, 0, 0, page.widthPx)
        const tabStopPx = finiteNumber(run?.tabStopPx, 0, 0, page.widthPx)
        if (tabWidthPx > 0) normalizedRun.tabWidthPx = tabWidthPx
        if (tabStopPx > 0) normalizedRun.tabStopPx = tabStopPx
        return normalizedRun
      }).filter(run => run.text)
      : []
    if (!runs.length || runs.map(run => run.text).join('') !== segment.text) {
      runs = [{
        text: segment.text,
        fontFamily: String(style.fontFamily || 'Arial').slice(0, 200),
        fontSizePx: finiteNumber(style.fontSizePx, 16, 6, 96),
        fontWeight,
        fontStyle,
        color,
        backgroundColor: null,
      }]
    }

    return {
      id,
      pageIndex,
      text: segment.text,
      x,
      y,
      width,
      height,
      rotation: finiteNumber(segment.rotation, 0, -360, 360),
      cellId: `P${pageIndex + 1}:R${Math.floor(y / gridSize) + 1}:C${Math.floor(x / gridSize) + 1}`,
      zIndex: Math.round(finiteNumber(segment.zIndex, index + 1, 0, 100_000)),
      fontFamily: String(style.fontFamily || 'Arial').slice(0, 200),
      fontSizePx: finiteNumber(style.fontSizePx, 16, 6, 96),
      fontWeight,
      fontStyle,
      lineHeight: finiteNumber(style.lineHeight, 1.2, 0.8, 3),
      color,
      alignment,
      runs,
    }
  })

  return {
    title: String(body.title || 'icat-grid-export').trim().slice(0, 200) || 'icat-grid-export',
    gridSize,
    pages,
    segments,
  }
}

module.exports = {
  MAX_PAGES,
  MAX_SEGMENTS,
  MAX_TEXT_LENGTH,
  MAX_RUNS_PER_SEGMENT,
  normalizeExportPayload,
}
