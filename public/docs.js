(() => {
  const slug = window.location.pathname.replace(/^\/+|\/+$/g, '') === 'user-guide'
    ? 'user-guide'
    : 'documentation'
  const content = document.querySelector('#docs-content')
  const toc = document.querySelector('#docs-toc')

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function safeHref(value) {
    const href = String(value || '').trim()
    if (href === 'TECHNICAL_SPECIFICATION.md' || href.endsWith('/TECHNICAL_SPECIFICATION.md')) return '/documentation'
    if (href === 'USER_GUIDE.md' || href.endsWith('/USER_GUIDE.md')) return '/user-guide'
    if (/^(https?:\/\/|\/|#)/i.test(href)) return href
    return '#'
  }

  function renderInline(value) {
    const code = []
    let html = escapeHtml(value).replace(/`([^`]+)`/g, (_, text) => {
      code.push(`<code>${text}</code>`)
      return `\u0000CODE${code.length - 1}\u0000`
    })
    html = html
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, (_, label, href) => `<a href="${escapeHtml(safeHref(href))}">${label}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>')
    return html.replace(/\u0000CODE(\d+)\u0000/g, (_, index) => code[Number(index)] || '')
  }

  function headingId(text, used) {
    const base = String(text || '')
      .toLocaleLowerCase('ru-RU')
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
    const count = used.get(base) || 0
    used.set(base, count + 1)
    return count ? `${base}-${count + 1}` : base
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n')
    const output = []
    const headings = []
    const usedIds = new Map()
    let paragraph = []
    let listType = null
    let codeFence = null
    let codeLines = []

    const flushParagraph = () => {
      if (!paragraph.length) return
      output.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
    const closeList = () => {
      if (!listType) return
      output.push(`</${listType}>`)
      listType = null
    }
    const openList = type => {
      if (listType === type) return
      closeList()
      output.push(`<${type}>`)
      listType = type
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const fence = line.match(/^```\s*([^ ]*)\s*$/)
      if (fence) {
        flushParagraph()
        closeList()
        if (codeFence !== null) {
          output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
          codeFence = null
          codeLines = []
        } else codeFence = fence[1] || ''
        continue
      }
      if (codeFence !== null) {
        codeLines.push(line)
        continue
      }
      if (!line.trim()) {
        flushParagraph()
        closeList()
        continue
      }

      const nextLine = lines[index + 1] || ''
      if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(nextLine) && nextLine.includes('|')) {
        flushParagraph()
        closeList()
        const rows = []
        const splitRow = row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
        const headers = splitRow(line)
        index += 2
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
          rows.push(splitRow(lines[index]))
          index += 1
        }
        index -= 1
        output.push('<div class="docs-table-wrap"><table><thead><tr>')
        output.push(headers.map(cell => `<th>${renderInline(cell)}</th>`).join(''))
        output.push('</tr></thead><tbody>')
        for (const row of rows) output.push(`<tr>${row.map(cell => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
        output.push('</tbody></table></div>')
        continue
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/)
      if (heading) {
        flushParagraph()
        closeList()
        const level = heading[1].length
        const label = heading[2].replace(/\s+#+\s*$/, '')
        const id = headingId(label, usedIds)
        output.push(`<h${level} id="${id}">${renderInline(label)}</h${level}>`)
        if (level >= 2 && level <= 3) headings.push({ id, level, label: label.replace(/[*_`]/g, '') })
        continue
      }

      const unordered = line.match(/^\s*[-+*]\s+(.+)$/)
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
      if (unordered || ordered) {
        flushParagraph()
        openList(ordered ? 'ol' : 'ul')
        output.push(`<li>${renderInline((ordered || unordered)[1])}</li>`)
        continue
      }

      const quote = line.match(/^>\s?(.*)$/)
      if (quote) {
        flushParagraph()
        closeList()
        output.push(`<blockquote>${renderInline(quote[1])}</blockquote>`)
        continue
      }

      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushParagraph()
        closeList()
        output.push('<hr>')
        continue
      }
      paragraph.push(line.trim())
    }
    flushParagraph()
    closeList()
    if (codeFence !== null) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
    return { html: output.join('\n'), headings }
  }

  async function loadDocumentation() {
    document.querySelectorAll('[data-doc-link]').forEach(link => {
      link.classList.toggle('is-active', link.dataset.docLink === slug)
    })
    try {
      const response = await fetch(`/api/docs/${slug}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить документацию')
      document.title = `${payload.title} · ICAT Translation Studio`
      document.querySelector('#docs-title').textContent = payload.title
      document.querySelector('#docs-description').textContent = payload.description
      document.querySelector('#docs-updated').textContent = `Обновлено: ${new Date(payload.updatedAt).toLocaleString('ru-RU')}`
      const rendered = renderMarkdown(payload.markdown)
      content.innerHTML = rendered.html
      toc.replaceChildren(...rendered.headings.map(heading => {
        const link = document.createElement('a')
        link.href = `#${heading.id}`
        link.dataset.level = String(heading.level)
        link.textContent = heading.label
        return link
      }))
    } catch (error) {
      content.innerHTML = `<p class="docs-error">${escapeHtml(error.message)}</p>`
      toc.replaceChildren()
    }
  }

  loadDocumentation()
})()
