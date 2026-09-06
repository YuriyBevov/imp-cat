const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { Pool } = require('pg')

const DEFAULT_GLOSSARY_ID = '00000000-0000-4000-8000-000000000001'
const DEFAULT_DIMENSIONS = 1_536

function canonicalText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim()
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
  const sourceText = String(value.sourceText || '').trim().slice(0, 100_000)
  const translation = String(value.translation || '').trim().slice(0, 100_000)
  if (!sourceText || !translation) return null
  const now = new Date().toISOString()
  return {
    id: String(value.id || crypto.randomUUID()).slice(0, 120),
    glossaryId: String(value.glossaryId || DEFAULT_GLOSSARY_ID).slice(0, 120),
    sourceText,
    sourceCanonical: canonicalText(sourceText),
    translation,
    sourceLanguage: String(value.sourceLanguage || 'auto').slice(0, 20),
    targetLanguage: String(value.targetLanguage || 'ru').slice(0, 20),
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
  const result = {
    id: row.id,
    glossaryId: row.glossary_id ?? row.glossaryId,
    sourceText: row.source_text ?? row.sourceText,
    translation: row.translation,
    sourceLanguage: row.source_language ?? row.sourceLanguage,
    targetLanguage: row.target_language ?? row.targetLanguage,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
  if (score != null) result.score = Number(Number(score).toFixed(4))
  if (matchType) result.matchType = matchType
  return result
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
    const query = canonicalText(listOptions.query).toLocaleLowerCase()
    const glossaryId = String(listOptions.glossaryId || '')
    const sourceLanguage = String(listOptions.sourceLanguage || '')
    const targetLanguage = String(listOptions.targetLanguage || '')
    const limit = Math.max(1, pagination(listOptions.limit, 25, 100))
    const offset = pagination(listOptions.offset, 0, 1_000_000)
    const filtered = [...entries.values()].filter(entry => (
      (!glossaryId || entry.glossaryId === glossaryId)
      && (!sourceLanguage || entry.sourceLanguage === sourceLanguage)
      && (!targetLanguage || entry.targetLanguage === targetLanguage)
      && (!query || entry.sourceCanonical.toLocaleLowerCase().includes(query) || canonicalText(entry.translation).toLocaleLowerCase().includes(query))
    )).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    return { entries: filtered.slice(offset, offset + limit).map(publicEntry), total: filtered.length, limit, offset }
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
    const sourceCanonical = canonicalText(query)
    if (!sourceCanonical) return []
    const glossaryId = String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID)
    const sourceLanguage = String(searchOptions.sourceLanguage || '')
    const eligible = [...entries.values()].filter(entry => (
      entry.glossaryId === glossaryId
      && (!targetLanguage || entry.targetLanguage === targetLanguage)
      && (!sourceLanguage || sourceLanguage === 'auto' || entry.sourceLanguage === sourceLanguage || entry.sourceLanguage === 'auto')
    ))
    const exact = eligible.filter(entry => entry.sourceCanonical === sourceCanonical)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(entry => publicEntry(entry, 1, 'exact'))
    if (exact.length >= limit || !vectorReady()) return exact.slice(0, limit)
    const [queryVector] = await embeddings.embed([query], searchOptions)
    const exactIds = new Set(exact.map(entry => entry.id))
    const vectorMatches = eligible.filter(entry => entry.embedding && !exactIds.has(entry.id))
      .map(entry => ({ entry, score: cosine(queryVector, entry.embedding) }))
      .filter(item => item.score >= 0.5)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit - exact.length)
      .map(item => publicEntry(item.entry, item.score, 'vector'))
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
        const same = canonicalText(existing.translation) === canonicalText(candidate.translation)
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
    mode: 'memory', addMany, createGlossary, deleteEntry, listEntries, listGlossaries, search, updateEntry,
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

  function ready() {
    if (!readyPromise) {
      readyPromise = (async () => {
        await pool.query(await fs.promises.readFile(migrationPath, 'utf8'))
        await pool.query(
          `INSERT INTO icat_glossaries (id, name, source_language, target_language)
           VALUES ($1, $2, 'auto', 'ru') ON CONFLICT (id) DO NOTHING`,
          [DEFAULT_GLOSSARY_ID, 'Основной глоссарий'],
        )
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
       WHERE glossary_id = $1 AND target_language = $2 AND source_canonical = $3
         AND ($4 = 'auto' OR source_language = $4 OR source_language = 'auto')
       ORDER BY updated_at DESC LIMIT $5`,
      [String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID), String(targetLanguage || 'ru'), canonicalText(query), sourceLanguage, limit],
    )
    return result.rows
  }

  async function search(query, targetLanguage, limit = 8, searchOptions = {}) {
    await ready()
    const sourceCanonical = canonicalText(query)
    if (!sourceCanonical) return []
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 8))
    const exact = (await exactRows(query, targetLanguage, safeLimit, searchOptions)).map(row => publicEntry(row, 1, 'exact'))
    if (exact.length >= safeLimit || !vectorReady()) return exact.slice(0, safeLimit)
    const [queryVector] = await embeddings.embed([query], searchOptions)
    const sourceLanguage = String(searchOptions.sourceLanguage || 'auto')
    const result = await pool.query(
      `SELECT *, 1 - (embedding <=> $5::vector) AS similarity
       FROM icat_translation_memory
       WHERE glossary_id = $1 AND target_language = $2 AND embedding IS NOT NULL
         AND ($3 = 'auto' OR source_language = $3 OR source_language = 'auto')
         AND source_canonical <> $4 AND 1 - (embedding <=> $5::vector) >= 0.5
       ORDER BY embedding <=> $5::vector, updated_at DESC LIMIT $6`,
      [String(searchOptions.glossaryId || DEFAULT_GLOSSARY_ID), String(targetLanguage || 'ru'), sourceLanguage, sourceCanonical, vectorLiteral(queryVector, dimensions), safeLimit - exact.length],
    )
    return [...exact, ...result.rows.map(row => publicEntry(row, row.similarity, 'vector'))]
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
      const same = canonicalText(existing?.translation) === canonicalText(candidate.translation)
      results.push({ status: same ? 'existing' : 'conflict', entry: publicEntry(existing, 1, 'exact'), requestedTranslation: same ? undefined : candidate.translation, clientRef: candidate.clientRef })
    }
    return { results, created: results.filter(item => item.status === 'created').length }
  }

  return {
    mode: 'postgres-pgvector', addMany, createGlossary, deleteEntry, listEntries, listGlossaries, search, updateEntry,
    findExact: async (query, targetLanguage, searchOptions = {}) => {
      await ready()
      const row = (await exactRows(query, targetLanguage, 1, searchOptions))[0]
      return row ? publicEntry(row, 1, 'exact') : null
    },
    status: async () => {
      try {
        await ready()
        const result = await pool.query('SELECT count(*)::int AS entries FROM icat_translation_memory')
        return { mode: 'postgres-pgvector', persistent: true, connected: true, vectorSearch: vectorReady(), embeddingProvider: embeddings?.kind || null, embeddingModel: embeddings?.model || null, entries: result.rows[0]?.entries || 0 }
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
  canonicalText,
  cosine,
  createKnowledgeBase,
  createMemoryKnowledgeBase,
  createPostgresKnowledgeBase,
  vectorLiteral,
}
