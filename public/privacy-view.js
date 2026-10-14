(function (root) {
  function dragRegion(start, end, page) {
    const clamp = (value, limit) => Math.max(0, Math.min(limit, Math.round(value)))
    const box = [clamp(Math.min(start.x, end.x), page.width), clamp(Math.min(start.y, end.y), page.height),
      clamp(Math.max(start.x, end.x), page.width), clamp(Math.max(start.y, end.y), page.height)]
    return box[2] - box[0] >= 4 && box[3] - box[1] >= 4 ? { page: page.index, box } : null
  }
  function renderPage(container, page, regions = [], options = {}) {
    const article = document.createElement('article')
    article.className = 'privacy-page'
    const header = document.createElement('header')
    header.className = 'privacy-page__header'
    const title = document.createElement('strong')
    title.textContent = `Страница ${page.index + 1}`
    const toggle = document.createElement('label')
    toggle.className = 'base-checkbox'
    const input = document.createElement('input')
    input.className = 'base-checkbox__input'
    input.type = 'checkbox'
    const control = document.createElement('span')
    control.className = 'base-checkbox__control'
    control.setAttribute('aria-hidden', 'true')
    const label = document.createElement('span')
    label.className = 'base-checkbox__label'
    label.textContent = 'Показать оригинал'
    toggle.append(input, control, label)
    header.append(title, toggle)
    const surface = document.createElement('div')
    surface.className = 'privacy-page__surface'
    const image = document.createElement('img')
    image.src = page.imageUrl
    image.alt = `Очищенная страница ${page.index + 1}`
    image.draggable = false
    input.addEventListener('change', () => {
      image.src = input.checked ? page.originalImageUrl : page.imageUrl
      image.alt = `${input.checked ? 'Оригинал' : 'Очищенная страница'} ${page.index + 1}`
    })
    surface.append(image)
    const overlay = box => {
      const marker = document.createElement('div')
      marker.className = 'privacy-page__mask'
      Object.assign(marker.style, { left: `${box[0] / page.width * 100}%`, top: `${box[1] / page.height * 100}%`,
        width: `${(box[2] - box[0]) / page.width * 100}%`, height: `${(box[3] - box[1]) / page.height * 100}%` })
      surface.append(marker)
      return marker
    }
    for (const region of regions.filter(region => region.page === page.index)) overlay(region.box)
    let dragging = null
    let draft = null
    const point = event => {
      const rect = surface.getBoundingClientRect()
      return { x: (event.clientX - rect.left) / rect.width * page.width,
        y: (event.clientY - rect.top) / rect.height * page.height }
    }
    surface.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !options.drawMode?.()) return
      event.preventDefault()
      dragging = point(event)
      surface.setPointerCapture(event.pointerId)
    })
    surface.addEventListener('pointermove', event => {
      if (!dragging) return
      draft?.remove()
      const region = dragRegion(dragging, point(event), page)
      if (region) draft = overlay(region.box)
    })
    surface.addEventListener('pointerup', event => {
      if (!dragging) return
      const region = dragRegion(dragging, point(event), page)
      dragging = null
      draft?.remove()
      draft = null
      if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId)
      if (region) options.onAdd?.(region)
    })
    surface.addEventListener('pointercancel', () => { dragging = null; draft?.remove(); draft = null })
    const note = document.createElement('p')
    note.className = 'privacy-page__note'
    const tiny = (page.masks || []).filter(mask => !mask.labelRendered).length
    note.textContent = page.unreadable ? 'Страница не читается локальным OCR. Закройте её целиком ручной маской и обновите копию.'
      : tiny ? `В ${tiny} масках не поместилось обозначение. Расширьте эти области и обновите копию.`
      : `Масок: ${(page.masks || []).length}. Слов с низкой уверенностью OCR: ${page.lowConfidenceWords || 0}.`
    article.append(header, surface, note)
    container.append(article)
    return article
  }
  root.IcatPrivacyView = { dragRegion, renderPage }
  if (typeof module !== 'undefined' && module.exports) module.exports = root.IcatPrivacyView
})(typeof window === 'undefined' ? globalThis : window)
