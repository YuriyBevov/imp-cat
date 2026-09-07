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
const userGuide = fs.readFileSync(path.join(root, 'USER_GUIDE.md'), 'utf8')
const technicalSpecification = fs.readFileSync(path.join(root, 'TECHNICAL_SPECIFICATION.md'), 'utf8')
const docsHtml = fs.readFileSync(path.join(root, 'public/docs.html'), 'utf8')
const docsClient = fs.readFileSync(path.join(root, 'public/docs.js'), 'utf8')
const agentsGuide = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')

test('studio exposes the complete source-to-export workflow', () => {
  for (const id of [
    'file-input', 'page-thumbnails', 'document-canvas', 'source-preview-scroll', 'source-preview-canvas',
    'source-text', 'translation-text', 'object-type', 'agent-notes', 'analyze-button', 'reanalyze-button', 'translate-button',
    'translation-select-all', 'translation-selection-count', 'translation-global-instruction', 'revise-selected-button', 'revise-document-button',
    'instruction-preset-select', 'instruction-preset-apply', 'instruction-preset-save', 'instruction-preset-delete',
    'instruction-preset-edit', 'instruction-preset-editor', 'instruction-preset-text',
    'instruction-preset-edit-cancel', 'instruction-preset-edit-save',
    'auto-layout-button', 'layout-review-button', 'layout-review-cancel-button', 'layout-review-status', 'qa-button', 'export-docx-button', 'export-pdf-button',
    'memory-search-button', 'glossary-select', 'glossary-add-button', 'knowledge-base-status', 'knowledge-base-open-button', 'knowledge-base-open-context-button',
    'knowledge-base-modal', 'knowledge-base-query', 'knowledge-base-glossary-filter', 'knowledge-base-list',
    'knowledge-base-new-button', 'knowledge-base-entry-form', 'knowledge-base-entry-source', 'knowledge-base-entry-translation',
    'knowledge-base-entry-glossary', 'knowledge-base-previous', 'knowledge-base-next', 'knowledge-base-mode',
    'instruction-library-button', 'instruction-library-modal', 'instruction-library-close', 'instruction-library-query',
    'instruction-library-new', 'instruction-library-list', 'instruction-library-form', 'instruction-library-id',
    'instruction-library-text', 'instruction-library-form-cancel',
    'knowledge-suggestion-popover', 'knowledge-suggestion-list', 'approve-button', 'merge-button', 'split-button',
    'table-cell-fields', 'table-id', 'table-row', 'table-column', 'table-row-span', 'table-column-span',
    'translation-units-card', 'translation-units-list', 'translation-units-split-sentences',
    'translation-units-split-selection', 'translation-units-merge', 'translation-units-apply-exact', 'translation-selection-preview',
    'grid-snap', 'grid-size', 'alignment-scope', 'align-left-button',
    'flex-direction', 'flex-container', 'flex-justify', 'flex-align', 'flex-gap', 'flex-apply-button',
    'fit-content-width-button', 'fit-content-height-button', 'fit-content-both-button',
    'document-font-size', 'apply-document-font-size',
    'view-layout-button', 'view-segments-button', 'source-panel-toggle',
    'document-tabs', 'add-document-tab', 'document-library-button', 'document-library-modal', 'document-library-list',
    'ai-settings-button', 'ai-provider-select', 'aitunnel-api-key', 'retry-job-button', 'cancel-job-button', 'loading-progress-details',
    'aitunnel-model', 'aitunnel-persist-key', 'test-ai-connection',
  ]) assert.match(html, new RegExp(`id="${id}"`))
  assert.match(server, /app\.use\('\/api\/studio'/)
  assert.match(server, /studio\.html/)
  assert.match(client, /\/api\/studio\/documents/)
  assert.match(client, /\/knowledge-base\/search/)
  assert.match(client, /\/knowledge-base\/entries/)
  assert.match(client, /function openKnowledgeBase/)
  assert.match(client, /function saveKnowledgeBaseEntry/)
  assert.match(client, /function deleteKnowledgeBaseEntry/)
  assert.match(client, /function showKnowledgeSuggestion/)
  assert.match(client, /translate\/apply-memory/)
  assert.match(client, /translate\/revise/)
  assert.match(client, /function reviseTranslations/)
  assert.match(client, /function saveInstructionPreset/)
  assert.match(client, /\/api\/studio\/translation-instructions/)
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
  assert.match(client, /agent\/layout-review/)
  assert.match(client, /loadPendingJobs/)
  assert.match(client, /cancelActiveJob/)
  assert.match(client, /rebuildClientTables/)
  assert.match(client, /encryptApiKey/)
  assert.match(client, /\/api\/studio\/provider\/models/)
  assert.match(client, /\/api\/studio\/provider\/test/)
  assert.match(client, /\/api\/studio\/documents\?scope=all/)
  assert.match(client, /setDocumentArchived/)
  assert.match(client, /deleteLibraryDocument/)
  assert.match(client, /segment-translation-row/)
  assert.match(styles, /segment-ai-instruction/)
  assert.doesNotMatch(html, />Flex-раскладка</)
  assert.match(client, /exportDocument\('docx'\)/)
  assert.match(client, /exportDocument\('pdf'\)/)
  assert.match(html, /href="\/documentation"/)
  assert.match(html, /href="\/user-guide"/)
})

test('user guide documents the complete interface and links from README', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  assert.match(readme, /\[USER_GUIDE\.md\]\(USER_GUIDE\.md\)/)
  for (const label of [
    'Документация', 'Руководство', 'Документы', 'База знаний', 'AI-инструкции', 'AI-провайдер', 'Скачать DOCX', 'Скачать PDF',
    'Выбрать документы', 'Отменить обработку', 'Повторить обработку', 'Макет', 'Сегменты',
    'Проверить структуру', 'Повторить анализ исходника', 'Перевести выбранные', 'Исправить наложения',
    'AI: сравнить и исправить макет', 'Финальная проверка', 'Сохранить текущую', 'Редактировать',
    'Сохранить изменения', 'Исправить выбранные', 'Исправить весь документ', 'Добавить пустой сегмент',
    'Разбить по предложениям', 'Вынести выделенное в отдельную часть', 'Применить все 100% совпадения',
    'Применить расстановку', 'Добавить переведённые единицы в БЗ', 'Объединить выбранные',
    'Исключить из сборки', 'Проверить подключение', 'Удалить ключ',
  ]) assert.match(userGuide, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('documentation pages render the maintained Markdown sources from the interface', async () => {
  assert.match(server, /app\.get\('\/documentation'/)
  assert.match(server, /app\.get\('\/user-guide'/)
  assert.match(server, /app\.get\('\/api\/docs\/:slug'/)
  assert.match(server, /TECHNICAL_SPECIFICATION\.md/)
  assert.match(server, /USER_GUIDE\.md/)
  assert.match(server, /Cache-Control', 'no-store'/)
  assert.match(agentsGuide, /Любое изменение пользовательского поведения/)
  assert.match(agentsGuide, /Любое изменение архитектуры/)
  assert.ok(technicalSpecification.length > 1_000)

  const dom = new JSDOM(docsHtml.replace('<script src="/docs.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/user-guide',
  })
  dom.window.fetch = async url => {
    assert.equal(String(url), '/api/docs/user-guide')
    return {
      ok: true,
      json: async () => ({
        title: 'Руководство пользователя',
        description: 'Актуальная справка',
        updatedAt: '2026-09-07T10:00:00.000Z',
        markdown: '# Руководство\n\n## Первый раздел\n\n| Кнопка | Действие |\n| --- | --- |\n| **Документы** | Открыть список |',
      }),
    }
  }
  dom.window.eval(docsClient)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#docs-title').textContent, 'Руководство пользователя')
  assert.equal(dom.window.document.querySelectorAll('#docs-toc a').length, 1)
  assert.equal(dom.window.document.querySelectorAll('#docs-content table').length, 1)
  assert.match(dom.window.document.querySelector('#docs-content').textContent, /Документы/)
  dom.window.close()
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
      { ...makeObject('signature', '', 40, 170, 4), type: 'signature', translation: '/Подпись/' },
    ],
  }
  const translationRequests = []
  const instructionPresetRequests = []
  const instructionPresetPatchRequests = []
  const instructionPreset = { id: 'preset-1', instruction: 'Передавай имена транслитерацией.' }
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (value.endsWith('/translation-instructions') && options.method === 'POST') {
      const request = JSON.parse(options.body)
      instructionPresetRequests.push(request)
      return { ok: true, json: async () => ({ created: true, preset: { id: 'preset-2', instruction: request.instruction } }) }
    }
    if (value.endsWith('/translation-instructions/preset-1') && options.method === 'PATCH') {
      const request = JSON.parse(options.body)
      instructionPresetPatchRequests.push(request)
      return { ok: true, json: async () => ({ preset: { id: 'preset-1', ...request } }) }
    }
    if (value.endsWith('/translation-instructions')) return { ok: true, json: async () => ({ presets: [instructionPreset] }) }
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
  assert.deepEqual(order, ['top-left', 'top-right', 'second-left', 'second-right', 'signature'])
  assert.equal(dom.window.document.querySelectorAll('.segments-list .segment-translation-row').length, 5)
  assert.equal(dom.window.document.querySelectorAll('.segment-ai-instruction textarea').length, 5)
  const globalPresetSelect = dom.window.document.querySelector('#instruction-preset-select')
  globalPresetSelect.value = instructionPreset.id
  globalPresetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  dom.window.document.querySelector('#instruction-preset-apply').click()
  assert.equal(dom.window.document.querySelector('#translation-global-instruction').value, instructionPreset.instruction)
  const segmentInstruction = dom.window.document.querySelector('.segment-ai-instruction')
  const segmentPresetSelect = segmentInstruction.querySelector('[data-instruction-preset-select]')
  segmentPresetSelect.value = instructionPreset.id
  segmentPresetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  segmentInstruction.querySelector('[data-instruction-preset-apply]').click()
  assert.equal(segmentInstruction.querySelector('textarea').value, instructionPreset.instruction)
  dom.window.document.querySelector('#instruction-preset-edit').click()
  assert.equal(dom.window.document.querySelector('#instruction-preset-editor').hidden, false)
  dom.window.document.querySelector('#instruction-preset-text').value = 'Передавай имена по стандарту ISO 9.'
  dom.window.document.querySelector('#instruction-preset-edit-save').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.deepEqual(instructionPresetPatchRequests[0], { instruction: 'Передавай имена по стандарту ISO 9.' })
  assert.equal(dom.window.document.querySelector('#instruction-preset-editor').hidden, true)
  assert.equal(dom.window.document.querySelector('#instruction-preset-select').selectedOptions[0].textContent, 'Передавай имена по стандарту ISO 9.')
  segmentInstruction.querySelector('textarea').value = 'Сохраняй номера без изменений.'
  segmentInstruction.querySelector('textarea').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  ;[...segmentInstruction.querySelectorAll('button')].find(button => button.textContent === 'Сохранить').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(instructionPresetRequests[0].instruction, 'Сохраняй номера без изменений.')
  const checkboxes = [...dom.window.document.querySelectorAll('[data-translation-select]')]
  const selectAll = dom.window.document.querySelector('#translation-select-all')
  const translate = dom.window.document.querySelector('#translate-button')
  assert.equal(checkboxes.length, 5)
  assert.equal(translate.disabled, true)
  assert.equal(dom.window.document.querySelector('#translation-selection-count').textContent, 'Выбрано: 0 из 5')

  checkboxes[0].checked = true
  checkboxes[0].dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(translate.disabled, false)
  assert.equal(translate.textContent, 'Перевести выбранные (1)')
  assert.equal(selectAll.indeterminate, true)

  selectAll.checked = true
  selectAll.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(checkboxes.every(checkbox => checkbox.checked), true)
  assert.equal(translate.textContent, 'Перевести весь документ (5)')
  translate.click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, 1)
  assert.deepEqual(new Set(translationRequests[0].objectIds), new Set(['top-left', 'top-right', 'second-left', 'second-right', 'signature']))

  const refreshedCheckboxes = [...dom.window.document.querySelectorAll('[data-translation-select]')]
  refreshedCheckboxes[0].checked = false
  refreshedCheckboxes[0].dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  dom.window.document.querySelector('#translate-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, 2)
  assert.equal(translationRequests[1].objectIds.length, 4)
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

  const documentFontSize = dom.window.document.querySelector('#document-font-size')
  documentFontSize.value = '17'
  dom.window.document.querySelector('#apply-document-font-size').click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['17px', '17px']
  )
  assert.equal(dom.window.document.querySelector('.scene-object__content [style*="font-size"]'), null)

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

test('a selected term can be translated manually and saved as an exact knowledge-base pair', async () => {
  const id = 'd'.repeat(32)
  const sourceText = 'SÜRELİDİR: Bu vekaletname 25/08/2026 tarihine kadar geçerlidir.'
  const scene = {
    title: 'Term workflow', sourceLanguage: 'tr', targetLanguage: 'ru', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'paragraph', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText, translation: '', confidence: .99,
      x: 40, y: 80, width: 600, height: 50, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 80, width: 600, height: 50 },
    }],
  }
  let knowledgeBaseRequest = null
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (String(url).endsWith('/knowledge-base/entries')) {
      knowledgeBaseRequest = JSON.parse(options.body)
      const entry = knowledgeBaseRequest.entries[0]
      return { ok: true, json: async () => ({ created: 1, results: [{ clientRef: entry.clientRef, status: 'created', entry: { ...entry, id: 'term-entry' } }] }) }
    }
    if (options.method === 'PUT') return { ok: true, json: async () => ({ ok: true }) }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  dom.window.document.querySelector('.scene-object').dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  const sourceInput = dom.window.document.querySelector('#source-text')
  sourceInput.focus()
  sourceInput.setSelectionRange(0, 'SÜRELİDİR'.length)
  sourceInput.dispatchEvent(new dom.window.Event('select', { bubbles: true }))
  assert.equal(dom.window.document.querySelector('#translation-units-split-selection').disabled, false)
  assert.match(dom.window.document.querySelector('#translation-selection-preview strong').textContent, /SÜRELİDİR/)

  dom.window.document.querySelector('#translation-units-split-selection').click()
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  assert.equal(dom.window.document.querySelectorAll('.studio-page .scene-object').length, 1)
  assert.equal(dom.window.document.querySelectorAll('.translation-unit').length, 2)
  const termRow = [...dom.window.document.querySelectorAll('.translation-unit')]
    .find(row => row.querySelector('.translation-unit__source').textContent === 'SÜRELİDİR')
  assert.ok(termRow)
  const translation = termRow.querySelector('textarea')
  translation.value = 'СРОЧНАЯ'
  translation.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  termRow.querySelector('.translation-unit__actions button').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(knowledgeBaseRequest.entries[0].sourceText, 'SÜRELİDİR')
  assert.equal(knowledgeBaseRequest.entries[0].translation, 'СРОЧНАЯ')
  assert.equal(knowledgeBaseRequest.entries[0].sourceLanguage, 'tr')
  assert.equal(knowledgeBaseRequest.entries[0].targetLanguage, 'ru')
  dom.window.close()
})

test('knowledge base manager lists, edits, and deletes stored entries', async () => {
  const glossary = { id: '00000000-0000-4000-8000-000000000001', name: 'Основной глоссарий', sourceLanguage: 'en', targetLanguage: 'ru' }
  const entry = {
    id: 'memory-entry-1', glossaryId: glossary.id, sourceText: 'Power of attorney', translation: 'Доверенность',
    sourceLanguage: 'en', targetLanguage: 'ru', updatedAt: '2026-09-06T08:00:00.000Z',
  }
  const requests = []
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options })
    const pathname = String(url)
    if (pathname.includes('/knowledge-base/status')) return { ok: true, json: async () => ({ mode: 'postgres-pgvector', connected: true, persistent: true, entries: 1 }) }
    if (pathname.includes('/knowledge-base/glossaries')) return { ok: true, json: async () => ({ glossaries: [glossary] }) }
    if (pathname.includes('/knowledge-base/entries') && (options.method || 'GET') === 'GET') {
      return { ok: true, json: async () => ({ entries: [entry], total: 1, limit: 25, offset: 0 }) }
    }
    if (pathname.includes('/knowledge-base/entries/') && options.method === 'PATCH') return { ok: true, json: async () => ({ entry: { ...entry, translation: 'Новая доверенность' } }) }
    if (pathname.includes('/knowledge-base/entries/') && options.method === 'DELETE') return { ok: true, status: 204, json: async () => ({}) }
    if (pathname.includes('/documents?scope=all')) return { ok: true, json: async () => ({ documents: [] }) }
    if (pathname.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (pathname.endsWith('/status')) return { ok: true, json: async () => ({ aiProviderConfigured: true, documentAnalysisMode: 'aitunnel' }) }
    return { ok: true, json: async () => ({}) }
  }
  dom.window.confirm = () => true
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  dom.window.document.querySelector('#knowledge-base-open-button').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelectorAll('.knowledge-base-entry').length, 1)
  dom.window.document.querySelector('.knowledge-base-entry__actions .button').click()
  const translation = dom.window.document.querySelector('#knowledge-base-entry-translation')
  assert.equal(translation.value, 'Доверенность')
  translation.value = 'Новая доверенность'
  dom.window.document.querySelector('#knowledge-base-entry-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise(resolve => setTimeout(resolve, 30))
  const patchRequest = requests.find(request => request.options.method === 'PATCH')
  assert.equal(JSON.parse(patchRequest.options.body).translation, 'Новая доверенность')

  dom.window.document.querySelector('.knowledge-base-entry__actions .button--danger').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.ok(requests.some(request => request.options.method === 'DELETE'))
  dom.window.close()
})

test('AI instruction library lists, searches, creates, edits, and deletes presets', async () => {
  const preset = {
    id: 'preset-1', instruction: 'Передавай имена транслитерацией.',
    createdAt: '2026-09-07T08:00:00.000Z', updatedAt: '2026-09-07T08:00:00.000Z',
  }
  let presets = [preset]
  const requests = []
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    const method = options.method || 'GET'
    requests.push({ value, method, body: options.body ? JSON.parse(options.body) : null })
    if (value.endsWith('/translation-instructions') && method === 'GET') return { ok: true, json: async () => ({ presets }) }
    if (value.endsWith('/translation-instructions') && method === 'POST') {
      const created = { id: 'preset-2', ...JSON.parse(options.body), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      presets = [created, ...presets]
      return { ok: true, json: async () => ({ preset: created, created: true }) }
    }
    if (value.endsWith('/translation-instructions/preset-1') && method === 'PATCH') {
      const updated = { ...preset, ...JSON.parse(options.body), updatedAt: new Date().toISOString() }
      presets = [updated, ...presets.filter(item => item.id !== preset.id)]
      return { ok: true, json: async () => ({ preset: updated }) }
    }
    if (value.includes('/translation-instructions/') && method === 'DELETE') {
      const id = value.split('/').at(-1)
      presets = presets.filter(item => item.id !== id)
      return { ok: true, status: 204, json: async () => ({}) }
    }
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (value.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.confirm = () => true
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  dom.window.document.querySelector('#instruction-library-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(dom.window.document.querySelector('#instruction-library-modal').hidden, false)
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 1)
  dom.window.document.querySelector('.instruction-library-entry__actions .button').click()
  dom.window.document.querySelector('#instruction-library-text').value = 'Передавай имена по стандарту ISO 9.'
  dom.window.document.querySelector('#instruction-library-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.ok(requests.some(request => request.method === 'PATCH' && request.body.instruction === 'Передавай имена по стандарту ISO 9.'))
  assert.match(dom.window.document.querySelector('.instruction-library-entry p').textContent, /стандарту ISO 9/)

  dom.window.document.querySelector('#instruction-library-new').click()
  dom.window.document.querySelector('#instruction-library-text').value = 'Сохраняй номера без изменений.'
  dom.window.document.querySelector('#instruction-library-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 2)

  const query = dom.window.document.querySelector('#instruction-library-query')
  query.value = 'номера'
  query.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 1)
  assert.match(dom.window.document.querySelector('.instruction-library-entry p').textContent, /номера/)
  dom.window.document.querySelector('.instruction-library-entry__actions .button--danger').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 0)
  assert.ok(requests.some(request => request.method === 'DELETE' && request.value.endsWith('/preset-2')))
  dom.window.close()
})

test('segments view highlights knowledge matches and keeps the AI translation as an alternative', async () => {
  const id = 'f'.repeat(32)
  const sourceText = 'SÜRELİDİR: Bu vekaletname geçerlidir.'
  const scene = {
    title: 'Knowledge highlights', sourceLanguage: 'Turkish', targetLanguage: 'ru', knowledgeBaseMode: 'priority', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'memory-object', pageIndex: 0, type: 'text', readingOrder: 1, sourceText,
      translation: 'Имеет срок: доверенность действительна.', confidence: .99,
      x: 40, y: 80, width: 600, height: 50, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 80, width: 600, height: 50 },
      translationUnits: [{
        id: 'memory-unit', sourceText, separatorAfter: '', translation: 'Имеет срок: доверенность действительна.',
        aiTranslation: 'СРОЧНАЯ: доверенность действительна.', activeTranslationSource: 'memory-revised', status: 'memory-applied',
        knowledgeMatches: [{
          id: 'entry-1:0:10:0', entryId: 'entry-1', glossaryId: '00000000-0000-4000-8000-000000000001',
          sourceText: 'SÜRELİDİR', translation: 'Имеет срок', sourceLanguage: 'Turkish', targetLanguage: 'ru',
          start: 0, end: 'SÜRELİDİR'.length, score: 1, matchType: 'exact-fragment', fullSegment: false,
        }],
      }],
    }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async url => {
    const value = String(url)
    if (value.includes('/knowledge-base/status')) return { ok: true, json: async () => ({ mode: 'postgres-pgvector', connected: true, persistent: true, entries: 1 }) }
    if (value.includes('/knowledge-base/glossaries')) return { ok: true, json: async () => ({ glossaries: [{ id: '00000000-0000-4000-8000-000000000001', name: 'Основной глоссарий' }] }) }
    if (value.includes('/documents?scope=all')) return { ok: true, json: async () => ({ documents: [] }) }
    if (value.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: true, translationModel: 'test', documentAnalysisMode: 'aitunnel', aiProviderConfigured: true }) }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 40))
  dom.window.document.querySelector('#view-segments-button').click()
  const highlight = dom.window.document.querySelector('.scene-object--source .knowledge-highlight')
  assert.ok(highlight)
  assert.equal(highlight.textContent, 'SÜRELİDİR')
  highlight.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert.equal(dom.window.document.querySelector('#knowledge-suggestion-popover').hidden, false)
  assert.match(dom.window.document.querySelector('#knowledge-suggestion-list').textContent, /Имеет срок/)
  const alternative = dom.window.document.querySelector('.ai-translation-alternative')
  assert.match(alternative.textContent, /СРОЧНАЯ/)
  alternative.querySelector('button').click()
  assert.equal(dom.window.document.querySelector('.scene-object--translation .scene-object__content').textContent, 'СРОЧНАЯ: доверенность действительна.')
  assert.equal(dom.window.document.querySelector('.ai-translation-alternative'), null)
  dom.window.close()
})
