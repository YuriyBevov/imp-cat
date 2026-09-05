const DEFAULT_BATCH_PAGE_LIMIT = 2
const MAX_BATCH_PAGE_LIMIT = 4

function positiveInteger(value, fallback, minimum, maximum) {
  const number = Math.trunc(Number(value))
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function optionalPositiveInteger(value) {
  if (value == null || value === '') return null
  const number = Math.trunc(Number(value))
  return Number.isFinite(number) && number > 0 ? number : null
}

function planDocumentBatches(manifest, options = {}) {
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : []
  if (!pages.length) throw new Error('В документе нет страниц для анализа')
  const configuredLimit = positiveInteger(
    options.pageLimit,
    DEFAULT_BATCH_PAGE_LIMIT,
    1,
    MAX_BATCH_PAGE_LIMIT,
  )
  const modelMaxOutputTokens = optionalPositiveInteger(options.modelMaxOutputTokens)
  const pageLimit = configuredLimit
  const batchCount = Math.ceil(pages.length / pageLimit)
  const batches = []

  for (let offset = 0; offset < pages.length; offset += pageLimit) {
    const sourcePages = pages.slice(offset, offset + pageLimit)
    const batchIndex = batches.length
    batches.push({
      batchIndex,
      batchNumber: batchIndex + 1,
      batchCount,
      startPage: offset + 1,
      endPage: offset + sourcePages.length,
      maxOutputTokens: modelMaxOutputTokens,
      manifest: {
        documentPageCount: pages.length,
        batchNumber: batchIndex + 1,
        batchCount,
        pages: sourcePages.map((page, localIndex) => ({
          ...page,
          index: localIndex,
          documentPageIndex: offset + localIndex,
        })),
      },
    })
  }
  return batches
}

function uniqueStrings(values, limit = 20) {
  return [...new Set(values.map(String).map(value => value.trim()).filter(Boolean))].slice(0, limit)
}

function rebaseFlowGroup(value, localPageNumber, documentPageNumber) {
  const text = String(value || '')
  const localPrefix = new RegExp(`^page-${localPageNumber}(?=-|$)`, 'i')
  return localPrefix.test(text) ? text.replace(localPrefix, `page-${documentPageNumber}`) : text
}

function uniqueMergedSegmentId(rawId, documentPageNumber, segmentIndex, usedIds) {
  const prefix = `page-${documentPageNumber}-`
  const fallback = `segment-${segmentIndex + 1}`
  const raw = String(rawId || fallback).replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || fallback
  const base = `${prefix}${raw}`.slice(0, 120)
  let candidate = base
  let suffix = 2
  while (usedIds.has(candidate)) {
    const marker = `-${suffix}`
    candidate = `${base.slice(0, 120 - marker.length)}${marker}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function mergeBatchAnalyses(entries, manifest) {
  const manifestPages = Array.isArray(manifest?.pages) ? manifest.pages : []
  if (!manifestPages.length) throw new Error('В документе нет страниц для объединения')
  if (!Array.isArray(entries) || !entries.length) throw new Error('Нет результатов пакетного анализа')

  const pages = []
  const usedSegmentIds = new Set()
  const languages = []
  const rawOutputPaths = []
  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, reasoningTokens: 0, costRub: 0 }
  let documentTitle = ''
  let engine = ''
  let model = ''

  for (const entry of entries) {
    const analysis = entry?.analysis
    const batch = entry?.batch
    if (!analysis || !batch || !Array.isArray(analysis.pages)) throw new Error('Некорректный результат пакета')
    if (analysis.pages.length !== batch.manifest.pages.length) {
      throw new Error(`Пакет ${batch.batchNumber} вернул ${analysis.pages.length} стр. вместо ${batch.manifest.pages.length}`)
    }
    documentTitle ||= String(analysis.documentTitle || '')
    engine ||= String(analysis.engine || '')
    model ||= String(analysis.model || '')
    languages.push(...(Array.isArray(analysis.languages) ? analysis.languages : []))
    if (analysis.rawOutputPath) rawOutputPaths.push(analysis.rawOutputPath)
    if (Array.isArray(analysis.rawOutputPaths)) rawOutputPaths.push(...analysis.rawOutputPaths)
    for (const key of Object.keys(usage)) usage[key] += Number(analysis.usage?.[key] || 0)

    analysis.pages.forEach((page, localIndex) => {
      const documentPageIndex = batch.manifest.pages[localIndex].documentPageIndex
      const manifestPage = manifestPages[documentPageIndex]
      if (!manifestPage) throw new Error(`Пакет ${batch.batchNumber} ссылается на неизвестную страницу`)
      const documentPageNumber = documentPageIndex + 1
      const localPageNumber = localIndex + 1
      pages.push({
        ...page,
        index: documentPageIndex,
        width: Number(manifestPage.width),
        height: Number(manifestPage.height),
        image: String(manifestPage.image),
        segments: page.segments.map((segment, segmentIndex) => ({
          ...segment,
          segmentId: uniqueMergedSegmentId(segment.segmentId, documentPageNumber, segmentIndex, usedSegmentIds),
          flowGroup: rebaseFlowGroup(segment.flowGroup, localPageNumber, documentPageNumber),
        })),
      })
    })
  }

  pages.sort((left, right) => left.index - right.index)
  if (pages.length !== manifestPages.length || pages.some((page, index) => page.index !== index)) {
    throw new Error(`Пакетный анализ собрал ${pages.length} стр. вместо ${manifestPages.length}`)
  }

  return {
    engine,
    model,
    documentTitle,
    languages: uniqueStrings(languages),
    pages,
    generatedAt: new Date().toISOString(),
    usage,
    batchCount: entries.length,
    rawOutputPaths: uniqueStrings(rawOutputPaths, 400),
  }
}

module.exports = {
  DEFAULT_BATCH_PAGE_LIMIT,
  MAX_BATCH_PAGE_LIMIT,
  mergeBatchAnalyses,
  planDocumentBatches,
}
