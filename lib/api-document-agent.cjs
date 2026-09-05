const fs = require('node:fs')
const path = require('node:path')
const { buildDocumentPrompt, normalizeCodexAnalysis } = require('./document-agent.cjs')

function textContent(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join('')
  if (!value || typeof value !== 'object') return ''
  if (Array.isArray(value.pages)) return JSON.stringify(value)
  for (const key of ['text', 'content', 'output_text', 'value']) {
    const text = textContent(value[key])
    if (text) return text
  }
  return ''
}

function parsedObject(value) {
  let candidate = value
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { candidate = typeof candidate === 'string' ? JSON.parse(candidate) : candidate } catch { return null }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      if (Array.isArray(candidate.pages)) return candidate
      for (const child of Object.values(candidate)) {
        if (child && typeof child === 'object' && !Array.isArray(child) && Array.isArray(child.pages)) return child
      }
      return candidate
    }
  }
  return null
}

function balancedJsonObjects(value) {
  const candidates = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character === '{') {
      if (depth === 0) start = index
      depth += 1
    } else if (character === '}' && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        candidates.push(value.slice(start, index + 1))
        start = -1
      }
    }
  }
  return candidates
}

function parseJsonObject(content) {
  const value = textContent(content).trim().replace(/^\uFEFF/, '')
  const direct = parsedObject(value)
  if (direct && Array.isArray(direct.pages)) return direct
  const fencedCandidates = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(match => match[1])
  const candidates = [...fencedCandidates, ...balancedJsonObjects(value)]
  for (const candidate of candidates) {
    const parsed = parsedObject(candidate)
    if (parsed && Array.isArray(parsed.pages)) return parsed
  }
  throw new Error('AITunnel вернул некорректный JSON анализа')
}

function responseFormat(schema, strict = true) {
  if (!strict) return { type: 'json_object' }
  const cleanSchema = structuredClone(schema)
  delete cleanSchema.$id
  delete cleanSchema.$schema
  return {
    type: 'json_schema',
    json_schema: {
      name: 'icat_document_analysis',
      strict: true,
      schema: cleanSchema,
    },
  }
}

function providerError(status, payload, apiKey) {
  let detail = String(payload?.error?.message || payload?.error || payload?.message || '').trim().slice(0, 500)
  if (apiKey) detail = detail.split(apiKey).join('[REDACTED]')
  return new Error(`AITunnel вернул HTTP ${status}${detail ? `: ${detail}` : ''}`)
}

async function callAnalysis(options, content, schema, strict) {
  const requestBody = {
    model: options.model,
    temperature: 0,
    reasoning: { effort: 'minimal', exclude: true },
    response_format: responseFormat(schema, strict),
    messages: [{
      role: 'system',
      content: 'Вы — агент технического разбора документов бюро переводов. Выполняйте полную точную транскрипцию, классификацию и разметку координат. Не переводите текст. Ответьте только JSON.',
    }, {
      role: 'user',
      content,
    }],
  }
  if (Number.isFinite(Number(options.maxOutputTokens)) && Number(options.maxOutputTokens) > 0) {
    requestBody.max_tokens = Math.trunc(Number(options.maxOutputTokens))
  }
  const response = await options.fetchImpl(options.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(options.timeoutMs),
  })
  let payload
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) throw providerError(response.status, payload, options.apiKey)
  return payload
}

async function analyzeDocumentWithAitunnel(options) {
  const {
    apiUrl,
    apiKey,
    model,
    documentDirectory,
    filename,
    manifest,
    schemaPath,
    timeoutMs = 900_000,
    maxOutputTokens = null,
    diagnosticFilename = 'aitunnel-analysis-response.json',
    fetchImpl = fetch,
  } = options
  if (!apiKey) throw new Error('Не настроен API-ключ AITunnel')
  if (!model) throw new Error('Не выбрана модель AITunnel')
  const schema = JSON.parse(await fs.promises.readFile(schemaPath, 'utf8'))
  const content = [{ type: 'text', text: buildDocumentPrompt(filename, manifest) }]
  for (const page of manifest.pages) {
    const imagePath = path.join(documentDirectory, 'pages', path.basename(page.image))
    const imageData = await fs.promises.readFile(imagePath)
    content.push({ type: 'text', text: `Оригинал страницы ${page.index + 1}:` })
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imageData.toString('base64')}`, detail: 'high' },
    })
  }
  const requestOptions = { apiUrl, apiKey, model, timeoutMs, maxOutputTokens, fetchImpl }
  let payload
  try {
    payload = await callAnalysis(requestOptions, content, schema, true)
  } catch (error) {
    if (!/HTTP (400|422)/.test(error.message)) throw error
    payload = await callAnalysis(requestOptions, content, schema, false)
  }
  const choice = payload?.choices?.[0] || {}
  const message = choice?.message || {}
  const responseContent = textContent(message.content)
    || textContent(message.parsed)
    || textContent(message.output_text)
    || textContent(choice.text)
    || textContent(payload?.output_text)
  const reasoningContent = textContent(message.reasoning)
    || textContent(message.reasoning_content)
    || textContent(message.reasoning_details)
  const finishReason = String(choice.finish_reason || payload?.finish_reason || 'unknown')
  const actualModel = String(payload?.model || model)
  const diagnosticPath = path.join(documentDirectory, path.basename(diagnosticFilename))
  const usage = payload?.usage || {}
  await fs.promises.writeFile(diagnosticPath, JSON.stringify({
    provider: 'aitunnel', model: actualModel, finishReason,
    requestedMaxTokens: maxOutputTokens,
    content: responseContent,
    reasoningCharacters: reasoningContent.length,
    usage: {
      promptTokens: Number(usage.prompt_tokens || 0),
      completionTokens: Number(usage.completion_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      reasoningTokens: Number(usage.completion_tokens_details?.reasoning_tokens || 0),
      costRub: Number(usage.cost_rub || 0),
    },
    receivedAt: new Date().toISOString(),
  }, null, 2), 'utf8')
  let raw
  try {
    raw = parseJsonObject(responseContent)
  } catch (error) {
    if (['length', 'max_tokens'].includes(finishReason)) {
      const limit = maxOutputTokens ? `${maxOutputTokens} токенов` : 'выбранной модели'
      throw new Error(`Ответ AITunnel обрезан по лимиту ${limit} (${responseContent.length} символов). Диагностика: ${path.basename(diagnosticPath)}`)
    }
    if (!responseContent.trim()) {
      throw new Error(`AITunnel не вернул итоговый текст анализа (finish_reason: ${finishReason}). Диагностика: ${path.basename(diagnosticPath)}`)
    }
    throw new Error(`AITunnel вернул некорректный JSON анализа (finish_reason: ${finishReason}, ${responseContent.length} символов). Диагностика: ${path.basename(diagnosticPath)}`)
  }
  const analysis = normalizeCodexAnalysis(raw, manifest)
  analysis.engine = `AITunnel Document Agent (${actualModel})`
  analysis.model = actualModel
  analysis.generatedAt = new Date().toISOString()
  analysis.usage = {
    promptTokens: Number(usage.prompt_tokens || 0),
    completionTokens: Number(usage.completion_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
    reasoningTokens: Number(usage.completion_tokens_details?.reasoning_tokens || 0),
    costRub: Number(usage.cost_rub || 0),
  }
  analysis.rawOutputPath = path.basename(diagnosticPath)
  return analysis
}

module.exports = {
  analyzeDocumentWithAitunnel,
  parseJsonObject,
  responseFormat,
  textContent,
}
