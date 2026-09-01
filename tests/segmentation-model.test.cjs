const test = require('node:test')
const assert = require('node:assert/strict')
const { JSDOM } = require('jsdom')
const segmentation = require('../public/segmentation-model.js')

const normalizeText = value => value.replace(/\s+/g, ' ').trim()

function rectangle(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height }
}

test('keeps text outside floating SVG figures in the same Word paragraph', () => {
  const dom = new JSDOM(`
    <section id="page">
      <article>
        <p id="mixed">
          <span id="title">ДОВЕРЕННОСТЬ</span>
          <svg id="stamp"><foreignObject><p>Штамп нотариуса</p></foreignObject></svg>
        </p>
        <p id="body"><span>Обычный абзац</span></p>
      </article>
    </section>
  `)
  const document = dom.window.document
  document.querySelector('#title').getBoundingClientRect = () => rectangle(120, 80, 220, 36)

  const candidates = segmentation.collectTextCandidates(document.querySelector('#page'), normalizeText)
  const mixed = candidates.find(candidate => candidate.kind === 'mixed-paragraph-text')

  assert.ok(mixed)
  assert.equal(mixed.text, 'ДОВЕРЕННОСТЬ')
  assert.equal(mixed.styleElement.id, 'title')
  assert.deepEqual(mixed.rect, rectangle(120, 80, 220, 36))
  assert.deepEqual(mixed.sourceElements.map(element => element.id), ['title'])
  assert.equal(candidates.filter(candidate => candidate.kind === 'shape').length, 1)
  assert.equal(candidates.filter(candidate => candidate.kind === 'paragraph').length, 1)
})

test('combines multiple outside runs but excludes text rendered inside SVG', () => {
  const dom = new JSDOM(`
    <section id="page"><article><p id="mixed">
      <span id="first">Составлять, </span><span id="second">подписывать</span>
      <svg><foreignObject><p>Не включать этот штамп</p></foreignObject></svg>
    </p></article></section>
  `)
  const document = dom.window.document
  document.querySelector('#first').getBoundingClientRect = () => rectangle(10, 20, 100, 20)
  document.querySelector('#second').getBoundingClientRect = () => rectangle(110, 20, 90, 20)

  const [mixed] = segmentation.collectTextCandidates(document.querySelector('#page'), normalizeText)
    .filter(candidate => candidate.kind === 'mixed-paragraph-text')

  assert.equal(mixed.text, 'Составлять, подписывать')
  assert.deepEqual(mixed.rect, rectangle(10, 20, 190, 20))
  assert.deepEqual(mixed.sourceElements.map(element => element.id), ['first', 'second'])
})
