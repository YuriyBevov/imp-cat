const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM, VirtualConsole } = require('jsdom')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'public/studio.html'), 'utf8')
const client = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'public/studio.css'), 'utf8')
const server = fs.readFileSync(path.join(root, 'server.cjs'), 'utf8')

test('studio exposes the complete source-to-export workflow', () => {
  for (const id of [
    'file-input', 'page-thumbnails', 'document-canvas', 'source-preview-scroll', 'source-preview-canvas',
    'source-text', 'translation-text', 'object-type', 'agent-notes', 'analyze-button', 'reanalyze-button', 'translate-button',
    'auto-layout-button', 'qa-button', 'export-docx-button', 'export-pdf-button',
    'memory-search-button', 'approve-button', 'merge-button', 'split-button', 'ocr-review-button',
    'grid-snap', 'grid-size', 'alignment-scope', 'align-left-button',
    'flex-direction', 'flex-container', 'flex-justify', 'flex-align', 'flex-gap', 'flex-apply-button',
    'fit-content-width-button', 'fit-content-height-button', 'fit-content-both-button',
    'view-layout-button', 'view-segments-button', 'source-panel-toggle',
  ]) assert.match(html, new RegExp(`id="${id}"`))
  assert.match(server, /app\.use\('\/api\/studio'/)
  assert.match(server, /studio\.html/)
  assert.match(client, /\/api\/studio\/documents/)
  assert.match(client, /\/translation-memory/)
  assert.match(client, /event\.ctrlKey \|\| event\.metaKey/)
  assert.match(client, /beginMarquee/)
  assert.match(client, /beginDrag/)
  assert.match(client, /moveSelectionToPage/)
  assert.match(client, /function undo/)
  assert.match(client, /function redo/)
  assert.match(client, /queueWheelZoom/)
  assert.match(client, /snapObjectGroups/)
  assert.match(client, /alignSelection/)
  assert.match(client, /alignToDocument/)
  assert.match(client, /applyFlexLayout/)
  assert.match(client, /fitSelectionToContent/)
  assert.match(client, /setDocumentView/)
  assert.match(client, /toggleSourcePanel/)
  assert.match(client, /agent\/reanalyze/)
  assert.doesNotMatch(html, />Flex-раскладка</)
  assert.match(client, /exportDocument\('docx'\)/)
  assert.match(client, /exportDocument\('pdf'\)/)
})

test('studio keeps an independently zoomable source beside editable page objects', () => {
  assert.match(styles, /\.source-preview-panel[\s\S]*border-right/)
  assert.match(styles, /\.source-preview-page img[\s\S]*pointer-events: none/)
  assert.match(styles, /\.scene-object[\s\S]*position: absolute/)
  assert.match(styles, /\.studio-page[\s\S]*overflow: hidden/)
  assert.match(styles, /\.content-boundary/)
  assert.match(styles, /--grid-size/)
  assert.match(styles, /\.studio\.is-source-collapsed/)
  assert.match(styles, /\.studio-page--segments/)
  assert.match(styles, /\.scene-object__content[^}]*overflow:\s*visible/)
  assert.match(client, /function expandClippedObjects/)
})

test('studio client boots on the upload screen without runtime errors', async () => {
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error))
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously',
    url: 'http://127.0.0.1:3100/',
    virtualConsole,
  })
  dom.window.fetch = async () => ({
    ok: true,
    json: async () => ({ translationProviderConfigured: false, translationModel: null }),
  })
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#upload-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, true)
  assert.deepEqual(errors, [])
  dom.window.close()
})

test('segments view follows visual page order from top-left instead of stale readingOrder', async () => {
  const id = '2'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  const makeObject = (idValue, text, x, y, readingOrder) => ({
    id: idValue, pageIndex: 0, type: 'text', readingOrder, sourceText: text, translation: '', confidence: .98,
    x, y, width: 180, height: 32, rotation: 0, excluded: false,
    style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
    sourceTextStyles: [], translationTextStyles: [], ocrAlternatives: [], originalBounds: { x, y, width: 180, height: 32 },
  })
  const scene = {
    title: 'Reading order', sourceLanguage: 'en', targetLanguage: 'ru',
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [
      makeObject('top-right', 'Top right', 430, 43, 1),
      makeObject('second-left', 'Second left', 40, 100, 2),
      makeObject('top-left', 'Top left', 40, 40, 99),
      makeObject('second-right', 'Second right', 430, 104, 3),
    ],
  }
  dom.window.fetch = async url => ({
    ok: true,
    json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false, translationModel: null }
      : { metadata: { id, revision: 1 }, scene },
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  dom.window.document.querySelector('#view-segments-button').click()

  const order = [...dom.window.document.querySelectorAll('.segments-list .scene-object')].map(node => node.dataset.id)
  assert.deepEqual(order, ['top-left', 'top-right', 'second-left', 'second-right'])
  dom.window.close()
})

test('studio restores a saved scene and renders editable page objects', async () => {
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error))
  const id = '1'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: `http://127.0.0.1:3100/?document=${id}`,
    virtualConsole,
  })
  const scene = {
    title: 'Fixture', sourceLanguage: 'en', targetLanguage: 'ru',
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'object-1', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Source', translation: 'Перевод', confidence: .98,
      x: 50, y: 60, width: 200, height: 32, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], ocrAlternatives: [],
      originalBounds: { x: 50, y: 60, width: 200, height: 32 },
    }],
  }
  dom.window.fetch = async url => ({
    ok: true,
    json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false, translationModel: null }
      : { metadata: { id, revision: 1 }, scene },
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.Element.prototype.setPointerCapture = function setPointerCapture(pointerId) { this.__pointerId = pointerId }
  dom.window.Element.prototype.hasPointerCapture = function hasPointerCapture(pointerId) { return this.__pointerId === pointerId }
  dom.window.Element.prototype.releasePointerCapture = function releasePointerCapture(pointerId) {
    if (this.__pointerId === pointerId) this.__pointerId = null
  }
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)
  assert.equal(dom.window.document.querySelectorAll('.studio-page').length, 1)
  assert.equal(dom.window.document.querySelector('.scene-object__content').textContent, 'Перевод')
  assert.equal(dom.window.document.querySelector('.studio-page').style.getPropertyValue('--grid-size'), '8px')

  dom.window.document.querySelector('#source-panel-toggle').click()
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-source-collapsed'), true)
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').textContent, 'Показать оригинал')
  dom.window.document.querySelector('#source-panel-toggle').click()
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-source-collapsed'), false)

  dom.window.document.querySelector('#view-segments-button').click()
  assert.equal(dom.window.document.querySelector('#document-canvas').classList.contains('is-segments-view'), true)
  assert.equal(dom.window.document.querySelectorAll('.studio-page--segments .scene-object').length, 1)
  assert.match(dom.window.document.querySelector('.segments-page-heading').textContent, /Страница 1/)
  dom.window.document.querySelector('#view-layout-button').click()
  assert.equal(dom.window.document.querySelector('#document-canvas').classList.contains('is-segments-view'), false)

  const resizeHandle = dom.window.document.querySelector('.scene-object__resize')
  const pointer = (type, x, y) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
    Object.defineProperty(event, 'pointerId', { value: 7 })
    return event
  }
  resizeHandle.dispatchEvent(pointer('pointerdown', 0, 0))
  resizeHandle.dispatchEvent(pointer('pointermove', 20, 10))
  resizeHandle.dispatchEvent(pointer('pointerup', 20, 10))
  assert.equal(resizeHandle.style.width, '')
  const zoom = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10) / 100
  const firstWidth = Math.round((200 + 20 / zoom) / 8) * 8
  assert.equal(dom.window.document.querySelector('.scene-object').style.width, `${firstWidth}px`)
  resizeHandle.dispatchEvent(pointer('pointerdown', 20, 10))
  resizeHandle.dispatchEvent(pointer('pointermove', 30, 20))
  resizeHandle.dispatchEvent(pointer('pointerup', 30, 20))
  const secondWidth = Math.round((firstWidth + 10 / zoom) / 8) * 8
  assert.equal(dom.window.document.querySelector('.scene-object').style.width, `${secondWidth}px`)

  const content = dom.window.document.querySelector('.scene-object__content')
  content.dispatchEvent(pointer('pointerdown', 0, 0))
  content.focus()
  const range = dom.window.document.createRange()
  range.setStart(content.firstChild, 0)
  range.setEnd(content.firstChild, 3)
  dom.window.getSelection().removeAllRanges()
  dom.window.getSelection().addRange(range)
  content.dispatchEvent(pointer('pointerup', 0, 0))
  const fontSize = dom.window.document.querySelector('#toolbar-font-size')
  fontSize.value = '20'
  fontSize.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(dom.window.document.querySelector('.scene-object__content span').style.fontSize, '20px')

  const styledContent = dom.window.document.querySelector('.scene-object__content')
  const styledText = styledContent.querySelector('span').firstChild
  const splitRange = dom.window.document.createRange()
  splitRange.setStart(styledText, 0)
  splitRange.setEnd(styledText, 2)
  dom.window.getSelection().removeAllRanges()
  dom.window.getSelection().addRange(splitRange)
  styledContent.dispatchEvent(pointer('pointerup', 0, 0))
  dom.window.document.querySelector('#split-button').click()
  assert.equal(dom.window.document.querySelectorAll('.scene-object').length, 2)

  const firstObject = dom.window.document.querySelector('[data-id="object-1"]')
  firstObject.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: true }))
  dom.window.document.querySelector('#align-left-button').click()
  const alignedLefts = [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.left)
  assert.equal(new Set(alignedLefts).size, 1)

  dom.window.document.querySelector('#flex-direction').value = 'row'
  dom.window.document.querySelector('#flex-container').value = 'content'
  dom.window.document.querySelector('#flex-justify').value = 'space-between'
  dom.window.document.querySelector('#flex-align').value = 'center'
  dom.window.document.querySelector('#flex-apply-button').click()
  const flexObjects = [...dom.window.document.querySelectorAll('.scene-object')]
  const flexLefts = flexObjects.map(node => Number.parseFloat(node.style.left)).sort((left, right) => left - right)
  assert.equal(flexLefts[0], 40)
  assert.equal(Math.max(...flexObjects.map(node => Number.parseFloat(node.style.left) + Number.parseFloat(node.style.width))), 754)
  assert.equal(new Set(flexObjects.map(node => Number.parseFloat(node.style.top) + Number.parseFloat(node.style.height) / 2)).size, 1)

  const translationInput = dom.window.document.querySelector('#translation-text')
  translationInput.value = '/Подпись/'
  translationInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  dom.window.document.querySelector('#fit-content-both-button').click()
  const fittedObjects = [...dom.window.document.querySelectorAll('.scene-object')]
  assert.equal(new Set(fittedObjects.map(node => node.style.width)).size, 1)
  assert.equal(new Set(fittedObjects.map(node => node.style.height)).size, 1)
  assert.ok(Number.parseFloat(fittedObjects[0].style.width) < secondWidth)

  const gridSize = dom.window.document.querySelector('#grid-size')
  gridSize.value = '16'
  gridSize.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(dom.window.document.querySelector('.studio-page').style.getPropertyValue('--grid-size'), '16px')

  const zoomBeforeWheel = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10)
  dom.window.document.querySelector('#canvas-scroll').dispatchEvent(new dom.window.WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -5, clientX: 100, clientY: 100,
  }))
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  const zoomAfterWheel = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10)
  assert.ok(zoomAfterWheel >= zoomBeforeWheel, `${zoomBeforeWheel} -> ${zoomAfterWheel}`)
  assert.ok(zoomAfterWheel - zoomBeforeWheel <= 2)
  assert.deepEqual(errors, [])
  dom.window.close()
})
