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
  assert.equal(candidates.filter(candidate => candidate.kind === 'shape-text').length, 1)
  assert.equal(candidates.filter(candidate => candidate.kind === 'paragraph').length, 1)
})

test('keeps every floating Word text fragment as an independent positioned candidate', () => {
  const dom = new JSDOM(`
    <section id="page"><article><p>
      <svg id="stamp"><foreignObject>
        <p id="stamp-number"><strong>/Штамп: № 18871/</strong></p>
        <p id="stamp-date"><em>/Штамп: 25 августа 2023 года/</em></p>
      </foreignObject></svg>
    </p></article></section>
  `)
  const document = dom.window.document
  const candidates = segmentation.collectTextCandidates(document.querySelector('#page'), normalizeText)
    .filter(candidate => candidate.kind === 'shape-text')

  assert.equal(candidates.length, 2)
  assert.deepEqual(candidates.map(candidate => candidate.element.id), ['stamp-number', 'stamp-date'])
  assert.ok(candidates.every(candidate => candidate.shape.id === 'stamp'))
  assert.deepEqual(candidates.map(candidate => candidate.sourceElements[0].id), [
    'stamp-number', 'stamp-date',
  ])
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

test('preserves semantic Word tabs and run-level boldness', () => {
  const dom = new JSDOM(`
    <p id="signature"><span style="font-weight: 400">/Подпись/</span><span
      id="tab" class="docx-tab-stop">&nbsp;</span><strong style="font-weight: 700">/Круговая печать/</strong></p>
  `)
  const document = dom.window.document
  document.querySelector('#tab').getBoundingClientRect = () => rectangle(100, 20, 84, 20)
  const runs = segmentation.collectStyledTextRuns(
    document.querySelector('#signature'),
    element => {
      const weight = dom.window.getComputedStyle(element).fontWeight
      return { fontWeight: weight === 'bold' ? 700 : Number(weight) || 400 }
    },
  )

  assert.equal(runs.map(run => run.text).join(''), '/Подпись/\t/Круговая печать/')
  assert.equal(runs.find(run => run.text === '\t').tabWidthPx, 84)
  assert.equal(runs.at(-1).fontWeight, 700)
})
