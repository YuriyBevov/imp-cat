const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const DIMENSIONS = 384
const PROVIDER = 'local-hash-v1'

function canonicalText(value) {
  return String(value || '').normalize('NFKC').replace(/\s+/gu, ' ').trim()
}

function normalizedForVector(value) {
  return canonicalText(value).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function fnv1a(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function vectorize(value, dimensions = DIMENSIONS) {
  const normalized = normalizedForVector(value)
  const vector = new Array(dimensions).fill(0)
  if (!normalized) return vector
  const words = normalized.split(/\s+/u).filter(Boolean)
  const features = words.map(word => `w:${word}`)
  const padded = `  ${normalized}  `
  for (let index = 0; index <= padded.length - 3; index += 1) features.push(`c:${padded.slice(index, index + 3)}`)
  for (const feature of features) {
    const hash = fnv1a(feature)
    const position = hash % dimensions
    vector[position] += (hash & 0x80000000) ? -1 : 1
  }
  const magnitude = Math.sqrt(vector.reduce((sum, number) => sum + number * number, 0)) || 1
  return vector.map(number => Number((number / magnitude).toFixed(7)))
}

function cosine(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return 0
  let score = 0
  for (let index = 0; index < left.length; index += 1) score += Number(left[index] || 0) * Number(right[index] || 0)
  return Math.max(0, Math.min(1, score))
}

function publicEntry(entry, score = null, matchType = null) {
  const result = {
    id: entry.id,
    sourceText: entry.sourceText,
    translation: entry.translation,
    sourceLanguage: entry.sourceLanguage,
    targetLanguage: entry.targetLanguage,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
  if (score != null) result.score = Number(score.toFixed(4))
  if (matchType) result.matchType = matchType
  return result
}

function createKnowledgeBase(options) {
  const filePath = options.filePath
  const maximumEntries = Number(options.maximumEntries) || 20_000
  let writeQueue = Promise.resolve()

  async function readStore() {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
      const rawEntries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : []
      const entries = rawEntries.slice(-maximumEntries).map(entry => normalizeStoredEntry(entry)).filter(Boolean)
      return { version: 1, dimensions: DIMENSIONS, embeddingProvider: PROVIDER, entries }
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        return { version: 1, dimensions: DIMENSIONS, embeddingProvider: PROVIDER, entries: [] }
      }
      throw error
    }
  }

  function normalizeStoredEntry(entry) {
    const sourceText = String(entry?.sourceText || '').trim().slice(0, 100_000)
    const translation = String(entry?.translation || '').trim().slice(0, 100_000)
    if (!sourceText || !translation) return null
    const now = new Date().toISOString()
    return {
      id: String(entry.id || crypto.randomBytes(10).toString('hex')).slice(0, 120),
      sourceText,
      sourceCanonical: canonicalText(sourceText),
      translation,
      sourceLanguage: String(entry.sourceLanguage || 'auto').slice(0, 20),
      targetLanguage: String(entry.targetLanguage || 'ru').slice(0, 20),
      sourceVector: Array.isArray(entry.sourceVector) && entry.sourceVector.length === DIMENSIONS
        ? entry.sourceVector.map(Number)
        : vectorize(sourceText),
      createdAt: String(entry.createdAt || now).slice(0, 80),
      updatedAt: String(entry.updatedAt || entry.createdAt || now).slice(0, 80),
      provenance: entry.provenance && typeof entry.provenance === 'object' ? {
        documentId: String(entry.provenance.documentId || '').slice(0, 120),
        objectId: String(entry.provenance.objectId || '').slice(0, 120),
        unitId: String(entry.provenance.unitId || '').slice(0, 120),
      } : null,
    }
  }

  async function writeStore(store) {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.writing`
    await fs.promises.writeFile(temporary, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 })
    await fs.promises.rename(temporary, filePath)
  }

  async function search(query, targetLanguage, limit = 8) {
    const sourceCanonical = canonicalText(query)
    if (!sourceCanonical) return []
    const store = await readStore()
    const eligible = store.entries.filter(entry => !targetLanguage || entry.targetLanguage === targetLanguage)
    const exact = eligible
      .filter(entry => entry.sourceCanonical === sourceCanonical)
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .map(entry => publicEntry(entry, 1, 'exact'))
    if (exact.length >= limit) return exact.slice(0, limit)
    const queryVector = vectorize(query)
    const exactIds = new Set(exact.map(entry => entry.id))
    const vectorMatches = eligible
      .filter(entry => !exactIds.has(entry.id))
      .map(entry => ({ entry, score: cosine(queryVector, entry.sourceVector) }))
      .filter(item => item.score >= 0.5)
      .sort((left, right) => right.score - left.score || String(right.entry.updatedAt).localeCompare(String(left.entry.updatedAt)))
      .slice(0, Math.max(0, limit - exact.length))
      .map(item => publicEntry(item.entry, item.score, 'vector'))
    return [...exact, ...vectorMatches]
  }

  async function findExact(query, targetLanguage) {
    const matches = await search(query, targetLanguage, 1)
    return matches[0]?.matchType === 'exact' ? matches[0] : null
  }

  async function addMany(values) {
    const requested = Array.isArray(values) ? values.slice(0, 500) : []
    const operation = writeQueue.then(async () => {
      const store = await readStore()
      const results = []
      let changed = false
      for (const value of requested) {
        const candidate = normalizeStoredEntry({
          ...value,
          id: crypto.randomBytes(10).toString('hex'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        if (!candidate) {
          results.push({ status: 'invalid', sourceText: String(value?.sourceText || '') })
          continue
        }
        const existing = store.entries.find(entry => (
          entry.targetLanguage === candidate.targetLanguage && entry.sourceCanonical === candidate.sourceCanonical
        ))
        if (existing) {
          const sameTranslation = canonicalText(existing.translation) === canonicalText(candidate.translation)
          results.push({
            status: sameTranslation ? 'existing' : 'conflict',
            entry: publicEntry(existing, 1, 'exact'),
            requestedTranslation: sameTranslation ? undefined : candidate.translation,
            clientRef: value?.clientRef || null,
          })
          continue
        }
        store.entries.push(candidate)
        changed = true
        results.push({ status: 'created', entry: publicEntry(candidate, 1, 'exact'), clientRef: value?.clientRef || null })
      }
      if (store.entries.length > maximumEntries) store.entries = store.entries.slice(-maximumEntries)
      if (changed) await writeStore(store)
      return { results, created: results.filter(item => item.status === 'created').length }
    })
    writeQueue = operation.catch(() => {})
    return operation
  }

  return { addMany, findExact, readStore, search }
}

module.exports = { DIMENSIONS, PROVIDER, canonicalText, cosine, createKnowledgeBase, vectorize }
