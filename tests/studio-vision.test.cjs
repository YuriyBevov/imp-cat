const test = require('node:test')
const assert = require('node:assert/strict')
const { applyVisionAugmentation, parseJsonArray } = require('../lib/studio.cjs')

function fixture() {
  return {
    pages: [{
      index: 0, width: 1000, height: 1400,
      lines: [{ text: 'Univeristy', confidence: 0.64, alternatives: [], x: 100, y: 120, width: 220, height: 32 }],
    }],
  }
}

test('vision augmentation corrects an exact OCR line and retains the old candidate', () => {
  const analysis = fixture()
  const result = applyVisionAugmentation(analysis, 0, [{
    action: 'replace', lineIndex: 0, originalText: 'Univeristy', text: 'University', confidence: 0.97,
  }])
  assert.deepEqual(result, { added: 0, corrected: 1, removed: 0, rejected: 0 })
  assert.equal(analysis.pages[0].lines[0].text, 'University')
  assert.deepEqual(analysis.pages[0].lines[0].alternatives, ['Univeristy'])
})

test('vision augmentation adds only high-confidence bounded missing text', () => {
  const analysis = fixture()
  const result = applyVisionAugmentation(analysis, 0, [{
    action: 'add', text: 'Previously missing', bbox: [.45, .5, .3, .04], type: 'text', confidence: .94,
  }, {
    action: 'add', text: 'No coordinates', confidence: .99,
  }, {
    action: 'add', text: 'Low confidence', bbox: [.1, .2, .2, .04], confidence: .5,
  }])
  assert.deepEqual(result, { added: 1, corrected: 0, removed: 0, rejected: 2 })
  const added = analysis.pages[0].lines.find(line => line.text === 'Previously missing')
  assert.deepEqual([added.x, added.y, added.width, added.height], [450, 700, 300, 56])
  assert.equal(added.source, 'vision-agent-added')
})

test('vision augmentation does not duplicate an existing geometric line', () => {
  const analysis = fixture()
  const result = applyVisionAugmentation(analysis, 0, [{
    action: 'add', text: 'University', bbox: [.1, 120 / 1400, .22, 32 / 1400], confidence: .98,
  }])
  assert.deepEqual(result, { added: 0, corrected: 0, removed: 0, rejected: 1 })
  assert.equal(analysis.pages[0].lines.length, 1)
  assert.deepEqual(analysis.pages[0].lines[0].alternatives, ['University'])
})

test('provider JSON wrapper is accepted for compatible structured outputs', () => {
  assert.deepEqual(parseJsonArray('{"suggestions":[{"action":"add","text":"Missing"}]}'), [{ action: 'add', text: 'Missing' }])
})

test('vision augmentation can resize a corrected line and suppress an exact artifact', () => {
  const analysis = fixture()
  analysis.pages[0].lines.push({ text: 'HL', confidence: .4, alternatives: [], x: 700, y: 900, width: 20, height: 16 })
  const result = applyVisionAugmentation(analysis, 0, [{
    action: 'replace', lineIndex: 0, originalText: 'Univeristy', text: 'University of New Hampshire',
    bbox: [.08, .07, .7, .06], confidence: .98,
  }, {
    action: 'remove', lineIndex: 1, originalText: 'HL', confidence: .97,
  }])

  assert.deepEqual(result, { added: 0, corrected: 1, removed: 1, rejected: 0 })
  assert.equal(analysis.pages[0].lines.length, 1)
  assert.equal(analysis.pages[0].lines[0].text, 'University of New Hampshire')
  assert.deepEqual(
    [analysis.pages[0].lines[0].x, analysis.pages[0].lines[0].y, analysis.pages[0].lines[0].width, analysis.pages[0].lines[0].height].map(Math.round),
    [80, 98, 700, 84],
  )
  assert.equal(analysis.pages[0].visionDiscardedLines[0].text, 'HL')
})
