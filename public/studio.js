(() => {
  const $ = selector => document.querySelector(selector)
  const elements = {
    uploadView: $('#upload-view'), uploadZone: $('#upload-zone'), fileInput: $('#file-input'),
    loadingView: $('#loading-view'), loadingMessage: $('#loading-message'), studioView: $('#studio-view'),
    documentTitle: $('#document-title'), documentStatus: $('#document-status'), newDocument: $('#new-document-button'),
    exportDocx: $('#export-docx-button'), exportPdf: $('#export-pdf-button'), undo: $('#undo-button'), redo: $('#redo-button'),
    thumbnails: $('#page-thumbnails'), pageCount: $('#page-count'), canvasScroll: $('#canvas-scroll'), canvas: $('#document-canvas'),
    zoomOut: $('#zoom-out'), zoomIn: $('#zoom-in'), zoomFit: $('#zoom-fit'), zoomOutput: $('#zoom-output'),
    sourcePreviewScroll: $('#source-preview-scroll'), sourcePreviewCanvas: $('#source-preview-canvas'),
    sourceZoomOut: $('#source-zoom-out'), sourceZoomIn: $('#source-zoom-in'), sourceZoomFit: $('#source-zoom-fit'), sourceZoomOutput: $('#source-zoom-output'),
    sourceLanguage: $('#source-language'), targetLanguage: $('#target-language'),
    agentStatus: $('#agent-status'), analyze: $('#analyze-button'), ocrReview: $('#ocr-review-button'), translate: $('#translate-button'), autoLayout: $('#auto-layout-button'), qa: $('#qa-button'),
    emptyInspector: $('#empty-inspector'), objectInspector: $('#object-inspector'), addObject: $('#add-object-button'),
    selectionTitle: $('#selection-title'), selectionCount: $('#selection-count'), objectType: $('#object-type'),
    sourceText: $('#source-text'), translationText: $('#translation-text'), confidence: $('#confidence-value'),
    fontSize: $('#font-size'), lineHeight: $('#line-height'), objectX: $('#object-x'), objectY: $('#object-y'),
    objectWidth: $('#object-width'), objectHeight: $('#object-height'), toolbarFontSize: $('#toolbar-font-size'),
    memorySearch: $('#memory-search-button'), memoryResults: $('#memory-results'), approve: $('#approve-button'),
    merge: $('#merge-button'), split: $('#split-button'), resetPosition: $('#reset-position-button'), exclude: $('#exclude-button'),
    qaPanel: $('#qa-panel'), qaTitle: $('#qa-title'), qaActions: $('#qa-actions'), qaClose: $('#qa-close'), qaSummary: $('#qa-summary'), qaList: $('#qa-list'),
    selectionBox: $('#selection-box'), toast: $('#toast'),
  }

  const state = {
    metadata: null,
    scene: null,
    zoom: .8,
    sourceZoom: .5,
    sourceRenderedPage: null,
    selected: new Set(),
    activePage: 0,
    history: [],
    future: [],
    saveTimer: null,
    textCheckpoint: false,
    pointerAction: null,
    toastTimer: null,
    serviceStatus: null,
    lastTextSelection: null,
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

  function setView(name) {
    elements.uploadView.hidden = name !== 'upload'
    elements.loadingView.hidden = name !== 'loading'
    elements.studioView.hidden = name !== 'studio'
  }

  async function upload(file) {
    if (!file) return
    setView('loading')
    elements.loadingMessage.textContent = `Анализируем «${file.name}»…`
    try {
      const response = await api('/api/studio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      })
      const documentData = await response.json()
      openDocument(documentData)
      history.replaceState(null, '', `/?document=${documentData.metadata.id}`)
      showToast(`Документ готов: ${documentData.scene.pages.length} стр., ${documentData.scene.objects.length} сегментов`)
    } catch (error) {
      setView('upload')
      showToast(error.message, true)
    } finally {
      elements.fileInput.value = ''
    }
  }

  function openDocument(documentData) {
    state.metadata = documentData.metadata
    state.scene = documentData.scene
    state.selected.clear()
    state.history = []
    state.future = []
    state.activePage = 0
    state.sourceRenderedPage = null
    elements.documentTitle.textContent = state.scene.title
    elements.documentStatus.textContent = `${state.scene.pages.length} стр. · ${state.scene.objects.length} сегментов · сохранено локально`
    elements.pageCount.textContent = state.scene.pages.length
    elements.sourceLanguage.value = state.scene.sourceLanguage
    elements.targetLanguage.value = state.scene.targetLanguage
    elements.agentStatus.textContent = state.serviceStatus?.translationProviderConfigured
      ? `Документ распознан. Перевод будет выполнен моделью ${state.serviceStatus.translationModel}.`
      : 'Документ распознан. API перевода не настроен: доступны ручной перевод и локальная БЗ.'
    elements.newDocument.hidden = false
    elements.exportDocx.disabled = false
    elements.exportPdf.disabled = false
    setView('studio')
    renderDocument()
    requestAnimationFrame(() => { fitWidth(); fitSourceWidth() })
    refreshUndoButtons()
  }

  function renderDocument() {
    renderThumbnails()
    elements.canvas.replaceChildren()
    for (const page of state.scene.pages) {
      const shell = document.createElement('div')
      shell.className = 'studio-page-shell'
      shell.dataset.pageIndex = page.index
      const surface = document.createElement('section')
      surface.className = 'studio-page'
      surface.dataset.pageIndex = page.index
      surface.style.width = `${page.widthPx}px`
      surface.style.height = `${page.heightPx}px`
      surface.addEventListener('pointerdown', beginMarquee)

      const boundary = document.createElement('div')
      boundary.className = 'content-boundary'
      Object.assign(boundary.style, {
        left: `${page.contentBounds.x}px`, top: `${page.contentBounds.y}px`,
        width: `${page.contentBounds.width}px`, height: `${page.contentBounds.height}px`,
      })
      surface.append(boundary)

      for (const object of state.scene.objects.filter(item => item.pageIndex === page.index && !item.excluded)) {
        surface.append(createObjectElement(object))
      }
      const number = document.createElement('span')
      number.className = 'page-number'
      number.textContent = `${page.index + 1} / ${state.scene.pages.length}`
      surface.append(number)
      shell.append(surface)
      elements.canvas.append(shell)
    }
    applyZoom()
    renderSourcePreview()
    refreshSelection()
  }

  function renderSourcePreview() {
    if (!state.scene || !elements.sourcePreviewCanvas) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    if (state.sourceRenderedPage === page.index && elements.sourcePreviewCanvas.firstElementChild) {
      applySourceZoom()
      return
    }
    elements.sourcePreviewCanvas.replaceChildren()
    const shell = document.createElement('div')
    shell.className = 'source-preview-page-shell'
    const surface = document.createElement('div')
    surface.className = 'source-preview-page'
    surface.style.width = `${page.widthPx}px`
    surface.style.height = `${page.heightPx}px`
    const image = document.createElement('img')
    image.src = page.imageUrl
    image.alt = `Оригинал страницы ${page.index + 1}`
    const sourceFrame = page.sourceFrame || { x: 0, y: 0, width: page.widthPx, height: page.heightPx }
    Object.assign(image.style, {
      left: `${sourceFrame.x}px`, top: `${sourceFrame.y}px`,
      width: `${sourceFrame.width}px`, height: `${sourceFrame.height}px`,
    })
    surface.append(image)
    shell.append(surface)
    elements.sourcePreviewCanvas.append(shell)
    state.sourceRenderedPage = page.index
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
    const next = Math.min(3, Math.max(.15, Math.round(nextZoom * 20) / 20))
    if (next === state.sourceZoom) return
    const scroller = elements.sourcePreviewScroll
    const before = anchorEvent ? { x: anchorEvent.clientX - scroller.getBoundingClientRect().left + scroller.scrollLeft, y: anchorEvent.clientY - scroller.getBoundingClientRect().top + scroller.scrollTop } : null
    const ratio = next / state.sourceZoom
    state.sourceZoom = next
    applySourceZoom()
    if (before) requestAnimationFrame(() => {
      scroller.scrollLeft = before.x * ratio - (anchorEvent.clientX - scroller.getBoundingClientRect().left)
      scroller.scrollTop = before.y * ratio - (anchorEvent.clientY - scroller.getBoundingClientRect().top)
    })
  }

  function fitSourceWidth() {
    if (!state.scene || !elements.sourcePreviewScroll) return
    const page = state.scene.pages[state.activePage] || state.scene.pages[0]
    setSourceZoom((elements.sourcePreviewScroll.clientWidth - 56) / page.widthPx)
  }

  function renderThumbnails() {
    elements.thumbnails.replaceChildren()
    for (const page of state.scene.pages) {
      const button = document.createElement('button')
      button.className = `page-thumbnail${page.index === state.activePage ? ' is-active' : ''}`
      button.type = 'button'
      button.dataset.pageIndex = page.index
      const image = document.createElement('img')
      image.src = page.imageUrl
      image.alt = ''
      const label = document.createElement('span')
      label.textContent = `Страница ${page.index + 1}`
      button.append(image, label)
      button.addEventListener('click', () => focusPage(page.index))
      elements.thumbnails.append(button)
    }
  }

  function typeLabel(type) {
    return ({ text: 'Текст', stamp: 'Штамп', seal: 'Круглая печать', signature: 'Подпись', logo: 'Логотип', image: 'Изображение', unknown: 'Не определено' })[type] || type
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
      for (const property of ['fontSizePx', 'fontWeight', 'fontStyle', 'color']) {
        if (range[property] != null) result[property] = range[property]
      }
    }
    return result
  }

  function renderTextContent(content, object) {
    const text = objectOutput(object)
    const field = objectOutputField(object)
    content.dataset.outputField = field
    const ranges = styleRanges(object, field).filter(range => range.end > range.start && range.start < text.length)
    if (!ranges.length) {
      content.textContent = text
      return
    }
    const points = new Set([0, text.length])
    for (const range of ranges) {
      points.add(Math.max(0, Math.min(text.length, range.start)))
      points.add(Math.max(0, Math.min(text.length, range.end)))
    }
    const sorted = [...points].sort((left, right) => left - right)
    const fragment = document.createDocumentFragment()
    for (let index = 0; index < sorted.length - 1; index += 1) {
      const start = sorted[index]
      const end = sorted[index + 1]
      if (end <= start) continue
      const value = text.slice(start, end)
      const runStyle = effectiveTextStyle(object, field, start)
      if (!Object.keys(runStyle).length) {
        fragment.append(document.createTextNode(value))
        continue
      }
      const span = document.createElement('span')
      span.dataset.textStyle = 'true'
      span.textContent = value
      if (runStyle.fontSizePx != null) span.style.fontSize = `${runStyle.fontSizePx}px`
      if (runStyle.fontWeight != null) span.style.fontWeight = runStyle.fontWeight
      if (runStyle.fontStyle != null) span.style.fontStyle = runStyle.fontStyle
      if (runStyle.color != null) span.style.color = runStyle.color
      fragment.append(span)
    }
    content.replaceChildren(fragment)
  }

  function getTextSelection(content, objectId) {
    const selection = window.getSelection?.()
    if (!selection?.rangeCount) return null
    const range = selection.getRangeAt(0)
    if (!content.contains(range.commonAncestorContainer)) return null
    const before = range.cloneRange()
    before.selectNodeContents(content)
    before.setEnd(range.startContainer, range.startOffset)
    return { objectId, start: before.toString().length, end: before.toString().length + range.toString().length }
  }

  function rememberTextSelection(content, objectId) {
    const selection = getTextSelection(content, objectId)
    if (selection) state.lastTextSelection = selection
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
          if (parent.style.fontSize) range.fontSizePx = Number.parseFloat(parent.style.fontSize)
          if (parent.style.fontWeight) range.fontWeight = Number.parseFloat(parent.style.fontWeight) || (parent.style.fontWeight === 'bold' ? 700 : undefined)
          if (parent.style.fontStyle) range.fontStyle = parent.style.fontStyle
          if (parent.style.color) range.color = parent.style.color
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

  function createObjectElement(object) {
    const node = document.createElement('article')
    node.className = 'scene-object'
    if (!object.translation && object.type === 'text') node.classList.add('is-untranslated')
    if (object.confidence < .76) node.classList.add('is-low-confidence')
    if (state.selected.has(object.id)) node.classList.add('is-selected')
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
    handle.className = 'scene-object__handle'
    handle.type = 'button'
    handle.textContent = '⠿'
    handle.title = 'Переместить'
    handle.addEventListener('pointerdown', event => beginDrag(event, object.id))
    const content = document.createElement('div')
    content.className = 'scene-object__content'
    content.contentEditable = 'true'
    content.spellcheck = true
    renderTextContent(content, object)
    content.addEventListener('focus', () => {
      if (!state.selected.has(object.id)) selectOnly(object.id)
      if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true }
    })
    for (const eventName of ['pointerup', 'keyup']) content.addEventListener(eventName, () => rememberTextSelection(content, object.id))
    content.addEventListener('blur', () => { state.textCheckpoint = false; scheduleSave() })
    content.addEventListener('input', () => {
      object.translation = String(content.innerText ?? content.textContent).replace(/\n{3,}/g, '\n\n')
      object.translationTextStyles = extractInlineStyles(content, object.translation)
      object.status = 'edited'
      node.classList.toggle('is-untranslated', !object.translation && object.type === 'text')
      if (state.selected.size === 1) elements.translationText.value = object.translation
      scheduleSave()
    })
    const resize = document.createElement('span')
    resize.className = 'scene-object__resize'
    resize.addEventListener('pointerdown', event => beginResize(event, object.id))
    node.append(badge, handle, content, resize)
    return node
  }

  function positionObjectNode(node, object) {
    Object.assign(node.style, {
      left: `${object.x}px`, top: `${object.y}px`, width: `${object.width}px`, height: `${object.height}px`,
      transform: object.rotation ? `rotate(${object.rotation}deg)` : '',
    })
  }

  function applyZoom() {
    for (const shell of elements.canvas.querySelectorAll('.studio-page-shell')) {
      const page = state.scene.pages[Number(shell.dataset.pageIndex)]
      shell.style.width = `${page.widthPx * state.zoom}px`
      shell.style.height = `${page.heightPx * state.zoom}px`
      const surface = shell.querySelector('.studio-page')
      surface.style.transform = `scale(${state.zoom})`
    }
    elements.zoomOutput.value = `${Math.round(state.zoom * 100)}%`
  }

  function setZoom(nextZoom, anchorEvent) {
    const next = Math.min(2.5, Math.max(.25, Math.round(nextZoom * 20) / 20))
    if (next === state.zoom) return
    let anchor = null
    if (anchorEvent) {
      const surface = document.elementFromPoint(anchorEvent.clientX, anchorEvent.clientY)?.closest('.studio-page')
      if (surface) {
        const rect = surface.getBoundingClientRect()
        anchor = {
          surface,
          x: (anchorEvent.clientX - rect.left) / state.zoom,
          y: (anchorEvent.clientY - rect.top) / state.zoom,
          clientX: anchorEvent.clientX,
          clientY: anchorEvent.clientY,
        }
      }
    }
    state.zoom = next
    applyZoom()
    if (anchor) requestAnimationFrame(() => {
      const rect = anchor.surface.getBoundingClientRect()
      elements.canvasScroll.scrollBy({
        left: rect.left + anchor.x * state.zoom - anchor.clientX,
        top: rect.top + anchor.y * state.zoom - anchor.clientY,
      })
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

  function selectOnly(id) {
    state.selected = new Set(id ? [id] : [])
    if (!id || state.lastTextSelection?.objectId !== id) state.lastTextSelection = null
    refreshSelection()
  }

  function selectFromPointer(event, id) {
    if (event.button !== 0 || event.target.closest('.scene-object__handle, .scene-object__resize')) return
    event.stopPropagation()
    if (event.metaKey || event.ctrlKey) {
      if (state.selected.has(id)) state.selected.delete(id)
      else state.selected.add(id)
    } else if (!state.selected.has(id)) {
      state.selected = new Set([id])
    }
    const object = state.scene.objects.find(item => item.id === id)
    if (object) state.activePage = object.pageIndex
    refreshSelection()
  }

  function refreshSelection() {
    for (const node of elements.canvas.querySelectorAll('.scene-object')) node.classList.toggle('is-selected', state.selected.has(node.dataset.id))
    const selection = selectedObjects()
    elements.emptyInspector.hidden = selection.length > 0
    elements.objectInspector.hidden = selection.length === 0
    elements.merge.disabled = selection.length < 2 || new Set(selection.map(item => item.pageIndex)).size !== 1
    if (!selection.length) return
    const first = selection[0]
    elements.selectionTitle.textContent = selection.length === 1 ? `${typeLabel(first.type)} · стр. ${first.pageIndex + 1}` : `${selection.length} сегмента`
    elements.selectionCount.textContent = selection.length
    setMixedControl(elements.objectType, selection.map(item => item.type))
    setMixedControl(elements.sourceText, selection.map(item => item.sourceText))
    setMixedControl(elements.translationText, selection.map(item => item.translation))
    elements.confidence.textContent = selection.length === 1 ? `${Math.round(first.confidence * 100)}%` : 'несколько'
    setMixedControl(elements.fontSize, selection.map(item => item.style.fontSizePx))
    setMixedControl(elements.lineHeight, selection.map(item => item.style.lineHeight))
    setMixedControl(elements.objectX, selection.map(item => Math.round(item.x)))
    setMixedControl(elements.objectY, selection.map(item => Math.round(item.y)))
    setMixedControl(elements.objectWidth, selection.map(item => Math.round(item.width)))
    setMixedControl(elements.objectHeight, selection.map(item => Math.round(item.height)))
    elements.toolbarFontSize.value = String(Math.round(first.style.fontSizePx))
    document.querySelectorAll('.format-button').forEach(button => {
      const action = button.dataset.format
      const active = action === 'bold' ? selection.every(item => item.style.fontWeight >= 600)
        : action === 'italic' ? selection.every(item => item.style.fontStyle === 'italic')
          : selection.every(item => item.style.textAlign === action)
      button.classList.toggle('is-active', active)
    })
  }

  function setMixedControl(control, values) {
    const first = values[0]
    control.value = values.every(value => String(value) === String(first)) ? first : ''
    control.placeholder = values.length > 1 && control.value === '' ? 'разные значения' : ''
  }

  function beginMarquee(event) {
    if (event.button !== 0 || event.target.closest('.scene-object')) return
    event.preventDefault()
    const surface = event.currentTarget
    const additive = event.metaKey || event.ctrlKey
    const originalSelection = additive ? new Set(state.selected) : new Set()
    const start = { x: event.clientX, y: event.clientY }
    elements.selectionBox.hidden = false
    Object.assign(elements.selectionBox.style, { left: `${start.x}px`, top: `${start.y}px`, width: '0px', height: '0px' })
    surface.setPointerCapture(event.pointerId)
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
    const finish = current => {
      move(current)
      elements.selectionBox.hidden = true
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerup', finish)
      surface.removeEventListener('pointercancel', finish)
    }
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerup', finish)
    surface.addEventListener('pointercancel', finish)
  }

  function beginDrag(event, id) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    state.lastTextSelection = null
    if (!state.selected.has(id)) state.selected = new Set([id])
    checkpoint()
    refreshSelection()
    const objects = selectedObjects()
    const handle = event.currentTarget
    const pointerId = event.pointerId
    const origins = new Map(objects.map(object => [object.id, { x: object.x, y: object.y, pageIndex: object.pageIndex }]))
    const start = { x: event.clientX, y: event.clientY, scrollLeft: elements.canvasScroll.scrollLeft, scrollTop: elements.canvasScroll.scrollTop }
    const action = { kind: 'drag', pointerId: event.pointerId, objects, origins, start, lastX: event.clientX, lastY: event.clientY }
    state.pointerAction = action
    handle.setPointerCapture(pointerId)
    const update = current => {
      action.lastX = current.clientX
      action.lastY = current.clientY
      const deltaX = (current.clientX - start.x + elements.canvasScroll.scrollLeft - start.scrollLeft) / state.zoom
      const deltaY = (current.clientY - start.y + elements.canvasScroll.scrollTop - start.scrollTop) / state.zoom
      for (const object of objects) {
        const page = state.scene.pages[object.pageIndex]
        const origin = origins.get(object.id)
        object.x = Math.min(Math.max(0, origin.x + deltaX), Math.max(0, page.widthPx - object.width))
        object.y = Math.min(Math.max(0, origin.y + deltaY), Math.max(0, page.heightPx - object.height))
        const node = elements.canvas.querySelector(`[data-id="${CSS.escape(object.id)}"]`)
        if (node) positionObjectNode(node, object)
      }
      refreshInspectorCoordinates()
    }
    const finish = current => {
      update(current)
      const destination = document.elementFromPoint(current.clientX, current.clientY)?.closest('.studio-page')
      if (destination && objects.every(object => object.pageIndex === objects[0].pageIndex)) {
        const destinationIndex = Number(destination.dataset.pageIndex)
        if (destinationIndex !== objects[0].pageIndex) moveSelectionToPage(destinationIndex, current.clientX, current.clientY, objects)
      }
      state.pointerAction = null
      handle.removeEventListener('pointermove', update)
      handle.removeEventListener('pointerup', finish)
      handle.removeEventListener('pointercancel', finish)
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId)
      renderDocument()
      scheduleSave()
    }
    handle.addEventListener('pointermove', update)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
    action.updateFromScroll = () => update({ clientX: action.lastX, clientY: action.lastY })
  }

  function moveSelectionToPage(pageIndex, clientX, clientY, objects) {
    const destination = elements.canvas.querySelector(`.studio-page[data-page-index="${pageIndex}"]`)
    if (!destination) return
    const rect = destination.getBoundingClientRect()
    const left = Math.min(...objects.map(object => object.x))
    const top = Math.min(...objects.map(object => object.y))
    const anchorX = (clientX - rect.left) / state.zoom
    const anchorY = (clientY - rect.top) / state.zoom
    for (const object of objects) {
      const offsetX = object.x - left
      const offsetY = object.y - top
      object.pageIndex = pageIndex
      object.x = Math.max(0, anchorX + offsetX)
      object.y = Math.max(0, anchorY + offsetY)
    }
    state.activePage = pageIndex
  }

  function beginResize(event, id) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const object = state.scene.objects.find(item => item.id === id)
    if (!object) return
    const handle = event.currentTarget
    const pointerId = event.pointerId
    checkpoint()
    const start = { x: event.clientX, y: event.clientY, width: object.width, height: object.height }
    handle.setPointerCapture(pointerId)
    const update = current => {
      const page = state.scene.pages[object.pageIndex]
      object.width = Math.min(page.widthPx - object.x, Math.max(12, start.width + (current.clientX - start.x) / state.zoom))
      object.height = Math.min(page.heightPx - object.y, Math.max(12, start.height + (current.clientY - start.y) / state.zoom))
      const node = elements.canvas.querySelector(`[data-id="${CSS.escape(id)}"]`)
      if (node) positionObjectNode(node, object)
      refreshInspectorCoordinates()
    }
    const finish = current => {
      update(current)
      handle.removeEventListener('pointermove', update)
      handle.removeEventListener('pointerup', finish)
      handle.removeEventListener('pointercancel', finish)
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId)
      scheduleSave()
    }
    handle.addEventListener('pointermove', update)
    handle.addEventListener('pointerup', finish)
    handle.addEventListener('pointercancel', finish)
  }

  function refreshInspectorCoordinates() {
    const selection = selectedObjects()
    if (selection.length !== 1) return
    const object = selection[0]
    elements.objectX.value = Math.round(object.x)
    elements.objectY.value = Math.round(object.y)
    elements.objectWidth.value = Math.round(object.width)
    elements.objectHeight.value = Math.round(object.height)
  }

  function checkpoint() {
    if (!state.scene) return
    state.history.push(JSON.stringify(state.scene))
    if (state.history.length > 60) state.history.shift()
    state.future = []
    refreshUndoButtons()
  }

  function undo() {
    if (!state.history.length) return
    state.future.push(JSON.stringify(state.scene))
    state.scene = JSON.parse(state.history.pop())
    state.selected.clear()
    renderDocument()
    refreshUndoButtons()
    scheduleSave()
  }

  function redo() {
    if (!state.future.length) return
    state.history.push(JSON.stringify(state.scene))
    state.scene = JSON.parse(state.future.pop())
    state.selected.clear()
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

  async function translateSelection() {
    if (!state.scene) return
    elements.agentStatus.textContent = 'Ищем совпадения в БЗ и готовим перевод…'
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectIds: [...state.selected] }),
      })
      const data = await response.json()
      checkpoint()
      state.scene = data.scene
      renderDocument()
      elements.agentStatus.textContent = data.message
      showToast(data.message, data.pending.length > 0 && !data.translated.length)
    } catch (error) {
      elements.agentStatus.textContent = 'Перевод не выполнен.'
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

  async function runOcrReview() {
    if (!state.scene) return
    elements.agentStatus.textContent = 'Проверяем полноту OCR, склейки слов и смысл соседних сегментов…'
    try {
      await saveScene(true)
      const response = await api(`/api/studio/documents/${state.metadata.id}/agent/review-ocr`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectIds: [...state.selected] }),
      })
      const report = await response.json()
      showOcrReview(report)
      elements.agentStatus.textContent = report.message
      showToast(`Проверка OCR: ${report.counts.total} рекомендаций`)
    } catch (error) {
      elements.agentStatus.textContent = 'Проверка OCR не выполнена.'
      showToast(error.message, true)
    }
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

  function applyOcrSuggestions(suggestions) {
    const applicable = suggestions.filter(suggestion => suggestion.applicable && suggestion.objectId && suggestion.suggestedText)
    if (!applicable.length) return
    checkpoint()
    let applied = 0
    for (const suggestion of applicable) {
      const object = state.scene.objects.find(item => item.id === suggestion.objectId)
      if (!object || String(object.sourceText || '').trim() !== String(suggestion.originalText || '').trim()) continue
      object.sourceText = suggestion.suggestedText
      object.sourceTextStyles = []
      object.status = 'ocr-reviewed'
      applied += 1
    }
    renderDocument()
    scheduleSave()
    showToast(`Применено OCR-правок: ${applied}`)
  }

  function showOcrReview(report) {
    elements.qaPanel.hidden = false
    elements.qaTitle.textContent = 'Рекомендации по OCR'
    elements.qaSummary.innerHTML = `
      <div><strong>${report.counts.total}</strong><span>всего</span></div>
      <div><strong>${report.counts.agent}</strong><span>от агента</span></div>
      <div><strong>${report.counts.applicable}</strong><span>можно применить</span></div>`
    elements.qaActions.replaceChildren()
    const highConfidence = report.suggestions.filter(item => item.applicable && item.confidence >= .82)
    if (highConfidence.length) {
      const applyAll = document.createElement('button')
      applyAll.type = 'button'
      applyAll.className = 'button button--primary'
      applyAll.textContent = `Применить надёжные (${highConfidence.length})`
      applyAll.addEventListener('click', () => applyOcrSuggestions(highConfidence))
      elements.qaActions.append(applyAll)
    }
    elements.qaList.replaceChildren()
    if (!report.suggestions.length) {
      const item = document.createElement('div')
      item.className = 'qa-item'
      item.textContent = 'Локальная проверка не нашла подозрительных фрагментов.'
      elements.qaList.append(item)
      return
    }
    for (const suggestion of report.suggestions) {
      const item = document.createElement('article')
      item.className = 'qa-suggestion'
      item.dataset.source = suggestion.source
      const meta = document.createElement('div')
      meta.className = 'qa-suggestion__meta'
      meta.innerHTML = `<span>${suggestion.source === 'agent' ? 'Агент' : 'Локальная проверка'} · стр. ${suggestion.pageIndex + 1}</span><strong>${Math.round(suggestion.confidence * 100)}%</strong>`
      const reason = document.createElement('strong')
      reason.textContent = suggestion.reason
      item.append(meta, reason)
      if (suggestion.originalText) {
        const original = document.createElement('del')
        original.textContent = suggestion.originalText
        item.append(original)
      }
      if (suggestion.suggestedText) {
        const proposed = document.createElement('ins')
        proposed.textContent = suggestion.suggestedText
        item.append(proposed)
      }
      const buttons = document.createElement('div')
      buttons.className = 'qa-suggestion__buttons'
      if (suggestion.objectId) {
        const show = document.createElement('button')
        show.type = 'button'
        show.textContent = 'Показать'
        show.addEventListener('click', () => {
          state.selected = new Set([suggestion.objectId])
          focusPage(suggestion.pageIndex, suggestion.objectId)
          refreshSelection()
        })
        buttons.append(show)
      }
      if (suggestion.applicable) {
        const apply = document.createElement('button')
        apply.type = 'button'
        apply.textContent = 'Применить'
        apply.addEventListener('click', () => { applyOcrSuggestions([suggestion]); item.remove() })
        buttons.append(apply)
      } else if (suggestion.kind === 'missing-text' && suggestion.suggestedText) {
        const create = document.createElement('button')
        create.type = 'button'
        create.textContent = 'Создать сегмент'
        create.addEventListener('click', () => {
          addObject({ pageIndex: suggestion.pageIndex, sourceText: suggestion.suggestedText })
          item.remove()
        })
        buttons.append(create)
      }
      if (buttons.childElementCount) item.append(buttons)
      elements.qaList.append(item)
    }
  }

  async function findMemory() {
    const object = selectedObjects()[0]
    if (!object) return
    elements.memoryResults.innerHTML = '<small>Ищем…</small>'
    try {
      const response = await api(`/api/studio/translation-memory?query=${encodeURIComponent(object.sourceText)}&targetLanguage=${encodeURIComponent(state.scene.targetLanguage)}`)
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
        button.innerHTML = `<span>${escapeHtml(match.translation)}</span><small>Совпадение ${Math.round(match.score * 100)}%</small>`
        button.addEventListener('click', () => {
          checkpoint()
          for (const selected of selectedObjects()) { selected.translation = match.translation; selected.translationTextStyles = [] }
          renderDocument()
          scheduleSave()
        })
        elements.memoryResults.append(button)
      }
    } catch (error) { elements.memoryResults.innerHTML = `<small>${escapeHtml(error.message)}</small>` }
  }

  async function approveTranslation() {
    const objects = selectedObjects().filter(object => object.sourceText.trim() && object.translation.trim())
    if (!objects.length) return showToast('Введите исходный текст и перевод', true)
    try {
      await Promise.all(objects.map(object => api('/api/studio/translation-memory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText: object.sourceText, translation: object.translation, sourceLanguage: state.scene.sourceLanguage, targetLanguage: state.scene.targetLanguage }),
      })))
      for (const object of objects) object.status = 'approved'
      scheduleSave()
      showToast(`Подтверждено: ${objects.length}. Перевод добавлен в локальную БЗ.`)
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
    first.sourceText = source.text
    first.sourceTextStyles = source.ranges
    first.translation = translation.text
    first.translationTextStyles = translation.ranges
    first.type = 'text'
    first.originalBounds = { x: first.x, y: first.y, width: first.width, height: first.height }
    const removed = new Set(objects.slice(1).map(item => item.id))
    state.scene.objects = state.scene.objects.filter(item => !removed.has(item.id))
    state.selected = new Set([first.id])
    renderDocument()
    scheduleSave()
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
      sourceTextStyles: [], translationTextStyles: [], ocrAlternatives: [],
      x: page.contentBounds.x, y: page.contentBounds.y, width: Math.min(280, page.contentBounds.width), height: 42, rotation: 0,
      excluded: false, status: 'manual', sourceLineIds: [],
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
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
    const field = objectOutputField(object)
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
    next.ocrAlternatives = []
    next.confidence = 1
    next.status = 'manual-split'
    next.sourceText = field === 'sourceText' ? extractedText : ''
    next.translation = field === 'translation' ? extractedText : ''
    next.sourceTextStyles = field === 'sourceText' ? clippedRanges(originalRanges, start, extractedEnd, start) : []
    next.translationTextStyles = field === 'translation' ? clippedRanges(originalRanges, start, extractedEnd, start) : []
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
    const objects = selectedObjects()
    if (objects.length !== 1) return null
    const liveContent = elements.canvas.querySelector(`[data-id="${CSS.escape(objects[0].id)}"] .scene-object__content`)
    const liveRange = liveContent ? getTextSelection(liveContent, objects[0].id) : null
    const range = liveRange && liveRange.end > liveRange.start ? liveRange : state.lastTextSelection
    if (!range || range.objectId !== objects[0].id || range.end <= range.start) return null
    const text = objectOutput(objects[0])
    return { object: objects[0], field: objectOutputField(objects[0]), start: Math.max(0, Math.min(text.length, range.start)), end: Math.max(0, Math.min(text.length, range.end)) }
  }

  function applySelectedTextStyle(patch) {
    const selection = selectedTextRange()
    if (!selection) return false
    checkpoint()
    styleRanges(selection.object, selection.field).push({ start: selection.start, end: selection.end, ...patch })
    renderDocument()
    scheduleSave()
    return true
  }

  function applyFormatting(action) {
    const textSelection = selectedTextRange()
    if (textSelection && ['bold', 'italic'].includes(action)) {
      const current = effectiveTextStyle(textSelection.object, textSelection.field, textSelection.start)
      const patch = action === 'bold'
        ? { fontWeight: (current.fontWeight ?? textSelection.object.style.fontWeight) >= 600 ? 400 : 700 }
        : { fontStyle: (current.fontStyle ?? textSelection.object.style.fontStyle) === 'italic' ? 'normal' : 'italic' }
      applySelectedTextStyle(patch)
      return
    }
    applySelectionChange(object => {
      if (action === 'bold') object.style.fontWeight = object.style.fontWeight >= 600 ? 400 : 700
      else if (action === 'italic') object.style.fontStyle = object.style.fontStyle === 'italic' ? 'normal' : 'italic'
      else object.style.textAlign = action
    })
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

  function applySelectionChange(callback, rerender = true) {
    const objects = selectedObjects()
    if (!objects.length) return
    checkpoint()
    for (const object of objects) callback(object)
    if (rerender) renderDocument()
    else refreshSelection()
    scheduleSave()
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
      if (object.type !== 'text' && !object.translation) object.translation = ({ stamp: '/Штамп/', seal: '/Круглая печать/', signature: '/Подпись/', logo: '/Логотип/', image: '/Изображение/' })[object.type] || ''
    }))
    const bindText = (control, field) => {
      control.addEventListener('focus', () => { if (!state.textCheckpoint) { checkpoint(); state.textCheckpoint = true } })
      control.addEventListener('input', () => {
        for (const object of selectedObjects()) {
          object[field] = control.value
          object[field === 'translation' ? 'translationTextStyles' : 'sourceTextStyles'] = []
          object.status = 'edited'
        }
        renderSelectedText(field)
        scheduleSave()
      })
      control.addEventListener('blur', () => { state.textCheckpoint = false })
    }
    bindText(elements.sourceText, 'sourceText')
    bindText(elements.translationText, 'translation')
    const numeric = [
      [elements.fontSize, (object, value) => { object.style.fontSizePx = value }],
      [elements.lineHeight, (object, value) => { object.style.lineHeight = value }],
      [elements.objectX, (object, value) => { object.x = value }], [elements.objectY, (object, value) => { object.y = value }],
      [elements.objectWidth, (object, value) => { object.width = Math.max(12, value) }], [elements.objectHeight, (object, value) => { object.height = Math.max(12, value) }],
    ]
    for (const [control, apply] of numeric) control.addEventListener('change', () => {
      const value = Number(control.value)
      if (Number.isFinite(value)) applySelectionChange(object => apply(object, value))
    })
  }

  function renderSelectedText(field) {
    for (const object of selectedObjects()) {
      const node = elements.canvas.querySelector(`[data-id="${CSS.escape(object.id)}"]`)
      if (!node) continue
      renderTextContent(node.querySelector('.scene-object__content'), object)
      node.classList.toggle('is-untranslated', !object.translation && object.type === 'text')
    }
  }

  function bindEvents() {
    elements.fileInput.addEventListener('change', () => upload(elements.fileInput.files[0]))
    for (const eventName of ['dragenter', 'dragover']) elements.uploadZone.addEventListener(eventName, event => { event.preventDefault(); elements.uploadZone.classList.add('is-dragover') })
    for (const eventName of ['dragleave', 'drop']) elements.uploadZone.addEventListener(eventName, event => { event.preventDefault(); elements.uploadZone.classList.remove('is-dragover') })
    elements.uploadZone.addEventListener('drop', event => upload([...event.dataTransfer.files][0]))
    elements.newDocument.addEventListener('click', async () => {
      if (state.saveTimer) await saveScene()
      history.replaceState(null, '', '/')
      location.reload()
    })
    elements.zoomOut.addEventListener('click', () => setZoom(state.zoom - .1))
    elements.zoomIn.addEventListener('click', () => setZoom(state.zoom + .1))
    elements.zoomFit.addEventListener('click', fitWidth)
    elements.canvasScroll.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      setZoom(state.zoom + (event.deltaY < 0 ? .1 : -.1), event)
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
    elements.sourceZoomFit.addEventListener('click', fitSourceWidth)
    elements.sourcePreviewScroll.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      setSourceZoom(state.sourceZoom + (event.deltaY < 0 ? .1 : -.1), event)
    }, { passive: false })
    elements.sourceLanguage.addEventListener('change', () => { state.scene.sourceLanguage = elements.sourceLanguage.value; scheduleSave() })
    elements.targetLanguage.addEventListener('change', () => { state.scene.targetLanguage = elements.targetLanguage.value; scheduleSave() })
    elements.analyze.addEventListener('click', () => runAgent('analyze', 'Проверяем порядок чтения и типы объектов…'))
    elements.ocrReview.addEventListener('click', runOcrReview)
    elements.autoLayout.addEventListener('click', () => { checkpoint(); runAgent('auto-layout', 'Расширяем текстовые блоки и устраняем наложения…') })
    elements.translate.addEventListener('click', translateSelection)
    elements.qa.addEventListener('click', runQa)
    elements.qaClose.addEventListener('click', () => { elements.qaPanel.hidden = true })
    elements.addObject.addEventListener('click', () => addObject())
    elements.memorySearch.addEventListener('click', findMemory)
    elements.approve.addEventListener('click', approveTranslation)
    elements.merge.addEventListener('click', mergeSelected)
    elements.split.addEventListener('click', splitSelectedText)
    elements.resetPosition.addEventListener('click', resetPosition)
    elements.exclude.addEventListener('click', excludeSelected)
    elements.exportDocx.addEventListener('click', () => exportDocument('docx'))
    elements.exportPdf.addEventListener('click', () => exportDocument('pdf'))
    elements.undo.addEventListener('click', undo)
    elements.redo.addEventListener('click', redo)
    elements.toolbarFontSize.addEventListener('change', () => {
      const value = Number(elements.toolbarFontSize.value)
      if (!applySelectedTextStyle({ fontSizePx: value })) applySelectionChange(object => { object.style.fontSizePx = value })
    })
    document.querySelectorAll('.format-button').forEach(button => button.addEventListener('click', () => applyFormatting(button.dataset.format)))
    document.querySelectorAll('.workflow__step').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('.workflow__step').forEach(item => item.classList.toggle('is-active', item === button))
      if (button.dataset.stage === 'qa' && state.scene) runQa()
    }))
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo(); else undo()
      }
      if (event.key === 'Escape') {
        state.selected.clear()
        state.lastTextSelection = null
        elements.qaPanel.hidden = true
        refreshSelection()
        document.activeElement?.blur?.()
      }
    })
    window.addEventListener('pagehide', () => {
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
    } catch {
      state.serviceStatus = null
    }
  }

  async function restoreDocumentFromUrl() {
    const id = new URL(location.href).searchParams.get('document')
    if (!/^[a-f0-9]{32}$/.test(id || '')) {
      setView('upload')
      return
    }
    setView('loading')
    elements.loadingMessage.textContent = 'Открываем сохранённый локальный проект…'
    try {
      const response = await api(`/api/studio/documents/${id}`)
      openDocument(await response.json())
    } catch (error) {
      history.replaceState(null, '', '/')
      setView('upload')
      showToast(error.message, true)
    }
  }

  bindEvents()
  loadServiceStatus().finally(restoreDocumentFromUrl)
})()
