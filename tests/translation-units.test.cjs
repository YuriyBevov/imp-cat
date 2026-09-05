const test = require('node:test')
const assert = require('node:assert/strict')

const {
  ensureTranslationUnits,
  splitAtRange,
  splitBySentences,
  syncObjectTranslation,
} = require('../public/translation-units.js')

test('existing segments receive one internal translation unit without changing geometry', () => {
  const object = { id: 'paragraph-1', sourceText: 'Power of attorney', translation: 'Доверенность', x: 10, y: 20, width: 300, height: 40 }
  const before = { x: object.x, y: object.y, width: object.width, height: object.height }
  const units = ensureTranslationUnits(object)
  assert.equal(units.length, 1)
  assert.equal(units[0].sourceText, object.sourceText)
  assert.equal(units[0].translation, object.translation)
  assert.deepEqual({ x: object.x, y: object.y, width: object.width, height: object.height }, before)
})

test('paragraphs can be split into internal sentence units and reassembled after translation', () => {
  const object = { id: 'paragraph-2', sourceText: 'First sentence. Second sentence!', translation: '' }
  const units = splitBySentences(object, 'en')
  assert.equal(units.length, 2)
  units[0].translation = 'Первое предложение.'
  units[1].translation = 'Второе предложение!'
  assert.equal(syncObjectTranslation(object), 'Первое предложение. Второе предложение!')
})

test('a selected source fragment becomes an internal unit, not a new page object', () => {
  const object = { id: 'paragraph-3', sourceText: 'The University of New Hampshire', translation: '' }
  const start = object.sourceText.indexOf('University')
  const end = object.sourceText.indexOf(' Hampshire')
  const units = splitAtRange(object, start, end)
  assert.equal(units.length, 3)
  assert.equal(units[1].sourceText, 'University of New')
  assert.equal(object.id, 'paragraph-3')
})

