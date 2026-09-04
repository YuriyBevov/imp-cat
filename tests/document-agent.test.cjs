const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildCodexArguments,
  buildDocumentPrompt,
  normalizeCodexAnalysis,
} = require('../lib/document-agent.cjs')

function manifest() {
  return {
    pages: [
      { index: 0, width: 2550, height: 3300, image: 'page-001.png' },
      { index: 1, width: 2550, height: 3300, image: 'page-002.png' },
    ],
  }
}

function style(overrides = {}) {
  return {
    fontFamily: 'Times New Roman', fontSizePt: 11, fontWeight: 400,
    fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000',
    ...overrides,
  }
}

test('Codex prompt requires complete text and readable service-object content', () => {
  const prompt = buildDocumentPrompt('document.pdf', manifest())
  assert.match(prompt, /всего видимого читаемого текста/)
  assert.match(prompt, /stamp, seal, signature/)
  assert.match(prompt, /весь уверенно читаемый текст/)
  assert.match(prompt, /page-001\.png/)
  assert.match(prompt, /Не переводи/)
})

test('Codex arguments attach every page and enforce structured output', () => {
  const args = buildCodexArguments({
    model: 'gpt-5.6-sol', workdir: '/workspace',
    imagePaths: ['/job/page-001.png', '/job/page-002.png'],
    schemaPath: '/workspace/schema.json', outputPath: '/job/result.json', prompt: 'Analyze',
  })
  assert.deepEqual(args.slice(0, 9), ['exec', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--model', 'gpt-5.6-sol', '--sandbox', 'read-only', '--color'])
  assert.equal(args.filter(value => value === '--image').length, 2)
  assert.ok(args.includes('--output-schema'))
  assert.ok(args.includes('--output-last-message'))
  assert.equal(args.at(-1), 'Analyze')
})

test('normalizes all pages, regions, styles and duplicate agent IDs', () => {
  const raw = {
    documentTitle: 'Power of attorney', languages: ['tr', 'en'],
    pages: [{
      pageIndex: 1, languages: ['tr'], segments: [{
        segmentId: 'duplicate', type: 'signature', sourceText: '', readingOrder: 1,
        flowGroup: 'page-2-signatures', regions: [{ x: .1, y: .8, width: .2, height: .05 }],
        style: style({ fontStyle: 'italic' }), confidence: .72, needsReview: true, notes: 'Текст неразборчив',
      }],
    }, {
      pageIndex: 0, languages: ['tr'], segments: [{
        segmentId: 'duplicate', type: 'text', sourceText: 'VEKALETNAME', readingOrder: 0,
        flowGroup: 'page-1-header', regions: [{ x: .3, y: .08, width: .4, height: .04 }],
        style: style({ fontWeight: 700, textAlign: 'center' }), confidence: .99, needsReview: false, notes: '',
      }],
    }],
  }
  const normalized = normalizeCodexAnalysis(raw, manifest())
  assert.equal(normalized.pages.length, 2)
  assert.equal(normalized.pages[0].segments[0].sourceText, 'VEKALETNAME')
  assert.equal(normalized.pages[0].segments[0].style.fontWeight, 700)
  assert.equal(normalized.pages[1].segments[0].type, 'signature')
  assert.equal(normalized.pages[1].segments[0].needsReview, true)
  assert.notEqual(normalized.pages[0].segments[0].segmentId, normalized.pages[1].segments[0].segmentId)
})

test('rejects omitted pages, empty text and invalid regions', () => {
  assert.throws(() => normalizeCodexAnalysis({ pages: [] }, manifest()), /вернул 0 стр/)
  const base = {
    pages: manifest().pages.map((page, pageIndex) => ({ pageIndex, languages: [], segments: [] })),
  }
  base.pages[0].segments.push({
    segmentId: 'bad', type: 'text', sourceText: '', readingOrder: 0, flowGroup: 'body',
    regions: [{ x: 0, y: 0, width: 0, height: .1 }], style: style(), confidence: .5, needsReview: true, notes: '',
  })
  assert.throws(() => normalizeCodexAnalysis(base, manifest()), /нет корректных координат/)
})

test('accepts a complete one-based page sequence returned by the model', () => {
  const raw = {
    documentTitle: 'One based', languages: ['en'], pages: manifest().pages.map((page, index) => ({
      pageIndex: index + 1,
      languages: ['en'],
      segments: [{
        segmentId: `segment-${index + 1}`, type: 'text', sourceText: `Page ${index + 1}`,
        readingOrder: 0, flowGroup: `page-${index + 1}-body`,
        regions: [{ x: .1, y: .1, width: .4, height: .05 }], style: style(),
        confidence: .99, needsReview: false, notes: '',
      }],
    })),
  }
  const normalized = normalizeCodexAnalysis(raw, manifest())
  assert.deepEqual(normalized.pages.map(page => page.index), [0, 1])
  assert.deepEqual(normalized.pages.map(page => page.segments[0].sourceText), ['Page 1', 'Page 2'])
})
