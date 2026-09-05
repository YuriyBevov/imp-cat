const test = require('node:test')
const assert = require('node:assert/strict')
const {
  fetchAitunnelModels,
  normalizeAuthenticatedIds,
  normalizePublicCatalog,
  testAitunnelConnection,
} = require('../lib/aitunnel.cjs')

function jsonResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload }
}

const publicCatalog = {
  'vision-model': {
    provider: 'example', description: 'Vision',
    modalities: { input: ['image', 'text'], output: ['text'] },
    prompt_cost: 10, completion_cost: 20, context_size: 100000, max_output: 8000,
  },
  'text-model': {
    provider: 'example', description: 'Text only',
    modalities: { input: ['text'], output: ['text'] },
  },
}

test('AITunnel catalog identifies models suitable for the complete document route', () => {
  const models = normalizePublicCatalog(publicCatalog)
  assert.equal(models.find(model => model.id === 'vision-model').documentCapable, true)
  assert.equal(models.find(model => model.id === 'text-model').documentCapable, false)
  assert.deepEqual(normalizeAuthenticatedIds({ data: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] }), ['a', 'b'])
})

test('AITunnel connection check uses the authenticated catalog and exact model id', async () => {
  const calls = []
  const result = await testAitunnelConnection({
    apiUrl: 'https://api.aitunnel.ru/v1/chat/completions', apiKey: 'secret-key', model: 'vision-model',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return url.endsWith('/v1/models')
        ? jsonResponse({ data: [{ id: 'vision-model' }] })
        : jsonResponse(publicCatalog)
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.documentCapable, true)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].options.headers.Authorization, 'Bearer secret-key')
  assert.equal(JSON.stringify(result).includes('secret-key'), false)
})

test('public catalog can populate the selector before a key is configured', async () => {
  const catalog = await fetchAitunnelModels({
    fetchImpl: async () => jsonResponse(publicCatalog),
  })
  assert.equal(catalog.authenticated, false)
  assert.equal(catalog.total, 2)
  assert.equal(catalog.models[0].id, 'vision-model')
})
