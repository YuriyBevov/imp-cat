function embeddingsUrl(apiUrl) {
  const source = new URL(String(apiUrl || 'https://api.aitunnel.ru/v1/chat/completions'))
  if (source.protocol !== 'https:') throw new Error('Embeddings API должен использовать HTTPS')
  return new URL('/v1/embeddings', source.origin).toString()
}

function createAitunnelEmbeddingProvider(options = {}) {
  const model = String(options.model || 'text-embedding-3-small').trim()
  const dimensions = Math.max(64, Math.min(4_096, Number(options.dimensions) || 1_536))
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const getApiKey = typeof options.getApiKey === 'function' ? options.getApiKey : () => options.apiKey
  const endpoint = embeddingsUrl(options.apiUrl)

  async function embed(inputs, requestOptions = {}) {
    const values = (Array.isArray(inputs) ? inputs : [inputs]).map(value => String(value || '').trim())
    if (!values.length || values.some(value => !value)) throw new Error('Для embeddings нужен непустой текст')
    const apiKey = String(getApiKey() || '').trim()
    if (!apiKey) throw new Error('API-ключ AITunnel для embeddings не настроен')
    const timeoutSignal = AbortSignal.timeout(Number(options.timeoutMs) || 120_000)
    const signal = requestOptions.signal
      ? AbortSignal.any([requestOptions.signal, timeoutSignal])
      : timeoutSignal
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: values }),
      signal,
    })
    if (!response.ok) {
      let detail = ''
      try { detail = String((await response.json())?.error?.message || '').slice(0, 500) } catch {}
      throw new Error(`AITunnel embeddings: HTTP ${response.status}${detail ? ` · ${detail}` : ''}`)
    }
    const payload = await response.json()
    const rows = Array.isArray(payload?.data) ? [...payload.data].sort((a, b) => Number(a.index) - Number(b.index)) : []
    if (rows.length !== values.length) throw new Error('AITunnel вернул неполный набор embeddings')
    const vectors = rows.map(row => {
      const vector = Array.isArray(row?.embedding) ? row.embedding.map(Number) : []
      if (vector.length !== dimensions || vector.some(value => !Number.isFinite(value))) {
        throw new Error(`Некорректная размерность embedding: ожидалось ${dimensions}, получено ${vector.length}`)
      }
      return vector
    })
    return vectors
  }

  return { kind: 'aitunnel', model, dimensions, endpoint, available: () => Boolean(String(getApiKey() || '').trim()), embed }
}

module.exports = { createAitunnelEmbeddingProvider, embeddingsUrl }
