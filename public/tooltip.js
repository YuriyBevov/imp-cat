(() => {
  const triggerSelector = '.icon-button'
  const tooltip = document.createElement('div')
  tooltip.id = 'base-tooltip'
  tooltip.className = 'base-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  document.body.append(tooltip)

  let activeTrigger = null

  function prepareTrigger(trigger) {
    if (!trigger?.matches?.(triggerSelector)) return ''
    const title = trigger.getAttribute('title') || ''
    const rawLabel = trigger.getAttribute('aria-label') || title
    const label = rawLabel.replace(/^(\s*)(\p{Ll})/u, (_, spacing, letter) => `${spacing}${letter.toLocaleUpperCase('ru-RU')}`)
    if (label && trigger.getAttribute('aria-label') !== label) trigger.setAttribute('aria-label', label)
    if (title) trigger.removeAttribute('title')
    return label
  }

  function positionTooltip() {
    if (!activeTrigger || tooltip.hidden) return
    const triggerRect = activeTrigger.getBoundingClientRect()
    const tooltipRect = tooltip.getBoundingClientRect()
    const gap = 8
    const edge = 8
    const centerX = triggerRect.left + triggerRect.width / 2
    const centerY = triggerRect.top + triggerRect.height / 2
    const candidates = [
      { placement: 'top', left: centerX - tooltipRect.width / 2, top: triggerRect.top - tooltipRect.height - gap },
      { placement: 'bottom', left: centerX - tooltipRect.width / 2, top: triggerRect.bottom + gap },
      { placement: 'right', left: triggerRect.right + gap, top: centerY - tooltipRect.height / 2 },
      { placement: 'left', left: triggerRect.left - tooltipRect.width - gap, top: centerY - tooltipRect.height / 2 },
    ]
    const overflow = candidate => (
      Math.max(0, edge - candidate.left)
      + Math.max(0, candidate.left + tooltipRect.width + edge - window.innerWidth)
      + Math.max(0, edge - candidate.top)
      + Math.max(0, candidate.top + tooltipRect.height + edge - window.innerHeight)
    )
    const selected = candidates.find(candidate => overflow(candidate) === 0)
      || candidates.reduce((best, candidate) => overflow(candidate) < overflow(best) ? candidate : best)
    const maximumLeft = Math.max(edge, window.innerWidth - tooltipRect.width - edge)
    const maximumTop = Math.max(edge, window.innerHeight - tooltipRect.height - edge)
    const left = Math.max(edge, Math.min(maximumLeft, selected.left))
    const top = Math.max(edge, Math.min(maximumTop, selected.top))
    const arrowX = Math.max(10, Math.min(tooltipRect.width - 10, centerX - left))
    const arrowY = Math.max(10, Math.min(tooltipRect.height - 10, centerY - top))
    tooltip.dataset.placement = selected.placement
    tooltip.style.left = `${Math.round(left)}px`
    tooltip.style.top = `${Math.round(top)}px`
    tooltip.style.setProperty('--tooltip-arrow-x', `${Math.round(arrowX)}px`)
    tooltip.style.setProperty('--tooltip-arrow-y', `${Math.round(arrowY)}px`)
  }

  function showTooltip(trigger) {
    const label = prepareTrigger(trigger)
    if (!label) return
    if (activeTrigger && activeTrigger !== trigger) activeTrigger.removeAttribute('aria-describedby')
    activeTrigger = trigger
    tooltip.textContent = label
    tooltip.hidden = false
    trigger.setAttribute('aria-describedby', tooltip.id)
    positionTooltip()
  }

  function hideTooltip(trigger = null) {
    if (trigger && activeTrigger !== trigger) return
    activeTrigger?.removeAttribute('aria-describedby')
    activeTrigger = null
    tooltip.hidden = true
  }

  document.querySelectorAll(triggerSelector).forEach(prepareTrigger)
  document.addEventListener('mouseover', event => {
    const trigger = event.target.closest?.(triggerSelector)
    if (!trigger || trigger.contains(event.relatedTarget)) return
    showTooltip(trigger)
  })
  document.addEventListener('mouseout', event => {
    const trigger = event.target.closest?.(triggerSelector)
    if (!trigger || trigger.contains(event.relatedTarget)) return
    hideTooltip(trigger)
  })
  document.addEventListener('focusin', event => {
    const trigger = event.target.closest?.(triggerSelector)
    if (trigger) showTooltip(trigger)
  })
  document.addEventListener('focusout', event => {
    const trigger = event.target.closest?.(triggerSelector)
    if (trigger) hideTooltip(trigger)
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideTooltip()
  })
  document.addEventListener('scroll', positionTooltip, true)
  window.addEventListener('resize', positionTooltip)
})()
