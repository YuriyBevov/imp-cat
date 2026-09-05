(function initializeTranslationUnits(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.IcatTranslationUnits = api
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const MAX_UNITS = 500

  function cleanText(value, maximum = 100_000) {
    return String(value || '').slice(0, maximum)
  }

  function canonicalText(value) {
    return cleanText(value).normalize('NFKC').replace(/\s+/gu, ' ').trim()
  }

  function unitId(objectId, index, sourceText) {
    let hash = 2166136261
    const value = `${objectId}:${index}:${sourceText}`
    for (let cursor = 0; cursor < value.length; cursor += 1) {
      hash ^= value.charCodeAt(cursor)
      hash = Math.imul(hash, 16777619)
    }
    return `${String(objectId || 'segment').slice(0, 70)}-unit-${index + 1}-${(hash >>> 0).toString(36)}`
  }

  function normalizeSuggestion(value) {
    if (!value || typeof value !== 'object') return null
    const translation = cleanText(value.translation).trim()
    if (!translation) return null
    return {
      entryId: cleanText(value.entryId || value.id, 120),
      translation,
      score: Math.max(0, Math.min(1, Number(value.score) || 0)),
      matchType: value.matchType === 'exact' ? 'exact' : 'vector',
      targetLanguage: cleanText(value.targetLanguage, 20),
    }
  }

  function normalizeUnit(value, objectId, index) {
    const sourceText = cleanText(value?.sourceText)
    const translation = cleanText(value?.translation)
    const suggestion = normalizeSuggestion(value?.memorySuggestion)
    const allowedStatuses = new Set(['new', 'memory-suggested', 'memory-applied', 'machine-translated', 'edited', 'approved'])
    return {
      id: cleanText(value?.id, 120) || unitId(objectId, index, sourceText),
      sourceText,
      separatorAfter: cleanText(value?.separatorAfter, 200),
      translation,
      status: allowedStatuses.has(value?.status) ? value.status : translation ? 'edited' : suggestion ? 'memory-suggested' : 'new',
      memorySuggestion: suggestion,
      memoryEntryId: cleanText(value?.memoryEntryId, 120) || null,
    }
  }

  function sourceFromUnits(units) {
    return (units || []).map(unit => `${unit.sourceText || ''}${unit.separatorAfter || ''}`).join('')
  }

  function translationFromUnits(units, requireComplete = true) {
    if (!Array.isArray(units) || !units.length) return ''
    if (requireComplete && units.some(unit => !String(unit.translation || '').trim())) return ''
    return units.map((unit, index) => {
      const translation = cleanText(unit.translation)
      if (!translation) return ''
      if (index === units.length - 1) return translation
      return `${translation}${unit.separatorAfter || ' '}`
    }).join('')
  }

  function defaultUnits(object) {
    const sourceText = cleanText(object?.sourceText)
    if (!sourceText.trim()) return []
    return [normalizeUnit({
      sourceText,
      translation: cleanText(object?.translation),
      status: object?.translation ? (object.status === 'approved' ? 'approved' : 'edited') : 'new',
    }, object?.id, 0)]
  }

  function ensureTranslationUnits(object) {
    if (!object || typeof object !== 'object') return []
    let units = Array.isArray(object.translationUnits)
      ? object.translationUnits.slice(0, MAX_UNITS).map((unit, index) => normalizeUnit(unit, object.id, index)).filter(unit => unit.sourceText.trim())
      : []
    if (!units.length || canonicalText(sourceFromUnits(units)) !== canonicalText(object.sourceText)) units = defaultUnits(object)
    object.translationUnits = units
    return units
  }

  function partsToUnits(object, parts) {
    const previous = ensureTranslationUnits(object)
    const previousBySource = new Map(previous.map(unit => [canonicalText(unit.sourceText), unit]))
    const units = []
    let pendingWhitespace = ''
    for (const value of parts.slice(0, MAX_UNITS)) {
      const raw = cleanText(value)
      if (!raw) continue
      const leading = raw.match(/^\s*/u)?.[0] || ''
      const trailing = raw.match(/\s*$/u)?.[0] || ''
      let sourceText = raw.slice(leading.length, raw.length - trailing.length)
      if (!sourceText.trim()) {
        pendingWhitespace += raw
        continue
      }
      if (units.length) units[units.length - 1].separatorAfter += pendingWhitespace + leading
      else sourceText = pendingWhitespace + leading + sourceText
      pendingWhitespace = ''
      const old = previousBySource.get(canonicalText(sourceText))
      units.push(normalizeUnit({
        sourceText,
        separatorAfter: trailing,
        translation: old?.translation || '',
        status: old?.status || 'new',
        memorySuggestion: old?.memorySuggestion || null,
        memoryEntryId: old?.memoryEntryId || null,
      }, object.id, units.length))
    }
    if (pendingWhitespace && units.length) units[units.length - 1].separatorAfter += pendingWhitespace
    object.translationUnits = units.length ? units : defaultUnits(object)
    syncObjectTranslation(object)
    return object.translationUnits
  }

  function sentenceParts(text, locale) {
    const value = cleanText(text)
    if (!value.trim()) return []
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      try {
        return [...new Intl.Segmenter(locale && locale !== 'auto' ? locale : undefined, { granularity: 'sentence' }).segment(value)]
          .map(item => item.segment)
          .filter(Boolean)
      } catch {}
    }
    return value.match(/[^.!?…]+(?:[.!?…]+["'»”’\])}]*)?\s*|[^.!?…]+$/gu) || [value]
  }

  function splitBySentences(object, locale) {
    return partsToUnits(object, sentenceParts(object?.sourceText, locale))
  }

  function splitAtRange(object, start, end = start) {
    const text = cleanText(object?.sourceText)
    const from = Math.max(0, Math.min(text.length, Math.trunc(Number(start) || 0)))
    const to = Math.max(from, Math.min(text.length, Math.trunc(Number(end) || from)))
    const bounds = [...new Set([0, from, to > from ? to : text.length, text.length])].sort((left, right) => left - right)
    const parts = []
    for (let index = 0; index < bounds.length - 1; index += 1) {
      const value = text.slice(bounds[index], bounds[index + 1])
      if (value) parts.push(value)
    }
    if (parts.length < 2) return ensureTranslationUnits(object)
    return partsToUnits(object, parts)
  }

  function mergeTranslationUnits(object) {
    object.translationUnits = defaultUnits(object)
    return object.translationUnits
  }

  function syncObjectTranslation(object) {
    const units = ensureTranslationUnits(object)
    object.translation = translationFromUnits(units, true)
    return object.translation
  }

  return {
    canonicalText,
    ensureTranslationUnits,
    mergeTranslationUnits,
    sentenceParts,
    sourceFromUnits,
    splitAtRange,
    splitBySentences,
    syncObjectTranslation,
    translationFromUnits,
  }
})
