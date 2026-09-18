const test = require('node:test')
const assert = require('node:assert/strict')
const { DEFAULT_GLOSSARY_ID, adaptTranslationCase, createKnowledgeBase, sentenceCaseText } = require('../lib/knowledge-base.cjs')

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
  assert.equal(result.results[0].entry.sourceText, 'Power of attorney')
  assert.equal(result.results[0].entry.translation, 'Доверенность')
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
  assert.equal(Object.hasOwn(firstPage.entries[0], 'score'), false)
  assert.equal(Object.hasOwn(firstPage.entries[0], 'matchType'), false)

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

test('knowledge base locates an exact glossary term inside a longer segment', async () => {
  const kb = createKnowledgeBase({ embeddingProvider })
  await kb.addMany([{
    sourceText: 'SÜRELİDİR', translation: 'Имеет срок', sourceLanguage: 'Turkish', targetLanguage: 'ru',
  }])
  const text = 'SÜRELİDİR: Bu vekaletname 25/08/2026 tarihine kadar geçerlidir.'
  const matches = await kb.findMatchesInText(text, 'ru', { sourceLanguage: 'tr' })
  assert.equal(matches.length, 1)
  assert.equal(text.slice(matches[0].start, matches[0].end), 'SÜRELİDİR')
  assert.equal(matches[0].sourceText, 'Sürelidir')
  assert.equal(matches[0].translation, 'ИМЕЕТ СРОК')
  assert.equal(matches[0].score, 1)
  assert.equal(matches[0].matchType, 'exact-fragment')
  assert.equal(matches[0].fullSegment, false)
})

test('knowledge base matches a lowercase Turkish entry against dotted uppercase letters', async () => {
  const kb = createKnowledgeBase({ embeddingProvider })
  await kb.addMany([{
    sourceText: 'mersin 4. noterliği', translation: 'четвертая нотариальная контора г. мерсин', sourceLanguage: 'Turkish', targetLanguage: 'ru',
  }])
  const sourceText = 'MERSİN 4. NOTERLİĞİ'
  const matches = await kb.findMatchesInText(sourceText, 'ru', { sourceLanguage: 'Turkish' })
  assert.equal(matches.length, 1)
  assert.equal(matches[0].matchType, 'exact')
  assert.equal(matches[0].fullSegment, true)
  assert.equal(sourceText.slice(matches[0].start, matches[0].end), sourceText)
  assert.equal(matches[0].translation, 'ЧЕТВЕРТАЯ НОТАРИАЛЬНАЯ КОНТОРА Г. МЕРСИН')
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
  assert.equal(matches[0].sourceText, 'Power of attorney dated 25 august 2025')
  assert.equal(matches[0].start, 0)
  assert.equal(matches[0].end, sourceText.length)
  assert.ok(matches[0].score >= 0.85 && matches[0].score < 1)
})

test('knowledge-base translations inherit lowercase, title case, and uppercase from the source context', () => {
  assert.equal(adaptTranslationCase('sürelidir', 'имеет срок', 'ru', 'tr'), 'имеет срок')
  assert.equal(adaptTranslationCase('Sürelidir', 'имеет срок', 'ru', 'tr'), 'Имеет срок')
  assert.equal(adaptTranslationCase('SÜRELİDİR', 'имеет срок', 'ru', 'tr'), 'ИМЕЕТ СРОК')
})

test('knowledge-base records use sentence case independently of entered casing', () => {
  assert.equal(sentenceCaseText('POWER OF ATTORNEY. LEGAL ADDRESS', 'en'), 'Power of attorney. Legal address')
  assert.equal(sentenceCaseText('доверенность. юРИДИЧЕСКИЙ АДРЕС', 'ru'), 'Доверенность. Юридический адрес')
})

test('one stored pair matches whole texts and repeated terms in either direction', async () => {
  const kb = createKnowledgeBase()
  const { results } = await kb.addMany([{ sourceText: 'VEKALETNAME', translation: 'Доверенность', sourceLanguage: 'tr', targetLanguage: 'ru' }])
  const id = results[0].entry.id
  const reverse = await kb.findExact('ДОВЕРЕННОСТЬ', 'Turkish', { sourceLanguage: 'Russian' })
  assert.equal(reverse.id, id)
  assert.equal(reverse.translation, 'VEKALETNAME')
  const text = 'Доверенность, доверенность. Недоверенность — нет.'
  const matches = await kb.findMatchesInText(text, 'tr', { sourceLanguage: 'ru', exactOnly: true })
  assert.deepEqual(matches.map(match => text.slice(match.start, match.end)), ['Доверенность', 'доверенность'])
  assert.ok(matches.every(match => match.entryId === id && match.score === 1 && match.matchType === 'exact-fragment'))
  assert.deepEqual(await kb.findMatchesInText('VEKALETNAMвE', 'ru', { sourceLanguage: 'tr', exactOnly: true }), [])
  assert.deepEqual(await kb.findMatchesInText('Доверенность', 'en', { sourceLanguage: 'ru', exactOnly: true }), [])
  assert.deepEqual(await kb.findMatchesInText('Доверенность', 'tr', { sourceLanguage: 'ru', glossaryId: 'another', exactOnly: true }), [])
  await kb.updateEntry(id, { translation: 'Полномочие' })
  assert.deepEqual(await kb.findMatchesInText('Доверенность', 'tr', { sourceLanguage: 'ru', exactOnly: true }), [])
  assert.equal((await kb.findMatchesInText('Полномочие', 'tr', { sourceLanguage: 'ru', exactOnly: true }))[0].entryId, id)
  await kb.deleteEntry(id)
  assert.deepEqual(await kb.findMatchesInText('Полномочие', 'tr', { sourceLanguage: 'ru', exactOnly: true }), [])
})

test('PostgreSQL exact matching checks both sides using language-aware boundaries, without a 200-row cutoff', async () => {
  const rows = Array.from({ length: 220 }, (_, index) => ({
    id: `entry-${index}`, glossary_id: DEFAULT_GLOSSARY_ID, source_text: `Term ${index}`,
    source_canonical: `term ${index}`, translation: `Термин ${index}`, source_language: 'tr', target_language: 'ru',
  }))
  rows.push({ id: 'notary', glossary_id: DEFAULT_GLOSSARY_ID, source_text: 'Mersin 4. Noterliği',
    source_canonical: 'mersin 4. noterliği', translation: 'Нотариальная контора', source_language: 'tr', target_language: 'ru' })
  const queries = []
  const pool = { async query(sql, params) {
    queries.push({ sql, params })
    if (sql.startsWith('SELECT * FROM icat_translation_memory')) return { rows }
    return { rows: [] }
  } }
  const kb = createKnowledgeBase({ pool })
  const cache = new Map()
  const forward = await kb.findMatchesInText('MERSİN 4. NOTERLİĞİ', 'ru', { sourceLanguage: 'tr', exactOnly: true, candidateCache: cache })
  assert.equal(forward[0].entryId, 'notary')
  assert.equal(forward[0].fullSegment, true)
  const before = queries.length
  await kb.findMatchesInText('MERSİN 4. NOTERLİĞİ', 'ru', { sourceLanguage: 'tr', exactOnly: true, candidateCache: cache })
  assert.equal(queries.length, before)
  const reverse = await kb.findExact('НОТАРИАЛЬНАЯ КОНТОРА', 'tr', { sourceLanguage: 'ru' })
  assert.equal(reverse.id, 'notary')
  assert.equal(reverse.translation, 'Mersin 4. Noterliği')
  assert.deepEqual(await kb.findMatchesInText('Нотариальная конторАА', 'tr', { sourceLanguage: 'ru', exactOnly: true }), [])
  assert.ok(queries.some(({ sql }) => sql.includes('OR lower(target_language) = ANY($3::text[])')))
})
