const elements = {
  serverState: document.querySelector('#server-state'),
  uploadPanel: document.querySelector('#upload-panel'),
  editorPanel: document.querySelector('#editor-panel'),
  input: document.querySelector('#document-input'),
  uploadButton: document.querySelector('#upload-button'),
  uploadError: document.querySelector('#upload-error'),
  documentTitle: document.querySelector('#document-title'),
  documentState: document.querySelector('#document-state'),
  replaceButton: document.querySelector('#replace-button'),
  downloadButton: document.querySelector('#download-button'),
}

let serverInfo = null
let editor = null
let activeDocument = null
let pollTimer = null
let lastSavedAt = null

elements.input.addEventListener('change', async () => {
  const [file] = elements.input.files
  if (file) await uploadDocument(file)
})

elements.replaceButton.addEventListener('click', () => {
  destroyEditor()
  window.history.replaceState({}, '', '/onlyoffice.html')
  elements.editorPanel.hidden = true
  elements.uploadPanel.hidden = false
  elements.input.value = ''
  elements.uploadError.hidden = true
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
        elements.documentState.textContent = `DOCX сохранён в ICAT: ${new Date(metadata.savedAt).toLocaleTimeString('ru-RU')}`
        elements.downloadButton.href = `${metadata.downloadUrl}?revision=${metadata.revision}`
      }
    } catch {
      // A temporary polling failure should not interrupt the editor session.
    }
  }, 2500)
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
