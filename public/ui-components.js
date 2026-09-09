(() => {
  const viewport = document.querySelector('.source-preview-demo__viewport')
  const shell = document.querySelector('#component-document-shell')
  const documentPage = document.querySelector('#component-document')
  const output = document.querySelector('#component-source-zoom-output')
  if (!viewport || !shell || !documentPage || !output) return

  const pageWidth = 520
  const pageHeight = 680
  let zoom = .7

  function clamp(value) {
    return Math.max(.2, Math.min(2, value))
  }

  function applyZoom(nextZoom) {
    zoom = clamp(nextZoom)
    shell.style.width = `${pageWidth * zoom}px`
    shell.style.height = `${pageHeight * zoom}px`
    documentPage.style.transform = `scale(${zoom})`
    output.value = `${Math.round(zoom * 100)}%`
  }

  function fitDocument() {
    const availableWidth = Math.max(100, viewport.clientWidth - 56)
    const availableHeight = Math.max(100, viewport.clientHeight - 56)
    applyZoom(Math.min(availableWidth / pageWidth, availableHeight / pageHeight))
    viewport.scrollTo({ left: 0, top: 0 })
  }

  document.querySelector('#component-source-zoom-out')?.addEventListener('click', () => applyZoom(zoom - .1))
  document.querySelector('#component-source-zoom-in')?.addEventListener('click', () => applyZoom(zoom + .1))
  document.querySelector('#component-source-zoom-100')?.addEventListener('click', () => applyZoom(1))
  document.querySelector('#component-source-zoom-fit')?.addEventListener('click', fitDocument)
  window.addEventListener('resize', () => {
    if (zoom < 1) fitDocument()
  })

  applyZoom(zoom)

  const fontSizeOutput = document.querySelector('#component-font-size-output')
  let fontSize = 14
  const setFontSize = next => {
    fontSize = Math.min(80, Math.max(10, next))
    if (fontSizeOutput) fontSizeOutput.value = String(fontSize)
  }
  document.querySelector('#component-font-size-decrease')?.addEventListener('click', () => setFontSize(fontSize - 1))
  document.querySelector('#component-font-size-increase')?.addEventListener('click', () => setFontSize(fontSize + 1))
  fontSizeOutput?.addEventListener('change', () => setFontSize(Number(fontSizeOutput.value) || fontSize))

  const colorInput = document.querySelector('#component-text-color')
  const colorPicker = colorInput?.closest('.color-picker')
  const refreshColor = () => colorPicker?.style.setProperty('--color-picker-value', colorInput.value)
  colorInput?.addEventListener('input', refreshColor)
  refreshColor()
})()
