const crypto = require('node:crypto')

const SERVICE_PATTERNS = [
  ['signature', /(?:^|[\s/.:;–—-])(?:подпись|signature|[İIıi]mza|firmado|unterschrift)(?=$|[\s/.:;–—-])/iu, 140],
  ['seal', /(?:кругл(?:ая|ой)\s+печат|round\s+seal|mühür|muhur|sello|seal[\s/-]*stamp)/iu, 500],
  ['stamp', /(?:штамп|stamp|kaşe|kase|damga)/iu, 500],
  ['logo', /(?:логотип|logo)/iu, 180],
]

const PLACEHOLDERS = {
  signature: '/Подпись/',
  seal: '/Круглая печать/',
  stamp: '/Штамп/',
  logo: '/Логотип/',
  image: '/Изображение/',
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0))
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function classifyText(text) {
  const value = String(text || '').trim()
  for (const [type, pattern, maximumLength] of SERVICE_PATTERNS) {
    if (type === 'signature') {
      const signatureLabel = /^(?:\/|\s)*(?:\d+[.)-]?\s*)?(?:подпись|signature|[İIıi]mza|firmado|unterschrift)(?=$|[\s/.:;–—-])/iu
      if (value.length <= maximumLength && signatureLabel.test(value)) return type
      continue
    }
    if (value.length <= maximumLength && pattern.test(value)) return type
  }
  return 'text'
}

function looksLikeHeading(text) {
  const letters = String(text).match(/\p{L}/gu) || []
  if (letters.length < 4 || letters.length > 100) return false
  const upper = letters.filter(letter => letter === letter.toUpperCase()).length
  return upper / letters.length >= 0.78
}

function horizontalOverlap(left, right) {
  const intersection = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x))
  return intersection / Math.max(1, Math.min(left.width, right.width))
}

function normalizeLines(page, displayWidth, displayHeight, containSource) {
  const scale = containSource
    ? Math.min((displayWidth - 80) / page.width, (displayHeight - 80) / page.height)
    : displayWidth / page.width
  const offsetX = containSource ? (displayWidth - page.width * scale) / 2 : 0
  const offsetY = containSource ? (displayHeight - page.height * scale) / 2 : 0
  const maximumLineHeight = displayWidth * 0.07
  return (page.lines || [])
    .filter(line => String(line.text || '').trim())
    .map((line, index) => ({
      id: `line-${page.index + 1}-${index + 1}`,
      text: String(line.text).trim(),
      confidence: clamp(line.confidence, 0, 1),
      alternatives: Array.isArray(line.alternatives)
        ? line.alternatives.map(value => String(value).trim()).filter(Boolean).slice(0, 4)
        : [],
      x: clamp(offsetX + line.x * scale, 0, displayWidth),
      y: clamp(offsetY + line.y * scale, 0, displayHeight),
      width: clamp(line.width * scale, 1, displayWidth),
      // Vision occasionally returns the bounding box of an entire decorative
      // emblem for one recognized line. Capping the typographic height keeps
      // such observations editable without changing their source position.
      height: clamp(line.height * scale, 4, maximumLineHeight),
    }))
    .sort((left, right) => left.y - right.y || left.x - right.x)
}

function canJoin(group, line) {
  const previous = group.lines[group.lines.length - 1]
  const groupType = classifyText(group.lines.map(item => item.text).join(' '))
  const lineType = classifyText(line.text)
  if (groupType !== 'text' || lineType !== 'text') return false
  if (looksLikeHeading(previous.text) || looksLikeHeading(line.text)) return false
  if (group.lines.length >= 8 || group.characterCount + line.text.length > 800) return false

  const previousWords = previous.text.trim().split(/\s+/u).length
  const lineWords = line.text.trim().split(/\s+/u).length
  // Names, headings and degree labels are often followed by a long paragraph
  // at nearly the same vertical coordinate. They must stay independently
  // editable even when their Vision rectangles overlap slightly.
  if (previousWords <= 7 && lineWords >= 9) return false

  const gap = line.y - (previous.y + previous.height)
  const typicalHeight = median(group.lines.map(item => item.height)) || previous.height
  if (gap < -typicalHeight * 0.3 || gap > Math.max(7, typicalHeight * 0.64)) return false

  const overlap = horizontalOverlap(previous, line)
  const leftAligned = Math.abs(previous.x - line.x) <= Math.max(30, typicalHeight * 2.2)
  const centered = Math.abs((previous.x + previous.width / 2) - (line.x + line.width / 2)) <= 36
  return overlap >= 0.25 || leftAligned || (centered && gap <= typicalHeight * 0.45)
}

function groupLines(lines) {
  const groups = []
  for (const line of lines) {
    const candidate = [...groups].reverse().find(group => canJoin(group, line))
    if (!candidate) {
      groups.push({ lines: [line], characterCount: line.text.length })
      continue
    }
    candidate.lines.push(line)
    candidate.characterCount += line.text.length
  }
  return groups
}

function inferAlignment(bounds, pageWidth, lines) {
  const center = bounds.x + bounds.width / 2
  const pageCenter = pageWidth / 2
  if (Math.abs(center - pageCenter) < pageWidth * 0.08 && lines.every(line => line.width < pageWidth * 0.78)) {
    return 'center'
  }
  if (bounds.x > pageWidth * 0.58) return 'right'
  return 'left'
}

function createObject(pageIndex, pageWidth, group, index) {
  const x = Math.min(...group.lines.map(line => line.x))
  const y = Math.min(...group.lines.map(line => line.y))
  const right = Math.max(...group.lines.map(line => line.x + line.width))
  const bottom = Math.max(...group.lines.map(line => line.y + line.height))
  const text = group.lines.map(line => line.text).join('\n')
  let type = classifyText(text)
  const lineHeightPx = median(group.lines.map(line => line.height)) || 16
  const measuredFontSize = clamp(lineHeightPx * 0.82, 8, 28)
  const heading = looksLikeHeading(text) || (measuredFontSize >= 22 && text.length <= 80)
  let fontSizePx = heading ? measuredFontSize : Math.min(measuredFontSize, text.length > 180 ? 16 : 18)
  const bounds = {
    x: Math.max(0, x - 2),
    y: Math.max(0, y - 2),
    width: Math.max(24, right - x + 4),
    height: Math.max(fontSizePx * 1.35, bottom - y + 5),
  }
  if (
    type === 'text'
    && group.lines.length === 1
    && looksLikeHeading(text)
    && bounds.width < 90
    && bounds.height > bounds.width * 0.85
  ) type = 'logo'
  if (type !== 'text') {
    fontSizePx = Math.min(fontSizePx, 14)
    bounds.width = Math.max(bounds.width, 140)
    bounds.height = Math.max(26, Math.min(bounds.height, 44))
    bounds.x = Math.min(bounds.x, Math.max(0, pageWidth - bounds.width))
  }
  return {
    id: `object-${pageIndex + 1}-${index + 1}-${crypto.randomBytes(3).toString('hex')}`,
    pageIndex,
    type,
    readingOrder: index + 1,
    sourceText: text,
    translation: type === 'text' ? '' : PLACEHOLDERS[type],
    confidence: Number((group.lines.reduce((sum, line) => sum + line.confidence, 0) / group.lines.length).toFixed(4)),
    ...bounds,
    rotation: 0,
    excluded: /scanned\s+with\s+camscanner/iu.test(text),
    status: type === 'text' ? 'recognized' : 'classified',
    style: {
      fontFamily: 'Arial',
      fontSizePx: Number(fontSizePx.toFixed(2)),
      fontWeight: heading ? 700 : 400,
      fontStyle: /(?:\/[^/]+\/|\([^)]*(?:seal|stamp|signature|imza|mühür)[^)]*\))/iu.test(text) ? 'italic' : 'normal',
      textAlign: inferAlignment(bounds, pageWidth, group.lines),
      lineHeight: 1.2,
      color: '#111827',
    },
    sourceLineIds: group.lines.map(line => line.id),
    ocrAlternatives: group.lines.flatMap(line => line.alternatives || []).filter(value => value && value !== text).slice(0, 12),
    originalBounds: bounds,
  }
}

function buildScene(analysis, options = {}) {
  const displayWidth = clamp(options.displayWidth || 794, 600, 1_400)
  const pages = []
  const objects = []
  for (const page of analysis.pages || []) {
    const heightPx = options.fitRasterToA4 ? 1123 : Number((page.height / page.width * displayWidth).toFixed(2))
    const sourceScale = options.fitRasterToA4
      ? Math.min((displayWidth - 80) / page.width, (heightPx - 80) / page.height)
      : displayWidth / page.width
    const sourceFrame = {
      x: options.fitRasterToA4 ? (displayWidth - page.width * sourceScale) / 2 : 0,
      y: options.fitRasterToA4 ? (heightPx - page.height * sourceScale) / 2 : 0,
      width: page.width * sourceScale,
      height: page.height * sourceScale,
    }
    const lines = normalizeLines(page, displayWidth, heightPx, Boolean(options.fitRasterToA4))
    const pageObjects = groupLines(lines).map((group, index) => createObject(page.index, displayWidth, group, index))
    pageObjects.sort((left, right) => left.y - right.y || left.x - right.x)
    pageObjects.forEach((object, index) => { object.readingOrder = index + 1 })
    const content = pageObjects.length ? {
      x: Math.max(0, Math.min(...pageObjects.map(object => object.x)) - 12),
      y: Math.max(0, Math.min(...pageObjects.map(object => object.y)) - 12),
      right: Math.min(displayWidth, Math.max(...pageObjects.map(object => object.x + object.width)) + 12),
      bottom: Math.min(heightPx, Math.max(...pageObjects.map(object => object.y + object.height)) + 12),
    } : { x: 40, y: 40, right: displayWidth - 40, bottom: heightPx - 40 }
    pages.push({
      index: page.index,
      widthPx: displayWidth,
      heightPx,
      sourceWidth: page.width,
      sourceHeight: page.height,
      imageUrl: `/api/studio/documents/${options.documentId}/pages/${page.index}/image`,
      sourceFrame,
      contentBounds: {
        x: content.x,
        y: content.y,
        width: Math.max(1, content.right - content.x),
        height: Math.max(1, content.bottom - content.y),
      },
      ocrStats: {
        primaryLines: Number(page.primaryLineCount || page.lines?.length || 0),
        secondaryLines: Number(page.secondaryLineCount || 0),
        mergedLines: lines.length,
      },
    })
    objects.push(...pageObjects)
  }
  return {
    version: 1,
    documentId: options.documentId,
    title: options.title || 'Документ',
    sourceLanguage: options.sourceLanguage || 'auto',
    targetLanguage: options.targetLanguage || 'ru',
    pages,
    objects,
    updatedAt: new Date().toISOString(),
  }
}

function objectText(object) {
  return String(object.translation || object.sourceText || '').trim()
}

function rectangleIntersectionRatio(first, second) {
  const width = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x))
  const height = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y))
  const smaller = Math.min(first.width * first.height, second.width * second.height)
  return smaller > 0 ? width * height / smaller : 0
}

function validateScene(scene) {
  const warnings = []
  const pages = new Map((scene.pages || []).map(page => [page.index, page]))
  const active = (scene.objects || []).filter(object => !object.excluded)
  for (const object of active) {
    const page = pages.get(object.pageIndex)
    if (!page) {
      warnings.push({ severity: 'error', code: 'missing-page', objectIds: [object.id], message: 'Объект не привязан к странице' })
      continue
    }
    if (object.x < 0 || object.y < 0 || object.x + object.width > page.widthPx || object.y + object.height > page.heightPx) {
      warnings.push({ severity: 'error', code: 'outside-page', objectIds: [object.id], message: 'Объект выходит за границу страницы' })
    }
    if (object.confidence < 0.76) {
      warnings.push({ severity: 'warning', code: 'low-confidence', objectIds: [object.id], message: 'Низкая уверенность OCR — проверьте исходный текст' })
    }
    if (object.type === 'text' && !String(object.translation || '').trim()) {
      warnings.push({ severity: 'warning', code: 'missing-translation', objectIds: [object.id], message: 'Нет перевода' })
    }
    if (!objectText(object)) {
      warnings.push({ severity: 'error', code: 'empty-object', objectIds: [object.id], message: 'Пустой объект не попадёт в экспорт' })
    }
    const fontSize = clamp(object.style?.fontSizePx || 14, 6, 96)
    const estimatedCharactersPerLine = Math.max(1, object.width / Math.max(3, fontSize * 0.52))
    const estimatedLines = objectText(object).split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / estimatedCharactersPerLine)), 0)
    const requiredHeight = estimatedLines * fontSize * clamp(object.style?.lineHeight || 1.2, 0.8, 3)
    if (requiredHeight > object.height * 1.18) {
      warnings.push({ severity: 'warning', code: 'text-overflow', objectIds: [object.id], message: 'Текст может не поместиться в границы сегмента' })
    }
  }

  const byPage = new Map()
  for (const object of active) {
    const list = byPage.get(object.pageIndex) || []
    list.push(object)
    byPage.set(object.pageIndex, list)
  }
  for (const pageObjects of byPage.values()) {
    for (let leftIndex = 0; leftIndex < pageObjects.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < pageObjects.length; rightIndex += 1) {
        const left = pageObjects[leftIndex]
        const right = pageObjects[rightIndex]
        if (rectangleIntersectionRatio(left, right) >= 0.18) {
          warnings.push({
            severity: 'warning',
            code: 'overlap',
            objectIds: [left.id, right.id],
            message: 'Сегменты заметно перекрываются',
          })
        }
      }
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      errors: warnings.filter(item => item.severity === 'error').length,
      warnings: warnings.filter(item => item.severity === 'warning').length,
      objects: active.length,
      translated: active.filter(item => item.type !== 'text' || String(item.translation || '').trim()).length,
    },
    warnings,
  }
}

function normalizeMemoryText(value) {
  return String(value || '')
    .toLocaleLowerCase('ru')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function tokenSimilarity(left, right) {
  const first = new Set(normalizeMemoryText(left).split(' ').filter(Boolean))
  const second = new Set(normalizeMemoryText(right).split(' ').filter(Boolean))
  if (!first.size || !second.size) return 0
  let intersection = 0
  for (const token of first) if (second.has(token)) intersection += 1
  return intersection / (first.size + second.size - intersection)
}

function findMemoryMatches(entries, query, targetLanguage, limit = 5) {
  const normalized = normalizeMemoryText(query)
  return (entries || [])
    .filter(entry => !targetLanguage || entry.targetLanguage === targetLanguage)
    .map(entry => ({
      ...entry,
      score: normalizeMemoryText(entry.sourceText) === normalized ? 1 : tokenSimilarity(entry.sourceText, query),
    }))
    .filter(entry => entry.score >= 0.28)
    .sort((left, right) => right.score - left.score || String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, limit)
}

function normalizeSuggestionText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function buildOcrReview(scene, providerSuggestions = []) {
  const suggestions = []
  const knownIds = new Map((scene.objects || []).map(object => [object.id, object]))
  const seen = new Set()
  const add = suggestion => {
    const objectId = suggestion.objectId ? String(suggestion.objectId) : null
    const object = objectId ? knownIds.get(objectId) : null
    if (objectId && !object) return
    const originalText = object ? String(object.sourceText || '') : String(suggestion.originalText || '').trim()
    const suggestedText = String(suggestion.suggestedText || '').trim()
    if (suggestedText && normalizeSuggestionText(suggestedText) === normalizeSuggestionText(originalText)) return
    const key = `${objectId || 'page'}|${normalizeSuggestionText(suggestedText)}|${suggestion.kind || 'manual-check'}`
    if (seen.has(key)) return
    seen.add(key)
    suggestions.push({
      id: `ocr-${suggestions.length + 1}`,
      objectId,
      pageIndex: Number.isInteger(suggestion.pageIndex) ? suggestion.pageIndex : object?.pageIndex ?? 0,
      originalText,
      suggestedText,
      confidence: clamp(suggestion.confidence ?? 0.5, 0, 1),
      kind: String(suggestion.kind || 'manual-check').slice(0, 40),
      reason: String(suggestion.reason || 'Текст требует проверки по оригиналу').slice(0, 500),
      source: suggestion.source === 'agent' ? 'agent' : 'local',
      applicable: Boolean(objectId && suggestedText),
    })
  }

  for (const object of scene.objects || []) {
    if (object.excluded || object.type !== 'text') continue
    const text = String(object.sourceText || '').trim()
    if (!text) continue
    const alternatives = Array.isArray(object.ocrAlternatives) ? object.ocrAlternatives : []
    if (object.confidence < 0.76) {
      const alternative = alternatives.find(value => normalizeSuggestionText(value) !== normalizeSuggestionText(text))
      add({
        objectId: object.id,
        originalText: text,
        suggestedText: alternative || '',
        confidence: alternative ? Math.max(0.45, object.confidence) : 0.35,
        kind: alternative ? 'ocr-alternative' : 'low-confidence',
        reason: alternative
          ? 'OCR дал другой вариант для этой области; сравните оба варианта с оригиналом'
          : 'Низкая уверенность OCR; необходимо сверить сегмент с оригиналом',
      })
    }

    let contextual = text
      .replace(/\bUniveristy\b/giu, 'University')
      .replace(/\b[A-Za-z]{5,}(?:sity|city)\s+uf(?=\s+New\s+[A-Z])/gu, 'University of')
      .replace(/(\b(?:School|Faculty)\s+of\s+)tau\b/giu, '$1Law')
    if (contextual !== text) {
      add({
        objectId: object.id,
        originalText: text,
        suggestedText: contextual,
        confidence: 0.86,
        kind: 'context-ocr',
        reason: 'Контекст устойчивого названия или учебной формулировки указывает на ошибку OCR',
      })
    }

    let proposed = text
    proposed = proposed.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    proposed = proposed.replace(/([,;:!?])(\p{L})/gu, '$1 $2')
    if (proposed !== text) {
      add({ objectId: object.id, originalText: text, suggestedText: proposed, confidence: 0.78, kind: 'joined-words', reason: 'Обнаружена вероятная склейка слов или пропущенный пробел' })
    }

    const tokens = text.match(/[\p{L}\p{N}]+/gu) || []
    const suspiciousToken = tokens.find(token => (
      token.length >= 26
      || (/\p{Script=Cyrillic}/u.test(token) && /\p{Script=Latin}/u.test(token))
    ))
    if (suspiciousToken) {
      add({ objectId: object.id, originalText: text, confidence: 0.42, kind: 'suspicious-token', reason: `Подозрительное слово «${suspiciousToken}»: возможна склейка или смешение алфавитов` })
    }
    if (/\uFFFD|[|]{3,}|_{4,}/u.test(text)) {
      add({ objectId: object.id, originalText: text, confidence: 0.55, kind: 'ocr-artifact', reason: 'Обнаружены символы, похожие на артефакты распознавания' })
    }
  }

  for (const page of scene.pages || []) {
    const pageObjects = (scene.objects || []).filter(object => object.pageIndex === page.index && !object.excluded && String(object.sourceText || '').trim())
    const characters = pageObjects.reduce((sum, object) => sum + String(object.sourceText || '').length, 0)
    if (pageObjects.length < 2 || characters < 24) {
      add({ pageIndex: page.index, confidence: 0.3, kind: 'page-completeness', reason: `На странице ${page.index + 1} найдено мало текста. Проверьте, не пропущены ли области оригинала` })
    }
  }

  for (const suggestion of providerSuggestions || []) add({ ...suggestion, source: 'agent' })
  suggestions.sort((left, right) => right.confidence - left.confidence || left.pageIndex - right.pageIndex)
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      total: suggestions.length,
      agent: suggestions.filter(item => item.source === 'agent').length,
      applicable: suggestions.filter(item => item.applicable).length,
      highConfidence: suggestions.filter(item => item.applicable && item.confidence >= 0.82).length,
    },
    suggestions,
  }
}

module.exports = {
  PLACEHOLDERS,
  buildScene,
  buildOcrReview,
  classifyText,
  findMemoryMatches,
  normalizeMemoryText,
  validateScene,
}
