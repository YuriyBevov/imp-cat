const test = require('node:test')
const assert = require('node:assert/strict')

const { createAitunnelEmbeddingProvider, embeddingsUrl } = require('../lib/embedding-provider.cjs')

test('AITunnel embeddings use the OpenAI-compatible endpoint and preserve batch order', async () => {
  let captured
  const provider = createAitunnelEmbeddingProvider({
    apiUrl: 'https://api.aitunnel.ru/v1/chat/completions',
    apiKey: 'test-secret',
    model: 'text-embedding-3-small',
    dimensions: 64,
    fetchImpl: async (url, options) => {
      captured = { url, options }
      return { ok: true, json: async () => ({ data: [
        { index: 1, embedding: Array.from({ length: 64 }, (_, index) => index === 1 ? 1 : 0) },
        { index: 0, embedding: Array.from({ length: 64 }, (_, index) => index === 0 ? 1 : 0) },
      ] }) }
    },
  })
  const vectors = await provider.embed(['first', 'second'])
  assert.equal(captured.url, 'https://api.aitunnel.ru/v1/embeddings')
  assert.deepEqual(JSON.parse(captured.options.body), { model: 'text-embedding-3-small', input: ['first', 'second'] })
  assert.equal(captured.options.headers.Authorization, 'Bearer test-secret')
  assert.equal(vectors[0][0], 1)
  assert.equal(vectors[1][1], 1)
  assert.equal(embeddingsUrl('https://api.aitunnel.ru/v1/chat/completions'), captured.url)
})

test('AITunnel embeddings reject a wrong vector dimension', async () => {
  const provider = createAitunnelEmbeddingProvider({
    apiKey: 'test-secret', dimensions: 64,
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{ index: 0, embedding: [1, 2] }] }) }),
  })
  await assert.rejects(provider.embed(['text']), /размерность/)
})
