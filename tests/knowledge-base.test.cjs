const test = require('node:test')
const assert = require('node:assert/strict')
const { DEFAULT_GLOSSARY_ID, adaptTranslationCase, createKnowledgeBase } = require('../lib/knowledge-base.cjs')

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
  assert.equal(result.results[0].entry.sourceText, 'power of attorney')
  assert.equal(result.results[0].entry.translation, 'доверенность')
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
  assert.equal(firstPage.entries[0].sourceText, 'legal address')

  const entry = added.results[0].entry
  const callsBeforeTranslationEdit = embeddingCalls
  const translationEdited = await kb.updateEntry(entry.id, { translation: 'Доверенность (обновлено)' })
  assert.equal(translationEdited.translation, 'доверенность (обновлено)')
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

test('knowledge base locates an exact glossary term inside a longer segment', async () => {
  const kb = createKnowledgeBase({ embeddingProvider })
  await kb.addMany([{
    sourceText: 'SÜRELİDİR', translation: 'Имеет срок', sourceLanguage: 'Turkish', targetLanguage: 'ru',
  }])
  const text = 'SÜRELİDİR: Bu vekaletname 25/08/2026 tarihine kadar geçerlidir.'
  const matches = await kb.findMatchesInText(text, 'ru', { sourceLanguage: 'tr' })
  assert.equal(matches.length, 1)
  assert.equal(text.slice(matches[0].start, matches[0].end), 'SÜRELİDİR')
  assert.equal(matches[0].sourceText, 'sürelidir')
  assert.equal(matches[0].translation, 'ИМЕЕТ СРОК')
  assert.equal(matches[0].score, 1)
  assert.equal(matches[0].matchType, 'exact-fragment')
  assert.equal(matches[0].fullSegment, false)
})

test('knowledge base proposes text-similar variants when there is no exact phrase', async () => {
  const kb = createKnowledgeBase()
  await kb.addMany([{
    sourceText: 'Power of attorney dated 25 August 2025', translation: 'Доверенность от 25 августа 2025 года', sourceLanguage: 'en', targetLanguage: 'ru',
  }])
  const sourceText = 'Power of attorney dated 25 August 2026'
  const matches = await kb.findMatchesInText(sourceText, 'ru', { sourceLanguage: 'English' })
  assert.equal(matches.length, 1)
  assert.equal(matches[0].matchType, 'fuzzy')
  assert.equal(matches[0].sourceText, 'power of attorney dated 25 august 2025')
  assert.equal(matches[0].start, 0)
  assert.equal(matches[0].end, sourceText.length)
  assert.ok(matches[0].score >= 0.85 && matches[0].score < 1)
})

test('knowledge-base translations inherit lowercase, title case, and uppercase from the source context', () => {
  assert.equal(adaptTranslationCase('sürelidir', 'имеет срок', 'ru', 'tr'), 'имеет срок')
  assert.equal(adaptTranslationCase('Sürelidir', 'имеет срок', 'ru', 'tr'), 'Имеет срок')
  assert.equal(adaptTranslationCase('SÜRELİDİR', 'имеет срок', 'ru', 'tr'), 'ИМЕЕТ СРОК')
})
