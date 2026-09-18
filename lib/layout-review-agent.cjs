const fs = require('node:fs')
const path = require('node:path')
const { parseJsonObject, responseFormat, textContent } = require('./api-document-agent.cjs')

function finiteOrNull(value, minimum, maximum) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : null
}

function buildLayoutReviewPrompt(page, objects, options = {}) {
  const compactObjects = objects.map(object => ({
    id: object.id,
    type: object.type,
    sourceText: String(object.sourceText || '').slice(0, 500),
    translatedText: String(object.translation || object.sourceText || '').slice(0, 500),
    x: object.x, y: object.y, width: object.width, height: object.height,
    fontSizePx: object.style?.fontSizePx,
    fontWeight: object.style?.fontWeight,
    fontStyle: object.style?.fontStyle,
    textAlign: object.style?.textAlign,
    originalBounds: object.originalBounds,
    locks: {
      position: Boolean(object.manualPosition),
      width: object.manualWidth !== false,
      height: object.manualHeight !== false,
      typography: Boolean(object.manualTypography),
    },
  }))
  return [
    `Сравните оригинал и текущий собранный макет страницы ${page.index + 1}.`,
    `Это итерация ${Math.max(1, Number(options.iteration) || 1)} из ${Math.max(1, Number(options.totalIterations) || 1)}.`,
    `Размер рабочей страницы: ${page.widthPx}×${page.heightPx} CSS px.`,
    'Первое изображение — оригинал, второе — текущая сборка.',
    page.isAdded
      ? 'Это страница продолжения: оригинал дан только для структуры и типографики перенесённых объектов. Размещение от верхнего поля и отсутствие остальных объектов оригинала правильны. Не возвращайте объекты к исходной вертикальной координате и не считайте перенос ошибкой.'
      : 'Часть перевода могла перейти на страницы продолжения. Отсутствие этих объектов на текущем листе не является ошибкой.',
    'Найдите расхождения положения, размеров и базовой типографики. Особенно внимательно проверьте штампы, печати, подписи, колонтитулы и таблицы.',
    'Не меняйте и не переводите текст. Предлагайте только координаты x/y, ширину/высоту, размер шрифта и выравнивание.',
    'Не предлагайте изменение свойства, если соответствующий ему locks-флаг равен true. Не допускайте наложения сегментов и выхода за рабочую область.',
    'Учитывайте реальную длину переведенного текста: рамка должна вмещать его без разрыва слов, но оставаться максимально близкой к оригиналу.',
    'Координаты результата должны быть абсолютными CSS px относительно левого верхнего угла страницы. Для неизменяемых полей возвращайте null.',
    'Добавляйте adjustment только если изменение реально улучшает сходство. confidence ниже 0.72 будет оставлен рекомендацией без автоматического применения.',
    `Редактируемые объекты: ${JSON.stringify(compactObjects)}.`,
    'Верните только JSON по заданной схеме.',
  ].join(' ')
}

function normalizeLayoutReview(raw, page, objects) {
  if (!raw || !Array.isArray(raw.pages)) throw new Error('Агент не вернул сравнение страниц')
  const existing = new Set(objects.map(object => object.id))
  const rawPage = raw.pages.find(item => Number(item?.pageIndex) === page.index) || raw.pages[0]
  const adjustments = []
  for (const candidate of Array.isArray(rawPage?.adjustments) ? rawPage.adjustments : []) {
    const objectId = String(candidate?.objectId || '')
    if (!existing.has(objectId)) continue
    adjustments.push({
      objectId,
      x: finiteOrNull(candidate.x, 0, page.widthPx * 2),
      y: finiteOrNull(candidate.y, 0, page.heightPx * 2),
      width: finiteOrNull(candidate.width, 12, page.widthPx * 2),
      height: finiteOrNull(candidate.height, 12, page.heightPx * 2),
      fontSizePx: finiteOrNull(candidate.fontSizePx, 6, 96),
      textAlign: ['left', 'center', 'right', 'justify'].includes(candidate.textAlign) ? candidate.textAlign : null,
      confidence: finiteOrNull(candidate.confidence, 0, 1) ?? 0,
      reason: String(candidate.reason || '').slice(0, 500),
    })
  }
  return {
    summary: String(raw.summary || '').slice(0, 2_000),
    pageIndex: page.index,
    similarity: finiteOrNull(rawPage?.similarity, 0, 1) ?? 0,
    findings: (Array.isArray(rawPage?.findings) ? rawPage.findings : []).map(String).slice(0, 100),
    adjustments,
  }
}

async function reviewLayoutWithAitunnel(options) {
  const schema = JSON.parse(await fs.promises.readFile(options.schemaPath, 'utf8'))
  const images = await Promise.all([options.originalImagePath, options.currentImagePath].map(filename => fs.promises.readFile(filename)))
  const content = [
    { type: 'text', text: buildLayoutReviewPrompt(options.page, options.objects, options) },
    { type: 'text', text: 'ОРИГИНАЛ:' },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${images[0].toString('base64')}`, detail: 'high' } },
    { type: 'text', text: 'ТЕКУЩАЯ СБОРКА:' },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${images[1].toString('base64')}`, detail: 'high' } },
  ]
  const timeoutSignal = AbortSignal.timeout(options.timeoutMs || 900_000)
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal
  const request = async strict => {
    const response = await (options.fetchImpl || fetch)(options.apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        reasoning: { effort: 'minimal', exclude: true },
        response_format: responseFormat(schema, strict),
        messages: [{ role: 'system', content: 'Вы — технический корректор макета документов. Сравнивайте страницы визуально и возвращайте только безопасные точные корректировки JSON.' }, { role: 'user', content }],
      }),
      signal,
    })
    let payload
    try { payload = await response.json() } catch { payload = null }
    return { response, payload }
  }
  let { response, payload } = await request(true)
  if (!response.ok && [400, 422].includes(response.status)) ({ response, payload } = await request(false))
  if (!response.ok) {
    const detail = String(payload?.error?.message || payload?.message || '').split(options.apiKey).join('[REDACTED]').slice(0, 500)
    throw new Error(`AITunnel layout review: HTTP ${response.status}${detail ? ` · ${detail}` : ''}`)
  }
  const contentText = textContent(payload?.choices?.[0]?.message?.content)
    || textContent(payload?.choices?.[0]?.message?.parsed)
    || textContent(payload?.choices?.[0]?.text)
  await fs.promises.writeFile(options.outputPath, JSON.stringify({ response: contentText, usage: payload?.usage || null }, null, 2), 'utf8')
  return normalizeLayoutReview(parseJsonObject(contentText), options.page, options.objects)
}

async function reviewLayoutWithCodex(options) {
  const prompt = buildLayoutReviewPrompt(options.page, options.objects, options)
  const args = [
    'exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--model', options.model,
    '--sandbox', 'read-only', '--color', 'never', '--cd', options.workdir,
    '--image', options.originalImagePath, '--image', options.currentImagePath,
    '--output-schema', options.schemaPath, '--output-last-message', options.outputPath, prompt,
  ]
  const result = await options.runProcess(options.codexBin, args, options.timeoutMs || 900_000, { signal: options.signal })
  if (result.code !== 0) throw new Error(String(result.stderr || result.stdout || `Codex завершился с кодом ${result.code}`).trim().slice(-2_000))
  const raw = JSON.parse(await fs.promises.readFile(options.outputPath, 'utf8'))
  return normalizeLayoutReview(raw, options.page, options.objects)
}

function pageGridSize(page) {
  return 17
}

function snapToGrid(value, origin, size) {
  return origin + Math.round((value - origin) / size) * size
}

function estimatedTextGeometry(object, width) {
  const text = String(object.translation || object.sourceText || ' ')
  const fontSize = Math.max(6, Number(object.style?.fontSizePx) || 14)
  const lineHeight = Math.max(0.8, Number(object.style?.lineHeight) || 1.2)
  const characterWidth = fontSize * 0.56
  const longestWord = text.split(/[\s\u200b]+/u).reduce((longest, part) => Math.max(longest, part.length), 1)
  const minimumWidth = Math.max(12, longestWord * characterWidth + 10)
  const innerWidth = Math.max(4, width - 8)
  const lines = text.split('\n').reduce((total, sourceLine) => {
    const words = sourceLine.trim().split(/\s+/u).filter(Boolean)
    if (!words.length) return total + 1
    let count = 1
    let used = 0
    for (const word of words) {
      const wordWidth = word.length * characterWidth
      const next = used ? used + characterWidth * 0.5 + wordWidth : wordWidth
      if (used && next > innerWidth) {
        count += 1
        used = wordWidth
      } else used = next
    }
    return total + count
  }, 0)
  return { minimumWidth, minimumHeight: Math.max(12, lines * fontSize * lineHeight + 4) }
}

function rectanglesOverlap(first, second, tolerance = 0.5) {
  return first.x < second.x + second.width - tolerance
    && first.x + first.width > second.x + tolerance
    && first.y < second.y + second.height - tolerance
    && first.y + first.height > second.y + tolerance
}

function clampAndFitCandidate(candidate, object, page, precise = false) {
  const area = page.contentBounds || { x: 0, y: 0, width: page.widthPx, height: page.heightPx }
  const grid = pageGridSize(page)
  const widthLocked = object.manualWidth !== false
  const heightLocked = object.manualHeight !== false
  const positionLocked = Boolean(object.manualPosition)
  let width = Math.min(area.width, Math.max(12, candidate.width))
  if (!widthLocked && !['image', 'logo'].includes(object.type)) {
    width = Math.max(width, Math.min(area.width, estimatedTextGeometry(object, width).minimumWidth))
  }
  let height = Math.min(area.height, Math.max(12, candidate.height))
  if (!heightLocked && !['image', 'logo'].includes(object.type)) {
    height = Math.max(height, Math.min(area.height, estimatedTextGeometry(object, width).minimumHeight))
  }
  if (!widthLocked && !precise) width = Math.min(area.width, Math.ceil(width / grid) * grid)
  if (!heightLocked && !precise) height = Math.min(area.height, Math.ceil(height / grid) * grid)
  let x = Math.max(area.x, Math.min(area.x + area.width - width, candidate.x))
  let y = Math.max(area.y, Math.min(area.y + area.height - height, candidate.y))
  if (!positionLocked && !precise) {
    x = Math.max(area.x, Math.min(area.x + area.width - width, snapToGrid(x, area.x, grid)))
    y = Math.max(area.y, Math.min(area.y + area.height - height, snapToGrid(y, area.y, grid)))
  }
  return { x, y, width, height }
}

function findNonOverlappingPosition(candidate, object, page, objects, precise = false) {
  const obstacles = objects.filter(item => item.id !== object.id && !item.excluded && item.pageIndex === object.pageIndex)
  if (!obstacles.some(item => rectanglesOverlap(candidate, item))) return candidate
  if (object.manualPosition) return null
  const area = page.contentBounds || { x: 0, y: 0, width: page.widthPx, height: page.heightPx }
  if (precise) {
    const placed = { ...candidate }
    for (let attempt = 0; attempt <= obstacles.length; attempt += 1) {
      const blockers = obstacles.filter(item => rectanglesOverlap(placed, item))
      if (!blockers.length) return placed
      placed.y = Math.max(...blockers.map(item => item.y + item.height + 2))
      if (placed.y + placed.height > area.y + area.height) return null
    }
    return null
  }
  const grid = pageGridSize(page)
  const maximumColumn = Math.max(0, Math.floor((area.width - candidate.width) / grid + 0.000001))
  const maximumRow = Math.max(0, Math.floor((area.height - candidate.height) / grid + 0.000001))
  const targetColumn = Math.max(0, Math.min(maximumColumn, Math.round((candidate.x - area.x) / grid)))
  const targetRow = Math.max(0, Math.min(maximumRow, Math.round((candidate.y - area.y) / grid)))
  const positions = []
  for (let row = 0; row <= maximumRow; row += 1) {
    for (let column = 0; column <= maximumColumn; column += 1) {
      positions.push({ column, row, distance: Math.abs(column - targetColumn) + Math.abs(row - targetRow) })
    }
  }
  positions.sort((first, second) => first.distance - second.distance || first.row - second.row || first.column - second.column)
  for (const position of positions) {
    const placed = { ...candidate, x: area.x + position.column * grid, y: area.y + position.row * grid }
    if (!obstacles.some(item => rectanglesOverlap(placed, item))) return placed
  }
  return null
}

function applyLayoutReview(scene, reviews, threshold = 0.72) {
  const objects = new Map((scene.objects || []).map(object => [object.id, object]))
  const pages = new Map((scene.pages || []).map(page => [page.index, page]))
  const applied = []
  const recommendations = []
  for (const review of reviews || []) {
    for (const adjustment of review.adjustments || []) {
      const object = objects.get(adjustment.objectId)
      const page = object ? pages.get(object.pageIndex) : null
      if (!object || !page) continue
      if (adjustment.confidence < threshold) {
        recommendations.push({ ...adjustment, pageIndex: review.pageIndex })
        continue
      }
      const locked = []
      if (object.manualPosition && (adjustment.x != null || adjustment.y != null)) locked.push('положение')
      if (object.manualWidth !== false && adjustment.width != null) locked.push('ширина')
      if (object.manualHeight !== false && adjustment.height != null) locked.push('высота')
      if (object.manualTypography && (adjustment.fontSizePx != null || adjustment.textAlign)) locked.push('типографика')
      if (locked.length) recommendations.push({
        ...adjustment,
        pageIndex: review.pageIndex,
        reason: `Сохранены ручные настройки: ${locked.join(', ')}. ${adjustment.reason}`.trim(),
      })
      const hasAutomaticChange = (!object.manualPosition && (adjustment.x != null || adjustment.y != null))
        || (object.manualWidth === false && adjustment.width != null)
        || (object.manualHeight === false && adjustment.height != null)
        || (!object.manualTypography && (adjustment.fontSizePx != null || adjustment.textAlign))
      if (!hasAutomaticChange) continue
      const before = { x: object.x, y: object.y, width: object.width, height: object.height, fontSizePx: object.style.fontSizePx, textAlign: object.style.textAlign }
      if (!object.manualTypography && adjustment.fontSizePx != null) object.style.fontSizePx = adjustment.fontSizePx
      if (!object.manualTypography && adjustment.textAlign) object.style.textAlign = adjustment.textAlign
      const candidate = clampAndFitCandidate({
        x: !object.manualPosition && adjustment.x != null ? adjustment.x : object.x,
        y: !object.manualPosition && adjustment.y != null ? adjustment.y : object.y,
        width: object.manualWidth === false && adjustment.width != null ? adjustment.width : object.width,
        height: object.manualHeight === false && adjustment.height != null ? adjustment.height : object.height,
      }, object, page, scene.layoutInitializationVersion >= 2)
      const placed = findNonOverlappingPosition(candidate, object, page, [...objects.values()], scene.layoutInitializationVersion >= 2)
      if (!placed) {
        object.style.fontSizePx = before.fontSizePx
        object.style.textAlign = before.textAlign
        recommendations.push({ ...adjustment, pageIndex: review.pageIndex, reason: `Изменение не применено: рядом нет свободной области без наложения. ${adjustment.reason}`.trim() })
        continue
      }
      Object.assign(object, placed)
      applied.push({ objectId: object.id, pageIndex: review.pageIndex, confidence: adjustment.confidence, reason: adjustment.reason, before, after: { x: object.x, y: object.y, width: object.width, height: object.height, fontSizePx: object.style.fontSizePx, textAlign: object.style.textAlign } })
    }
  }
  return { applied, recommendations }
}

module.exports = { applyLayoutReview, buildLayoutReviewPrompt, normalizeLayoutReview, reviewLayoutWithAitunnel, reviewLayoutWithCodex }
