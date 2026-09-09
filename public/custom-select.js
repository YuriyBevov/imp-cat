(() => {
  const instances = new Map()
  let activeInstance = null
  let generatedId = 0

  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
  const icon = name => `<svg class="ui-icon" aria-hidden="true"><use href="/icons.svg#icon-${name}"></use></svg>`

  function optionList(select) {
    return [...select.options]
  }

  function positionContent(instance) {
    if (instance.content.hidden) return
    const rect = instance.trigger.getBoundingClientRect()
    const viewportPadding = 12
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding
    const desiredHeight = Math.min(280, instance.content.scrollHeight || 280)
    const placeAbove = availableBelow < Math.min(160, desiredHeight) && rect.top > availableBelow
    const top = placeAbove
      ? Math.max(viewportPadding, rect.top - desiredHeight - 4)
      : Math.min(window.innerHeight - viewportPadding, rect.bottom + 4)
    const width = Math.max(rect.width, 1)
    const left = Math.min(window.innerWidth - width - viewportPadding, Math.max(viewportPadding, rect.left))
    Object.assign(instance.content.style, { left: `${left}px`, top: `${top}px`, width: `${width}px` })
  }

  function setHighlighted(instance, index) {
    const items = [...instance.content.querySelectorAll('.base-select__item:not(:disabled)')]
    if (!items.length) return
    const bounded = Math.min(items.length - 1, Math.max(0, index))
    items.forEach((item, itemIndex) => item.dataset.highlighted = String(itemIndex === bounded))
    instance.highlightedIndex = bounded
    items[bounded].scrollIntoView?.({ block: 'nearest' })
  }

  function close(instance, restoreFocus = false) {
    if (!instance || instance.content.hidden) return
    instance.content.hidden = true
    instance.trigger.dataset.state = 'closed'
    instance.trigger.setAttribute('aria-expanded', 'false')
    instance.highlightedIndex = -1
    if (activeInstance === instance) activeInstance = null
    if (restoreFocus) instance.trigger.focus()
  }

  function selectOption(instance, option) {
    if (!option || option.disabled || option.parentElement?.disabled) return
    instance.select.value = option.value
    instance.select.dispatchEvent(new Event('input', { bubbles: true }))
    instance.select.dispatchEvent(new Event('change', { bubbles: true }))
    instance.refresh()
    close(instance, true)
  }

  function renderOptions(instance) {
    const fragment = document.createDocumentFragment()
    for (const child of instance.select.children) {
      if (child instanceof HTMLOptGroupElement) {
        const label = document.createElement('div')
        label.className = 'base-select__group-label'
        label.textContent = child.label
        fragment.append(label)
        for (const option of child.children) fragment.append(createItem(instance, option))
      } else if (child instanceof HTMLOptionElement) {
        fragment.append(createItem(instance, child))
      }
    }
    instance.viewport.replaceChildren(fragment)
  }

  function createItem(instance, option) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'base-select__item'
    item.dataset.value = option.value
    item.dataset.state = option.selected ? 'checked' : 'unchecked'
    item.setAttribute('role', 'option')
    item.setAttribute('aria-selected', String(option.selected))
    item.disabled = option.disabled || Boolean(option.parentElement?.disabled)
    const label = document.createElement('span')
    label.textContent = option.textContent
    const indicator = document.createElement('span')
    indicator.className = 'base-select__indicator'
    if (option.selected) indicator.innerHTML = icon('check')
    item.append(label, indicator)
    item.addEventListener('pointermove', () => {
      const available = [...instance.content.querySelectorAll('.base-select__item:not(:disabled)')]
      setHighlighted(instance, available.indexOf(item))
    })
    item.addEventListener('click', () => selectOption(instance, option))
    return item
  }

  function open(instance) {
    if (instance.select.disabled) return
    if (activeInstance && activeInstance !== instance) close(activeInstance)
    renderOptions(instance)
    instance.content.hidden = false
    instance.trigger.dataset.state = 'open'
    instance.trigger.setAttribute('aria-expanded', 'true')
    activeInstance = instance
    positionContent(instance)
    const enabled = [...instance.content.querySelectorAll('.base-select__item:not(:disabled)')]
    const selectedIndex = enabled.findIndex(item => item.dataset.state === 'checked')
    setHighlighted(instance, selectedIndex >= 0 ? selectedIndex : 0)
  }

  function enhance(select) {
    if (!(select instanceof HTMLSelectElement) || instances.has(select) || select.dataset.nativeSelect === 'true') return
    const selectId = select.id || `custom-select-${++generatedId}`
    const contentId = `${selectId}-options`
    const root = document.createElement('span')
    root.className = 'base-select-root'
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'base-select'
    trigger.dataset.state = 'closed'
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', contentId)
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || select.title || 'Выберите значение')
    if (select.dataset.selectIcon) {
      const leadingIcon = document.createElement('span')
      leadingIcon.className = 'base-select__leading-icon'
      leadingIcon.innerHTML = icon(select.dataset.selectIcon)
      trigger.append(leadingIcon)
    }
    const value = document.createElement('span')
    value.className = 'base-select__value'
    const arrow = document.createElement('span')
    arrow.className = 'base-select__icon'
    arrow.innerHTML = icon('chevron-down')
    trigger.append(value, arrow)
    root.append(trigger)

    const content = document.createElement('div')
    content.id = contentId
    content.className = 'base-select__content'
    content.hidden = true
    content.setAttribute('role', 'listbox')
    const viewport = document.createElement('div')
    viewport.className = 'base-select__viewport'
    content.append(viewport)
    document.body.append(content)

    select.classList.add('base-select__native')
    select.after(root)

    const instance = {
      select, root, trigger, value, content, viewport, highlightedIndex: -1,
      refresh() {
        const selected = optionList(select).find(option => option.selected) || optionList(select)[0]
        value.textContent = selected?.textContent || select.placeholder || select.dataset.placeholder || 'Выберите значение'
        value.classList.toggle('base-select__value--placeholder', !selected || selected.value === '')
        trigger.disabled = select.disabled
        if (select.disabled) close(instance)
        if (!content.hidden) renderOptions(instance)
      },
    }
    instances.set(select, instance)

    if (valueDescriptor?.get && valueDescriptor?.set) {
      try {
        Object.defineProperty(select, 'value', {
          configurable: true,
          get() { return valueDescriptor.get.call(select) },
          set(next) {
            valueDescriptor.set.call(select, next)
            queueMicrotask(() => instance.refresh())
          },
        })
      } catch {}
    }

    trigger.addEventListener('click', event => {
      event.preventDefault()
      content.hidden ? open(instance) : close(instance)
    })
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        if (content.hidden) open(instance)
        const enabled = [...content.querySelectorAll('.base-select__item:not(:disabled)')]
        if (!enabled.length) return
        if (event.key === 'Home') setHighlighted(instance, 0)
        else if (event.key === 'End') setHighlighted(instance, enabled.length - 1)
        else setHighlighted(instance, instance.highlightedIndex + (event.key === 'ArrowDown' ? 1 : -1))
      } else if ((event.key === 'Enter' || event.key === ' ') && !content.hidden) {
        event.preventDefault()
        const enabled = [...content.querySelectorAll('.base-select__item:not(:disabled)')]
        const item = enabled[instance.highlightedIndex]
        const option = optionList(select).find(candidate => candidate.value === item?.dataset.value)
        selectOption(instance, option)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        close(instance, true)
      }
    })
    select.addEventListener('change', () => instance.refresh())
    select.form?.addEventListener('reset', () => setTimeout(() => instance.refresh()))
    new MutationObserver(() => instance.refresh()).observe(select, { attributes: true, childList: true, subtree: true })
    instance.refresh()
  }

  function refreshAll() {
    for (const instance of instances.values()) instance.refresh()
  }

  document.querySelectorAll('select').forEach(enhance)
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        if (node.matches('select')) enhance(node)
        node.querySelectorAll?.('select').forEach(enhance)
      }
    }
  }).observe(document.body, { childList: true, subtree: true })

  document.addEventListener('pointerdown', event => {
    if (activeInstance && !activeInstance.root.contains(event.target) && !activeInstance.content.contains(event.target)) close(activeInstance)
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeInstance) close(activeInstance, true)
  })
  window.addEventListener('resize', () => activeInstance && positionContent(activeInstance))
  document.addEventListener('scroll', () => activeInstance && positionContent(activeInstance), true)

  window.IcatCustomSelect = { enhance, refreshAll }
})()
