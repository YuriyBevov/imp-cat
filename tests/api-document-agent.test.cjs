const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { analyzeDocumentWithAitunnel, parseJsonObject, responseFormat, textContent } = require('../lib/api-document-agent.cjs')

function modelResult() {
  return {
    documentTitle: 'Test', languages: ['en'], pages: [{
      pageIndex: 0, languages: ['en'], segments: [{
        segmentId: 'segment-1', type: 'text', sourceText: 'Hello', readingOrder: 0,
        flowGroup: 'page-1-body', regions: [{ x: .1, y: .2, width: .3, height: .04 }],
        style: { fontFamily: 'Arial', fontSizePt: 11, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
        confidence: .99, needsReview: false, notes: '',
      }],
    }],
  }
}

test('AITunnel document agent sends page images and normalizes structured output', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-api-agent-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  await fs.promises.mkdir(path.join(directory, 'pages'))
  await fs.promises.writeFile(path.join(directory, 'pages', 'page-001.png'), Buffer.from('image'))
  const schemaPath = path.join(directory, 'schema.json')
  await fs.promises.writeFile(schemaPath, JSON.stringify({ $schema: 'draft', type: 'object' }))
  let requestBody
  const analysis = await analyzeDocumentWithAitunnel({
    apiUrl: 'https://api.aitunnel.ru/v1/chat/completions', apiKey: 'safe-secret', model: 'vision-model',
    documentDirectory: directory, filename: 'scan.pdf', schemaPath, maxOutputTokens: 384_000,
    manifest: { pages: [{ index: 0, width: 1000, height: 1400, image: 'page-001.png' }] },
    fetchImpl: async (url, options) => {
      requestBody = JSON.parse(options.body)
      return {
        ok: true, status: 200,
        json: async () => ({ model: 'vision-model', choices: [{ message: { content: JSON.stringify(modelResult()) } }], usage: { total_tokens: 123, cost_rub: .42 } }),
      }
    },
  })
  assert.equal(requestBody.model, 'vision-model')
  assert.equal(requestBody.max_tokens, 384_000)
  assert.equal(requestBody.response_format.type, 'json_schema')
  assert.equal(requestBody.messages[1].content.some(item => item.type === 'image_url' && item.image_url.url.startsWith('data:image/png;base64,')), true)
  assert.equal(analysis.pages[0].segments[0].sourceText, 'Hello')
  assert.equal(analysis.engine, 'AITunnel Document Agent (vision-model)')
  assert.equal(analysis.usage.costRub, .42)
  assert.equal(fs.existsSync(path.join(directory, 'aitunnel-analysis-response.json')), true)
  assert.equal(JSON.stringify(requestBody).includes('safe-secret'), false)
})

test('AITunnel parser accepts fenced JSON and schema fallback format', () => {
  assert.equal(parseJsonObject('```json\n{"pages":[]}\n```').pages.length, 0)
  assert.equal(parseJsonObject('<think>checked</think>\nResult: {"documentTitle":"x","pages":[]}').documentTitle, 'x')
  assert.equal(textContent([{ type: 'text', text: 'first' }, { content: [{ output_text: ' second' }] }]), 'first second')
  assert.equal(responseFormat({ $id: 'x', type: 'object' }, true).json_schema.schema.$id, undefined)
  assert.deepEqual(responseFormat({}, false), { type: 'json_object' })
})

test('AITunnel document agent retries with json_object when strict schema is unsupported', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-api-fallback-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  await fs.promises.mkdir(path.join(directory, 'pages'))
  await fs.promises.writeFile(path.join(directory, 'pages', 'page-001.png'), Buffer.from('image'))
  const schemaPath = path.join(directory, 'schema.json')
  await fs.promises.writeFile(schemaPath, JSON.stringify({ type: 'object' }))
  const formats = []
  const analysis = await analyzeDocumentWithAitunnel({
    apiUrl: 'https://api.aitunnel.ru/v1/chat/completions', apiKey: 'safe-secret', model: 'vision-model',
    documentDirectory: directory, filename: 'scan.png', schemaPath, maxOutputTokens: 64_000,
    manifest: { pages: [{ index: 0, width: 1000, height: 1400, image: 'page-001.png' }] },
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body)
      formats.push(body.response_format.type)
      if (formats.length === 1) return { ok: false, status: 400, json: async () => ({ error: { message: 'response_format unsupported' } }) }
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(modelResult()) } }] }) }
    },
  })
  assert.deepEqual(formats, ['json_schema', 'json_object'])
  assert.equal(analysis.pages[0].segments.length, 1)
})

test('AITunnel document agent reports a truncated response and stores local diagnostics', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-api-truncated-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  await fs.promises.mkdir(path.join(directory, 'pages'))
  await fs.promises.writeFile(path.join(directory, 'pages', 'page-001.png'), Buffer.from('image'))
  const schemaPath = path.join(directory, 'schema.json')
  await fs.promises.writeFile(schemaPath, JSON.stringify({ type: 'object' }))
  await assert.rejects(() => analyzeDocumentWithAitunnel({
    apiUrl: 'https://api.aitunnel.ru/v1/chat/completions', apiKey: 'safe-secret', model: 'small-vision',
    documentDirectory: directory, filename: 'scan.png', schemaPath, maxOutputTokens: 64_000,
    manifest: { pages: [{ index: 0, width: 1000, height: 1400, image: 'page-001.png' }] },
    fetchImpl: async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"pages":[' } }] }),
    }),
  }), /обрезан по лимиту 64000 токенов/)
  const diagnostic = JSON.parse(await fs.promises.readFile(path.join(directory, 'aitunnel-analysis-response.json'), 'utf8'))
  assert.equal(diagnostic.finishReason, 'length')
  assert.equal(JSON.stringify(diagnostic).includes('safe-secret'), false)
})
