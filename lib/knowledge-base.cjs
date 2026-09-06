const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { Pool } = require('pg')

const DEFAULT_GLOSSARY_ID = '00000000-0000-4000-8000-000000000001'
const DEFAULT_DIMENSIONS = 1_536
const LANGUAGE_GROUPS = [
  ['tr', 'turkish', 'türkçe', 'турецкий'],
  ['en', 'english', 'английский'],
  ['ru', 'russian', 'русский'],
  ['de', 'german', 'deutsch', 'немецкий'],
]

function canonicalText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim()
}

function languageVariants(value) {
  const normalized = String(value || 'auto').normalize('NFKC').trim().toLocaleLowerCase()
  if (!normalized || normalized === 'auto') return ['auto']
  return LANGUAGE_GROUPS.find(group => group.includes(normalized)) || [normalized]
}

function languageMatches(requested, stored) {
  const requestedVariants = languageVariants(requested)
  const storedVariants = languageVariants(stored)
  return requestedVariants.includes('auto') || storedVariants.includes('auto')
    || requestedVariants.some(value => storedVariants.includes(value))
}

function languageLocale(value) {
  const variants = languageVariants(value)
  if (variants.includes('tr')) return 'tr'
  if (variants.includes('de')) return 'de'
  if (variants.includes('ru')) return 'ru'
  return 'en'
}

function knowledgeText(value, language = 'auto') {
  return canonicalText(value).toLocaleLowerCase(languageLocale(language)).normalize('NFC')
}

function firstLetter(value) {
  return Array.from(String(value || '')).find(character => /\p{L}/u.test(character)) || ''
}

function adaptTranslationCase(sourceValue, translationValue, targetLanguage = 'auto', sourceLanguage = 'auto') {
  const sourceLetters = Array.from(String(sourceValue || '')).filter(character => /\p{L}/u.test(character))
  const translation = String(translationValue || '')
  if (!sourceLetters.length || !translation) return translation
  const sourceLocale = languageLocale(sourceLanguage)
  const targetLocale = languageLocale(targetLanguage)
  const allUppercase = sourceLetters.every(character => (
    character === character.toLocaleUpperCase(sourceLocale)
    && character !== character.toLocaleLowerCase(sourceLocale)
  ))
  if (allUppercase) return translation.toLocaleUpperCase(targetLocale)
  const initial = firstLetter(sourceValue)
  const startsUppercase = initial
    && initial === initial.toLocaleUpperCase(sourceLocale)
    && initial !== initial.toLocaleLowerCase(sourceLocale)
  if (!startsUppercase) return translation
  const characters = Array.from(translation)
  const index = characters.findIndex(character => /\p{L}/u.test(character))
  if (index >= 0) characters[index] = characters[index].toLocaleUpperCase(targetLocale)
  return characters.join('')
}

function cosine(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return 0
  let dot = 0
  let leftMagnitude = 0
  let rightMagnitude = 0
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]) || 0
    const b = Number(right[index]) || 0
    dot += a * b
    leftMagnitude += a * a
    rightMagnitude += b * b
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude)
  return denominator ? Math.max(-1, Math.min(1, dot / denominator)) : 0
}

function normalizeGlossary(value = {}) {
  const now = new Date().toISOString()
  return {
    id: String(value.id || crypto.randomUUID()).slice(0, 120),
    name: String(value.name || 'Основной глоссарий').trim().slice(0, 240),
    sourceLanguage: String(value.sourceLanguage || 'auto').slice(0, 20),
    targetLanguage: String(value.targetLanguage || 'ru').slice(0, 20),
    domain: String(value.domain || '').trim().slice(0, 240),
    description: String(value.description || '').trim().slice(0, 2_000),
    active: value.active !== false,
    createdAt: String(value.createdAt || now),
    updatedAt: String(value.updatedAt || now),
  }
}

function normalizeEntry(value = {}) {
  const sourceLanguage = String(value.sourceLanguage || 'auto').slice(0, 20)
  const targetLanguage = String(value.targetLanguage || 'ru').slice(0, 20)
  const sourceText = knowledgeText(String(value.sourceText || '').slice(0, 100_000), sourceLanguage).slice(0, 100_000)
  const translation = knowledgeText(String(value.translation || '').slice(0, 100_000), targetLanguage).slice(0, 100_000)
  if (!sourceText || !translation) return null
  const now = new Date().toISOString()
  return {
    id: String(value.id || crypto.randomUUID()).slice(0, 120),
    glossaryId: String(value.glossaryId || DEFAULT_GLOSSARY_ID).slice(0, 120),
    sourceText,
    sourceCanonical: sourceText,
    translation,
    sourceLanguage,
    targetLanguage,
    clientRef: value.clientRef ? String(value.clientRef).slice(0, 240) : null,
    provenance: value.provenance && typeof value.provenance === 'object' ? {
      documentId: String(value.provenance.documentId || '').slice(0, 120),
      objectId: String(value.provenance.objectId || '').slice(0, 120),
      unitId: String(value.provenance.unitId || '').slice(0, 120),
    } : null,
    createdAt: String(value.createdAt || now),
    updatedAt: String(value.updatedAt || now),
  }
}

function publicGlossary(row) {
  return {
    id: row.id,
    name: row.name,
    sourceLanguage: row.source_language ?? row.sourceLanguage,
    targetLanguage: row.target_language ?? row.targetLanguage,
    domain: row.domain || '',
    description: row.description || '',
    active: row.is_active ?? row.active ?? true,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
}

function publicEntry(row, score = null, matchType = null) {
  const sourceLanguage = row.source_language ?? row.sourceLanguage
  const targetLanguage = row.target_language ?? row.targetLanguage
  const result = {
    id: row.id,
    glossaryId: row.glossary_id ?? row.glossaryId,
    sourceText: knowledgeText(row.source_text ?? row.sourceText, sourceLanguage),
    translation: knowledgeText(row.translation, targetLanguage),
    sourceLanguage,
    targetLanguage,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
  if (score != null) result.score = Number(Number(score).toFixed(4))
  if (matchType) result.matchType = matchType
  return result
}

function contextualEntry(entry, sourceText) {
  return { ...entry, translation: adaptTranslationCase(sourceText, entry.translation, entry.targetLanguage, entry.sourceLanguage) }
}

function knowledgeBaseConflict(message = 'Такая исходная фраза уже существует в выбранном глоссарии') {
  const error = new Error(message)
  error.code = 'KNOWLEDGE_BASE_CONFLICT'
  return error
}

function pagination(value, fallback, maximum) {
  const number = Number.parseInt(value, 10)
  return Number.isFinite(number) ? Math.max(0, Math.min(maximum, number)) : fallback
}

function foldedTextWithOffsets(value, language) {
  const text = String(value || '')
  const locale = languageLocale(language)
  const folded = []
  const starts = []
  const ends = []
  let offset = 0
  for (const character of text) {
    const start = offset
    offset += character.length
    if (/\s/u.test(character)) {
      if (!folded.length) continue
      if (folded.at(-1) === ' ') {
        ends[ends.length - 1] = offset
        continue
      }
      folded.push(' ')
      starts.push(start)
      ends.push(offset)
      continue
    }
    const normalized = character.toLocaleLowerCase(locale).normalize('NFC')
    for (let index = 0; index < normalized.length; index += 1) {
      folded.push(normalized[index])
      starts.push(start)
      ends.push(offset)
    }
  }
  if (folded.at(-1) === ' ') {
    folded.pop()
    starts.pop()
    ends.pop()
  }
  return { text: folded.join(''), starts, ends }
}

function findTextOccurrences(textValue, sourceValue, maximum = 20, language = 'auto') {
  const text = String(textValue || '')
  const foldedText = foldedTextWithOffsets(text, language)
  const sourceText = knowledgeText(sourceValue, language)
  if (!sourceText || sourceText.length > foldedText.text.length) return []
  const offsets = []
  let cursor = 0
  while (cursor <= foldedText.text.length - sourceText.length) {
    const matchStart = foldedText.text.indexOf(sourceText, cursor)
    if (matchStart < 0) break
    const matchEnd = matchStart + sourceText.length
    const start = foldedText.starts[matchStart]
    const end = foldedText.ends[matchEnd - 1]
    const beginsWithWord = /^[\p{L}\p{N}]/u.test(sourceText)
    const endsWithWord = /[\p{L}\p{N}]$/u.test(sourceText)
    const validStart = !beginsWithWord || start === 0 || !/[\p{L}\p{N}]/u.test(text[start - 1])
    const validEnd = !endsWithWord || end === text.length || !/[\p{L}\p{N}]/u.test(text[end])
    if (validStart && validEnd) offsets.push({ start, end })
    if (offsets.length >= maximum) break
    cursor = matchStart + Math.max(1, sourceText.length)
  }
  return offsets
}

function entryMatchesInText(entry, text) {
  const fullSegment = knowledgeText(entry.sourceText, entry.sourceLanguage) === knowledgeText(text, entry.sourceLanguage)
  return findTextOccurrences(text, entry.sourceText, 20, entry.sourceLanguage).map((range, index) => ({
    id: `${entry.id}:${range.start}:${range.end}:${index}`,
    entryId: entry.id,
    glossaryId: entry.glossaryId,
    sourceText: entry.sourceText,
    translation: adaptTranslationCase(text.slice(range.start, range.end), entry.translation, entry.targetLanguage, entry.sourceLanguage),
    sourceLanguage: entry.sourceLanguage,
    targetLanguage: entry.targetLanguage,
    start: range.start,
    end: range.end,
    score: 1,
    matchType: fullSegment ? 'exact' : 'exact-fragment',
    fullSegment,
  }))
}

function trigramSimilarity(leftValue, rightValue) {
  const grams = value => {
    const text = `  ${canonicalText(value).toLocaleLowerCase()} `
    const result = new Set()
    for (let index = 0; index <= text.length - 3; index += 1) result.add(text.slice(index, index + 3))
    return result
  }
  const left = grams(leftValue)
  const right = grams(rightValue)
  if (!left.size || !right.size) return 0
  let shared = 0
  for (const gram of left) if (right.has(gram)) shared += 1
  return 2 * shared / (left.size + right.size)
}

function fuzzyEntryMatch(entry, text, score) {
  return {
    id: `${entry.id}:fuzzy`, entryId: entry.id, glossaryId: entry.glossaryId,
    sourceText: entry.sourceText, translation: adaptTranslationCase(text, entry.translation, entry.targetLanguage, entry.sourceLanguage),
    sourceLanguage: entry.sourceLanguage, targetLanguage: entry.targetLanguage,
    start: 0, end: String(text || '').length, score, matchType: 'fuzzy', fullSegment: false,
  }
}

function vectorLiteral(vector, dimensions) {
  if (!Array.isArray(vector) || vector.length !== dimensions || vector.some(value => !Number.isFinite(Number(value)))) {
    throw new Error(`Некорректный embedding: ожидается ${dimensions} чисел`)
  }
  return `[${vector.map(value => Number(value)).join(',')}]`
}

async function embedTexts(provider, values, requestOptions = {}) {
  const vectors = []
  for (let offset = 0; offset < values.length; offset += 64) {
    requestOptions.signal?.throwIfAborted?.()
    vectors.push(...await provider.embed(values.slice(offset, offset + 64), requestOptions))
  }
  return vectors
}

function createMemoryKnowledgeBase(options = {}) {
  const embeddings = options.embeddingProvider || null
  const vectorReady = () => Boolean(embeddings && (typeof embeddings.available !== 'function' || embeddings.available()))
  const glossaries = new Map([[DEFAULT_GLOSSARY_ID, normalizeGlossary({ id: DEFAULT_GLOSSARY_ID })]])
  const entries = new Map()

  async function listGlossaries() {
    return [...glossaries.values()].map(publicGlossary)
  }

  async function createGlossary(value) {
    const glossary = normalizeGlossary(value)
    if (!glossary.name) throw new Error('Укажите название глоссария')
    glossaries.set(glossary.id, glossary)
    return publicGlossary(glossary)
  }

  async function listEntries(listOptions = {}) {
    const glossaryId = String(listOptions.glossaryId || '')
    const sourceLanguage = String(listOptions.sourceLanguage || '')
    const targetLanguage = String(listOptions.targetLanguage || '')
    const queries = [
      knowledgeText(listOptions.query, sourceLanguage || 'auto'),
      knowledgeText(listOptions.query, targetLanguage || 'auto'),
    ].filter(Boolean)
    const limit = Math.max(1, pagination(listOptions.limit, 25, 100))
    const offset = pagination(listOptions.offset, 0, 1_000_000)
    const filtered = [...entries.values()].filter(entry => (
      (!glossaryId || entry.glossaryId === glossaryId)
      && (!sourceLanguage || languageMatches(sourceLanguage, entry.sourceLanguage))
      && (!targetLanguage || languageMatches(targetLanguage, entry.targetLanguage))
      && (!queries.length || queries.some(query => entry.sourceCanonical.includes(query) || entry.translation.includes(query)))
    )).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    return { entries: filtered.slice(offset, offset + limit).map(publicEntry), total: filtered.length, limit, offset }
  }

  async function getEntry(id) {
    const entry = entries.get(String(id))
    return entry ? publicEntry(entry) : null
  }

  async function findMatchesInText(text, targetLanguage, searchOptions = {}) {
    const glossaryId = String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID)
    const sourceLanguage = String(searchOptions.sourceLanguage || 'auto')
    const eligible = [...entries.values()]
      .filter(entry => entry.glossaryId === glossaryId
        && (!targetLanguage || languageMatches(targetLanguage, entry.targetLanguage))
        && languageMatches(sourceLanguage, entry.sourceLanguage))
    const exact = eligible.flatMap(entry => entryMatchesInText(entry, text))
      .sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start))
      .slice(0, 100)
    if (exact.length) return exact
    return eligible.map(entry => ({ entry, score: trigramSimilarity(entry.sourceText, knowledgeText(text, entry.sourceLanguage)) }))
      .filter(item => item.score >= 0.45)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map(item => fuzzyEntryMatch(item.entry, text, item.score))
  }

  async function updateEntry(id, value = {}, requestOptions = {}) {
    const existing = entries.get(String(id))
    if (!existing) return null
    const supplied = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
    const updated = normalizeEntry({ ...existing, ...supplied, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() })
    if (!updated) throw new Error('Для записи нужны исходный текст и перевод')
    const uniqueKey = `${updated.glossaryId}\u0000${updated.sourceLanguage}\u0000${updated.targetLanguage}\u0000${updated.sourceCanonical}`
    if ([...entries.values()].some(entry => entry.id !== existing.id && entry.uniqueKey === uniqueKey)) throw knowledgeBaseConflict()
    const sourceChanged = updated.sourceCanonical !== existing.sourceCanonical
    updated.embedding = sourceChanged
      ? (vectorReady() ? (await embedTexts(embeddings, [updated.sourceText], requestOptions))[0] : null)
      : existing.embedding
    updated.uniqueKey = uniqueKey
    entries.set(updated.id, updated)
    return publicEntry(updated)
  }

  async function deleteEntry(id) {
    return entries.delete(String(id))
  }

  async function search(query, targetLanguage, limit = 8, searchOptions = {}) {
    const sourceLanguage = String(searchOptions.sourceLanguage || '')
    const sourceCanonical = knowledgeText(query, sourceLanguage || 'auto')
    if (!sourceCanonical) return []
    const glossaryId = String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID)
    const eligible = [...entries.values()].filter(entry => (
      entry.glossaryId === glossaryId
      && (!targetLanguage || languageMatches(targetLanguage, entry.targetLanguage))
      && (!sourceLanguage || languageMatches(sourceLanguage, entry.sourceLanguage))
    ))
    const exact = eligible.filter(entry => entry.sourceCanonical === sourceCanonical)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(entry => contextualEntry(publicEntry(entry, 1, 'exact'), query))
    if (exact.length >= limit || !vectorReady()) return exact.slice(0, limit)
    const [queryVector] = await embeddings.embed([query], searchOptions)
    const exactIds = new Set(exact.map(entry => entry.id))
    const vectorMatches = eligible.filter(entry => entry.embedding && !exactIds.has(entry.id))
      .map(entry => ({ entry, score: cosine(queryVector, entry.embedding) }))
      .filter(item => item.score >= 0.5)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit - exact.length)
      .map(item => contextualEntry(publicEntry(item.entry, item.score, 'vector'), query))
    return [...exact, ...vectorMatches]
  }

  async function addMany(values, requestOptions = {}) {
    const candidates = (Array.isArray(values) ? values : []).slice(0, 500).map(normalizeEntry)
    const valid = candidates.filter(Boolean)
    const vectors = vectorReady() && valid.length ? await embedTexts(embeddings, valid.map(entry => entry.sourceText), requestOptions) : valid.map(() => null)
    const results = []
    for (const candidate of candidates) {
      if (!candidate) {
        results.push({ status: 'invalid' })
        continue
      }
      const key = `${candidate.glossaryId}\u0000${candidate.sourceLanguage}\u0000${candidate.targetLanguage}\u0000${candidate.sourceCanonical}`
      const existing = [...entries.values()].find(entry => entry.uniqueKey === key)
      if (existing) {
      const same = knowledgeText(existing.translation, candidate.targetLanguage) === candidate.translation
        results.push({ status: same ? 'existing' : 'conflict', entry: publicEntry(existing, 1, 'exact'), requestedTranslation: same ? undefined : candidate.translation, clientRef: candidate.clientRef })
        continue
      }
      candidate.uniqueKey = key
      candidate.embedding = vectors[valid.indexOf(candidate)]
      entries.set(candidate.id, candidate)
      results.push({ status: 'created', entry: publicEntry(candidate, 1, 'exact'), clientRef: candidate.clientRef })
    }
    return { results, created: results.filter(item => item.status === 'created').length }
  }

  return {
    mode: 'memory', addMany, createGlossary, deleteEntry, findMatchesInText, getEntry, listEntries, listGlossaries, search, updateEntry,
    findExact: async (query, targetLanguage, searchOptions) => {
      const match = (await search(query, targetLanguage, 1, searchOptions))[0]
      return match?.matchType === 'exact' ? match : null
    },
    status: async () => ({ mode: 'memory', persistent: false, vectorSearch: vectorReady(), embeddingProvider: embeddings?.kind || null, embeddingModel: embeddings?.model || null }),
  }
}

function createPostgresKnowledgeBase(options = {}) {
  const embeddings = options.embeddingProvider || null
  const vectorReady = () => Boolean(embeddings && (typeof embeddings.available !== 'function' || embeddings.available()))
  const dimensions = Number(options.dimensions) || embeddings?.dimensions || DEFAULT_DIMENSIONS
  if (dimensions !== DEFAULT_DIMENSIONS) throw new Error(`Схема pgvector рассчитана на ${DEFAULT_DIMENSIONS} измерений`)
  const pool = options.pool || new Pool({
    connectionString: options.connectionString,
    max: Number(options.poolSize) || 10,
    connectionTimeoutMillis: Number(options.connectionTimeoutMs) || 3_000,
  })
  const migrationPath = options.migrationPath || path.join(__dirname, '..', 'migrations', '001_pgvector_knowledge_base.sql')
  let readyPromise = null
  let normalizationConflicts = 0

  async function normalizeStoredEntries() {
    const result = await pool.query('SELECT * FROM icat_translation_memory')
    normalizationConflicts = 0
    for (const row of result.rows) {
      const normalized = normalizeEntry({
        id: row.id,
        glossaryId: row.glossary_id,
        sourceText: row.source_text,
        translation: row.translation,
        sourceLanguage: row.source_language,
        targetLanguage: row.target_language,
        provenance: row.metadata?.provenance,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })
      if (!normalized || (
        normalized.sourceText === row.source_text
        && normalized.sourceCanonical === row.source_canonical
        && normalized.translation === row.translation
      )) continue
      try {
        await pool.query(
          `UPDATE icat_translation_memory
           SET source_text = $2, source_canonical = $3, translation = $4, updated_at = now()
           WHERE id = $1`,
          [row.id, normalized.sourceText, normalized.sourceCanonical, normalized.translation],
        )
      } catch (error) {
        if (error.code !== '23505') throw error
        normalizationConflicts += 1
        await pool.query(
          'UPDATE icat_translation_memory SET translation = $2, updated_at = now() WHERE id = $1',
          [row.id, normalized.translation],
        )
      }
    }
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = (async () => {
        await pool.query(await fs.promises.readFile(migrationPath, 'utf8'))
        await pool.query(
          `INSERT INTO icat_glossaries (id, name, source_language, target_language)
           VALUES ($1, $2, 'auto', 'ru') ON CONFLICT (id) DO NOTHING`,
          [DEFAULT_GLOSSARY_ID, 'Основной глоссарий'],
        )
        await normalizeStoredEntries()
      })()
      readyPromise.catch(() => { readyPromise = null })
    }
    return readyPromise
  }

  async function listGlossaries() {
    await ready()
    const result = await pool.query('SELECT * FROM icat_glossaries WHERE is_active = true ORDER BY name, created_at')
    return result.rows.map(publicGlossary)
  }

  async function createGlossary(value) {
    await ready()
    const glossary = normalizeGlossary(value)
    if (!glossary.name) throw new Error('Укажите название глоссария')
    const result = await pool.query(
      `INSERT INTO icat_glossaries
       (id, name, source_language, target_language, domain, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [glossary.id, glossary.name, glossary.sourceLanguage, glossary.targetLanguage, glossary.domain, glossary.description, glossary.active],
    )
    return publicGlossary(result.rows[0])
  }

  async function listEntries(listOptions = {}) {
    await ready()
    const conditions = []
    const values = []
    const addValue = value => {
      values.push(value)
      return `$${values.length}`
    }
    const glossaryId = String(listOptions.glossaryId || '')
    const sourceLanguage = String(listOptions.sourceLanguage || '')
    const targetLanguage = String(listOptions.targetLanguage || '')
    const query = canonicalText(listOptions.query)
    if (glossaryId) conditions.push(`glossary_id = ${addValue(glossaryId)}`)
    if (sourceLanguage) conditions.push(`source_language = ${addValue(sourceLanguage)}`)
    if (targetLanguage) conditions.push(`target_language = ${addValue(targetLanguage)}`)
    if (query) {
      const queryRef = addValue(query)
      conditions.push(`(position(lower(${queryRef}) in lower(source_text)) > 0 OR position(lower(${queryRef}) in lower(translation)) > 0)`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const countResult = await pool.query(`SELECT count(*)::int AS total FROM icat_translation_memory ${where}`, values)
    const limit = Math.max(1, pagination(listOptions.limit, 25, 100))
    const offset = pagination(listOptions.offset, 0, 1_000_000)
    const limitRef = addValue(limit)
    const offsetRef = addValue(offset)
    const result = await pool.query(
      `SELECT * FROM icat_translation_memory ${where}
       ORDER BY updated_at DESC, created_at DESC LIMIT ${limitRef} OFFSET ${offsetRef}`,
      values,
    )
    return { entries: result.rows.map(publicEntry), total: countResult.rows[0]?.total || 0, limit, offset }
  }

  async function getEntry(id) {
    await ready()
    const result = await pool.query('SELECT * FROM icat_translation_memory WHERE id = $1 LIMIT 1', [String(id)])
    return result.rows[0] ? publicEntry(result.rows[0]) : null
  }

  async function findMatchesInText(text, targetLanguage, searchOptions = {}) {
    await ready()
    const sourceText = String(text || '').slice(0, 100_000)
    if (!sourceText.trim()) return []
    const sourceLanguage = String(searchOptions.sourceLanguage || 'auto')
    const normalizedSourceText = knowledgeText(sourceText, sourceLanguage)
    const result = await pool.query(
      `SELECT * FROM icat_translation_memory
       WHERE glossary_id = $1 AND lower(target_language) = ANY($2::text[])
         AND ($3::boolean OR lower(source_language) = ANY($4::text[]) OR lower(source_language) = 'auto')
         AND length(source_text) <= length($5)
         AND (position(source_text in $5) > 0 OR position(lower(source_text) in $5) > 0)
       ORDER BY length(source_text) DESC, updated_at DESC LIMIT 200`,
      [String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID), languageVariants(targetLanguage || 'ru'),
        languageVariants(sourceLanguage).includes('auto'), languageVariants(sourceLanguage), normalizedSourceText],
    )
    const exact = result.rows.map(row => publicEntry(row))
      .flatMap(entry => entryMatchesInText(entry, sourceText))
      .sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start))
      .slice(0, 100)
    if (exact.length) return exact
    const fuzzy = await pool.query(
      `SELECT *, similarity(source_canonical, $5) AS text_similarity
       FROM icat_translation_memory
       WHERE glossary_id = $1 AND lower(target_language) = ANY($2::text[])
         AND ($3::boolean OR lower(source_language) = ANY($4::text[]) OR lower(source_language) = 'auto')
         AND length(source_text) >= 4 AND similarity(source_canonical, $5) >= 0.45
       ORDER BY text_similarity DESC, updated_at DESC LIMIT 8`,
      [String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID), languageVariants(targetLanguage || 'ru'),
        languageVariants(sourceLanguage).includes('auto'), languageVariants(sourceLanguage), normalizedSourceText],
    )
    return fuzzy.rows.map(row => fuzzyEntryMatch(publicEntry(row), sourceText, Number(row.text_similarity) || 0))
  }

  async function updateEntry(id, value = {}, requestOptions = {}) {
    await ready()
    const current = await pool.query('SELECT * FROM icat_translation_memory WHERE id = $1 LIMIT 1', [String(id)])
    const row = current.rows[0]
    if (!row) return null
    const existing = normalizeEntry({
      id: row.id,
      glossaryId: row.glossary_id,
      sourceText: row.source_text,
      translation: row.translation,
      sourceLanguage: row.source_language,
      targetLanguage: row.target_language,
      provenance: row.metadata?.provenance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })
    const supplied = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
    const updated = normalizeEntry({ ...existing, ...supplied, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() })
    if (!updated) throw new Error('Для записи нужны исходный текст и перевод')
    const sourceChanged = updated.sourceCanonical !== existing.sourceCanonical
    const vector = sourceChanged && vectorReady()
      ? (await embedTexts(embeddings, [updated.sourceText], requestOptions))[0]
      : null
    try {
      const result = await pool.query(
        `UPDATE icat_translation_memory SET
           glossary_id = $2, source_text = $3, source_canonical = $4, translation = $5,
           source_language = $6, target_language = $7,
           embedding = CASE WHEN $8::boolean THEN $9::vector ELSE embedding END,
           embedding_model = CASE WHEN $8::boolean THEN $10 ELSE embedding_model END,
           updated_at = now()
         WHERE id = $1 RETURNING *`,
        [updated.id, updated.glossaryId, updated.sourceText, updated.sourceCanonical, updated.translation,
          updated.sourceLanguage, updated.targetLanguage, sourceChanged, vector ? vectorLiteral(vector, dimensions) : null,
          sourceChanged && vector ? embeddings?.model || null : null],
      )
      return result.rows[0] ? publicEntry(result.rows[0]) : null
    } catch (error) {
      if (error.code === '23505') throw knowledgeBaseConflict()
      throw error
    }
  }

  async function deleteEntry(id) {
    await ready()
    const result = await pool.query('DELETE FROM icat_translation_memory WHERE id = $1 RETURNING id', [String(id)])
    return Boolean(result.rows[0])
  }

  async function exactRows(query, targetLanguage, limit, searchOptions) {
    const sourceLanguage = String(searchOptions.sourceLanguage || 'auto')
    const result = await pool.query(
      `SELECT * FROM icat_translation_memory
       WHERE glossary_id = $1 AND lower(target_language) = ANY($2::text[]) AND source_canonical = $3
         AND ($4::boolean OR lower(source_language) = ANY($5::text[]) OR lower(source_language) = 'auto')
       ORDER BY updated_at DESC LIMIT $6`,
      [String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID), languageVariants(targetLanguage || 'ru'), knowledgeText(query, sourceLanguage),
        languageVariants(sourceLanguage).includes('auto'), languageVariants(sourceLanguage), limit],
    )
    return result.rows
  }

  async function search(query, targetLanguage, limit = 8, searchOptions = {}) {
    await ready()
    const sourceLanguage = String(searchOptions.sourceLanguage || 'auto')
    const sourceCanonical = knowledgeText(query, sourceLanguage)
    if (!sourceCanonical) return []
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8))
    const exact = (await exactRows(query, targetLanguage, safeLimit, searchOptions))
      .map(row => contextualEntry(publicEntry(row, 1, 'exact'), query))
    if (exact.length >= safeLimit || !vectorReady()) return exact.slice(0, safeLimit)
    const [queryVector] = await embeddings.embed([query], searchOptions)
    const result = await pool.query(
      `SELECT *, 1 - (embedding <=> $5::vector) AS similarity
       FROM icat_translation_memory
       WHERE glossary_id = $1 AND lower(target_language) = ANY($2::text[]) AND embedding IS NOT NULL
         AND ($3::boolean OR lower(source_language) = ANY($4::text[]) OR lower(source_language) = 'auto')
         AND source_canonical <> $6 AND 1 - (embedding <=> $5::vector) >= 0.5
       ORDER BY embedding <=> $5::vector, updated_at DESC LIMIT $7`,
      [String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID), languageVariants(targetLanguage || 'ru'),
        languageVariants(sourceLanguage).includes('auto'), languageVariants(sourceLanguage), vectorLiteral(queryVector, dimensions),
        sourceCanonical, safeLimit - exact.length],
    )
    return [...exact, ...result.rows.map(row => contextualEntry(publicEntry(row, row.similarity, 'vector'), query))]
  }

  async function addMany(values, requestOptions = {}) {
    await ready()
    const candidates = (Array.isArray(values) ? values : []).slice(0, 500).map(normalizeEntry)
    const valid = candidates.filter(Boolean)
    const vectors = vectorReady() && valid.length ? await embedTexts(embeddings, valid.map(entry => entry.sourceText), requestOptions) : valid.map(() => null)
    const results = []
    for (const candidate of candidates) {
      if (!candidate) {
        results.push({ status: 'invalid' })
        continue
      }
      const vector = vectors[valid.indexOf(candidate)]
      const inserted = await pool.query(
        `INSERT INTO icat_translation_memory
         (id, glossary_id, source_text, source_canonical, translation, source_language, target_language, embedding, embedding_model, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9, $10::jsonb)
         ON CONFLICT (glossary_id, source_language, target_language, source_canonical) DO NOTHING RETURNING *`,
        [candidate.id, candidate.glossaryId, candidate.sourceText, candidate.sourceCanonical, candidate.translation, candidate.sourceLanguage, candidate.targetLanguage, vector ? vectorLiteral(vector, dimensions) : null, embeddings?.model || null, JSON.stringify({ provenance: candidate.provenance })],
      )
      if (inserted.rows[0]) {
        results.push({ status: 'created', entry: publicEntry(inserted.rows[0], 1, 'exact'), clientRef: candidate.clientRef })
        continue
      }
      const existingResult = await pool.query(
        `SELECT * FROM icat_translation_memory
         WHERE glossary_id = $1 AND source_language = $2 AND target_language = $3 AND source_canonical = $4 LIMIT 1`,
        [candidate.glossaryId, candidate.sourceLanguage, candidate.targetLanguage, candidate.sourceCanonical],
      )
      const existing = existingResult.rows[0]
      const same = knowledgeText(existing?.translation, candidate.targetLanguage) === candidate.translation
      results.push({ status: same ? 'existing' : 'conflict', entry: publicEntry(existing, 1, 'exact'), requestedTranslation: same ? undefined : candidate.translation, clientRef: candidate.clientRef })
    }
    return { results, created: results.filter(item => item.status === 'created').length }
  }

  return {
    mode: 'postgres-pgvector', addMany, createGlossary, deleteEntry, findMatchesInText, getEntry, listEntries, listGlossaries, search, updateEntry,
    findExact: async (query, targetLanguage, searchOptions = {}) => {
      await ready()
      const row = (await exactRows(query, targetLanguage, 1, searchOptions))[0]
      return row ? publicEntry(row, 1, 'exact') : null
    },
    status: async () => {
      try {
        await ready()
        const result = await pool.query('SELECT count(*)::int AS entries FROM icat_translation_memory')
        return { mode: 'postgres-pgvector', persistent: true, connected: true, vectorSearch: vectorReady(), embeddingProvider: embeddings?.kind || null, embeddingModel: embeddings?.model || null, entries: result.rows[0]?.entries || 0, normalizationConflicts }
      } catch (error) {
        return { mode: 'postgres-pgvector', persistent: true, connected: false, vectorSearch: false, embeddingProvider: embeddings?.kind || null, embeddingModel: embeddings?.model || null, error: String(error.message || error).slice(0, 300) }
      }
    },
    close: () => options.pool ? undefined : pool.end(),
  }
}

function createKnowledgeBase(options = {}) {
  return options.connectionString || options.pool
    ? createPostgresKnowledgeBase(options)
    : createMemoryKnowledgeBase(options)
}

module.exports = {
  DEFAULT_DIMENSIONS,
  DEFAULT_GLOSSARY_ID,
  adaptTranslationCase,
  canonicalText,
  cosine,
  createKnowledgeBase,
  createMemoryKnowledgeBase,
  createPostgresKnowledgeBase,
  entryMatchesInText,
  findTextOccurrences,
  languageMatches,
  languageLocale,
  languageVariants,
  knowledgeText,
  trigramSimilarity,
  vectorLiteral,
}
