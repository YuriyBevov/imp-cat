const test = require('node:test')
const assert = require('node:assert/strict')
const { assertPrivacyTokens } = require('../lib/privacy-tokens.cjs')

test('privacy tokens survive translation verbatim, including repeated occurrences', () => {
  const token = 'ICATPII_AABBCCDD_PERSON_0001'
  assert.doesNotThrow(() => assertPrivacyTokens(`Name: ${token}; owner: ${token}`, `Имя: ${token}; владелец: ${token}`))
  assert.throws(() => assertPrivacyTokens(`${token} ${token}`, token), /обозначения/)
  assert.throws(() => assertPrivacyTokens(token, token.toLowerCase()), /обозначения/)
  assert.throws(() => assertPrivacyTokens('Name', token), /обозначения/)
})
