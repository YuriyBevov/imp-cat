const DEFAULT_CHAT_COMPLETIONS_URL = 'https://api.aitunnel.ru/v1/chat/completions'
const PUBLIC_MODELS_PATH = '/public/aitunnel/models/chat'
const AUTHENTICATED_MODELS_PATH = '/v1/models'

function endpoint(apiUrl, pathname) {
  const url = new URL(apiUrl || DEFAULT_CHAT_COMPLETIONS_URL)
  url.pathname = pathname
  url.search = ''
  url.hash = ''
  return url.toString()
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizePublicCatalog(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  return Object.entries(payload).map(([id, raw]) => {
    const inputModalities = Array.isArray(raw?.modalities?.input) ? raw.modalities.input.map(String) : []
    const outputModalities = Array.isArray(raw?.modalities?.output) ? raw.modalities.output.map(String) : []
    return {
      id: String(id),
      provider: String(raw?.provider || ''),
      description: String(raw?.description || '').slice(0, 500),
      inputModalities,
      outputModalities,
      documentCapable: inputModalities.includes('image') && outputModalities.includes('text'),
      promptCost: safeNumber(raw?.prompt_cost),
      completionCost: safeNumber(raw?.completion_cost),
      contextSize: safeNumber(raw?.context_size),
      maxOutput: safeNumber(raw?.max_output),
    }
  })
}

function normalizeAuthenticatedIds(payload) {
  const values = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  return [...new Set(values.map(item => String(item?.id || item || '').trim()).filter(Boolean))]
}

async function readJsonResponse(response, label, secret = '') {
  let payload
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`${label}: ключ отклонён или не имеет доступа`)
    }
    let detail = String(payload?.error?.message || payload?.error || payload?.message || '').trim().slice(0, 300)
    if (secret) detail = detail.split(secret).join('[REDACTED]')
    throw new Error(`${label} вернул HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return payload
}

async function fetchAitunnelModels(options = {}) {
  const {
    apiUrl = DEFAULT_CHAT_COMPLETIONS_URL,
    apiKey = '',
    fetchImpl = fetch,
    timeoutMs = 15_000,
  } = options
  const publicResponse = await fetchImpl(endpoint(apiUrl, PUBLIC_MODELS_PATH), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  const publicModels = normalizePublicCatalog(await readJsonResponse(publicResponse, 'Каталог AITunnel'))
  let authenticatedIds = null
  if (apiKey) {
    const authenticatedResponse = await fetchImpl(endpoint(apiUrl, AUTHENTICATED_MODELS_PATH), {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    authenticatedIds = normalizeAuthenticatedIds(await readJsonResponse(authenticatedResponse, 'AITunnel', apiKey))
  }
  const publicById = new Map(publicModels.map(model => [model.id, model]))
  const ids = authenticatedIds || publicModels.map(model => model.id)
  const models = ids.map(id => publicById.get(id) || {
    id,
    provider: 'preset',
    description: 'Пользовательский пресет AITunnel; возможности модели не опубликованы.',
    inputModalities: [],
    outputModalities: [],
    documentCapable: false,
    promptCost: null,
    completionCost: null,
    contextSize: null,
    maxOutput: null,
  }).sort((left, right) => (
    Number(right.documentCapable) - Number(left.documentCapable)
    || left.provider.localeCompare(right.provider, 'ru')
    || left.id.localeCompare(right.id, 'ru')
  ))
  return { models, authenticated: Boolean(apiKey), total: models.length }
}

async function testAitunnelConnection(options = {}) {
  if (!options.apiKey) throw new Error('Введите API-ключ AITunnel')
  if (!options.model) throw new Error('Выберите модель AITunnel')
  const catalog = await fetchAitunnelModels(options)
  const selected = catalog.models.find(model => model.id === options.model)
  if (!selected) throw new Error(`Модель «${options.model}» недоступна для этого ключа`)
  if (!selected.documentCapable) {
    throw new Error(`Модель «${options.model}» не поддерживает полный маршрут анализа изображений`)
  }
  return {
    ok: true,
    model: selected.id,
    provider: selected.provider,
    modelsCount: catalog.total,
    documentCapable: true,
    maxOutput: selected.maxOutput,
    contextSize: selected.contextSize,
  }
}

module.exports = {
  AUTHENTICATED_MODELS_PATH,
  DEFAULT_CHAT_COMPLETIONS_URL,
  PUBLIC_MODELS_PATH,
  fetchAitunnelModels,
  normalizeAuthenticatedIds,
  normalizePublicCatalog,
  testAitunnelConnection,
}
