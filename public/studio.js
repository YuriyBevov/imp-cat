(() => {
  const $ = selector => document.querySelector(selector)
  const iconMarkup = name => `<svg class="ui-icon" aria-hidden="true"><use href="/icons.svg#icon-${name}"></use></svg>`
  const translationUnits = window.IcatTranslationUnits
  const GRID_DENSITY_COLUMNS = Object.freeze({ xs: 64, sm: 48, md: 32, lg: 24, xl: 16, xxl: 8 })
  const elements = {
    uploadView: $('#upload-view'), uploadZone: $('#upload-zone'), fileInput: $('#file-input'), analysisServiceNote: $('#analysis-service-note'),
    loadingView: $('#loading-view'), loadingTitle: $('#loading-title'), loadingMessage: $('#loading-message'), loadingProgress: $('#loading-progress'), loadingProgressLabel: $('#loading-progress-label'), loadingProgressDetails: $('#loading-progress-details'), retryJob: $('#retry-job-button'), cancelJob: $('#cancel-job-button'), studioView: $('#studio-view'),
    documentTabs: $('#document-tabs'), documentTabsList: $('#document-tabs-list'),
    documentLibraryButton: $('#document-library-button'), documentLibraryModal: $('#document-library-modal'),
    documentLibraryClose: $('#document-library-close'), documentLibraryList: $('#document-library-list'),
    documentTitle: $('#document-title'), documentStatus: $('#document-status'), newDocument: $('#new-document-button'),
    appbarMenu: $('#appbar-menu'), appbarMenuButton: $('#appbar-menu-button'), appbarActionsMenu: $('#appbar-actions-menu'),
    exportDocx: $('#export-docx-button'), exportPdf: $('#export-pdf-button'), undo: $('#undo-button'), redo: $('#redo-button'),
    thumbnails: $('#page-thumbnails'), canvasScroll: $('#canvas-scroll'), canvas: $('#document-canvas'),
    viewLayout: $('#view-layout-button'), viewSegments: $('#view-segments-button'), sourcePanelToggle: $('#source-panel-toggle'),
    inspectorPanel: $('#inspector-panel'), inspectorPanelToggle: $('#inspector-panel-toggle'),
    zoomOut: $('#zoom-out'), zoomIn: $('#zoom-in'), zoomFit: $('#zoom-fit'), zoomActual: $('#zoom-100'), zoomOutput: $('#zoom-output'),
    gridSize: $('#grid-size'),
    sourcePreviewScroll: $('#source-preview-scroll'), sourcePreviewCanvas: $('#source-preview-canvas'),
    sourceZoomOut: $('#source-zoom-out'), sourceZoomIn: $('#source-zoom-in'), sourceZoomActual: $('#source-zoom-100'), sourceZoomFit: $('#source-zoom-fit'), sourceZoomOutput: $('#source-zoom-output'), sourcePreviewOpen: $('#source-preview-open'),
    sourceLightbox: $('#source-preview-lightbox'), sourceLightboxTitle: $('#source-preview-lightbox-title'), sourceLightboxClose: $('#source-preview-lightbox-close'),
    sourceLightboxViewport: $('#source-preview-lightbox-viewport'), sourceLightboxCanvas: $('#source-preview-lightbox-canvas'),
    sourceLightboxPrevious: $('#source-preview-lightbox-previous'), sourceLightboxNext: $('#source-preview-lightbox-next'),
    sourceLightboxZoomOut: $('#source-preview-lightbox-zoom-out'), sourceLightboxZoomIn: $('#source-preview-lightbox-zoom-in'),
    sourceLightboxZoomActual: $('#source-preview-lightbox-zoom-100'), sourceLightboxFit: $('#source-preview-lightbox-fit'), sourceLightboxZoomOutput: $('#source-preview-lightbox-zoom-output'),
    sourceLanguage: $('#source-language'), targetLanguage: $('#target-language'),
    agentStatus: $('#agent-status'), analyze: $('#analyze-button'), reanalyze: $('#reanalyze-button'), translate: $('#translate-button'), autoLayout: $('#auto-layout-button'), qa: $('#qa-button'),
    layoutReview: $('#layout-review-button'), layoutReviewCancel: $('#layout-review-cancel-button'), layoutReviewStatus: $('#layout-review-status'),
    translationSelectAll: $('#translation-select-all'), translationSelectionCount: $('#translation-selection-count'),
    globalTranslationInstruction: $('#translation-global-instruction'), reviseSelected: $('#revise-selected-button'), reviseDocument: $('#revise-document-button'),
    instructionPresetSelect: $('#instruction-preset-select'), instructionPresetApply: $('#instruction-preset-apply'),
    instructionPresetSave: $('#instruction-preset-save'), instructionPresetEdit: $('#instruction-preset-edit'), instructionPresetDelete: $('#instruction-preset-delete'),
    instructionPresetEditor: $('#instruction-preset-editor'), instructionPresetText: $('#instruction-preset-text'), instructionPresetEditCancel: $('#instruction-preset-edit-cancel'),
    instructionPresetEditSave: $('#instruction-preset-edit-save'),
    emptyInspector: $('#empty-inspector'), objectInspector: $('#object-inspector'), addObject: $('#add-object-button'),
    selectionTitle: $('#selection-title'), selectionCount: $('#selection-count'), objectType: $('#object-type'),
    tableCellFields: $('#table-cell-fields'), tableId: $('#table-id'), tableRow: $('#table-row'), tableColumn: $('#table-column'), tableRowSpan: $('#table-row-span'), tableColumnSpan: $('#table-column-span'),
    sourceText: $('#source-text'), translationText: $('#translation-text'), confidence: $('#confidence-value'), agentNotes: $('#agent-notes'),
    translationUnitsCard: $('#translation-units-card'), translationUnitsCount: $('#translation-units-count'),
    translationUnitsList: $('#translation-units-list'), translationUnitsSplitSentences: $('#translation-units-split-sentences'),
    translationUnitsSplitSelection: $('#translation-units-split-selection'), translationUnitsMerge: $('#translation-units-merge'),
    translationUnitsApplyExact: $('#translation-units-apply-exact'), translationSelectionPreview: $('#translation-selection-preview'),
    lineHeightDecrease: $('#line-height-decrease'), lineHeight: $('#line-height'), lineHeightIncrease: $('#line-height-increase'),
    toolbarFontSizeDecrease: $('#toolbar-font-size-decrease'), toolbarFontSizeValue: $('#toolbar-font-size-value'), toolbarFontSizeIncrease: $('#toolbar-font-size-increase'),
    toolbarFontFamily: $('#toolbar-font-family'), toolbarTextColor: $('#toolbar-text-color'),
    formatAllSegments: $('#format-all-segments'), typographySelectAll: $('#typography-select-all'),
    fitContentWidth: $('#fit-content-width-button'), fitContentHeight: $('#fit-content-height-button'), fitContentBoth: $('#fit-content-both-button'),
    flexDirection: $('#flex-direction'), flexJustify: $('#flex-justify'),
    flexAlign: $('#flex-align'), flexGap: $('#flex-gap'), flexApply: $('#flex-apply-button'),
    memorySearch: $('#memory-search-button'), memoryResults: $('#memory-results'), approve: $('#approve-button'),
    glossarySelect: $('#glossary-select'), glossaryAdd: $('#glossary-add-button'), knowledgeBaseStatus: $('#knowledge-base-status'), knowledgeBaseMode: $('#knowledge-base-mode'),
    knowledgeSuggestionPopover: $('#knowledge-suggestion-popover'), knowledgeSuggestionTitle: $('#knowledge-suggestion-title'),
    knowledgeSuggestionList: $('#knowledge-suggestion-list'), knowledgeSuggestionClose: $('#knowledge-suggestion-close'),
    knowledgeBaseOpen: $('#knowledge-base-open-button'), knowledgeBaseOpenContext: $('#knowledge-base-open-context-button'), knowledgeBaseModal: $('#knowledge-base-modal'), knowledgeBaseClose: $('#knowledge-base-close'),
    knowledgeBaseQuery: $('#knowledge-base-query'), knowledgeBaseGlossaryFilter: $('#knowledge-base-glossary-filter'), knowledgeBaseSearch: $('#knowledge-base-search-button'),
    knowledgeBaseNew: $('#knowledge-base-new-button'), knowledgeBaseList: $('#knowledge-base-list'), knowledgeBasePrevious: $('#knowledge-base-previous'),
    knowledgeBaseNext: $('#knowledge-base-next'), knowledgeBasePageSummary: $('#knowledge-base-page-summary'),
    knowledgeBaseEntryForm: $('#knowledge-base-entry-form'), knowledgeBaseEntryId: $('#knowledge-base-entry-id'),
    knowledgeBaseEntrySource: $('#knowledge-base-entry-source'), knowledgeBaseEntryTranslation: $('#knowledge-base-entry-translation'),
    knowledgeBaseEntryGlossary: $('#knowledge-base-entry-glossary'), knowledgeBaseEntrySourceLanguage: $('#knowledge-base-entry-source-language'),
    knowledgeBaseEntryTargetLanguage: $('#knowledge-base-entry-target-language'), knowledgeBaseEntryCancel: $('#knowledge-base-entry-cancel'),
    instructionLibraryButton: $('#instruction-library-button'), instructionLibraryModal: $('#instruction-library-modal'),
    instructionLibraryClose: $('#instruction-library-close'), instructionLibraryQuery: $('#instruction-library-query'),
    instructionLibraryNew: $('#instruction-library-new'), instructionLibraryList: $('#instruction-library-list'),
    instructionLibraryForm: $('#instruction-library-form'), instructionLibraryId: $('#instruction-library-id'), instructionLibraryText: $('#instruction-library-text'),
    instructionLibraryFormCancel: $('#instruction-library-form-cancel'),
    merge: $('#merge-button'), split: $('#split-button'), resetPosition: $('#reset-position-button'), exclude: $('#exclude-button'),
    qaPanel: $('#qa-panel'), qaTitle: $('#qa-title'), qaActions: $('#qa-actions'), qaClose: $('#qa-close'), qaSummary: $('#qa-summary'), qaList: $('#qa-list'),
    selectionBox: $('#selection-box'), toast: $('#toast'),
    aiSettingsButton: $('#ai-settings-button'), aiSettingsModal: $('#ai-settings-modal'), aiSettingsClose: $('#ai-settings-close'),
    aiProviderSelect: $('#ai-provider-select'), aitunnelSettings: $('#aitunnel-settings'), aitunnelModel: $('#aitunnel-model'),
    aitunnelApiKey: $('#aitunnel-api-key'), aitunnelPersistKey: $('#aitunnel-persist-key'), aitunnelModelNote: $('#aitunnel-model-note'), aiProviderStatus: $('#ai-provider-status'),
    saveAiSettings: $('#save-ai-settings'), testAiConnection: $('#test-ai-connection'), removeAitunnelKey: $('#remove-aitunnel-key'),
  }

  const state = {
    metadata: null,
    scene: null,
    zoom: .8,
    sourceZoom: .5,
    sourceLightboxZoom: 1,
    sourceRenderedPage: null,
    selected: new Set(),
    translationSelected: new Set(),
    activePage: 0,
    history: [],
    future: [],
    saveTimer: null,
    textCheckpoint: false,
    pointerAction: null,
    toastTimer: null,
    serviceStatus: null,
    lastTextSelection: null,
    focusedTranslationUnitId: null,
    viewMode: 'layout',
    sourceCollapsed: false,
    inspectorOpen: true,
    sourcePanCleanup: null,
    pendingWorkbenchZoom: null,
    pendingSourceZoom: null,
    tabs: new Map(),
    activeTabKey: null,
    jobsPollTimer: null,
    layoutReviewJobs: new Map(),
    providerSettings: null,
    aitunnelModels: [],
    documentLibrary: [],
    glossaries: [],
    knowledgeBaseEntries: [],
    knowledgeBaseOffset: 0,
    knowledgeBaseLimit: 25,
    knowledgeBaseTotal: 0,
    activeKnowledgeSuggestion: null,
    instructionPresets: [],
  }

  function showToast(message, isError = false) {
    clearTimeout(state.toastTimer)
    elements.toast.textContent = message
    elements.toast.classList.toggle('is-error', isError)
    elements.toast.classList.add('is-visible')
    state.toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 4200)
  }

  async function api(url, options = {}) {
    const response = await fetch(url, options)
    if (!response.ok) {
      let message = `HTTP ${response.status}`
      try { message = (await response.json()).error || message } catch {}
      throw new Error(message)
    }
    return response
  }

  function pemToArrayBuffer(pem) {
    const base64 = String(pem || '').replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, '')
    const binary = atob(base64)
    return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer
  }

  async function encryptApiKey(secret, publicKeyPem) {
    if (!window.crypto?.subtle) throw new Error('Браузер не поддерживает безопасное шифрование ключа')
    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    )
    const encrypted = await window.crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, new TextEncoder().encode(secret))
    let binary = ''
    for (const byte of new Uint8Array(encrypted)) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  function renderProviderSettings(settings) {
    state.providerSettings = settings
    elements.aiProviderSelect.value = settings.activeProvider || 'aitunnel'
    if (settings.model && ![...elements.aitunnelModel.options].some(option => option.value === settings.model)) {
      elements.aitunnelModel.append(new Option(settings.model, settings.model))
    }
    elements.aitunnelModel.value = settings.model || ''
    elements.aitunnelApiKey.value = ''
    elements.aitunnelSettings.hidden = elements.aiProviderSelect.value !== 'aitunnel'
    elements.removeAitunnelKey.hidden = !settings.keyConfigured
    if (settings.keyPersisted || !settings.keyConfigured) elements.aitunnelPersistKey.checked = true
    const activeReady = settings.activeProvider === 'codex' ? settings.codexConfigured : settings.aitunnelConfigured
    elements.aiProviderStatus.classList.toggle('is-error', !activeReady)
    elements.aiProviderStatus.textContent = settings.activeProvider === 'codex'
      ? settings.codexConfigured
        ? 'Codex готов: распознавание, проверка и перевод идут через текущий вход ChatGPT.'
        : 'Codex недоступен: проверьте установку CLI и выполните codex login.'
      : settings.aitunnelVerified
        ? `AITunnel подключён · модель ${settings.model} · ${settings.keyPersisted ? 'ключ сохранён на сервере' : 'ключ только в памяти'}.`
        : settings.aitunnelConfigured
          ? `AITunnel настроен · модель ${settings.model} · ${settings.keyPersisted ? 'ключ сохранён на сервере' : 'ключ только в памяти'}. Проверка подключения доступна отдельно.`
          : `AITunnel не настроен. Выберите модель и укажите ключ; endpoint: ${settings.apiHost}.`
  }

  async function loadProviderSettings() {
    const response = await api('/api/studio/provider')
    const settings = await response.json()
    renderProviderSettings(settings)
    return settings
  }

  function renderAitunnelModels(models, authenticationError = '') {
    state.aitunnelModels = models
    const previous = state.providerSettings?.model || elements.aitunnelModel.value
    elements.aitunnelModel.replaceChildren()
    const supported = models.filter(model => model.documentCapable)
    const unsupported = models.filter(model => !model.documentCapable)
    if (supported.length) {
      const group = document.createElement('optgroup')
      group.label = 'Для документов · Vision'
      for (const model of supported) {
        const option = document.createElement('option')
        option.value = model.id
        const maxOutput = Number(model.maxOutput)
        const outputLabel = Number.isFinite(maxOutput) && maxOutput > 0 ? ` · Max ${Math.round(maxOutput / 1000)}k` : ''
        option.textContent = `${model.id}${model.provider ? ` · ${model.provider}` : ''}${outputLabel}`
        option.title = `${model.description || model.id}${outputLabel}`
        group.append(option)
      }
      elements.aitunnelModel.append(group)
    }
    if (unsupported.length) {
      const group = document.createElement('optgroup')
      group.label = 'Только текст · недоступны для полного маршрута'
      for (const model of unsupported) {
        const option = document.createElement('option')
        option.value = model.id
        option.textContent = `${model.id}${model.provider ? ` · ${model.provider}` : ''}`
        option.disabled = true
        group.append(option)
      }
      elements.aitunnelModel.append(group)
    }
    const selected = supported.some(model => model.id === previous) ? previous : supported[0]?.id || ''
    elements.aitunnelModel.value = selected
    elements.aitunnelModelNote.textContent = supported.length
      ? `Доступно ${supported.length} моделей для документов из ${models.length} моделей AITunnel.${authenticationError ? ' Ключ ещё не подтверждён.' : ''}`
      : 'В каталоге не найдено моделей с поддержкой изображений.'
  }

  async function loadAitunnelModels() {
    elements.aitunnelModel.disabled = true
    elements.aitunnelModelNote.textContent = 'Обновляем список моделей AITunnel…'
    try {
      const response = await api('/api/studio/provider/models')
      const catalog = await response.json()
      renderAitunnelModels(Array.isArray(catalog.models) ? catalog.models : [], catalog.authenticationError)
    } catch (error) {
      elements.aitunnelModelNote.textContent = `Не удалось загрузить каталог: ${error.message}`
      elements.aiProviderStatus.classList.add('is-error')
      elements.aiProviderStatus.textContent = error.message
    } finally {
      elements.aitunnelModel.disabled = false
    }
  }

  async function openProviderSettings() {
    elements.aiSettingsModal.hidden = false
    elements.aiProviderStatus.textContent = 'Проверяем настройки…'
    try {
      await loadProviderSettings()
      await loadAitunnelModels()
    } catch (error) {
      elements.aiProviderStatus.classList.add('is-error')
      elements.aiProviderStatus.textContent = error.message
    }
  }

  function closeProviderSettings() {
    elements.aitunnelApiKey.value = ''
    elements.aiSettingsModal.hidden = true
  }

  async function persistProviderSettings(options = {}) {
    const provider = elements.aiProviderSelect.value
    const payload = {
      provider,
      model: elements.aitunnelModel.value,
      persistKey: Boolean(options.persistKey && provider === 'aitunnel' && elements.aitunnelPersistKey.checked),
    }
    const secret = elements.aitunnelApiKey.value.trim()
    if (secret) {
      if (!state.providerSettings?.publicKey) await loadProviderSettings()
      payload.encryptedApiKey = await encryptApiKey(secret, state.providerSettings.publicKey)
    }
    const response = await api('/api/studio/provider', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    renderProviderSettings(await response.json())
    await loadServiceStatus()
    return provider
  }

  async function saveProviderSettings() {
    elements.saveAiSettings.disabled = true
    try {
      const provider = await persistProviderSettings({ persistKey: true })
      showToast(provider === 'codex' ? 'Весь AI переключён на Codex' : 'Весь AI переключён на AITunnel')
      closeProviderSettings()
    } catch (error) {
      elements.aitunnelApiKey.value = ''
      elements.aiProviderStatus.classList.add('is-error')
      elements.aiProviderStatus.textContent = error.message
    } finally {
      elements.saveAiSettings.disabled = false
    }
  }

  async function testAiConnection() {
    elements.testAiConnection.disabled = true
    elements.aiProviderStatus.classList.remove('is-error')
    elements.aiProviderStatus.textContent = 'Проверяем ключ и доступность модели…'
    try {
      const shouldPersist = elements.aiProviderSelect.value === 'aitunnel' && elements.aitunnelPersistKey.checked
      const provider = await persistProviderSettings()
      const response = await api('/api/studio/provider/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, persistKey: provider === 'aitunnel' && shouldPersist }),
      })
      const result = await response.json()
      await loadProviderSettings()
      await loadServiceStatus()
      elements.aiProviderStatus.classList.remove('is-error')
      elements.aiProviderStatus.textContent = result.message
      showToast('Подключение работает')
    } catch (error) {
      elements.aitunnelApiKey.value = ''
      elements.aiProviderStatus.classList.add('is-error')
      elements.aiProviderStatus.textContent = error.message
    } finally {
      elements.testAiConnection.disabled = false
    }
  }

  async function removeAitunnelKey() {
    try {
      const response = await api('/api/studio/provider/key', { method: 'DELETE' })
      renderProviderSettings(await response.json())
      await loadServiceStatus()
      showToast('Ключ удалён из памяти и .env')
    } catch (error) { showToast(error.message, true) }
  }

  function setView(name) {
    elements.uploadView.hidden = name !== 'upload'
    elements.loadingView.hidden = name !== 'loading'
    elements.studioView.hidden = name !== 'studio'
  }

  function updateTabsVisibility() {
    const visible = state.tabs.size > 0
    elements.documentTabs.hidden = !visible
    document.body.classList.toggle('has-document-tabs', visible)
  }

  function renderDocumentTabs() {
    elements.documentTabsList.replaceChildren()
    for (const tab of state.tabs.values()) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `document-tab${tab.key === state.activeTabKey ? ' is-active' : ''}`
      button.dataset.status = tab.status
      button.title = tab.error || tab.title
      const dot = document.createElement('span')
      dot.className = 'document-tab__dot'
      const title = document.createElement('span')
      title.className = 'document-tab__title'
      title.textContent = tab.status === 'running' || tab.status === 'queued'
        ? `${tab.title} · ${tab.progress || 0}%`
        : tab.title
      const close = document.createElement('span')
      close.className = 'icon-button icon-button--tiny icon-button--ghost icon-button--muted document-tab__close'
      close.innerHTML = iconMarkup('close')
      close.title = 'Закрыть вкладку'
      close.addEventListener('click', event => {
        event.stopPropagation()
        closeTab(tab.key)
      })
      button.append(dot, title, close)
      button.addEventListener('click', () => activateTab(tab.key))
      elements.documentTabsList.append(button)
    }
    updateTabsVisibility()
  }

  function updateLoadingFromTab(tab) {
    const progress = Math.max(0, Math.min(100, Number(tab?.progress) || 0))
    const failed = tab?.status === 'failed'
    const cancelled = tab?.status === 'cancelled'
    const pending = tab?.status === 'queued' || tab?.status === 'running'
    elements.loadingView.classList.toggle('is-failed', failed || cancelled)
    elements.loadingTitle.textContent = failed ? 'Обработка остановлена' : cancelled ? 'Обработка отменена' : 'Готовим документ к переводу'
    elements.loadingMessage.textContent = tab?.error || tab?.message || `Анализируем «${tab?.title || 'документ'}»…`
    elements.loadingProgress.style.width = `${progress}%`
    elements.loadingProgressLabel.textContent = failed ? 'Ошибка' : cancelled ? 'Отменено' : `${progress}%`
    const details = tab?.details || {}
    const detailParts = []
    if (Number.isFinite(Number(details.totalPages))) {
      detailParts.push(`Страниц: ${Number(details.processedPages) || 0} из ${Number(details.totalPages)}`)
    }
    if (Number.isFinite(Number(details.batchCount))) detailParts.push(`Пакет: ${Number(details.batchNumber) || 0} из ${Number(details.batchCount)}`)
    if (Number.isFinite(Number(details.objectCount))) detailParts.push(`Сегментов: ${Number(details.objectCount)}`)
    elements.loadingProgressDetails.textContent = detailParts.join(' · ')
    elements.loadingProgressDetails.hidden = !detailParts.length
    elements.retryJob.hidden = !((failed || cancelled) && tab?.jobId)
    elements.retryJob.disabled = false
    elements.cancelJob.hidden = !(pending && tab?.jobId)
    elements.cancelJob.disabled = false
  }

  function rememberCurrentDocument() {
    const tab = state.tabs.get(state.activeTabKey)
    if (tab?.status === 'completed' && state.scene && state.metadata) {
      tab.documentData = { metadata: state.metadata, scene: state.scene }
    }
  }

  async function activateTab(key, forceReload = false) {
    const tab = state.tabs.get(key)
    if (!tab) return
    if (key !== state.activeTabKey) {
      rememberCurrentDocument()
      if (state.saveTimer) {
        try { await saveScene(true) } catch {}
      }
    }
    state.activeTabKey = key
    renderDocumentTabs()
    if (tab.status === 'failed' || tab.status === 'cancelled') {
      setView('loading')
      updateLoadingFromTab(tab)
      elements.loadingProgressLabel.textContent = 'Ошибка'
      return
    }
    if (tab.status !== 'completed') {
      setView('loading')
      updateLoadingFromTab(tab)
      history.replaceState(null, '', `/?job=${tab.jobId}`)
      return
    }
    try {
      if (!tab.documentData || forceReload) {
        const response = await api(`/api/studio/documents/${tab.documentId}`)
        tab.documentData = await response.json()
      }
      openDocument(tab.documentData)
      history.replaceState(null, '', `/?document=${tab.documentId}`)
    } catch (error) {
      tab.status = 'failed'
      tab.error = error.message
      renderDocumentTabs()
      setView('loading')
      updateLoadingFromTab(tab)
    }
  }

  function closeTab(key) {
    const keys = [...state.tabs.keys()]
    const index = keys.indexOf(key)
    const wasActive = state.activeTabKey === key
    state.tabs.delete(key)
    if (wasActive) {
      state.activeTabKey = null
      state.metadata = null
      state.scene = null
      state.translationSelected = new Set()
      const nextKey = keys[index + 1] || keys[index - 1]
      if (nextKey && state.tabs.has(nextKey)) activateTab(nextKey)
      else {
        setView('upload')
        history.replaceState(null, '', '/')
      }
    }
    renderDocumentTabs()
  }

  async function createUploadJob(file) {
    const response = await api('/api/studio/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
    })
    const { job } = await response.json()
    const tab = { key: job.id, jobId: job.id, documentId: job.documentId, title: file.name, ...job }
    state.tabs.set(tab.key, tab)
    return tab
  }

  async function upload(files) {
    const selectedFiles = [...(files || [])]
    if (!selectedFiles.length) return
    elements.fileInput.value = ''
    const results = await Promise.allSettled(selectedFiles.map(createUploadJob))
    const created = results.filter(result => result.status === 'fulfilled').map(result => result.value)
    const failed = results.filter(result => result.status === 'rejected')
    renderDocumentTabs()
    if (created.length) {
      await activateTab(created[0].key)
      scheduleJobsPoll(100)
      showToast(`Добавлено документов: ${created.length}`)
    }
    if (failed.length) showToast(`Не удалось загрузить файлов: ${failed.length}. ${failed[0].reason?.message || ''}`, true)
  }

  async function retryFailedJob() {
    const tab = state.tabs.get(state.activeTabKey)
    if (!tab || !['failed', 'cancelled'].includes(tab.status) || !tab.jobId) return
    elements.retryJob.disabled = true
    try {
      const response = await api(`/api/studio/jobs/${tab.jobId}/retry`, { method: 'POST' })
      const { job } = await response.json()
      Object.assign(tab, job, {
        key: tab.key,
        jobId: job.id,
        documentId: job.documentId,
        title: job.title || tab.title,
        error: null,
      })
      renderDocumentTabs()
      updateLoadingFromTab(tab)
      history.replaceState(null, '', `/?job=${job.id}`)
      scheduleJobsPoll(100)
      showToast('Повторная обработка запущена')
    } catch (error) {
      elements.retryJob.disabled = false
      showToast(error.message, true)
    }
  }

  async function cancelActiveJob() {
    const tab = state.tabs.get(state.activeTabKey)
    if (!tab || !['queued', 'running'].includes(tab.status) || !tab.jobId) return
    elements.cancelJob.disabled = true
    try {
      const response = await api(`/api/studio/jobs/${tab.jobId}/cancel`, { method: 'POST' })
      const { job } = await response.json()
      Object.assign(tab, job, { key: tab.key, jobId: tab.jobId, title: tab.title })
      updateLoadingFromTab(tab)
      renderDocumentTabs()
      scheduleJobsPoll(100)
    } catch (error) {
      elements.cancelJob.disabled = false
      showToast(error.message, true)
    }
  }

  function scheduleJobsPoll(delay = 1_500) {
    clearTimeout(state.jobsPollTimer)
    state.jobsPollTimer = null
    const pendingDocument = [...state.tabs.values()].some(tab => tab.status === 'queued' || tab.status === 'running')
    const pendingLayout = [...state.layoutReviewJobs.values()].some(job => job.status === 'queued' || job.status === 'running')
    if (!pendingDocument && !pendingLayout) return
    state.jobsPollTimer = setTimeout(pollJobs, delay)
  }

  async function pollJobs() {
    state.jobsPollTimer = null
    const pending = [...state.tabs.values()].filter(tab => tab.status === 'queued' || tab.status === 'running')
    await Promise.all(pending.map(async tab => {
      try {
        const response = await api(`/api/studio/jobs/${tab.jobId}`)
        const { job } = await response.json()
        Object.assign(tab, job, { key: tab.key, jobId: tab.jobId, title: tab.title })
        if (tab.key === state.activeTabKey) {
          if (tab.status === 'completed') {
            tab.documentId = job.documentId
            await activateTab(tab.key, true)
            showToast(`Документ готов: ${job.message}`)
          } else updateLoadingFromTab(tab)
        }
      } catch (error) {
        tab.status = 'failed'
        tab.error = error.message
      }
    }))
    const pendingLayouts = [...state.layoutReviewJobs.entries()].filter(([, job]) => job.status === 'queued' || job.status === 'running')
    await Promise.all(pendingLayouts.map(async ([documentId, previous]) => {
      try {
        const response = await api(`/api/studio/jobs/${previous.id}`)
        const { job } = await response.json()
        state.layoutReviewJobs.set(documentId, job)
        if (job.status === 'completed' && state.metadata?.id === documentId) {
          const documentResponse = await api(`/api/studio/documents/${documentId}`)
          const documentData = await documentResponse.json()
          const tab = state.tabs.get(state.activeTabKey)
          if (tab) tab.documentData = documentData
          openDocument(documentData)
          showToast(job.message)
        } else if (state.metadata?.id === documentId) renderLayoutReviewStatus()
      } catch (error) {
        state.layoutReviewJobs.set(documentId, { ...previous, status: 'failed', error: error.message })
        if (state.metadata?.id === documentId) renderLayoutReviewStatus()
      }
    }))
    renderDocumentTabs()
    scheduleJobsPoll()
  }

  async function loadDocumentHistory() {
    try {
      const response = await api('/api/studio/documents')
      const { documents } = await response.json()
      for (const metadata of Array.isArray(documents) ? documents : []) {
        if (!/^[a-f0-9]{32}$/.test(metadata?.id || '')) continue
        const key = `document-${metadata.id}`
        if (state.tabs.has(key)) continue
        state.tabs.set(key, {
          key, jobId: null, documentId: metadata.id,
          title: metadata.title || metadata.filename || 'Документ',
          status: 'completed', progress: 100, metadata,
        })
      }
      renderDocumentTabs()
    } catch {}
  }

  async function loadPendingJobs() {
    try {
      const response = await api('/api/studio/jobs')
      const { jobs } = await response.json()
      for (const job of Array.isArray(jobs) ? jobs : []) {
        if (!['queued', 'running'].includes(job?.status) || !/^[a-f0-9]{32}$/.test(job?.id || '')) continue
        if (job.kind === 'layout-review' && job.documentId) {
          state.layoutReviewJobs.set(job.documentId, job)
          continue
        }
        if (job.kind !== 'document-analysis') continue
        state.tabs.set(job.id, { key: job.id, jobId: job.id, title: job.title || 'Документ', ...job })
      }
      renderDocumentTabs()
      scheduleJobsPoll(100)
    } catch {}
  }

  function documentLibraryDetails(metadata) {
    const parts = []
    if (Number.isFinite(Number(metadata.pageCount))) parts.push(`${metadata.pageCount} стр.`)
    if (Number.isFinite(Number(metadata.objectCount))) parts.push(`${metadata.objectCount} сегментов`)
    const date = new Date(metadata.updatedAt || metadata.createdAt || '')
    if (!Number.isNaN(date.getTime())) parts.push(date.toLocaleString('ru-RU'))
    return parts.join(' · ')
  }

  function tabForDocument(documentId) {
    return [...state.tabs.values()].find(tab => tab.documentId === documentId)
  }

  function closeDocumentTab(documentId) {
    const tab = tabForDocument(documentId)
    if (tab) closeTab(tab.key)
  }

  async function openLibraryDocument(metadata) {
    let tab = tabForDocument(metadata.id)
    if (!tab) {
      const key = `document-${metadata.id}`
      tab = {
        key, jobId: null, documentId: metadata.id,
        title: metadata.title || metadata.filename || 'Документ',
        status: 'completed', progress: 100, metadata,
      }
      state.tabs.set(key, tab)
    }
    elements.documentLibraryModal.hidden = true
    renderDocumentTabs()
    await activateTab(tab.key)
  }

  async function setDocumentArchived(metadata, archived) {
    if (archived && state.metadata?.id === metadata.id && state.saveTimer) await saveScene(true)
    const response = await api(`/api/studio/documents/${metadata.id}/archive`, {
      method: archived ? 'POST' : 'DELETE',
    })
    const result = await response.json()
    if (archived) {
      closeDocumentTab(metadata.id)
      showToast(`Документ «${metadata.title || metadata.filename}» перемещён в архив`)
    } else {
      showToast(`Документ «${metadata.title || metadata.filename}» восстановлен`)
    }
    const index = state.documentLibrary.findIndex(item => item.id === metadata.id)
    if (index >= 0) state.documentLibrary[index] = result.metadata
    renderDocumentLibrary()
    if (!archived) await openLibraryDocument(result.metadata)
  }

  async function deleteLibraryDocument(metadata) {
    const title = metadata.title || metadata.filename || 'Документ'
    if (!window.confirm(`Удалить «${title}» без возможности восстановления?`)) return
    if (state.metadata?.id === metadata.id) {
      clearTimeout(state.saveTimer)
      state.saveTimer = null
    }
    await api(`/api/studio/documents/${metadata.id}`, {
      method: 'DELETE',
      headers: { 'X-Confirm-Document-Id': metadata.id },
    })
    closeDocumentTab(metadata.id)
    state.documentLibrary = state.documentLibrary.filter(item => item.id !== metadata.id)
    renderDocumentLibrary()
    showToast(`Документ «${title}» удалён`)
  }

  function renderDocumentLibrary() {
    elements.documentLibraryList.replaceChildren()
    if (!state.documentLibrary.length) {
      const empty = document.createElement('div')
      empty.className = 'document-library-empty'
      empty.textContent = 'Обработанных и архивных документов пока нет.'
      elements.documentLibraryList.append(empty)
      return
    }
    for (const metadata of state.documentLibrary) {
      const row = document.createElement('article')
      row.className = `document-library-row${metadata.archivedAt ? ' is-archived' : ''}`
      const content = document.createElement('div')
      content.className = 'document-library-row__content'
      const title = document.createElement('strong')
      title.className = 'document-library-row__title'
      title.textContent = metadata.title || metadata.filename || 'Документ'
      const details = document.createElement('span')
      details.className = 'document-library-row__meta'
      const status = document.createElement('span')
      status.className = 'document-library-row__status'
      status.textContent = metadata.archivedAt ? 'Архив' : 'В работе'
      details.append(status, document.createTextNode(` · ${documentLibraryDetails(metadata)}`))
      content.append(title, details)
      const actions = document.createElement('div')
      actions.className = 'document-library-row__actions'
      const primary = document.createElement('button')
      primary.type = 'button'
      primary.className = 'button'
      primary.textContent = metadata.archivedAt ? 'Восстановить' : 'Открыть'
      primary.addEventListener('click', () => (metadata.archivedAt
        ? setDocumentArchived(metadata, false)
        : openLibraryDocument(metadata)).catch(error => showToast(error.message, true)))
      const archive = document.createElement('button')
      archive.type = 'button'
      archive.className = 'button'
      archive.textContent = metadata.archivedAt ? 'Вернуть' : 'В архив'
      archive.hidden = Boolean(metadata.archivedAt)
      archive.addEventListener('click', () => setDocumentArchived(metadata, true).catch(error => showToast(error.message, true)))
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'button button--danger'
      remove.textContent = 'Удалить'
      remove.addEventListener('click', () => deleteLibraryDocument(metadata).catch(error => showToast(error.message, true)))
      actions.append(primary, archive, remove)
      row.append(content, actions)
      elements.documentLibraryList.append(row)
    }
  }

  async function openDocumentLibrary() {
    elements.documentLibraryModal.hidden = false
    elements.documentLibraryList.innerHTML = '<small>Загружаем список…</small>'
    try {
      const response = await api('/api/studio/documents?scope=all')
      const { documents } = await response.json()
      state.documentLibrary = Array.isArray(documents) ? documents : []
      renderDocumentLibrary()
    } catch (error) {
      elements.documentLibraryList.innerHTML = `<div class="document-library-empty">${escapeHtml(error.message)}</div>`
    }
  }

  function openDocument(documentData) {
    const activeTab = state.tabs.get(state.activeTabKey)
    state.metadata = documentData.metadata
    state.scene = documentData.scene
    initializeScenePageMetadata(state.scene)
    state.selected.clear()
    state.translationSelected = activeTab?.translationSelected instanceof Set
      ? new Set(activeTab.translationSelected)
      : new Set()
    state.history = []
    state.future = []
    state.activePage = 0
    state.sourceRenderedPage = null
    if (activeTab) {
      activeTab.documentId = documentData.metadata.id
      activeTab.status = 'completed'
      activeTab.progress = 100
      activeTab.documentData = documentData
      activeTab.title = documentData.scene.title || activeTab.title
      activeTab.translationSelected = state.translationSelected
    }
    renderDocumentTabs()
    elements.documentTitle.textContent = state.scene.title
    elements.documentStatus.textContent = `${state.scene.pages.length} стр. · ${state.scene.objects.length} сегментов · сохранено локально`
    elements.sourceLanguage.value = state.scene.sourceLanguage
    elements.targetLanguage.value = state.scene.targetLanguage
    elements.knowledgeBaseMode.value = state.scene.knowledgeBaseMode === 'priority' ? 'priority' : 'suggestions'
    elements.globalTranslationInstruction.value = state.scene.globalTranslationInstruction || ''
    loadKnowledgeBase().catch(() => {})
    elements.gridSize.value = currentGridDensity()
    const recognition = state.scene.recognition
    const recognitionSummary = recognition?.mode === 'codex'
      ? `Документ полностью разобран агентом${recognition.model ? ` ${recognition.model}` : ''}.`
      : 'Документ распознан локальным анализатором.'
    elements.agentStatus.textContent = state.serviceStatus?.translationProviderConfigured
      ? `${recognitionSummary} Перевод будет выполнен моделью ${state.serviceStatus.translationModel}.`
      : `${recognitionSummary} API перевода пока не настроен: доступны ручной перевод и локальная БЗ.`
    renderLayoutReviewStatus()
    elements.newDocument.hidden = false
    elements.exportDocx.disabled = false
    elements.exportPdf.disabled = false
    setView('studio')
    renderDocument()
    requestAnimationFrame(() => { fitWidth(); fitSourceWidth() })
    refreshUndoButtons()
  }

  function initializeScenePageMetadata(scene) {
    for (const [index, page] of (scene?.pages || []).entries()) {
      if (page.sourcePageIndex === undefined) {
        const match = String(page.imageUrl || '').match(/\/pages\/(\d+)\/image(?:$|[?#])/)
        page.sourcePageIndex = page.isAdded || !page.imageUrl ? null : Number(match?.[1] ?? index)
      }
    }
    reindexScenePages(scene)
  }

  function reindexScenePages(scene = state.scene) {
    for (const [index, page] of (scene?.pages || []).entries()) {
      page.index = index
      page.isAdded = Boolean(page.isAdded || page.sourcePageIndex === null)
      if (page.isAdded) {
        page.sourcePageIndex = null
        page.imageUrl = null
      } else if (state.metadata?.id && Number.isInteger(Number(page.sourcePageIndex))) {
        page.sourcePageIndex = Number(page.sourcePageIndex)
        page.imageUrl = `/api/studio/documents/${state.metadata.id}/pages/${page.sourcePageIndex}/image`
      }
    }
  }

  function rebuildClientTables() {
    const groups = new Map()
    for (const object of state.scene?.objects || []) {
      if (object.excluded || object.type !== 'table_cell' || !object.tableId || !Number.isInteger(object.rowIndex) || !Number.isInteger(object.columnIndex)) continue
      const key = `${object.pageIndex}:${object.tableId}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(object)
    }
    state.scene.tables = [...groups.entries()].map(([key, cells]) => {
      const left = Math.min(...cells.map(cell => cell.x))
      const top = Math.min(...cells.map(cell => cell.y))
      const right = Math.max(...cells.map(cell => cell.x + cell.width))
      const bottom = Math.max(...cells.map(cell => cell.y + cell.height))
      return {
        id: key.slice(key.indexOf(':') + 1), pageIndex: cells[0].pageIndex,
        x: left, y: top, width: right - left, height: bottom - top,
        rowCount: Math.max(...cells.map(cell => cell.rowIndex + (cell.rowSpan || 1))),
        columnCount: Math.max(...cells.map(cell => cell.columnIndex + (cell.columnSpan || 1))),
        cells: cells.map(cell => ({ objectId: cell.id, rowIndex: cell.rowIndex, columnIndex: cell.columnIndex, rowSpan: cell.rowSpan || 1, columnSpan: cell.columnSpan || 1 })),
      }
    })
  }

  function renderDocument() {
    closeKnowledgeSuggestion()
    rebuildClientTables()
    renderThumbnails()
    elements.gridSize.value = currentGridDensity()
    elements.studioView.classList.toggle('is-segments-mode', state.viewMode === 'segments')
    elements.canvas.classList.toggle('is-segments-view', state.viewMode === 'segments')
    elements.canvas.replaceChildren()
    for (const page of state.scene.pages) {
      const shell = document.createElement('div')
      shell.className = 'studio-page-shell'
      shell.dataset.pageIndex = page.index
      const surface = document.createElement('section')
      surface.className = 'studio-page'
      if (state.viewMode === 'segments') surface.classList.add('studio-page--segments')
      surface.dataset.pageIndex = page.index
      surface.style.width = `${page.widthPx}px`
      surface.style.height = state.viewMode === 'segments' ? 'auto' : `${page.heightPx}px`
      applyGridToSurface(surface)
      surface.addEventListener('pointerdown', beginMarquee)

      const pageObjects = state.scene.objects.filter(item => item.pageIndex === page.index && !item.excluded)
      if (state.viewMode === 'segments') {
        const heading = document.createElement('div')
        heading.className = 'segments-page-heading'
        heading.innerHTML = `<span>Страница ${page.index + 1}</span><small>${pageObjects.length} сегм.</small>`
        const list = document.createElement('div')
        list.className = 'segments-list'
        const columnHeadings = document.createElement('div')
        columnHeadings.className = 'segments-column-headings'
        const selectPage = document.createElement('button')
        selectPage.className = 'compact-button segments-select-all'
        selectPage.type = 'button'
        selectPage.textContent = 'Все'
        selectPage.title = `Выбрать все сегменты страницы ${page.index + 1}`
        selectPage.setAttribute('aria-label', selectPage.title)
        selectPage.setAttribute('aria-pressed', 'false')
        selectPage.dataset.pageIndex = String(page.index)
        selectPage.addEventListener('pointerdown', event => event.stopPropagation())
        selectPage.addEventListener('click', event => {
          event.stopPropagation()
          togglePageSegmentSelection(page.index)
        })
        const sourceHeading = document.createElement('span')
        sourceHeading.textContent = 'Распознанный исходник'
        const translationHeading = document.createElement('span')
        translationHeading.textContent = 'Перевод'
        columnHeadings.append(selectPage, sourceHeading, translationHeading)
        for (const object of visualReadingOrder(pageObjects)) {
          const row = document.createElement('div')
          row.className = 'segment-translation-row'
          row.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target !== row) return
            event.stopPropagation()
            if (!state.selected.has(object.id) && !state.translationSelected.has(object.id)) return
            state.selected.delete(object.id)
            state.selected.add(object.id)
            refreshSelection()
          })
          const selectable = isTranslatableType(object.type) && hasTranslationSource(object)
          if (selectable) {
            const selector = document.createElement('label')
            selector.className = 'segment-translation-selector'
            selector.title = 'Добавить сегмент в пакет перевода'
            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.className = 'segment-translation-selector__input'
            checkbox.dataset.translationSelect = object.id
            checkbox.checked = state.translationSelected.has(object.id)
            checkbox.setAttribute('aria-label', `Выбрать сегмент ${object.readingOrder || object.id} для перевода`)
            selector.addEventListener('pointerdown', event => event.stopPropagation())
            checkbox.addEventListener('change', () => {
              changeTranslationSegmentSelection(object.id, checkbox, selector)
            })
            const label = document.createElement('span')
            label.className = 'segment-translation-selector__label'
            label.textContent = 'Выбрать'
            label.setAttribute('aria-hidden', 'true')
            selector.append(checkbox, label)
            row.append(selector)
          } else {
            const placeholder = document.createElement('span')
            placeholder.className = 'segment-translation-selector is-disabled'
            placeholder.title = 'Этот тип объекта не переводится автоматически'
            row.append(placeholder)
          }
          row.classList.toggle('is-translation-selected', state.translationSelected.has(object.id))
          row.classList.toggle('is-primary-selected', primarySelectedObject()?.id === object.id)
          row.append(createObjectElement(object, 'sourceText'), createObjectElement(object, 'translation'))
          list.append(row)
        }
        surface.append(heading, columnHeadings, list)
      } else {
        const boundary = document.createElement('div')
        boundary.className = 'content-boundary'
        Object.assign(boundary.style, {
          left: `${page.contentBounds.x}px`, top: `${page.contentBounds.y}px`,
          width: `${page.contentBounds.width}px`, height: `${page.contentBounds.height}px`,
        })
        surface.append(boundary)

        for (const table of state.scene.tables || []) {
          if (table.pageIndex !== page.index) continue
          const tableBoundary = document.createElement('div')
          tableBoundary.className = 'table-structure-boundary'
          tableBoundary.title = `Структурная таблица: ${table.rowCount} × ${table.columnCount}`
          Object.assign(tableBoundary.style, {
            left: `${table.x}px`, top: `${table.y}px`, width: `${table.width}px`, height: `${table.height}px`,
          })
          const label = document.createElement('span')
          label.textContent = `Таблица ${table.rowCount}×${table.columnCount}`
          tableBoundary.append(label)
          surface.append(tableBoundary)
        }

        for (const object of pageObjects) surface.append(createObjectElement(object))
        const number = document.createElement('span')
        number.className = 'page-number'
        number.textContent = `${page.index + 1} / ${state.scene.pages.length}`
        surface.append(number)
      }
      shell.append(surface)
      elements.canvas.append(shell, createPageActions(page))
    }
    if (state.viewMode === 'segments') refreshSegmentsViewHeights()
    applyZoom()
    renderSourcePreview()
    refreshSelection()
    refreshTranslationSelectionControls()
    if (state.viewMode === 'layout') requestAnimationFrame(expandClippedObjects)
  }

  function visualReadingOrder(objects) {
    const rows = []
    const sorted = [...objects].sort((left, right) => left.y - right.y || left.x - right.x)
    for (const object of sorted) {
      const tolerance = Math.max(4, Math.min(24, (Number(object.style?.fontSizePx) || 14) * .65))
      const row = rows[rows.length - 1]
      if (!row || Math.abs(object.y - row.anchorY) > Math.max(tolerance, row.tolerance)) {
        rows.push({ anchorY: object.y, tolerance, objects: [object] })
        continue
      }
      row.objects.push(object)
      row.anchorY = row.objects.reduce((sum, item) => sum + item.y, 0) / row.objects.length
      row.tolerance = Math.max(row.tolerance, tolerance)
    }
    return rows.flatMap(row => row.objects.sort((left, right) => left.x - right.x || left.y - right.y))
  }

  function renderSourcePreview() {
    if (!state.scene || !elements.sourcePreviewCanvas) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    const renderedPageKey = `${page.index}:${page.sourcePageIndex ?? 'blank'}`
    if (state.sourceRenderedPage === renderedPageKey && elements.sourcePreviewCanvas.firstElementChild) {
      applySourceZoom()
      return
    }
    stopSourcePan()
    elements.sourcePreviewCanvas.replaceChildren()
    const shell = document.createElement('div')
    shell.className = 'source-preview-page-shell'
    const surface = document.createElement('div')
    surface.className = 'source-preview-page'
    surface.style.width = `${page.widthPx}px`
    surface.style.height = `${page.heightPx}px`
    if (page.imageUrl) {
      const image = document.createElement('img')
      image.src = page.imageUrl
      image.alt = `Оригинал страницы ${page.index + 1}`
      image.draggable = false
      const sourceFrame = page.sourceFrame || { x: 0, y: 0, width: page.widthPx, height: page.heightPx }
      Object.assign(image.style, {
        left: `${sourceFrame.x}px`, top: `${sourceFrame.y}px`,
        width: `${sourceFrame.width}px`, height: `${sourceFrame.height}px`,
      })
      surface.append(image)
    } else {
      const empty = document.createElement('span')
      empty.className = 'source-preview-page__empty'
      empty.textContent = 'Пустая добавленная страница'
      surface.append(empty)
    }
    shell.append(surface)
    elements.sourcePreviewCanvas.append(shell)
    state.sourceRenderedPage = renderedPageKey
    applySourceZoom()
  }

  function applySourceZoom() {
    if (!state.scene || !elements.sourcePreviewCanvas) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    const shell = elements.sourcePreviewCanvas.querySelector('.source-preview-page-shell')
    const surface = shell?.querySelector('.source-preview-page')
    if (!shell || !surface) return
    shell.style.width = `${page.widthPx * state.sourceZoom}px`
    shell.style.height = `${page.heightPx * state.sourceZoom}px`
    surface.style.transform = `scale(${state.sourceZoom})`
    elements.sourceZoomOutput.value = `${Math.round(state.sourceZoom * 100)}%`
  }

  function setSourceZoom(nextZoom, anchorEvent) {
    const next = Math.min(3, Math.max(.15, nextZoom))
    if (next === state.sourceZoom) return
    const surface = elements.sourcePreviewCanvas.querySelector('.source-preview-page')
    const anchor = captureZoomAnchor(elements.sourcePreviewScroll, surface, anchorEvent, state.sourceZoom)
    state.sourceZoom = next
    applySourceZoom()
    restoreZoomAnchor(elements.sourcePreviewScroll, anchor, state.sourceZoom)
  }

  function fitSourceWidth() {
    if (!state.scene || !elements.sourcePreviewScroll) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    setSourceZoom((elements.sourcePreviewScroll.clientWidth - 56) / page.widthPx)
  }

  function renderSourceLightbox() {
    if (!state.scene || elements.sourceLightbox.hidden) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    elements.sourceLightboxCanvas.replaceChildren()
    const shell = document.createElement('div')
    shell.className = 'source-preview-lightbox__page-shell'
    const surface = document.createElement('div')
    surface.className = 'source-preview-lightbox__page'
    surface.style.width = `${page.widthPx}px`
    surface.style.height = `${page.heightPx}px`
    if (page.imageUrl) {
      const image = document.createElement('img')
      image.src = page.imageUrl
      image.alt = `Оригинал страницы ${page.index + 1}`
      image.draggable = false
      const sourceFrame = page.sourceFrame || { x: 0, y: 0, width: page.widthPx, height: page.heightPx }
      Object.assign(image.style, {
        left: `${sourceFrame.x}px`, top: `${sourceFrame.y}px`,
        width: `${sourceFrame.width}px`, height: `${sourceFrame.height}px`,
      })
      surface.append(image)
    } else {
      const empty = document.createElement('span')
      empty.className = 'source-preview-lightbox__empty'
      empty.textContent = 'Пустая добавленная страница'
      surface.append(empty)
    }
    shell.append(surface)
    elements.sourceLightboxCanvas.append(shell)
    elements.sourceLightboxTitle.textContent = `${state.scene.title || 'Оригинал документа'} · страница ${page.index + 1} из ${state.scene.pages.length}`
    elements.sourceLightboxPrevious.disabled = state.activePage <= 0
    elements.sourceLightboxNext.disabled = state.activePage >= state.scene.pages.length - 1
    applySourceLightboxZoom()
  }

  function applySourceLightboxZoom() {
    if (!state.scene || elements.sourceLightbox.hidden) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    const shell = elements.sourceLightboxCanvas.querySelector('.source-preview-lightbox__page-shell')
    const surface = shell?.querySelector('.source-preview-lightbox__page')
    if (!shell || !surface) return
    shell.style.width = `${page.widthPx * state.sourceLightboxZoom}px`
    shell.style.height = `${page.heightPx * state.sourceLightboxZoom}px`
    surface.style.transform = `scale(${state.sourceLightboxZoom})`
    elements.sourceLightboxZoomOutput.value = `${Math.round(state.sourceLightboxZoom * 100)}%`
  }

  function setSourceLightboxZoom(nextZoom) {
    state.sourceLightboxZoom = Math.min(4, Math.max(.15, nextZoom))
    applySourceLightboxZoom()
  }

  function fitSourceLightbox() {
    if (!state.scene || elements.sourceLightbox.hidden) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    const viewportWidth = elements.sourceLightboxViewport.clientWidth || window.innerWidth || page.widthPx
    const viewportHeight = elements.sourceLightboxViewport.clientHeight || window.innerHeight || page.heightPx
    setSourceLightboxZoom(Math.min(2, (viewportWidth - 96) / page.widthPx, (viewportHeight - 96) / page.heightPx))
  }

  function openSourceLightbox() {
    if (!state.scene) return
    state.sourceLightboxZoom = 1
    elements.sourceLightbox.hidden = false
    document.body.classList.add('is-source-lightbox-open')
    renderSourceLightbox()
    requestAnimationFrame(fitSourceLightbox)
    elements.sourceLightboxClose.focus()
  }

  function closeSourceLightbox() {
    if (elements.sourceLightbox.hidden) return
    elements.sourceLightbox.hidden = true
    document.body.classList.remove('is-source-lightbox-open')
    elements.sourcePreviewOpen.focus()
  }

  function stepSourceLightbox(delta) {
    if (!state.scene) return
    const next = Math.min(state.scene.pages.length - 1, Math.max(0, state.activePage + delta))
    if (next === state.activePage) return
    state.activePage = next
    renderThumbnails()
    renderSourcePreview()
    renderSourceLightbox()
    requestAnimationFrame(fitSourceLightbox)
  }

  function stopSourcePan() {
    state.sourcePanCleanup?.()
  }

  function beginSourcePan(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || !event.target.closest?.('.source-preview-page')) return
    stopSourcePan()
    event.preventDefault()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    const startLeft = elements.sourcePreviewScroll.scrollLeft
    const startTop = elements.sourcePreviewScroll.scrollTop
    let active = true

    const cleanup = () => {
      if (!active) return
      active = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (elements.sourcePreviewScroll.hasPointerCapture?.(pointerId)) {
        elements.sourcePreviewScroll.releasePointerCapture(pointerId)
      }
      elements.sourcePreviewScroll.classList.remove('is-panning')
      if (state.sourcePanCleanup === cleanup) state.sourcePanCleanup = null
    }
    const move = moveEvent => {
      if (!active || moveEvent.pointerId !== pointerId) return
      moveEvent.preventDefault()
      elements.sourcePreviewScroll.scrollLeft = startLeft - (moveEvent.clientX - startX)
      elements.sourcePreviewScroll.scrollTop = startTop - (moveEvent.clientY - startY)
    }
    const finish = finishEvent => {
      if (finishEvent.pointerId !== pointerId) return
      cleanup()
    }

    state.sourcePanCleanup = cleanup
    elements.sourcePreviewScroll.classList.add('is-panning')
    elements.sourcePreviewScroll.setPointerCapture?.(pointerId)
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function renderThumbnails() {
    elements.thumbnails.replaceChildren()
    for (const page of state.scene.pages) {
      const button = document.createElement('button')
      button.className = `page-thumbnail${page.index === state.activePage ? ' is-active' : ''}`
      button.type = 'button'
      button.dataset.pageIndex = page.index
      const preview = page.imageUrl ? document.createElement('img') : document.createElement('div')
      if (page.imageUrl) {
        preview.src = page.imageUrl
        preview.alt = ''
      } else {
        preview.className = 'page-thumbnail__blank'
        preview.setAttribute('aria-hidden', 'true')
        preview.style.aspectRatio = `${page.widthPx} / ${page.heightPx}`
      }
      const label = document.createElement('span')
      label.textContent = String(page.index + 1)
      button.setAttribute('aria-label', `Страница ${page.index + 1}`)
      button.append(preview, label)
      button.addEventListener('click', () => focusPage(page.index))
      elements.thumbnails.append(button)
    }
  }

  function isScenePageEmpty(pageIndex) {
    return !state.scene.objects.some(object => !object.excluded && object.pageIndex === pageIndex)
  }

  function createPageActions(page) {
    const controls = document.createElement('div')
    controls.className = 'page-actions'
    controls.dataset.pageIndex = page.index

    const add = document.createElement('button')
    add.className = 'icon-button icon-button--compact icon-button--dashed icon-button--accent page-actions__add'
    add.type = 'button'
    add.innerHTML = iconMarkup('plus')
    add.title = 'Добавить пустую страницу ниже'
    add.setAttribute('aria-label', 'Добавить пустую страницу ниже')
    add.addEventListener('click', () => insertBlankPage(page.index))

    const remove = document.createElement('button')
    remove.className = 'icon-button icon-button--compact icon-button--dashed icon-button--danger page-actions__delete'
    remove.type = 'button'
    remove.innerHTML = iconMarkup('trash')
    remove.setAttribute('aria-label', 'Удалить пустую страницу')
    const onlyPage = state.scene.pages.length <= 1
    const empty = isScenePageEmpty(page.index)
    remove.disabled = onlyPage || !empty
    remove.title = onlyPage
      ? 'В документе должна остаться хотя бы одна страница'
      : empty ? 'Удалить эту пустую страницу' : 'Сначала перенесите или удалите сегменты страницы'
    remove.addEventListener('click', () => removeEmptyPage(page.index))

    controls.append(add, remove)
    return controls
  }

  function typeLabel(type) {
    return ({
      text: 'Текст', table: 'Таблица', table_cell: 'Ячейка таблицы', stamp: 'Штамп',
      seal: 'Печать', signature: 'Подпись', handwriting: 'Рукописный текст',
      logo: 'Логотип', image: 'Изображение', unknown: 'Не определено',
    })[type] || type
  }

  function isTranslatableType(type) {
    return type === 'text' || type === 'table' || type === 'table_cell'
      || type === 'stamp' || type === 'seal' || type === 'signature'
  }

  function hasTranslationSource(object) {
    return String(object?.sourceText || '').trim()
      || object?.type === 'signature' || object?.type === 'stamp' || object?.type === 'seal'
  }

  function translationCandidates() {
    return state.scene?.objects.filter(object => (
      !object.excluded && isTranslatableType(object.type) && hasTranslationSource(object)
    )) || []
  }

  function rememberTranslationSelection() {
    const activeTab = state.tabs.get(state.activeTabKey)
    if (activeTab) activeTab.translationSelected = state.translationSelected
  }

  function refreshTranslationSelectionControls() {
    const candidates = translationCandidates()
    const validIds = new Set(candidates.map(object => object.id))
    state.translationSelected = new Set([...state.translationSelected].filter(id => validIds.has(id)))
    rememberTranslationSelection()
    const selectedCount = state.translationSelected.size
    const total = candidates.length
    elements.translationSelectAll.disabled = total === 0
    elements.translationSelectAll.checked = total > 0 && selectedCount === total
    elements.translationSelectAll.indeterminate = selectedCount > 0 && selectedCount < total
    elements.translationSelectionCount.textContent = `Выбрано: ${selectedCount} из ${total}`
    elements.translate.disabled = selectedCount === 0
    elements.reviseSelected.disabled = selectedCount === 0
    elements.reviseDocument.disabled = total === 0
    elements.translate.textContent = selectedCount === total && total > 0
      ? `Перевести весь документ (${total})`
      : `Перевести выбранные (${selectedCount})`
    for (const checkbox of elements.canvas.querySelectorAll('[data-translation-select]')) {
      checkbox.checked = state.translationSelected.has(checkbox.dataset.translationSelect)
      checkbox.closest('.segment-translation-row')?.classList.toggle('is-translation-selected', checkbox.checked)
    }
    for (const button of elements.canvas.querySelectorAll('.segments-select-all')) {
      const pageIndex = Number(button.dataset.pageIndex)
      const pageCandidates = candidates.filter(object => object.pageIndex === pageIndex)
      const allSelected = pageCandidates.length > 0 && pageCandidates.every(object => state.translationSelected.has(object.id))
      const label = `${allSelected ? 'Снять выбор со всех' : 'Выбрать все'} сегментов страницы ${pageIndex + 1}`
      button.classList.toggle('is-active', allSelected)
      button.setAttribute('aria-pressed', String(allSelected))
      button.setAttribute('aria-label', label)
      button.title = label
    }
  }

  function changeTranslationSegmentSelection(objectId, checkbox, selector) {
    const wasPrimary = primarySelectedObject()?.id === objectId

    if (!checkbox.checked && wasPrimary) {
      state.translationSelected.delete(objectId)
      state.selected.delete(objectId)
      if (state.lastTextSelection?.objectId === objectId) state.lastTextSelection = null
      refreshTranslationSelectionControls()
      refreshSelection()
      return
    }

    // A selected, but inactive row needs one click to become primary. Only a
    // second click on that primary row removes it from the group.
    state.translationSelected.add(objectId)
    checkbox.checked = true
    focusTranslationSegment(objectId, selector)
    refreshTranslationSelectionControls()
  }

  function togglePageSegmentSelection(pageIndex) {
    const objects = visualReadingOrder(state.scene?.objects.filter(object => object.pageIndex === pageIndex && !object.excluded) || [])
    const candidates = objects.filter(object => isTranslatableType(object.type) && hasTranslationSource(object))
    const allSelected = candidates.length > 0 && candidates.every(object => state.translationSelected.has(object.id))
    for (const object of objects) {
      if (allSelected) state.selected.delete(object.id)
      else state.selected.add(object.id)
    }
    for (const object of candidates) {
      if (allSelected) state.translationSelected.delete(object.id)
      else state.translationSelected.add(object.id)
    }
    state.activePage = pageIndex
    state.lastTextSelection = null
    refreshSelection()
    refreshTranslationSelectionControls()
  }

  function focusTranslationSegment(objectId, selector) {
    const object = state.scene?.objects.find(item => item.id === objectId)
    if (!object) return
    state.activePage = object.pageIndex
    state.selected.delete(objectId)
    state.selected.add(objectId)
    refreshSelection()
    selector.closest('.segment-translation-row')
      ?.querySelector('.scene-object--source .scene-object__content')
      ?.focus({ preventScroll: true })
  }

  function selectAllTranslationObjects(selected) {
    const candidateIds = translationCandidates().map(object => object.id)
    const previousPrimaryId = primarySelectedObject()?.id
    state.translationSelected = selected ? new Set(candidateIds) : new Set()
    if (selected) {
      for (const id of candidateIds) state.selected.add(id)
      if (previousPrimaryId && state.selected.has(previousPrimaryId)) {
        state.selected.delete(previousPrimaryId)
        state.selected.add(previousPrimaryId)
      }
    } else {
      for (const id of candidateIds) state.selected.delete(id)
    }
    refreshSelection()
    refreshTranslationSelectionControls()
  }

  function servicePlaceholder(type, sourceText = '') {
    return ({
      stamp: String(sourceText || '').trim() ? '' : '/Штамп/',
      seal: String(sourceText || '').trim() ? '' : '/Печать/',
      signature: '/Подпись/', handwriting: '[Рукописный текст]',
      logo: '[Логотип]', image: '[Изображение]', unknown: '[Не определено]',
    })[type] || ''
  }

  function objectOutput(object) {
    return object.translation || object.sourceText || ''
  }

  function objectOutputField(object) {
    return object.translation ? 'translation' : 'sourceText'
  }

  function styleRanges(object, field = objectOutputField(object)) {
    const key = field === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'
    if (!Array.isArray(object[key])) object[key] = []
    return object[key]
  }

  function effectiveTextStyle(object, field, offset) {
    const result = {}
    for (const range of styleRanges(object, field)) {
      if (offset < range.start || offset >= range.end) continue
      for (const property of ['fontFamily', 'fontSizePx', 'fontWeight', 'fontStyle', 'color']) {
        if (range[property] != null) result[property] = range[property]
      }
    }
    return result
  }

  function knowledgeMatchesForObject(object) {
    const ranges = []
    let offset = 0
    for (const unit of ensureObjectTranslationUnits(object)) {
      for (const match of unit.knowledgeMatches || []) {
        ranges.push({
          ...match,
          unitId: unit.id,
          start: offset + match.start,
          end: offset + match.end,
        })
      }
      offset += unit.sourceText.length + String(unit.separatorAfter || '').length
    }
    return ranges.filter(match => match.end > match.start && match.start < object.sourceText.length)
  }

  function closeKnowledgeSuggestion() {
    elements.knowledgeSuggestionPopover.hidden = true
    elements.knowledgeSuggestionList.replaceChildren()
    state.activeKnowledgeSuggestion = null
  }

  async function applyKnowledgeMatch(objectId, unitId, entryId, button) {
    if (!state.metadata) return
    button.disabled = true
    button.textContent = 'Применяем…'
    try {
      checkpoint()
      const response = await api(`/api/studio/documents/${state.metadata.id}/translate/apply-memory`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectId, unitId, entryId }),
      })
      const data = await response.json()
      state.scene = data.scene
      closeKnowledgeSuggestion()
      const object = state.scene.objects.find(item => item.id === objectId)
      renderDocumentWithContentFit(object ? [object] : [])
      scheduleSave()
      showToast(data.source === 'memory' ? 'Применён полный перевод из БЗ' : 'Перевод скорректирован с учётом термина БЗ')
    } catch (error) {
      button.disabled = false
      button.textContent = 'Использовать'
      showToast(error.message, true)
    }
  }

  function showKnowledgeSuggestion(event, objectId, unitId, matchIds) {
    const object = state.scene?.objects.find(item => item.id === objectId)
    const unit = object && ensureObjectTranslationUnits(object).find(item => item.id === unitId)
    const requested = new Set(matchIds)
    const matches = (unit?.knowledgeMatches || []).filter(match => requested.has(match.id))
    if (!matches.length) return
    state.activeKnowledgeSuggestion = { objectId, unitId, matchIds }
    elements.knowledgeSuggestionTitle.textContent = `БЗ: ${matches[0].sourceText}`
    elements.knowledgeSuggestionList.replaceChildren()
    for (const match of matches) {
      const row = document.createElement('article')
      row.className = 'knowledge-suggestion'
      const pair = document.createElement('div')
      pair.className = 'knowledge-suggestion__pair'
      const source = document.createElement('span')
      source.textContent = match.sourceText
      const arrow = document.createElement('span')
      arrow.className = 'knowledge-suggestion__arrow'
      arrow.innerHTML = iconMarkup('arrow-right')
      const translation = document.createElement('span')
      translation.textContent = match.translation
      pair.append(source, arrow, translation)
      const score = document.createElement('strong')
      score.className = 'knowledge-suggestion__score'
      const matchLabel = match.matchType === 'vector'
        ? 'смысловое'
        : match.matchType === 'fuzzy'
          ? 'текстовое'
          : 'точное'
      score.textContent = `${Math.round(match.score * 100)}% ${matchLabel}`
      const actions = document.createElement('div')
      actions.className = 'knowledge-suggestion__actions'
      const openEntry = document.createElement('button')
      openEntry.className = 'button'
      openEntry.type = 'button'
      openEntry.textContent = 'Открыть в БЗ'
      openEntry.addEventListener('click', async () => {
        closeKnowledgeSuggestion()
        elements.knowledgeBaseQuery.value = match.sourceText
        await openKnowledgeBase()
      })
      const apply = document.createElement('button')
      apply.className = 'button button--primary'
      apply.type = 'button'
      apply.textContent = 'Использовать'
      apply.addEventListener('click', () => applyKnowledgeMatch(objectId, unitId, match.entryId, apply))
      actions.append(openEntry, apply)
      row.append(pair, score, actions)
      elements.knowledgeSuggestionList.append(row)
    }
    elements.knowledgeSuggestionPopover.hidden = false
    const rect = event.currentTarget.getBoundingClientRect()
    const width = Math.min(520, window.innerWidth - 24)
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left))
    const estimatedHeight = Math.min(440, 92 + matches.length * 86)
    const below = rect.bottom + 10
    const top = below + estimatedHeight <= window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - estimatedHeight - 10)
    Object.assign(elements.knowledgeSuggestionPopover.style, { left: `${left}px`, top: `${top}px` })
  }

  function aiAlternativeForObject(object) {
    const units = ensureObjectTranslationUnits(object)
    if (!units.some(unit => unit.aiTranslation && unit.activeTranslationSource !== 'ai')) return ''
    if (units.some(unit => !unit.aiTranslation)) return ''
    return units.map((unit, index) => index === units.length - 1
      ? unit.aiTranslation
      : `${unit.aiTranslation}${unit.separatorAfter || ' '}`).join('')
  }

  function useAiAlternative(object) {
    checkpoint()
    for (const unit of ensureObjectTranslationUnits(object)) {
      if (!unit.aiTranslation) continue
      unit.translation = unit.aiTranslation
      unit.activeTranslationSource = 'ai'
      unit.status = 'machine-translated'
      unit.memoryEntryId = null
    }
    translationUnits.syncObjectTranslation(object)
    object.translationTextStyles = []
    object.status = 'machine-translated'
    renderDocumentWithContentFit([object])
    scheduleSave()
    showToast('Использован первоначальный перевод ИИ')
  }

  function renderTextContent(content, object, requestedField = null) {
    const field = requestedField || objectOutputField(object)
    const text = requestedField ? String(object[field] || '') : objectOutput(object)
    content.dataset.outputField = field
    const ranges = styleRanges(object, field).filter(range => range.end > range.start && range.start < text.length)
    const knowledgeMatches = field === 'sourceText' && state.viewMode === 'segments' ? knowledgeMatchesForObject(object) : []
    if (!ranges.length && !knowledgeMatches.length) {
      content.textContent = text
      return
    }
    const points = new Set([0, text.length])
    for (const range of ranges) {
      points.add(Math.max(0, Math.min(text.length, range.start)))
      points.add(Math.max(0, Math.min(text.length, range.end)))
    }
    for (const match of knowledgeMatches) {
      points.add(Math.max(0, Math.min(text.length, match.start)))
      points.add(Math.max(0, Math.min(text.length, match.end)))
    }
    const sorted = [...points].sort((left, right) => left - right)
    const fragment = document.createDocumentFragment()
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const start = sorted[index]
      const end = sorted[index + 1]
      if (end <= start) continue
      const value = text.slice(start, end)
      const runStyle = effectiveTextStyle(object, field, start)
      const activeMatches = knowledgeMatches.filter(match => match.start <= start && match.end >= end)
      if (!Object.keys(runStyle).length && !activeMatches.length) {
        fragment.append(document.createTextNode(value))
        continue
      }
      const span = document.createElement('span')
      span.textContent = value
      if (Object.keys(runStyle).length) span.dataset.textStyle = 'true'
      if (runStyle.fontFamily != null) span.style.fontFamily = runStyle.fontFamily
      if (runStyle.fontSizePx != null) span.style.fontSize = `${runStyle.fontSizePx}px`
      if (runStyle.fontWeight != null) span.style.fontWeight = runStyle.fontWeight
      if (runStyle.fontStyle != null) span.style.fontStyle = runStyle.fontStyle
      if (runStyle.color != null) span.style.color = runStyle.color
      if (activeMatches.length) {
        span.classList.add('knowledge-highlight')
        span.title = 'Найдены варианты в Базе знаний'
        const unitId = activeMatches[0].unitId
        const matchIds = activeMatches.map(match => match.id)
        span.addEventListener('click', event => {
          event.preventDefault()
          event.stopPropagation()
          showKnowledgeSuggestion(event, object.id, unitId, matchIds)
        })
      }
      fragment.append(span)
    }
    content.replaceChildren(fragment)
  }

  function getTextSelection(content, objectId, field = content?.dataset?.outputField) {
    const selection = window.getSelection?.()
    if (!selection?.rangeCount) return null
    const range = selection.getRangeAt(0)
    if (!content.contains(range.commonAncestorContainer)) return null
    const before = range.cloneRange()
    before.selectNodeContents(content)
    before.setEnd(range.startContainer, range.startOffset)
    return { objectId, field, start: before.toString().length, end: before.toString().length + range.toString().length }
  }

  function rememberTextSelection(content, objectId) {
    const selection = getTextSelection(content, objectId)
    if (selection) {
      state.lastTextSelection = selection
      refreshFormattingToolbar()
    }
  }

  function extractInlineStyles(content, expectedText) {
    const ranges = []
    let cursor = 0
    const visit = node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const length = node.nodeValue?.length || 0
        const parent = node.parentElement?.closest?.('[data-text-style]')
        if (parent && length) {
          const range = { start: cursor, end: cursor + length }
          if (parent.style.fontFamily) range.fontFamily = parent.style.fontFamily.replace(/^['"]|['"]$/g, '')
          if (parent.style.fontSize) range.fontSizePx = Number.parseFloat(parent.style.fontSize)
          if (parent.style.fontWeight) range.fontWeight = Number.parseFloat(parent.style.fontWeight) || (parent.style.fontWeight === 'bold' ? 700 : undefined)
          if (parent.style.fontStyle) range.fontStyle = parent.style.fontStyle
          if (parent.style.color) range.color = normalizeTextColor(parent.style.color)
          ranges.push(range)
        }
        cursor += length
        return
      }
      for (const child of node.childNodes) visit(child)
    }
    visit(content)
    return cursor === expectedText.length
      ? ranges.filter(range => range.end > range.start && Object.keys(range).length > 2)
      : []
  }

  function populateInstructionPresetSelect(select) {
    if (!select) return
    const current = select.value
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = state.instructionPresets.length ? 'Готовые инструкции…' : 'Готовых инструкций пока нет'
    select.replaceChildren(placeholder)
    for (const preset of state.instructionPresets) {
      const option = document.createElement('option')
      option.value = preset.id
      option.textContent = preset.instruction.length > 90 ? `${preset.instruction.slice(0, 87)}…` : preset.instruction
      option.title = preset.instruction
      select.append(option)
    }
    select.value = state.instructionPresets.some(preset => preset.id === current) ? current : ''
  }

  function refreshInstructionPresetControls() {
    for (const select of document.querySelectorAll('[data-instruction-preset-select], #instruction-preset-select')) {
      populateInstructionPresetSelect(select)
      const container = select.closest('.instruction-preset-picker, .segment-ai-instruction__presets')
      const apply = container?.querySelector('[data-instruction-preset-apply], #instruction-preset-apply')
      if (apply) apply.disabled = !select.value
    }
    const hasGlobalSelection = Boolean(elements.instructionPresetSelect.value)
    elements.instructionPresetEdit.disabled = !hasGlobalSelection
    elements.instructionPresetDelete.disabled = !hasGlobalSelection
  }

  async function loadInstructionPresets() {
    const response = await api('/api/studio/translation-instructions')
    const data = await response.json()
    state.instructionPresets = Array.isArray(data.presets) ? data.presets : []
    refreshInstructionPresetControls()
  }

  function closeInstructionLibraryForm() {
    elements.instructionLibraryForm.hidden = true
    elements.instructionLibraryForm.reset()
    elements.instructionLibraryId.value = ''
  }

  function showInstructionLibraryForm(preset = null) {
    elements.instructionLibraryForm.hidden = false
    elements.instructionLibraryId.value = preset?.id || ''
    elements.instructionLibraryText.value = preset?.instruction || ''
    elements.instructionLibraryText.focus()
  }

  function renderInstructionLibrary() {
    const query = elements.instructionLibraryQuery.value.trim().toLocaleLowerCase('ru-RU')
    const presets = query
      ? state.instructionPresets.filter(preset => preset.instruction.toLocaleLowerCase('ru-RU').includes(query))
      : state.instructionPresets
    elements.instructionLibraryList.replaceChildren()
    if (!presets.length) {
      const empty = document.createElement('div')
      empty.className = 'document-library-empty'
      empty.textContent = state.instructionPresets.length
        ? 'Инструкции не найдены. Измените поисковый запрос.'
        : 'Готовых инструкций пока нет. Создайте первую инструкцию.'
      elements.instructionLibraryList.append(empty)
      return
    }
    for (const preset of presets) {
      const row = document.createElement('article')
      row.className = 'instruction-library-entry'
      row.dataset.presetId = preset.id
      const content = document.createElement('div')
      content.className = 'instruction-library-entry__content'
      const instruction = document.createElement('p')
      instruction.textContent = preset.instruction
      const meta = document.createElement('small')
      meta.textContent = preset.updatedAt ? `Изменено ${new Date(preset.updatedAt).toLocaleString('ru-RU')}` : 'Готовая инструкция'
      content.append(instruction, meta)
      const actions = document.createElement('div')
      actions.className = 'instruction-library-entry__actions'
      const edit = document.createElement('button')
      edit.type = 'button'
      edit.className = 'button'
      edit.textContent = 'Изменить'
      edit.addEventListener('click', () => showInstructionLibraryForm(preset))
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'button button--danger'
      remove.textContent = 'Удалить'
      remove.addEventListener('click', () => deleteInstructionPreset(preset))
      actions.append(edit, remove)
      row.append(content, actions)
      elements.instructionLibraryList.append(row)
    }
  }

  async function openInstructionLibrary() {
    elements.instructionLibraryModal.hidden = false
    elements.instructionLibraryList.innerHTML = '<small>Загружаем инструкции…</small>'
    try {
      await loadInstructionPresets()
      renderInstructionLibrary()
    } catch (error) {
      elements.instructionLibraryList.innerHTML = `<div class="document-library-empty">${escapeHtml(error.message)}</div>`
    }
  }

  function closeInstructionLibrary() {
    elements.instructionLibraryModal.hidden = true
    closeInstructionLibraryForm()
  }

  async function saveInstructionLibraryEntry(event) {
    event.preventDefault()
    const id = elements.instructionLibraryId.value
    const instruction = elements.instructionLibraryText.value.trim()
    if (!instruction) return showToast('Введите текст инструкции', true)
    try {
      const response = await api(id
        ? `/api/studio/translation-instructions/${encodeURIComponent(id)}`
        : '/api/studio/translation-instructions', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      const result = await response.json()
      const preset = result.preset
      state.instructionPresets = [preset, ...state.instructionPresets.filter(item => item.id !== preset.id)]
      refreshInstructionPresetControls()
      closeInstructionLibraryForm()
      renderInstructionLibrary()
      showToast(id ? 'Готовая инструкция обновлена' : result.created ? 'Готовая инструкция создана' : 'Такая инструкция уже существует')
    } catch (error) { showToast(error.message, true) }
  }

  async function deleteInstructionPreset(preset) {
    const label = preset?.instruction.length > 80 ? `${preset.instruction.slice(0, 77)}…` : preset?.instruction
    if (!preset || !confirm(`Удалить готовую инструкцию «${label}»?`)) return
    try {
      await api(`/api/studio/translation-instructions/${encodeURIComponent(preset.id)}`, { method: 'DELETE' })
      state.instructionPresets = state.instructionPresets.filter(item => item.id !== preset.id)
      if (elements.instructionLibraryId.value === preset.id) closeInstructionLibraryForm()
      closeInstructionPresetEditor()
      refreshInstructionPresetControls()
      if (!elements.instructionLibraryModal.hidden) renderInstructionLibrary()
      showToast('Готовая инструкция удалена')
    } catch (error) { showToast(error.message, true) }
  }

  function appendInstruction(current, addition, maximum) {
    const existing = String(current || '').trim()
    const next = String(addition || '').trim()
    if (!next || existing === next || existing.split(/\n+/).some(value => value.trim() === next)) return existing.slice(0, maximum)
    return `${existing}${existing ? '\n' : ''}${next}`.slice(0, maximum)
  }

  function applyInstructionPreset(select, input, maximum) {
    const preset = state.instructionPresets.find(item => item.id === select.value)
    if (!preset) return showToast('Выберите готовую инструкцию', true)
    input.value = appendInstruction(input.value, preset.instruction, maximum)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    showToast('Готовая инструкция добавлена')
  }

  async function saveInstructionPreset(instruction, select = null) {
    const value = String(instruction || '').trim()
    if (!value) return showToast('Сначала введите комментарий для ИИ', true)
    try {
      const response = await api('/api/studio/translation-instructions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: value }),
      })
      const result = await response.json()
      const existingIndex = state.instructionPresets.findIndex(preset => preset.id === result.preset.id)
      if (existingIndex >= 0) state.instructionPresets.splice(existingIndex, 1)
      state.instructionPresets.unshift(result.preset)
      refreshInstructionPresetControls()
      if (select) {
        select.value = result.preset.id
        select.dispatchEvent(new Event('change', { bubbles: true }))
      }
      showToast(result.created ? 'Инструкция сохранена в готовые' : 'Такая инструкция уже есть в наборе')
    } catch (error) { showToast(error.message, true) }
  }

  function closeInstructionPresetEditor() {
    elements.instructionPresetEditor.hidden = true
    elements.instructionPresetText.value = ''
  }

  function openInstructionPresetEditor() {
    const preset = state.instructionPresets.find(item => item.id === elements.instructionPresetSelect.value)
    if (!preset) return showToast('Выберите готовую инструкцию', true)
    elements.instructionPresetText.value = preset.instruction
    elements.instructionPresetEditor.hidden = false
    elements.instructionPresetText.focus()
  }

  async function updateSelectedInstructionPreset() {
    const id = elements.instructionPresetSelect.value
    const instruction = elements.instructionPresetText.value.trim()
    if (!id) return showToast('Выберите готовую инструкцию', true)
    if (!instruction) return showToast('Введите текст инструкции', true)
    elements.instructionPresetEditSave.disabled = true
    try {
      const response = await api(`/api/studio/translation-instructions/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      })
      const { preset } = await response.json()
      state.instructionPresets = [preset, ...state.instructionPresets.filter(item => item.id !== preset.id)]
      refreshInstructionPresetControls()
      elements.instructionPresetSelect.value = preset.id
      elements.instructionPresetSelect.dispatchEvent(new Event('change', { bubbles: true }))
      closeInstructionPresetEditor()
      showToast('Готовая инструкция обновлена')
    } catch (error) { showToast(error.message, true) }
    finally { elements.instructionPresetEditSave.disabled = false }
  }

  async function deleteSelectedInstructionPreset() {
    const preset = state.instructionPresets.find(item => item.id === elements.instructionPresetSelect.value)
    await deleteInstructionPreset(preset)
  }

  function createSegmentInstructionControl(object) {
    const control = document.createElement('div')
    control.className = 'segment-ai-instruction'
    control.addEventListener('pointerdown', event => event.stopPropagation())
    const input = document.createElement('textarea')
    input.rows = 2
    input.maxLength = 5000
    input.value = object.translationInstruction || ''
    input.placeholder = 'Комментарий для ИИ по этому сегменту…'
    input.setAttribute('aria-label', `Комментарий для ИИ к сегменту ${object.readingOrder || object.id}`)
    input.addEventListener('pointerdown', event => event.stopPropagation())
    input.addEventListener('input', () => {
      object.translationInstruction = input.value.slice(0, 5000)
      scheduleSave()
    })
    const presetControls = document.createElement('div')
    presetControls.className = 'segment-ai-instruction__presets'
    const presetSelect = document.createElement('select')
    presetSelect.dataset.instructionPresetSelect = 'true'
    presetSelect.setAttribute('aria-label', `Готовая инструкция для сегмента ${object.readingOrder || object.id}`)
    populateInstructionPresetSelect(presetSelect)
    const addPreset = document.createElement('button')
    addPreset.type = 'button'
    addPreset.dataset.instructionPresetApply = 'true'
    addPreset.textContent = 'Добавить'
    addPreset.disabled = true
    presetSelect.addEventListener('change', () => { addPreset.disabled = !presetSelect.value })
    addPreset.addEventListener('click', event => {
      event.preventDefault()
      applyInstructionPreset(presetSelect, input, 5000)
    })
    const savePreset = document.createElement('button')
    savePreset.type = 'button'
    savePreset.textContent = 'Сохранить'
    savePreset.addEventListener('click', event => {
      event.preventDefault()
      saveInstructionPreset(input.value, presetSelect)
    })
    presetControls.append(presetSelect, addPreset, savePreset)
    const apply = document.createElement('button')
    apply.type = 'button'
    apply.textContent = 'Исправить ИИ'
    apply.disabled = !String(object.translation || '').trim()
    apply.addEventListener('pointerdown', event => event.stopPropagation())
    apply.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      reviseTranslations([object.id], 'selection', apply)
    })
    control.append(input, presetControls, apply)
    return control
  }

  function createObjectElement(object, requestedField = null) {
    const displayField = requestedField || objectOutputField(object)
    const editField = requestedField || 'translation'
    const node = document.createElement('article')
    node.className = 'scene-object'
    if (requestedField) node.classList.add(`scene-object--${requestedField === 'sourceText' ? 'source' : 'translation'}`)
    if (editField === 'translation' && !object.translation && isTranslatableType(object.type)) node.classList.add('is-untranslated')
    if (object.confidence < .76) node.classList.add('is-low-confidence')
    if (state.selected.has(object.id)) node.classList.add('is-selected')
    if (primarySelectedObject()?.id === object.id) node.classList.add('is-primary-selected')
    node.dataset.id = object.id
    node.dataset.type = object.type
    positionObjectNode(node, object)
    node.style.fontFamily = object.style.fontFamily
    node.style.fontSize = `${object.style.fontSizePx}px`
    node.style.fontWeight = object.style.fontWeight
    node.style.fontStyle = object.style.fontStyle
    node.style.lineHeight = object.style.lineHeight
    node.style.textAlign = object.style.textAlign
    node.style.color = object.style.color
    node.style.zIndex = object.readingOrder
    node.addEventListener('pointerdown', event => selectFromPointer(event, object.id))

    const badge = document.createElement('span')
    badge.className = 'scene-object__badge'
    badge.textContent = typeLabel(object.type)
    const handle = document.createElement('button')
    handle.className = 'icon-button icon-button--tiny icon-button--filled scene-object__handle'
    handle.type = 'button'
    handle.innerHTML = iconMarkup('grip-vertical')
    handle.title = 'Переместить'
    handle.addEventListener('pointerdown', event => beginDrag(event, object.id))
    const content = document.createElement('div')
    content.className = 'scene-object__content'
    content.tabIndex = 0
    const hasMultipleTranslationUnits = editField === 'translation' && isTranslatableType(object.type) && ensureObjectTranslationUnits(object).length > 1
    content.contentEditable = hasMultipleTranslationUnits ? 'false' : 'true'
    if (hasMultipleTranslationUnits) content.title = 'Этот сегмент разбит на внутренние единицы. Редактируйте их в правой панели.'
    content.spellcheck = true
    content.dataset.editField = editField
    renderTextContent(content, object, displayField)
    content.addEventListener('focus', () => {
      if (!state.selected.has(object.id)) selectOnly(object.id)
      else if (primarySelectedObject()?.id !== object.id) {
        state.selected.delete(object.id)
        state.selected.add(object.id)
        refreshSelection()
      }
      if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true }
    })
    for (const eventName of ['pointerup', 'keyup']) content.addEventListener(eventName, () => rememberTextSelection(content, object.id))
    content.addEventListener('blur', () => { state.textCheckpoint = false; scheduleSave() })
    content.addEventListener('input', () => {
      object[editField] = String(content.innerText ?? content.textContent).replace(/\n{3,}/g, '\n\n')
      const stylesField = editField === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'
      object[stylesField] = extractInlineStyles(content, object[editField])
      if (editField === 'sourceText') {
        object.translation = servicePlaceholder(object.type, object.sourceText)
        object.translationTextStyles = []
        object.translationUnits = []
        ensureObjectTranslationUnits(object)
      } else {
        const units = ensureObjectTranslationUnits(object)
          if (units.length === 1) {
            units[0].translation = object.translation
            units[0].status = 'edited'
            units[0].activeTranslationSource = 'manual'
            units[0].memorySuggestion = null
            units[0].memoryEntryId = null
        }
      }
      object.status = 'edited'
      node.classList.toggle('is-untranslated', !object.translation && isTranslatableType(object.type))
      if (state.selected.size === 1) {
        if (editField === 'translation') elements.translationText.value = object.translation
        else elements.sourceText.value = object.sourceText
      }
      scheduleSave()
      requestAnimationFrame(() => {
        fitObjectsToRenderedContent([object], state.viewMode === 'layout')
        if (state.viewMode === 'segments') refreshSegmentsViewHeights()
      })
    })
    const resize = document.createElement('span')
    resize.className = 'scene-object__resize'
    resize.addEventListener('pointerdown', event => beginResize(event, object.id))
    node.append(badge, handle, content)
    if (requestedField === 'translation' && state.viewMode === 'segments' && isTranslatableType(object.type)) {
      node.append(createSegmentInstructionControl(object))
    }
    const aiAlternative = requestedField === 'translation' ? aiAlternativeForObject(object) : ''
    if (aiAlternative && aiAlternative !== object.translation) {
      const alternative = document.createElement('aside')
      alternative.className = 'ai-translation-alternative'
      const label = document.createElement('strong')
      label.textContent = 'Первоначальный вариант ИИ'
      const value = document.createElement('p')
      value.textContent = aiAlternative
      const use = document.createElement('button')
      use.className = 'button'
      use.type = 'button'
      use.textContent = 'Использовать перевод ИИ'
      use.addEventListener('click', event => { event.stopPropagation(); useAiAlternative(object) })
      alternative.append(label, value, use)
      node.append(alternative)
    }
    node.append(resize)
    return node
  }

  function positionObjectNode(node, object) {
    Object.assign(node.style, {
      left: `${object.x}px`, top: `${object.y}px`, width: `${object.width}px`, height: `${object.height}px`,
      transform: object.rotation ? `rotate(${object.rotation}deg)` : '',
    })
  }

  function growObjectToContent(node, object) {
    if (!node || !object || state.viewMode !== 'layout') return false
    const content = node.querySelector('.scene-object__content')
    if (!content) return false
    // The visible content has min-height: 100%. Measuring that rendered box and
    // adding padding made every full rerender grow every segment by a few pixels.
    // The isolated probe measures only the intrinsic text at the stored width,
    // making repeated renders and drag operations geometrically idempotent.
    const requiredHeight = minimumObjectHeight(object, object.width)
    if (!Number.isFinite(requiredHeight) || requiredHeight <= object.height + 1) return false
    const page = state.scene.pages[object.pageIndex]
    const areaBottom = page.contentBounds.y + page.contentBounds.height
    object.height = Math.min(Math.max(12, areaBottom - object.y), Math.max(12, requiredHeight))
    node.style.height = `${object.height}px`
    return true
  }

  function expandClippedObjects() {
    if (!state.scene || state.viewMode !== 'layout') return
    let changed = false
    for (const node of elements.canvas.querySelectorAll('.scene-object')) {
      const object = state.scene.objects.find(item => item.id === node.dataset.id)
      if (object && growObjectToContent(node, object)) changed = true
    }
    if (changed) scheduleSave()
  }

  function currentGridDensity() {
    return GRID_DENSITY_COLUMNS[state.scene?.gridDensity] ? state.scene.gridDensity : 'xs'
  }

  function currentGridSize(page = state.scene?.pages?.[state.activePage] || state.scene?.pages?.[0]) {
    const columns = GRID_DENSITY_COLUMNS[currentGridDensity()]
    return page?.contentBounds?.width > 0 ? page.contentBounds.width / columns : 8
  }

  function snapCoordinate(value, page, axis = 'x') {
    const size = currentGridSize(page)
    const area = page?.contentBounds || { x: 0, y: 0, width: page?.widthPx || 0, height: page?.heightPx || 0 }
    const origin = axis === 'y' ? area.y : area.x
    const boundary = origin + (axis === 'y' ? area.height : area.width)
    const line = origin + Math.round((value - origin) / size) * size
    // The bottom boundary is also a valid line when the page aspect ratio
    // leaves a partial final row.
    return Math.min(boundary, Math.max(origin, line))
  }

  function contentSize(value) {
    return Math.ceil(value)
  }

  function estimatedContentSize(object, width) {
    const text = objectOutput(object) || ' '
    const fontSize = Math.max(6, Number(object.style?.fontSizePx) || 14)
    const lineHeight = Math.max(.8, Number(object.style?.lineHeight) || 1.2)
    const averageCharacterWidth = fontSize * .56
    const sourceLines = text.split('\n')
    const naturalWidth = Math.max(12, ...sourceLines.map(line => line.length * averageCharacterWidth + 10))
    if (width == null) return { width: naturalWidth, height: Math.max(12, sourceLines.length * fontSize * lineHeight + 4) }
    const innerWidth = Math.max(4, width - 8)
    const visualLines = sourceLines.reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length * averageCharacterWidth / innerWidth)), 0)
    return { width, height: Math.max(12, visualLines * fontSize * lineHeight + 4) }
  }

  function measureObjectContent(object, width = null) {
    const renderedNodes = [...elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"]`)]
    const node = renderedNodes.find(candidate => candidate.classList.contains('scene-object--translation'))
      || renderedNodes.find(candidate => !candidate.classList.contains('scene-object--source'))
      || renderedNodes[0]
    if (!node) return estimatedContentSize(object, width)
    const sourceContent = node.querySelector('.scene-object__content')
    if (!sourceContent) return estimatedContentSize(object, width)
    const probe = sourceContent.cloneNode(true)
    probe.contentEditable = 'false'
    Object.assign(probe.style, {
      position: 'fixed', left: '-100000px', top: '0', display: 'inline-block',
      width: width == null ? 'max-content' : `${Math.max(12, width)}px`, height: 'auto',
      minWidth: '12px', minHeight: '12px', maxWidth: 'none', boxSizing: 'border-box',
      padding: '1px 3px', border: '1px solid transparent', transform: 'none', visibility: 'hidden',
      pointerEvents: 'none', overflow: 'visible', zIndex: '-1',
      whiteSpace: width == null ? 'pre' : 'pre-wrap', overflowWrap: width == null ? 'normal' : 'anywhere',
      fontFamily: object.style?.fontFamily || 'Arial', fontSize: `${object.style?.fontSizePx || 14}px`,
      fontWeight: object.style?.fontWeight || 400, fontStyle: object.style?.fontStyle || 'normal',
      lineHeight: object.style?.lineHeight || 1.2, textAlign: object.style?.textAlign || 'left',
    })
    document.body.append(probe)
    const rectangle = probe.getBoundingClientRect()
    const measured = {
      width: width == null ? Math.max(rectangle.width, probe.scrollWidth) : width,
      height: Math.max(rectangle.height, probe.scrollHeight),
    }
    probe.remove()
    const fallback = estimatedContentSize(object, width)
    return {
      width: measured.width > 0 ? measured.width : fallback.width,
      height: measured.height > 0 ? measured.height : fallback.height,
    }
  }

  function minimumObjectHeight(object, width = object.width) {
    const measured = Math.max(12, Math.ceil(measureObjectContent(object, width).height))
    return measured
  }

  function constrainObjectHeight(object, requestedHeight, width = object.width) {
    const page = state.scene.pages[object.pageIndex]
    const maximum = Math.max(12, page.contentBounds.y + page.contentBounds.height - object.y)
    const requested = Math.min(maximum, Math.max(12, requestedHeight))
    // When the content itself is taller than the remaining page area, preserving
    // readable content takes precedence. QA will still report the page overflow.
    return Math.max(minimumObjectHeight(object, width), requested)
  }

  function canFitObjectToText(object) {
    return Boolean(object && !object.excluded && object.type !== 'image' && object.type !== 'logo' && state.scene?.pages?.[object.pageIndex])
  }

  function fitObjectGeometryToContent(object) {
    if (!canFitObjectToText(object)) return false
    const page = state.scene.pages[object.pageIndex]
    const natural = measureObjectContent(object)
    const area = page.contentBounds
    const width = Math.min(area.width, Math.max(12, contentSize(natural.width)))
    const wrapped = measureObjectContent(object, width)
    const height = Math.max(12, contentSize(wrapped.height))
    const x = Math.max(area.x, Math.min(object.x, area.x + area.width - width))
    const changed = Math.abs(object.width - width) > .5 || Math.abs(object.height - height) > .5 || Math.abs(object.x - x) > .5
    Object.assign(object, { x, width, height })
    return changed
  }

  function fitObjectsToRenderedContent(objects, updateNodes = false) {
    let changed = false
    for (const object of objects) {
      if (!fitObjectGeometryToContent(object)) continue
      changed = true
      if (updateNodes) {
        for (const node of elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"]`)) positionObjectNode(node, object)
      }
    }
    return changed
  }

  function renderDocumentWithContentFit(objects) {
    renderDocument()
    if (fitObjectsToRenderedContent(objects)) renderDocument()
  }

  function fitSelectionToContent(mode) {
    const objects = selectedObjects()
    if (!objects.length) return
    cancelPointerAction()
    checkpoint()
    for (const object of objects) {
      const page = state.scene.pages[object.pageIndex]
      let width = object.width
      if (mode === 'both') {
        fitObjectGeometryToContent(object)
        continue
      }
      if (mode === 'width') {
        const natural = measureObjectContent(object)
        width = Math.min(page.contentBounds.width, Math.max(12, contentSize(natural.width)))
        object.width = width
        object.x = Math.max(page.contentBounds.x, Math.min(object.x, page.contentBounds.x + page.contentBounds.width - object.width))
      }
      if (mode === 'height') {
        const wrapped = measureObjectContent(object, width)
        object.height = Math.max(12, contentSize(wrapped.height))
      } else if (mode === 'width') {
        object.height = Math.max(object.height, minimumObjectHeight(object, width))
      }
    }
    renderDocument()
    scheduleSave()
    const label = mode === 'width' ? 'Ширина' : mode === 'height' ? 'Высота' : 'Ширина и высота'
    showToast(`${label} по содержимому: ${objects.length} сегм.`)
  }

  function applyGridToSurface(surface) {
    const page = state.scene.pages[Number(surface.dataset.pageIndex)] || state.scene.pages[0]
    const size = currentGridSize(page)
    surface.style.setProperty('--grid-size', `${size}px`)
  }

  function captureZoomAnchor(scroller, surface, anchorEvent, zoom) {
    if (!anchorEvent || !surface) return null
    const rect = surface.getBoundingClientRect()
    return {
      surface,
      x: (anchorEvent.clientX - rect.left) / zoom,
      y: (anchorEvent.clientY - rect.top) / zoom,
      clientX: anchorEvent.clientX,
      clientY: anchorEvent.clientY,
    }
  }

  function restoreZoomAnchor(scroller, anchor, zoom) {
    if (!anchor) return
    const rect = anchor.surface.getBoundingClientRect()
    scroller.scrollLeft += rect.left + anchor.x * zoom - anchor.clientX
    scroller.scrollTop += rect.top + anchor.y * zoom - anchor.clientY
  }

  function applyZoom() {
    for (const shell of elements.canvas.querySelectorAll('.studio-page-shell')) {
      const page = state.scene.pages[Number(shell.dataset.pageIndex)]
      shell.style.width = `${page.widthPx * state.zoom}px`
      const surface = shell.querySelector('.studio-page')
      const naturalHeight = state.viewMode === 'segments' ? Number(shell.dataset.naturalHeight || 120) : page.heightPx
      shell.style.height = `${naturalHeight * state.zoom}px`
      surface.style.transform = `scale(${state.zoom})`
    }
    elements.zoomOutput.value = `${Math.round(state.zoom * 100)}%`
  }

  function refreshSegmentsViewHeights() {
    if (state.viewMode !== 'segments') return
    for (const shell of elements.canvas.querySelectorAll('.studio-page-shell')) {
      const surface = shell.querySelector('.studio-page--segments')
      if (!surface) continue
      surface.style.height = 'auto'
      const pageIndex = Number(shell.dataset.pageIndex)
      const objects = state.scene.objects.filter(object => object.pageIndex === pageIndex && !object.excluded)
      const fallback = 58 + objects.reduce((sum, object) => sum + Math.max(44, Math.min(240, object.height)) + 10, 0)
      const naturalHeight = Math.max(120, surface.scrollHeight || fallback)
      surface.style.height = `${naturalHeight}px`
      shell.dataset.naturalHeight = String(naturalHeight)
      shell.style.height = `${naturalHeight * state.zoom}px`
    }
  }

  function setDocumentView(mode) {
    if (!state.scene || mode === state.viewMode) return
    state.viewMode = mode
    elements.viewLayout.classList.toggle('is-active', mode === 'layout')
    elements.viewSegments.classList.toggle('is-active', mode === 'segments')
    elements.viewLayout.setAttribute('aria-pressed', String(mode === 'layout'))
    elements.viewSegments.setAttribute('aria-pressed', String(mode === 'segments'))
    renderDocument()
  }

  function toggleSourcePanel() {
    state.sourceCollapsed = !state.sourceCollapsed
    elements.studioView.classList.toggle('is-source-collapsed', state.sourceCollapsed)
    const label = state.sourceCollapsed ? 'Показать оригинал' : 'Скрыть оригинал'
    elements.sourcePanelToggle.title = label
    elements.sourcePanelToggle.setAttribute('aria-label', label)
    elements.sourcePanelToggle.classList.toggle('is-active', !state.sourceCollapsed)
    elements.sourcePanelToggle.setAttribute('aria-expanded', String(!state.sourceCollapsed))
  }

  function setInspectorOpen(open) {
    state.inspectorOpen = Boolean(open)
    if (!state.inspectorOpen && elements.inspectorPanel.contains(document.activeElement)) elements.inspectorPanelToggle.focus()
    elements.studioView.classList.toggle('is-inspector-collapsed', !state.inspectorOpen)
    const label = state.inspectorOpen ? 'Скрыть инспектор' : 'Показать инспектор'
    elements.inspectorPanelToggle.title = label
    elements.inspectorPanelToggle.setAttribute('aria-label', label)
    elements.inspectorPanelToggle.setAttribute('aria-expanded', String(state.inspectorOpen))
    elements.inspectorPanelToggle.classList.toggle('is-active', state.inspectorOpen)
    elements.inspectorPanel.setAttribute('aria-hidden', String(!state.inspectorOpen))
  }

  function setZoom(nextZoom, anchorEvent) {
    const next = Math.min(2.5, Math.max(.25, nextZoom))
    if (next === state.zoom) return
    const hit = anchorEvent && document.elementFromPoint?.(anchorEvent.clientX, anchorEvent.clientY)
    const surface = hit?.closest?.('.studio-page') || null
    const anchor = captureZoomAnchor(elements.canvasScroll, surface, anchorEvent, state.zoom)
    state.zoom = next
    applyZoom()
    restoreZoomAnchor(elements.canvasScroll, anchor, state.zoom)
  }

  function normalizedWheelDelta(event) {
    const modeMultiplier = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? 80 : 1
    return event.deltaY * modeMultiplier
  }

  function queueWheelZoom(event, source = false) {
    const key = source ? 'pendingSourceZoom' : 'pendingWorkbenchZoom'
    const pending = state[key] || { delta: 0, frame: null, clientX: event.clientX, clientY: event.clientY }
    pending.delta = Math.min(80, Math.max(-80, pending.delta + normalizedWheelDelta(event)))
    pending.clientX = event.clientX
    pending.clientY = event.clientY
    state[key] = pending
    if (pending.frame != null) return
    pending.frame = requestAnimationFrame(() => {
      state[key] = null
      const factor = Math.exp(-pending.delta * .0015)
      const anchor = { clientX: pending.clientX, clientY: pending.clientY }
      if (source) setSourceZoom(state.sourceZoom * factor, anchor)
      else setZoom(state.zoom * factor, anchor)
    })
  }

  function fitWidth() {
    if (!state.scene) return
    const maximumWidth = Math.max(...state.scene.pages.map(page => page.widthPx))
    setZoom(Math.min(1.35, Math.max(.25, (elements.canvasScroll.clientWidth - 110) / maximumWidth)))
  }

  function selectedObjects() {
    return state.scene?.objects.filter(object => state.selected.has(object.id)) || []
  }

  function primarySelectedObject() {
    const selectedIds = [...state.selected]
    const id = selectedIds[selectedIds.length - 1]
    return id ? state.scene?.objects.find(object => object.id === id) || null : null
  }

  function selectOnly(id) {
    state.selected = new Set(id ? [id] : [])
    if (!id || state.lastTextSelection?.objectId !== id) state.lastTextSelection = null
    refreshSelection()
  }

  function selectFromPointer(event, id) {
    if (event.button !== 0 || event.target.closest('.scene-object__handle, .scene-object__resize')) return
    event.stopPropagation()
    if (state.viewMode === 'segments' && state.translationSelected.has(id)) {
      const currentPrimaryId = primarySelectedObject()?.id
      for (const selectedId of state.translationSelected) state.selected.add(selectedId)
      if (currentPrimaryId && state.selected.has(currentPrimaryId)) {
        state.selected.delete(currentPrimaryId)
        state.selected.add(currentPrimaryId)
      }
    }
    if (event.metaKey || event.ctrlKey) {
      if (!state.selected.has(id)) {
        state.selected.add(id)
      } else if (primarySelectedObject()?.id === id) {
        event.preventDefault()
        state.selected.delete(id)
      } else {
        state.selected.delete(id)
        state.selected.add(id)
      }
    } else if (!state.selected.has(id)) {
      state.selected = new Set([id])
    } else {
      state.selected.delete(id)
      state.selected.add(id)
    }
    const object = state.scene.objects.find(item => item.id === id)
    if (object) state.activePage = object.pageIndex
    refreshSelection()
  }

  function ensureObjectTranslationUnits(object) {
    if (!translationUnits) return []
    if (object?.type === 'signature') {
      object.translationUnits = []
      return []
    }
    return translationUnits.ensureTranslationUnits(object)
  }

  function translationUnitStatusLabel(unit) {
    return ({
      new: 'Не переведено',
      'memory-suggested': '100% из БЗ',
      'memory-applied': 'Применено из БЗ',
      'machine-translated': 'Переведено ИИ',
      'ai-revised': 'Исправлено ИИ',
      edited: 'Изменено',
      approved: 'В БЗ',
    })[unit.status] || 'Не переведено'
  }

  function applyExactSuggestion(object, unit) {
    const suggestion = unit.memorySuggestion
    if (!suggestion?.translation || suggestion.matchType !== 'exact') return false
    unit.translation = suggestion.translation
    unit.memoryEntryId = suggestion.entryId || null
    unit.status = 'memory-applied'
    unit.activeTranslationSource = 'memory'
    translationUnits.syncObjectTranslation(object)
    object.translationTextStyles = []
    object.status = object.translation ? 'memory-applied' : 'partially-translated'
    return true
  }

  async function saveUnitsToKnowledgeBase(object, units) {
    const eligible = units.filter(unit => unit.sourceText.trim() && unit.translation.trim() && !unit.memoryEntryId)
    if (!eligible.length) return { created: 0, results: [] }
    const response = await api('/api/studio/knowledge-base/entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: eligible.map(unit => ({
        sourceText: unit.sourceText,
        translation: unit.translation,
        sourceLanguage: state.scene.sourceLanguage,
        targetLanguage: state.scene.targetLanguage,
        glossaryId: state.scene.glossaryId,
        clientRef: unit.id,
        provenance: { documentId: state.metadata.id, objectId: object.id, unitId: unit.id },
      })) }),
    })
    const result = await response.json()
    for (const item of result.results || []) {
      const unit = eligible.find(candidate => candidate.id === item.clientRef)
      if (!unit || !item.entry) continue
      if (item.status === 'conflict') {
        unit.memorySuggestion = {
          entryId: item.entry.id,
          translation: item.entry.translation,
          score: 1,
          matchType: 'exact',
          targetLanguage: item.entry.targetLanguage,
        }
        continue
      }
      unit.memoryEntryId = item.entry.id
      unit.status = 'approved'
    }
    return result
  }

  function renderTranslationUnits(selection) {
    const object = selection.length === 1
      && isTranslatableType(selection[0].type)
      && selection[0].type !== 'signature'
      && String(selection[0].sourceText || '').trim()
      ? selection[0]
      : null
    elements.translationUnitsCard.hidden = !object
    elements.translationUnitsList.replaceChildren()
    if (!object) {
      refreshTranslationSelectionPreview()
      return
    }
    const units = ensureObjectTranslationUnits(object)
    elements.translationUnitsCount.textContent = units.length
    elements.translationUnitsMerge.disabled = units.length < 2
    const exactSuggestions = units.filter(unit => unit.memorySuggestion?.matchType === 'exact' && !unit.translation)
    elements.translationUnitsApplyExact.disabled = exactSuggestions.length === 0
    elements.translationUnitsApplyExact.textContent = exactSuggestions.length
      ? `Применить все 100% совпадения (${exactSuggestions.length})`
      : 'Нет новых 100% совпадений'

    units.forEach((unit, index) => {
      const row = document.createElement('article')
      row.className = 'translation-unit'
      row.dataset.unitId = unit.id
      row.classList.toggle('is-new-term', state.focusedTranslationUnitId === unit.id)
      const header = document.createElement('div')
      header.className = 'translation-unit__header'
      const number = document.createElement('span')
      number.className = 'translation-unit__number'
      number.textContent = units.length === 1 ? 'Весь сегмент' : `Часть ${index + 1}`
      const status = document.createElement('span')
      status.className = 'translation-unit__status'
      status.dataset.status = unit.status
      status.textContent = translationUnitStatusLabel(unit)
      header.append(number, status)
      const source = document.createElement('p')
      source.className = 'translation-unit__source'
      source.textContent = unit.sourceText
      const input = document.createElement('textarea')
      input.spellcheck = true
      input.placeholder = unit.sourceText.length <= 80 ? `Перевод: ${unit.sourceText.trim()}` : 'Введите перевод этой части'
      input.value = unit.translation
      input.addEventListener('focus', () => {
        if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true }
      })
      input.addEventListener('input', () => {
        unit.translation = input.value
        unit.status = 'edited'
        unit.activeTranslationSource = 'manual'
        unit.memoryEntryId = null
        translationUnits.syncObjectTranslation(object)
        object.translationTextStyles = []
        object.status = object.translation ? 'translated-edited' : 'partially-translated'
        elements.translationText.value = object.translation
        status.dataset.status = unit.status
        status.textContent = translationUnitStatusLabel(unit)
        save.disabled = !unit.translation.trim()
        save.textContent = 'Сохранить эту пару в БЗ'
        renderSelectedText('translation')
        fitObjectsToRenderedContent([object], state.viewMode === 'layout')
        scheduleSave()
      })
      input.addEventListener('blur', () => { state.textCheckpoint = false })
      row.append(header, source)
      if (unit.memorySuggestion?.matchType === 'exact' && !unit.translation) {
        const suggestion = document.createElement('div')
        suggestion.className = 'translation-unit__suggestion'
        const value = document.createElement('span')
        value.textContent = unit.memorySuggestion.translation
        const apply = document.createElement('button')
        apply.type = 'button'
        apply.textContent = 'Применить 100% совпадение'
        apply.addEventListener('click', () => {
          checkpoint()
          applyExactSuggestion(object, unit)
          renderDocumentWithContentFit([object])
          scheduleSave()
        })
        suggestion.append(value, apply)
        row.append(suggestion)
      }
      row.append(input)
      const actions = document.createElement('div')
      actions.className = 'translation-unit__actions'
      const save = document.createElement('button')
      save.type = 'button'
      save.disabled = !unit.translation.trim() || Boolean(unit.memoryEntryId)
      save.textContent = unit.memoryEntryId ? 'Пара сохранена в БЗ' : 'Сохранить эту пару в БЗ'
      save.addEventListener('click', async () => {
        try {
          const result = await saveUnitsToKnowledgeBase(object, [unit])
          renderTranslationUnits([object])
          scheduleSave()
          const conflict = result.results?.some(item => item.status === 'conflict')
          showToast(conflict
            ? `В БЗ уже есть другой перевод для «${unit.sourceText.trim()}»`
            : `Пара «${unit.sourceText.trim()}» → «${unit.translation.trim()}» сохранена в БЗ`, conflict)
        } catch (error) { showToast(error.message, true) }
      })
      actions.append(save)
      row.append(actions)
      elements.translationUnitsList.append(row)
    })
    refreshTranslationSelectionPreview()
  }

  function sourceTextSelection(object) {
    if (!object || document.activeElement !== elements.sourceText) return null
    const start = elements.sourceText.selectionStart
    const end = elements.sourceText.selectionEnd
    if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return null
    const text = String(object.sourceText || '')
    if (start === 0 && end === text.length) return null
    const value = text.slice(start, end)
    return value.trim() ? { start, end, value } : null
  }

  function refreshTranslationSelectionPreview() {
    if (!elements.translationSelectionPreview) return
    const object = selectedObjects().length === 1 ? selectedObjects()[0] : null
    const selection = sourceTextSelection(object)
    elements.translationUnitsSplitSelection.disabled = !selection
    elements.translationSelectionPreview.classList.toggle('is-ready', Boolean(selection))
    const value = elements.translationSelectionPreview.querySelector('strong')
    value.textContent = selection
      ? `«${selection.value.trim().slice(0, 120)}${selection.value.trim().length > 120 ? '…' : ''}»`
      : 'Сначала выделите слово или фразу выше'
  }

  function refreshSelection() {
    const primaryId = primarySelectedObject()?.id || null
    for (const node of elements.canvas.querySelectorAll('.scene-object')) {
      node.classList.toggle('is-selected', state.selected.has(node.dataset.id))
      node.classList.toggle('is-primary-selected', node.dataset.id === primaryId)
    }
    for (const row of elements.canvas.querySelectorAll('.segment-translation-row')) {
      const objectId = row.querySelector('[data-translation-select]')?.dataset.translationSelect
        || row.querySelector('.scene-object')?.dataset.id
      row.classList.toggle('is-primary-selected', Boolean(objectId) && objectId === primaryId)
    }
    const selection = selectedObjects()
    elements.studioView.classList.toggle('is-inspector-empty', state.viewMode === 'segments' && selection.length === 0)
    elements.emptyInspector.hidden = selection.length > 0
    elements.objectInspector.hidden = selection.length === 0
    elements.merge.disabled = selection.length < 2 || new Set(selection.map(item => item.pageIndex)).size !== 1
    const onePage = selection.length > 0 && new Set(selection.map(item => item.pageIndex)).size === 1
    document.querySelectorAll('[data-align-selection]').forEach(button => {
      const minimum = button.dataset.alignSelection.startsWith('distribute') ? 3 : 2
      button.disabled = !onePage || selection.length < minimum
    })
    document.querySelectorAll('[data-align-document]').forEach(button => { button.disabled = !onePage })
    refreshLayoutAlignmentState(selection, onePage)
    elements.flexApply.disabled = !onePage || selection.length < 2
    refreshFormattingToolbar()
    refreshFormattingSelectionToggle()
    elements.agentNotes.hidden = true
    elements.tableCellFields.hidden = !selection.length || selection.some(item => item.type !== 'table_cell')
    if (!selection.length) {
      elements.translationText.disabled = false
      elements.translationUnitsCard.hidden = true
      elements.translationUnitsList.replaceChildren()
      return
    }
    const first = selection[0]
    const units = selection.length === 1 && isTranslatableType(first.type) ? ensureObjectTranslationUnits(first) : []
    elements.selectionTitle.textContent = selection.length === 1 ? `${typeLabel(first.type)} · стр. ${first.pageIndex + 1}` : `${selection.length} сегмента`
    elements.selectionCount.textContent = selection.length
    setMixedControl(elements.objectType, selection.map(item => item.type))
    if (!elements.tableCellFields.hidden) {
      setMixedControl(elements.tableId, selection.map(item => item.tableId || ''))
      setMixedControl(elements.tableRow, selection.map(item => item.rowIndex ?? 0))
      setMixedControl(elements.tableColumn, selection.map(item => item.columnIndex ?? 0))
      setMixedControl(elements.tableRowSpan, selection.map(item => item.rowSpan || 1))
      setMixedControl(elements.tableColumnSpan, selection.map(item => item.columnSpan || 1))
    }
    setMixedControl(elements.sourceText, selection.map(item => item.sourceText))
    setMixedControl(elements.translationText, selection.map(item => item.translation))
    elements.translationText.disabled = units.length > 1
    elements.translationText.title = units.length > 1 ? 'Переводите части во внутренних сегментах ниже' : ''
    elements.confidence.textContent = selection.length === 1 ? `${Math.round(first.confidence * 100)}%` : 'несколько'
    if (selection.length === 1 && first.agentNotes) {
      elements.agentNotes.textContent = first.agentNotes
      elements.agentNotes.hidden = false
    }
    renderTranslationUnits(selection)
  }

  function setMixedControl(control, values) {
    const first = values[0]
    control.value = values.every(value => String(value) === String(first)) ? first : ''
    control.placeholder = values.length > 1 && control.value === '' ? 'разные значения' : ''
  }

  function boundsOf(objects) {
    const left = Math.min(...objects.map(object => object.x))
    const top = Math.min(...objects.map(object => object.y))
    const right = Math.max(...objects.map(object => object.x + object.width))
    const bottom = Math.max(...objects.map(object => object.y + object.height))
    return { left, top, right, bottom, width: right - left, height: bottom - top }
  }

  function groupedByPage(objects) {
    const groups = new Map()
    for (const object of objects) {
      if (!groups.has(object.pageIndex)) groups.set(object.pageIndex, [])
      groups.get(object.pageIndex).push(object)
    }
    return groups
  }

  function clampGroupShift(objects, dx, dy) {
    const page = state.scene.pages[objects[0].pageIndex]
    const bounds = boundsOf(objects)
    const area = page.contentBounds
    const minimumX = area.x - bounds.left
    const maximumX = area.x + area.width - bounds.right
    const minimumY = area.y - bounds.top
    const maximumY = area.y + area.height - bounds.bottom
    return {
      x: minimumX <= maximumX ? Math.min(maximumX, Math.max(minimumX, dx)) : minimumX,
      y: minimumY <= maximumY ? Math.min(maximumY, Math.max(minimumY, dy)) : minimumY,
    }
  }

  function snapAxisPosition(value, minimum, maximum, page, axis) {
    const area = page.contentBounds
    const origin = axis === 'y' ? area.y : area.x
    const size = currentGridSize(page)
    if (maximum < minimum) return minimum
    const firstIndex = Math.ceil((minimum - origin) / size - 0.000001)
    const lastIndex = Math.floor((maximum - origin) / size + 0.000001)
    if (firstIndex > lastIndex) return Math.min(maximum, Math.max(minimum, value))
    const requestedIndex = Math.round((value - origin) / size)
    const index = Math.min(lastIndex, Math.max(firstIndex, requestedIndex))
    return origin + index * size
  }

  function snapObjectGroups(objects) {
    for (const group of groupedByPage(objects).values()) {
      const bounds = boundsOf(group)
      const page = state.scene.pages[group[0].pageIndex]
      const area = page.contentBounds
      const maximumLeft = area.x + area.width - bounds.width
      const maximumTop = area.y + area.height - bounds.height
      const targetLeft = snapAxisPosition(bounds.left, area.x, maximumLeft, page, 'x')
      const targetTop = snapAxisPosition(bounds.top, area.y, maximumTop, page, 'y')
      const shift = { x: targetLeft - bounds.left, y: targetTop - bounds.top }
      for (const object of group) {
        object.x += shift.x
        object.y += shift.y
      }
    }
  }

  function selectionOnOnePage(minimum = 1) {
    const objects = selectedObjects()
    if (objects.length < minimum) {
      showToast(minimum > 2 ? 'Выберите минимум три сегмента' : minimum > 1 ? 'Выберите несколько сегментов' : 'Выберите сегмент', true)
      return null
    }
    if (new Set(objects.map(object => object.pageIndex)).size !== 1) {
      showToast('Выравнивать можно сегменты одной страницы', true)
      return null
    }
    return objects
  }

  function valuesAreAligned(values, tolerance = .75) {
    return values.length > 0 && Math.max(...values) - Math.min(...values) <= tolerance
  }

  function hasEqualObjectIntervals(objects, axis, tolerance = .75) {
    if (objects.length < 3) return false
    const horizontal = axis === 'x'
    const sorted = [...objects].sort((left, right) => (horizontal ? left.x - right.x : left.y - right.y))
    const gaps = sorted.slice(1).map((object, index) => {
      const previous = sorted[index]
      return horizontal
        ? object.x - (previous.x + previous.width)
        : object.y - (previous.y + previous.height)
    })
    return valuesAreAligned(gaps, tolerance)
  }

  function setLayoutButtonActive(button, active) {
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-pressed', String(active))
  }

  function refreshLayoutAlignmentState(objects, onePage) {
    for (const button of document.querySelectorAll('[data-align-selection]')) {
      const action = button.dataset.alignSelection
      let active = onePage && !button.disabled
      if (active && action === 'left') active = valuesAreAligned(objects.map(object => object.x))
      else if (active && action === 'center-x') active = valuesAreAligned(objects.map(object => object.x + object.width / 2))
      else if (active && action === 'right') active = valuesAreAligned(objects.map(object => object.x + object.width))
      else if (active && action === 'top') active = valuesAreAligned(objects.map(object => object.y))
      else if (active && action === 'center-y') active = valuesAreAligned(objects.map(object => object.y + object.height / 2))
      else if (active && action === 'bottom') active = valuesAreAligned(objects.map(object => object.y + object.height))
      else if (active && action === 'distribute-x') active = hasEqualObjectIntervals(objects, 'x')
      else if (active && action === 'distribute-y') active = hasEqualObjectIntervals(objects, 'y')
      setLayoutButtonActive(button, active)
    }

    const page = onePage ? state.scene.pages[objects[0].pageIndex] : null
    const area = page?.contentBounds
    const bounds = area ? boundsOf(objects) : null
    const documentTolerance = page ? Math.max(.75, currentGridSize(page) / 2 + .01) : .75
    for (const button of document.querySelectorAll('[data-align-document]')) {
      const action = button.dataset.alignDocument
      let active = Boolean(area && bounds && !button.disabled)
      if (active && action === 'left') active = valuesAreAligned([bounds.left, area.x], documentTolerance)
      else if (active && action === 'center-x') active = valuesAreAligned([(bounds.left + bounds.right) / 2, area.x + area.width / 2], documentTolerance)
      else if (active && action === 'right') active = valuesAreAligned([bounds.right, area.x + area.width], documentTolerance)
      else if (active && action === 'top') active = valuesAreAligned([bounds.top, area.y], documentTolerance)
      else if (active && action === 'center-y') active = valuesAreAligned([(bounds.top + bounds.bottom) / 2, area.y + area.height / 2], documentTolerance)
      else if (active && action === 'bottom') active = valuesAreAligned([bounds.bottom, area.y + area.height], documentTolerance)
      setLayoutButtonActive(button, active)
    }
  }

  function alignSelection(action) {
    const minimum = action.startsWith('distribute') ? 3 : 2
    const objects = selectionOnOnePage(minimum)
    if (!objects) return
    checkpoint()
    const bounds = boundsOf(objects)
    const centerX = (bounds.left + bounds.right) / 2
    const centerY = (bounds.top + bounds.bottom) / 2
    if (action === 'left') for (const object of objects) object.x = bounds.left
    else if (action === 'center-x') for (const object of objects) object.x = centerX - object.width / 2
    else if (action === 'right') for (const object of objects) object.x = bounds.right - object.width
    else if (action === 'top') for (const object of objects) object.y = bounds.top
    else if (action === 'center-y') for (const object of objects) object.y = centerY - object.height / 2
    else if (action === 'bottom') for (const object of objects) object.y = bounds.bottom - object.height
    else if (action === 'distribute-x') {
      const sorted = [...objects].sort((left, right) => left.x - right.x)
      const gap = (bounds.width - sorted.reduce((sum, object) => sum + object.width, 0)) / (sorted.length - 1)
      let cursor = bounds.left
      for (const object of sorted) { object.x = cursor; cursor += object.width + gap }
    } else if (action === 'distribute-y') {
      const sorted = [...objects].sort((top, bottom) => top.y - bottom.y)
      const gap = (bounds.height - sorted.reduce((sum, object) => sum + object.height, 0)) / (sorted.length - 1)
      let cursor = bounds.top
      for (const object of sorted) { object.y = cursor; cursor += object.height + gap }
    }
    snapObjectGroups(objects)
    renderDocument()
    scheduleSave()
  }

  function alignToDocument(action) {
    const objects = selectionOnOnePage(1)
    if (!objects) return
    const page = state.scene.pages[objects[0].pageIndex]
    const area = page.contentBounds
    const bounds = boundsOf(objects)
    let dx = 0
    let dy = 0
    if (action === 'left') dx = area.x - bounds.left
    else if (action === 'center-x') dx = area.x + (area.width - bounds.width) / 2 - bounds.left
    else if (action === 'right') dx = area.x + area.width - bounds.right
    else if (action === 'top') dy = area.y - bounds.top
    else if (action === 'center-y') dy = area.y + (area.height - bounds.height) / 2 - bounds.top
    else if (action === 'bottom') dy = area.y + area.height - bounds.bottom
    checkpoint()
    for (const object of objects) {
      object.x += dx
      object.y += dy
    }
    const shift = clampGroupShift(objects, 0, 0)
    for (const object of objects) { object.x += shift.x; object.y += shift.y }
    snapObjectGroups(objects)
    renderDocument()
    scheduleSave()
  }

  function applyFlexLayout() {
    const objects = selectionOnOnePage(2)
    if (!objects) return
    const page = state.scene.pages[objects[0].pageIndex]
    const direction = elements.flexDirection.value
    const horizontal = direction === 'row'
    const justify = elements.flexJustify.value
    const align = elements.flexAlign.value
    const requestedGap = Math.min(200, Math.max(0, Number(elements.flexGap.value) || 0))
    const ordered = [...objects].sort(horizontal
      ? (left, right) => left.x - right.x || left.y - right.y
      : (top, bottom) => top.y - bottom.y || top.x - bottom.x)
    const area = { ...page.contentBounds }
    let mainStart = horizontal ? area.x : area.y
    let mainLength = horizontal ? area.width : area.height
    const totalItemLength = ordered.reduce((sum, object) => sum + (horizontal ? object.width : object.height), 0)
    const requestedLength = totalItemLength + requestedGap * (ordered.length - 1)

    if (totalItemLength > mainLength) {
      showToast('Сегменты не помещаются вдоль выбранной оси. Уменьшите их или выберите большую область.', true)
      return
    }

    const gap = ordered.length > 1
      ? Math.min(requestedGap, Math.max(0, (mainLength - totalItemLength) / (ordered.length - 1)))
      : 0
    const occupiedLength = totalItemLength + gap * (ordered.length - 1)
    const freeSpace = Math.max(0, mainLength - occupiedLength)
    let offset = 0
    let distributedGap = gap
    if (justify === 'center') offset = freeSpace / 2
    else if (justify === 'end') offset = freeSpace
    else if (justify === 'space-between' && ordered.length > 1) distributedGap += freeSpace / (ordered.length - 1)
    else if (justify === 'space-around') {
      distributedGap += freeSpace / ordered.length
      offset = freeSpace / (ordered.length * 2)
    } else if (justify === 'space-evenly') {
      distributedGap += freeSpace / (ordered.length + 1)
      offset = freeSpace / (ordered.length + 1)
    }

    checkpoint()
    let cursor = mainStart + offset
    for (const object of ordered) {
      if (horizontal) object.x = cursor
      else object.y = cursor
      cursor += (horizontal ? object.width : object.height) + distributedGap
    }

    const crossStart = horizontal ? area.y : area.x
    const crossLength = horizontal ? area.height : area.width
    const baseline = crossStart + Math.max(...objects.map(object => Math.max(6, Number(object.style?.fontSizePx) || 14) * .82))
    for (const object of objects) {
      const objectCrossLength = horizontal ? object.height : object.width
      let position = crossStart
      if (align === 'center') position += (crossLength - objectCrossLength) / 2
      else if (align === 'end') position += crossLength - objectCrossLength
      else if (align === 'baseline' && horizontal) position = baseline - Math.max(6, Number(object.style?.fontSizePx) || 14) * .82
      if (horizontal) {
        object.y = position
        if (align === 'stretch') { object.y = crossStart; object.height = Math.max(12, crossLength) }
      } else {
        object.x = position
        if (align === 'stretch') { object.x = crossStart; object.width = Math.max(12, crossLength) }
      }
    }

    const shift = clampGroupShift(objects, 0, 0)
    for (const object of objects) { object.x += shift.x; object.y += shift.y }
    snapObjectGroups(objects)
    renderDocument()
    scheduleSave()
    showToast(`${horizontal ? 'Горизонтальная' : 'Вертикальная'} расстановка применена`)
  }

  function cancelPointerAction() {
    const action = state.pointerAction
    if (!action) return
    action.cancel?.()
    if (state.pointerAction === action) state.pointerAction = null
  }

  function startPointerAction(event, captureElement, action, handlers) {
    const pointerId = event.pointerId
    let active = true
    let lastEvent = event
    const cleanup = () => {
      if (!active) return
      active = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', commit)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      captureElement.removeEventListener('lostpointercapture', commitLatest)
      if (captureElement.hasPointerCapture?.(pointerId)) captureElement.releasePointerCapture(pointerId)
      if (state.pointerAction === action) state.pointerAction = null
    }
    const move = current => {
      if (!active || current.pointerId !== pointerId) return
      if (current.cancelable) current.preventDefault()
      lastEvent = current
      handlers.move?.(current)
    }
    const commit = current => {
      if (!active || current.pointerId !== pointerId) return
      if (current.cancelable) current.preventDefault()
      lastEvent = current
      handlers.move?.(current)
      cleanup()
      handlers.commit?.(current)
    }
    const commitLatest = current => {
      if (!active || (current?.pointerId != null && current.pointerId !== pointerId)) return
      cleanup()
      handlers.commit?.(lastEvent)
    }
    const cancel = current => {
      if (!active || (current?.pointerId != null && current.pointerId !== pointerId)) return
      cleanup()
      handlers.cancel?.(lastEvent)
    }
    action.cancel = () => cancel(null)
    action.updateFromScroll = () => { if (active) handlers.move?.(lastEvent) }
    state.pointerAction = action
    try { captureElement.setPointerCapture?.(pointerId) } catch {}
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', commit)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    captureElement.addEventListener('lostpointercapture', commitLatest)
  }

  function beginMarquee(event) {
    if (event.button !== 0 || event.target.closest('.scene-object')) return
    cancelPointerAction()
    event.preventDefault()
    const surface = event.currentTarget
    const additive = event.metaKey || event.ctrlKey
    const selectionBefore = new Set(state.selected)
    const originalSelection = additive ? new Set(selectionBefore) : new Set()
    const start = { x: event.clientX, y: event.clientY }
    elements.selectionBox.hidden = false
    Object.assign(elements.selectionBox.style, { left: `${start.x}px`, top: `${start.y}px`, width: '0px', height: '0px' })
    const move = current => {
      const left = Math.min(start.x, current.clientX)
      const top = Math.min(start.y, current.clientY)
      const right = Math.max(start.x, current.clientX)
      const bottom = Math.max(start.y, current.clientY)
      Object.assign(elements.selectionBox.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` })
      state.selected = new Set(originalSelection)
      for (const node of surface.querySelectorAll('.scene-object')) {
        const rect = node.getBoundingClientRect()
        if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) state.selected.add(node.dataset.id)
      }
      refreshSelection()
    }
    startPointerAction(event, surface, { kind: 'marquee', pointerId: event.pointerId }, {
      move,
      commit: () => { elements.selectionBox.hidden = true },
      cancel: () => {
        elements.selectionBox.hidden = true
        state.selected = selectionBefore
        refreshSelection()
      },
    })
  }

  function beginDrag(event, id) {
    if (event.button !== 0) return
    cancelPointerAction()
    event.preventDefault()
    event.stopPropagation()
    state.lastTextSelection = null
    if (!state.selected.has(id)) state.selected = new Set([id])
    else {
      state.selected.delete(id)
      state.selected.add(id)
    }
    const historyLength = state.history.length
    checkpoint()
    refreshSelection()
    const objects = selectedObjects()
    const handle = event.currentTarget
    const origins = new Map(objects.map(object => [object.id, { x: object.x, y: object.y, pageIndex: object.pageIndex }]))
    const originBounds = boundsOf(objects)
    const originSurface = handle.closest('.studio-page')
    const originSurfaceRect = originSurface?.getBoundingClientRect()
    elements.canvas.classList.add('is-object-dragging')
    for (const pageIndex of new Set(objects.map(object => object.pageIndex))) {
      const sourceSurface = elements.canvas.querySelector(`.studio-page[data-page-index="${pageIndex}"]`)
      sourceSurface?.classList.add('is-drag-source')
      sourceSurface?.closest('.studio-page-shell')?.classList.add('is-drag-source-shell')
    }
    const grabOffset = originSurfaceRect ? {
      x: (event.clientX - originSurfaceRect.left) / state.zoom - originBounds.left,
      y: (event.clientY - originSurfaceRect.top) / state.zoom - originBounds.top,
    } : { x: 0, y: 0 }
    const start = { x: event.clientX, y: event.clientY, scrollLeft: elements.canvasScroll.scrollLeft, scrollTop: elements.canvasScroll.scrollTop }
    const action = { kind: 'drag', pointerId: event.pointerId, objects, origins, start, grabOffset, lastX: event.clientX, lastY: event.clientY }
    const update = current => {
      action.lastX = current.clientX
      action.lastY = current.clientY
      const deltaX = (current.clientX - start.x + elements.canvasScroll.scrollLeft - start.scrollLeft) / state.zoom
      const deltaY = (current.clientY - start.y + elements.canvasScroll.scrollTop - start.scrollTop) / state.zoom
      for (const object of objects) {
        const origin = origins.get(object.id)
        object.x = origin.x + deltaX
        object.y = origin.y + deltaY
        const node = elements.canvas.querySelector(`[data-id="${CSS.escape(object.id)}"]`)
        if (node) positionObjectNode(node, object)
      }
      markPageDropTarget(pageSurfaceAtPoint(current.clientX, current.clientY))
    }
    const finish = current => {
      const destination = pageSurfaceAtPoint(current.clientX, current.clientY)
      clearPageDragState()
      if (destination && objects.every(object => object.pageIndex === objects[0].pageIndex)) {
        const destinationIndex = Number(destination.dataset.pageIndex)
        if (destinationIndex !== objects[0].pageIndex) {
          moveSelectionToPage(destinationIndex, current.clientX, current.clientY, objects, grabOffset)
          showToast(`Перенесено на страницу ${destinationIndex + 1}`)
        }
      }
      for (const group of groupedByPage(objects).values()) {
        const shift = clampGroupShift(group, 0, 0)
        for (const object of group) { object.x += shift.x; object.y += shift.y }
      }
      snapObjectGroups(objects)
      renderDocument()
      scheduleSave()
    }
    const cancel = () => {
      clearPageDragState()
      for (const object of objects) Object.assign(object, origins.get(object.id))
      state.history.length = historyLength
      refreshUndoButtons()
      renderDocument()
    }
    startPointerAction(event, handle, action, { move: update, commit: finish, cancel })
  }

  function clearPageDropTarget() {
    for (const surface of elements.canvas.querySelectorAll('.studio-page.is-drag-target')) surface.classList.remove('is-drag-target')
  }

  function clearPageDragState() {
    clearPageDropTarget()
    for (const surface of elements.canvas.querySelectorAll('.studio-page.is-drag-source')) surface.classList.remove('is-drag-source')
    for (const shell of elements.canvas.querySelectorAll('.studio-page-shell.is-drag-source-shell')) shell.classList.remove('is-drag-source-shell')
    elements.canvas.classList.remove('is-object-dragging')
  }

  function markPageDropTarget(surface) {
    for (const candidate of elements.canvas.querySelectorAll('.studio-page')) candidate.classList.toggle('is-drag-target', candidate === surface)
  }

  function pageSurfaceAtPoint(clientX, clientY) {
    const surfaces = [...elements.canvas.querySelectorAll('.studio-page:not(.studio-page--segments)')]
    let nearest = null
    let nearestDistance = Infinity
    for (const surface of surfaces) {
      const rect = surface.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) return surface
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right)
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom)
      const distance = Math.hypot(dx, dy)
      if (distance < nearestDistance) { nearest = surface; nearestDistance = distance }
    }
    return nearestDistance <= 96 ? nearest : null
  }

  function moveSelectionToPage(pageIndex, clientX, clientY, objects, grabOffset = { x: 0, y: 0 }) {
    const destination = elements.canvas.querySelector(`.studio-page[data-page-index="${pageIndex}"]`)
    if (!destination) return
    const rect = destination.getBoundingClientRect()
    const left = Math.min(...objects.map(object => object.x))
    const top = Math.min(...objects.map(object => object.y))
    const anchorX = (clientX - rect.left) / state.zoom - grabOffset.x
    const anchorY = (clientY - rect.top) / state.zoom - grabOffset.y
    for (const object of objects) {
      const offsetX = object.x - left
      const offsetY = object.y - top
      object.pageIndex = pageIndex
      object.x = anchorX + offsetX
      object.y = anchorY + offsetY
    }
    const shift = clampGroupShift(objects, 0, 0)
    for (const object of objects) { object.x += shift.x; object.y += shift.y }
    state.activePage = pageIndex
  }

  function beginResize(event, id) {
    if (event.button !== 0) return
    cancelPointerAction()
    event.preventDefault()
    event.stopPropagation()
    const object = state.scene.objects.find(item => item.id === id)
    if (!object) return
    state.selected.delete(id)
    state.selected.add(id)
    refreshSelection()
    const handle = event.currentTarget
    const historyLength = state.history.length
    checkpoint()
    const start = { x: event.clientX, y: event.clientY, width: object.width, height: object.height, xPosition: object.x, yPosition: object.y }
    const action = { kind: 'resize', pointerId: event.pointerId, object, start }
    const update = current => {
      const page = state.scene.pages[object.pageIndex]
      const area = page.contentBounds
      object.width = Math.min(area.x + area.width - object.x, Math.max(12, start.width + (current.clientX - start.x) / state.zoom))
      object.height = constrainObjectHeight(object, start.height + (current.clientY - start.y) / state.zoom, object.width)
      const node = elements.canvas.querySelector(`[data-id="${CSS.escape(id)}"]`)
      if (node) positionObjectNode(node, object)
    }
    const finish = () => { refreshSelection(); scheduleSave() }
    const cancel = () => {
      Object.assign(object, { x: start.xPosition, y: start.yPosition, width: start.width, height: start.height })
      state.history.length = historyLength
      refreshUndoButtons()
      const node = elements.canvas.querySelector(`[data-id="${CSS.escape(id)}"]`)
      if (node) positionObjectNode(node, object)
    }
    startPointerAction(event, handle, action, { move: update, commit: finish, cancel })
  }

  function checkpoint() {
    if (!state.scene) return
    state.history.push(createHistorySnapshot())
    if (state.history.length > 60) state.history.shift()
    state.future = []
    refreshUndoButtons()
  }

  function createHistorySnapshot() {
    return {
      scene: JSON.stringify(state.scene),
      selectedIds: [...state.selected],
      translationSelectedIds: [...state.translationSelected],
      activePage: state.activePage,
      lastTextSelection: state.lastTextSelection ? { ...state.lastTextSelection } : null,
    }
  }

  function restoreHistorySnapshot(snapshot) {
    const normalized = typeof snapshot === 'string' ? { scene: snapshot } : snapshot
    state.scene = JSON.parse(normalized.scene)
    const objectIds = new Set(state.scene.objects.map(object => object.id))
    const selectedIds = Array.isArray(normalized.selectedIds) ? normalized.selectedIds : [...state.selected]
    const translationSelectedIds = Array.isArray(normalized.translationSelectedIds)
      ? normalized.translationSelectedIds
      : [...state.translationSelected]
    state.selected = new Set(selectedIds.filter(id => objectIds.has(id)))
    state.translationSelected = new Set(translationSelectedIds.filter(id => objectIds.has(id)))
    state.lastTextSelection = normalized.lastTextSelection && objectIds.has(normalized.lastTextSelection.objectId)
      ? { ...normalized.lastTextSelection }
      : null
    const primary = primarySelectedObject()
    const requestedPage = Number(normalized.activePage)
    state.activePage = primary?.pageIndex
      ?? (Number.isInteger(requestedPage) && state.scene.pages[requestedPage]
        ? requestedPage
        : Math.max(0, Math.min(state.activePage, state.scene.pages.length - 1)))
  }

  function undo() {
    cancelPointerAction()
    if (!state.history.length) return
    state.future.push(createHistorySnapshot())
    restoreHistorySnapshot(state.history.pop())
    renderDocument()
    refreshUndoButtons()
    scheduleSave()
  }

  function redo() {
    cancelPointerAction()
    if (!state.future.length) return
    state.history.push(createHistorySnapshot())
    restoreHistorySnapshot(state.future.pop())
    renderDocument()
    refreshUndoButtons()
    scheduleSave()
  }

  function refreshUndoButtons() {
    elements.undo.disabled = !state.history.length
    elements.redo.disabled = !state.future.length
  }

  async function saveScene(immediate = false) {
    clearTimeout(state.saveTimer)
    state.saveTimer = null
    if (!state.scene || !state.metadata) return
    try {
      const response = await api(`/api/studio/documents/${state.metadata.id}/scene`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.scene),
      })
      const data = await response.json()
      state.metadata = data.metadata
      const activeTab = state.tabs.get(state.activeTabKey)
      if (activeTab?.status === 'completed') activeTab.documentData = { metadata: state.metadata, scene: state.scene }
      elements.documentStatus.textContent = `${state.scene.pages.length} стр. · ${state.scene.objects.filter(item => !item.excluded).length} в сборке · изменения сохранены`
    } catch (error) {
      showToast(`Не удалось сохранить: ${error.message}`, true)
      if (immediate) throw error
    }
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer)
    state.saveTimer = setTimeout(saveScene, 650)
  }

  async function runAgent(endpoint, busyText) {
    if (!state.scene) return
    elements.agentStatus.textContent = busyText
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/agent/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectIds: [...state.selected] }),
      })
      const data = await response.json()
      state.scene = data.scene
      renderDocument()
      const report = data.report
      elements.agentStatus.textContent = `Готово: ${report.counts.errors} ошибок, ${report.counts.warnings} предупреждений.`
      showToast('Агент завершил проверку структуры')
    } catch (error) {
      elements.agentStatus.textContent = 'Операция не выполнена.'
      showToast(error.message, true)
    }
  }

  async function reanalyzeSource() {
    if (!state.scene || !window.confirm('Повторный анализ заменит текущую сегментацию и ручные изменения. Продолжить?')) return
    try {
      await saveScene(true)
      setView('loading')
      elements.loadingMessage.textContent = 'Повторно анализируем сохранённые страницы агентом…'
      const response = await api(`/api/studio/documents/${state.metadata.id}/agent/reanalyze`, { method: 'POST' })
      const documentData = await response.json()
      openDocument(documentData)
      showToast(`Повторный анализ завершён: ${documentData.scene.objects.length} сегментов`)
    } catch (error) {
      setView('studio')
      showToast(error.message, true)
    }
  }

  async function translateSelection() {
    if (!state.scene) return
    refreshTranslationSelectionControls()
    const objectIds = [...state.translationSelected]
    if (!objectIds.length) return showToast('Отметьте сегменты для перевода', true)
    elements.translate.disabled = true
    elements.translate.textContent = `Переводим ${objectIds.length}…`
    elements.agentStatus.textContent = `Ищем совпадения в БЗ и переводим сегменты: ${objectIds.length}…`
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectIds }),
      })
      const data = await response.json()
      checkpoint()
      state.scene = data.scene
      const translatedObjects = state.scene.objects.filter(object => objectIds.includes(object.id))
      renderDocumentWithContentFit(translatedObjects)
      scheduleSave()
      elements.agentStatus.textContent = data.message
      showToast(data.message, data.pending.length > 0 && !data.translated.length && !data.suggested?.length)
    } catch (error) {
      elements.agentStatus.textContent = 'Перевод не выполнен.'
      showToast(error.message, true)
    } finally {
      refreshTranslationSelectionControls()
    }
  }

  async function reviseTranslations(requestedIds = [], scope = 'selection', trigger = null) {
    if (!state.scene || !state.metadata) return
    const objectIds = scope === 'document' ? [] : requestedIds
    const requested = new Set(objectIds)
    const hasSegmentInstruction = state.scene.objects.some(object => (
      String(object.translationInstruction || '').trim() && (scope === 'document' || requested.has(object.id))
    ))
    const globalInstruction = String(elements.globalTranslationInstruction.value || '').trim()
    if (!globalInstruction && !hasSegmentInstruction) {
      return showToast('Добавьте общий комментарий или комментарий к сегменту', true)
    }
    state.scene.globalTranslationInstruction = globalInstruction
    const previousLabel = trigger?.textContent
    if (trigger) {
      trigger.disabled = true
      trigger.textContent = 'Исправляем…'
    }
    elements.reviseSelected.disabled = true
    elements.reviseDocument.disabled = true
    elements.agentStatus.textContent = scope === 'document'
      ? 'ИИ исправляет перевод всего документа по комментариям…'
      : `ИИ исправляет выбранные сегменты: ${objectIds.length}…`
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/translate/revise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectIds, scope, globalInstruction }),
      })
      const data = await response.json()
      checkpoint()
      state.scene = data.scene
      const revisedObjects = scope === 'document'
        ? allFormattingObjects()
        : state.scene.objects.filter(object => objectIds.includes(object.id))
      renderDocumentWithContentFit(revisedObjects)
      scheduleSave()
      elements.agentStatus.textContent = data.message
      showToast(data.message)
    } catch (error) {
      if (trigger) {
        trigger.disabled = false
        trigger.textContent = previousLabel
      }
      elements.agentStatus.textContent = 'Корректировка по комментариям не выполнена.'
      showToast(error.message, true)
    } finally {
      refreshTranslationSelectionControls()
    }
  }

  function renderLayoutReviewStatus() {
    if (!state.metadata) return
    const job = state.layoutReviewJobs.get(state.metadata.id)
    const pending = job && ['queued', 'running'].includes(job.status)
    elements.layoutReview.disabled = Boolean(pending)
    elements.layoutReviewCancel.hidden = !pending
    elements.layoutReviewCancel.disabled = false
    elements.layoutReviewStatus.classList.toggle('is-error', job?.status === 'failed')
    if (job) {
      const pageDetail = Number.isFinite(Number(job.details?.totalPages))
        ? ` · страниц ${Number(job.details?.processedPages) || 0}/${Number(job.details.totalPages)}`
        : ''
      elements.layoutReviewStatus.textContent = job.error || `${job.message || 'Сравнение макета'} · ${job.progress || 0}%${pageDetail}`
      return
    }
    const review = state.scene?.layoutReview
    if (!review?.reviewedAt) {
      elements.layoutReviewStatus.textContent = 'Сравнение с оригиналом ещё не запускалось.'
      return
    }
    const similarities = review.pageSimilarities || []
    const average = similarities.length ? Math.round(similarities.reduce((sum, item) => sum + Number(item.similarity || 0), 0) / similarities.length * 100) : null
    elements.layoutReviewStatus.textContent = `Последняя AI-проверка: ${average == null ? 'готово' : `сходство ${average}%`} · применено ${review.applied?.length || 0} · рекомендаций ${review.recommendations?.length || 0}`
  }

  async function startLayoutReview() {
    if (!state.metadata || state.layoutReviewJobs.has(state.metadata.id) && ['queued', 'running'].includes(state.layoutReviewJobs.get(state.metadata.id).status)) return
    elements.layoutReview.disabled = true
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/agent/layout-review`, { method: 'POST' })
      const { job } = await response.json()
      state.layoutReviewJobs.set(state.metadata.id, job)
      renderLayoutReviewStatus()
      scheduleJobsPoll(100)
      showToast('AI-сравнение макета запущено')
    } catch (error) {
      elements.layoutReview.disabled = false
      showToast(error.message, true)
    }
  }

  async function cancelLayoutReview() {
    const documentId = state.metadata?.id
    const job = documentId ? state.layoutReviewJobs.get(documentId) : null
    if (!job || !['queued', 'running'].includes(job.status)) return
    elements.layoutReviewCancel.disabled = true
    try {
      const response = await api(`/api/studio/jobs/${job.id}/cancel`, { method: 'POST' })
      const { job: updated } = await response.json()
      state.layoutReviewJobs.set(documentId, updated)
      renderLayoutReviewStatus()
      scheduleJobsPoll(100)
    } catch (error) {
      elements.layoutReviewCancel.disabled = false
      showToast(error.message, true)
    }
  }

  async function runQa() {
    if (!state.scene) return
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/qa`)
      showQa(await response.json())
    } catch (error) { showToast(error.message, true) }
  }

  function showQa(report) {
    elements.qaPanel.hidden = false
    elements.qaTitle.textContent = 'Проверка документа'
    elements.qaActions.replaceChildren()
    elements.qaSummary.innerHTML = `
      <div><strong>${report.counts.errors}</strong><span>ошибок</span></div>
      <div><strong>${report.counts.warnings}</strong><span>предупреждений</span></div>
      <div><strong>${report.counts.translated}/${report.counts.objects}</strong><span>готово</span></div>`
    elements.qaList.replaceChildren()
    if (!report.warnings.length) {
      const item = document.createElement('div')
      item.className = 'qa-item'
      item.textContent = 'Критичных проблем не найдено. Можно выгружать документ.'
      elements.qaList.append(item)
      return
    }
    for (const warning of report.warnings) {
      const item = document.createElement('button')
      item.className = 'qa-item'
      item.dataset.severity = warning.severity
      item.type = 'button'
      item.textContent = warning.message
      const details = document.createElement('small')
      details.textContent = warning.objectIds.join(', ')
      item.append(details)
      item.addEventListener('click', () => {
        state.selected = new Set(warning.objectIds)
        const object = selectedObjects()[0]
        if (object) focusPage(object.pageIndex, object.id)
        refreshSelection()
      })
      elements.qaList.append(item)
    }
  }

  async function findMemory() {
    const object = selectedObjects()[0]
    if (!object) return
    const units = ensureObjectTranslationUnits(object)
    const activeUnit = units.find(unit => !unit.translation) || units[0]
    if (!activeUnit) return
    elements.memoryResults.innerHTML = '<small>Ищем…</small>'
    try {
      const parameters = new URLSearchParams({
        query: activeUnit.sourceText,
        sourceLanguage: state.scene.sourceLanguage,
        targetLanguage: state.scene.targetLanguage,
        glossaryId: state.scene.glossaryId || '',
      })
      const response = await api(`/api/studio/knowledge-base/search?${parameters}`)
      const data = await response.json()
      elements.memoryResults.replaceChildren()
      if (!data.matches.length) {
        elements.memoryResults.innerHTML = '<small>Похожих утверждённых переводов пока нет.</small>'
        return
      }
      for (const match of data.matches) {
        const button = document.createElement('button')
        button.className = 'memory-result'
        button.type = 'button'
        button.innerHTML = `<span>${escapeHtml(match.translation)}</span><small>${match.matchType === 'exact' ? 'Точное совпадение' : 'Векторная близость'} ${Math.round(match.score * 100)}%</small>`
        button.addEventListener('click', () => {
          checkpoint()
          activeUnit.translation = match.translation
          activeUnit.memoryEntryId = match.id
          activeUnit.memorySuggestion = null
          activeUnit.status = match.matchType === 'exact' ? 'memory-applied' : 'edited'
          activeUnit.activeTranslationSource = match.matchType === 'exact' ? 'memory' : 'manual'
          translationUnits.syncObjectTranslation(object)
          object.translationTextStyles = []
          renderDocumentWithContentFit([object])
          scheduleSave()
        })
        elements.memoryResults.append(button)
      }
    } catch (error) { elements.memoryResults.innerHTML = `<small>${escapeHtml(error.message)}</small>` }
  }

  async function approveTranslation() {
    const objects = selectedObjects().filter(object => isTranslatableType(object.type))
    const unitsByObject = objects.map(object => ({ object, units: ensureObjectTranslationUnits(object).filter(unit => unit.sourceText.trim() && unit.translation.trim()) }))
    const count = unitsByObject.reduce((sum, item) => sum + item.units.length, 0)
    if (!count) return showToast('Введите перевод хотя бы для одной переводческой единицы', true)
    try {
      const results = await Promise.all(unitsByObject.map(item => saveUnitsToKnowledgeBase(item.object, item.units)))
      for (const { object } of unitsByObject) {
        if (object.translationUnits.every(unit => unit.memoryEntryId)) object.status = 'approved'
      }
      scheduleSave()
      renderTranslationUnits(selectedObjects())
      const created = results.reduce((sum, result) => sum + result.created, 0)
      const conflicts = results.flatMap(result => result.results || []).filter(item => item.status === 'conflict').length
      showToast(`Новых записей в БЗ: ${created}. Уже существовали: ${count - created - conflicts}.${conflicts ? ` Конфликтов: ${conflicts}.` : ''}`, conflicts > 0)
    } catch (error) { showToast(error.message, true) }
  }

  function splitInternalBySentences() {
    const object = selectedObjects()[0]
    if (selectedObjects().length !== 1 || !isTranslatableType(object?.type)) return
    const current = ensureObjectTranslationUnits(object)
    if (current.some(unit => unit.translation.trim()) && !window.confirm('При новом разбиении несопоставленные переводы частей будут очищены. Продолжить?')) return
    checkpoint()
    const units = translationUnits.splitBySentences(object, state.scene.sourceLanguage)
    renderDocument()
    scheduleSave()
    showToast(units.length > 1 ? `Создано внутренних единиц: ${units.length}` : 'Текст не удалось разделить на отдельные предложения')
  }

  function splitInternalBySelection() {
    const object = selectedObjects()[0]
    if (selectedObjects().length !== 1 || !isTranslatableType(object?.type)) return
    const start = elements.sourceText.selectionStart
    const end = elements.sourceText.selectionEnd
    const hasSelection = Number.isInteger(end) && end > start
    const validSelection = hasSelection && !(start === 0 && end === object.sourceText.length)
    const selectedTerm = validSelection ? object.sourceText.slice(start, end).trim() : ''
    if (!selectedTerm) {
      return showToast('Выделите слово или фразу в поле «Распознанный исходник»', true)
    }
    const current = ensureObjectTranslationUnits(object)
    if (current.some(unit => unit.translation.trim()) && !window.confirm('При новом разбиении несопоставленные переводы частей будут очищены. Продолжить?')) return
    checkpoint()
    const units = translationUnits.splitAtRange(object, start, end)
    const selectedUnit = units.find(unit => translationUnits.canonicalText(unit.sourceText) === translationUnits.canonicalText(selectedTerm))
    state.focusedTranslationUnitId = selectedUnit?.id || null
    renderDocument()
    scheduleSave()
    requestAnimationFrame(() => {
      const row = state.focusedTranslationUnitId
        ? elements.translationUnitsList.querySelector(`[data-unit-id="${CSS.escape(state.focusedTranslationUnitId)}"]`)
        : null
      row?.scrollIntoView({ block: 'nearest' })
      row?.querySelector('textarea')?.focus()
    })
    showToast(`«${selectedTerm}» выделено отдельно. Введите перевод и сохраните эту пару в БЗ.`)
  }

  function mergeInternalUnits() {
    const object = selectedObjects()[0]
    if (selectedObjects().length !== 1 || !isTranslatableType(object?.type)) return
    const units = ensureObjectTranslationUnits(object)
    if (units.length < 2) return
    checkpoint()
    object.translation = translationUnits.translationFromUnits(units, false)
    translationUnits.mergeTranslationUnits(object)
    object.translationTextStyles = []
    renderDocumentWithContentFit([object])
    scheduleSave()
    showToast('Внутренние единицы объединены; геометрия сегмента сохранена')
  }

  function applyAllExactSuggestions() {
    const object = selectedObjects()[0]
    if (selectedObjects().length !== 1 || !object) return
    const units = ensureObjectTranslationUnits(object)
    checkpoint()
    const count = units.filter(unit => applyExactSuggestion(object, unit)).length
    renderDocumentWithContentFit([object])
    scheduleSave()
    if (count) showToast(`Применено 100% совпадений: ${count}`)
  }

  function mergeStyledField(objects, field) {
    const styleField = field === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'
    let text = ''
    const ranges = []
    for (const object of objects) {
      const value = String(object[field] || '')
      if (!value) continue
      if (text) text += '\n'
      const offset = text.length
      text += value
      for (const range of object[styleField] || []) ranges.push({ ...range, start: range.start + offset, end: range.end + offset })
    }
    return { text, ranges }
  }

  function mergeSelected() {
    const objects = selectedObjects().sort((left, right) => left.y - right.y || left.x - right.x)
    if (objects.length < 2 || new Set(objects.map(item => item.pageIndex)).size !== 1) return
    checkpoint()
    const first = objects[0]
    const right = Math.max(...objects.map(item => item.x + item.width))
    const bottom = Math.max(...objects.map(item => item.y + item.height))
    const source = mergeStyledField(objects, 'sourceText')
    const translation = mergeStyledField(objects, 'translation')
    first.x = Math.min(...objects.map(item => item.x))
    first.y = Math.min(...objects.map(item => item.y))
    first.width = right - first.x
    first.height = bottom - first.y
    first.sourceText = source.text
    first.sourceTextStyles = source.ranges
    first.translation = translation.text
    first.translationTextStyles = translation.ranges
    first.translationUnits = []
    ensureObjectTranslationUnits(first)
    first.type = 'text'
    first.originalBounds = { x: first.x, y: first.y, width: first.width, height: first.height }
    const removed = new Set(objects.slice(1).map(item => item.id))
    state.scene.objects = state.scene.objects.filter(item => !removed.has(item.id))
    state.selected = new Set([first.id])
    renderDocument()
    scheduleSave()
  }

  function insertBlankPage(afterPageIndex) {
    if (!state.scene) return
    const reference = state.scene.pages[afterPageIndex]
    if (!reference) return
    cancelPointerAction()
    checkpoint()
    const insertIndex = afterPageIndex + 1
    const blankPage = {
      index: insertIndex,
      sourcePageIndex: null,
      isAdded: true,
      widthPx: reference.widthPx,
      heightPx: reference.heightPx,
      sourceWidth: reference.sourceWidth || reference.widthPx,
      sourceHeight: reference.sourceHeight || reference.heightPx,
      imageUrl: null,
      sourceFrame: { x: 0, y: 0, width: reference.widthPx, height: reference.heightPx },
      contentBounds: { ...reference.contentBounds },
      languages: [],
      recognitionStats: { manualPage: true },
    }
    state.scene.pages.splice(insertIndex, 0, blankPage)
    for (const object of state.scene.objects) {
      if (object.pageIndex >= insertIndex) object.pageIndex += 1
    }
    reindexScenePages()
    state.activePage = insertIndex
    state.sourceRenderedPage = null
    renderDocument()
    scheduleSave()
    requestAnimationFrame(() => focusPage(insertIndex))
    showToast(`Добавлена пустая страница ${insertIndex + 1}`)
  }

  function removeEmptyPage(pageIndex) {
    if (!state.scene?.pages?.[pageIndex]) return
    if (state.scene.pages.length <= 1) return showToast('В документе должна остаться хотя бы одна страница', true)
    if (!isScenePageEmpty(pageIndex)) return showToast('Страница не пустая. Сначала перенесите или удалите её сегменты.', true)
    cancelPointerAction()
    checkpoint()
    state.scene.pages.splice(pageIndex, 1)
    const remainingCount = state.scene.pages.length
    for (const object of state.scene.objects) {
      if (object.pageIndex > pageIndex) object.pageIndex -= 1
      else if (object.pageIndex === pageIndex) object.pageIndex = Math.min(pageIndex, remainingCount - 1)
    }
    reindexScenePages()
    state.activePage = Math.min(state.activePage > pageIndex ? state.activePage - 1 : state.activePage, remainingCount - 1)
    state.selected = new Set([...state.selected].filter(id => state.scene.objects.some(object => object.id === id && !object.excluded)))
    state.sourceRenderedPage = null
    renderDocument()
    scheduleSave()
    requestAnimationFrame(() => focusPage(state.activePage))
    showToast(`Удалена пустая страница ${pageIndex + 1}`)
  }

  function addObject(options = {}) {
    if (!state.scene) return
    checkpoint()
    const requestedPage = Number.isInteger(options.pageIndex) ? options.pageIndex : state.activePage
    const page = state.scene.pages[requestedPage] || state.scene.pages[0]
    const sourceText = typeof options.sourceText === 'string' ? options.sourceText : ''
    const id = `manual-${Date.now().toString(36)}`
    state.scene.objects.push({
      id, pageIndex: page.index, type: 'text', readingOrder: state.scene.objects.length + 1,
      sourceText, translation: '', confidence: 1,
      sourceTextStyles: [], translationTextStyles: [],
      x: page.contentBounds.x, y: page.contentBounds.y, width: Math.min(280, page.contentBounds.width), height: 42, rotation: 0,
      excluded: false, status: 'manual', sourceLineIds: [],
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      originalBounds: { x: page.contentBounds.x, y: page.contentBounds.y, width: Math.min(280, page.contentBounds.width), height: 42 },
    })
    state.activePage = page.index
    state.selected = new Set([id])
    renderDocument()
    scheduleSave()
    return id
  }

  function clippedRanges(ranges, start, end, offset = 0) {
    return (ranges || []).map(range => ({
      ...range,
      start: Math.max(start, range.start) - offset,
      end: Math.min(end, range.end) - offset,
    })).filter(range => range.end > range.start)
  }

  function rangesAfterRemoval(ranges, start, end) {
    const removed = end - start
    const result = []
    for (const range of ranges || []) {
      if (range.end <= start) result.push({ ...range })
      else if (range.start >= end) result.push({ ...range, start: range.start - removed, end: range.end - removed })
      else {
        if (range.start < start) result.push({ ...range, end: start })
        if (range.end > end) result.push({ ...range, start, end: range.end - removed })
      }
    }
    return result.filter(range => range.end > range.start)
  }

  function splitSelectedText() {
    const objects = selectedObjects()
    if (objects.length !== 1) return showToast('Для разделения выберите один сегмент', true)
    const object = objects[0]
    const selection = state.lastTextSelection
    if (!selection || selection.objectId !== object.id) return showToast('Поставьте курсор или выделите текст внутри сегмента', true)
    const field = selection.field || objectOutputField(object)
    const styleField = field === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'
    const text = String(object[field] || '')
    const start = Math.max(0, Math.min(text.length, selection.start))
    const end = Math.max(start, Math.min(text.length, selection.end))
    if (start === 0 && end === 0) return showToast('Разделение в начале сегмента не требуется', true)
    if (start === text.length && end === text.length) return showToast('Разделение в конце сегмента не требуется', true)
    checkpoint()
    const extractedEnd = end > start ? end : text.length
    const extractedText = text.slice(start, extractedEnd)
    const originalRanges = [...styleRanges(object, field)]
    object[field] = text.slice(0, start) + (end > start ? text.slice(end) : '')
    object[styleField] = end > start
      ? rangesAfterRemoval(originalRanges, start, end)
      : clippedRanges(originalRanges, 0, start)

    const page = state.scene.pages[object.pageIndex]
    const id = `manual-${Date.now().toString(36)}`
    const next = JSON.parse(JSON.stringify(object))
    next.id = id
    next.readingOrder = state.scene.objects.length + 1
    next.sourceLineIds = []
    next.confidence = 1
    next.status = 'manual-split'
    next.sourceText = field === 'sourceText' ? extractedText : ''
    next.translation = field === 'translation' ? extractedText : ''
    next.sourceTextStyles = field === 'sourceText' ? clippedRanges(originalRanges, start, extractedEnd, start) : []
    next.translationTextStyles = field === 'translation' ? clippedRanges(originalRanges, start, extractedEnd, start) : []
    object.translationUnits = []
    next.translationUnits = []
    ensureObjectTranslationUnits(object)
    ensureObjectTranslationUnits(next)
    const below = object.y + object.height + 8
    next.y = below + next.height <= page.heightPx ? below : Math.max(0, object.y - next.height - 8)
    next.originalBounds = { x: next.x, y: next.y, width: next.width, height: next.height }
    state.scene.objects.push(next)
    state.selected = new Set([id])
    state.lastTextSelection = null
    renderDocument()
    scheduleSave()
    showToast(end > start ? 'Выделенный текст перенесён в новый сегмент' : 'Сегмент разделён по позиции курсора')
  }

  function selectedTextRange() {
    const object = primarySelectedObject()
    if (!object) return null
    const liveContent = [...elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"] .scene-object__content`)]
      .find(content => getTextSelection(content, object.id))
    const liveRange = liveContent ? getTextSelection(liveContent, object.id) : null
    const range = liveRange && liveRange.end > liveRange.start ? liveRange : state.lastTextSelection
    if (!range || range.objectId !== object.id || range.end <= range.start) return null
    const field = range.field || objectOutputField(object)
    const text = String(object[field] || '')
    return { object, field, start: Math.max(0, Math.min(text.length, range.start)), end: Math.max(0, Math.min(text.length, range.end)) }
  }

  function allFormattingObjects() {
    return (state.scene?.objects || []).filter(canFitObjectToText)
  }

  function refreshFormattingSelectionToggle() {
    const objects = allFormattingObjects()
    const allSelected = objects.length > 0 && objects.every(object => state.selected.has(object.id))
    elements.typographySelectAll.disabled = objects.length === 0
    elements.typographySelectAll.classList.toggle('is-active', allSelected)
    elements.typographySelectAll.setAttribute('aria-pressed', String(allSelected))
    elements.typographySelectAll.textContent = allSelected ? 'Снять выбор со всех' : 'Выбрать все сегменты'
    elements.typographySelectAll.title = allSelected ? 'Снять выбор со всех сегментов' : 'Выбрать все сегменты'
  }

  function selectAllFormattingSegments() {
    const objects = allFormattingObjects()
    if (!objects.length) return showToast('В документе нет сегментов для форматирования', true)
    const allSelected = objects.every(object => state.selected.has(object.id))
    if (allSelected) {
      state.selected.clear()
      state.lastTextSelection = null
      refreshSelection()
      showToast('Выбор со всех сегментов снят')
      return
    }
    const primaryId = primarySelectedObject()?.id
    const ids = objects.map(object => object.id).filter(id => id !== primaryId)
    if (primaryId && objects.some(object => object.id === primaryId)) ids.push(primaryId)
    state.selected = new Set(ids)
    state.lastTextSelection = null
    refreshSelection()
    showToast(`Выбрано сегментов: ${objects.length}`)
  }

  function formattingTargetObjects() {
    const selected = selectedObjects().filter(canFitObjectToText)
    if (elements.formatAllSegments?.checked) return selected
    const primary = primarySelectedObject()
    return primary && canFitObjectToText(primary) ? [primary] : []
  }

  function clampFontSize(value) {
    return Math.min(80, Math.max(10, Math.round(Number(value) || 10)))
  }

  function clampLineHeight(value) {
    const clamped = Math.min(3, Math.max(.8, Number(value) || 1.2))
    return Math.round(clamped * 20) / 20
  }

  function updateNumberStepperState(input, hasMixedValues, label, mixedDescription) {
    input.placeholder = hasMixedValues ? '≠' : ''
    input.title = hasMixedValues ? mixedDescription : label
    input.setAttribute('aria-label', hasMixedValues ? mixedDescription : label)
    input.dataset.mixed = String(hasMixedValues)
    input.closest('.number-stepper__field')?.classList.toggle('is-mixed', hasMixedValues)
  }

  function refreshNumberStepperDraft(input) {
    const showMixedValue = input.dataset.mixed === 'true' && input.value === ''
    input.closest('.number-stepper__field')?.classList.toggle('is-mixed', showMixedValue)
  }

  function activeFontSizes() {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const selection = applyAll ? null : selectedTextRange()
    if (selection) {
      const effective = effectiveTextStyle(selection.object, selection.field, selection.start)
      return [clampFontSize(effective.fontSizePx ?? selection.object.style.fontSizePx)]
    }
    return formattingTargetObjects().map(object => clampFontSize(object.style.fontSizePx))
  }

  function activeFormattingValues(property) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const selection = applyAll ? null : selectedTextRange()
    if (selection) {
      const effective = effectiveTextStyle(selection.object, selection.field, selection.start)
      return [effective[property] ?? selection.object.style[property]]
    }
    return formattingTargetObjects().map(object => object.style[property])
  }

  function normalizeTextColor(value, fallback = '#000000') {
    const text = String(value || '').trim()
    const shortHex = text.match(/^#([0-9a-f]{3})$/i)
    if (shortHex) return `#${[...shortHex[1]].map(character => character.repeat(2)).join('')}`.toUpperCase()
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toUpperCase()
    const rgb = text.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (!rgb) return fallback
    return `#${rgb.slice(1, 4).map(channel => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
  }

  function refreshFormattingToolbar() {
    const objects = formattingTargetObjects()
    document.querySelectorAll('.format-button').forEach(button => {
      const action = button.dataset.format
      const active = objects.length > 0 && (action === 'bold' ? objects.every(item => item.style.fontWeight >= 600)
        : action === 'italic' ? objects.every(item => item.style.fontStyle === 'italic')
          : objects.every(item => item.style.textAlign === action))
      button.classList.toggle('is-active', active)
    })
    const fontSizes = activeFontSizes()
    const hasSizes = fontSizes.length > 0
    const uniformSize = hasSizes && fontSizes.every(value => value === fontSizes[0]) ? fontSizes[0] : null
    const hasMixedSizes = hasSizes && uniformSize == null
    elements.toolbarFontSizeValue.value = uniformSize == null ? (hasSizes ? '' : '12') : String(uniformSize)
    updateNumberStepperState(elements.toolbarFontSizeValue, hasMixedSizes, 'Размер шрифта, px', 'У выбранных сегментов разные размеры шрифта')
    elements.toolbarFontSizeDecrease.disabled = !hasSizes || fontSizes.every(value => value <= 10)
    elements.toolbarFontSizeIncrease.disabled = !hasSizes || fontSizes.every(value => value >= 80)
    const fontFamilies = activeFormattingValues('fontFamily').filter(Boolean)
    const uniformFont = fontFamilies.length && fontFamilies.every(value => value === fontFamilies[0]) ? fontFamilies[0] : ''
    elements.toolbarFontFamily.value = fontFamilies.length ? uniformFont : 'Arial'
    elements.toolbarFontFamily.disabled = !fontFamilies.length
    const colors = activeFormattingValues('color').filter(Boolean).map(value => normalizeTextColor(value))
    const uniformColor = colors.length && colors.every(value => value === colors[0]) ? colors[0] : null
    const picker = elements.toolbarTextColor.closest('.color-picker')
    elements.toolbarTextColor.disabled = !colors.length
    elements.toolbarTextColor.value = uniformColor || '#000000'
    picker?.style.setProperty('--color-picker-value', uniformColor || '#000000')
    picker?.classList.toggle('is-mixed', colors.length > 0 && !uniformColor)
    const lineHeights = objects.map(object => clampLineHeight(object.style.lineHeight))
    const hasLineHeights = lineHeights.length > 0
    const uniformLineHeight = hasLineHeights && lineHeights.every(value => value === lineHeights[0]) ? lineHeights[0] : null
    const hasMixedLineHeights = hasLineHeights && uniformLineHeight == null
    elements.lineHeight.value = uniformLineHeight == null ? (hasLineHeights ? '' : '1.2') : String(uniformLineHeight)
    elements.lineHeight.disabled = !hasLineHeights
    elements.lineHeightDecrease.disabled = !hasLineHeights || lineHeights.every(value => value <= .8)
    elements.lineHeightIncrease.disabled = !hasLineHeights || lineHeights.every(value => value >= 3)
    updateNumberStepperState(elements.lineHeight, hasMixedLineHeights, 'Высота строки', 'У выбранных сегментов разная высота строки')
  }

  function setFormattingFontFamily(fontFamily) {
    const family = String(fontFamily || '').trim()
    if (!family) return refreshFormattingToolbar()
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    if (!applyAll && selectedTextRange()) {
      applySelectedTextStyle({ fontFamily: family })
      return
    }
    applySelectionChange(object => {
      object.style.fontFamily = family
      if (applyAll) removeInlineStyleProperties(object, ['fontFamily'])
    }, true, true, objects)
  }

  function setFormattingColor(color) {
    const normalized = normalizeTextColor(color)
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    if (!applyAll && selectedTextRange()) {
      applySelectedTextStyle({ color: normalized })
      return
    }
    applySelectionChange(object => {
      object.style.color = normalized
      if (applyAll) removeInlineStyleProperties(object, ['color'])
    }, true, false, objects)
  }

  function setFormattingFontSize(value) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    const size = clampFontSize(value)
    const selection = applyAll ? null : selectedTextRange()
    if (selection) {
      applySelectedTextStyle({ fontSizePx: size })
      return
    }
    applySelectionChange(object => {
      object.style.fontSizePx = size
      if (applyAll) removeInlineStyleProperties(object, ['fontSizePx'])
    }, true, true, objects)
  }

  function setFormattingLineHeight(value) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    const lineHeight = clampLineHeight(value)
    applySelectionChange(object => { object.style.lineHeight = lineHeight }, true, true, objects)
  }

  function changeFormattingLineHeight(delta) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    applySelectionChange(object => {
      object.style.lineHeight = clampLineHeight((Number(object.style.lineHeight) || 1.2) + delta)
    }, true, true, objects)
  }

  function changeFormattingFontSize(delta) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    const selection = applyAll ? null : selectedTextRange()
    if (selection) {
      const effective = effectiveTextStyle(selection.object, selection.field, selection.start)
      applySelectedTextStyle({ fontSizePx: clampFontSize((effective.fontSizePx ?? selection.object.style.fontSizePx) + delta) })
      return
    }
    applySelectionChange(object => {
      object.style.fontSizePx = clampFontSize(object.style.fontSizePx + delta)
      if (applyAll) removeInlineStyleProperties(object, ['fontSizePx'])
    }, true, true, objects)
  }

  function applySelectedTextStyle(patch) {
    const selection = selectedTextRange()
    if (!selection) return false
    checkpoint()
    styleRanges(selection.object, selection.field).push({ start: selection.start, end: selection.end, ...patch })
    renderDocumentWithContentFit([selection.object])
    scheduleSave()
    return true
  }

  function applyFormatting(action) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    const textSelection = applyAll ? null : selectedTextRange()
    if (textSelection && ['bold', 'italic'].includes(action)) {
      const current = effectiveTextStyle(textSelection.object, textSelection.field, textSelection.start)
      const patch = action === 'bold'
        ? { fontWeight: (current.fontWeight ?? textSelection.object.style.fontWeight) >= 600 ? 400 : 700 }
        : { fontStyle: (current.fontStyle ?? textSelection.object.style.fontStyle) === 'italic' ? 'normal' : 'italic' }
      applySelectedTextStyle(patch)
      return
    }
    const fontWeight = objects.every(object => object.style.fontWeight >= 600) ? 400 : 700
    const fontStyle = objects.every(object => object.style.fontStyle === 'italic') ? 'normal' : 'italic'
    applySelectionChange(object => {
      if (action === 'bold') object.style.fontWeight = fontWeight
      else if (action === 'italic') object.style.fontStyle = fontStyle
      else object.style.textAlign = action
      if (applyAll && action === 'bold') removeInlineStyleProperties(object, ['fontWeight'])
      if (applyAll && action === 'italic') removeInlineStyleProperties(object, ['fontStyle'])
    }, true, true, objects)
  }

  function resetPosition() {
    const objects = selectedObjects()
    if (!objects.length) return
    checkpoint()
    for (const object of objects) Object.assign(object, object.originalBounds)
    renderDocument()
    scheduleSave()
  }

  function excludeSelected() {
    const objects = selectedObjects()
    if (!objects.length) return
    checkpoint()
    for (const object of objects) object.excluded = true
    state.selected.clear()
    renderDocument()
    scheduleSave()
  }

  function applySelectionChange(callback, rerender = true, fitContent = false, explicitObjects = null) {
    const objects = explicitObjects || selectedObjects()
    if (!objects.length) return
    checkpoint()
    for (const object of objects) callback(object)
    if (rerender && fitContent) renderDocumentWithContentFit(objects)
    else if (rerender) renderDocument()
    else refreshSelection()
    scheduleSave()
  }

  function withoutInlineStyleProperties(ranges, properties) {
    return (Array.isArray(ranges) ? ranges : []).map(range => {
      const normalized = { ...range }
      for (const property of properties) delete normalized[property]
      return normalized
    }).filter(range => Object.keys(range).some(key => key !== 'start' && key !== 'end'))
  }

  function removeInlineStyleProperties(object, properties) {
    object.sourceTextStyles = withoutInlineStyleProperties(object.sourceTextStyles, properties)
    object.translationTextStyles = withoutInlineStyleProperties(object.translationTextStyles, properties)
  }

  async function exportDocument(format) {
    try {
      await saveScene(true)
      showToast(`Собираем ${format.toUpperCase()}…`)
      const response = await api(`/api/studio/documents/${state.metadata.id}/export`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format }),
      })
      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
      const fallback = `${state.scene.title}.${format}`
      const filename = encoded ? decodeURIComponent(encoded) : fallback
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 5_000)
      showToast(`${format.toUpperCase()} собран и проверен`)
    } catch (error) { showToast(error.message, true) }
  }

  function focusPage(pageIndex, objectId) {
    state.activePage = pageIndex
    for (const button of elements.thumbnails.querySelectorAll('.page-thumbnail')) button.classList.toggle('is-active', Number(button.dataset.pageIndex) === pageIndex)
    const page = elements.canvas.querySelector(`.studio-page-shell[data-page-index="${pageIndex}"]`)
    page?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    renderSourcePreview()
    if (objectId) setTimeout(() => elements.canvas.querySelector(`[data-id="${CSS.escape(objectId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 200)
  }

  function escapeHtml(value) {
    const node = document.createElement('span')
    node.textContent = String(value)
    return node.innerHTML
  }

  function bindInspector() {
    elements.objectType.addEventListener('change', () => applySelectionChange(object => {
      object.type = elements.objectType.value
      if (object.type === 'table_cell') {
        object.tableId ||= `manual-table-page-${object.pageIndex + 1}`
        object.rowIndex = Number.isInteger(object.rowIndex) ? object.rowIndex : 0
        object.columnIndex = Number.isInteger(object.columnIndex) ? object.columnIndex : 0
        object.rowSpan ||= 1
        object.columnSpan ||= 1
      }
      if (object.type === 'signature') {
        object.translation = servicePlaceholder(object.type, object.sourceText)
        object.translationUnits = []
      } else if (!object.translation) object.translation = servicePlaceholder(object.type, object.sourceText)
    }))
    elements.tableId.addEventListener('change', () => applySelectionChange(object => { if (object.type === 'table_cell') object.tableId = elements.tableId.value.trim() || `manual-table-page-${object.pageIndex + 1}` }))
    const tableNumbers = [
      [elements.tableRow, 'rowIndex', 0, 999],
      [elements.tableColumn, 'columnIndex', 0, 999],
      [elements.tableRowSpan, 'rowSpan', 1, 100],
      [elements.tableColumnSpan, 'columnSpan', 1, 100],
    ]
    for (const [control, field, minimum, maximum] of tableNumbers) {
      control.addEventListener('change', () => {
        const value = Math.min(maximum, Math.max(minimum, Math.trunc(Number(control.value) || minimum)))
        applySelectionChange(object => { if (object.type === 'table_cell') object[field] = value })
      })
    }
    const bindText = (control, field) => {
      control.addEventListener('focus', () => { if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true } })
      control.addEventListener('input', () => {
        const objects = selectedObjects()
        for (const object of objects) {
          object[field] = control.value
          object[field === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'] = []
          if (field === 'sourceText') {
            object.translation = servicePlaceholder(object.type, object.sourceText)
            object.translationTextStyles = []
            object.translationUnits = []
            ensureObjectTranslationUnits(object)
          } else {
            const units = ensureObjectTranslationUnits(object)
            if (units.length === 1) {
              units[0].translation = control.value
              units[0].status = 'edited'
              units[0].activeTranslationSource = 'manual'
              units[0].memorySuggestion = null
              units[0].memoryEntryId = null
            }
          }
          object.status = 'edited'
        }
        renderSelectedText(field === 'sourceText' ? 'sourceText' : field)
        if (field === 'sourceText') renderSelectedText('translation')
        fitObjectsToRenderedContent(objects, state.viewMode === 'layout')
        renderTranslationUnits(selectedObjects())
        scheduleSave()
      })
      control.addEventListener('blur', () => { state.textCheckpoint = false })
    }
    bindText(elements.sourceText, 'sourceText')
    bindText(elements.translationText, 'translation')
    for (const eventName of ['select', 'keyup', 'pointerup', 'focus']) {
      elements.sourceText.addEventListener(eventName, refreshTranslationSelectionPreview)
    }
  }

  function renderSelectedText(field) {
    for (const object of selectedObjects()) {
      const nodes = elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"]`)
      for (const node of nodes) {
        const content = node.querySelector('.scene-object__content')
        if (!content) continue
        const requestedField = state.viewMode === 'segments' ? content.dataset.editField : null
        if (state.viewMode !== 'segments' || requestedField === field) renderTextContent(content, object, requestedField)
        node.classList.toggle('is-untranslated', content.dataset.editField !== 'sourceText' && !object.translation && isTranslatableType(object.type))
      }
    }
    if (state.viewMode === 'segments') requestAnimationFrame(refreshSegmentsViewHeights)
  }

  function bindEvents() {
    elements.fileInput.addEventListener('change', () => upload(elements.fileInput.files))
    for (const eventName of ['dragenter', 'dragover']) elements.uploadZone.addEventListener(eventName, event => { event.preventDefault(); elements.uploadZone.classList.add('is-dragover') })
    for (const eventName of ['dragleave', 'drop']) elements.uploadZone.addEventListener(eventName, event => { event.preventDefault(); elements.uploadZone.classList.remove('is-dragover') })
    elements.uploadZone.addEventListener('drop', event => upload(event.dataTransfer.files))
    elements.newDocument.addEventListener('click', async () => {
      if (state.saveTimer) await saveScene()
      elements.fileInput.click()
    })
    elements.documentLibraryButton.addEventListener('click', openDocumentLibrary)
    elements.documentLibraryClose.addEventListener('click', () => { elements.documentLibraryModal.hidden = true })
    elements.documentLibraryModal.addEventListener('pointerdown', event => {
      if (event.target === elements.documentLibraryModal) elements.documentLibraryModal.hidden = true
    })
    elements.knowledgeBaseOpen.addEventListener('click', openKnowledgeBase)
    elements.knowledgeBaseOpenContext.addEventListener('click', openKnowledgeBase)
    elements.knowledgeBaseClose.addEventListener('click', closeKnowledgeBase)
    elements.knowledgeBaseModal.addEventListener('pointerdown', event => { if (event.target === elements.knowledgeBaseModal) closeKnowledgeBase() })
    elements.knowledgeBaseSearch.addEventListener('click', () => loadKnowledgeBaseEntries(true))
    elements.knowledgeBaseQuery.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); loadKnowledgeBaseEntries(true) }
    })
    elements.knowledgeBaseGlossaryFilter.addEventListener('change', () => loadKnowledgeBaseEntries(true))
    elements.knowledgeBaseNew.addEventListener('click', () => showKnowledgeBaseEntryForm())
    elements.knowledgeBaseEntryCancel.addEventListener('click', closeKnowledgeBaseEntryForm)
    elements.knowledgeBaseEntryForm.addEventListener('submit', saveKnowledgeBaseEntry)
    elements.instructionLibraryButton.addEventListener('click', openInstructionLibrary)
    elements.instructionLibraryClose.addEventListener('click', closeInstructionLibrary)
    elements.instructionLibraryModal.addEventListener('pointerdown', event => { if (event.target === elements.instructionLibraryModal) closeInstructionLibrary() })
    elements.instructionLibraryQuery.addEventListener('input', renderInstructionLibrary)
    elements.instructionLibraryNew.addEventListener('click', () => showInstructionLibraryForm())
    elements.instructionLibraryFormCancel.addEventListener('click', closeInstructionLibraryForm)
    elements.instructionLibraryForm.addEventListener('submit', saveInstructionLibraryEntry)
    elements.knowledgeBasePrevious.addEventListener('click', () => {
      state.knowledgeBaseOffset = Math.max(0, state.knowledgeBaseOffset - state.knowledgeBaseLimit)
      loadKnowledgeBaseEntries()
    })
    elements.knowledgeBaseNext.addEventListener('click', () => {
      if (state.knowledgeBaseOffset + state.knowledgeBaseLimit >= state.knowledgeBaseTotal) return
      state.knowledgeBaseOffset += state.knowledgeBaseLimit
      loadKnowledgeBaseEntries()
    })
    elements.aiSettingsButton.addEventListener('click', openProviderSettings)
    elements.aiSettingsClose.addEventListener('click', closeProviderSettings)
    elements.aiSettingsModal.addEventListener('pointerdown', event => { if (event.target === elements.aiSettingsModal) closeProviderSettings() })
    elements.aiProviderSelect.addEventListener('change', () => {
      elements.aitunnelSettings.hidden = elements.aiProviderSelect.value !== 'aitunnel'
      if (elements.aiProviderSelect.value === 'aitunnel' && !state.aitunnelModels.length) loadAitunnelModels()
    })
    elements.saveAiSettings.addEventListener('click', saveProviderSettings)
    elements.testAiConnection.addEventListener('click', testAiConnection)
    elements.removeAitunnelKey.addEventListener('click', removeAitunnelKey)
    elements.retryJob.addEventListener('click', retryFailedJob)
    elements.cancelJob.addEventListener('click', cancelActiveJob)
    elements.zoomOut.addEventListener('click', () => setZoom(state.zoom - .1))
    elements.zoomIn.addEventListener('click', () => setZoom(state.zoom + .1))
    elements.zoomFit.addEventListener('click', fitWidth)
    elements.zoomActual.addEventListener('click', () => setZoom(1))
    elements.viewLayout.addEventListener('click', () => setDocumentView('layout'))
    elements.viewSegments.addEventListener('click', () => setDocumentView('segments'))
    elements.sourcePanelToggle.addEventListener('click', toggleSourcePanel)
    elements.inspectorPanelToggle.addEventListener('click', () => setInspectorOpen(!state.inspectorOpen))
    elements.canvasScroll.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      queueWheelZoom(event)
    }, { passive: false })
    elements.canvasScroll.addEventListener('scroll', () => {
      state.pointerAction?.updateFromScroll?.()
      const viewport = elements.canvasScroll.getBoundingClientRect()
      const shells = [...elements.canvas.querySelectorAll('.studio-page-shell')]
      const nearest = shells.sort((left, right) => Math.abs(left.getBoundingClientRect().top - viewport.top - 18) - Math.abs(right.getBoundingClientRect().top - viewport.top - 18))[0]
      const pageIndex = Number(nearest?.dataset.pageIndex)
      if (Number.isInteger(pageIndex) && pageIndex !== state.activePage) {
        state.activePage = pageIndex
        renderThumbnails()
        renderSourcePreview()
      }
    }, { passive: true })
    elements.sourceZoomOut.addEventListener('click', () => setSourceZoom(state.sourceZoom - .1))
    elements.sourceZoomIn.addEventListener('click', () => setSourceZoom(state.sourceZoom + .1))
    elements.sourceZoomActual.addEventListener('click', () => setSourceZoom(1))
    elements.sourceZoomFit.addEventListener('click', fitSourceWidth)
    elements.sourcePreviewOpen.addEventListener('click', openSourceLightbox)
    elements.sourceLightboxClose.addEventListener('click', closeSourceLightbox)
    elements.sourceLightboxPrevious.addEventListener('click', () => stepSourceLightbox(-1))
    elements.sourceLightboxNext.addEventListener('click', () => stepSourceLightbox(1))
    elements.sourceLightboxZoomOut.addEventListener('click', () => setSourceLightboxZoom(state.sourceLightboxZoom - .1))
    elements.sourceLightboxZoomIn.addEventListener('click', () => setSourceLightboxZoom(state.sourceLightboxZoom + .1))
    elements.sourceLightboxZoomActual.addEventListener('click', () => setSourceLightboxZoom(1))
    elements.sourceLightboxFit.addEventListener('click', fitSourceLightbox)
    elements.sourceLightbox.addEventListener('pointerdown', event => {
      if (event.target === elements.sourceLightbox || event.target === elements.sourceLightboxViewport) closeSourceLightbox()
    })
    elements.sourceLightboxViewport.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      const factor = Math.exp(-normalizedWheelDelta(event) * .0015)
      setSourceLightboxZoom(state.sourceLightboxZoom * factor)
    }, { passive: false })
    elements.sourcePreviewScroll.addEventListener('pointerdown', beginSourcePan)
    elements.sourcePreviewScroll.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      queueWheelZoom(event, true)
    }, { passive: false })
    elements.gridSize.addEventListener('change', () => {
      const density = elements.gridSize.value
      if (!GRID_DENSITY_COLUMNS[density] || density === currentGridDensity()) return
      checkpoint()
      state.scene.gridDensity = density
      state.scene.gridSize = Number(currentGridSize().toFixed(4))
      for (const surface of elements.canvas.querySelectorAll('.studio-page')) applyGridToSurface(surface)
      scheduleSave()
      showToast(`Плотность сетки: ${density.toUpperCase()}`)
    })
    elements.sourceLanguage.addEventListener('change', () => { state.scene.sourceLanguage = elements.sourceLanguage.value; scheduleSave() })
    elements.targetLanguage.addEventListener('change', () => { state.scene.targetLanguage = elements.targetLanguage.value; scheduleSave() })
    elements.analyze.addEventListener('click', () => runAgent('analyze', 'Проверяем порядок чтения и типы объектов…'))
    elements.reanalyze.addEventListener('click', reanalyzeSource)
    elements.autoLayout.addEventListener('click', () => { checkpoint(); runAgent('auto-layout', 'Расширяем текстовые блоки и устраняем наложения…') })
    elements.translationSelectAll.addEventListener('change', () => selectAllTranslationObjects(elements.translationSelectAll.checked))
    elements.translate.addEventListener('click', translateSelection)
    elements.globalTranslationInstruction.addEventListener('input', () => {
      if (!state.scene) return
      state.scene.globalTranslationInstruction = elements.globalTranslationInstruction.value.slice(0, 10000)
      scheduleSave()
    })
    elements.instructionPresetSelect.addEventListener('change', () => {
      const selected = Boolean(elements.instructionPresetSelect.value)
      elements.instructionPresetApply.disabled = !selected
      elements.instructionPresetEdit.disabled = !selected
      elements.instructionPresetDelete.disabled = !selected
      if (!elements.instructionPresetEditor.hidden) closeInstructionPresetEditor()
    })
    elements.instructionPresetApply.addEventListener('click', () => {
      applyInstructionPreset(elements.instructionPresetSelect, elements.globalTranslationInstruction, 10000)
    })
    elements.instructionPresetSave.addEventListener('click', () => {
      saveInstructionPreset(elements.globalTranslationInstruction.value, elements.instructionPresetSelect)
    })
    elements.instructionPresetEdit.addEventListener('click', openInstructionPresetEditor)
    elements.instructionPresetDelete.addEventListener('click', deleteSelectedInstructionPreset)
    elements.instructionPresetEditCancel.addEventListener('click', closeInstructionPresetEditor)
    elements.instructionPresetEditSave.addEventListener('click', updateSelectedInstructionPreset)
    elements.reviseSelected.addEventListener('click', () => reviseTranslations([...state.translationSelected], 'selection', elements.reviseSelected))
    elements.reviseDocument.addEventListener('click', () => reviseTranslations([], 'document', elements.reviseDocument))
    elements.layoutReview.addEventListener('click', startLayoutReview)
    elements.layoutReviewCancel.addEventListener('click', cancelLayoutReview)
    elements.qa.addEventListener('click', runQa)
    elements.qaClose.addEventListener('click', () => { elements.qaPanel.hidden = true })
    elements.addObject.addEventListener('click', () => addObject())
    elements.memorySearch.addEventListener('click', findMemory)
    elements.glossaryAdd.addEventListener('click', createGlossary)
    elements.glossarySelect.addEventListener('change', () => {
      if (!state.scene || !elements.glossarySelect.value) return
      state.scene.glossaryId = elements.glossarySelect.value
      scheduleSave()
      elements.memoryResults.innerHTML = '<small>Глоссарий изменён. Выполните новый поиск.</small>'
    })
    elements.knowledgeBaseMode.addEventListener('change', () => {
      if (!state.scene) return
      state.scene.knowledgeBaseMode = elements.knowledgeBaseMode.value === 'priority' ? 'priority' : 'suggestions'
      scheduleSave()
      showToast(state.scene.knowledgeBaseMode === 'priority'
        ? 'БЗ будет приоритетной при следующем переводе'
        : 'БЗ будет показывать подсказки, не изменяя перевод ИИ')
    })
    elements.approve.addEventListener('click', approveTranslation)
    elements.translationUnitsSplitSentences.addEventListener('click', splitInternalBySentences)
    elements.translationUnitsSplitSelection.addEventListener('click', splitInternalBySelection)
    elements.translationUnitsMerge.addEventListener('click', mergeInternalUnits)
    elements.translationUnitsApplyExact.addEventListener('click', applyAllExactSuggestions)
    elements.merge.addEventListener('click', mergeSelected)
    elements.split.addEventListener('click', splitSelectedText)
    elements.resetPosition.addEventListener('click', resetPosition)
    elements.exclude.addEventListener('click', excludeSelected)
    elements.exportDocx.addEventListener('click', () => exportDocument('docx'))
    elements.exportPdf.addEventListener('click', () => exportDocument('pdf'))
    elements.undo.addEventListener('click', undo)
    elements.redo.addEventListener('click', redo)
    elements.fitContentWidth.addEventListener('click', () => fitSelectionToContent('width'))
    elements.fitContentHeight.addEventListener('click', () => fitSelectionToContent('height'))
    elements.fitContentBoth.addEventListener('click', () => fitSelectionToContent('both'))
    document.querySelectorAll('[data-align-selection]').forEach(button => button.addEventListener('click', () => alignSelection(button.dataset.alignSelection)))
    document.querySelectorAll('[data-align-document]').forEach(button => button.addEventListener('click', () => alignToDocument(button.dataset.alignDocument)))
    elements.flexApply.addEventListener('click', applyFlexLayout)
    elements.toolbarFontSizeDecrease.addEventListener('click', () => changeFormattingFontSize(-1))
    elements.toolbarFontSizeIncrease.addEventListener('click', () => changeFormattingFontSize(1))
    elements.toolbarFontSizeValue.addEventListener('input', () => refreshNumberStepperDraft(elements.toolbarFontSizeValue))
    elements.toolbarFontSizeValue.addEventListener('change', () => {
      if (elements.toolbarFontSizeValue.value === '') return refreshFormattingToolbar()
      setFormattingFontSize(elements.toolbarFontSizeValue.value)
    })
    elements.toolbarFontSizeValue.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      if (elements.toolbarFontSizeValue.value !== '') setFormattingFontSize(elements.toolbarFontSizeValue.value)
      elements.toolbarFontSizeValue.blur()
    })
    elements.toolbarFontFamily.addEventListener('change', () => setFormattingFontFamily(elements.toolbarFontFamily.value))
    elements.toolbarTextColor.addEventListener('input', () => {
      elements.toolbarTextColor.closest('.color-picker')?.style.setProperty('--color-picker-value', elements.toolbarTextColor.value)
    })
    elements.toolbarTextColor.addEventListener('change', () => setFormattingColor(elements.toolbarTextColor.value))
    elements.lineHeightDecrease.addEventListener('click', () => changeFormattingLineHeight(-.05))
    elements.lineHeightIncrease.addEventListener('click', () => changeFormattingLineHeight(.05))
    elements.lineHeight.addEventListener('input', () => refreshNumberStepperDraft(elements.lineHeight))
    elements.lineHeight.addEventListener('change', () => {
      if (elements.lineHeight.value === '') return refreshFormattingToolbar()
      setFormattingLineHeight(elements.lineHeight.value)
    })
    elements.lineHeight.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      if (elements.lineHeight.value !== '') setFormattingLineHeight(elements.lineHeight.value)
      elements.lineHeight.blur()
    })
    elements.typographySelectAll.addEventListener('click', selectAllFormattingSegments)
    elements.formatAllSegments.addEventListener('change', refreshFormattingToolbar)
    document.querySelectorAll('.format-button').forEach(button => button.addEventListener('click', () => applyFormatting(button.dataset.format)))
    const setAppbarMenuOpen = open => {
      elements.appbarActionsMenu.hidden = !open
      elements.appbarMenuButton.setAttribute('aria-expanded', String(open))
    }
    elements.appbarMenuButton.addEventListener('click', event => {
      event.stopPropagation()
      setAppbarMenuOpen(elements.appbarActionsMenu.hidden)
    })
    elements.appbarActionsMenu.addEventListener('click', event => {
      if (event.target.closest('a, button')) setAppbarMenuOpen(false)
    })
    document.addEventListener('keydown', event => {
      if (!elements.sourceLightbox.hidden && event.key === 'ArrowLeft') {
        event.preventDefault()
        stepSourceLightbox(-1)
      }
      if (!elements.sourceLightbox.hidden && event.key === 'ArrowRight') {
        event.preventDefault()
        stepSourceLightbox(1)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
      }
      if (event.key === 'Escape') {
        if (!elements.sourceLightbox.hidden) {
          closeSourceLightbox()
          return
        }
        setAppbarMenuOpen(false)
        if (state.inspectorOpen) setInspectorOpen(false)
        cancelPointerAction()
        stopSourcePan()
        closeKnowledgeSuggestion()
        closeInstructionPresetEditor()
        if (!elements.aiSettingsModal.hidden) closeProviderSettings()
        if (!elements.knowledgeBaseModal.hidden) closeKnowledgeBase()
        if (!elements.instructionLibraryModal.hidden) closeInstructionLibrary()
        elements.documentLibraryModal.hidden = true
        state.selected.clear()
        state.lastTextSelection = null
        elements.qaPanel.hidden = true
        refreshSelection()
        document.activeElement?.blur?.()
      }
    })
    document.addEventListener('pointerdown', event => {
      if (!elements.appbarActionsMenu.hidden && !elements.appbarMenu.contains(event.target)) setAppbarMenuOpen(false)
      if (elements.knowledgeSuggestionPopover.hidden) return
      if (elements.knowledgeSuggestionPopover.contains(event.target) || event.target.closest?.('.knowledge-highlight')) return
      closeKnowledgeSuggestion()
    })
    window.addEventListener('pagehide', () => {
      cancelPointerAction()
      stopSourcePan()
      clearTimeout(state.jobsPollTimer)
      if (!state.saveTimer || !state.metadata) return
      fetch(`/api/studio/documents/${state.metadata.id}/scene`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.scene), keepalive: true,
      }).catch(() => {})
    })
    bindInspector()
  }

  async function loadServiceStatus() {
    try {
      const response = await api('/api/studio/status')
      state.serviceStatus = await response.json()
      if (state.serviceStatus.documentAnalysisMode === 'codex') {
        const ready = state.serviceStatus.codexAvailable && state.serviceStatus.codexAuthenticated
        elements.analysisServiceNote.textContent = ready
          ? `Агент ${state.serviceStatus.documentAgentModel || 'Codex'} готов. Изображения страниц будут переданы OpenAI; локальное извлечение текста не выполняется.`
          : `Агент не готов: ${state.serviceStatus.codexStatusError || 'выполните codex login'}.`
        elements.fileInput.disabled = !ready
      } else {
        const ready = state.serviceStatus.aiProviderConfigured
        elements.analysisServiceNote.textContent = ready
          ? `AITunnel готов к анализу · ${state.serviceStatus.documentAgentModel}. Все изображения страниц будут отправлены выбранной модели по API.`
          : 'AITunnel не настроен. Откройте «AI-провайдер», выберите модель и добавьте ключ.'
        elements.fileInput.disabled = !ready
      }
    } catch {
      state.serviceStatus = null
      elements.analysisServiceNote.textContent = 'Не удалось проверить готовность агента.'
    }
  }

  function fillGlossarySelect(select, { includeAll = false, selected = '' } = {}) {
    select.replaceChildren()
    if (includeAll) select.append(new Option('Все глоссарии', ''))
    for (const glossary of state.glossaries) {
      select.append(new Option(glossary.domain ? `${glossary.name} · ${glossary.domain}` : glossary.name, glossary.id))
    }
    if (selected && [...select.options].some(option => option.value === selected)) select.value = selected
  }

  function closeKnowledgeBaseEntryForm() {
    elements.knowledgeBaseEntryForm.hidden = true
    elements.knowledgeBaseEntryForm.reset()
    elements.knowledgeBaseEntryId.value = ''
  }

  function showKnowledgeBaseEntryForm(entry = null) {
    elements.knowledgeBaseEntryForm.hidden = false
    elements.knowledgeBaseEntryId.value = entry?.id || ''
    elements.knowledgeBaseEntrySource.value = entry?.sourceText || ''
    elements.knowledgeBaseEntryTranslation.value = entry?.translation || ''
    elements.knowledgeBaseEntrySourceLanguage.value = entry?.sourceLanguage || state.scene?.sourceLanguage || 'auto'
    elements.knowledgeBaseEntryTargetLanguage.value = entry?.targetLanguage || state.scene?.targetLanguage || 'ru'
    const glossaryId = entry?.glossaryId || state.scene?.glossaryId || elements.knowledgeBaseGlossaryFilter.value || state.glossaries[0]?.id || ''
    fillGlossarySelect(elements.knowledgeBaseEntryGlossary, { selected: glossaryId })
    elements.knowledgeBaseEntrySource.focus()
  }

  function renderKnowledgeBaseEntries() {
    elements.knowledgeBaseList.replaceChildren()
    const start = state.knowledgeBaseTotal ? state.knowledgeBaseOffset + 1 : 0
    const end = Math.min(state.knowledgeBaseOffset + state.knowledgeBaseEntries.length, state.knowledgeBaseTotal)
    elements.knowledgeBasePageSummary.textContent = `${start}–${end} из ${state.knowledgeBaseTotal}`
    elements.knowledgeBasePrevious.disabled = state.knowledgeBaseOffset <= 0
    elements.knowledgeBaseNext.disabled = state.knowledgeBaseOffset + state.knowledgeBaseLimit >= state.knowledgeBaseTotal
    if (!state.knowledgeBaseEntries.length) {
      const empty = document.createElement('div')
      empty.className = 'document-library-empty'
      empty.textContent = 'Записи не найдены. Измените запрос или создайте новую пару.'
      elements.knowledgeBaseList.append(empty)
      return
    }
    const glossaryNames = new Map(state.glossaries.map(glossary => [glossary.id, glossary.name]))
    for (const entry of state.knowledgeBaseEntries) {
      const row = document.createElement('article')
      row.className = 'knowledge-base-entry'
      row.dataset.entryId = entry.id
      const source = document.createElement('p')
      source.className = 'knowledge-base-entry__text'
      const sourceLabel = document.createElement('small')
      sourceLabel.textContent = `Оригинал · ${entry.sourceLanguage}`
      source.append(sourceLabel, document.createTextNode(entry.sourceText))
      const translation = document.createElement('p')
      translation.className = 'knowledge-base-entry__text'
      const translationLabel = document.createElement('small')
      translationLabel.textContent = `Перевод · ${entry.targetLanguage}`
      translation.append(translationLabel, document.createTextNode(entry.translation))
      const actions = document.createElement('div')
      actions.className = 'knowledge-base-entry__actions'
      const edit = document.createElement('button')
      edit.className = 'button'
      edit.type = 'button'
      edit.textContent = 'Изменить'
      edit.addEventListener('click', () => showKnowledgeBaseEntryForm(entry))
      const remove = document.createElement('button')
      remove.className = 'button button--danger'
      remove.type = 'button'
      remove.textContent = 'Удалить'
      remove.addEventListener('click', () => deleteKnowledgeBaseEntry(entry))
      actions.append(edit, remove)
      const meta = document.createElement('small')
      meta.className = 'knowledge-base-entry__meta'
      const updatedAt = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('ru-RU') : '—'
      meta.textContent = `${glossaryNames.get(entry.glossaryId) || 'Неизвестный глоссарий'} · изменено ${updatedAt}`
      row.append(source, translation, actions, meta)
      elements.knowledgeBaseList.append(row)
    }
  }

  async function loadKnowledgeBaseEntries(resetOffset = false) {
    if (resetOffset) state.knowledgeBaseOffset = 0
    elements.knowledgeBaseList.innerHTML = '<small>Загружаем записи…</small>'
    const parameters = new URLSearchParams({
      query: elements.knowledgeBaseQuery.value.trim(),
      glossaryId: elements.knowledgeBaseGlossaryFilter.value,
      limit: String(state.knowledgeBaseLimit),
      offset: String(state.knowledgeBaseOffset),
    })
    try {
      const response = await api(`/api/studio/knowledge-base/entries?${parameters}`)
      const data = await response.json()
      state.knowledgeBaseEntries = Array.isArray(data.entries) ? data.entries : []
      state.knowledgeBaseTotal = Number(data.total) || 0
      if (state.knowledgeBaseOffset >= state.knowledgeBaseTotal && state.knowledgeBaseOffset > 0) {
        state.knowledgeBaseOffset = Math.max(0, Math.floor(Math.max(0, state.knowledgeBaseTotal - 1) / state.knowledgeBaseLimit) * state.knowledgeBaseLimit)
        return loadKnowledgeBaseEntries()
      }
      renderKnowledgeBaseEntries()
    } catch (error) {
      elements.knowledgeBaseList.innerHTML = `<div class="document-library-empty">${escapeHtml(error.message)}</div>`
      elements.knowledgeBasePageSummary.textContent = 'Ошибка загрузки'
    }
  }

  async function openKnowledgeBase() {
    elements.knowledgeBaseModal.hidden = false
    closeKnowledgeBaseEntryForm()
    try {
      await loadKnowledgeBase()
      fillGlossarySelect(elements.knowledgeBaseGlossaryFilter, { includeAll: true, selected: elements.knowledgeBaseGlossaryFilter.value })
      await loadKnowledgeBaseEntries(true)
      elements.knowledgeBaseQuery.focus()
    } catch (error) {
      elements.knowledgeBaseList.innerHTML = `<div class="document-library-empty">${escapeHtml(error.message)}</div>`
    }
  }

  function closeKnowledgeBase() {
    elements.knowledgeBaseModal.hidden = true
    closeKnowledgeBaseEntryForm()
  }

  async function saveKnowledgeBaseEntry(event) {
    event.preventDefault()
    const id = elements.knowledgeBaseEntryId.value
    const payload = {
      sourceText: elements.knowledgeBaseEntrySource.value.trim(),
      translation: elements.knowledgeBaseEntryTranslation.value.trim(),
      glossaryId: elements.knowledgeBaseEntryGlossary.value,
      sourceLanguage: elements.knowledgeBaseEntrySourceLanguage.value.trim() || 'auto',
      targetLanguage: elements.knowledgeBaseEntryTargetLanguage.value.trim() || 'ru',
    }
    if (!payload.sourceText || !payload.translation || !payload.glossaryId) return showToast('Заполните оригинал, перевод и глоссарий', true)
    try {
      if (id) {
        await api(`/api/studio/knowledge-base/entries/${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } else {
        const response = await api('/api/studio/knowledge-base/entries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const result = await response.json()
        const conflict = result.results?.find(item => item.status === 'conflict' || item.status === 'existing')
        if (conflict) throw new Error(conflict.status === 'existing' ? 'Такая запись уже существует' : 'Для этой исходной фразы уже сохранён другой перевод')
      }
      closeKnowledgeBaseEntryForm()
      await Promise.all([loadKnowledgeBaseEntries(), loadKnowledgeBase()])
      showToast(id ? 'Запись Базы знаний обновлена' : 'Запись добавлена в Базу знаний')
    } catch (error) { showToast(error.message, true) }
  }

  async function deleteKnowledgeBaseEntry(entry) {
    if (!window.confirm(`Удалить пару «${entry.sourceText.slice(0, 80)}»? Переводы в уже сохранённых документах не изменятся.`)) return
    try {
      await api(`/api/studio/knowledge-base/entries/${encodeURIComponent(entry.id)}`, { method: 'DELETE' })
      if (elements.knowledgeBaseEntryId.value === entry.id) closeKnowledgeBaseEntryForm()
      await Promise.all([loadKnowledgeBaseEntries(), loadKnowledgeBase()])
      showToast('Запись удалена из Базы знаний')
    } catch (error) { showToast(error.message, true) }
  }

  async function loadKnowledgeBase() {
    const statusResponse = await api('/api/studio/knowledge-base/status')
    const status = await statusResponse.json()
    elements.knowledgeBaseStatus.classList.toggle('is-error', status.connected === false || !status.persistent)
    elements.knowledgeBaseStatus.textContent = status.mode === 'postgres-pgvector'
      ? status.connected === false
        ? `PostgreSQL недоступен: ${status.error || 'проверьте DATABASE_URL'}`
        : `PostgreSQL/pgvector · ${status.entries || 0} записей · ${status.vectorSearch ? status.embeddingModel : 'только точный поиск'}`
      : 'Временная БЗ в памяти · настройте DATABASE_URL для постоянного хранения'
    let glossaries = []
    try {
      const glossariesResponse = await api('/api/studio/knowledge-base/glossaries')
      ;({ glossaries } = await glossariesResponse.json())
    } catch (error) {
      elements.knowledgeBaseStatus.classList.add('is-error')
      elements.knowledgeBaseStatus.textContent = `База знаний недоступна: ${error.message}`
      elements.glossarySelect.replaceChildren(new Option('Глоссарии недоступны', ''))
      elements.glossarySelect.disabled = true
      return
    }
    elements.glossarySelect.disabled = false
    state.glossaries = Array.isArray(glossaries) ? glossaries : []
    const selected = state.scene?.glossaryId
    fillGlossarySelect(elements.glossarySelect, { selected })
    if (!elements.knowledgeBaseModal.hidden) {
      fillGlossarySelect(elements.knowledgeBaseGlossaryFilter, { includeAll: true, selected: elements.knowledgeBaseGlossaryFilter.value })
      fillGlossarySelect(elements.knowledgeBaseEntryGlossary, { selected: elements.knowledgeBaseEntryGlossary.value || selected })
    }
    else if (elements.glossarySelect.value && state.scene) state.scene.glossaryId = elements.glossarySelect.value
  }

  async function createGlossary() {
    const name = window.prompt('Название нового глоссария')?.trim()
    if (!name) return
    try {
      const response = await api('/api/studio/knowledge-base/glossaries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sourceLanguage: state.scene?.sourceLanguage, targetLanguage: state.scene?.targetLanguage }),
      })
      const { glossary } = await response.json()
      await loadKnowledgeBase()
      if (state.scene) {
        state.scene.glossaryId = glossary.id
        elements.glossarySelect.value = glossary.id
        scheduleSave()
      }
      showToast(`Создан глоссарий «${glossary.name}»`)
    } catch (error) { showToast(error.message, true) }
  }

  async function restoreDocumentFromUrl() {
    const parameters = new URL(location.href).searchParams
    const id = parameters.get('document')
    const jobId = parameters.get('job')
    if (/^[a-f0-9]{32}$/.test(jobId || '')) {
      setView('loading')
      try {
        const response = await api(`/api/studio/jobs/${jobId}`)
        const { job } = await response.json()
        const tab = { key: job.id, jobId: job.id, title: job.title, ...job }
        state.tabs.set(tab.key, tab)
        state.activeTabKey = tab.key
        renderDocumentTabs()
        if (tab.status === 'completed') await activateTab(tab.key, true)
        else if (tab.status === 'failed') await activateTab(tab.key)
        else {
          updateLoadingFromTab(tab)
          scheduleJobsPoll(100)
        }
        return
      } catch (error) {
        history.replaceState(null, '', '/')
        showToast(error.message, true)
      }
    }
    if (!/^[a-f0-9]{32}$/.test(id || '')) {
      const latest = [...state.tabs.values()].find(tab => tab.status === 'completed' && tab.documentId)
      if (latest) await activateTab(latest.key)
      else setView('upload')
      return
    }
    setView('loading')
    elements.loadingMessage.textContent = 'Открываем сохранённый локальный проект…'
    try {
      const response = await api(`/api/studio/documents/${id}`)
      const documentData = await response.json()
      const key = `document-${id}`
      state.tabs.set(key, {
        key, jobId: null, documentId: id, title: documentData.scene.title,
        status: 'completed', progress: 100, documentData,
      })
      state.activeTabKey = key
      openDocument(documentData)
    } catch (error) {
      history.replaceState(null, '', '/')
      setView('upload')
      showToast(error.message, true)
    }
  }

  bindEvents()
  ;(async () => {
    await Promise.all([loadServiceStatus(), loadInstructionPresets().catch(() => {})])
    await loadPendingJobs()
    await loadDocumentHistory()
    await restoreDocumentFromUrl()
  })()
})()
