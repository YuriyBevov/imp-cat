const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM, VirtualConsole } = require('jsdom')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'public/studio.html'), 'utf8')
const client = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8')
const translationUnits = fs.readFileSync(path.join(root, 'public/translation-units.js'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'public/studio.css'), 'utf8')
const server = fs.readFileSync(path.join(root, 'server.cjs'), 'utf8')

test('studio exposes the complete source-to-export workflow', () => {
  for (const id of [
    'file-input', 'page-thumbnails', 'document-canvas', 'source-preview-scroll', 'source-preview-canvas',
    'source-text', 'translation-text', 'object-type', 'agent-notes', 'analyze-button', 'reanalyze-button', 'translate-button',
    'translation-select-all', 'translation-selection-count',
    'auto-layout-button', 'qa-button', 'export-docx-button', 'export-pdf-button',
    'memory-search-button', 'approve-button', 'merge-button', 'split-button',
    'translation-units-card', 'translation-units-list', 'translation-units-split-sentences',
    'translation-units-split-selection', 'translation-units-merge', 'translation-units-apply-exact',
    'grid-snap', 'grid-size', 'alignment-scope', 'align-left-button',
    'flex-direction', 'flex-container', 'flex-justify', 'flex-align', 'flex-gap', 'flex-apply-button',
    'fit-content-width-button', 'fit-content-height-button', 'fit-content-both-button',
    'view-layout-button', 'view-segments-button', 'source-panel-toggle',
    'document-tabs', 'add-document-tab', 'document-library-button', 'document-library-modal', 'document-library-list',
    'ai-settings-button', 'ai-provider-select', 'aitunnel-api-key', 'retry-job-button',
    'aitunnel-model', 'aitunnel-persist-key', 'test-ai-connection',
  ]) assert.match(html, new RegExp(`id="${id}"`))
  assert.match(server, /app\.use\('\/api\/studio'/)
  assert.match(server, /studio\.html/)
  assert.match(client, /\/api\/studio\/documents/)
  assert.match(client, /\/knowledge-base\/search/)
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
  assert.match(client, /\/api\/studio\/jobs/)
  assert.match(client, /encryptApiKey/)
  assert.match(client, /\/api\/studio\/provider\/models/)
  assert.match(client, /\/api\/studio\/provider\/test/)
  assert.match(client, /\/api\/studio\/documents\?scope=all/)
  assert.match(client, /setDocumentArchived/)
  assert.match(client, /deleteLibraryDocument/)
  assert.match(client, /segment-translation-row/)
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
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#upload-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, true)
  assert.deepEqual(errors, [])
  dom.window.close()
})

test('AI settings load the live AITunnel catalog and disable text-only models', async () => {
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async url => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (String(url).endsWith('/provider/models')) return { ok: true, json: async () => ({ models: [
      { id: 'vision-a', provider: 'test', description: 'Vision', documentCapable: true },
      { id: 'text-a', provider: 'test', description: 'Text', documentCapable: false },
    ] }) }
    if (String(url).endsWith('/provider')) return { ok: true, json: async () => ({
      activeProvider: 'aitunnel', model: 'vision-a', keySource: 'session', aitunnelConfigured: true,
      aitunnelVerified: false, codexConfigured: true, apiHost: 'api.aitunnel.ru', publicKey: '',
    }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  dom.window.document.querySelector('#ai-settings-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  const options = [...dom.window.document.querySelector('#aitunnel-model').options]
  assert.equal(options.find(option => option.value === 'vision-a').disabled, false)
  assert.equal(options.find(option => option.value === 'text-a').disabled, true)
  assert.equal(dom.window.document.querySelector('#aitunnel-model').value, 'vision-a')
  assert.match(dom.window.document.querySelector('#aitunnel-model-note').textContent, /Доступно 1/)
  dom.window.close()
})

test('failed document jobs stop polling and show a terminal error state', async () => {
  const jobId = '3'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?job=${jobId}`,
  })
  let jobRequests = 0
  dom.window.fetch = async url => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (String(url).endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    if (String(url).endsWith(`/jobs/${jobId}`)) {
      jobRequests += 1
      return { ok: true, json: async () => ({ job: {
        id: jobId, title: 'failed.pdf', status: 'failed', stage: 'failed', progress: 30,
        error: 'AITunnel вернул некорректный JSON анализа',
      } }) }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.equal(jobRequests, 1)
  assert.equal(dom.window.document.querySelector('#loading-view').classList.contains('is-failed'), true)
  assert.equal(dom.window.document.querySelector('#loading-title').textContent, 'Обработка остановлена')
  assert.equal(dom.window.document.querySelector('#loading-progress-label').textContent, 'Ошибка')
  assert.equal(dom.window.document.querySelector('#retry-job-button').hidden, false)
  dom.window.close()
})

test('failed document job can be restarted from the error screen', async () => {
  const failedJobId = '7'.repeat(32)
  const retryJobId = '8'.repeat(32)
  const documentId = '9'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?job=${failedJobId}`,
  })
  let retryRequests = 0
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    if (value.endsWith(`/jobs/${failedJobId}`)) return { ok: true, json: async () => ({ job: {
      id: failedJobId, documentId, title: 'failed.pdf', status: 'failed', stage: 'failed', progress: 30, error: 'Ошибка анализа',
    } }) }
    if (value.endsWith(`/jobs/${failedJobId}/retry`) && options.method === 'POST') {
      retryRequests += 1
      return { ok: true, json: async () => ({ job: {
        id: retryJobId, documentId, title: 'failed.pdf', status: 'queued', stage: 'queued', progress: 0, message: 'Ожидает обработки',
      } }) }
    }
    if (value.endsWith(`/jobs/${retryJobId}`)) return { ok: true, json: async () => ({ job: {
      id: retryJobId, documentId, title: 'failed.pdf', status: 'running', stage: 'rendering', progress: 10, message: 'Подготавливаем страницы документа',
    } }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  dom.window.document.querySelector('#retry-job-button').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(retryRequests, 1)
  assert.equal(dom.window.document.querySelector('#retry-job-button').hidden, true)
  assert.match(dom.window.location.search, new RegExp(retryJobId))
  dom.window.close()
})

test('completed document history is restored from local server storage after reload', async () => {
  const id = '4'.repeat(32)
  const scene = {
    title: 'Saved project', sourceLanguage: 'en', targetLanguage: 'ru', objects: [],
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async url => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (String(url).endsWith('/documents')) return { ok: true, json: async () => ({ documents: [{ id, title: 'Saved project', filename: 'saved.pdf', updatedAt: '2026-09-05T00:00:00Z' }] }) }
    if (String(url).endsWith(`/documents/${id}`)) return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(dom.window.document.querySelectorAll('.document-tab').length, 1)
  assert.match(dom.window.document.querySelector('.document-tab__title').textContent, /Saved project/)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#document-title').textContent, 'Saved project')
  dom.window.close()
})

test('document library shows active and archived projects with lifecycle actions', async () => {
  const activeId = '5'.repeat(32)
  const archivedId = '6'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async url => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (value.includes('/documents?scope=all')) return { ok: true, json: async () => ({ documents: [
      { id: activeId, title: 'Active', pageCount: 3, objectCount: 10, updatedAt: '2026-09-05T00:00:00Z', archivedAt: null },
      { id: archivedId, title: 'Archived', pageCount: 2, objectCount: 4, updatedAt: '2026-09-04T00:00:00Z', archivedAt: '2026-09-05T00:00:00Z' },
    ] }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 20))
  dom.window.document.querySelector('#document-library-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))

  const rows = [...dom.window.document.querySelectorAll('.document-library-row')]
  assert.equal(rows.length, 2)
  assert.equal(rows[0].querySelector('.document-library-row__status').textContent, 'В работе')
  assert.equal(rows[1].classList.contains('is-archived'), true)
  assert.equal(rows[1].querySelector('.document-library-row__status').textContent, 'Архив')
  assert.match(rows[1].textContent, /Восстановить/)
  assert.match(rows[0].textContent, /В архив/)
  assert.match(rows[0].textContent, /Удалить/)
  dom.window.close()
})

test('multiple dropped files create independent asynchronous document tabs', async () => {
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  let created = 0
  dom.window.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/status')) return {
      ok: true,
      json: async () => ({ codexAvailable: true, codexAuthenticated: true, documentAnalysisMode: 'codex', translationProviderConfigured: false }),
    }
    if (String(url).endsWith('/jobs') && options.method === 'POST') {
      created += 1
      const id = String(created).repeat(32)
      return {
        ok: true,
        json: async () => ({ job: { id, documentId: String(created + 4).repeat(32), title: `file-${created}.png`, status: 'queued', progress: 0, message: 'Ожидает обработки' } }),
      }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  const files = [
    new dom.window.File(['first'], 'first.png', { type: 'image/png' }),
    new dom.window.File(['second'], 'second.png', { type: 'image/png' }),
  ]
  const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: { files } })
  dom.window.document.querySelector('#upload-zone').dispatchEvent(drop)
  await new Promise(resolve => setTimeout(resolve, 30))

  assert.equal(created, 2)
  assert.equal(dom.window.document.querySelectorAll('.document-tab').length, 2)
  assert.equal(dom.window.document.querySelector('#document-tabs').hidden, false)
  assert.equal(dom.window.document.body.classList.contains('has-document-tabs'), true)
  assert.equal(dom.window.document.querySelector('#loading-view').hidden, false)
  dom.window.close()
})

test('segments view follows visual order and supports partial or full batch translation selection', async () => {
  const id = '2'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  const makeObject = (idValue, text, x, y, readingOrder) => ({
    id: idValue, pageIndex: 0, type: 'text', readingOrder, sourceText: text, translation: '', confidence: .98,
    x, y, width: 180, height: 32, rotation: 0, excluded: false,
    style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
    sourceTextStyles: [], translationTextStyles: [], originalBounds: { x, y, width: 180, height: 32 },
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
  const translationRequests = []
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (value.endsWith(`/documents/${id}/scene`) && options.method === 'PUT') {
      return { ok: true, json: async () => ({ metadata: { id, revision: 2 } }) }
    }
    if (value.endsWith(`/documents/${id}/translate`) && options.method === 'POST') {
      translationRequests.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ scene, translated: [], suggested: [], pending: [], message: 'Пакет обработан' }) }
    }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  dom.window.document.querySelector('#view-segments-button').click()

  const order = [...dom.window.document.querySelectorAll('.segments-list .scene-object--source')].map(node => node.dataset.id)
  assert.deepEqual(order, ['top-left', 'top-right', 'second-left', 'second-right'])
  assert.equal(dom.window.document.querySelectorAll('.segments-list .segment-translation-row').length, 4)
  const checkboxes = [...dom.window.document.querySelectorAll('[data-translation-select]')]
  const selectAll = dom.window.document.querySelector('#translation-select-all')
  const translate = dom.window.document.querySelector('#translate-button')
  assert.equal(checkboxes.length, 4)
  assert.equal(translate.disabled, true)
  assert.equal(dom.window.document.querySelector('#translation-selection-count').textContent, 'Выбрано: 0 из 4')

  checkboxes[0].checked = true
  checkboxes[0].dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(translate.disabled, false)
  assert.equal(translate.textContent, 'Перевести выбранные (1)')
  assert.equal(selectAll.indeterminate, true)

  selectAll.checked = true
  selectAll.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(checkboxes.every(checkbox => checkbox.checked), true)
  assert.equal(translate.textContent, 'Перевести весь документ (4)')
  translate.click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, 1)
  assert.deepEqual(new Set(translationRequests[0].objectIds), new Set(['top-left', 'top-right', 'second-left', 'second-right']))

  const refreshedCheckboxes = [...dom.window.document.querySelectorAll('[data-translation-select]')]
  refreshedCheckboxes[0].checked = false
  refreshedCheckboxes[0].dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  dom.window.document.querySelector('#translate-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, 2)
  assert.equal(translationRequests[1].objectIds.length, 3)
  assert.equal(translationRequests[1].objectIds.includes(refreshedCheckboxes[0].dataset.translationSelect), false)
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
      sourceTextStyles: [], translationTextStyles: [],
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
  dom.window.eval(translationUnits)
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
  assert.equal(dom.window.document.querySelectorAll('.studio-page--segments .scene-object').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object--source .scene-object__content').textContent, 'Source')
  assert.equal(dom.window.document.querySelector('.scene-object--translation .scene-object__content').textContent, 'Перевод')
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

test('internal sentence splitting keeps one positioned page object', async () => {
  const id = 'c'.repeat(32)
  const scene = {
    title: 'Internal units', sourceLanguage: 'en', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'paragraph', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'First sentence. Second sentence!', translation: '', confidence: .99,
      x: 40, y: 80, width: 500, height: 50, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 80, width: 500, height: 50 },
    }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async url => ({
    ok: true,
    json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false, translationModel: null }
      : { metadata: { id, revision: 1 }, scene },
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  const object = dom.window.document.querySelector('.scene-object')
  object.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  dom.window.document.querySelector('#translation-units-split-sentences').click()
  assert.equal(dom.window.document.querySelectorAll('.studio-page .scene-object').length, 1)
  assert.equal(dom.window.document.querySelectorAll('.translation-unit').length, 2)
  assert.equal(dom.window.document.querySelector('#translation-text').disabled, true)
  dom.window.close()
})
