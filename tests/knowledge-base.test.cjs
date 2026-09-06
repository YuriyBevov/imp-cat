const test = require('node:test')
const assert = require('node:assert/strict')
const { DEFAULT_GLOSSARY_ID, createKnowledgeBase } = require('../lib/knowledge-base.cjs')

const embeddingProvider = {
  kind: 'test', model: 'test-embedding', dimensions: 3, available: () => true,
  async embed(values) {
    return values.map(value => {
      const text = String(value).toLowerCase()
      return [text.includes('attorney') ? 1 : 0, text.includes('legal') ? 1 : 0, text.includes('power') ? 1 : 0]
    })
  },
}

test('knowledge base returns an exact match before vector alternatives and does not duplicate it', async () => {
  const kb = createKnowledgeBase({ embeddingProvider })
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

test('knowledge base uses provider embeddings and separates entries by glossary', async () => {
  const kb = createKnowledgeBase({ embeddingProvider })
  const glossary = await kb.createGlossary({ name: 'Юридический', domain: 'law', sourceLanguage: 'en', targetLanguage: 'ru' })
  await kb.addMany([{
    sourceText: 'Attorney legal powers', translation: 'Полномочия поверенного', sourceLanguage: 'en', targetLanguage: 'ru', glossaryId: glossary.id,
  }])
  assert.deepEqual(await kb.search('legal powers of attorney', 'ru'), [])
  const matches = await kb.search('legal powers of attorney', 'ru', 8, { glossaryId: glossary.id, sourceLanguage: 'en' })
  assert.equal(matches[0].matchType, 'vector')
  assert.equal(matches[0].glossaryId, glossary.id)
  assert.equal((await kb.listGlossaries())[0].id, DEFAULT_GLOSSARY_ID)
  assert.equal((await kb.status()).persistent, false)
})

test('knowledge base supports paginated CRUD and refreshes an edited source embedding', async () => {
  let embeddingCalls = 0
  const provider = {
    ...embeddingProvider,
    async embed(values) {
      embeddingCalls += 1
      return embeddingProvider.embed(values)
    },
  }
  const kb = createKnowledgeBase({ embeddingProvider: provider })
  const added = await kb.addMany([
    { sourceText: 'Power of attorney', translation: 'Доверенность', sourceLanguage: 'en', targetLanguage: 'ru' },
    { sourceText: 'Legal address', translation: 'Юридический адрес', sourceLanguage: 'en', targetLanguage: 'ru' },
  ])
  const firstPage = await kb.listEntries({ query: 'юридический', limit: 1, offset: 0 })
  assert.equal(firstPage.total, 1)
  assert.equal(firstPage.entries[0].sourceText, 'Legal address')

  const entry = added.results[0].entry
  const callsBeforeTranslationEdit = embeddingCalls
  const translationEdited = await kb.updateEntry(entry.id, { translation: 'Доверенность (обновлено)' })
  assert.equal(translationEdited.translation, 'Доверенность (обновлено)')
  assert.equal(embeddingCalls, callsBeforeTranslationEdit)

  await kb.updateEntry(entry.id, { sourceText: 'Attorney legal powers' })
  assert.equal(embeddingCalls, callsBeforeTranslationEdit + 1)
  assert.equal((await kb.listEntries({ query: 'Attorney legal' })).entries[0].id, entry.id)

  await assert.rejects(
    kb.updateEntry(entry.id, { sourceText: 'Legal address' }),
    error => error.code === 'KNOWLEDGE_BASE_CONFLICT',
  )
  assert.equal(await kb.deleteEntry(entry.id), true)
  assert.equal(await kb.deleteEntry(entry.id), false)
  assert.equal((await kb.listEntries()).total, 1)
})
