const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM, VirtualConsole } = require('jsdom')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

test('local privacy review survives reload, compares original and blocks dirty approval', async () => {
  const id = 'a'.repeat(32), generation = 'b'.repeat(32), jobId = 'c'.repeat(32)
  const errors = [], calls = []
  const console = new VirtualConsole()
  console.on('jsdomError', error => errors.push(error.message))
  const dom = new JSDOM(read('public/studio.html'), { runScripts: 'outside-only', pretendToBeVisual: true,
    url: `http://127.0.0.1:3101/?prepare=${id}`, virtualConsole: console })
  const { window } = dom
  const doc = window.document
  window.CSS = { escape: String }
  const preparation = { documentId: id, title: 'Synthetic', filename: 'synthetic.pdf', status: 'awaiting-analysis',
    rotations: [0], pages: [{ index: 0, width: 800, height: 1000, rotation: 0, imageUrl: '/original.png' }] }
  let review = { phase: 'review', generation, documentId: id, language: 'en', hasDocument: false,
    settings: { language: 'en', knownValues: ['Alice Example'], allowValues: [], regions: [] },
    entities: [{ token: 'ICATPII_1234ABCD_PERSON_0001', original: 'Alice Example', replacement: 'Alice Example' }],
    pages: [{ index: 0, width: 800, height: 1000, imageUrl: '/clean.png', originalImageUrl: '/original.png', masks: [{ labelRendered: true }] }] }
  window.fetch = async (url, options = {}) => {
    url = String(url)
    calls.push({ url, ...options })
    let value = {}
    if (url.endsWith('/status')) value = { documentPrivacyRequired: true, localAnalyzerAvailable: true }
    else if (url.endsWith('/preparations')) value = { preparations: [preparation] }
    else if (url.endsWith('/documents')) value = { documents: [] }
    else if (url.endsWith('/jobs')) value = { jobs: [] }
    else if (url.endsWith('/translation-instructions')) value = { presets: [] }
    else if (url.endsWith('/preparation')) value = preparation
    else if (url.endsWith('/privacy')) value = review
    else if (url.endsWith('/privacy/prepare')) {
      const settings = JSON.parse(options.body)
      review = { ...review, settings }
      value = { job: { id: jobId, documentId: id, kind: 'document-privacy', status: 'queued' } }
    } else if (url.endsWith('/jobs/' + jobId)) value = { job: { id: jobId, documentId: id, kind: 'document-privacy', status: 'completed', progress: 100 } }
    return { ok: true, status: 200, json: async () => value }
  }
  for (const file of ['translation-units.js', 'layout-model.js', 'table-model.js', 'privacy-view.js', 'studio.js']) window.eval(read('public/' + file))
  const wait = async predicate => {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 15)) }
    assert.fail(doc.querySelector('#toast').textContent || 'Privacy UI did not settle')
  }
  try {
    await wait(() => !doc.querySelector('#privacy-view').hidden && doc.querySelector('.privacy-page'))
    assert.equal(doc.querySelector('#privacy-known-values').value, 'Alice Example')
    const approve = doc.querySelector('#privacy-approve'), checked = doc.querySelector('#privacy-pages-reviewed')
    assert.equal(approve.disabled, true)
    const originalToggle = doc.querySelector('.privacy-page__header input')
    originalToggle.click()
    assert.equal(doc.querySelector('.privacy-page img').getAttribute('src'), '/original.png')
    originalToggle.click()
    assert.equal(doc.querySelector('.privacy-page img').getAttribute('src'), '/clean.png')
    checked.click()
    assert.equal(approve.disabled, false)
    const known = doc.querySelector('#privacy-known-values')
    known.value += '\nlocal_secret_value'
    known.dispatchEvent(new window.Event('input', { bubbles: true }))
    assert.equal(approve.disabled, true)
    checked.click()
    assert.equal(approve.disabled, true)
    doc.querySelector('#privacy-refresh').click()
    await wait(() => calls.some(call => call.url.endsWith('/jobs/' + jobId)) && !doc.querySelector('#privacy-view').hidden)
    const sent = JSON.parse(calls.find(call => call.url.endsWith('/privacy/prepare')).body)
    assert.deepEqual(sent.knownValues, ['Alice Example', 'local_secret_value'])
    assert.deepEqual(sent.rotations, [0])
    assert.equal(checked.checked, false)
    assert.equal(approve.disabled, true)
    assert.equal(calls.some(call => call.url.endsWith('/analysis-jobs')), false)
    assert.deepEqual(errors, [])
  } finally { window.close() }
})

test('privacy documentation and component catalog describe the integrated controls', () => {
  for (const text of ['Защита данных', 'Восстановить скрытые значения локально', 'Проверьте новые данные для ИИ']) assert.ok(read('USER_GUIDE.md').includes(text))
  assert.ok(read('TECHNICAL_SPECIFICATION.md').includes('lib/privacy-outbound.cjs'))
  assert.ok(read('public/ui-components.html').includes('component-privacy-page'))
  assert.ok(read('public/ui-components.js').includes('IcatPrivacyView.renderPage'))
})
