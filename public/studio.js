(() => {
  const $ = selector => document.querySelector(selector)
  const iconMarkup = name => `<svg class="ui-icon" aria-hidden="true"><use href="/icons.svg#icon-${name}"></use></svg>`
  const translationUnits = window.IcatTranslationUnits
  const GRID_OUTER_SIZE = 68
  const GRID_FINE_DIVISIONS = 4
  const LANGUAGE_LABELS = Object.freeze({
    auto: 'Авто',
    tr: 'Турецкий', turkish: 'Турецкий', 'türkçe': 'Турецкий', 'турецкий': 'Турецкий',
    en: 'Английский', english: 'Английский', 'английский': 'Английский',
    ru: 'Русский', russian: 'Русский', 'русский': 'Русский',
    de: 'Немецкий', german: 'Немецкий', deutsch: 'Немецкий', 'немецкий': 'Немецкий',
  })
  const languageLabel = value => LANGUAGE_LABELS[String(value || 'auto').trim().toLocaleLowerCase()] || String(value || 'Авто')

  function sceneLanguagesMatch(scene = state.scene) {
    const source = String(scene?.sourceLanguage || '').trim()
    const target = String(scene?.targetLanguage || '').trim()
    return Boolean(source && target && source.toLocaleLowerCase() !== 'auto'
      && languageLabel(source).toLocaleLowerCase() === languageLabel(target).toLocaleLowerCase())
  }

  function duplicateSourceTranslations(scene = state.scene) {
    if (!sceneLanguagesMatch(scene)) return 0
    let changed = 0
    for (const object of scene?.objects || []) {
      if (object.excluded || !String(object.sourceText || '').length) continue
      const sourceText = String(object.sourceText)
      const styles = (object.sourceTextStyles || []).map(range => ({ ...range }))
      if (object.translation !== sourceText
        || JSON.stringify(object.translationTextStyles || []) !== JSON.stringify(styles)) changed += 1
      object.translation = sourceText
      object.translationTextStyles = styles
      object.translationUnits = []
      if (isTranslatableType(object.type)) {
        const units = ensureObjectTranslationUnits(object)
        for (const unit of units) {
          unit.translation = unit.sourceText
          unit.aiTranslation = ''
          unit.activeTranslationSource = 'manual'
          unit.status = 'edited'
          unit.memorySuggestion = null
          unit.memoryEntryId = null
        }
        translationUnits.syncObjectTranslation(object)
      }
      object.status = 'edited'
    }
    return changed
  }

  function currentTranslationSettings(scene = state.scene) {
    return {
      sourceLanguage: String(scene?.sourceLanguage || 'auto'),
      targetLanguage: String(scene?.targetLanguage || 'ru'),
      globalTranslationInstruction: String(scene?.globalTranslationInstruction || '').trim(),
      knowledgeBaseMode: scene?.knowledgeBaseMode === 'priority' ? 'priority' : 'suggestions',
      glossaryId: String(scene?.glossaryId || ''),
    }
  }

  function translationSettingsChanged(scene = state.scene) {
    if (!scene?.translationCompleted) return false
    const snapshot = scene.translationSettingsSnapshot
    if (!snapshot || typeof snapshot !== 'object') return false
    return JSON.stringify(currentTranslationSettings(scene)) !== JSON.stringify(currentTranslationSettings(snapshot))
  }

  function changedTranslationCandidates(scene = state.scene) {
    return translationCandidates(scene).filter(object => (
      String(object.translatedSourceText ?? '') !== String(object.sourceText || '')
      || String(object.translatedSourceType || '') !== String(object.type || '')
    ))
  }

  function markTranslationBaseline(scene, objectIds, pending = []) {
    const requested = new Set(objectIds || [])
    const incomplete = new Set((pending || []).map(item => String(item?.objectId || '')))
    for (const object of translationCandidates(scene)) {
      if (!requested.has(object.id) || incomplete.has(object.id)) continue
      object.translatedSourceText = String(object.sourceText || '')
      object.translatedSourceType = String(object.type || '')
    }
    if (translationCandidates(scene).every(object => (
      String(object.translatedSourceText ?? '') === String(object.sourceText || '')
      && String(object.translatedSourceType || '') === String(object.type || '')
    ))) scene.translationSettingsSnapshot = currentTranslationSettings(scene)
  }
  const elements = {
    uploadView: $('#upload-view'), uploadZone: $('#upload-zone'), fileInput: $('#file-input'), analysisServiceNote: $('#analysis-service-note'),
    loadingView: $('#loading-view'), loadingTitle: $('#loading-title'), loadingMessage: $('#loading-message'), loadingProgress: $('#loading-progress'), loadingProgressLabel: $('#loading-progress-label'), loadingProgressDetails: $('#loading-progress-details'), loadingHint: $('#loading-hint'), retryJob: $('#retry-job-button'), cancelJob: $('#cancel-job-button'),
    orientationView: $('#orientation-view'), orientationPages: $('#orientation-pages'), orientationSubmit: $('#orientation-submit'),
    orientationAllLeft: $('#orientation-all-left'), orientationAllReset: $('#orientation-all-reset'), orientationAllRight: $('#orientation-all-right'),
    studioView: $('#studio-view'),
    documentTabs: $('#document-tabs'), documentTabsList: $('#document-tabs-list'),
    documentLibraryButton: $('#document-library-button'), documentLibraryModal: $('#document-library-modal'),
    documentLibraryClose: $('#document-library-close'), documentLibraryList: $('#document-library-list'),
    documentTitle: $('#document-title'), documentStatus: $('#document-status'), newDocument: $('#new-document-button'),
    appbarMenu: $('#appbar-menu'), appbarMenuButton: $('#appbar-menu-button'), appbarActionsMenu: $('#appbar-actions-menu'),
    exportDocx: $('#export-docx-button'), exportPdf: $('#export-pdf-button'), undo: $('#undo-button'), redo: $('#redo-button'),
    thumbnails: $('#page-thumbnails'), canvasScroll: $('#canvas-scroll'), canvas: $('#document-canvas'),
    sourcePanelToggle: $('#source-panel-toggle'),
    workflowStagebar: $('#workflow-stagebar'), workflowPrevious: $('#workflow-previous'), workflowApprove: $('#workflow-approve'),
    inspectorPanel: $('#inspector-panel'), inspectorPanelBody: $('#inspector-panel-body'),
    zoomControls: $('.workbench-toolbar__layout-controls'), zoomOut: $('#zoom-out'), zoomIn: $('#zoom-in'), zoomFit: $('#zoom-fit'), zoomActual: $('#zoom-100'), zoomOutput: $('#zoom-output'), segmentTypeLabelsToggle: $('#segment-type-labels-toggle'),
    sourcePreviewScroll: $('#source-preview-scroll'), sourcePreviewCanvas: $('#source-preview-canvas'),
    sourceZoomOut: $('#source-zoom-out'), sourceZoomIn: $('#source-zoom-in'), sourceZoomActual: $('#source-zoom-100'), sourceZoomFit: $('#source-zoom-fit'), sourceZoomOutput: $('#source-zoom-output'), sourcePreviewOpen: $('#source-preview-open'),
    sourceLightbox: $('#source-preview-lightbox'), sourceLightboxTitle: $('#source-preview-lightbox-title'), sourceLightboxClose: $('#source-preview-lightbox-close'),
    sourceLightboxViewport: $('#source-preview-lightbox-viewport'), sourceLightboxCanvas: $('#source-preview-lightbox-canvas'),
    sourceLightboxPrevious: $('#source-preview-lightbox-previous'), sourceLightboxNext: $('#source-preview-lightbox-next'),
    sourceLightboxZoomOut: $('#source-preview-lightbox-zoom-out'), sourceLightboxZoomIn: $('#source-preview-lightbox-zoom-in'),
    sourceLightboxZoomActual: $('#source-preview-lightbox-zoom-100'), sourceLightboxFit: $('#source-preview-lightbox-fit'), sourceLightboxZoomOutput: $('#source-preview-lightbox-zoom-output'),
    sourceLanguage: $('#source-language'), targetLanguage: $('#target-language'),
    agentStatus: $('#agent-status'), reanalyze: $('#reanalyze-button'), translate: $('#translate-button'), autoLayout: $('#auto-layout-button'), qa: $('#qa-button'),
    globalTranslationInstruction: $('#translation-global-instruction'),
    batchRevisionInstruction: $('#segment-batch-ai-instruction'), batchRevisionMessages: $('#segment-batch-ai-messages'),
    batchRevisionApply: $('#segment-batch-ai-apply'),
    instructionPresetSelect: $('#instruction-preset-select'), instructionPresetApply: $('#instruction-preset-apply'),
    instructionPresetSave: $('#instruction-preset-save'), instructionPresetEdit: $('#instruction-preset-edit'), instructionPresetDelete: $('#instruction-preset-delete'),
    instructionPresetEditor: $('#instruction-preset-editor'), instructionPresetText: $('#instruction-preset-text'), instructionPresetEditCancel: $('#instruction-preset-edit-cancel'),
    instructionPresetEditSave: $('#instruction-preset-edit-save'),
    objectInspector: $('#object-inspector'),
    objectType: $('#object-type'),
    tableCellFields: $('#table-cell-fields'), tableId: $('#table-id'), tableRow: $('#table-row'), tableColumn: $('#table-column'), tableRowSpan: $('#table-row-span'), tableColumnSpan: $('#table-column-span'),
    sourceText: $('#source-text'), translationText: $('#translation-text'), confidence: $('#confidence-value'), segmentNote: $('#segment-note'),
    segmentGridCoordinates: $('#segment-grid-coordinates'),
    lineHeightDecrease: $('#line-height-decrease'), lineHeight: $('#line-height'), lineHeightIncrease: $('#line-height-increase'),
    toolbarFontSizeDecrease: $('#toolbar-font-size-decrease'), toolbarFontSizeValue: $('#toolbar-font-size-value'), toolbarFontSizeIncrease: $('#toolbar-font-size-increase'),
    toolbarFontFamily: $('#toolbar-font-family'), toolbarTextColor: $('#toolbar-text-color'),
    formatAllSegments: $('#format-all-segments'), typographySelectAll: $('#typography-select-all'),
    fitContentWidth: $('#fit-content-width-button'), fitContentHeight: $('#fit-content-height-button'), fitContentBoth: $('#fit-content-both-button'),
    stretchWorkAreaWidth: $('#stretch-work-area-width-button'), stretchWorkAreaHeight: $('#stretch-work-area-height-button'), fitMinContentWidth: $('#fit-min-content-width-button'),
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
    qaPanel: $('#qa-panel'), qaTitle: $('#qa-title'), qaClose: $('#qa-close'), qaSummary: $('#qa-summary'), qaList: $('#qa-list'),
    qaRefresh: $('#qa-refresh'), qaSelectAll: $('#qa-select-all'),
    selectionBox: $('#selection-box'), toast: $('#toast'),
    reanalyzeConfirmModal: $('#reanalyze-confirm-modal'), reanalyzeConfirmClose: $('#reanalyze-confirm-close'),
    reanalyzeConfirmCancel: $('#reanalyze-confirm-cancel'), reanalyzeConfirmSubmit: $('#reanalyze-confirm-submit'),
    reanalyzeOrientationPages: $('#reanalyze-orientation-pages'), reanalyzeOrientationAllLeft: $('#reanalyze-orientation-all-left'),
    reanalyzeOrientationAllReset: $('#reanalyze-orientation-all-reset'), reanalyzeOrientationAllRight: $('#reanalyze-orientation-all-right'),
    confirmationModal: $('#confirmation-modal'), confirmationEyebrow: $('#confirmation-eyebrow'), confirmationTitle: $('#confirmation-title'),
    confirmationDescription: $('#confirmation-description'), confirmationClose: $('#confirmation-close'),
    confirmationCancel: $('#confirmation-cancel'), confirmationSubmit: $('#confirmation-submit'),
    translationApprovalModal: $('#translation-approval-modal'), translationApprovalContent: $('#translation-approval-content'),
    translationApprovalStatus: $('#translation-approval-status'), translationApprovalContinue: $('#translation-approval-continue'),
    translationApprovalClose: $('#translation-approval-close'), translationApprovalCancel: $('#translation-approval-cancel'),
    translationApprovalRetranslateAll: $('#translation-approval-retranslate-all'), translationApprovalSubmit: $('#translation-approval-submit'),
    aiSettingsButton: $('#ai-settings-button'), aiSettingsModal: $('#ai-settings-modal'), aiSettingsClose: $('#ai-settings-close'),
    aiProviderSelect: $('#ai-provider-select'), aitunnelSettings: $('#aitunnel-settings'), aitunnelModel: $('#aitunnel-model'),
    aitunnelApiKey: $('#aitunnel-api-key'), aitunnelPersistKey: $('#aitunnel-persist-key'), aitunnelModelNote: $('#aitunnel-model-note'), aiProviderStatus: $('#ai-provider-status'),
    saveAiSettings: $('#save-ai-settings'), testAiConnection: $('#test-ai-connection'), removeAitunnelKey: $('#remove-aitunnel-key'),
    administrationButton: $('#administration-button'), administrationModal: $('#administration-modal'), administrationClose: $('#administration-close'),
    administrationCancel: $('#administration-cancel'), administrationReset: $('#administration-reset'), administrationSave: $('#administration-save'),
    chatAgentSystemPrompt: $('#chat-agent-system-prompt'), administrationStatus: $('#administration-status'),
  }

  const state = {
    metadata: null,
    scene: null,
    zoom: 1,
    sourceZoom: .5,
    sourceLightboxZoom: 1,
    sourceRenderedPage: null,
    workflowStage: 1,
    selected: new Set(),
    translationSelected: new Set(),
    activePage: 0,
    history: [],
    future: [],
    saveTimer: null,
    textCheckpoint: false,
    pointerAction: null,
    toastTimer: null,
    qaPanelCloseTimer: null,
    serviceStatus: null,
    lastTextSelection: null,
    sourceCollapsed: true,
    activeInspectorPanel: 'global',
    inspectorPanelOpen: false,
    sourcePanCleanup: null,
    pendingWorkbenchZoom: null,
    pendingSourceZoom: null,
    tabs: new Map(),
    activeTabKey: null,
    tabActivationRevision: 0,
    translationRequestRevision: 0,
    jobsPollTimer: null,
    providerSettings: null,
    administrationSettings: null,
    aitunnelModels: [],
    documentLibrary: [],
    glossaries: [],
    knowledgeBaseEntries: [],
    knowledgeBaseOffset: 0,
    knowledgeBaseLimit: 25,
    knowledgeBaseTotal: 0,
    activeKnowledgeSuggestion: null,
    instructionPresets: [],
    sceneEditRevision: 0,
    confirmationRequest: null,
    reanalyzeOrientation: null,
  }

  function createInspectorPanel(id, key, title, nodes) {
    const panel = document.createElement('section')
    panel.id = id
    panel.className = 'inspector-section'
    panel.dataset.inspectorPanelContent = key
    panel.setAttribute('aria-label', title)
    const content = document.createElement('div')
    content.className = 'inspector-section__content'
    content.append(...nodes)
    panel.append(content)
    return panel
  }

  function renderInspectorPanelState() {
    elements.inspectorPanelBody.setAttribute('aria-hidden', 'false')
    elements.inspectorPanelBody.removeAttribute('inert')
    for (const panel of elements.inspectorPanel.querySelectorAll('[data-inspector-panel-content]')) {
      panel.hidden = panel.dataset.inspectorPanelContent !== state.activeInspectorPanel
    }
  }

  function refreshInspectorSelectionState(hasSelection) {
    for (const content of elements.inspectorPanel.querySelectorAll('[data-layout-selection-content]')) {
      content.hidden = false
      content.classList.toggle('is-disabled', !hasSelection)
      content.setAttribute('aria-disabled', String(!hasSelection))
      if (hasSelection) {
        for (const control of content.querySelectorAll('[data-layout-selection-disabled]')) {
          control.disabled = false
          delete control.dataset.layoutSelectionDisabled
        }
      }
    }
    renderInspectorPanelState()
  }

  function disableUnselectedLayoutControls() {
    for (const content of elements.inspectorPanel.querySelectorAll('[data-layout-selection-content]')) {
      for (const control of content.querySelectorAll('button, input, select, textarea')) {
        if (!control.disabled) control.dataset.layoutSelectionDisabled = 'true'
        control.disabled = true
      }
    }
  }

  function workflowUsesSegments(stage = state.workflowStage) {
    return stage <= 2
  }

  function workflowPanels(stage = state.workflowStage) {
    if (stage === 1) return []
    if (stage === 2) return ['translation']
    if (stage === 3) return ['layout']
    return ['testing']
  }

  function normalizeWorkflowStage(scene) {
    const storedStage = Math.max(1, Math.min(5, Math.trunc(Number(scene?.workflowStage) || 1)))
    const stage = Number(scene?.workflowVersion) >= 2
      ? Math.max(1, Math.min(4, storedStage))
      : ({ 1: 1, 2: 1, 3: 2, 4: 3, 5: 4 }[storedStage] || 1)
    scene.workflowVersion = 2
    scene.workflowStage = stage
    scene.translationCompleted = Boolean(scene.translationCompleted || stage > 1)
    if (scene.layoutInitializationVersion == null) {
      scene.layoutInitializationVersion = stage >= 3 ? 1 : 0
    }
    return stage
  }

  function renderWorkflowStageState() {
    const stage = Math.max(1, Math.min(4, Number(state.workflowStage) || 1))
    const segmentsView = workflowUsesSegments(stage)
    if (stage !== 3 && !elements.qaPanel.hidden) setQaPanelOpen(false, { immediate: true })
    elements.studioView.dataset.workflowStage = String(stage)
    elements.studioView.classList.toggle('is-segments-mode', segmentsView)
    elements.canvas.classList.toggle('is-segments-view', segmentsView)
    for (const step of elements.workflowStagebar.querySelectorAll('[data-workflow-step]')) {
      const number = Number(step.dataset.workflowStep)
      step.classList.toggle('is-current', number === stage)
      step.classList.toggle('is-complete', number < stage)
      if (number === stage) step.setAttribute('aria-current', 'step')
      else step.removeAttribute('aria-current')
    }
    elements.workflowPrevious.disabled = stage === 1
    elements.workflowApprove.disabled = stage === 4
    elements.workflowApprove.setAttribute('aria-label', stage === 4 ? 'Готово к выгрузке' : 'Утвердить')
    const allowedPanels = new Set(workflowPanels(stage))
    if (!allowedPanels.has(state.activeInspectorPanel)) state.activeInspectorPanel = [...allowedPanels][0] || ''
    elements.inspectorPanel.hidden = stage === 1
    elements.sourcePanelToggle.hidden = stage === 1
    elements.zoomControls.hidden = stage === 1
    elements.segmentTypeLabelsToggle.hidden = stage !== 3
    refreshSegmentTypeLabelsState()
    const sourceIsCollapsed = stage === 1 || state.sourceCollapsed
    elements.studioView.classList.toggle('is-source-collapsed', sourceIsCollapsed)
    elements.sourcePanelToggle.classList.toggle('is-active', !sourceIsCollapsed)
    elements.sourcePanelToggle.setAttribute('aria-expanded', String(!sourceIsCollapsed))
    const sourcePanelLabel = sourceIsCollapsed ? 'Показать оригинал' : 'Скрыть оригинал'
    elements.sourcePanelToggle.title = sourcePanelLabel
    elements.sourcePanelToggle.setAttribute('aria-label', sourcePanelLabel)
    elements.exportDocx.disabled = stage !== 4
    elements.exportPdf.disabled = stage !== 4
    renderInspectorPanelState()
  }

  function segmentTypeLabelsVisible() {
    return state.scene?.showSegmentTypeLabels !== false
  }

  function refreshSegmentTypeLabelsState() {
    const hidden = !segmentTypeLabelsVisible()
    elements.canvas.classList.toggle('is-segment-type-labels-hidden', hidden)
    elements.segmentTypeLabelsToggle.classList.toggle('is-active', hidden)
    elements.segmentTypeLabelsToggle.setAttribute('aria-pressed', String(hidden))
    const label = hidden ? 'Показать типы сегментов' : 'Скрыть типы сегментов'
    elements.segmentTypeLabelsToggle.setAttribute('aria-label', label)
    elements.segmentTypeLabelsToggle.title = label
    elements.segmentTypeLabelsToggle.innerHTML = iconMarkup(hidden ? 'eye' : 'eye-off')
  }

  function toggleSegmentTypeLabels() {
    if (!state.scene || state.workflowStage !== 3) return
    state.scene.showSegmentTypeLabels = !segmentTypeLabelsVisible()
    refreshSegmentTypeLabelsState()
    scheduleSave()
  }

  function setWorkflowStage(nextStage, options = {}) {
    if (!state.scene) return
    const stage = Math.max(1, Math.min(4, Math.trunc(Number(nextStage) || 1)))
    const changed = stage !== state.workflowStage
    if (changed) {
      state.history = []
      state.future = []
      state.textCheckpoint = false
      refreshUndoButtons()
    }
    state.workflowStage = stage
    state.scene.workflowVersion = 2
    state.scene.workflowStage = stage
    renderWorkflowStageState()
    if (options.render !== false) {
      if (changed && stage === 3 && Number(state.scene.layoutInitializationVersion) < 1) {
        try {
          arrangeObjectsFromOriginal(state.scene.objects)
        } catch (error) {
          showToast(error.message, true)
        }
        renderDocument()
      } else if (changed && stage === 3 && state.scene.layoutInitializationVersion >= 2) {
        const changedObjects = state.scene.objects.filter(object => !object.excluded && object.layoutContentKey !== layoutContentKey(object))
        if (changedObjects.length) renderDocumentWithContentFit(changedObjects)
        else renderDocument()
      } else renderDocument()
    }
    if (changed && options.save !== false) scheduleSave()
  }

  function restoreGlobalTranslationTools() {
    if (elements.globalTranslationTools && elements.globalTranslationToolsHome) {
      elements.globalTranslationToolsHome.append(elements.globalTranslationTools)
    }
  }

  function openTranslationApprovalModal() {
    if (!state.scene || state.workflowStage !== 1) return
    refreshTranslationApprovalState()
    elements.translationApprovalContent.append(elements.globalTranslationTools)
    elements.translationApprovalModal.hidden = false
    requestAnimationFrame(() => elements.sourceLanguage.focus())
  }

  function refreshTranslationApprovalState() {
    const translated = Boolean(state.scene?.translationCompleted)
    const settingsChanged = translationSettingsChanged()
    const changedCount = translated ? changedTranslationCandidates().length : 0
    elements.translationApprovalStatus.hidden = !translated
    elements.translationApprovalContinue.hidden = !translated || settingsChanged || changedCount > 0
    elements.translationApprovalRetranslateAll.hidden = !translated || settingsChanged
    elements.translationApprovalSubmit.hidden = translated && !settingsChanged && changedCount === 0
    if (!translated) {
      elements.translationApprovalStatus.textContent = ''
      elements.translationApprovalSubmit.textContent = 'Отправить на перевод'
    } else if (settingsChanged) {
      elements.translationApprovalStatus.textContent = 'Изменены языки, инструкция или настройки Базы знаний. Необходимо заново перевести весь документ.'
      elements.translationApprovalSubmit.textContent = 'Перевести заново весь документ'
    } else if (changedCount > 0) {
      elements.translationApprovalStatus.textContent = `Документ уже переведён. Изменено сегментов: ${changedCount}. Можно перевести только их или заново перевести весь документ.`
      elements.translationApprovalSubmit.textContent = `Перевести изменённые сегменты (${changedCount})`
    } else {
      elements.translationApprovalStatus.textContent = 'Документ уже переведён, изменений исходника и настроек перевода нет.'
      elements.translationApprovalSubmit.textContent = 'Перевести изменённые сегменты'
    }
  }

  function continueWithCurrentTranslation() {
    if (!state.scene?.translationCompleted || state.workflowStage !== 1) return
    closeTranslationApprovalModal(false)
    setWorkflowStage(2)
    showToast('Текущий перевод сохранён')
  }

  function closeTranslationApprovalModal(restoreFocus = true) {
    if (elements.translationApprovalModal.dataset.busy === 'true') return
    elements.translationApprovalModal.hidden = true
    restoreGlobalTranslationTools()
    if (restoreFocus) elements.workflowApprove.focus()
  }

  async function submitTranslationApproval(options = {}) {
    if (!state.scene || state.workflowStage !== 1 || elements.translationApprovalModal.dataset.busy === 'true') return
    const translated = Boolean(state.scene.translationCompleted)
    const settingsChanged = translationSettingsChanged()
    const forceRetranslate = translated && (Boolean(options.forceAll) || settingsChanged)
    duplicateSourceTranslations(state.scene)
    const candidates = !translated || forceRetranslate ? translationCandidates() : changedTranslationCandidates()
    const objectIds = candidates.map(object => object.id)
    const objectCount = objectIds.length
    if (!objectCount) {
      showToast(translated ? 'Изменённых сегментов нет' : 'В документе нет сегментов для перевода', true)
      return
    }
    elements.translationApprovalModal.dataset.busy = 'true'
    elements.translationApprovalSubmit.disabled = true
    elements.translationApprovalRetranslateAll.disabled = true
    elements.translationApprovalCancel.disabled = true
    elements.translationApprovalClose.disabled = true
    elements.translationApprovalSubmit.textContent = 'Отправляем…'
    const tabKey = state.activeTabKey
    elements.translationApprovalModal.dataset.busy = 'false'
    closeTranslationApprovalModal(false)
    elements.translationApprovalSubmit.disabled = false
    elements.translationApprovalRetranslateAll.disabled = false
    elements.translationApprovalCancel.disabled = false
    elements.translationApprovalClose.disabled = false
    refreshTranslationApprovalState()
    const tab = state.tabs.get(tabKey)
    if (tab) {
      tab.translationState = {
        status: 'running',
        requestId: ++state.translationRequestRevision,
        objectCount,
      }
      renderDocumentTabs()
      showTranslationLoading(tab)
    }
    await translateDocument({
      tabKey,
      advanceToStage: 2,
      forceRetranslate,
      objectIds,
      translationRequestId: tab?.translationState?.requestId,
    })
  }

  function approveWorkflowStage() {
    if (state.workflowStage >= 4) return
    if (state.workflowStage === 1) return openTranslationApprovalModal()
    setWorkflowStage(state.workflowStage + 1)
    showToast(`Этап ${state.workflowStage - 1} утвержден`)
  }

  function returnToPreviousWorkflowStage() {
    if (state.workflowStage <= 1) return
    setWorkflowStage(state.workflowStage - 1)
  }

  function setupInspectorPanels() {
    const inspectorBody = elements.objectInspector.parentElement
    const globalTranslationTools = inspectorBody.querySelector('.global-translation-tools')
    const finalTestingTools = inspectorBody.querySelector('#final-testing-tools')
    const exportActions = document.createElement('div')
    exportActions.className = 'final-export-actions'
    exportActions.setAttribute('aria-label', 'Выгрузка готового документа')
    elements.exportDocx.removeAttribute('role')
    elements.exportPdf.removeAttribute('role')
    exportActions.append(elements.exportDocx, elements.exportPdf)
    finalTestingTools.prepend(exportActions)
    const currentNodes = [...elements.objectInspector.children]
    const typographySelectionToolbar = elements.objectInspector.querySelector('.typography-selection-toolbar')
    const typography = elements.objectInspector.querySelector('.typography-card')
    const segmentActions = elements.objectInspector.querySelector('.segment-actions-card')
    const placement = currentNodes.find(node => (
      node.classList.contains('layout-card') && node !== typography && node !== segmentActions
    ))
    const layoutQaActions = document.createElement('div')
    layoutQaActions.className = 'layout-qa-actions'
    layoutQaActions.append(elements.qa)
    const layoutSelectionTools = document.createElement('div')
    layoutSelectionTools.className = 'layout-selection-tools'
    layoutSelectionTools.dataset.layoutSelectionContent = 'true'
    layoutSelectionTools.append(typography, segmentActions, placement)
    const batchRevisionCard = elements.objectInspector.querySelector('.segment-batch-ai-card')
    const memoryCard = elements.objectInspector.querySelector('.memory-card')
    const correctionNodes = currentNodes.filter(node => ![typographySelectionToolbar, typography, segmentActions, placement].includes(node))
    const segmentWorkspace = document.createElement('div')
    segmentWorkspace.id = 'inspector-segment-workspace'
    segmentWorkspace.className = 'inspector-segment-workspace'
    const notesIndex = correctionNodes.findIndex(node => node.id === 'segment-note')
    correctionNodes.splice(notesIndex >= 0 ? notesIndex + 1 : correctionNodes.length, 0, segmentWorkspace)
    const legacySegmentTools = document.createElement('div')
    legacySegmentTools.className = 'inspector-legacy-segment-tools'
    legacySegmentTools.hidden = true
    legacySegmentTools.append(...correctionNodes.filter(node => ![batchRevisionCard, memoryCard].includes(node)))
    for (const node of currentNodes) node.classList.remove('inspector-scope--layout', 'inspector-scope--segments')
    const globalTranslationPanel = createInspectorPanel(
      'inspector-global-translation-panel',
      'global',
      'Перевод',
      [globalTranslationTools],
    )
    const finalTestingPanel = createInspectorPanel(
      'inspector-testing-panel',
      'testing',
      'Выгрузка',
      [finalTestingTools],
    )
    const objectPanels = [
      createInspectorPanel('inspector-translation-panel', 'translation', 'Сегменты', [batchRevisionCard, memoryCard]),
      createInspectorPanel('inspector-layout-panel', 'layout', 'Типографика и расстановка', [typographySelectionToolbar, layoutSelectionTools, layoutQaActions]),
    ]
    elements.objectInspector.replaceChildren(...objectPanels, legacySegmentTools)
    inspectorBody.insertBefore(globalTranslationPanel, elements.objectInspector)
    elements.objectInspector.after(finalTestingPanel)
    elements.inspectorSegmentWorkspace = segmentWorkspace
    elements.globalTranslationTools = globalTranslationTools
    elements.globalTranslationToolsHome = globalTranslationPanel.querySelector('.inspector-section__content')
    refreshInspectorSelectionState(false)
  }

  function showToast(message, isError = false) {
    clearTimeout(state.toastTimer)
    elements.toast.textContent = message
    elements.toast.classList.toggle('is-error', isError)
    elements.toast.classList.add('is-visible')
    state.toastTimer = setTimeout(() => elements.toast.classList.remove('is-visible'), 4200)
  }

  function closeConfirmationModal(confirmed = false) {
    if (elements.confirmationModal.hidden) return
    elements.confirmationModal.hidden = true
    const request = state.confirmationRequest
    state.confirmationRequest = null
    request?.resolve(Boolean(confirmed))
    request?.restoreFocus?.focus?.({ preventScroll: true })
  }

  function requestConfirmation({
    title = 'Подтвердите действие',
    message = '',
    confirmLabel = 'Подтвердить',
    eyebrow = 'Подтверждение',
    danger = false,
  } = {}) {
    if (state.confirmationRequest) closeConfirmationModal(false)
    elements.confirmationEyebrow.textContent = eyebrow
    elements.confirmationTitle.textContent = title
    elements.confirmationDescription.textContent = message
    setNoteVariant(elements.confirmationDescription, danger ? 'danger' : 'warning')
    elements.confirmationSubmit.textContent = confirmLabel
    elements.confirmationSubmit.className = danger
      ? 'button button--danger button--danger-filled'
      : 'button button--primary'
    elements.confirmationModal.hidden = false
    return new Promise(resolve => {
      state.confirmationRequest = { resolve, restoreFocus: document.activeElement }
      requestAnimationFrame(() => elements.confirmationCancel.focus())
    })
  }

  function setNoteVariant(element, variant) {
    for (const name of ['muted', 'info', 'success', 'warning', 'danger']) element.classList.remove(`note--${name}`)
    element.classList.add(`note--${variant}`)
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
    setNoteVariant(elements.aiProviderStatus, activeReady ? 'success' : 'danger')
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
      setNoteVariant(elements.aiProviderStatus, 'danger')
      elements.aiProviderStatus.textContent = error.message
    } finally {
      elements.aitunnelModel.disabled = false
    }
  }

  async function openProviderSettings() {
    elements.aiSettingsModal.hidden = false
    setNoteVariant(elements.aiProviderStatus, 'info')
    elements.aiProviderStatus.textContent = 'Проверяем настройки…'
    try {
      await loadProviderSettings()
      await loadAitunnelModels()
    } catch (error) {
      setNoteVariant(elements.aiProviderStatus, 'danger')
      elements.aiProviderStatus.textContent = error.message
    }
  }

  function closeProviderSettings() {
    elements.aitunnelApiKey.value = ''
    elements.aiSettingsModal.hidden = true
  }

  function renderAdministrationSettings(settings) {
    state.administrationSettings = settings
    elements.chatAgentSystemPrompt.value = settings.chatAgentPrompt || ''
    elements.administrationSave.disabled = !elements.chatAgentSystemPrompt.value.trim()
    setNoteVariant(elements.administrationStatus, 'success')
    elements.administrationStatus.textContent = settings.updatedAt
      ? 'Промпт сохранён и используется чат-агентом.'
      : 'Используется базовый промпт.'
  }

  async function loadAdministrationSettings() {
    const response = await api('/api/studio/administration')
    const settings = await response.json()
    renderAdministrationSettings(settings)
    return settings
  }

  async function openAdministration() {
    elements.administrationModal.hidden = false
    elements.administrationSave.disabled = true
    setNoteVariant(elements.administrationStatus, 'info')
    elements.administrationStatus.textContent = 'Загружаем текущий промпт…'
    try {
      await loadAdministrationSettings()
      elements.chatAgentSystemPrompt.focus()
    } catch (error) {
      setNoteVariant(elements.administrationStatus, 'danger')
      elements.administrationStatus.textContent = error.message
    }
  }

  function closeAdministration() {
    elements.administrationModal.hidden = true
  }

  function resetAdministrationPrompt() {
    const prompt = state.administrationSettings?.defaultChatAgentPrompt || ''
    if (!prompt) return
    elements.chatAgentSystemPrompt.value = prompt
    elements.administrationSave.disabled = false
    setNoteVariant(elements.administrationStatus, 'info')
    elements.administrationStatus.textContent = 'Базовый промпт восстановлен в поле. Нажмите «Сохранить», чтобы применить его.'
  }

  async function saveAdministrationSettings() {
    const chatAgentPrompt = elements.chatAgentSystemPrompt.value.trim()
    if (!chatAgentPrompt) return
    elements.administrationSave.disabled = true
    setNoteVariant(elements.administrationStatus, 'info')
    elements.administrationStatus.textContent = 'Сохраняем промпт…'
    try {
      const response = await api('/api/studio/administration', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatAgentPrompt }),
      })
      renderAdministrationSettings(await response.json())
      showToast('Промпт чат-агента сохранён')
    } catch (error) {
      setNoteVariant(elements.administrationStatus, 'danger')
      elements.administrationStatus.textContent = error.message
    } finally {
      elements.administrationSave.disabled = !elements.chatAgentSystemPrompt.value.trim()
    }
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
      setNoteVariant(elements.aiProviderStatus, 'danger')
      elements.aiProviderStatus.textContent = error.message
    } finally {
      elements.saveAiSettings.disabled = false
    }
  }

  async function testAiConnection() {
    elements.testAiConnection.disabled = true
    setNoteVariant(elements.aiProviderStatus, 'info')
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
      setNoteVariant(elements.aiProviderStatus, 'success')
      elements.aiProviderStatus.textContent = result.message
      showToast('Подключение работает')
    } catch (error) {
      elements.aitunnelApiKey.value = ''
      setNoteVariant(elements.aiProviderStatus, 'danger')
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

  function normalizePageRotation(value) {
    const rotation = ((Math.trunc(Number(value) || 0) % 360) + 360) % 360
    return [0, 90, 180, 270].includes(rotation) ? rotation : 0
  }

  function rotatePageValue(value, delta) {
    return normalizePageRotation(normalizePageRotation(value) + delta)
  }

  function renderOrientationPages(container, preparation, rotations, baseRotations, onChange) {
    container.replaceChildren()
    for (const [index, page] of (preparation?.pages || []).entries()) {
      const card = document.createElement('article')
      card.className = 'orientation-page'
      const preview = document.createElement('div')
      preview.className = 'orientation-page__preview'
      const image = document.createElement('img')
      image.src = page.imageUrl
      image.alt = `Страница ${index + 1}`
      image.style.transform = `rotate(${rotatePageValue(rotations[index], -normalizePageRotation(baseRotations[index]))}deg)`
      preview.append(image)

      const footer = document.createElement('div')
      footer.className = 'orientation-page__footer'
      const label = document.createElement('strong')
      label.textContent = `Страница ${index + 1} · ${normalizePageRotation(rotations[index])}°`
      const actions = document.createElement('div')
      actions.className = 'orientation-page__rotation'
      const action = (labelText, icon, nextValue) => {
        const button = document.createElement('button')
        button.className = 'icon-button icon-button--compact'
        button.type = 'button'
        button.setAttribute('aria-label', labelText)
        button.innerHTML = iconMarkup(icon)
        button.addEventListener('click', () => onChange(index, nextValue()))
        return button
      }
      actions.append(
        action('Повернуть страницу влево', 'rotate-counterclockwise', () => rotatePageValue(rotations[index], -90)),
        action('Сбросить поворот страницы', 'refresh', () => 0),
        action('Повернуть страницу вправо', 'rotate-clockwise', () => rotatePageValue(rotations[index], 90)),
      )
      footer.append(label, actions)
      card.append(preview, footer)
      container.append(card)
    }
  }

  function renderUploadOrientation(tab) {
    if (!tab?.preparation) return
    tab.pageRotations ||= [...tab.preparation.rotations]
    renderOrientationPages(
      elements.orientationPages,
      tab.preparation,
      tab.pageRotations,
      tab.preparation.rotations,
      (index, value) => {
        tab.pageRotations[index] = value
        renderUploadOrientation(tab)
      },
    )
  }

  async function showUploadOrientation(tab, forceReload = false) {
    if (!tab) return
    if (!tab.preparation || forceReload) {
      const response = await api(`/api/studio/documents/${tab.documentId}/preparation`)
      tab.preparation = await response.json()
      tab.pageRotations = [...tab.preparation.rotations]
    }
    state.metadata = null
    state.scene = null
    elements.documentTitle.textContent = tab.preparation.title || tab.title
    elements.documentStatus.textContent = `${tab.preparation.pages.length} стр. · ожидает проверки ориентации`
    renderUploadOrientation(tab)
    setView('orientation')
    history.replaceState(null, '', `/?prepare=${tab.documentId}`)
  }

  function rotateUploadPages(delta = null) {
    const tab = state.tabs.get(state.activeTabKey)
    if (!tab?.preparation) return
    tab.pageRotations = tab.preparation.pages.map((page, index) => (
      delta == null ? 0 : rotatePageValue(tab.pageRotations[index], delta)
    ))
    renderUploadOrientation(tab)
  }

  async function startPreparedAnalysis() {
    const tab = state.tabs.get(state.activeTabKey)
    if (!tab?.preparation) return
    elements.orientationSubmit.disabled = true
    try {
      const response = await api(`/api/studio/documents/${tab.documentId}/analysis-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotations: tab.pageRotations }),
      })
      const { job } = await response.json()
      const key = tab.key
      Object.assign(tab, job, { key, jobId: job.id, documentId: job.documentId, title: tab.title, error: null })
      renderDocumentTabs()
      updateLoadingFromTab(tab)
      setView('loading')
      history.replaceState(null, '', `/?job=${job.id}`)
      scheduleJobsPoll(100)
    } catch (error) {
      showToast(error.message, true)
    } finally {
      elements.orientationSubmit.disabled = false
    }
  }

  function setView(name) {
    elements.uploadView.hidden = name !== 'upload'
    elements.loadingView.hidden = name !== 'loading'
    elements.orientationView.hidden = name !== 'orientation'
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
      const translating = tab.translationState?.status === 'running'
      button.dataset.status = translating ? 'running' : tab.status
      button.title = translating ? `${tab.title} · переводится` : (tab.error || tab.title)
      const dot = document.createElement('span')
      dot.className = 'document-tab__dot'
      const title = document.createElement('span')
      title.className = 'document-tab__title'
      title.textContent = translating
        ? `${tab.title} · переводится`
        : tab.status === 'awaiting-orientation'
        ? `${tab.title} · проверьте страницы`
        : tab.status === 'running' || tab.status === 'queued'
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
    elements.loadingView.classList.remove('is-indeterminate')
    elements.loadingView.classList.toggle('is-failed', failed || cancelled)
    elements.loadingTitle.textContent = failed ? 'Обработка остановлена' : cancelled ? 'Обработка отменена' : 'Готовим документ к работе'
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
    elements.loadingHint.textContent = 'Сложный многостраничный скан может обрабатываться несколько минут.'
    elements.retryJob.hidden = !((failed || cancelled) && tab?.jobId)
    elements.retryJob.disabled = false
    elements.cancelJob.hidden = !(pending && tab?.jobId)
    elements.cancelJob.disabled = false
  }

  function showTranslationLoading(tabOrObjectCount) {
    const translationState = typeof tabOrObjectCount === 'object'
      ? tabOrObjectCount?.translationState
      : null
    const objectCount = translationState?.objectCount ?? tabOrObjectCount
    elements.loadingView.classList.remove('is-failed')
    elements.loadingView.classList.add('is-indeterminate')
    elements.loadingTitle.textContent = 'Переводим документ'
    elements.loadingMessage.textContent = 'Проверяем Базу знаний и переводим активные сегменты…'
    elements.loadingProgress.style.width = '35%'
    elements.loadingProgressLabel.textContent = 'Выполняется'
    elements.loadingProgressDetails.textContent = `Сегментов: ${objectCount}`
    elements.loadingProgressDetails.hidden = false
    elements.loadingHint.textContent = 'Перевод большого документа может занять несколько минут.'
    elements.retryJob.hidden = true
    elements.cancelJob.hidden = true
    setView('loading')
  }

  function rememberCurrentDocument() {
    const tab = state.tabs.get(state.activeTabKey)
    if (tab?.status === 'completed' && state.scene && state.metadata) {
      tab.documentData = { metadata: state.metadata, scene: state.scene }
      tab.workspaceState = {
        selectedIds: [...state.selected],
        translationSelectedIds: [...state.translationSelected],
        activePage: state.activePage,
        zoom: state.zoom,
        sourceZoom: state.sourceZoom,
        sourceCollapsed: state.sourceCollapsed,
        activeInspectorPanel: state.activeInspectorPanel,
        history: [...state.history],
        future: [...state.future],
        canvasScrollLeft: elements.canvasScroll.scrollLeft,
        canvasScrollTop: elements.canvasScroll.scrollTop,
        sourceScrollLeft: elements.sourcePreviewScroll.scrollLeft,
        sourceScrollTop: elements.sourcePreviewScroll.scrollTop,
      }
    }
  }

  async function activateTab(key, forceReload = false) {
    const tab = state.tabs.get(key)
    if (!tab) return
    const activationRevision = ++state.tabActivationRevision
    if (key !== state.activeTabKey) {
      rememberCurrentDocument()
      if (state.saveTimer) {
        try { await saveScene(true) } catch {}
      }
    }
    if (activationRevision !== state.tabActivationRevision || !state.tabs.has(key)) return
    state.activeTabKey = key
    renderDocumentTabs()
    if (tab.status === 'failed' || tab.status === 'cancelled') {
      setView('loading')
      updateLoadingFromTab(tab)
      elements.loadingProgressLabel.textContent = 'Ошибка'
      return
    }
    if (tab.status === 'awaiting-orientation' || (tab.status === 'completed' && tab.kind === 'document-preparation')) {
      tab.status = 'awaiting-orientation'
      try {
        await showUploadOrientation(tab, forceReload)
        renderDocumentTabs()
      } catch (error) {
        tab.status = 'failed'
        tab.error = error.message
        renderDocumentTabs()
        setView('loading')
        updateLoadingFromTab(tab)
      }
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
      if (activationRevision !== state.tabActivationRevision || state.activeTabKey !== key) return
      openDocument(tab.documentData)
      if (tab.translationState?.status === 'running') {
        showTranslationLoading(tab)
      }
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
      state.tabActivationRevision += 1
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
    if (!pendingDocument) return
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
            if (job.kind === 'document-preparation') {
              tab.status = 'awaiting-orientation'
              await showUploadOrientation(tab, true)
              showToast('Страницы подготовлены. Проверьте их ориентацию')
            } else {
              await activateTab(tab.key, true)
              showToast(`Документ готов: ${job.message}`)
            }
          } else updateLoadingFromTab(tab)
        }
      } catch (error) {
        tab.status = 'failed'
        tab.error = error.message
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
      const preparationsResponse = await api('/api/studio/preparations')
      const { preparations } = await preparationsResponse.json()
      for (const preparation of Array.isArray(preparations) ? preparations : []) {
        if (!/^[a-f0-9]{32}$/.test(preparation?.documentId || '')) continue
        const key = `preparation-${preparation.documentId}`
        if (state.tabs.has(key)) continue
        state.tabs.set(key, {
          key, jobId: null, kind: 'document-preparation', documentId: preparation.documentId,
          title: preparation.title || preparation.filename || 'Документ', status: 'awaiting-orientation', progress: 100,
          preparation, pageRotations: [...preparation.rotations],
        })
      }
    } catch {}
    try {
      const response = await api('/api/studio/jobs')
      const { jobs } = await response.json()
      for (const job of Array.isArray(jobs) ? jobs : []) {
        if (!['queued', 'running'].includes(job?.status) || !/^[a-f0-9]{32}$/.test(job?.id || '')) continue
        if (job.kind === 'layout-review') continue
        if (!['document-preparation', 'document-analysis'].includes(job.kind)) continue
        state.tabs.set(job.id, { key: job.id, jobId: job.id, title: job.title || 'Документ', ...job })
      }
    } catch {}
    renderDocumentTabs()
    scheduleJobsPoll(100)
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
    if (!await requestConfirmation({
      title: 'Удалить документ?',
      message: `Документ «${title}» будет удалён без возможности восстановления.`,
      confirmLabel: 'Удалить документ',
      eyebrow: 'Опасное действие',
      danger: true,
    })) return
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
    const workspaceState = activeTab?.workspaceState
    state.metadata = documentData.metadata
    state.scene = documentData.scene
    initializeScenePageMetadata(state.scene)
    const objectIds = new Set(state.scene.objects.map(object => object.id))
    state.selected = new Set((workspaceState?.selectedIds || []).filter(id => objectIds.has(id)))
    state.translationSelected = new Set(
      (workspaceState?.translationSelectedIds || [...(activeTab?.translationSelected || [])])
        .filter(id => objectIds.has(id)),
    )
    state.history = Array.isArray(workspaceState?.history) ? [...workspaceState.history] : []
    state.future = Array.isArray(workspaceState?.future) ? [...workspaceState.future] : []
    state.sceneEditRevision = 0
    state.activePage = Number.isInteger(workspaceState?.activePage)
      ? Math.max(0, Math.min(workspaceState.activePage, state.scene.pages.length - 1))
      : 0
    state.zoom = Number.isFinite(workspaceState?.zoom) ? workspaceState.zoom : 1
    state.sourceZoom = Number.isFinite(workspaceState?.sourceZoom) ? workspaceState.sourceZoom : .5
    state.sourceCollapsed = workspaceState?.sourceCollapsed ?? true
    state.activeInspectorPanel = workspaceState?.activeInspectorPanel || state.activeInspectorPanel
    state.workflowStage = normalizeWorkflowStage(state.scene)
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
    elements.batchRevisionInstruction.value = state.scene.batchRevisionInstruction || ''
    refreshGlobalInstructionControls()
    refreshBatchRevisionControls()
    loadKnowledgeBase().catch(() => {})
    const recognition = state.scene.recognition
    const recognitionSummary = recognition?.mode === 'codex'
      ? `Документ полностью разобран агентом${recognition.model ? ` ${recognition.model}` : ''}.`
      : 'Документ распознан локальным анализатором.'
    elements.agentStatus.textContent = state.serviceStatus?.translationProviderConfigured
      ? `${recognitionSummary} Перевод будет выполнен моделью ${state.serviceStatus.translationModel}.`
      : `${recognitionSummary} API перевода пока не настроен: доступны ручной перевод и локальная БЗ.`
    elements.newDocument.hidden = false
    setView('studio')
    renderWorkflowStageState()
    let initializedLayout = false
    if (state.workflowStage === 3 && Number(state.scene.layoutInitializationVersion) < 1) {
      try {
        arrangeObjectsFromOriginal(state.scene.objects)
        initializedLayout = true
      } catch (error) {
        showToast(error.message, true)
      }
    }
    renderDocument()
    if (initializedLayout) scheduleSave()
    requestAnimationFrame(() => {
      if (activeTab?.key !== state.activeTabKey) return
      if (workspaceState) {
        elements.canvasScroll.scrollLeft = workspaceState.canvasScrollLeft || 0
        elements.canvasScroll.scrollTop = workspaceState.canvasScrollTop || 0
        elements.sourcePreviewScroll.scrollLeft = workspaceState.sourceScrollLeft || 0
        elements.sourcePreviewScroll.scrollTop = workspaceState.sourceScrollTop || 0
      }
      if (!workflowUsesSegments() && Number(state.scene.layoutInitializationVersion) < 2 && fitObjectsToRenderedContent(state.scene.objects, true)) {
        rebuildClientTables()
        scheduleSave()
      }
      fitSourceWidth()
    })
    refreshUndoButtons()
  }

  function initializeScenePageMetadata(scene) {
    for (const [index, page] of (scene?.pages || []).entries()) {
      if (page.sourcePageIndex === undefined) {
        const match = String(page.imageUrl || '').match(/\/pages\/(\d+)\/image(?:$|[?#])/)
        page.sourcePageIndex = page.isAdded || !page.imageUrl ? null : Number(match?.[1] ?? index)
      }
      if (!page.gridAvailableBounds
        || !Number.isFinite(Number(page.gridAvailableBounds.width))
        || !Number.isFinite(Number(page.gridAvailableBounds.height))) {
        page.gridAvailableBounds = {
          width: Number(page.contentBounds?.width) || 1,
          height: Number(page.contentBounds?.height) || 1,
        }
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
    const segmentsView = workflowUsesSegments()
    const gridBoundsChanged = segmentsView ? false : normalizeSceneGridBounds()
    const gridGeometryChanged = segmentsView ? false : snapObjectsToGridCells(state.scene.objects)
    rebuildClientTables()
    renderThumbnails()
    renderWorkflowStageState()
    elements.canvas.replaceChildren()
    const renderedPages = state.workflowStage === 1
      ? [...state.scene.pages].filter(page => !page.layoutContinuation).sort((left, right) => Number(left.index) - Number(right.index))
      : state.scene.pages
    const documentReviewIndexes = new Map()
    if (state.workflowStage === 1) {
      let documentReviewIndex = 0
      for (const page of renderedPages) {
        const pageObjects = state.scene.objects.filter(item => objectBelongsToReviewPage(item, page))
        for (const object of documentSourceOrder(pageObjects)) {
          documentReviewIndexes.set(object.id, documentReviewIndex)
          documentReviewIndex += 1
        }
      }
    }
    for (const page of renderedPages) {
      const shell = document.createElement('div')
      shell.className = 'studio-page-shell'
      shell.dataset.pageIndex = page.index
      const surface = document.createElement('section')
      surface.className = 'studio-page'
      if (segmentsView) surface.classList.add('studio-page--segments')
      surface.dataset.pageIndex = page.index
      surface.style.width = `${page.widthPx}px`
      surface.style.height = segmentsView ? 'auto' : `${page.heightPx}px`
      if (!segmentsView) {
        applyGridToSurface(surface)
        surface.addEventListener('pointerdown', beginMarquee)
      }

      const pageObjects = state.scene.objects.filter(item => (
        (state.workflowStage === 1 ? objectBelongsToReviewPage(item, page) : item.pageIndex === page.index && !item.excluded)
      ))
      if (segmentsView) {
        const heading = document.createElement('div')
        heading.className = 'segments-page-heading'
        const title = document.createElement('span')
        title.textContent = `Страница ${(state.workflowStage === 1 ? page.sourcePageIndex ?? page.index : page.index) + 1}`
        const count = document.createElement('small')
        const excludedCount = pageObjects.filter(object => object.excluded).length
        count.textContent = excludedCount
          ? `${pageObjects.length - excludedCount} активн. · ${excludedCount} исключ.`
          : `${pageObjects.length} сегм.`
        heading.append(title, count)
        const columnHeadings = state.workflowStage === 2 ? document.createElement('div') : null
        if (columnHeadings) {
          columnHeadings.className = 'segments-column-headings'
          const sourceHeading = document.createElement('span')
          sourceHeading.textContent = 'Распознанный исходник'
          const translationHeading = document.createElement('span')
          translationHeading.textContent = 'Перевод'
          columnHeadings.append(sourceHeading, translationHeading)
        }
        const list = document.createElement('div')
        list.className = 'segments-list'
        const orderedObjects = state.workflowStage === 1 ? documentSourceOrder(pageObjects) : visualReadingOrder(pageObjects)
        for (const [reviewIndex, object] of orderedObjects.entries()) {
          const row = document.createElement('article')
          row.className = 'segment-translation-row'
          row.dataset.objectId = object.id
          const documentReviewIndex = documentReviewIndexes.get(object.id) ?? reviewIndex
          if (state.workflowStage === 1) {
            decorateDocumentReviewSegment(row, object, documentReviewIndex)
          }
          row.append(createSegmentRowMeta(object))
          if (state.workflowStage === 2) {
            row.classList.toggle('is-translation-selected', state.translationSelected.has(object.id))
            row.classList.toggle('is-primary-selected', primarySelectedObject()?.id === object.id)
            row.append(createObjectElement(object, 'sourceText'), createObjectElement(object, 'translation'))
            const workspace = createSegmentWorkspace(object)
            if (workspace) row.append(workspace)
          } else {
            row.append(createObjectElement(object, 'sourceText', {
              documentReviewIndex: state.workflowStage === 1 ? documentReviewIndex : null,
            }))
          }
          list.append(row)
        }
        if (state.workflowStage === 1) {
          const reviewLayout = document.createElement('div')
          reviewLayout.className = 'document-review-layout'
          const segments = document.createElement('div')
          segments.className = 'document-review-segments'
          segments.append(heading, list)
          reviewLayout.append(createDocumentReviewPreview(page, orderedObjects, documentReviewIndexes), segments)
          surface.append(reviewLayout)
        } else {
          surface.append(heading)
          if (columnHeadings) surface.append(columnHeadings)
          surface.append(list)
        }
      } else {
        const boundary = document.createElement('div')
        boundary.className = 'content-boundary'
        Object.assign(boundary.style, {
          left: `${page.contentBounds.x}px`, top: `${page.contentBounds.y}px`,
          width: `${page.contentBounds.width}px`, height: `${page.contentBounds.height}px`,
        })
        const boundaryResize = document.createElement('button')
        boundaryResize.className = 'content-boundary__resize'
        boundaryResize.type = 'button'
        boundaryResize.title = 'Изменить высоту рабочей области документа'
        boundaryResize.setAttribute('aria-label', 'Изменить высоту рабочей области документа')
        if (state.workflowStage === 3) {
          boundaryResize.addEventListener('pointerdown', event => beginContentBoundaryResize(event, page.index))
          boundary.append(createGridCoordinateLabels(page), boundaryResize)
        } else boundary.append(createGridCoordinateLabels(page))
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
      elements.canvas.append(shell)
      if (state.workflowStage === 3) elements.canvas.append(createPageActions(page))
    }
    if (segmentsView) refreshSegmentsViewHeights()
    applyZoom()
    renderSourcePreview()
    refreshSelection()
    refreshTranslationSelectionControls()
    if (!segmentsView) requestAnimationFrame(expandClippedObjects)
    if (gridBoundsChanged || gridGeometryChanged) scheduleSave()
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

  function documentSourceOrder(objects) {
    return [...objects].sort((left, right) => {
      const leftOrder = Number(left.layoutSourceOrder ?? left.readingOrder) > 0
        ? Number(left.layoutSourceOrder ?? left.readingOrder) : Number.POSITIVE_INFINITY
      const rightOrder = Number(right.layoutSourceOrder ?? right.readingOrder) > 0
        ? Number(right.layoutSourceOrder ?? right.readingOrder) : Number.POSITIVE_INFINITY
      return leftOrder - rightOrder || left.y - right.y || left.x - right.x || String(left.id).localeCompare(String(right.id))
    })
  }

  function documentReviewColor(index) {
    const hue = Math.round((index * 137.508 + 218) % 360)
    return `hsl(${hue} 68% 42%)`
  }

  function objectBelongsToReviewPage(object, page) {
    return object.layoutSourcePageIndex != null && page.sourcePageIndex != null
      ? object.layoutSourcePageIndex === page.sourcePageIndex : object.pageIndex === page.index
  }

  function setDocumentReviewHighlight(objectId, active) {
    for (const node of elements.canvas.querySelectorAll(`[data-review-object-id="${CSS.escape(objectId)}"]`)) {
      node.classList.toggle('is-review-highlighted', active)
    }
  }

  function bindDocumentReviewPair(node, objectId) {
    node.addEventListener('pointerenter', () => setDocumentReviewHighlight(objectId, true))
    node.addEventListener('pointerleave', () => setDocumentReviewHighlight(objectId, false))
  }

  function decorateDocumentReviewSegment(row, object, index) {
    row.classList.add('document-review-segment')
    row.classList.toggle('is-excluded', object.excluded)
    row.dataset.reviewObjectId = object.id
    row.style.setProperty('--segment-review-color', documentReviewColor(index))
    if (!object.excluded) bindDocumentReviewPair(row, object.id)
  }

  function createDocumentReviewExclusionAction(object, index) {
    const objectId = object.id
    const restore = Boolean(object.excluded)
    const number = index + 1
    const action = document.createElement('button')
    action.className = `icon-button icon-button--small document-review-segment__action ${restore ? 'icon-button--accent' : 'icon-button--danger'}`
    action.type = 'button'
    action.innerHTML = iconMarkup(restore ? 'refresh' : 'trash')
    action.title = restore ? 'Восстановить сегмент' : 'Исключить сегмент'
    action.setAttribute('aria-label', action.title)
    action.addEventListener('pointerdown', event => {
      // Keep focus in the editor until click is delivered. Otherwise the blur
      // renderer replaces this button between pointerdown and click.
      event.preventDefault()
      event.stopPropagation()
    })
    action.addEventListener('click', async event => {
      event.preventDefault()
      event.stopPropagation()
      const confirmed = await requestConfirmation(restore ? {
        title: `Восстановить сегмент ${number}?`,
        message: 'Сегмент снова станет редактируемым и вернётся в дальнейшую работу с документом.',
        confirmLabel: 'Восстановить',
      } : {
        title: `Исключить сегмент ${number}?`,
        message: 'Сегмент останется в документе, но станет неактивным и не попадёт в перевод или экспорт.',
        confirmLabel: 'Исключить',
        eyebrow: 'Изменение документа',
        danger: true,
      })
      if (!confirmed) return
      const currentObject = state.scene?.objects.find(item => item.id === objectId)
      if (!currentObject) {
        showToast('Сегмент больше не найден в документе', true)
        return
      }
      checkpoint()
      currentObject.excluded = !restore
      state.selected.delete(objectId)
      state.translationSelected.delete(objectId)
      renderDocument()
      scheduleSave()
      showToast(restore ? `Сегмент ${number} восстановлен` : `Сегмент ${number} исключён из работы`)
    })
    return action
  }

  function documentReviewSourceFrame(page) {
    const frame = page?.sourceFrame
    const width = Number(frame?.width)
    const height = Number(frame?.height)
    if (width > 0 && height > 0) {
      return {
        x: Number(frame.x) || 0,
        y: Number(frame.y) || 0,
        width,
        height,
      }
    }
    return { x: 0, y: 0, width: page.widthPx, height: page.heightPx }
  }

  function applyDocumentReviewZoom(preview, page, nextZoom, options = {}) {
    const viewport = preview.querySelector('.document-review-preview__viewport')
    const pageNode = preview.querySelector('.document-review-preview__page')
    if (!viewport || !pageNode) return
    const previousZoom = Number(preview.dataset.reviewZoom) || 1
    const next = Math.min(3, Math.max(.15, Number(nextZoom) || 1))
    const anchor = options.anchorEvent
      ? captureZoomAnchor(viewport, pageNode, options.anchorEvent, previousZoom)
      : null
    preview.dataset.reviewZoom = String(next)
    preview.dataset.reviewZoomMode = options.mode || 'manual'
    const sourceFrame = documentReviewSourceFrame(page)
    pageNode.style.width = `${sourceFrame.width * next}px`
    const output = preview.querySelector('.document-review-controls output')
    if (output) output.value = `${Math.round(next * 100)}%`
    restoreZoomAnchor(viewport, anchor, next)
  }

  function fitDocumentReviewPreview(preview, page) {
    const viewport = preview.querySelector('.document-review-preview__viewport')
    if (!viewport?.clientWidth || !viewport.clientHeight) return
    const sourceFrame = documentReviewSourceFrame(page)
    const horizontal = (viewport.clientWidth - 2) / sourceFrame.width
    const vertical = (viewport.clientHeight - 2) / sourceFrame.height
    applyDocumentReviewZoom(preview, page, Math.min(horizontal, vertical), { mode: 'fit' })
  }

  function fitVisibleDocumentReviewPreviews() {
    if (state.workflowStage !== 1 || !state.scene) return
    for (const preview of elements.canvas.querySelectorAll('.document-review-preview[data-page-index]')) {
      if (preview.dataset.reviewZoomMode !== 'fit') continue
      const pageIndex = Number(preview.dataset.pageIndex)
      const page = state.scene.pages.find(item => item.index === pageIndex)
      if (page) fitDocumentReviewPreview(preview, page)
    }
  }

  function createDocumentReviewControls(preview, page) {
    const controls = document.createElement('div')
    controls.className = 'source-preview-controls document-review-controls'
    controls.setAttribute('aria-label', `Масштаб оригинала страницы ${page.index + 1}`)
    const zoomButton = (icon, label, handler) => {
      const button = document.createElement('button')
      button.className = 'icon-button icon-button--compact'
      button.type = 'button'
      button.title = label
      button.setAttribute('aria-label', label)
      button.innerHTML = iconMarkup(icon)
      button.addEventListener('click', handler)
      return button
    }
    const zoomOut = zoomButton('minus', 'Уменьшить оригинал', () => {
      applyDocumentReviewZoom(preview, page, (Number(preview.dataset.reviewZoom) || 1) - .1)
    })
    const output = document.createElement('output')
    output.value = '100%'
    output.setAttribute('aria-live', 'polite')
    const zoomIn = zoomButton('plus', 'Увеличить оригинал', () => {
      applyDocumentReviewZoom(preview, page, (Number(preview.dataset.reviewZoom) || 1) + .1)
    })
    const actual = document.createElement('button')
    actual.className = 'compact-button source-preview-controls__actual'
    actual.type = 'button'
    actual.title = 'Масштаб оригинала 100%'
    actual.textContent = '100%'
    actual.addEventListener('click', () => applyDocumentReviewZoom(preview, page, 1))
    const fit = zoomButton('maximize', 'Вписать оригинал', () => fitDocumentReviewPreview(preview, page))
    controls.append(zoomOut, output, zoomIn, actual, fit)
    return controls
  }

  function bindDocumentReviewPan(viewport) {
    let drag = null
    const finish = event => {
      if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return
      if (drag.pointerId != null && viewport.hasPointerCapture?.(drag.pointerId)) {
        viewport.releasePointerCapture(drag.pointerId)
      }
      drag = null
      viewport.classList.remove('is-panning')
    }
    viewport.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      }
      viewport.setPointerCapture?.(event.pointerId)
      viewport.classList.add('is-panning')
      event.preventDefault()
    })
    viewport.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.pointerId) return
      viewport.scrollLeft = drag.scrollLeft + drag.x - event.clientX
      viewport.scrollTop = drag.scrollTop + drag.y - event.clientY
      event.preventDefault()
    })
    viewport.addEventListener('pointerup', finish)
    viewport.addEventListener('pointercancel', finish)
    viewport.addEventListener('lostpointercapture', finish)
  }

  function createDocumentReviewPreview(page, objects, reviewIndexes = new Map()) {
    const preview = document.createElement('aside')
    preview.className = 'document-review-preview'
    preview.dataset.pageIndex = String(page.index)
    preview.setAttribute('aria-label', `Оригинал страницы ${page.index + 1} с пинами сегментов`)
    const canvas = document.createElement('div')
    canvas.className = 'document-review-preview__canvas'
    const viewport = document.createElement('div')
    viewport.className = 'document-review-preview__viewport'
    const pageNode = document.createElement('div')
    pageNode.className = 'document-review-preview__page'
    const sourceFrame = documentReviewSourceFrame(page)
    pageNode.style.aspectRatio = `${sourceFrame.width} / ${sourceFrame.height}`
    pageNode.style.setProperty('--review-page-ratio', String(sourceFrame.width / sourceFrame.height))
    let magnifier = null
    let magnifierScene = null
    if (page.imageUrl) {
      const image = document.createElement('img')
      image.src = page.imageUrl
      image.alt = `Оригинал страницы ${page.index + 1}`
      image.draggable = false
      Object.assign(image.style, {
        left: '0%',
        top: '0%',
        width: '100%',
        height: '100%',
      })
      pageNode.append(image)
      magnifier = document.createElement('div')
      magnifier.className = 'document-review-magnifier'
      magnifier.setAttribute('aria-hidden', 'true')
      magnifierScene = document.createElement('div')
      magnifierScene.className = 'document-review-magnifier__scene'
      const magnifierImage = image.cloneNode()
      magnifierImage.alt = ''
      magnifierImage.setAttribute('aria-hidden', 'true')
      magnifierScene.append(magnifierImage)
      magnifier.append(magnifierScene)
    } else {
      const empty = document.createElement('span')
      empty.className = 'document-review-preview__empty'
      empty.textContent = 'Для этой страницы нет изображения оригинала'
      pageNode.append(empty)
    }
    for (const [pageIndex, object] of objects.entries()) {
      const index = reviewIndexes.get(object.id) ?? pageIndex
      const pin = document.createElement('button')
      pin.className = 'document-review-pin'
      pin.type = 'button'
      pin.disabled = Boolean(object.excluded)
      pin.classList.toggle('is-excluded', object.excluded)
      pin.dataset.reviewObjectId = object.id
      pin.style.setProperty('--segment-review-color', documentReviewColor(index))
      const sourceRegions = Array.isArray(object.sourceRegions) ? object.sourceRegions.filter(region => (
        Number.isFinite(Number(region?.x)) && Number.isFinite(Number(region?.y))
        && Number.isFinite(Number(region?.width)) && Number.isFinite(Number(region?.height))
        && Number(region.width) > 0 && Number(region.height) > 0
      )) : []
      let anchorX
      let anchorY
      if (sourceRegions.length) {
        const left = Math.min(...sourceRegions.map(region => Number(region.x)))
        const top = Math.min(...sourceRegions.map(region => Number(region.y)))
        const right = Math.max(...sourceRegions.map(region => Number(region.x) + Number(region.width)))
        const bottom = Math.max(...sourceRegions.map(region => Number(region.y) + Number(region.height)))
        anchorX = Number(sourceFrame.x) + ((left + right) / 2) * Number(sourceFrame.width)
        anchorY = Number(sourceFrame.y) + ((top + bottom) / 2) * Number(sourceFrame.height)
      } else {
        const bounds = object.originalBounds || object
        anchorX = Number(bounds.x) + Number(bounds.width) / 2
        anchorY = Number(bounds.y) + Number(bounds.height) / 2
      }
      Object.assign(pin.style, {
        left: `${Math.max(0, Math.min(1, (anchorX - sourceFrame.x) / sourceFrame.width)) * 100}%`,
        top: `${Math.max(0, Math.min(1, (anchorY - sourceFrame.y) / sourceFrame.height)) * 100}%`,
      })
      pin.innerHTML = `${iconMarkup('map-pin')}<span>${index + 1}</span>`
      pin.title = `Сегмент ${index + 1}`
      pin.setAttribute('aria-label', `Перейти к сегменту ${index + 1}`)
      if (!object.excluded) bindDocumentReviewPair(pin, object.id)
      pin.addEventListener('click', () => {
        const row = elements.canvas.querySelector(`.document-review-segment[data-object-id="${CSS.escape(object.id)}"]`)
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        row?.querySelector('.scene-object__content')?.focus({ preventScroll: true })
      })
      pageNode.append(pin)
    }
    viewport.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      const factor = Math.exp(-normalizedWheelDelta(event) * .0015)
      applyDocumentReviewZoom(
        preview,
        page,
        (Number(preview.dataset.reviewZoom) || 1) * factor,
        { anchorEvent: event },
      )
    }, { passive: false })
    bindDocumentReviewPan(viewport)
    viewport.append(pageNode)
    canvas.append(viewport, createDocumentReviewControls(preview, page))
    preview.append(canvas)
    if (magnifier && magnifierScene) {
      const magnification = 2.5
      const updateMagnifier = event => {
        const pageRect = pageNode.getBoundingClientRect()
        if (!pageRect.width || !pageRect.height) return
        const xRatio = Math.max(0, Math.min(1, (event.clientX - pageRect.left) / pageRect.width))
        const yRatio = Math.max(0, Math.min(1, (event.clientY - pageRect.top) / pageRect.height))
        const sceneWidth = pageRect.width * magnification
        const sceneHeight = pageRect.height * magnification
        magnifierScene.style.width = `${sceneWidth}px`
        magnifierScene.style.height = `${sceneHeight}px`
        magnifierScene.style.transform = `translate(${magnifier.clientWidth / 2 - xRatio * sceneWidth}px, ${magnifier.clientHeight / 2 - yRatio * sceneHeight}px)`
        magnifier.classList.add('is-visible')
        magnifier.setAttribute('aria-hidden', 'false')
      }
      pageNode.addEventListener('pointerenter', updateMagnifier)
      pageNode.addEventListener('pointermove', updateMagnifier)
      pageNode.addEventListener('pointerleave', () => {
        magnifier.classList.remove('is-visible')
        magnifier.setAttribute('aria-hidden', 'true')
      })
      preview.append(magnifier)
    }
    requestAnimationFrame(() => fitDocumentReviewPreview(preview, page))
    return preview
  }

  function gridColumnLabel(index) {
    let value = Math.max(0, Math.trunc(index)) + 1
    let label = ''
    while (value > 0) {
      value -= 1
      label = String.fromCharCode(65 + (value % 26)) + label
      value = Math.floor(value / 26)
    }
    return label
  }

  function createGridCoordinateLabels(page) {
    const labels = document.createElement('div')
    labels.className = 'grid-coordinate-labels'
    labels.setAttribute('aria-hidden', 'true')
    const { outerSize, outerColumns, outerRows } = currentGridMetrics(page)
    for (let index = 0; index < outerColumns; index += 1) {
      const label = document.createElement('span')
      label.className = 'grid-coordinate-label grid-coordinate-label--column'
      label.textContent = gridColumnLabel(index)
      Object.assign(label.style, { left: `${index * outerSize}px`, width: `${outerSize}px` })
      labels.append(label)
    }
    for (let index = 0; index < outerRows; index += 1) {
      const label = document.createElement('span')
      label.className = 'grid-coordinate-label grid-coordinate-label--row'
      label.textContent = String(index + 1)
      Object.assign(label.style, { top: `${index * outerSize}px`, height: `${outerSize}px` })
      labels.append(label)
    }
    return labels
  }

  function sourcePageForWorkspacePage(workspacePage = state.scene?.pages?.[state.activePage]) {
    if (!state.scene || !workspacePage || workspacePage.imageUrl) return workspacePage || state.scene?.pages?.[0]
    const pageObjects = state.scene.objects.filter(object => object.pageIndex === workspacePage.index)
    const primary = primarySelectedObject()
    const selectedSourceIndex = primary?.pageIndex === workspacePage.index && Number.isInteger(primary.layoutSourcePageIndex)
      ? primary.layoutSourcePageIndex
      : null
    const sourceCounts = new Map()
    for (const object of pageObjects) {
      if (!Number.isInteger(object.layoutSourcePageIndex)) continue
      sourceCounts.set(object.layoutSourcePageIndex, (sourceCounts.get(object.layoutSourcePageIndex) || 0) + 1)
    }
    const dominantSourceIndex = selectedSourceIndex ?? [...sourceCounts]
      .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0]
    const sourcePage = dominantSourceIndex == null ? null : state.scene.pages.find(page => (
      page.sourcePageIndex === dominantSourceIndex && page.imageUrl
    ))
    if (sourcePage) return sourcePage
    if (workspacePage.layoutContinuation) {
      for (let index = workspacePage.index - 1; index >= 0; index -= 1) {
        const previous = state.scene.pages[index]
        if (previous?.imageUrl) return previous
      }
    }
    return workspacePage
  }

  function renderSourcePreview() {
    if (!state.scene || !elements.sourcePreviewCanvas) return
    const workspacePage = state.scene.pages[state.activePage] || state.scene.pages[0]
    const page = sourcePageForWorkspacePage(workspacePage)
    const renderedPageKey = `${workspacePage.index}:${page.index}:${page.sourcePageIndex ?? 'blank'}`
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
      image.alt = `Оригинал страницы ${(page.sourcePageIndex ?? page.index) + 1}`
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
    const page = sourcePageForWorkspacePage()
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
    const page = sourcePageForWorkspacePage()
    setSourceZoom((elements.sourcePreviewScroll.clientWidth - 56) / page.widthPx)
  }

  function renderSourceLightbox() {
    if (!state.scene || elements.sourceLightbox.hidden) return
    const workspacePage = state.scene.pages[state.activePage] || state.scene.pages[0]
    const page = sourcePageForWorkspacePage(workspacePage)
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
      image.alt = `Оригинал страницы ${(page.sourcePageIndex ?? page.index) + 1}`
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
    elements.sourceLightboxTitle.textContent = workspacePage === page
      ? `${state.scene.title || 'Оригинал документа'} · страница ${page.index + 1} из ${state.scene.pages.length}`
      : `${state.scene.title || 'Оригинал документа'} · оригинал страницы ${(page.sourcePageIndex ?? page.index) + 1} · лист макета ${workspacePage.index + 1} из ${state.scene.pages.length}`
    elements.sourceLightboxPrevious.disabled = state.activePage <= 0
    elements.sourceLightboxNext.disabled = state.activePage >= state.scene.pages.length - 1
    applySourceLightboxZoom()
  }

  function applySourceLightboxZoom() {
    if (!state.scene || elements.sourceLightbox.hidden) return
    const page = sourcePageForWorkspacePage()
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
    const page = sourcePageForWorkspacePage()
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
    const thumbnailPages = state.scene.pages.filter(page => !page.layoutContinuation)
    for (const [thumbnailIndex, page] of thumbnailPages.entries()) {
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
      label.textContent = String(thumbnailIndex + 1)
      button.setAttribute('aria-label', `Страница ${thumbnailIndex + 1}`)
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

  function setObjectType(object, type) {
    object.type = type
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
  }

  function translationCandidates(scene = state.scene) {
    return scene?.objects.filter(object => (
      !object.excluded && isTranslatableType(object.type) && hasTranslationSource(object)
    )) || []
  }

  function selectableSegmentObjects(scene = state.scene) {
    if (state.workflowStage === 2) return scene?.objects.filter(object => !object.excluded) || []
    return translationCandidates(scene)
  }

  function rememberTranslationSelection() {
    const activeTab = state.tabs.get(state.activeTabKey)
    if (activeTab) activeTab.translationSelected = state.translationSelected
  }

  function refreshTranslationSelectionControls() {
    const candidates = translationCandidates()
    const selectableObjects = selectableSegmentObjects()
    const validIds = new Set(selectableObjects.map(object => object.id))
    state.translationSelected = new Set([...state.translationSelected].filter(id => validIds.has(id)))
    rememberTranslationSelection()
    const total = candidates.length
    elements.translate.disabled = total === 0
    elements.translate.textContent = 'Перевести документ'
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

  function knowledgeMatchesForObject(object, field = 'sourceText') {
    const ranges = []
    let offset = 0
    for (const unit of ensureObjectTranslationUnits(object)) {
      for (const match of (field === 'translation' ? unit.translationKnowledgeMatches : unit.knowledgeMatches) || []) {
        if (match.score !== 1 || (match.matchType !== 'exact' && match.matchType !== 'exact-fragment')) continue
        ranges.push({
          ...match,
          ...(field === 'translation' ? {
            sourceText: match.translation, translation: match.sourceText,
            sourceLanguage: match.targetLanguage, targetLanguage: match.sourceLanguage,
          } : {}),
          unitId: unit.id,
          canApply: (unit.knowledgeMatches || []).some(sourceMatch => sourceMatch.entryId === match.entryId),
          start: offset + match.start,
          end: offset + match.end,
        })
      }
      offset += String(unit[field] || '').length + String(unit.separatorAfter || (field === 'translation' ? ' ' : '')).length
    }
    return ranges.filter(match => match.end > match.start && match.start < String(object[field] || '').length)
  }

  function clearKnowledgeBaseStateForEditedObject(object) {
    for (const unit of ensureObjectTranslationUnits(object)) {
      unit.knowledgeMatches = []
      unit.translationKnowledgeMatches = []
      unit.memorySuggestion = null
      unit.memoryEntryId = null
      if (unit.activeTranslationSource === 'memory' || unit.activeTranslationSource === 'memory-revised') {
        unit.activeTranslationSource = 'manual'
      }
      if (unit.status === 'memory-applied' || unit.status === 'memory-suggested') unit.status = 'edited'
    }
  }

  function clearKnowledgeBasePreviewForFocusedObject(object) {
    for (const unit of ensureObjectTranslationUnits(object)) {
      unit.knowledgeMatches = []
      unit.translationKnowledgeMatches = []
      unit.memorySuggestion = null
    }
  }

  function setObjectsKnowledgeEditing(objects, editing) {
    if (editing) closeKnowledgeSuggestion()
    for (const object of objects || []) {
      for (const node of elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"]`)) {
        node.classList.toggle('is-knowledge-editing', editing)
        if (!editing && !knowledgeMatchesForObject(object).length) {
          node.querySelector('.scene-object__knowledge-icon')?.remove()
        }
      }
      for (const button of elements.canvas.querySelectorAll(`.segment-translation-row[data-object-id="${CSS.escape(object.id)}"] .segment-knowledge-suggestions`)) {
        button.disabled = editing || (!knowledgeMatchesForObject(object).length && !knowledgeMatchesForObject(object, 'translation').length)
      }
    }
  }

  function closeKnowledgeSuggestion() {
    elements.knowledgeSuggestionPopover.hidden = true
    elements.knowledgeSuggestionList.replaceChildren()
    state.activeKnowledgeSuggestion = null
  }

  async function applyKnowledgeMatch(objectId, unitId, entryId, button) {
    if (!state.metadata) return
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    const documentId = state.metadata.id
    try {
      checkpoint()
      await saveScene(true)
      const response = await api(`/api/studio/documents/${documentId}/translate/apply-memory`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectId, unitId, entryId }),
      })
      const data = await response.json()
      if (state.metadata?.id !== documentId) return
      state.scene = data.scene
      closeKnowledgeSuggestion()
      const object = state.scene.objects.find(item => item.id === objectId)
      renderDocumentWithContentFit(object ? [object] : [])
      scheduleSave()
      showToast(data.source === 'memory' ? 'Применён полный перевод из БЗ' : 'Перевод скорректирован с учётом термина БЗ')
    } catch (error) {
      button.disabled = false
      button.removeAttribute('aria-busy')
      showToast(error.message, true)
    }
  }

  function openKnowledgeSuggestionPopover(event, objectId, matches, displayedField = null) {
    if (!matches.length) return
    const object = state.scene.objects.find(item => item.id === objectId)
    const currentField = displayedField || (object ? objectOutputField(object) : 'sourceText')
    const currentIsTranslation = currentField === 'translation'
    state.activeKnowledgeSuggestion = { objectId, matches: matches.map(match => ({ unitId: match.unitId, id: match.id })) }
    elements.knowledgeSuggestionList.replaceChildren()
    const uniqueMatches = [...new Map(matches.map(match => [`${match.unitId}:${match.entryId}`, match])).values()]
    for (const match of uniqueMatches) {
      const row = document.createElement('article')
      row.className = 'knowledge-suggestion'
      const pair = document.createElement('div')
      pair.className = 'knowledge-suggestion__pair'
      const current = document.createElement('span')
      current.className = 'knowledge-suggestion__value knowledge-suggestion__value--current'
      current.dataset.language = languageLabel(currentIsTranslation ? match.targetLanguage : match.sourceLanguage)
      current.textContent = currentIsTranslation ? match.translation : match.sourceText
      const arrow = document.createElement('span')
      arrow.className = 'knowledge-suggestion__arrow'
      arrow.innerHTML = iconMarkup('arrow-right')
      const opposite = document.createElement('span')
      opposite.className = 'knowledge-suggestion__value'
      opposite.dataset.language = languageLabel(currentIsTranslation ? match.sourceLanguage : match.targetLanguage)
      opposite.textContent = currentIsTranslation ? match.sourceText : match.translation
      pair.append(current, arrow, opposite)
      const actions = document.createElement('div')
      actions.className = 'knowledge-suggestion__actions'
      const openEntry = document.createElement('button')
      openEntry.className = 'icon-button icon-button--compact icon-button--ghost'
      openEntry.type = 'button'
      openEntry.setAttribute('aria-label', 'Открыть в БЗ')
      openEntry.innerHTML = iconMarkup('database')
      openEntry.addEventListener('click', async () => {
        closeKnowledgeSuggestion()
        elements.knowledgeBaseQuery.value = match.sourceText
        await openKnowledgeBase()
        const entry = state.knowledgeBaseEntries.find(entry => entry.id === match.entryId)
        if (entry) showKnowledgeBaseEntryForm(entry)
      })
      const apply = document.createElement('button')
      apply.className = 'icon-button icon-button--compact icon-button--filled'
      apply.type = 'button'
      apply.disabled = match.canApply === false || state.workflowStage !== 2
      apply.setAttribute('aria-label', match.canApply === false ? 'Уже содержится в переводе' : state.workflowStage !== 2 ? 'Применение доступно на этапе «Сегменты»' : 'Использовать')
      apply.innerHTML = iconMarkup('check')
      apply.addEventListener('click', () => applyKnowledgeMatch(objectId, match.unitId, match.entryId, apply))
      actions.append(openEntry, apply)
      row.append(pair, actions)
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
    clearKnowledgeBasePreviewForFocusedObject(object)
    renderDocumentWithContentFit([object])
    scheduleSave()
    showToast('Использован первоначальный перевод ИИ')
    refreshKnowledgeBaseAfterSegmentEdit()
  }

  function displayedKnowledgeMatches(object, field, text) {
    return text.length ? knowledgeMatchesForObject(object, field) : []
  }

  function renderTextContent(content, object, requestedField = null, showKnowledge = true) {
    const field = requestedField || objectOutputField(object)
    const text = requestedField ? String(object[field] || '') : objectOutput(object)
    content.dataset.outputField = field
    const ranges = styleRanges(object, field).filter(range => range.end > range.start && range.start < text.length)
    const knowledgeMatches = showKnowledge ? displayedKnowledgeMatches(object, field, text) : []
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
        span.title = 'Найдена запись в Базе знаний'
        span.setAttribute('role', 'button')
        span.tabIndex = 0
        const openMatches = event => {
          if (content.closest('.scene-object')?.classList.contains('is-knowledge-editing')) return
          event.preventDefault()
          event.stopPropagation()
          openKnowledgeSuggestionPopover(event, object.id, activeMatches, field)
        }
        span.addEventListener('click', openMatches)
        // Opening a hint must not focus the editor and clear the very hint clicked.
        span.addEventListener('pointerdown', event => {
          if (!content.closest('.scene-object')?.classList.contains('is-knowledge-editing')) event.preventDefault()
        })
        span.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') openMatches(event)
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
    const textLength = sourceRange => {
      const fragment = sourceRange.cloneContents()
      for (const node of fragment.querySelectorAll?.('[data-editor-chrome]') || []) node.remove()
      return String(fragment.textContent || '').length
    }
    const start = textLength(before)
    return { objectId, field, start, end: start + textLength(range) }
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
      if (node.nodeType === Node.ELEMENT_NODE && node.matches?.('[data-editor-chrome]')) return
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

  function editableContentText(content) {
    const clone = content.cloneNode(true)
    for (const node of clone.querySelectorAll('[data-editor-chrome]')) node.remove()
    return String(clone.innerText ?? clone.textContent).replace(/\n{3,}/g, '\n\n')
  }

  function populateInstructionPresetSelect(select) {
    if (!select) return
    const current = select.value
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = state.instructionPresets.length ? 'Сохраненные инструкции…' : 'Сохраненных инструкций пока нет'
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
      const container = select.closest('.instruction-preset-picker, .segment-ai-chat__presets')
      const apply = container?.querySelector('[data-instruction-preset-apply], #instruction-preset-apply')
      if (apply) apply.disabled = !select.value
    }
    const hasGlobalSelection = Boolean(elements.instructionPresetSelect.value)
    elements.instructionPresetEdit.disabled = !hasGlobalSelection
    elements.instructionPresetDelete.disabled = !hasGlobalSelection
  }

  function refreshGlobalInstructionControls() {
    elements.instructionPresetSave.disabled = !elements.globalTranslationInstruction.value.trim()
  }

  function normalizedAiChatMessages(messages) {
    return (Array.isArray(messages) ? messages : [])
      .map(message => ({
        role: message?.role === 'user' ? 'user' : 'assistant',
        text: String(message?.text || '').trim(),
      }))
      .filter(message => message.text)
  }

  function renderAiChatMessages(container, messages, emptyText) {
    if (!container) return
    const normalized = normalizedAiChatMessages(messages)
    const visibleMessages = normalized.length
      ? normalized
      : [{ role: 'assistant', text: emptyText }]
    container.replaceChildren(...visibleMessages.map(message => {
      const bubble = document.createElement('article')
      bubble.className = `ai-chat__message ai-chat__message--${message.role}`
      const author = document.createElement('strong')
      author.className = 'ai-chat__author'
      author.textContent = message.role === 'user' ? 'Вы' : 'AI-агент'
      const text = document.createElement('p')
      text.textContent = message.text
      bubble.append(author, text)
      return bubble
    }))
    container.scrollTop = container.scrollHeight
  }

  function refreshBatchRevisionControls() {
    if (!elements.batchRevisionInstruction) return
    renderAiChatMessages(
      elements.batchRevisionMessages,
      state.scene?.batchRevisionChat,
      'Опишите нужные изменения. Если запрос неоднозначен, я задам уточняющий вопрос до исправления перевода.',
    )
    elements.batchRevisionApply.disabled = !elements.batchRevisionInstruction.value.trim()
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
        : 'Сохраненных инструкций пока нет. Создайте первую инструкцию.'
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
      meta.textContent = preset.updatedAt ? `Изменено ${new Date(preset.updatedAt).toLocaleString('ru-RU')}` : 'Сохраненная инструкция'
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
      showToast(id ? 'Сохраненная инструкция обновлена' : result.created ? 'Сохраненная инструкция создана' : 'Такая инструкция уже существует')
    } catch (error) { showToast(error.message, true) }
  }

  async function deleteInstructionPreset(preset) {
    const label = preset?.instruction.length > 80 ? `${preset.instruction.slice(0, 77)}…` : preset?.instruction
    if (!preset || !await requestConfirmation({
      title: 'Удалить сохраненную инструкцию?',
      message: `Инструкция «${label}» будет удалена из списка инструкций.`,
      confirmLabel: 'Удалить инструкцию',
      eyebrow: 'Опасное действие',
      danger: true,
    })) return
    try {
      await api(`/api/studio/translation-instructions/${encodeURIComponent(preset.id)}`, { method: 'DELETE' })
      state.instructionPresets = state.instructionPresets.filter(item => item.id !== preset.id)
      if (elements.instructionLibraryId.value === preset.id) closeInstructionLibraryForm()
      closeInstructionPresetEditor()
      refreshInstructionPresetControls()
      if (!elements.instructionLibraryModal.hidden) renderInstructionLibrary()
      showToast('Сохраненная инструкция удалена')
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
    if (!preset) return showToast('Выберите сохраненную инструкцию', true)
    input.value = appendInstruction(input.value, preset.instruction, maximum)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    showToast('Сохраненная инструкция добавлена')
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
      showToast(result.created ? 'Инструкция добавлена в сохраненные' : 'Такая инструкция уже есть в списке')
    } catch (error) { showToast(error.message, true) }
  }

  function closeInstructionPresetEditor() {
    elements.instructionPresetEditor.hidden = true
    elements.instructionPresetText.value = ''
  }

  function openInstructionPresetEditor() {
    const preset = state.instructionPresets.find(item => item.id === elements.instructionPresetSelect.value)
    if (!preset) return showToast('Выберите сохраненную инструкцию', true)
    elements.instructionPresetText.value = preset.instruction
    elements.instructionPresetEditor.hidden = false
    elements.instructionPresetText.focus()
  }

  async function updateSelectedInstructionPreset() {
    const id = elements.instructionPresetSelect.value
    const instruction = elements.instructionPresetText.value.trim()
    if (!id) return showToast('Выберите сохраненную инструкцию', true)
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
      showToast('Сохраненная инструкция обновлена')
    } catch (error) { showToast(error.message, true) }
    finally { elements.instructionPresetEditSave.disabled = false }
  }

  async function deleteSelectedInstructionPreset() {
    const preset = state.instructionPresets.find(item => item.id === elements.instructionPresetSelect.value)
    await deleteInstructionPreset(preset)
  }

  function createSegmentInstructionControl(object) {
    const control = document.createElement('div')
    control.className = 'ai-chat segment-ai-chat'
    control.addEventListener('pointerdown', event => event.stopPropagation())
    const title = document.createElement('strong')
    title.className = 'segment-ai-chat__title'
    title.textContent = 'Чат с AI по сегменту'
    const messages = document.createElement('div')
    messages.className = 'ai-chat__messages'
    messages.setAttribute('role', 'log')
    messages.setAttribute('aria-live', 'polite')
    renderAiChatMessages(
      messages,
      object.revisionChat,
      'Опишите нужное изменение этого сегмента. При необходимости я сначала задам уточняющий вопрос.',
    )
    const input = document.createElement('textarea')
    input.rows = 2
    input.maxLength = 10000
    input.value = object.translationInstruction || ''
    input.placeholder = 'Напишите сообщение или ответьте на вопрос агента'
    input.setAttribute('aria-label', `Сообщение для AI по сегменту ${object.readingOrder || object.id}`)
    input.addEventListener('pointerdown', event => event.stopPropagation())
    const presetControls = document.createElement('div')
    presetControls.className = 'segment-ai-chat__presets instruction-preset-picker'
    const presetSelect = document.createElement('select')
    presetSelect.dataset.instructionPresetSelect = 'true'
    presetSelect.setAttribute('aria-label', `Сохраненная инструкция для сегмента ${object.readingOrder || object.id}`)
    populateInstructionPresetSelect(presetSelect)
    const addPreset = document.createElement('button')
    addPreset.type = 'button'
    addPreset.className = 'icon-button icon-button--compact icon-button--ghost'
    addPreset.dataset.instructionPresetApply = 'true'
    addPreset.setAttribute('aria-label', 'Использовать инструкцию')
    addPreset.innerHTML = iconMarkup('plus')
    addPreset.disabled = true
    presetSelect.addEventListener('change', () => { addPreset.disabled = !presetSelect.value })
    addPreset.addEventListener('click', event => {
      event.preventDefault()
      applyInstructionPreset(presetSelect, input, 10000)
    })
    const savePreset = document.createElement('button')
    savePreset.type = 'button'
    savePreset.className = 'icon-button icon-button--compact icon-button--ghost'
    savePreset.setAttribute('aria-label', 'Сохранить инструкцию в список инструкций')
    savePreset.innerHTML = iconMarkup('save')
    savePreset.disabled = !input.value.trim()
    savePreset.addEventListener('click', event => {
      event.preventDefault()
      saveInstructionPreset(input.value, presetSelect)
    })
    presetControls.append(presetSelect, addPreset, savePreset)
    const composer = document.createElement('div')
    composer.className = 'ai-chat__composer'
    const send = document.createElement('button')
    send.type = 'button'
    send.className = 'button button--primary'
    send.textContent = 'Отправить'
    const refreshSendState = () => {
      object.translationInstruction = input.value.slice(0, 10000)
      send.disabled = !String(object.translation || '').trim() || !object.translationInstruction.trim()
      savePreset.disabled = !object.translationInstruction.trim()
    }
    input.addEventListener('input', () => {
      refreshSendState()
      scheduleSave()
    })
    refreshSendState()
    send.addEventListener('pointerdown', event => event.stopPropagation())
    send.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      reviseTranslations(
        [object.id],
        'selection',
        send,
        input.value,
        { kind: 'segment', objectId: object.id },
      )
    })
    composer.append(input, send)
    control.append(title, messages, presetControls, composer)
    return control
  }

  function createSegmentRowMeta(object) {
    const meta = document.createElement('div')
    meta.className = 'segment-translation-row__meta'
    const agentNotes = visibleAgentNote(object.agentNotes)
    const notes = agentNotes ? document.createElement('div') : null
    if (agentNotes) {
      notes.className = 'note note--warning note--compact segment-row-note'
      const warning = document.createElement('span')
      warning.className = 'segment-row-note__icon'
      warning.innerHTML = iconMarkup('alert-circle')
      warning.title = 'Требуется внимание'
      const notesText = document.createElement('span')
      notesText.textContent = agentNotes
      notes.append(warning, notesText)
    }
    if (notes) meta.append(notes)
    else meta.hidden = true
    return meta
  }

  function visibleAgentNote(value) {
    return String(value || '')
      .split(/\r?\n/)
      .filter(line => !/^\s*Автокоррекция макета\s*:/iu.test(line))
      .join('\n')
      .trim()
  }

  function appendRecognitionBadges(content, object, documentReviewIndex = null) {
    const badges = document.createElement('div')
    badges.className = 'segment-content-badges'
    badges.contentEditable = 'false'
    badges.dataset.editorChrome = 'true'
    badges.setAttribute('aria-label', 'Параметры распознавания сегмента')
    const type = document.createElement('span')
    type.className = 'segment-content-badge segment-content-badge--type'
    type.textContent = typeLabel(object.type)
    const confidence = document.createElement('span')
    confidence.className = 'segment-content-badge segment-content-badge--confidence'
    confidence.textContent = `Уверенность ${Math.round(object.confidence * 100)}%`
    const status = document.createElement('span')
    status.className = 'segment-content-badges__status'
    status.append(confidence)
    if (Number.isInteger(documentReviewIndex)) {
      const number = documentReviewIndex + 1
      const marker = document.createElement('span')
      marker.className = 'document-review-segment__number'
      marker.textContent = String(number)
      marker.setAttribute('aria-label', `Сегмент ${number}`)
      status.append(marker)
      if (state.workflowStage === 1) status.append(createDocumentReviewExclusionAction(object, documentReviewIndex))
    }
    badges.append(type, status)
    content.prepend(badges)
  }

  async function openKnowledgePairForm(objectId) {
    const current = state.scene?.objects.find(item => item.id === objectId)
    if (!current?.sourceText.trim() || !current.translation.trim()) return
    const draft = {
      sourceText: current.sourceText,
      translation: current.translation,
      sourceLanguage: state.scene.sourceLanguage,
      targetLanguage: state.scene.targetLanguage,
      glossaryId: state.scene.glossaryId,
    }
    await saveScene(true)
    await openKnowledgeBase()
    showKnowledgeBaseEntryForm(draft)
  }

  function appendTranslationKnowledgeBadges(content, object) {
    const badges = document.createElement('div')
    badges.className = 'segment-content-badges segment-content-badges--translation segment-knowledge-actions'
    badges.contentEditable = 'false'
    badges.dataset.editorChrome = 'true'
    badges.setAttribute('aria-label', 'Действия Базы знаний для перевода')
    const matches = [...knowledgeMatchesForObject(object), ...knowledgeMatchesForObject(object, 'translation')]
    const actions = document.createElement('div')
    actions.className = 'segment-content-badges__status'
    const suggestions = document.createElement('button')
    suggestions.type = 'button'
    suggestions.className = 'icon-button icon-button--tiny icon-button--ghost segment-knowledge-suggestions'
    suggestions.setAttribute('aria-label', 'Найденные записи в БЗ')
    suggestions.innerHTML = iconMarkup('database')
    suggestions.disabled = !matches.length
    suggestions.addEventListener('pointerdown', event => {
      event.preventDefault()
      event.stopPropagation()
    })
    suggestions.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const current = state.scene?.objects.find(item => item.id === object.id)
      if (current) openKnowledgeSuggestionPopover(event, object.id,
        [...knowledgeMatchesForObject(current), ...knowledgeMatchesForObject(current, 'translation')], 'sourceText')
    })
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'icon-button icon-button--tiny icon-button--filled segment-knowledge-add'
    add.setAttribute('aria-label', 'Добавить пару в БЗ')
    add.innerHTML = iconMarkup('plus')
    add.disabled = !object.sourceText.trim() || !object.translation.trim()
    add.addEventListener('pointerdown', event => {
      event.preventDefault()
      event.stopPropagation()
    })
    add.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      openKnowledgePairForm(object.id).catch(error => showToast(error.message, true))
    })
    actions.append(suggestions, add)
    badges.append(actions)
    content.prepend(badges)
  }

  function createAiTranslationAlternativeControl(object) {
    const aiAlternative = aiAlternativeForObject(object)
    if (!aiAlternative || aiAlternative === object.translation) return null
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
    return alternative
  }

  function createSegmentWorkspace(object) {
    const controls = [createSegmentInstructionControl(object)]
    const alternative = createAiTranslationAlternativeControl(object)
    if (alternative) controls.push(alternative)
    if (!controls.length) return null
    const workspace = document.createElement('section')
    workspace.className = 'segment-translation-workspace'
    workspace.setAttribute('aria-label', `Инструменты сегмента ${object.readingOrder || object.id}`)
    workspace.append(...controls)
    return workspace
  }

  function renderInspectorSegmentWorkspace(selection) {
    if (!elements.inspectorSegmentWorkspace) return
    elements.inspectorSegmentWorkspace.replaceChildren()
  }

  function createObjectElement(object, requestedField = null, options = {}) {
    const displayField = requestedField || objectOutputField(object)
    const editField = requestedField || 'translation'
    const node = document.createElement('article')
    node.className = 'scene-object'
    node.classList.toggle('is-excluded', object.excluded)
    node.classList.toggle('is-geometry-locked', state.workflowStage !== 3)
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
    if (!object.excluded) node.addEventListener('pointerdown', event => selectFromPointer(event, object.id))

    const badge = document.createElement('span')
    badge.className = 'scene-object__badge'
    badge.textContent = typeLabel(object.type)
    const knowledgeMatches = state.workflowStage === 1 ? [] : [...knowledgeMatchesForObject(object), ...knowledgeMatchesForObject(object, 'translation')]
    const knowledgeIndicator = knowledgeMatches.length ? document.createElement('button') : null
    if (knowledgeIndicator) {
      knowledgeIndicator.className = 'icon-button icon-button--tiny icon-button--danger icon-button--shadow scene-object__knowledge-icon'
      knowledgeIndicator.type = 'button'
      knowledgeIndicator.innerHTML = iconMarkup('alert-circle')
      knowledgeIndicator.title = 'Найдена запись в Базе знаний'
      knowledgeIndicator.setAttribute('aria-label', knowledgeIndicator.title)
      knowledgeIndicator.addEventListener('pointerdown', event => event.stopPropagation())
      knowledgeIndicator.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        openKnowledgeSuggestionPopover(event, object.id, knowledgeMatches, displayField)
      })
    }
    const handle = document.createElement('button')
    handle.className = 'icon-button icon-button--tiny icon-button--filled scene-object__handle'
    handle.type = 'button'
    handle.innerHTML = iconMarkup('grip-vertical')
    handle.title = 'Переместить'
    if (state.workflowStage === 3) handle.addEventListener('pointerdown', event => beginDrag(event, object.id))
    const content = document.createElement('div')
    content.className = 'scene-object__content'
    const canEditText = !object.excluded && (
      (state.workflowStage === 1 && requestedField === 'sourceText')
      || (state.workflowStage === 2 && requestedField === 'translation')
    )
    content.tabIndex = canEditText ? 0 : -1
    content.contentEditable = String(canEditText)
    content.classList.toggle('is-readonly', !canEditText)
    if (!canEditText) content.setAttribute('aria-readonly', 'true')
    else {
      content.setAttribute('role', 'textbox')
      content.setAttribute('aria-multiline', 'true')
      content.setAttribute('aria-readonly', 'false')
      content.setAttribute('aria-disabled', 'false')
    }
    content.spellcheck = true
    content.dataset.editField = editField
    renderTextContent(content, object, displayField, state.workflowStage > 1)
    if (workflowUsesSegments() && requestedField === 'sourceText') {
      appendRecognitionBadges(content, object, options.documentReviewIndex)
    } else if (state.workflowStage === 2 && requestedField === 'translation') {
      appendTranslationKnowledgeBadges(content, object)
    }
    if (canEditText && requestedField === 'translation') content.addEventListener('pointerdown', event => {
      if (String(object.translation || '').length || event.target.closest('button')) return
      event.preventDefault()
      content.focus()
      const range = document.createRange()
      range.selectNodeContents(content)
      range.collapse(false)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    })
    if (canEditText) content.addEventListener('focus', () => {
      if (!state.selected.has(object.id)) selectOnly(object.id)
      else if (primarySelectedObject()?.id !== object.id) {
        state.selected.delete(object.id)
        state.selected.add(object.id)
        refreshSelection()
      }
      if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true }
      state.sceneEditRevision += 1
      clearKnowledgeBasePreviewForFocusedObject(object)
      setObjectsKnowledgeEditing([object], true)
    })
    if (canEditText) for (const eventName of ['pointerup', 'keyup']) content.addEventListener(eventName, () => rememberTextSelection(content, object.id))
    if (canEditText) content.addEventListener('blur', () => {
      state.textCheckpoint = false
      renderTextContent(content, object, displayField)
      if (workflowUsesSegments() && requestedField === 'sourceText') {
        appendRecognitionBadges(content, object, options.documentReviewIndex)
      } else if (state.workflowStage === 2 && requestedField === 'translation') {
        appendTranslationKnowledgeBadges(content, object)
      }
      setObjectsKnowledgeEditing([object], false)
      refreshKnowledgeBaseAfterSegmentEdit()
    })
    if (canEditText) content.addEventListener('input', () => {
      setObjectsKnowledgeEditing([object], true)
      state.sceneEditRevision += 1
      object[editField] = editableContentText(content)
      const stylesField = editField === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'
      object[stylesField] = extractInlineStyles(content, object[editField])
      if (editField === 'sourceText') {
        object.translation = servicePlaceholder(object.type, object.sourceText)
        object.translationTextStyles = []
        object.translationUnits = []
        ensureObjectTranslationUnits(object)
      } else {
        let units = ensureObjectTranslationUnits(object)
        if (units.length > 1) {
          object.translationUnits = []
          units = ensureObjectTranslationUnits(object)
        }
        if (units.length === 1) {
          units[0].translation = object.translation
          units[0].status = 'edited'
          units[0].activeTranslationSource = 'manual'
          units[0].memorySuggestion = null
          units[0].memoryEntryId = null
        }
      }
      clearKnowledgeBaseStateForEditedObject(object)
      object.status = 'edited'
      node.classList.toggle('is-untranslated', !object.translation && isTranslatableType(object.type))
      if (state.selected.size === 1) {
        if (editField === 'translation') elements.translationText.value = object.translation
        else elements.sourceText.value = object.sourceText
      }
      scheduleSave()
      requestAnimationFrame(() => {
        if (workflowUsesSegments()) refreshSegmentsViewHeights()
        else fitObjectsToRenderedContent([object], true)
      })
    })
    const resize = document.createElement('span')
    resize.className = 'scene-object__resize'
    if (state.workflowStage === 3) resize.addEventListener('pointerdown', event => beginResize(event, object.id))
    node.append(badge, handle, content)
    if (knowledgeIndicator) node.append(knowledgeIndicator)
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
    if (!node || !object || object.manualHeight !== false) return false
    const content = node.querySelector('.scene-object__content')
    if (!content) return false
    // The visible content has min-height: 100%. Measuring that rendered box and
    // adding padding made every full rerender grow every segment by a few pixels.
    // The isolated probe measures only the intrinsic text at the stored width,
    // making repeated renders and drag operations geometrically idempotent.
    const requiredHeight = minimumObjectHeight(object, object.width)
    if (!Number.isFinite(requiredHeight) || requiredHeight <= object.height + 1) return false
    const page = state.scene.pages[object.pageIndex]
    const anchorRect = objectGridCellRect(object, page)
    const areaBottom = page.contentBounds.y + page.contentBounds.height
    object.height = Math.min(Math.max(12, areaBottom - object.y), Math.max(12, requiredHeight))
    snapObjectToGridCells(object)
    fitObjectAxisIntoFreeGridCells(object, 'y', anchorRect)
    positionObjectNode(node, object)
    node.style.height = `${object.height}px`
    return true
  }

  function expandClippedObjects() {
    if (!state.scene || workflowUsesSegments() || state.scene.layoutInitializationVersion >= 2) return
    let changed = false
    for (const node of elements.canvas.querySelectorAll('.scene-object')) {
      const object = state.scene.objects.find(item => item.id === node.dataset.id)
      if (object && growObjectToContent(node, object)) changed = true
    }
    if (changed) scheduleSave()
  }

  function gridAvailableBounds(page) {
    const fallback = page?.contentBounds || {}
    return {
      width: Math.max(1, Number(page?.gridAvailableBounds?.width) || Number(fallback.width) || 1),
      height: Math.max(1, Number(page?.gridAvailableBounds?.height) || Number(fallback.height) || 1),
    }
  }

  function currentGridMetrics(page = state.scene?.pages?.[state.activePage] || state.scene?.pages?.[0]) {
    const available = gridAvailableBounds(page)
    const outerSize = GRID_OUTER_SIZE
    const middleSize = outerSize / 2
    const size = outerSize / GRID_FINE_DIVISIONS
    const outerColumns = Math.max(1, Math.floor(available.width / outerSize))
    const outerRows = Math.max(1, Math.floor(available.height / outerSize))
    const columns = outerColumns * GRID_FINE_DIVISIONS
    const rows = outerRows * GRID_FINE_DIVISIONS
    return {
      size, middleSize, outerSize, columns, rows, outerColumns, outerRows,
      width: outerColumns * outerSize,
      height: outerRows * outerSize,
    }
  }

  function currentGridSize(page = state.scene?.pages?.[state.activePage] || state.scene?.pages?.[0]) {
    return currentGridMetrics(page).size
  }

  function normalizePageGridBounds(page) {
    if (!page?.contentBounds) return false
    const metrics = currentGridMetrics(page)
    const changed = Math.abs(page.contentBounds.width - metrics.width) > 0.001
      || Math.abs(page.contentBounds.height - metrics.height) > 0.001
    page.contentBounds.width = metrics.width
    page.contentBounds.height = metrics.height
    return changed
  }

  function normalizeSceneGridBounds(scene = state.scene) {
    let changed = false
    for (const page of scene?.pages || []) {
      if (normalizePageGridBounds(page)) changed = true
    }
    return changed
  }

  function snapAxisToGridCells(position, length, page, axis = 'x') {
    const size = currentGridSize(page)
    const area = page.contentBounds
    const origin = axis === 'y' ? area.y : area.x
    const extent = axis === 'y' ? area.height : area.width
    const requestedLength = Math.min(extent, Math.max(12, Number(length) || 12))
    const totalCells = Math.max(1, Math.floor(extent / size + 0.000001))
    let cells = Math.max(1, Math.min(totalCells, Math.ceil(requestedLength / size - 0.000001)))
    const requestedStartIndex = Math.round(((Number(position) || origin) - origin) / size)
    let maximumStartIndex = Math.max(0, totalCells - cells)
    let startIndex = Math.min(maximumStartIndex, Math.max(0, requestedStartIndex))
    let snappedPosition = origin + startIndex * size
    const snappedEnd = origin + (startIndex + cells) * size
    return { position: snappedPosition, length: snappedEnd - snappedPosition }
  }

  function snapObjectToGridCells(object) {
    const page = state.scene?.pages?.[object?.pageIndex]
    if (!object || !page || object.excluded) return false
    // The grid is a manual positioning aid. Rendering must never enlarge a
    // measured text box or shift the source anchor to a cell boundary.
    const horizontal = { position: Math.max(page.contentBounds.x, Math.min(object.x, page.contentBounds.x + page.contentBounds.width - object.width)), length: Math.min(object.width, page.contentBounds.width) }
    const vertical = { position: Math.max(page.contentBounds.y, Math.min(object.y, page.contentBounds.y + page.contentBounds.height - object.height)), length: Math.min(object.height, page.contentBounds.height) }
    const changed = Math.abs(object.x - horizontal.position) > 0.001
      || Math.abs(object.y - vertical.position) > 0.001
      || Math.abs(object.width - horizontal.length) > 0.001
      || Math.abs(object.height - vertical.length) > 0.001
    Object.assign(object, {
      x: horizontal.position,
      y: vertical.position,
      width: horizontal.length,
      height: vertical.length,
    })
    return changed
  }

  function snapDragPositionToGridCells(object, x, y) {
    const page = state.scene?.pages?.[object?.pageIndex]
    if (!object || !page || object.excluded) return { x, y }
    const size = currentGridSize(page)
    const area = page.contentBounds
    return {
      x: area.x + Math.round((x - area.x) / size) * size,
      y: area.y + Math.round((y - area.y) / size) * size,
    }
  }

  function snapObjectsToGridCells(objects) {
    let changed = false
    for (const object of objects || []) {
      if (snapObjectToGridCells(object)) changed = true
    }
    return changed
  }

  function objectGridCellRect(object, page = state.scene?.pages?.[object?.pageIndex]) {
    if (!object || !page) return null
    const area = page.contentBounds
    const size = currentGridSize(page)
    const { columns, rows } = currentGridMetrics(page)
    const left = Math.min(columns - 1, Math.max(0, Math.floor((object.x - area.x) / size + 0.000001)))
    const top = Math.min(rows - 1, Math.max(0, Math.floor((object.y - area.y) / size + 0.000001)))
    const right = Math.min(columns, Math.max(left + 1, Math.ceil((object.x + object.width - area.x) / size - 0.000001)))
    const bottom = Math.min(rows, Math.max(top + 1, Math.ceil((object.y + object.height - area.y) / size - 0.000001)))
    return { left, top, right, bottom, columns, rows }
  }

  function arrangeObjectsFromOriginal(objects, options = {}) {
    const targets = (objects || []).filter(object => object && !object.excluded)
    const targetIds = new Set(targets.map(object => object.id))
    const plans = []
    let addedPages = 0
    const sourcePage = object => !options.currentAnchors && object.layoutSourcePageIndex != null
      ? state.scene.pages.find(page => page.sourcePageIndex === object.layoutSourcePageIndex) || state.scene.pages[object.pageIndex]
      : state.scene.pages[object.pageIndex]
    // Build the entire plan before changing the scene. A failed measurement
    // cannot leave half a document rearranged or extra empty pages behind.
    for (const page of state.scene.pages) {
      const pageTargets = targets.filter(object => sourcePage(object) === page)
      if (!pageTargets.length) continue
      const metrics = currentGridMetrics(page)
      const layoutPage = { ...page, contentBounds: { ...page.contentBounds, width: metrics.width, height: metrics.height } }
      let boxes = pageTargets.map(object => {
        const anchor = { ...(options.currentAnchors ? object : object.originalBounds || object) }
        const size = measureSourceLayoutBox(object, layoutPage, { ...anchor, width: options.currentAnchors ? object.layoutWidthLimit || anchor.width : anchor.width })
        if (options.preserveManual && object.manualWidth) {
          size.width = object.width
          size.height = Math.ceil(measureObjectContent(object, size.width).height)
        }
        if (options.preserveManual && object.manualHeight) size.height = object.height
        const alignment = object.style?.textAlign
        const x = alignment === 'right' ? anchor.x + anchor.width - size.width
          : alignment === 'center' ? anchor.x + (anchor.width - size.width) / 2 : anchor.x
        const rowGroup = object.type === 'table_cell' && object.tableId && object.rowIndex != null
          ? `${object.tableId}:${object.rowIndex}` : null
        return {
          id: object.id, anchor, x, ...size, rowGroup, order: object.readingOrder,
          tableId: object.type === 'table_cell' ? object.tableId : null,
          columnIndex: object.type === 'table_cell' ? object.columnIndex : null,
          columnSpan: object.type === 'table_cell' ? object.columnSpan : null,
        }
      })
      boxes = window.ICATLayout.alignTableColumnsToGrid(boxes, layoutPage.contentBounds, metrics.size)
      const pageObjects = new Map(pageTargets.map(object => [object.id, object]))
      for (const box of boxes) {
        if (!box.tableId) continue
        const object = pageObjects.get(box.id)
        if (!object || (options.preserveManual && object.manualHeight)) continue
        box.height = Math.max(12, Math.ceil(measureObjectContent(object, box.width).height))
      }
      const obstacles = state.scene.objects.filter(object => !object.excluded && object.pageIndex === page.index && !targetIds.has(object.id))
      const plan = window.ICATLayout.layoutSourceFlow(boxes, layoutPage.contentBounds, obstacles)
      plans.push({ page, boxes, targets: pageTargets, ...plan })
      addedPages += plan.pageCount - 1
    }
    if (state.scene.pages.length + addedPages > 400) throw new Error('Макет превышает предел в 400 страниц.')
    normalizeSceneGridBounds()
    for (const plan of plans) {
      const baseIndex = state.scene.pages.indexOf(plan.page)
      for (let offset = 1; offset < plan.pageCount; offset += 1) {
        addBlankPageAt(baseIndex + offset, plan.page).layoutContinuation = true
      }
      for (const object of plan.targets) {
        const placement = plan.placements.get(object.id)
        const measured = plan.boxes.find(box => box.id === object.id)
        object.layoutSourcePageIndex ??= plan.page.sourcePageIndex
        object.layoutSourceOrder ??= object.readingOrder
        object.layoutWidthLimit = measured.widthLimit
        object.layoutContentKey = layoutContentKey(object)
        Object.assign(object, { x: placement.x, y: placement.y, width: placement.width, height: placement.height, pageIndex: baseIndex + placement.pageOffset })
        if (!options.preserveManual) {
          object.manualPosition = false
          object.manualWidth = false
          object.manualHeight = false
        }
      }
    }
    for (let index = state.scene.pages.length - 1; index >= 0; index -= 1) {
      if (!state.scene.pages[index].layoutContinuation || state.scene.objects.some(object => object.pageIndex === index)) continue
      state.scene.pages.splice(index, 1)
      for (const object of state.scene.objects) if (object.pageIndex > index) object.pageIndex -= 1
    }
    state.scene.layoutInitializationVersion = 4
    reindexScenePages()
    state.activePage = Math.min(state.activePage, state.scene.pages.length - 1)
    state.sourceRenderedPage = null
    return addedPages
  }

  function layoutContentKey(object) {
    const content = JSON.stringify([objectOutput(object), object.style, object.translationTextStyles, object.sourceTextStyles])
    let hash = 2166136261
    for (let index = 0; index < content.length; index += 1) hash = Math.imul(hash ^ content.charCodeAt(index), 16777619)
    return `${content.length}:${hash >>> 0}`
  }

  function measureSourceLayoutBox(object, page, anchor = object.originalBounds || object) {
    if (['image', 'logo'].includes(object.type) && !objectOutput(object).trim()) {
      return { width: anchor.width, height: anchor.height, widthLimit: anchor.width }
    }
    const area = page.contentBounds
    const minimum = measureObjectMinContentWidth(object)
    if (minimum > area.width) throw new Error(`В сегменте ${object.id} есть слово шире страницы. Измените ширину страницы или типографику.`)
    const widthLimit = Math.min(area.width, Math.max(12, anchor.width, minimum))
    let width = object.type === 'table_cell'
      ? widthLimit
      : Math.min(widthLimit, Math.max(12, Math.ceil(measureObjectContent(object).width)))
    let measured = measureObjectContent(object, width)
    // Tighten to the longest rendered line, keeping the original wrapping.
    if (object.type !== 'table_cell' && measured.inkWidth > 0 && object.style?.textAlign !== 'justify') {
      const tight = Math.min(width, Math.max(12, Math.ceil(measured.inkWidth + 8)))
      const check = measureObjectContent(object, tight)
      if (check.height <= measured.height + .5) { width = tight; measured = check }
    }
    return { width, height: Math.max(12, Math.ceil(measured.height)), widthLimit, minimumWidth: minimum }
  }

  function gridRangesOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return firstStart < secondEnd && firstEnd > secondStart
  }

  function fitObjectAxisIntoFreeGridCells(object, axis, anchorRect, reservedRects = null) {
    const page = state.scene?.pages?.[object?.pageIndex]
    if (!object || !page || !anchorRect) return false
    const horizontal = axis === 'x'
    const area = page.contentBounds
    const size = currentGridSize(page)
    const candidateRect = objectGridCellRect(object, page)
    const axisStartKey = horizontal ? 'left' : 'top'
    const axisEndKey = horizontal ? 'right' : 'bottom'
    const crossStartKey = horizontal ? 'top' : 'left'
    const crossEndKey = horizontal ? 'bottom' : 'right'
    const extent = horizontal ? candidateRect.columns : candidateRect.rows
    const requestedLength = horizontal ? object.width : object.height
    const requestedCells = Math.max(1, Math.min(extent, Math.ceil(requestedLength / size - 0.000001)))
    const anchorStart = anchorRect[axisStartKey]
    const blocked = []

    for (const obstacle of state.scene.objects) {
      if (obstacle.id === object.id || obstacle.excluded || obstacle.pageIndex !== object.pageIndex) continue
      const obstacleRect = reservedRects?.get(obstacle.id) || objectGridCellRect(obstacle, page)
      if (!gridRangesOverlap(
        candidateRect[crossStartKey], candidateRect[crossEndKey],
        obstacleRect[crossStartKey], obstacleRect[crossEndKey],
      )) continue
      let blockedStart = obstacleRect[axisStartKey]
      let blockedEnd = obstacleRect[axisEndKey]
      if (reservedRects?.has(obstacle.id)) {
        if (blockedStart >= anchorRect[axisEndKey]) {
          blockedStart = Math.round((anchorRect[axisEndKey] + blockedStart) / 2)
        } else if (blockedEnd <= anchorStart) {
          blockedEnd = Math.round((blockedEnd + anchorStart) / 2)
        } else {
          const anchorCenter = (anchorStart + anchorRect[axisEndKey]) / 2
          const obstacleCenter = (blockedStart + blockedEnd) / 2
          const boundary = Math.round((anchorCenter + obstacleCenter) / 2)
          if (obstacleCenter >= anchorCenter) blockedStart = boundary
          else blockedEnd = boundary
        }
      }
      blocked.push({ start: blockedStart, end: blockedEnd })
    }
    blocked.sort((first, second) => first.start - second.start || first.end - second.end)
    const merged = []
    for (const interval of blocked) {
      const previous = merged.at(-1)
      if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end)
      else merged.push({ ...interval })
    }
    const freeRuns = []
    let cursor = 0
    for (const interval of merged) {
      if (interval.start > cursor) freeRuns.push({ start: cursor, end: interval.start })
      cursor = Math.max(cursor, interval.end)
    }
    if (cursor < extent) freeRuns.push({ start: cursor, end: extent })
    if (!freeRuns.length) return false
    const candidates = freeRuns.map(run => {
      const cells = Math.min(requestedCells, run.end - run.start)
      const start = Math.min(run.end - cells, Math.max(run.start, anchorStart))
      return {
        ...run,
        cells,
        start,
        complete: cells === requestedCells,
        distance: Math.abs(start - anchorStart),
      }
    }).sort((first, second) => (
      first.distance - second.distance
      || Number(second.complete) - Number(first.complete)
      || second.cells - first.cells
      || first.start - second.start
    ))
    const selected = candidates[0]
    const occupiedCells = selected.cells
    const start = selected.start
    const origin = horizontal ? area.x : area.y
    const areaExtent = horizontal ? area.width : area.height
    const position = origin + start * size
    const end = Math.min(origin + areaExtent, origin + (start + occupiedCells) * size)
    const length = Math.max(0, Math.min(requestedLength, end - position))
    const previousPosition = horizontal ? object.x : object.y
    const previousLength = horizontal ? object.width : object.height
    if (horizontal) Object.assign(object, { x: position, width: length })
    else Object.assign(object, { y: position, height: length })
    return Math.abs(previousPosition - position) > 0.001 || Math.abs(previousLength - length) > 0.001
  }

  function fitObjectSizeIntoFreeGridCells(object, anchorRect = objectGridCellRect(object), reservedRects = null) {
    if (!object || !anchorRect) return false
    const requested = { x: object.x, y: object.y, width: object.width, height: object.height }
    const targetRect = objectGridCellRect(object)
    const horizontalChanged = targetRect.left !== anchorRect.left || targetRect.right !== anchorRect.right
    const verticalChanged = targetRect.top !== anchorRect.top || targetRect.bottom !== anchorRect.bottom
    if (horizontalChanged) fitObjectAxisIntoFreeGridCells(object, 'x', anchorRect, reservedRects)
    if (verticalChanged) fitObjectAxisIntoFreeGridCells(object, 'y', anchorRect, reservedRects)
    return Math.abs(requested.x - object.x) > 0.001
      || Math.abs(requested.y - object.y) > 0.001
      || Math.abs(requested.width - object.width) > 0.001
      || Math.abs(requested.height - object.height) > 0.001
  }

  function objectGridCoordinates(object) {
    const page = state.scene?.pages?.[object?.pageIndex]
    if (!object || !page) return ''
    const area = page.contentBounds
    const size = currentGridSize(page)
    const { columns, rows } = currentGridMetrics(page)
    const left = Math.min(columns - 1, Math.max(0, Math.round((object.x - area.x) / size)))
    const top = Math.min(rows - 1, Math.max(0, Math.round((object.y - area.y) / size)))
    const right = Math.min(columns - 1, Math.max(left, Math.ceil((object.x + object.width - area.x) / size - 0.000001) - 1))
    const bottom = Math.min(rows - 1, Math.max(top, Math.ceil((object.y + object.height - area.y) / size - 0.000001) - 1))
    const hierarchicalCoordinate = (column, row) => {
      const outerColumn = Math.floor(column / GRID_FINE_DIVISIONS)
      const outerRow = Math.floor(row / GRID_FINE_DIVISIONS)
      const localColumn = column % GRID_FINE_DIVISIONS
      const localRow = row % GRID_FINE_DIVISIONS
      const middleQuadrant = Math.floor(localRow / 2) * 2 + Math.floor(localColumn / 2) + 1
      const innerQuadrant = (localRow % 2) * 2 + localColumn % 2 + 1
      return `${gridColumnLabel(outerColumn)}${outerRow + 1}.${middleQuadrant}.${innerQuadrant}`
    }
    return `${hierarchicalCoordinate(left, top)}(левый верхний угол) - ${hierarchicalCoordinate(right, bottom)}(правый нижний угол)`
  }

  function refreshSegmentGridCoordinates(selection = selectedObjects()) {
    if (!elements.segmentGridCoordinates) return
    elements.segmentGridCoordinates.hidden = selection.length !== 1
    elements.segmentGridCoordinates.textContent = selection.length === 1
      ? `Координаты: ${objectGridCoordinates(selection[0])}`
      : 'Координаты: —'
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
    const visualLines = sourceLines.reduce((sum, line) => {
      const words = line.trim().split(/\s+/u).filter(Boolean)
      if (!words.length) return sum + 1
      let lines = 1
      let currentWidth = 0
      for (const word of words) {
        const wordWidth = word.length * averageCharacterWidth
        const nextWidth = currentWidth ? currentWidth + averageCharacterWidth * .5 + wordWidth : wordWidth
        if (currentWidth && nextWidth > innerWidth) {
          lines += 1
          currentWidth = wordWidth
        } else currentWidth = nextWidth
      }
      return sum + lines
    }, 0)
    return { width, height: Math.max(12, visualLines * fontSize * lineHeight + 4) }
  }

  function estimatedMinContentWidth(object) {
    const text = objectOutput(object) || ' '
    const fontSize = Math.max(6, Number(object.style?.fontSizePx) || 14)
    const longestPart = text.split(/[\s\u200b]+/u).reduce((longest, part) => Math.max(longest, part.length), 1)
    return Math.max(12, longestPart * fontSize * .56 + 10)
  }

  function measureObjectContent(object, width = null) {
    const probe = document.createElement('div')
    renderTextContent(probe, object, objectOutputField(object), false)
    probe.contentEditable = 'false'
    Object.assign(probe.style, {
      position: 'fixed', left: '-100000px', top: '0', display: 'inline-block',
      width: width == null ? 'max-content' : `${Math.max(12, width)}px`, height: 'auto',
      minWidth: '12px', minHeight: '12px', maxWidth: 'none', boxSizing: 'border-box',
      padding: '1px 3px', border: '1px solid transparent', transform: 'none', visibility: 'hidden',
      pointerEvents: 'none', overflow: 'visible', zIndex: '-1',
      whiteSpace: width == null ? 'pre' : 'pre-wrap', overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none',
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
    const textRange = document.createRange()
    textRange.selectNodeContents(probe)
    measured.inkWidth = typeof textRange.getClientRects === 'function'
      ? Math.max(0, ...Array.from(textRange.getClientRects(), rect => rect.width)) : 0
    probe.remove()
    const fallback = estimatedContentSize(object, width)
    return {
      width: measured.width > 0 ? measured.width : fallback.width,
      height: measured.height > 0 ? measured.height : fallback.height,
      inkWidth: measured.inkWidth,
    }
  }

  function measureObjectMinContentWidth(object) {
    const fallback = estimatedMinContentWidth(object)
    const probe = document.createElement('div')
    renderTextContent(probe, object, objectOutputField(object), false)
    probe.contentEditable = 'false'
    Object.assign(probe.style, {
      position: 'fixed', left: '-100000px', top: '0', display: 'inline-block',
      width: 'min-content', height: 'auto', minWidth: '12px', minHeight: '12px', maxWidth: 'none',
      boxSizing: 'border-box', padding: '1px 3px', border: '1px solid transparent', transform: 'none',
      visibility: 'hidden', pointerEvents: 'none', overflow: 'visible', zIndex: '-1',
      whiteSpace: 'pre-wrap', overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none',
      fontFamily: object.style?.fontFamily || 'Arial', fontSize: `${object.style?.fontSizePx || 14}px`,
      fontWeight: object.style?.fontWeight || 400, fontStyle: object.style?.fontStyle || 'normal',
      lineHeight: object.style?.lineHeight || 1.2, textAlign: object.style?.textAlign || 'left',
    })
    document.body.append(probe)
    const measured = probe.getBoundingClientRect().width
    probe.remove()
    return measured > 0 ? measured : fallback
  }

  function minimumObjectHeight(object, width = object.width) {
    const measured = Math.max(12, Math.ceil(measureObjectContent(object, width).height))
    return measured
  }

  function constrainObjectHeight(object, requestedHeight, width = object.width) {
    const page = state.scene.pages[object.pageIndex]
    const maximum = Math.max(12, page.contentBounds.y + page.contentBounds.height - object.y)
    const requested = Math.min(maximum, Math.max(12, requestedHeight))
    return Math.min(maximum, Math.max(minimumObjectHeight(object, width), requested))
  }

  function canFitObjectToText(object) {
    return Boolean(object && !object.excluded && object.type !== 'image' && object.type !== 'logo' && state.scene?.pages?.[object.pageIndex])
  }

  function constrainObjectToWorkArea(object) {
    const page = state.scene?.pages?.[object?.pageIndex]
    if (!object || !page) return false
    const area = page.contentBounds
    const width = Math.min(area.width, Math.max(12, Number(object.width) || 12))
    const height = Math.min(area.height, Math.max(12, Number(object.height) || 12))
    const x = Math.max(area.x, Math.min(Number(object.x) || 0, area.x + area.width - width))
    const y = Math.max(area.y, Math.min(Number(object.y) || 0, area.y + area.height - height))
    const changed = Math.abs(object.width - width) > .5 || Math.abs(object.height - height) > .5
      || Math.abs(object.x - x) > .5 || Math.abs(object.y - y) > .5
    Object.assign(object, { x, y, width, height })
    return changed
  }

  function fitObjectGeometryToContent(object, options = {}) {
    if (!canFitObjectToText(object)) return constrainObjectToWorkArea(object)
    const page = state.scene.pages[object.pageIndex]
    const area = page.contentBounds
    const fitWidth = options.forceWidth || object.manualWidth === false
    const fitHeight = options.forceHeight || object.manualHeight === false
    const natural = fitWidth ? measureObjectContent(object) : null
    const width = fitWidth
      ? Math.min(area.width, Math.max(12, Math.min(contentSize(natural.width), Math.max(object.layoutWidthLimit || object.originalBounds?.width || area.width, measureObjectMinContentWidth(object)))))
      : Math.min(area.width, Math.max(12, Number(object.width) || 12))
    const wrapped = measureObjectContent(object, width)
    const height = fitHeight
      ? Math.min(area.height, Math.max(12, contentSize(wrapped.height)))
      : Math.min(area.height, Math.max(12, Number(object.height) || 12))
    const x = Math.max(area.x, Math.min(object.x, area.x + area.width - width))
    const y = Math.max(area.y, Math.min(object.y, area.y + area.height - height))
    const changed = Math.abs(object.width - width) > .5 || Math.abs(object.height - height) > .5 || Math.abs(object.x - x) > .5 || Math.abs(object.y - y) > .5
    Object.assign(object, { x, y, width, height })
    return snapObjectToGridCells(object) || changed
  }

  function fitObjectsToRenderedContent(objects, updateNodes = false, options = {}) {
    let changed = false
    for (const object of objects) {
      if (!fitObjectGeometryToContent(object, options)) continue
      changed = true
      if (updateNodes) {
        for (const node of elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"]`)) positionObjectNode(node, object)
      }
    }
    return changed
  }

  function renderDocumentWithContentFit(objects, options = {}) {
    renderDocument()
    if (workflowUsesSegments()) return
    if (state.scene.layoutInitializationVersion >= 2 && state.workflowStage === 3) {
      const pages = new Set(objects.map(object => object.pageIndex))
      const flowObjects = state.scene.objects.filter(object => pages.has(object.pageIndex) && !object.excluded && !object.manualPosition)
      try {
        if (flowObjects.length) arrangeObjectsFromOriginal(flowObjects, { currentAnchors: true, preserveManual: true })
        renderDocument()
      } catch (error) { showToast(error.message, true) }
      return
    }
    if (fitObjectsToRenderedContent(objects, false, options)) renderDocument()
  }

  function fitSelectionToContent(mode) {
    const objects = selectedObjects().filter(canFitObjectToText)
    if (!objects.length) return showToast('Сначала выберите текстовый сегмент', true)
    cancelPointerAction()
    checkpoint()
    let limitedByOccupiedCells = 0
    const reservedRects = new Map(objects.map(object => [object.id, objectGridCellRect(object)]))
    for (const object of objects) {
      const page = state.scene.pages[object.pageIndex]
      const anchorRect = reservedRects.get(object.id)
      if (mode === 'both') {
        object.manualWidth = false
        object.manualHeight = false
        fitObjectGeometryToContent(object, { forceWidth: true, forceHeight: true })
      } else if (mode === 'width') {
        object.manualWidth = false
        fitObjectGeometryToContent(object, { forceWidth: true })
      } else if (mode === 'min-width') {
        object.manualWidth = true
        object.width = Math.min(page.contentBounds.width, Math.max(12, contentSize(measureObjectMinContentWidth(object))))
        object.x = Math.max(page.contentBounds.x, Math.min(object.x, page.contentBounds.x + page.contentBounds.width - object.width))
        fitObjectGeometryToContent(object)
      } else if (mode === 'height') {
        object.manualHeight = false
        fitObjectGeometryToContent(object, { forceHeight: true })
      }
      if (fitObjectSizeIntoFreeGridCells(object, anchorRect, reservedRects)) limitedByOccupiedCells += 1
    }
    renderDocument()
    scheduleSave()
    const label = mode === 'width' ? 'Ширина по содержимому'
      : mode === 'min-width' ? 'Минимальная ширина по содержимому'
        : mode === 'height' ? 'Высота по содержимому' : 'Ширина и высота по содержимому'
    showToast(`${label}: ${objects.length} сегм.${limitedByOccupiedCells ? ` · учтены занятые ячейки: ${limitedByOccupiedCells}` : ''}`)
  }

  function stretchSelectionToWorkArea(axis) {
    const objects = selectedObjects().filter(canFitObjectToText)
    if (!objects.length) return showToast('Сначала выберите текстовый сегмент', true)
    cancelPointerAction()
    checkpoint()
    let limitedByOccupiedCells = 0
    const reservedRects = new Map(objects.map(object => [object.id, objectGridCellRect(object)]))
    for (const object of objects) {
      const area = state.scene.pages[object.pageIndex].contentBounds
      const anchorRect = reservedRects.get(object.id)
      if (axis === 'width') {
        object.x = area.x
        object.width = area.width
        object.manualPosition = true
        object.manualWidth = true
        fitObjectGeometryToContent(object)
      } else {
        object.y = area.y
        object.height = area.height
        object.manualPosition = true
        object.manualHeight = true
        constrainObjectToWorkArea(object)
      }
      if (fitObjectSizeIntoFreeGridCells(object, anchorRect, reservedRects)) limitedByOccupiedCells += 1
    }
    renderDocument()
    scheduleSave()
    showToast(`Сегменты растянуты на ${axis === 'width' ? 'ширину' : 'высоту'} свободных ячеек: ${objects.length}${limitedByOccupiedCells ? ` · ограничено: ${limitedByOccupiedCells}` : ''}`)
  }

  function applyGridToSurface(surface) {
    const page = state.scene.pages[Number(surface.dataset.pageIndex)] || state.scene.pages[0]
    const { size, middleSize, outerSize } = currentGridMetrics(page)
    surface.style.setProperty('--grid-size', `${size}px`)
    surface.style.setProperty('--grid-size-middle', `${middleSize}px`)
    surface.style.setProperty('--grid-size-outer', `${outerSize}px`)
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
      const surface = shell.querySelector('.studio-page')
      const naturalHeight = workflowUsesSegments()
        ? Number(shell.dataset.naturalHeight || surface.scrollHeight || 120)
        : page.heightPx
      if (state.workflowStage === 1) {
        shell.style.width = '100%'
        shell.style.height = `${naturalHeight}px`
        surface.style.setProperty('--review-marker-scale', '1')
        surface.style.transform = ''
      } else {
        shell.style.width = `${page.widthPx * state.zoom}px`
        shell.style.height = `${naturalHeight * state.zoom}px`
        surface.style.setProperty('--review-marker-scale', String(1 / Math.max(.01, state.zoom)))
        surface.style.transform = `scale(${state.zoom})`
      }
    }
    elements.zoomOutput.value = state.workflowStage === 1 ? '100%' : `${Math.round(state.zoom * 100)}%`
  }

  function refreshSegmentsViewHeights() {
    if (!workflowUsesSegments()) return
    for (const shell of elements.canvas.querySelectorAll('.studio-page-shell')) {
      const surface = shell.querySelector('.studio-page--segments')
      if (!surface) continue
      surface.style.height = 'auto'
      shell.style.height = 'auto'
      const naturalHeight = Math.max(120, surface.scrollHeight || 0, surface.offsetHeight || 0)
      surface.style.height = `${naturalHeight}px`
      shell.dataset.naturalHeight = String(naturalHeight)
      shell.style.height = `${naturalHeight * state.zoom}px`
    }
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
    if (state.workflowStage === 2) {
      state.selected = new Set([id])
      const object = state.scene.objects.find(item => item.id === id)
      if (object) state.activePage = object.pageIndex
      refreshSelection()
      return
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
    renderSourcePreview()
  }

  function ensureObjectTranslationUnits(object) {
    if (!translationUnits) return []
    if (object?.type === 'signature') {
      object.translationUnits = []
      return []
    }
    return translationUnits.ensureTranslationUnits(object)
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

  function refreshSelection() {
    const candidateIds = new Set(selectableSegmentObjects().map(object => object.id))
    state.translationSelected = new Set([...state.selected].filter(id => candidateIds.has(id)))
    rememberTranslationSelection()
    refreshTranslationSelectionControls()
    const primaryId = primarySelectedObject()?.id || null
    for (const node of elements.canvas.querySelectorAll('.scene-object')) {
      node.classList.toggle('is-selected', state.selected.has(node.dataset.id))
      node.classList.toggle('is-primary-selected', node.dataset.id === primaryId)
    }
    for (const row of elements.canvas.querySelectorAll('.segment-translation-row')) {
      const objectId = row.dataset.objectId
      row.classList.toggle('is-translation-selected', state.translationSelected.has(objectId))
      row.classList.toggle('is-primary-selected', objectId === primaryId)
    }
    const selection = selectedObjects()
    refreshInspectorSelectionState(selection.length > 0)
    refreshBatchRevisionControls()
    refreshSegmentGridCoordinates(selection)
    renderInspectorSegmentWorkspace(selection)
    updateQaRefreshAvailability()
    elements.studioView.classList.remove('is-inspector-empty')
    elements.objectInspector.hidden = false
    elements.merge.disabled = selection.length < 2 || new Set(selection.map(item => item.pageIndex)).size !== 1
    const onePage = selection.length > 0 && new Set(selection.map(item => item.pageIndex)).size === 1
    document.querySelectorAll('[data-align-selection]').forEach(button => {
      const minimum = button.dataset.alignSelection.startsWith('distribute') ? 3 : 2
      button.disabled = !onePage || selection.length < minimum
    })
    document.querySelectorAll('[data-align-document]').forEach(button => { button.disabled = !onePage })
    refreshLayoutAlignmentState(selection, onePage)
    document.querySelectorAll('[data-flex-layout]').forEach(button => { button.disabled = !onePage || selection.length < 2 })
    refreshFormattingToolbar()
    refreshFormattingSelectionToggle()
    elements.segmentNote.hidden = true
    elements.tableCellFields.hidden = !selection.length || selection.some(item => item.type !== 'table_cell')
    if (!selection.length) {
      elements.objectType.value = ''
      elements.sourceText.value = ''
      elements.translationText.value = ''
      elements.confidence.textContent = '—'
      disableUnselectedLayoutControls()
      return
    }
    const first = selection[0]
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
    elements.translationText.disabled = false
    elements.translationText.title = ''
    elements.confidence.textContent = selection.length === 1 ? `${Math.round(first.confidence * 100)}%` : 'несколько'
    const agentNote = selection.length === 1 ? visibleAgentNote(first.agentNotes) : ''
    if (agentNote) {
      elements.segmentNote.textContent = agentNote
      elements.segmentNote.hidden = false
    }
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

  function snapObjectGroupsOnAxis(objects, axis) {
    for (const group of groupedByPage(objects).values()) {
      const bounds = boundsOf(group)
      const page = state.scene.pages[group[0].pageIndex]
      const area = page.contentBounds
      const horizontal = axis === 'x'
      const current = horizontal ? bounds.left : bounds.top
      const minimum = horizontal ? area.x : area.y
      const maximum = horizontal
        ? area.x + area.width - bounds.width
        : area.y + area.height - bounds.height
      const target = snapAxisPosition(current, minimum, maximum, page, axis)
      for (const object of group) {
        if (horizontal) object.x += target - current
        else object.y += target - current
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
    for (const object of objects) object.manualPosition = true
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
    for (const object of objects) object.manualPosition = true
    renderDocument()
    scheduleSave()
  }

  function proportionalAxisLengths(objects, horizontal, availableLength) {
    const minimumLength = 12
    const sourceLengths = objects.map(object => horizontal ? object.width : object.height)
    const lengths = new Array(objects.length).fill(0)
    const pending = new Set(objects.map((_, index) => index))
    let remainingLength = availableLength

    while (pending.size) {
      const sourceTotal = [...pending].reduce((sum, index) => sum + sourceLengths[index], 0)
      const scale = sourceTotal > 0 ? remainingLength / sourceTotal : 0
      const constrained = [...pending].filter(index => sourceLengths[index] * scale < minimumLength)
      if (!constrained.length) {
        for (const index of pending) lengths[index] = sourceLengths[index] * scale
        break
      }
      for (const index of constrained) {
        lengths[index] = minimumLength
        remainingLength -= minimumLength
        pending.delete(index)
      }
    }
    return lengths
  }

  function scaleObjectTypography(object, factor) {
    const scaleValue = value => Math.max(6, Math.round((Number(value) || 6) * factor * 100) / 100)
    object.style.fontSizePx = scaleValue(object.style?.fontSizePx)
    object.manualTypography = true
    for (const key of ['sourceTextStyles', 'translationTextStyles']) {
      for (const range of object[key] || []) {
        if (range.fontSizePx != null) range.fontSizePx = scaleValue(range.fontSizePx)
      }
    }
  }

  function shrinkObjectsToFitAxis(objects, horizontal, availableLength, totalLength) {
    if (totalLength <= availableLength) return false
    const nextLengths = proportionalAxisLengths(objects, horizontal, availableLength)
    objects.forEach((object, index) => {
      const previousLength = horizontal ? object.width : object.height
      const nextLength = nextLengths[index]
      const factor = previousLength > 0 ? Math.min(1, nextLength / previousLength) : 1
      if (horizontal) {
        object.width = nextLength
        object.height = Math.max(12, object.height * factor)
        object.manualWidth = true
        object.manualHeight = true
      } else {
        object.height = nextLength
        object.manualHeight = true
      }
      scaleObjectTypography(object, factor)
      if (horizontal) object.height = Math.max(object.height, estimatedContentSize(object, object.width).height)
    })
    return true
  }

  function applyFlexLayout(direction, justify) {
    const objects = selectionOnOnePage(2)
    if (!objects) return
    const page = state.scene.pages[objects[0].pageIndex]
    const horizontal = direction === 'row'
    const ordered = [...objects].sort(horizontal
      ? (left, right) => left.x - right.x || left.y - right.y
      : (top, bottom) => top.y - bottom.y || top.x - bottom.x)
    const area = { ...page.contentBounds }
    const mainStart = horizontal ? area.x : area.y
    const mainLength = horizontal ? area.width : area.height
    let totalItemLength = ordered.reduce((sum, object) => sum + (horizontal ? object.width : object.height), 0)

    checkpoint()
    const objectsWereReduced = shrinkObjectsToFitAxis(ordered, horizontal, mainLength, totalItemLength)
    totalItemLength = ordered.reduce((sum, object) => sum + (horizontal ? object.width : object.height), 0)
    const freeSpace = Math.max(0, mainLength - totalItemLength)
    let offset = 0
    let distributedGap = 0
    if (justify === 'center') offset = freeSpace / 2
    else if (justify === 'end') offset = freeSpace
    else if (justify === 'space-between' && ordered.length > 1) distributedGap = freeSpace / (ordered.length - 1)
    else if (justify === 'space-around') {
      distributedGap = freeSpace / ordered.length
      offset = freeSpace / (ordered.length * 2)
    } else if (justify === 'space-evenly') {
      distributedGap = freeSpace / (ordered.length + 1)
      offset = freeSpace / (ordered.length + 1)
    }

    let cursor = mainStart + offset
    for (const object of ordered) {
      if (horizontal) object.x = cursor
      else object.y = cursor
      cursor += (horizontal ? object.width : object.height) + distributedGap
    }

    const shift = clampGroupShift(objects, 0, 0)
    for (const object of objects) {
      if (horizontal) object.x += shift.x
      else object.y += shift.y
    }
    snapObjectGroupsOnAxis(objects, horizontal ? 'x' : 'y')
    for (const object of objects) object.manualPosition = true
    renderDocument()
    scheduleSave()
    showToast(objectsWereReduced
      ? `Сегменты уменьшены и размещены по оси ${horizontal ? 'X' : 'Y'}`
      : `${horizontal ? 'Горизонтальная' : 'Вертикальная'} расстановка применена`)
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
        const position = snapDragPositionToGridCells(object, origin.x + deltaX, origin.y + deltaY)
        object.x = position.x
        object.y = position.y
        const node = elements.canvas.querySelector(`[data-id="${CSS.escape(object.id)}"]`)
        if (node) positionObjectNode(node, object)
      }
      refreshSegmentGridCoordinates()
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
      snapObjectsToGridCells(objects)
      for (const object of objects) {
        const origin = origins.get(object.id)
        if (!origin || object.pageIndex !== origin.pageIndex || Math.abs(object.x - origin.x) > .5 || Math.abs(object.y - origin.y) > .5) object.manualPosition = true
      }
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
    const surfaces = [...elements.canvas.querySelectorAll('.studio-page')]
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
      object.manualPosition = true
    }
    const shift = clampGroupShift(objects, 0, 0)
    for (const object of objects) { object.x += shift.x; object.y += shift.y }
    state.activePage = pageIndex
  }

  function finalizeResizedObjectGeometry(object) {
    const page = state.scene.pages[object.pageIndex]
    const area = page.contentBounds
    const requestedWidth = object.width
    const requestedHeight = object.height
    const minimumWidth = canFitObjectToText(object)
      ? contentSize(measureObjectMinContentWidth(object))
      : 12
    const horizontal = snapAxisToGridCells(object.x, Math.max(requestedWidth, minimumWidth), page, 'x')
    object.x = horizontal.position
    object.width = horizontal.length

    // Height must be measured only after width has reached its final grid value:
    // line wrapping and therefore the permitted minimum height depend on it.
    const minimumHeight = canFitObjectToText(object)
      ? minimumObjectHeight(object, object.width)
      : 12
    const vertical = snapAxisToGridCells(object.y, Math.max(requestedHeight, minimumHeight), page, 'y')
    object.y = vertical.position
    object.height = Math.min(area.height, vertical.length)
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
    const start = {
      x: event.clientX, y: event.clientY, width: object.width, height: object.height,
      xPosition: object.x, yPosition: object.y,
      manualWidth: object.manualWidth, manualHeight: object.manualHeight,
    }
    const action = { kind: 'resize', pointerId: event.pointerId, object, start }
    const objectNode = elements.canvas.querySelector(`[data-id="${CSS.escape(id)}"]`)
    objectNode?.classList.add('is-resizing')
    const update = current => {
      const page = state.scene.pages[object.pageIndex]
      const area = page.contentBounds
      object.width = Math.min(area.x + area.width - object.x, Math.max(0, start.width + (current.clientX - start.x) / state.zoom))
      object.height = Math.min(area.y + area.height - object.y, Math.max(0, start.height + (current.clientY - start.y) / state.zoom))
      if (objectNode) positionObjectNode(objectNode, object)
      refreshSegmentGridCoordinates()
    }
    const finish = () => {
      objectNode?.classList.remove('is-resizing')
      finalizeResizedObjectGeometry(object)
      if (Math.abs(object.width - start.width) > .5) object.manualWidth = true
      if (Math.abs(object.height - start.height) > .5) object.manualHeight = true
      if (objectNode) positionObjectNode(objectNode, object)
      refreshSelection()
      scheduleSave()
    }
    const cancel = () => {
      objectNode?.classList.remove('is-resizing')
      Object.assign(object, {
        x: start.xPosition, y: start.yPosition, width: start.width, height: start.height,
        manualWidth: start.manualWidth, manualHeight: start.manualHeight,
      })
      state.history.length = historyLength
      refreshUndoButtons()
      if (objectNode) positionObjectNode(objectNode, object)
    }
    startPointerAction(event, handle, action, { move: update, commit: finish, cancel })
  }

  function maximumContentBoundaryHeight(page) {
    return Math.max(120, page.heightPx - page.contentBounds.y * 2)
  }

  function minimumContentBoundaryHeight(page) {
    const occupiedBottom = Math.max(
      page.contentBounds.y + 120,
      ...state.scene.objects
        .filter(object => object.pageIndex === page.index && !object.excluded)
        .map(object => object.y + object.height)
    )
    return Math.min(maximumContentBoundaryHeight(page), Math.max(120, occupiedBottom - page.contentBounds.y))
  }

  function snapContentBoundaryHeight(value, page, minimum, maximum) {
    if (value >= maximum - currentGridSize(page) / 2) return maximum
    const snapped = Math.round(value / currentGridSize(page)) * currentGridSize(page)
    return Math.min(maximum, Math.max(minimum, snapped))
  }

  function beginContentBoundaryResize(event, pageIndex) {
    if (event.button !== 0) return
    cancelPointerAction()
    event.preventDefault()
    event.stopPropagation()
    const page = state.scene.pages[pageIndex]
    if (!page) return
    const handle = event.currentTarget
    const boundary = handle.closest('.content-boundary')
    const historyLength = state.history.length
    checkpoint()
    const start = {
      clientY: event.clientY,
      height: page.contentBounds.height,
      availableHeight: gridAvailableBounds(page).height,
    }
    const minimum = minimumContentBoundaryHeight(page)
    const maximum = maximumContentBoundaryHeight(page)
    const update = current => {
      const requested = start.height + (current.clientY - start.clientY) / state.zoom
      page.gridAvailableBounds.height = snapContentBoundaryHeight(requested, page, minimum, maximum)
      normalizePageGridBounds(page)
      if (boundary) boundary.style.height = `${page.contentBounds.height}px`
    }
    const finish = () => {
      renderDocument()
      scheduleSave()
      showToast(`Высота рабочей области: ${Math.round(page.contentBounds.height)} px`)
    }
    const cancel = () => {
      page.contentBounds.height = start.height
      page.gridAvailableBounds.height = start.availableHeight
      state.history.length = historyLength
      refreshUndoButtons()
      if (boundary) boundary.style.height = `${start.height}px`
      refreshSelection()
    }
    startPointerAction(event, handle, { kind: 'content-boundary-resize', page }, { move: update, commit: finish, cancel })
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
    state.workflowStage = normalizeWorkflowStage(state.scene)
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

  function synchronizeReadingOrder(scene = state.scene) {
    if (!scene) return
    for (const page of scene.pages) {
      scene.objects
        .filter(object => object.pageIndex === page.index && !object.excluded)
        .sort((left, right) => left.y - right.y || left.x - right.x || left.id.localeCompare(right.id))
        .forEach((object, index) => { object.readingOrder = index + 1 })
    }
  }

  async function saveScene(immediate = false) {
    clearTimeout(state.saveTimer)
    state.saveTimer = null
    if (!state.scene || !state.metadata) return
    const tabKey = state.activeTabKey
    const scene = state.scene
    const metadata = state.metadata
    try {
      synchronizeReadingOrder(scene)
      const response = await api(`/api/studio/documents/${metadata.id}/scene`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene),
      })
      const data = await response.json()
      const savedMetadata = data.metadata || metadata
      const tab = state.tabs.get(tabKey)
      if (tab?.status === 'completed') tab.documentData = { metadata: savedMetadata, scene }
      if (state.activeTabKey === tabKey && state.scene === scene) {
        state.metadata = savedMetadata
        elements.documentStatus.textContent = `${scene.pages.length} стр. · ${scene.objects.filter(item => !item.excluded).length} в сборке · изменения сохранены`
      }
    } catch (error) {
      showToast(`Не удалось сохранить: ${error.message}`, true)
      if (immediate) throw error
    }
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer)
    state.saveTimer = setTimeout(saveScene, 650)
  }

  async function runAgent(endpoint, busyText, successText) {
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
      showToast(successText)
    } catch (error) {
      elements.agentStatus.textContent = 'Операция не выполнена.'
      showToast(error.message, true)
    }
  }

  function openReanalyzeConfirmation() {
    if (!state.scene || !state.metadata) return
    const sourcePages = [...state.scene.pages]
      .filter(page => page.sourcePageIndex != null && Number.isInteger(Number(page.sourcePageIndex)))
      .sort((left, right) => Number(left.sourcePageIndex) - Number(right.sourcePageIndex))
      .filter((page, index, pages) => index === 0 || Number(page.sourcePageIndex) !== Number(pages[index - 1].sourcePageIndex))
    const currentRotations = sourcePages.map((page, index) => normalizePageRotation(state.metadata.pageRotations?.[index]))
    state.reanalyzeOrientation = {
      preparation: {
        pages: sourcePages.map((page, index) => ({
          index,
          width: page.sourceWidth,
          height: page.sourceHeight,
          imageUrl: `/api/studio/documents/${state.metadata.id}/pages/${Number(page.sourcePageIndex)}/image`,
        })),
      },
      baseRotations: [...currentRotations],
      rotations: [...currentRotations],
    }
    renderReanalyzeOrientation()
    elements.reanalyzeConfirmModal.hidden = false
    requestAnimationFrame(() => elements.reanalyzeConfirmCancel.focus())
  }

  function renderReanalyzeOrientation() {
    const orientation = state.reanalyzeOrientation
    if (!orientation) return elements.reanalyzeOrientationPages.replaceChildren()
    renderOrientationPages(
      elements.reanalyzeOrientationPages,
      orientation.preparation,
      orientation.rotations,
      orientation.baseRotations,
      (index, value) => {
        orientation.rotations[index] = value
        renderReanalyzeOrientation()
      },
    )
  }

  function rotateReanalyzePages(delta = null) {
    const orientation = state.reanalyzeOrientation
    if (!orientation) return
    orientation.rotations = orientation.preparation.pages.map((page, index) => (
      delta == null ? 0 : rotatePageValue(orientation.rotations[index], delta)
    ))
    renderReanalyzeOrientation()
  }

  function closeReanalyzeConfirmation(restoreFocus = true) {
    elements.reanalyzeConfirmModal.hidden = true
    state.reanalyzeOrientation = null
    if (restoreFocus) elements.reanalyze.focus()
  }

  async function reanalyzeSource() {
    if (!state.scene || !state.metadata) return
    const rotations = [...(state.reanalyzeOrientation?.rotations || state.metadata.pageRotations || [])]
    closeReanalyzeConfirmation(false)
    elements.reanalyzeConfirmSubmit.disabled = true
    try {
      await saveScene(true)
      setView('loading')
      elements.loadingMessage.textContent = 'Пересегментируем макет по сохранённым страницам…'
      const response = await api(`/api/studio/documents/${state.metadata.id}/agent/reanalyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rotations }),
      })
      const documentData = await response.json()
      openDocument(documentData)
      showToast(`Пересегментация завершена: ${documentData.scene.objects.length} сегментов`)
    } catch (error) {
      setView('studio')
      showToast(error.message, true)
    } finally {
      elements.reanalyzeConfirmSubmit.disabled = false
    }
  }

  async function translateDocument(options = {}) {
    const tabKey = options.tabKey || state.activeTabKey
    const tab = state.tabs.get(tabKey)
    const scene = tabKey === state.activeTabKey ? state.scene : tab?.documentData?.scene
    const metadata = tabKey === state.activeTabKey ? state.metadata : tab?.documentData?.metadata
    if (!scene || !metadata) return false
    if (tabKey === state.activeTabKey) refreshTranslationSelectionControls()
    const allowedIds = new Set(translationCandidates(scene).map(object => object.id))
    const objectIds = Array.isArray(options.objectIds)
      ? [...new Set(options.objectIds.map(String))].filter(id => allowedIds.has(id))
      : [...allowedIds]
    if (!objectIds.length) {
      showToast('В документе нет сегментов для перевода', true)
      return false
    }
    const requestId = options.translationRequestId || ++state.translationRequestRevision
    if (tab && tab.translationState?.requestId !== requestId) {
      tab.translationState = { status: 'running', requestId, objectCount: objectIds.length }
      renderDocumentTabs()
    }
    if (tabKey === state.activeTabKey) {
      elements.translate.disabled = true
      elements.translate.textContent = `Переводим ${objectIds.length}…`
      elements.agentStatus.textContent = `Ищем совпадения в БЗ и переводим сегменты: ${objectIds.length}…`
    }
    try {
      synchronizeReadingOrder(scene)
      const savedResponse = await api(`/api/studio/documents/${metadata.id}/scene`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene),
      })
      const savedData = await savedResponse.json()
      const response = await api(`/api/studio/documents/${metadata.id}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectIds, forceRetranslate: Boolean(options.forceRetranslate) }),
      })
      const data = await response.json()
      const translatedScene = data.scene
      markTranslationBaseline(translatedScene, objectIds, data.pending)
      if (options.advanceToStage) {
        translatedScene.workflowVersion = 2
        translatedScene.workflowStage = options.advanceToStage
        translatedScene.translationCompleted = true
        translatedScene.layoutInitializationVersion = 0
      }
      const finalResponse = await api(`/api/studio/documents/${metadata.id}/scene`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(translatedScene),
      })
      const finalData = await finalResponse.json()
      const translatedMetadata = finalData.metadata || savedData.metadata || metadata
      if (tab && tab.translationState?.requestId === requestId) {
        tab.documentData = { metadata: translatedMetadata, scene: translatedScene }
        tab.translationState = null
      }
      if (state.activeTabKey === tabKey && state.metadata?.id === metadata.id) {
        checkpoint()
        state.metadata = translatedMetadata
        state.scene = translatedScene
        setView('studio')
        if (options.advanceToStage) setWorkflowStage(options.advanceToStage, { save: false })
        else {
          state.workflowStage = normalizeWorkflowStage(translatedScene)
          renderWorkflowStageState()
          renderDocumentWithContentFit(translatedScene.objects.filter(object => objectIds.includes(object.id)))
        }
        elements.agentStatus.textContent = data.message
      }
      renderDocumentTabs()
      showToast(
        state.activeTabKey === tabKey ? data.message : `Перевод документа «${tab?.title || scene.title}» завершён`,
        data.pending.length > 0 && !data.translated.length && !data.suggested?.length,
      )
      return true
    } catch (error) {
      if (tab && tab.translationState?.requestId === requestId) tab.translationState = null
      if (state.activeTabKey === tabKey && state.metadata?.id === metadata.id) {
        setView('studio')
        elements.agentStatus.textContent = 'Перевод не выполнен.'
      }
      renderDocumentTabs()
      showToast(state.activeTabKey === tabKey ? error.message : `Не удалось перевести «${tab?.title || scene.title}»: ${error.message}`, true)
      return false
    } finally {
      if (state.activeTabKey === tabKey && state.metadata?.id === metadata.id) refreshTranslationSelectionControls()
    }
  }

  async function reviseTranslations(requestedIds = [], scope = 'selection', trigger = null, instructionOverride = null, chatTarget = null) {
    if (!state.scene || !state.metadata) return
    const objectIds = scope === 'document' ? [] : requestedIds
    const requested = new Set(objectIds)
    const hasSegmentInstruction = state.scene.objects.some(object => (
      String(object.translationInstruction || '').trim() && (scope === 'document' || requested.has(object.id))
    ))
    const usesRevisionInstruction = typeof instructionOverride === 'string'
    const globalInstruction = String(usesRevisionInstruction
      ? instructionOverride
      : elements.globalTranslationInstruction.value || '').trim()
    if (scope === 'document' && !globalInstruction) {
      return showToast('Введите инструкцию для AI', true)
    }
    if (scope !== 'document' && !globalInstruction && !hasSegmentInstruction) {
      return showToast('Добавьте инструкцию для AI или комментарий к сегменту', true)
    }
    if (usesRevisionInstruction) state.scene.batchRevisionInstruction = globalInstruction
    else state.scene.globalTranslationInstruction = globalInstruction
    const previousLabel = trigger?.getAttribute('aria-label')
    if (trigger) {
      trigger.disabled = true
      trigger.setAttribute('aria-label', 'Исправляем…')
      trigger.setAttribute('aria-busy', 'true')
    }
    elements.agentStatus.textContent = scope === 'document'
      ? 'ИИ исправляет перевод всего документа по комментариям…'
      : `ИИ исправляет выбранные сегменты: ${objectIds.length}…`
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/translate/revise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usesRevisionInstruction
          ? { objectIds, scope, revisionInstruction: globalInstruction, chatTarget }
          : { objectIds, scope, globalInstruction }),
      })
      const data = await response.json()
      checkpoint()
      state.scene = data.scene
      if (chatTarget?.kind === 'batch') {
        elements.batchRevisionInstruction.value = state.scene.batchRevisionInstruction || ''
      }
      const revisedObjects = scope === 'document'
        ? allFormattingObjects()
        : state.scene.objects.filter(object => objectIds.includes(object.id))
      if (data.revised?.length) renderDocumentWithContentFit(revisedObjects)
      else renderDocument()
      scheduleSave()
      elements.agentStatus.textContent = data.message
      showToast(data.assistantMessage || data.message)
    } catch (error) {
      elements.agentStatus.textContent = 'Корректировка по комментариям не выполнена.'
      showToast(error.message, true)
    } finally {
      if (trigger) {
        trigger.removeAttribute('aria-busy')
        if (previousLabel) trigger.setAttribute('aria-label', previousLabel)
        else trigger.removeAttribute('aria-label')
      }
      refreshTranslationSelectionControls()
      refreshBatchRevisionControls()
    }
  }

  async function fetchQaReport() {
    await saveScene(true)
    const response = await api(`/api/studio/documents/${state.metadata.id}/qa`)
    return response.json()
  }

  async function runQa() {
    if (!state.scene) return
    try { showQa(await fetchQaReport()) }
    catch (error) { showToast(error.message, true) }
  }

  function updateQaRefreshAvailability() {
    if (!elements.qaRefresh || elements.qaRefresh.dataset.busy === 'true') return
    elements.qaRefresh.disabled = !state.scene
  }

  async function refreshQaReport() {
    if (!state.scene) return
    elements.qaRefresh.dataset.busy = 'true'
    elements.qaRefresh.disabled = true
    elements.qaRefresh.setAttribute('aria-busy', 'true')
    try {
      showQa(await fetchQaReport())
    } catch (error) {
      showToast(error.message, true)
    } finally {
      elements.qaRefresh.dataset.busy = 'false'
      elements.qaRefresh.removeAttribute('aria-busy')
      updateQaRefreshAvailability()
    }
  }

  function setQaPanelOpen(open, options = {}) {
    if (!elements.qaPanel) return
    clearTimeout(state.qaPanelCloseTimer)
    state.qaPanelCloseTimer = null
    if (open) {
      elements.qaPanel.hidden = false
      elements.qaPanel.setAttribute('aria-hidden', 'false')
      void elements.qaPanel.offsetWidth
      requestAnimationFrame(() => {
        if (!elements.qaPanel.hidden) elements.qaPanel.classList.add('is-open')
      })
      return
    }
    elements.qaPanel.classList.remove('is-open')
    elements.qaPanel.setAttribute('aria-hidden', 'true')
    if (options.immediate) {
      elements.qaPanel.hidden = true
      return
    }
    if (elements.qaPanel.hidden) return
    state.qaPanelCloseTimer = setTimeout(() => {
      if (!elements.qaPanel.classList.contains('is-open')) elements.qaPanel.hidden = true
      state.qaPanelCloseTimer = null
    }, 300)
  }

  function qaWarningKey(warning) {
    const objectState = [...new Set(warning.objectIds || [])].sort().map(id => {
      const object = state.scene?.objects.find(item => item.id === id)
      if (!object) return [id, null]
      return [
        id, object.pageIndex, object.type, object.sourceText, object.translation,
        object.x, object.y, object.width, object.height, object.confidence,
        object.style?.fontFamily, object.style?.fontSizePx, object.style?.fontWeight,
        object.style?.fontStyle, object.style?.textAlign, object.style?.lineHeight,
      ]
    })
    const value = JSON.stringify([warning.code, warning.severity, objectState])
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    return `qa-${(hash >>> 0).toString(36)}`
  }

  function acceptedQaWarnings() {
    if (!Array.isArray(state.scene.acceptedQaWarnings)) state.scene.acceptedQaWarnings = []
    return state.scene.acceptedQaWarnings
  }

  function renderQaSummary(report, warnings) {
    const accepted = new Set(acceptedQaWarnings())
    const outstanding = warnings.filter(item => !accepted.has(item.key))
    elements.qaSummary.innerHTML = `
      <div><strong>${outstanding.filter(item => item.severity === 'error').length}</strong><span>ошибок</span></div>
      <div><strong>${outstanding.filter(item => item.severity === 'warning').length}</strong><span>предупреждений</span></div>
      <div><strong>${report.counts.translated}/${report.counts.objects}</strong><span>готово</span></div>`
  }

  function renderQaAcceptance(item, action, warning, report, warnings) {
    const accepted = acceptedQaWarnings().includes(warning.key)
    item.classList.toggle('is-accepted', accepted)
    action.checked = accepted
    action.setAttribute('aria-label', 'Принять замечание')
    renderQaSummary(report, warnings)
    syncQaSelectAll(warnings)
  }

  function syncQaSelectAll(warnings) {
    if (!elements.qaSelectAll) return
    const accepted = new Set(acceptedQaWarnings())
    const acceptedCount = warnings.filter(warning => accepted.has(warning.key)).length
    elements.qaSelectAll.disabled = warnings.length === 0
    elements.qaSelectAll.checked = warnings.length > 0 && acceptedCount === warnings.length
    elements.qaSelectAll.indeterminate = acceptedCount > 0 && acceptedCount < warnings.length
  }

  function showQa(report) {
    const warnings = report.warnings.map(warning => ({ ...warning, key: qaWarningKey(warning) }))
    const currentKeys = new Set(warnings.map(warning => warning.key))
    const previousAccepted = acceptedQaWarnings()
    const retainedAccepted = previousAccepted.filter(key => currentKeys.has(key))
    if (retainedAccepted.length !== previousAccepted.length) {
      state.scene.acceptedQaWarnings = retainedAccepted
      scheduleSave()
    }
    setQaPanelOpen(true)
    elements.qaTitle.textContent = 'Тестирование перед выгрузкой'
    updateQaRefreshAvailability()
    renderQaSummary(report, warnings)
    elements.qaList.replaceChildren()
    elements.qaSelectAll.onchange = null
    syncQaSelectAll(warnings)
    if (!warnings.length) {
      const item = document.createElement('div')
      item.className = 'qa-item'
      item.textContent = 'Критичных проблем не найдено. Можно выгружать документ.'
      elements.qaList.append(item)
      return
    }
    elements.qaSelectAll.onchange = () => {
      const accepted = acceptedQaWarnings()
      const warningKeys = new Set(warnings.map(warning => warning.key))
      if (elements.qaSelectAll.checked) {
        for (const warning of warnings) {
          if (!accepted.includes(warning.key)) accepted.push(warning.key)
        }
      } else {
        for (let index = accepted.length - 1; index >= 0; index -= 1) {
          if (warningKeys.has(accepted[index])) accepted.splice(index, 1)
        }
      }
      for (const item of elements.qaList.querySelectorAll('.qa-item[data-qa-warning-key]')) {
        const action = item.querySelector('.qa-item__accept .base-checkbox__input')
        const warning = warnings.find(candidate => candidate.key === item.dataset.qaWarningKey)
        if (action && warning) renderQaAcceptance(item, action, warning, report, warnings)
      }
      scheduleSave()
    }
    for (const warning of warnings) {
      const item = document.createElement('article')
      item.className = 'qa-item'
      item.dataset.qaWarningKey = warning.key
      item.dataset.severity = warning.severity
      const message = document.createElement('button')
      message.className = 'qa-item__message'
      message.type = 'button'
      const text = document.createElement('span')
      text.textContent = warning.message
      const details = document.createElement('small')
      details.textContent = warning.objectIds.join(', ')
      message.append(text, details)
      message.addEventListener('click', () => {
        for (const sibling of elements.qaList.querySelectorAll('.qa-item.is-active')) sibling.classList.remove('is-active')
        item.classList.add('is-active')
        state.selected = new Set(warning.objectIds)
        const object = selectedObjects()[0]
        if (object) focusPage(object.pageIndex, object.id)
        refreshSelection()
      })
      const accept = document.createElement('label')
      accept.className = 'base-checkbox qa-item__accept'
      const acceptInput = document.createElement('input')
      acceptInput.className = 'base-checkbox__input'
      acceptInput.type = 'checkbox'
      const acceptControl = document.createElement('span')
      acceptControl.className = 'base-checkbox__control'
      acceptControl.setAttribute('aria-hidden', 'true')
      accept.append(acceptInput, acceptControl)
      acceptInput.addEventListener('change', () => {
        const accepted = acceptedQaWarnings()
        const index = accepted.indexOf(warning.key)
        if (acceptInput.checked && index < 0) accepted.push(warning.key)
        else if (!acceptInput.checked && index >= 0) accepted.splice(index, 1)
        renderQaAcceptance(item, acceptInput, warning, report, warnings)
        scheduleSave()
      })
      item.append(message, accept)
      renderQaAcceptance(item, acceptInput, warning, report, warnings)
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
          clearKnowledgeBasePreviewForFocusedObject(object)
          renderDocumentWithContentFit([object])
          scheduleSave()
          refreshKnowledgeBaseAfterSegmentEdit()
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
      const created = results.reduce((sum, result) => sum + result.created, 0)
      const conflicts = results.flatMap(result => result.results || []).filter(item => item.status === 'conflict').length
      showToast(`Новых записей в БЗ: ${created}. Уже существовали: ${count - created - conflicts}.${conflicts ? ` Конфликтов: ${conflicts}.` : ''}`, conflicts > 0)
    } catch (error) { showToast(error.message, true) }
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
    first.manualPosition = false
    first.manualWidth = false
    first.manualHeight = false
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
    renderDocumentWithContentFit([first], { forceWidth: true, forceHeight: true })
    scheduleSave()
  }

  function insertBlankPage(afterPageIndex) {
    if (!state.scene) return
    const reference = state.scene.pages[afterPageIndex]
    if (!reference) return
    cancelPointerAction()
    checkpoint()
    const insertIndex = afterPageIndex + 1
    addBlankPageAt(insertIndex, reference)
    state.activePage = insertIndex
    state.sourceRenderedPage = null
    renderDocument()
    scheduleSave()
    requestAnimationFrame(() => focusPage(insertIndex))
    showToast(`Добавлена пустая страница ${insertIndex + 1}`)
  }

  function addBlankPageAt(insertIndex, reference) {
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
      gridAvailableBounds: { ...gridAvailableBounds(reference) },
      languages: [],
      recognitionStats: { manualPage: true },
    }
    state.scene.pages.splice(insertIndex, 0, blankPage)
    for (const object of state.scene.objects) {
      if (object.pageIndex >= insertIndex) object.pageIndex += 1
    }
    reindexScenePages()
    return blankPage
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
      manualPosition: false, manualWidth: false, manualHeight: false, manualTypography: false,
      excluded: false, status: 'manual', sourceLineIds: [],
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      originalBounds: { x: page.contentBounds.x, y: page.contentBounds.y, width: Math.min(280, page.contentBounds.width), height: 42 },
    })
    state.activePage = page.index
    state.selected = new Set([id])
    renderDocumentWithContentFit([state.scene.objects.at(-1)], { forceWidth: true, forceHeight: true })
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
    object.manualWidth = false
    object.manualHeight = false

    const page = state.scene.pages[object.pageIndex]
    const id = `manual-${Date.now().toString(36)}`
    const next = JSON.parse(JSON.stringify(object))
    next.id = id
    next.readingOrder = state.scene.objects.length + 1
    next.sourceLineIds = []
    next.confidence = 1
    next.status = 'manual-split'
    next.manualPosition = false
    next.manualWidth = false
    next.manualHeight = false
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
    renderDocumentWithContentFit([object, next], { forceWidth: true, forceHeight: true })
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
    elements.typographySelectAll.disabled = false
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
      object.manualTypography = true
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
      object.manualTypography = true
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
      object.manualTypography = true
      if (applyAll) removeInlineStyleProperties(object, ['fontSizePx'])
    }, true, true, objects)
  }

  function setFormattingLineHeight(value) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    const lineHeight = clampLineHeight(value)
    applySelectionChange(object => { object.style.lineHeight = lineHeight; object.manualTypography = true }, true, true, objects)
  }

  function changeFormattingLineHeight(delta) {
    const applyAll = Boolean(elements.formatAllSegments?.checked)
    const objects = formattingTargetObjects()
    if (!objects.length) return showToast(applyAll ? 'Среди выбранных нет доступных сегментов' : 'Сначала выберите сегмент', true)
    applySelectionChange(object => {
      object.style.lineHeight = clampLineHeight((Number(object.style.lineHeight) || 1.2) + delta)
      object.manualTypography = true
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
      object.manualTypography = true
      if (applyAll) removeInlineStyleProperties(object, ['fontSizePx'])
    }, true, true, objects)
  }

  function applySelectedTextStyle(patch) {
    const selection = selectedTextRange()
    if (!selection) return false
    checkpoint()
    styleRanges(selection.object, selection.field).push({ start: selection.start, end: selection.end, ...patch })
    selection.object.manualTypography = true
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
      object.manualTypography = true
      if (applyAll && action === 'bold') removeInlineStyleProperties(object, ['fontWeight'])
      if (applyAll && action === 'italic') removeInlineStyleProperties(object, ['fontStyle'])
    }, true, action === 'bold' || action === 'italic', objects)
  }

  function resetPosition() {
    const objects = selectedObjects()
    if (!objects.length) return
    checkpoint()
    try { arrangeObjectsFromOriginal(objects) } catch (error) { showToast(error.message, true); return }
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
    elements.objectType.addEventListener('change', () => applySelectionChange(object => setObjectType(object, elements.objectType.value)))
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
      let knowledgeEditingObjects = []
      control.addEventListener('focus', () => {
        knowledgeEditingObjects = selectedObjects()
        if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true }
        state.sceneEditRevision += 1
        for (const object of knowledgeEditingObjects) clearKnowledgeBasePreviewForFocusedObject(object)
        setObjectsKnowledgeEditing(knowledgeEditingObjects, true)
      })
      control.addEventListener('input', () => {
        state.sceneEditRevision += 1
        const objects = selectedObjects()
        knowledgeEditingObjects = objects
        setObjectsKnowledgeEditing(objects, true)
        for (const object of objects) {
          object[field] = control.value
          object[field === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'] = []
          if (field === 'sourceText') {
            object.translation = servicePlaceholder(object.type, object.sourceText)
            object.translationTextStyles = []
            object.translationUnits = []
            ensureObjectTranslationUnits(object)
          } else {
            let units = ensureObjectTranslationUnits(object)
            if (units.length > 1) {
              object.translationUnits = []
              units = ensureObjectTranslationUnits(object)
            }
            if (units.length === 1) {
              units[0].translation = control.value
              units[0].status = 'edited'
              units[0].activeTranslationSource = 'manual'
              units[0].memorySuggestion = null
              units[0].memoryEntryId = null
            }
          }
          clearKnowledgeBaseStateForEditedObject(object)
          object.status = 'edited'
        }
        renderSelectedText(field === 'sourceText' ? 'sourceText' : field)
        if (field === 'sourceText') renderSelectedText('translation')
        if (workflowUsesSegments()) refreshSegmentsViewHeights()
        else fitObjectsToRenderedContent(objects, true)
        scheduleSave()
      })
      control.addEventListener('blur', () => {
        state.textCheckpoint = false
        renderSelectedText(field)
        setObjectsKnowledgeEditing(knowledgeEditingObjects, false)
        knowledgeEditingObjects = []
        refreshKnowledgeBaseAfterSegmentEdit()
      })
    }
    bindText(elements.sourceText, 'sourceText')
    bindText(elements.translationText, 'translation')
  }

  function renderSelectedText(field) {
    for (const object of selectedObjects()) {
      const nodes = elements.canvas.querySelectorAll(`[data-id="${CSS.escape(object.id)}"]`)
      for (const node of nodes) {
        const content = node.querySelector('.scene-object__content')
        if (!content) continue
        renderTextContent(content, object)
        node.classList.toggle('is-untranslated', content.dataset.editField !== 'sourceText' && !object.translation && isTranslatableType(object.type))
      }
    }
  }

  function bindEvents() {
    document.addEventListener('pointerdown', event => {
      const activeEditor = document.activeElement
      const isSegmentTextEditor = activeEditor?.matches?.('.scene-object__content, #source-text, #translation-text')
      if (isSegmentTextEditor && !activeEditor.contains(event.target)) activeEditor.blur()
    }, true)
    elements.fileInput.addEventListener('change', () => upload(elements.fileInput.files))
    for (const eventName of ['dragenter', 'dragover']) elements.uploadZone.addEventListener(eventName, event => { event.preventDefault(); elements.uploadZone.classList.add('is-dragover') })
    for (const eventName of ['dragleave', 'drop']) elements.uploadZone.addEventListener(eventName, event => { event.preventDefault(); elements.uploadZone.classList.remove('is-dragover') })
    elements.uploadZone.addEventListener('drop', event => upload(event.dataTransfer.files))
    elements.orientationAllLeft.addEventListener('click', () => rotateUploadPages(-90))
    elements.orientationAllReset.addEventListener('click', () => rotateUploadPages(null))
    elements.orientationAllRight.addEventListener('click', () => rotateUploadPages(90))
    elements.orientationSubmit.addEventListener('click', startPreparedAnalysis)
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
    elements.knowledgeSuggestionClose.addEventListener('click', closeKnowledgeSuggestion)
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
    elements.administrationButton.addEventListener('click', openAdministration)
    elements.administrationClose.addEventListener('click', closeAdministration)
    elements.administrationCancel.addEventListener('click', closeAdministration)
    elements.administrationReset.addEventListener('click', resetAdministrationPrompt)
    elements.administrationSave.addEventListener('click', saveAdministrationSettings)
    elements.chatAgentSystemPrompt.addEventListener('input', () => {
      elements.administrationSave.disabled = !elements.chatAgentSystemPrompt.value.trim()
    })
    elements.administrationModal.addEventListener('pointerdown', event => {
      if (event.target === elements.administrationModal) closeAdministration()
    })
    elements.retryJob.addEventListener('click', retryFailedJob)
    elements.cancelJob.addEventListener('click', cancelActiveJob)
    elements.zoomOut.addEventListener('click', () => setZoom(state.zoom - .1))
    elements.zoomIn.addEventListener('click', () => setZoom(state.zoom + .1))
    elements.zoomFit.addEventListener('click', fitWidth)
    elements.zoomActual.addEventListener('click', () => setZoom(1))
    elements.segmentTypeLabelsToggle.addEventListener('click', toggleSegmentTypeLabels)
    elements.workflowPrevious.addEventListener('click', returnToPreviousWorkflowStage)
    elements.workflowApprove.addEventListener('click', approveWorkflowStage)
    elements.translationApprovalClose.addEventListener('click', () => closeTranslationApprovalModal())
    elements.translationApprovalCancel.addEventListener('click', () => closeTranslationApprovalModal())
    elements.translationApprovalContinue.addEventListener('click', continueWithCurrentTranslation)
    elements.translationApprovalSubmit.addEventListener('click', submitTranslationApproval)
    elements.translationApprovalRetranslateAll.addEventListener('click', () => submitTranslationApproval({ forceAll: true }))
    elements.translationApprovalModal.addEventListener('pointerdown', event => {
      if (event.target === elements.translationApprovalModal) closeTranslationApprovalModal()
    })
    elements.sourcePanelToggle.addEventListener('click', toggleSourcePanel)
    elements.canvasScroll.addEventListener('wheel', event => {
      if (state.workflowStage === 1) return
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
    window.addEventListener('resize', fitVisibleDocumentReviewPreviews)
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
    elements.sourceLanguage.addEventListener('change', () => {
      state.scene.sourceLanguage = elements.sourceLanguage.value
      duplicateSourceTranslations(state.scene)
      refreshTranslationApprovalState()
      scheduleSave()
    })
    elements.targetLanguage.addEventListener('change', () => {
      state.scene.targetLanguage = elements.targetLanguage.value
      duplicateSourceTranslations(state.scene)
      refreshTranslationApprovalState()
      scheduleSave()
    })
    elements.reanalyze.addEventListener('click', openReanalyzeConfirmation)
    elements.reanalyzeConfirmClose.addEventListener('click', closeReanalyzeConfirmation)
    elements.reanalyzeConfirmCancel.addEventListener('click', closeReanalyzeConfirmation)
    elements.reanalyzeConfirmSubmit.addEventListener('click', reanalyzeSource)
    elements.reanalyzeOrientationAllLeft.addEventListener('click', () => rotateReanalyzePages(-90))
    elements.reanalyzeOrientationAllReset.addEventListener('click', () => rotateReanalyzePages(null))
    elements.reanalyzeOrientationAllRight.addEventListener('click', () => rotateReanalyzePages(90))
    elements.reanalyzeConfirmModal.addEventListener('pointerdown', event => {
      if (event.target === elements.reanalyzeConfirmModal) closeReanalyzeConfirmation()
    })
    elements.confirmationClose.addEventListener('click', () => closeConfirmationModal(false))
    elements.confirmationCancel.addEventListener('click', () => closeConfirmationModal(false))
    elements.confirmationSubmit.addEventListener('click', () => closeConfirmationModal(true))
    elements.confirmationModal.addEventListener('pointerdown', event => {
      if (event.target === elements.confirmationModal) closeConfirmationModal(false)
    })
    elements.autoLayout.addEventListener('click', () => {
      checkpoint()
      runAgent('auto-layout', 'Расширяем текстовые блоки и устраняем наложения…', 'Расположение сегментов обновлено')
    })
    elements.translate.addEventListener('click', translateDocument)
    elements.globalTranslationInstruction.addEventListener('input', () => {
      refreshGlobalInstructionControls()
      if (!state.scene) return
      state.scene.globalTranslationInstruction = elements.globalTranslationInstruction.value.slice(0, 10000)
      refreshTranslationSelectionControls()
      refreshTranslationApprovalState()
      scheduleSave()
    })
    elements.batchRevisionInstruction.addEventListener('input', () => {
      if (state.scene) {
        state.scene.batchRevisionInstruction = elements.batchRevisionInstruction.value.slice(0, 10000)
        scheduleSave()
      }
      refreshBatchRevisionControls()
    })
    elements.batchRevisionApply.addEventListener('click', () => {
      reviseTranslations(
        [],
        'document',
        elements.batchRevisionApply,
        elements.batchRevisionInstruction.value,
        { kind: 'batch' },
      )
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
    elements.qa.addEventListener('click', runQa)
    elements.qaRefresh.addEventListener('click', refreshQaReport)
    elements.qaClose.addEventListener('click', () => setQaPanelOpen(false))
    elements.memorySearch.addEventListener('click', findMemory)
    elements.glossaryAdd.addEventListener('click', createGlossary)
    elements.glossarySelect.addEventListener('change', () => {
      if (!state.scene || !elements.glossarySelect.value) return
      state.scene.glossaryId = elements.glossarySelect.value
      state.sceneEditRevision += 1
      for (const object of state.scene.objects) clearKnowledgeBasePreviewForFocusedObject(object)
      closeKnowledgeSuggestion()
      renderDocument()
      refreshTranslationApprovalState()
      scheduleSave()
      elements.memoryResults.innerHTML = '<small>Глоссарий изменён. Выполните новый поиск.</small>'
      refreshKnowledgeBaseAfterSegmentEdit()
    })
    elements.knowledgeBaseMode.addEventListener('change', () => {
      if (!state.scene) return
      state.scene.knowledgeBaseMode = elements.knowledgeBaseMode.value === 'priority' ? 'priority' : 'suggestions'
      refreshTranslationApprovalState()
      scheduleSave()
      showToast(state.scene.knowledgeBaseMode === 'priority'
        ? 'БЗ будет приоритетной при следующем переводе'
        : 'БЗ будет показывать подсказки, не изменяя перевод ИИ')
    })
    elements.approve.addEventListener('click', approveTranslation)
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
    elements.stretchWorkAreaWidth.addEventListener('click', () => stretchSelectionToWorkArea('width'))
    elements.stretchWorkAreaHeight.addEventListener('click', () => stretchSelectionToWorkArea('height'))
    elements.fitMinContentWidth.addEventListener('click', () => fitSelectionToContent('min-width'))
    document.querySelectorAll('[data-align-selection]').forEach(button => button.addEventListener('click', () => alignSelection(button.dataset.alignSelection)))
    document.querySelectorAll('[data-align-document]').forEach(button => button.addEventListener('click', () => alignToDocument(button.dataset.alignDocument)))
    document.querySelectorAll('[data-flex-layout]').forEach(button => button.addEventListener('click', () => {
      applyFlexLayout(button.dataset.flexAxis, button.dataset.flexLayout)
    }))
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
        if (!elements.translationApprovalModal.hidden) {
          closeTranslationApprovalModal()
          return
        }
        if (!elements.confirmationModal.hidden) {
          closeConfirmationModal(false)
          return
        }
        if (!elements.reanalyzeConfirmModal.hidden) {
          closeReanalyzeConfirmation()
          return
        }
        if (!elements.sourceLightbox.hidden) {
          closeSourceLightbox()
          return
        }
        setAppbarMenuOpen(false)
        cancelPointerAction()
        stopSourcePan()
        closeKnowledgeSuggestion()
        closeInstructionPresetEditor()
        if (!elements.aiSettingsModal.hidden) closeProviderSettings()
        if (!elements.administrationModal.hidden) closeAdministration()
        if (!elements.knowledgeBaseModal.hidden) closeKnowledgeBase()
        if (!elements.instructionLibraryModal.hidden) closeInstructionLibrary()
        elements.documentLibraryModal.hidden = true
        state.selected.clear()
        state.lastTextSelection = null
        setQaPanelOpen(false)
        refreshSelection()
        document.activeElement?.blur?.()
      }
    })
    document.addEventListener('pointerdown', event => {
      if (!elements.appbarActionsMenu.hidden && !elements.appbarMenu.contains(event.target)) setAppbarMenuOpen(false)
      if (elements.knowledgeSuggestionPopover.hidden) return
      if (elements.knowledgeSuggestionPopover.contains(event.target)) return
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

  function invalidateKnowledgeBaseEntryReferences(entryId) {
    if (!state.scene || !entryId) return false
    let changed = false
    for (const object of state.scene.objects) {
      let objectChanged = false
      for (const unit of object.translationUnits || []) {
        const matches = Array.isArray(unit.knowledgeMatches) ? unit.knowledgeMatches : []
        const retainedMatches = matches.filter(match => match.entryId !== entryId)
        const translatedMatches = unit.translationKnowledgeMatches || []
        unit.translationKnowledgeMatches = translatedMatches.filter(match => match.entryId !== entryId)
        const removedMatch = retainedMatches.length !== matches.length || translatedMatches.length !== unit.translationKnowledgeMatches.length
        const removedSuggestion = unit.memorySuggestion?.entryId === entryId
        const removedAppliedEntry = unit.memoryEntryId === entryId
        const removedLegacyAppliedEntry = !unit.memoryEntryId
          && (unit.activeTranslationSource === 'memory' || unit.activeTranslationSource === 'memory-revised')
          && removedMatch && !retainedMatches.length
        const removedAppliedReference = removedAppliedEntry || removedLegacyAppliedEntry
        if (!removedMatch && !removedSuggestion && !removedAppliedEntry) continue
        unit.knowledgeMatches = retainedMatches
        if (removedSuggestion) unit.memorySuggestion = null
        if (removedAppliedEntry) unit.memoryEntryId = null
        if (removedAppliedReference && (unit.activeTranslationSource === 'memory' || unit.activeTranslationSource === 'memory-revised')) {
          unit.activeTranslationSource = unit.aiTranslation && unit.aiTranslation === unit.translation ? 'ai' : 'manual'
        }
        if ((removedAppliedReference || removedSuggestion) && (unit.status === 'memory-applied' || unit.status === 'memory-suggested')) {
          unit.status = unit.translation ? 'edited' : 'new'
        }
        objectChanged = true
        changed = true
      }
      if (objectChanged) {
        const units = object.translationUnits || []
        const hasAppliedMemory = units.some(unit => (
          unit.activeTranslationSource === 'memory' || unit.activeTranslationSource === 'memory-revised'
        ) && (unit.memoryEntryId || unit.knowledgeMatches?.length))
        const hasMemorySuggestion = units.some(unit => unit.memorySuggestion)
        if (object.status === 'memory-applied' && !hasAppliedMemory) object.status = object.translation ? 'edited' : hasMemorySuggestion ? 'memory-suggested' : 'recognized'
        if (object.status === 'memory-suggested' && !hasMemorySuggestion) object.status = object.translation ? 'partially-translated' : 'recognized'
      }
    }
    if (!changed) return false
    closeKnowledgeSuggestion()
    elements.memoryResults.innerHTML = '<small>База знаний изменена. Выполните новый поиск совпадений.</small>'
    renderDocument()
    return true
  }

  async function refreshCurrentKnowledgeBaseMatches(expectedEditRevision = null, expectedDocumentId = state.metadata?.id) {
    if (!state.scene || !state.metadata) return 0
    const response = await api(`/api/studio/documents/${expectedDocumentId}/knowledge-matches/refresh`, { method: 'POST' })
    const data = await response.json()
    if (state.metadata?.id !== expectedDocumentId) return 0
    if (expectedEditRevision != null && state.sceneEditRevision !== expectedEditRevision) return 0
    state.metadata = data.metadata
    state.scene = data.scene
    const activeTab = state.tabs.get(state.activeTabKey)
    if (activeTab?.status === 'completed') activeTab.documentData = { metadata: state.metadata, scene: state.scene }
    closeKnowledgeSuggestion()
    renderDocument()
    return Number(data.matchCount) || 0
  }

  async function refreshKnowledgeBaseAfterSegmentEdit() {
    if (!state.scene || !state.metadata) return
    const documentId = state.metadata.id
    const editRevision = state.sceneEditRevision
    try {
      await saveScene(true)
      if (state.metadata?.id !== documentId || state.sceneEditRevision !== editRevision) return
      await refreshCurrentKnowledgeBaseMatches(editRevision, documentId)
    } catch (error) {
      showToast(`Не удалось обновить совпадения БЗ: ${error.message}`, true)
    }
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
      if (state.scene && state.metadata) await saveScene(true)
      if (id) {
        await api(`/api/studio/knowledge-base/entries/${encodeURIComponent(id)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        invalidateKnowledgeBaseEntryReferences(id)
      } else {
        const response = await api('/api/studio/knowledge-base/entries', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const result = await response.json()
        const conflict = result.results?.find(item => item.status === 'conflict' || item.status === 'existing')
        if (conflict) throw new Error(conflict.status === 'existing' ? 'Такая запись уже существует' : 'Для этой исходной фразы уже сохранён другой перевод')
      }
      const matchCount = await refreshCurrentKnowledgeBaseMatches()
      closeKnowledgeBaseEntryForm()
      await Promise.all([loadKnowledgeBaseEntries(), loadKnowledgeBase()])
      const message = id ? 'Запись Базы знаний обновлена' : 'Запись добавлена в Базу знаний'
      showToast(matchCount ? `${message} · совпадения в документе обновлены` : message)
    } catch (error) { showToast(error.message, true) }
  }

  async function deleteKnowledgeBaseEntry(entry) {
    if (!await requestConfirmation({
      title: 'Удалить запись из Базы знаний?',
      message: `Пара «${entry.sourceText.slice(0, 80)}» будет удалена. Подсветка и ссылки на эту запись исчезнут из документов, но текст уже применённых переводов сохранится.`,
      confirmLabel: 'Удалить запись',
      eyebrow: 'Опасное действие',
      danger: true,
    })) return
    try {
      if (state.scene && state.metadata) await saveScene(true)
      await api(`/api/studio/knowledge-base/entries/${encodeURIComponent(entry.id)}`, { method: 'DELETE' })
      invalidateKnowledgeBaseEntryReferences(entry.id)
      await refreshCurrentKnowledgeBaseMatches()
      if (elements.knowledgeBaseEntryId.value === entry.id) closeKnowledgeBaseEntryForm()
      await Promise.all([loadKnowledgeBaseEntries(), loadKnowledgeBase()])
      showToast('Запись удалена из Базы знаний')
    } catch (error) { showToast(error.message, true) }
  }

  async function loadKnowledgeBase() {
    const statusResponse = await api('/api/studio/knowledge-base/status')
    const status = await statusResponse.json()
    setNoteVariant(elements.knowledgeBaseStatus, status.connected === false ? 'danger' : status.persistent ? 'success' : 'warning')
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
      setNoteVariant(elements.knowledgeBaseStatus, 'danger')
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
    const preparationId = parameters.get('prepare')
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
    if (/^[a-f0-9]{32}$/.test(preparationId || '')) {
      const key = `preparation-${preparationId}`
      let tab = state.tabs.get(key)
      if (!tab) {
        tab = { key, jobId: null, kind: 'document-preparation', documentId: preparationId, title: 'Документ', status: 'awaiting-orientation', progress: 100 }
        state.tabs.set(key, tab)
      }
      state.activeTabKey = key
      renderDocumentTabs()
      try {
        await showUploadOrientation(tab, true)
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

  setupInspectorPanels()
  bindEvents()
  ;(async () => {
    await Promise.all([loadServiceStatus(), loadInstructionPresets().catch(() => {})])
    await loadPendingJobs()
    await loadDocumentHistory()
    await restoreDocumentFromUrl()
  })()
})()
