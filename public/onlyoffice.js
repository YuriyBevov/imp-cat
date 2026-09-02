const elements = {
  serverState: document.querySelector('#server-state'),
  uploadPanel: document.querySelector('#upload-panel'),
  editorPanel: document.querySelector('#editor-panel'),
  input: document.querySelector('#document-input'),
  uploadButton: document.querySelector('#upload-button'),
  uploadError: document.querySelector('#upload-error'),
  documentTitle: document.querySelector('#document-title'),
  documentState: document.querySelector('#document-state'),
  editorWorkspace: document.querySelector('#editor-workspace'),
  replaceButton: document.querySelector('#replace-button'),
  downloadButton: document.querySelector('#download-button'),
  segmentsToggle: document.querySelector('#segments-toggle'),
  segmentPanel: document.querySelector('#segment-panel'),
  segmentCount: document.querySelector('#segment-count'),
  segmentProgress: document.querySelector('#segment-progress'),
  segmentSearch: document.querySelector('#segment-search'),
  segmentSummary: document.querySelector('#segment-summary'),
  segmentList: document.querySelector('#segment-list'),
  segmentsMore: document.querySelector('#segments-more'),
}

let serverInfo = null
let editor = null
let activeDocument = null
let pollTimer = null
let lastSavedAt = null
let segmentIndex = []
let segmentIndexRevision = null
let visibleSegmentLimit = 100
let translations = new Map()

elements.input.addEventListener('change', async () => {
  const [file] = elements.input.files
  if (file) await uploadDocument(file)
})

elements.replaceButton.addEventListener('click', () => {
  destroyEditor()
  clearSegmentPanel()
  window.history.replaceState({}, '', '/onlyoffice.html')
  elements.editorPanel.hidden = true
  elements.uploadPanel.hidden = false
  elements.input.value = ''
  elements.uploadError.hidden = true
})

elements.segmentsToggle.addEventListener('click', () => {
  const hidden = elements.editorWorkspace.classList.toggle('is-segment-panel-hidden')
  elements.segmentsToggle.textContent = hidden ? 'Показать сегменты' : 'Скрыть сегменты'
  elements.segmentsToggle.setAttribute('aria-expanded', String(!hidden))
})

elements.segmentSearch.addEventListener('input', () => {
  visibleSegmentLimit = 100
  renderSegments()
})

elements.segmentsMore.addEventListener('click', () => {
  visibleSegmentLimit += 100
  renderSegments()
})

elements.segmentList.addEventListener('input', (event) => {
  const textarea = event.target.closest?.('textarea[data-segment-id]')
  if (!textarea || !activeDocument) return
  translations.set(textarea.dataset.segmentId, textarea.value)
  saveTranslations(activeDocument.id)
  updateSegmentCardState(textarea.closest('.segment-card'), textarea.value)
  updateSegmentProgress()
})

elements.segmentList.addEventListener('click', async (event) => {
  const button = event.target.closest?.('[data-copy-segment]')
  if (!button) return
  const segment = segmentIndex.find(candidate => candidate.id === button.dataset.copySegment)
  if (!segment) return
  try {
    await navigator.clipboard.writeText(segment.source)
    const previous = button.textContent
    button.textContent = 'Скопировано'
    setTimeout(() => { button.textContent = previous }, 1200)
  } catch {
    button.textContent = 'Не удалось скопировать'
  }
})

initialize()

async function initialize() {
  try {
    const response = await fetch('/api/onlyoffice/status', { cache: 'no-store' })
    serverInfo = await readJson(response)
    if (!serverInfo.available) throw new Error(serverInfo.error || 'Document Server не отвечает')
    elements.serverState.textContent = 'Document Server работает'
    elements.serverState.classList.add('is-ready')
    await loadEditorApi(serverInfo.browserApiUrl)
    const documentId = new URLSearchParams(window.location.search).get('document')
    if (documentId) await restoreDocument(documentId)
  } catch (error) {
    elements.serverState.textContent = 'Document Server недоступен'
    elements.serverState.classList.add('is-error')
    showError(`${error.message}\nЗапустите: npm run onlyoffice:up`)
  }
}

async function uploadDocument(file) {
  if (!serverInfo?.available || !window.DocsAPI) {
    showError('Сначала запустите ONLYOFFICE Document Server: npm run onlyoffice:up')
    return
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    showError('Для этого прототипа нужен файл DOCX.')
    return
  }

  setUploading(true)
  try {
    const response = await fetch('/api/onlyoffice/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    })
    await showDocument(await readJson(response))
  } catch (error) {
    showError(error.message)
  } finally {
    setUploading(false)
  }
}

async function restoreDocument(id) {
  try {
    const response = await fetch(`/api/onlyoffice/documents/${encodeURIComponent(id)}`, { cache: 'no-store' })
    await showDocument(await readJson(response), false)
  } catch (error) {
    window.history.replaceState({}, '', '/onlyoffice.html')
    showError(`Не удалось повторно открыть документ: ${error.message}`)
  }
}

async function showDocument(metadata, updateLocation = true) {
  activeDocument = metadata
  lastSavedAt = metadata.savedAt
  elements.documentTitle.textContent = metadata.filename
  elements.downloadButton.href = metadata.downloadUrl
  elements.uploadPanel.hidden = true
  elements.editorPanel.hidden = false
  if (updateLocation) {
    window.history.replaceState({}, '', `/onlyoffice.html?document=${encodeURIComponent(metadata.id)}`)
  }
  await openEditor(metadata.id)
  await loadSegmentIndex(metadata)
  startPolling()
}

async function openEditor(id) {
  elements.documentState.textContent = 'Открываем документ…'
  const response = await fetch(`/api/onlyoffice/documents/${id}/config`, { cache: 'no-store' })
  const config = await readJson(response)
  destroyEditor(false)
  config.events = {
    onAppReady() {
      elements.documentState.textContent = 'Редактор загружен'
    },
    onDocumentReady() {
      elements.documentState.textContent = 'Документ готов к редактированию'
    },
    onDocumentStateChange(event) {
      elements.documentState.textContent = event.data
        ? 'Есть несохранённые изменения'
        : 'Изменения переданы на сохранение'
    },
    onError(event) {
      elements.documentState.textContent = `Ошибка ONLYOFFICE: ${event.data?.errorCode ?? 'неизвестно'}`
    },
  }
  editor = new window.DocsAPI.DocEditor('onlyoffice-editor', config)
}

function startPolling() {
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!activeDocument) return
    try {
      const response = await fetch(`/api/onlyoffice/documents/${activeDocument.id}`, { cache: 'no-store' })
      const metadata = await readJson(response)
      if (metadata.savedAt && metadata.savedAt !== lastSavedAt) {
        lastSavedAt = metadata.savedAt
        const revisionChanged = metadata.revision !== activeDocument.revision
        activeDocument = metadata
        elements.documentState.textContent = `DOCX сохранён в ICAT: ${new Date(metadata.savedAt).toLocaleTimeString('ru-RU')}`
        elements.downloadButton.href = `${metadata.downloadUrl}?revision=${metadata.revision}`
        if (revisionChanged) await loadSegmentIndex(metadata)
      }
    } catch {
      // A temporary polling failure should not interrupt the editor session.
    }
  }, 2500)
}

async function loadSegmentIndex(metadata) {
  segmentIndex = []
  segmentIndexRevision = null
  visibleSegmentLimit = 100
  translations = loadTranslations(metadata.id)
  elements.segmentCount.textContent = '…'
  elements.segmentProgress.textContent = '0 / 0'
  elements.segmentSummary.textContent = 'Извлекаем текст из структуры DOCX…'
  elements.segmentList.replaceChildren(createEmptyMessage('Анализируем абзацы, таблицы, колонтитулы и текстовые поля.'))
  elements.segmentsMore.hidden = true

  try {
    const response = await fetch(metadata.segmentsUrl || `/api/onlyoffice/documents/${metadata.id}/segments`, {
      cache: 'no-store',
    })
    const payload = await readJson(response)
    segmentIndex = Array.isArray(payload.segments) ? payload.segments : []
    segmentIndexRevision = payload.documentRevision
    renderSegments()
  } catch (error) {
    elements.segmentCount.textContent = '0'
    elements.segmentSummary.textContent = 'Сегментация недоступна'
    elements.segmentList.replaceChildren(createEmptyMessage(error.message))
  }
}

function renderSegments() {
  const query = elements.segmentSearch.value.trim().toLocaleLowerCase('ru-RU')
  const filtered = query
    ? segmentIndex.filter(segment => (
      segment.source.toLocaleLowerCase('ru-RU').includes(query)
      || segment.id.toLocaleLowerCase('ru-RU').includes(query)
    ))
    : segmentIndex
  const visible = filtered.slice(0, visibleSegmentLimit)
  const fragment = document.createDocumentFragment()
  for (const segment of visible) fragment.append(createSegmentCard(segment))
  if (!visible.length) {
    fragment.append(createEmptyMessage(query ? 'По этому запросу сегментов нет.' : 'В документе не найден текст для перевода.'))
  }
  elements.segmentList.replaceChildren(fragment)
  elements.segmentCount.textContent = String(segmentIndex.length)
  elements.segmentSummary.textContent = query
    ? `Найдено: ${filtered.length}. Показано: ${visible.length}.`
    : `Показано ${visible.length} из ${segmentIndex.length}. Ревизия DOCX: ${segmentIndexRevision ?? '—'}.`
  elements.segmentsMore.hidden = visible.length >= filtered.length
  updateSegmentProgress()
}

function createSegmentCard(segment) {
  const card = document.createElement('article')
  card.className = 'segment-card'
  card.dataset.segmentId = segment.id

  const meta = document.createElement('div')
  meta.className = 'segment-card__meta'
  const id = document.createElement('span')
  id.className = 'segment-card__id'
  id.textContent = `S${String(segment.order).padStart(4, '0')}`
  id.title = segment.id
  const location = document.createElement('span')
  location.textContent = describeSegmentLocation(segment)
  meta.append(id, location)

  const source = document.createElement('p')
  source.className = 'segment-card__source'
  source.textContent = segment.source

  const translation = document.createElement('textarea')
  translation.dataset.segmentId = segment.id
  translation.value = translations.get(segment.id) || ''
  translation.placeholder = 'Введите перевод…'
  translation.setAttribute('aria-label', `Перевод сегмента S${String(segment.order).padStart(4, '0')}`)

  const footer = document.createElement('div')
  footer.className = 'segment-card__footer'
  const status = document.createElement('span')
  status.className = 'segment-card__status'
  const copy = document.createElement('button')
  copy.type = 'button'
  copy.className = 'segment-copy'
  copy.dataset.copySegment = segment.id
  copy.textContent = 'Скопировать исходник'
  footer.append(status, copy)

  card.append(meta, source, translation, footer)
  updateSegmentCardState(card, translation.value)
  return card
}

function updateSegmentCardState(card, translation) {
  if (!card) return
  const hasTranslation = Boolean(translation.trim())
  card.classList.toggle('has-translation', hasTranslation)
  const status = card.querySelector('.segment-card__status')
  if (status) status.textContent = hasTranslation ? 'Черновик перевода' : 'Не переведён'
}

function describeSegmentLocation(segment) {
  const labels = {
    paragraph: 'Основной текст',
    'table-cell': 'Таблица',
    'text-box': 'Текстовое поле',
    header: 'Колонтитул',
    footer: 'Колонтитул',
    footnote: 'Сноска',
    endnote: 'Концевая сноска',
  }
  const label = labels[segment.kind] || 'Текст'
  const location = segment.location || {}
  if (segment.kind === 'table-cell' && Number.isInteger(location.tableIndex)) {
    return `${label} ${location.tableIndex + 1} · ${Number(location.rowIndex) + 1}:${Number(location.cellIndex) + 1}`
  }
  return `${label} · абзац ${Number(location.paragraphIndex) + 1}`
}

function updateSegmentProgress() {
  const translated = segmentIndex.reduce(
    (count, segment) => count + (translations.get(segment.id)?.trim() ? 1 : 0),
    0
  )
  elements.segmentProgress.textContent = `${translated} / ${segmentIndex.length}`
}

function translationStorageKey(documentId) {
  return `icat-segment-drafts:${documentId}`
}

function loadTranslations(documentId) {
  try {
    const stored = JSON.parse(localStorage.getItem(translationStorageKey(documentId)) || '{}')
    return new Map(Object.entries(stored).filter(([, value]) => typeof value === 'string'))
  } catch {
    return new Map()
  }
}

function saveTranslations(documentId) {
  try {
    localStorage.setItem(translationStorageKey(documentId), JSON.stringify(Object.fromEntries(translations)))
  } catch {
    // Draft persistence is helpful but must not interrupt document editing.
  }
}

function createEmptyMessage(message) {
  const empty = document.createElement('div')
  empty.className = 'segment-empty'
  empty.textContent = message
  return empty
}

function clearSegmentPanel() {
  segmentIndex = []
  segmentIndexRevision = null
  visibleSegmentLimit = 100
  translations = new Map()
  elements.segmentSearch.value = ''
  elements.segmentCount.textContent = '0'
  elements.segmentProgress.textContent = '0 / 0'
  elements.segmentSummary.textContent = 'Загрузите DOCX для сегментации.'
  elements.segmentList.replaceChildren()
  elements.segmentsMore.hidden = true
}

function destroyEditor(stopPolling = true) {
  if (editor?.destroyEditor) editor.destroyEditor()
  editor = null
  if (stopPolling) {
    clearInterval(pollTimer)
    pollTimer = null
    activeDocument = null
  }
}

function loadEditorApi(source) {
  if (window.DocsAPI) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = source
    script.onload = resolve
    script.onerror = () => reject(new Error(`Не удалось загрузить API редактора: ${source}`))
    document.head.append(script)
  })
}

function setUploading(value) {
  elements.uploadButton.textContent = value ? 'Загружаем…' : 'Выбрать DOCX'
  elements.uploadButton.setAttribute('aria-disabled', String(value))
  elements.uploadError.hidden = true
}

function showError(message) {
  elements.uploadError.textContent = message
  elements.uploadError.hidden = false
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Ошибка HTTP ${response.status}`)
  return payload
}
