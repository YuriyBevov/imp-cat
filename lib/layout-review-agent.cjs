const fs = require('node:fs')
const path = require('node:path')
const { parseJsonObject, responseFormat, textContent } = require('./api-document-agent.cjs')

function finiteOrNull(value, minimum, maximum) {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : null
}

function buildLayoutReviewPrompt(page, objects) {
  const compactObjects = objects.map(object => ({
    id: object.id,
    type: object.type,
    text: String(object.translation || object.sourceText || '').slice(0, 500),
    x: object.x, y: object.y, width: object.width, height: object.height,
    fontSizePx: object.style?.fontSizePx,
    fontWeight: object.style?.fontWeight,
    fontStyle: object.style?.fontStyle,
    textAlign: object.style?.textAlign,
  }))
  return [
    `Сравните оригинал и текущий собранный макет страницы ${page.index + 1}.`,
    `Размер рабочей страницы: ${page.widthPx}×${page.heightPx} CSS px.`,
    'Первое изображение — оригинал, второе — текущая сборка.',
    'Найдите расхождения положения, размеров и базовой типографики. Особенно внимательно проверьте штампы, печати, подписи, колонтитулы и таблицы.',
    'Не меняйте и не переводите текст. Предлагайте только координаты x/y, ширину/высоту, размер шрифта и выравнивание.',
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
    { type: 'text', text: buildLayoutReviewPrompt(options.page, options.objects) },
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
  const prompt = buildLayoutReviewPrompt(options.page, options.objects)
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
      const before = { x: object.x, y: object.y, width: object.width, height: object.height, fontSizePx: object.style.fontSizePx, textAlign: object.style.textAlign }
      if (adjustment.width != null) object.width = Math.min(page.widthPx, Math.max(12, adjustment.width))
      if (adjustment.height != null) object.height = Math.min(page.heightPx, Math.max(12, adjustment.height))
      if (adjustment.x != null) object.x = Math.max(0, Math.min(page.widthPx - object.width, adjustment.x))
      if (adjustment.y != null) object.y = Math.max(0, Math.min(page.heightPx - object.height, adjustment.y))
      if (adjustment.fontSizePx != null) object.style.fontSizePx = adjustment.fontSizePx
      if (adjustment.textAlign) object.style.textAlign = adjustment.textAlign
      object.agentNotes = [object.agentNotes, `Автокоррекция макета: ${adjustment.reason}`].filter(Boolean).join('\n').slice(0, 1_000)
      applied.push({ objectId: object.id, pageIndex: review.pageIndex, confidence: adjustment.confidence, reason: adjustment.reason, before, after: { x: object.x, y: object.y, width: object.width, height: object.height, fontSizePx: object.style.fontSizePx, textAlign: object.style.textAlign } })
    }
  }
  return { applied, recommendations }
}

module.exports = { applyLayoutReview, buildLayoutReviewPrompt, normalizeLayoutReview, reviewLayoutWithAitunnel, reviewLayoutWithCodex }
