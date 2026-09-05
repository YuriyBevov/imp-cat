const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { createKnowledgeBase, vectorize } = require('../lib/knowledge-base.cjs')

test('knowledge base returns an exact match before vector alternatives and does not duplicate it', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-kb-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  const kb = createKnowledgeBase({ filePath: path.join(directory, 'translation-memory.json') })
  let result = await kb.addMany([{
    sourceText: 'Power of attorney', translation: 'Доверенность', sourceLanguage: 'en', targetLanguage: 'ru', clientRef: 'unit-1',
  }])
  assert.equal(result.created, 1)
  result = await kb.addMany([{
    sourceText: '  Power   of attorney  ', translation: 'Доверенность', sourceLanguage: 'en', targetLanguage: 'ru', clientRef: 'unit-2',
  }])
  assert.equal(result.created, 0)
  assert.equal(result.results[0].status, 'existing')
  const matches = await kb.search('Power of attorney', 'ru')
  assert.equal(matches[0].matchType, 'exact')
  assert.equal(matches[0].score, 1)
  assert.equal(matches[0].translation, 'Доверенность')
  assert.equal(Object.hasOwn(matches[0], 'sourceVector'), false)
})

test('knowledge base migrates legacy arrays and builds deterministic local vectors', async t => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'icat-kb-legacy-'))
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }))
  const filePath = path.join(directory, 'translation-memory.json')
  await fs.promises.writeFile(filePath, JSON.stringify([{
    id: 'legacy', sourceText: 'Attorney legal powers', translation: 'Полномочия поверенного', targetLanguage: 'ru', updatedAt: '2026-01-01',
  }]))
  const kb = createKnowledgeBase({ filePath })
  const matches = await kb.search('legal powers of attorney', 'ru')
  assert.equal(matches[0].id, 'legacy')
  assert.deepEqual(vectorize('Same text'), vectorize('Same text'))
})
