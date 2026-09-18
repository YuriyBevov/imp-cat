const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM, VirtualConsole } = require('jsdom')

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'public/studio.html'), 'utf8')
const client = fs.readFileSync(path.join(root, 'public/studio.js'), 'utf8')
const layoutModelClient = fs.readFileSync(path.join(root, 'public/layout-model.js'), 'utf8')
const translationUnits = fs.readFileSync(path.join(root, 'public/translation-units.js'), 'utf8')
const styles = fs.readFileSync(path.join(root, 'public/studio.css'), 'utf8')
const uiKit = fs.readFileSync(path.join(root, 'public/ui-kit.css'), 'utf8')
const tooltipClient = fs.readFileSync(path.join(root, 'public/tooltip.js'), 'utf8')
const server = fs.readFileSync(path.join(root, 'server.cjs'), 'utf8')
const userGuide = fs.readFileSync(path.join(root, 'USER_GUIDE.md'), 'utf8')
const technicalSpecification = fs.readFileSync(path.join(root, 'TECHNICAL_SPECIFICATION.md'), 'utf8')
const docsHtml = fs.readFileSync(path.join(root, 'public/docs.html'), 'utf8')
const onlyofficeHtml = fs.readFileSync(path.join(root, 'public/onlyoffice.html'), 'utf8')
const docsClient = fs.readFileSync(path.join(root, 'public/docs.js'), 'utf8')
const uiComponentsHtml = fs.readFileSync(path.join(root, 'public/ui-components.html'), 'utf8')
const uiComponentsClient = fs.readFileSync(path.join(root, 'public/ui-components.js'), 'utf8')
const iconSprite = fs.readFileSync(path.join(root, 'public/icons.svg'), 'utf8')
const legacyPrototypeHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
const agentsGuide = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8')

test('studio exposes the complete source-to-export workflow', () => {
  for (const id of [
    'file-input', 'page-thumbnails', 'document-canvas', 'source-preview-scroll', 'source-preview-canvas', 'source-zoom-100', 'source-preview-open',
    'source-preview-lightbox', 'source-preview-lightbox-title', 'source-preview-lightbox-close', 'source-preview-lightbox-viewport', 'source-preview-lightbox-canvas',
    'source-preview-lightbox-previous', 'source-preview-lightbox-next', 'source-preview-lightbox-zoom-out', 'source-preview-lightbox-zoom-in',
    'source-preview-lightbox-zoom-output', 'source-preview-lightbox-zoom-100', 'source-preview-lightbox-fit',
    'appbar-menu', 'appbar-menu-button', 'appbar-actions-menu',
    'source-text', 'translation-text', 'object-type', 'segment-note', 'reanalyze-button', 'translate-button', 'loading-hint',
    'reanalyze-confirm-modal', 'reanalyze-confirm-close', 'reanalyze-confirm-cancel', 'reanalyze-confirm-submit',
    'confirmation-modal', 'confirmation-title', 'confirmation-description', 'confirmation-close', 'confirmation-cancel', 'confirmation-submit',
    'translation-approval-modal', 'translation-approval-title', 'translation-approval-content', 'translation-approval-status',
    'translation-approval-close', 'translation-approval-cancel', 'translation-approval-continue', 'translation-approval-retranslate-all', 'translation-approval-submit',
    'translation-global-instruction',
    'instruction-preset-select', 'instruction-preset-apply', 'instruction-preset-save', 'instruction-preset-delete',
    'instruction-preset-edit', 'instruction-preset-editor', 'instruction-preset-text',
    'instruction-preset-edit-cancel', 'instruction-preset-edit-save',
    'auto-layout-button', 'qa-button', 'qa-refresh', 'qa-select-all', 'export-docx-button', 'export-pdf-button',
    'memory-search-button', 'glossary-select', 'glossary-add-button', 'knowledge-base-status', 'knowledge-base-open-button', 'knowledge-base-open-context-button',
    'knowledge-base-modal', 'knowledge-base-query', 'knowledge-base-glossary-filter', 'knowledge-base-list',
    'knowledge-base-new-button', 'knowledge-base-entry-form', 'knowledge-base-entry-source', 'knowledge-base-entry-translation',
    'knowledge-base-entry-glossary', 'knowledge-base-previous', 'knowledge-base-next', 'knowledge-base-mode',
    'instruction-library-button', 'instruction-library-modal', 'instruction-library-close', 'instruction-library-query',
    'instruction-library-new', 'instruction-library-list', 'instruction-library-form', 'instruction-library-id',
    'instruction-library-text', 'instruction-library-form-cancel',
    'knowledge-suggestion-popover', 'knowledge-suggestion-list', 'knowledge-suggestion-close', 'approve-button', 'merge-button', 'split-button',
    'table-cell-fields', 'table-id', 'table-row', 'table-column', 'table-row-span', 'table-column-span',
    'align-left-button',
    'fit-content-width-button', 'fit-content-height-button', 'fit-content-both-button',
    'stretch-work-area-width-button', 'stretch-work-area-height-button', 'fit-min-content-width-button',
    'format-all-segments', 'typography-select-all',
    'toolbar-font-family', 'toolbar-text-color', 'toolbar-font-size-decrease', 'toolbar-font-size-value', 'toolbar-font-size-increase',
    'line-height-decrease', 'line-height', 'line-height-increase', 'zoom-100',
    'source-panel-toggle', 'workflow-stagebar', 'workflow-previous', 'workflow-approve',
    'inspector-panel', 'inspector-panel-body',
    'document-tabs', 'document-library-button', 'document-library-modal', 'document-library-list',
    'ai-settings-button', 'ai-provider-select', 'aitunnel-api-key', 'retry-job-button', 'cancel-job-button', 'loading-progress-details',
    'aitunnel-model', 'aitunnel-persist-key', 'test-ai-connection',
    'administration-button', 'administration-modal', 'administration-close', 'administration-cancel',
    'administration-reset', 'administration-save', 'chat-agent-system-prompt', 'administration-status',
  ]) assert.match(html, new RegExp(`id="${id}"`))
  const studioDocument = new JSDOM(html).window.document
  assert.equal(studioDocument.querySelector('#knowledge-suggestion-title').textContent, 'Найденные записи в БЗ')
  const knowledgeToolbarButtons = [...studioDocument.querySelectorAll('.knowledge-base-toolbar button')]
  assert.equal(knowledgeToolbarButtons.length, 2)
  assert.ok(knowledgeToolbarButtons.every(button => button.matches('.icon-button.icon-button--field') && !button.textContent.trim() && button.getAttribute('aria-label')))
  assert.deepEqual(knowledgeToolbarButtons.map(button => button.getAttribute('aria-label')), ['Найти в Базе знаний', 'Создать запись'])
  const knowledgeEntryForm = studioDocument.querySelector('#knowledge-base-entry-form')
  assert.equal(knowledgeEntryForm.querySelector('#knowledge-base-entry-source-language').type, 'hidden')
  assert.equal(knowledgeEntryForm.querySelector('#knowledge-base-entry-target-language').type, 'hidden')
  assert.doesNotMatch(knowledgeEntryForm.textContent, /Язык оригинала|Язык перевода/)
  const knowledgeEntryActions = [...knowledgeEntryForm.querySelectorAll('.knowledge-base-entry-form__meta > button')]
  assert.ok(knowledgeEntryActions.every(button => button.matches('.icon-button.icon-button--field') && !button.textContent.trim() && button.getAttribute('aria-label')))
  assert.deepEqual(knowledgeEntryActions.map(button => button.getAttribute('aria-label')), ['Отменить', 'Сохранить запись'])
  const knowledgeEntryGlossary = knowledgeEntryActions[0].previousElementSibling
  assert.equal(knowledgeEntryGlossary.id, 'knowledge-base-entry-glossary')
  assert.equal(knowledgeEntryGlossary.getAttribute('aria-label'), 'Глоссарий')
  assert.equal(knowledgeEntryGlossary.closest('label'), null)
  assert.match(styles, /\.knowledge-base-entry-form__meta\s*\{[^}]*grid-template-columns:\s*minmax\(180px, 1fr\) 38px 38px/)
  assert.match(styles, /\.knowledge-base-entry-form__meta > select\s*\{[^}]*height:\s*38px;[^}]*min-height:\s*38px/)
  assert.match(styles, /\.knowledge-base-dialog\s*\{[^}]*height:\s*min\(760px, calc\(100vh - 40px\)\)[^}]*overflow:\s*hidden/)
  assert.match(styles, /\.knowledge-base-toolbar input, \.knowledge-base-toolbar select, \.knowledge-base-toolbar \.base-select\s*\{[^}]*height:\s*38px[^}]*min-height:\s*38px/)
  assert.match(uiKit, /\.icon-button--field\s*\{[^}]*width:\s*38px;[^}]*height:\s*38px/)
  assert.match(iconSprite, /<symbol id="icon-search"/)
  assert.match(uiComponentsHtml, /icon-search/)
  assert.equal(studioDocument.querySelector('#view-layout-button'), null)
  assert.equal(studioDocument.querySelector('#view-segments-button'), null)
  assert.equal(studioDocument.querySelector('#translation-units-card'), null)
  const languageCard = studioDocument.querySelector('.language-card')
  const reanalyzeButton = studioDocument.querySelector('#reanalyze-button')
  assert.equal(languageCard.tagName, 'DIV')
  assert.ok(languageCard.parentElement.classList.contains('global-translation-tools'))
  assert.equal(reanalyzeButton.textContent, 'Пересегментация макета')
  assert.ok(reanalyzeButton.classList.contains('button--danger-filled'))
  assert.ok(reanalyzeButton.closest('#final-testing-tools'))
  assert.equal(studioDocument.querySelector('#layout-review-button'), null)
  assert.equal(studioDocument.querySelector('#layout-review-status'), null)
  assert.equal(studioDocument.querySelector('#qa-button').textContent, 'Тестирование перед выгрузкой')
  const translationInstructionCard = studioDocument.querySelector('.translation-instruction-card')
  const agentKnowledgeMode = studioDocument.querySelector('.agent-knowledge-mode')
  assert.equal(languageCard.nextElementSibling, agentKnowledgeMode)
  assert.equal(agentKnowledgeMode.nextElementSibling, translationInstructionCard)
  assert.equal(agentKnowledgeMode.querySelector('#knowledge-base-mode').closest('.memory-card__mode').parentElement, agentKnowledgeMode)
  assert.equal(studioDocument.querySelector('.memory-card #knowledge-base-mode'), null)
  const reanalyzeModal = studioDocument.querySelector('#reanalyze-confirm-modal')
  assert.equal(reanalyzeModal.hidden, true)
  assert.equal(reanalyzeModal.querySelector('[role="dialog"]').getAttribute('aria-describedby'), 'reanalyze-confirm-description')
  assert.match(reanalyzeModal.textContent, /Вся текущая работа с переводами сегментов будет потеряна/)
  assert.match(reanalyzeModal.textContent, /Резервная версия на этом этапе не создаётся/)
  assert.equal(studioDocument.querySelector('.translation-batch-controls'), null)
  assert.equal(studioDocument.querySelector('.translation-instruction-card__actions'), null)
  assert.equal(translationInstructionCard.nextElementSibling.querySelector('button').id, 'translate-button')
  assert.equal(studioDocument.querySelector('#translate-button').textContent, 'Перевести документ')
  assert.ok(studioDocument.querySelector('#translate-button').classList.contains('button--primary'))
  const instructionIconButtons = [...translationInstructionCard.querySelectorAll('button')]
  assert.equal(instructionIconButtons.length, 6)
  assert.ok(instructionIconButtons.every(button => button.classList.contains('icon-button') && !button.textContent.trim() && button.getAttribute('aria-label')))
  assert.deepEqual(
    [...studioDocument.querySelectorAll('.instruction-preset-picker > button')].map(button => button.id),
    ['instruction-preset-apply', 'instruction-preset-save', 'instruction-preset-edit', 'instruction-preset-delete'],
  )
  assert.deepEqual(
    [...studioDocument.querySelectorAll('.instruction-preset-picker > button')].map(button => button.getAttribute('aria-label')),
    ['Использовать инструкцию', 'Сохранить инструкцию в список инструкций', 'Редактировать инструкцию', 'Удалить инструкцию из списка инструкций'],
  )
  assert.equal(translationInstructionCard.querySelector(':scope > textarea').id, 'translation-global-instruction')
  assert.equal(studioDocument.querySelector('label[for="translation-global-instruction"]').textContent, 'Инструкция для AI')
  assert.equal(studioDocument.querySelector('#instruction-preset-select').getAttribute('aria-label'), 'Сохраненные инструкции')
  assert.equal(studioDocument.querySelector('#instruction-preset-select option').textContent, 'Сохраненные инструкции…')
  assert.equal(studioDocument.querySelector('#instruction-library-title').textContent, 'Сохраненные AI-инструкции')
  assert.doesNotMatch(html, /Готовые инструкции/)
  assert.doesNotMatch(client, /Готов(?:ая|ые|ых|ую) инструкц/)
  assert.equal(studioDocument.querySelector('.instruction-preset-actions'), null)
  assert.match(styles, /\.instruction-preset-picker\s*\{[^}]*margin-top:\s*4px/)
  assert.match(styles, /#translation-global-instruction\s*\{[^}]*min-height:\s*96px/)
  assert.doesNotMatch(html, /id="(?:alignment-scope|flex-container)"/)
  assert.doesNotMatch(html, /id="flex-apply-button"/)
  assert.doesNotMatch(html, /id="selection-count"/)
  assert.doesNotMatch(html, /id="layout-review-cancel-button"/)
  assert.equal(studioDocument.querySelector('#analyze-button'), null)
  assert.doesNotMatch(html, /id="layout-review-button"/)
  assert.equal(studioDocument.querySelector('.selection-heading'), null)
  assert.equal(studioDocument.querySelector('#selection-title'), null)
  const segmentContentFields = studioDocument.querySelector('.segment-content-fields')
  assert.deepEqual(
    [...segmentContentFields.children].map(label => label.childNodes[0].textContent.trim()),
    ['Распознанный исходник', 'Перевод / обозначение'],
  )
  assert.match(styles, /\.segment-content-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.segment-content-fields textarea\s*\{[^}]*min-height:\s*160px/)
  const segmentPropertiesRow = studioDocument.querySelector('.segment-properties-row')
  assert.equal(segmentPropertiesRow.querySelector('.segment-type-field').textContent.trim().startsWith('Тип содержимого'), true)
  assert.equal(segmentPropertiesRow.querySelector('.confidence-row').textContent.trim().startsWith('Уверенность распознавания'), true)
  assert.equal(segmentPropertiesRow.querySelector('#confidence-value').textContent, '—')
  assert.match(styles, /\.segment-properties-row\s*\{[^}]*grid-template-columns:\s*minmax\(0, 180px\) minmax\(0, 1fr\)/)
  assert.match(styles, /\.segment-type-field\s*\{[^}]*max-width:\s*180px/)
  assert.match(styles, /\.segment-properties-row \.confidence-row\s*\{[^}]*background:\s*rgba\(49,94,231,\.08\)/)
  assert.match(styles, /\.confidence-row\s*\{[^}]*flex-direction:\s*row;[^}]*justify-content:\s*space-between/)
  assert.match(styles, /\.confidence-row span\s*\{[^}]*max-width:\s*110px;[^}]*font-size:\s*10px;[^}]*font-weight:\s*700/)
  assert.match(styles, /\.confidence-row strong\s*\{[^}]*color:\s*var\(--blue\)/)
  assert.equal(segmentContentFields.nextElementSibling.id, 'segment-note')
  assert.ok(segmentContentFields.nextElementSibling.matches('.note.note--warning.note--compact'))
  assert.equal(studioDocument.querySelectorAll('.flex-layout select, .flex-layout input').length, 0)
  assert.equal(studioDocument.querySelectorAll('[data-flex-axis="row"][data-flex-layout]').length, 6)
  assert.equal(studioDocument.querySelectorAll('[data-flex-axis="column"][data-flex-layout]').length, 6)
  assert.equal(studioDocument.querySelector('.flex-layout__disabled-actions'), null)
  assert.ok(studioDocument.querySelector('.fit-size-actions #merge-button.icon-button use[href="/icons.svg#icon-merge"]'))
  assert.ok(studioDocument.querySelector('.segment-actions-card .layout-card__heading strong')?.textContent.includes('Сегменты'))
  assert.ok(studioDocument.querySelector('.fit-size-actions #auto-layout-button.icon-button use[href="/icons.svg#icon-resolve-overlap"]'))
  assert.ok(studioDocument.querySelector('.fit-size-actions #reset-position-button.icon-button use[href="/icons.svg#icon-reset-position"]'))
  assert.ok(studioDocument.querySelector('.fit-size-actions #stretch-work-area-width-button.icon-button use[href="/icons.svg#icon-stretch-area-width"]'))
  assert.ok(studioDocument.querySelector('.fit-size-actions #stretch-work-area-height-button.icon-button use[href="/icons.svg#icon-stretch-area-height"]'))
  assert.ok(studioDocument.querySelector('.fit-size-actions #fit-min-content-width-button.icon-button use[href="/icons.svg#icon-fit-min-width"]'))
  assert.equal(studioDocument.querySelector('.object-actions #reset-position-button'), null)
  assert.equal(studioDocument.querySelector('.agent-actions #auto-layout-button'), null)
  assert.ok(studioDocument.querySelector('.segment-actions-card #merge-button'))
  assert.equal(studioDocument.querySelector('.inspector-scope--segments #merge-button'), null)
  for (const label of [
    'Выровнять друг относительно друга, X',
    'Выровнять друг относительно друга, Y',
    'Выравнивание относительно док-та, X',
    'Выравнивание относительно док-та, Y',
  ]) {
    const group = studioDocument.querySelector(`[aria-label="${label}"]`)
    assert.ok(group)
    assert.equal(group.previousElementSibling?.textContent.trim(), label)
  }
  assert.match(server, /app\.use\('\/api\/studio'/)
  assert.match(server, /studio\.html/)
  assert.match(client, /\/api\/studio\/documents/)
  assert.match(client, /\/knowledge-base\/search/)
  assert.match(client, /\/knowledge-base\/entries/)
  assert.match(client, /function openKnowledgeBase/)
  assert.match(client, /function saveKnowledgeBaseEntry/)
  assert.match(client, /function deleteKnowledgeBaseEntry/)
  assert.match(client, /function displayedKnowledgeMatches/)
  assert.match(client, /function objectGridCoordinates/)
  assert.match(client, /function snapObjectToGridCells/)
  assert.match(client, /translate\/apply-memory/)
  assert.match(client, /translate\/revise/)
  assert.match(client, /function reviseTranslations/)
  assert.match(client, /function saveInstructionPreset/)
  assert.match(client, /\/api\/studio\/translation-instructions/)
  assert.match(client, /event\.ctrlKey \|\| event\.metaKey/)
  assert.match(client, /beginMarquee/)
  assert.match(client, /beginDrag/)
  assert.match(client, /moveSelectionToPage/)
  assert.match(client, /insertBlankPage/)
  assert.match(client, /removeEmptyPage/)
  assert.match(client, /pageSurfaceAtPoint/)
  assert.match(client, /function undo/)
  assert.match(client, /function redo/)
  assert.match(client, /async function saveScene[\s\S]*?synchronizeReadingOrder\(scene\)/)
  assert.match(client, /queueWheelZoom/)
  assert.match(client, /snapObjectGroups/)
  assert.match(client, /alignSelection/)
  assert.match(client, /alignToDocument/)
  assert.match(client, /applyFlexLayout/)
  assert.match(client, /fitSelectionToContent/)
  assert.match(client, /stretchSelectionToWorkArea/)
  assert.doesNotMatch(client, /setDocumentView/)
  assert.match(client, /toggleSourcePanel/)
  assert.match(client, /agent\/reanalyze/)
  assert.match(client, /function openReanalyzeConfirmation/)
  assert.doesNotMatch(client, /window\.confirm\('Повторный анализ/)
  assert.doesNotMatch(client, /(?:window\.)?confirm\s*\(/)
  assert.match(client, /\/api\/studio\/jobs/)
  assert.doesNotMatch(client, /agent\/layout-review/)
  assert.match(client, /loadPendingJobs/)
  assert.match(client, /cancelActiveJob/)
  assert.match(client, /rebuildClientTables/)
  assert.match(client, /encryptApiKey/)
  assert.match(client, /\/api\/studio\/provider\/models/)
  assert.match(client, /\/api\/studio\/provider\/test/)
  assert.match(client, /\/api\/studio\/documents\?scope=all/)
  assert.match(client, /setDocumentArchived/)
  assert.match(client, /deleteLibraryDocument/)
  assert.match(client, /segment-translation-workspace/)
  assert.match(styles, /\.ai-chat__message--assistant/)
  assert.match(styles, /\.ai-chat__message--user/)
  assert.doesNotMatch(html, />Flex-раскладка</)
  assert.match(client, /exportDocument\('docx'\)/)
  assert.match(client, /exportDocument\('pdf'\)/)
  assert.match(html, /href="\/documentation"/)
  assert.match(html, /href="\/user-guide"/)
  assert.match(html, /href="\/ui-components"/)
  assert.doesNotMatch(html, /class="workflow"/)
  assert.doesNotMatch(html, /class="panel-heading"/)
  assert.doesNotMatch(html, /class="source-preview-toolbar"/)
  assert.doesNotMatch(html, /class="source-preview-hint"/)
  assert.doesNotMatch(html, /id="grid-snap"/)
  assert.doesNotMatch(html, /workbench-toolbar__hint/)
  assert.match(html, /id="source-zoom-fit"[\s\S]*?<svg/)
  assert.match(html, /id="zoom-fit"[^>]*class="icon-button"[\s\S]*?icon-fit-width/)
  assert.doesNotMatch(html, /id="grid-size"/)
  assert.doesNotMatch(html, /id="view-(?:layout|segments)-button"/)
  assert.match(html, /class="toolbar-group workbench-toolbar__layout-controls"[\s\S]*?id="zoom-out"[\s\S]*?id="zoom-fit"[\s\S]*?id="zoom-100"/)
  assert.match(html, /id="studio-view"[^>]*class="studio is-source-collapsed"/)
  assert.match(html, /id="source-panel-toggle"[^>]*class="icon-button icon-button--compact"[^>]*aria-label="Показать оригинал"[^>]*aria-expanded="false"[\s\S]*?icon-layout/)
  assert.match(html, /id="zoom-output">100%<\/output>/)
  assert.match(html, /class="workbench-toolbar__source-toggle"[\s\S]*?id="source-panel-toggle"/)
  assert.doesNotMatch(html, /class="inspector-panel__header"/)
  assert.match(html, /id="toolbar-font-family"[\s\S]*?<option value="Arial" selected>[\s\S]*?<option value="Times New Roman">/)
  assert.match(html, /id="toolbar-text-color"[^>]*type="color"/)
  assert.doesNotMatch(html, /id="add-document-tab"/)
  assert.match(html, /src="\/custom-select\.js"/)
  assert.doesNotMatch(html, /id="toolbar-font-size"/)
  assert.match(html, /id="toolbar-font-size-value"[^>]*type="number"[^>]*min="10"[^>]*max="80"[^>]*step="1"/)
  assert.match(html, /id="toolbar-font-size-value"[^>]*placeholder="≠"[^>]*aria-label="Размер шрифта, px"/)
  assert.match(html, /Размер шрифта, px[\s\S]*?class="number-stepper__field"[\s\S]*?id="toolbar-font-size-value"/)
  assert.match(uiKit, /\.number-stepper__field\.is-mixed::after\s*\{[^}]*content:\s*"≠"[^}]*place-items:\s*center[^}]*color:\s*#98a2b3[^}]*font:\s*400 12px\/1 Arial/)
  assert.doesNotMatch(html, /number-stepper__unit/)
  assert.doesNotMatch(uiComponentsHtml, /number-stepper__unit/)
  assert.match(html, /class="layout-card typography-card inspector-scope--layout"[\s\S]*?<strong>Типографика<\/strong>/)
  assert.doesNotMatch(html, /оформление выбранного текста/)
  assert.match(html, /class="typography-card__settings"[\s\S]*?id="toolbar-font-family"[\s\S]*?id="toolbar-font-size-value"[\s\S]*?id="line-height"/)
  assert.match(styles, /\.typography-card__settings\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(120px, 1fr\) auto auto/)
  assert.match(html, /Начертание, выравнивание и цвет[\s\S]*?class="typography-card__buttons"[\s\S]*?id="toolbar-text-color"/)
  assert.ok(html.indexOf('id="typography-select-all"') < html.indexOf('id="format-all-segments"'))
  assert.match(html, /Высота строки[\s\S]*?class="number-stepper"[\s\S]*?id="line-height-decrease"[\s\S]*?<input id="line-height"[^>]*min="0\.8"[^>]*max="3"[^>]*step="0\.05"[\s\S]*?id="line-height-increase"/)
  assert.match(html, /id="font-size-control-label"[\s\S]*?class="number-stepper"[^>]*aria-labelledby="font-size-control-label"/)
  assert.match(html, /id="line-height-control-label"[\s\S]*?class="number-stepper"[^>]*aria-labelledby="line-height-control-label"/)
  assert.doesNotMatch(html, /<label>\s*<span id="(?:font-size|line-height)-control-label"/)
  assert.match(styles, /\.typography-card__settings \.layout-card__label\s*\{[^}]*white-space:\s*nowrap/)
  assert.doesNotMatch(html, /class="toolbar-group formatting"/)
  assert.doesNotMatch(html, /id="font-size"/)
  assert.doesNotMatch(html, /id="object-(?:x|y|width|height)"/)
  assert.match(html, /id="fit-content-width-button"[^>]*class="icon-button icon-button--compact"[^>]*[\s\S]*?icon-fit-width/)
  assert.match(html, /id="fit-content-height-button"[^>]*class="icon-button icon-button--compact"[^>]*[\s\S]*?icon-fit-height/)
  assert.match(html, /id="fit-content-both-button"[^>]*class="icon-button icon-button--compact"[^>]*[\s\S]*?icon-fit-both/)
  assert.match(html, /id="stretch-work-area-width-button"[^>]*class="icon-button icon-button--compact"[^>]*[\s\S]*?icon-stretch-area-width/)
  assert.match(html, /id="stretch-work-area-height-button"[^>]*class="icon-button icon-button--compact"[^>]*[\s\S]*?icon-stretch-area-height/)
  assert.match(html, /id="fit-min-content-width-button"[^>]*class="icon-button icon-button--compact"[^>]*[\s\S]*?icon-fit-min-width/)
  assert.match(html, /<strong>Расположение сегментов внутри рабочей области<\/strong>/)
  assert.doesNotMatch(html, /для выбранных на одной странице/)
  assert.match(styles, /\.source-preview-controls\s*\{[^}]*position:\s*absolute[^}]*right:\s*12px[^}]*bottom:\s*12px/)
  assert.match(styles, /--source-open-width:\s*min\(21vw, 330px\)/)
  assert.match(styles, /\.source-preview-lightbox\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*6000/)
  assert.match(styles, /\.workbench-toolbar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*60px minmax\(0, 1fr\)/)
  assert.match(styles, /\.workbench-toolbar__source-toggle\s*\{[^}]*grid-column:\s*1[^}]*width:\s*60px/)
  assert.match(styles, /grid-template-columns:\s*60px/)
  assert.match(styles, /grid-template-areas:\s*"toolbar toolbar toolbar toolbar" "pages source canvas inspector"/)
  assert.match(styles, /\.studio\s*\{[^}]*transition:\s*grid-template-columns \.28s ease/)
  assert.match(styles, /\.inspector-panel\s*\{[^}]*grid-area:\s*inspector[^}]*position:\s*relative[^}]*height:\s*100%/)
  assert.doesNotMatch(styles, /is-inspector-collapsed|inspector-panel-toggle/)
  assert.equal(studioDocument.querySelector('#qa-panel')?.parentElement?.id, 'studio-view')
  assert.equal(studioDocument.querySelector('#qa-panel')?.getAttribute('aria-hidden'), 'true')
  assert.ok(studioDocument.querySelector('#qa-refresh.icon-button.icon-button--large use[href="/icons.svg#icon-refresh"]'))
  assert.equal(studioDocument.querySelector('#qa-select-all + .base-checkbox__control + .base-checkbox__label').textContent, 'Выбрать все')
  assert.equal(studioDocument.querySelector('#qa-segment-status'), null)
  assert.match(styles, /\.qa-overview\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/)
  assert.match(styles, /\.qa-summary\s*\{[^}]*height:\s*44px/)
  assert.match(uiKit, /\.icon-button--large\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/)
  assert.match(styles, /\.qa-panel\s*\{[^}]*position:\s*absolute[^}]*top:\s*44px[^}]*right:\s*0[^}]*bottom:\s*0[^}]*width:\s*var\(--inspector-open-width\)[^}]*transform:\s*translateX\(100%\)[^}]*transition:\s*transform \.28s ease, opacity \.28s ease/)
  assert.match(styles, /\.qa-panel\.is-open\s*\{[^}]*opacity:\s*1[^}]*transform:\s*translateX\(0\)[^}]*pointer-events:\s*auto/)
  assert.match(client, /function setQaPanelOpen\(open, options = \{\}\)/)
  assert.match(styles, /\.studio\.is-source-collapsed \.source-preview-panel\s*\{[^}]*transform:\s*translateX\(-100%\)/)
  assert.match(styles, /\.pages-panel\s*\{[^}]*position:\s*relative[^}]*z-index:\s*10/)
  assert.match(styles, /\.source-preview-panel\s*\{[^}]*z-index:\s*8/)
  assert.equal(studioDocument.querySelector('#inspector-panel-toggle'), null)
  assert.equal(studioDocument.querySelector('.inspector-panel__navigation'), null)
  assert.equal(studioDocument.querySelector('#inspector-panel-body').getAttribute('aria-hidden'), 'false')
  assert.ok(html.indexOf('id="page-thumbnails"') < html.indexOf('id="source-panel-toggle"'))
  assert.match(styles, /\.workbench-toolbar\s*\{[^}]*grid-area:\s*toolbar/)
  assert.match(styles, /\.workbench-toolbar button,[\s\S]*?\.workbench-toolbar \.base-select\s*\{[^}]*height:\s*28px[^}]*min-height:\s*28px/)
  assert.match(styles, /\.workbench-toolbar \.icon-button\s*\{[^}]*width:\s*28px[^}]*min-width:\s*28px/)
  assert.match(styles, /\.workbench-toolbar__inner\s*\{[^}]*grid-column:\s*2[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto[^}]*padding:\s*5px var\(--app-gutter, 12px\)/)
  assert.deepEqual(
    [...studioDocument.querySelectorAll('[data-workflow-step]')].map(step => step.textContent.replace(/\s+/g, '').trim()),
    ['1Документ', '2Сегменты', '3Макет', '4Выгрузка'],
  )
  assert.match(styles, /\.workflow-stagebar__steps\s*\{[^}]*grid-template-columns:\s*repeat\(4,/)
  assert.match(styles, /\.workbench-toolbar__layout-controls\s*\{[^}]*grid-column:\s*2[^}]*justify-self:\s*end/)
  assert.equal(studioDocument.querySelector('.inspector-controls'), null)
  assert.doesNotMatch(styles, /\.workbench-toolbar__inner > \.toolbar-group:first-child\s*\{/)
  assert.match(styles, /\.appbar\s*\{[^}]*height:\s*44px/)
  assert.match(styles, /\.appbar-menu > \.icon-button\s*\{[^}]*width:\s*30px[^}]*height:\s*30px/)
  assert.match(styles, /body\.has-document-tabs[^{]*\{[^}]*height:\s*calc\(100vh - 72px\)/)
  assert.match(styles, /\.document-tabs__inner\s*\{[^}]*justify-content:\s*flex-end/)
  assert.match(styles, /\.document-tabs__list\s*\{[^}]*width:\s*max-content[^}]*margin-left:\s*auto/)
  assert.doesNotMatch(styles, /\.grid-controls/)
  assert.match(uiKit, /:root\s*\{[^}]*--app-gutter:\s*12px/)
  assert.match(uiKit, /\.app-container\s*\{[^}]*padding-inline:\s*var\(--app-gutter, 12px\)/)
  assert.match(html, /class="app-container appbar__inner"/)
  assert.match(html, /class="app-container document-tabs__inner"/)
  assert.match(html, /class="app-container workbench-toolbar__inner"/)
})

test('app bar actions open from a burger and close outside or with Escape', async () => {
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async () => ({ ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) })
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))

  const trigger = dom.window.document.querySelector('#appbar-menu-button')
  const menu = dom.window.document.querySelector('#appbar-actions-menu')
  assert.equal(menu.hidden, true)
  trigger.click()
  assert.equal(menu.hidden, false)
  assert.equal(trigger.getAttribute('aria-expanded'), 'true')
  dom.window.document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
  assert.equal(menu.hidden, true)
  trigger.click()
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(menu.hidden, true)
  dom.window.close()
})

test('final QA opens as an animated overlay and hides only after the closing transition', async () => {
  const id = 'd'.repeat(32)
  const metadata = { id, revision: 1 }
  const scene = {
    title: 'QA fixture', sourceLanguage: 'en', targetLanguage: 'ru', workflowStage: 3, workflowVersion: 2,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'qa-segment', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Source', translation: 'Перевод', confidence: .98,
      x: 40, y: 60, width: 200, height: 32, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 60, width: 200, height: 32 },
    }],
  }
  const initialReport = {
    counts: { errors: 0, warnings: 1, translated: 1, objects: 1 },
    warnings: [{ severity: 'warning', code: 'outside-content', objectIds: ['qa-segment'], message: 'Объект находится в поле страницы вне рабочей области' }],
  }
  const correctedReport = { counts: { errors: 0, warnings: 0, translated: 1, objects: 1 }, warnings: [] }
  let qaRequestCount = 0
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.Element.prototype.scrollIntoView = function scrollIntoView() {}
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/status') && !value.includes('knowledge-base')) return { ok: true, json: async () => ({ translationProviderConfigured: false }) }
    if (value.endsWith('/translation-instructions')) return { ok: true, json: async () => ({ presets: [] }) }
    if (value.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    if (value.endsWith(`/documents/${id}`)) return { ok: true, json: async () => ({ metadata, scene }) }
    if (value.endsWith(`/documents/${id}/scene`)) return { ok: true, json: async () => ({ metadata }) }
    if (value.endsWith(`/documents/${id}/qa`)) {
      qaRequestCount += 1
      return { ok: true, json: async () => qaRequestCount < 3 ? initialReport : correctedReport }
    }
    if (value.endsWith('/knowledge-base/status')) return { ok: true, json: async () => ({ mode: 'memory', connected: true, persistent: false }) }
    if (value.endsWith('/knowledge-base/glossaries')) return { ok: true, json: async () => ({ glossaries: [] }) }
    return { ok: true, json: async () => ({}) }
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  const panel = dom.window.document.querySelector('#qa-panel')
  dom.window.document.querySelector('#qa-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(panel.hidden, false)
  assert.equal(panel.classList.contains('is-open'), true)
  assert.equal(panel.getAttribute('aria-hidden'), 'false')
  assert.equal(dom.window.document.querySelector('#qa-title').textContent, 'Тестирование перед выгрузкой')
  const refresh = dom.window.document.querySelector('#qa-refresh')
  const selectAll = dom.window.document.querySelector('#qa-select-all')
  assert.equal(refresh.disabled, false)
  assert.equal(selectAll.disabled, false)
  assert.equal(selectAll.checked, false)
  assert.equal(selectAll.indeterminate, false)
  let qaItem = dom.window.document.querySelector('.qa-item')
  let accept = qaItem.querySelector('.qa-item__accept .base-checkbox__input')
  assert.equal(qaItem.querySelector('.qa-item__accept .base-checkbox__label'), null)
  assert.equal(accept.getAttribute('aria-label'), 'Принять замечание')
  assert.equal(accept.checked, false)
  selectAll.click()
  assert.equal(qaItem.classList.contains('is-accepted'), true)
  assert.equal(accept.checked, true)
  assert.equal(selectAll.checked, true)
  assert.equal(scene.acceptedQaWarnings.length, 1)
  assert.equal(dom.window.document.querySelectorAll('.qa-summary strong')[1].textContent, '0')

  dom.window.document.querySelector('#qa-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(qaRequestCount, 2)
  qaItem = dom.window.document.querySelector('.qa-item')
  accept = qaItem.querySelector('.qa-item__accept .base-checkbox__input')
  assert.equal(accept.checked, true)
  assert.equal(selectAll.checked, true)
  assert.equal(refresh.disabled, false)
  accept.click()
  assert.equal(qaItem.classList.contains('is-accepted'), false)
  assert.equal(accept.checked, false)
  assert.equal(selectAll.checked, false)
  assert.equal(scene.acceptedQaWarnings.length, 0)
  accept.click()
  assert.equal(accept.checked, true)
  assert.equal(selectAll.checked, true)
  qaItem.querySelector('.qa-item__message').click()
  assert.equal(dom.window.document.querySelector('.qa-item').classList.contains('is-active'), true)
  assert.equal(dom.window.document.querySelector('[data-id="qa-segment"]').classList.contains('is-selected'), true)
  assert.match(styles, /\.studio:is\(\[data-workflow-stage="3"\], \[data-workflow-stage="4"\]\) \.scene-object\.is-selected\s*\{[^}]*outline:\s*3px solid var\(--blue\)[^}]*background:\s*rgba\(49,94,231,\.14\)/)
  assert.equal(dom.window.document.querySelector('#studio-view').matches('.studio[data-workflow-stage="3"]'), true)
  refresh.click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(qaRequestCount, 3)
  assert.equal(refresh.querySelector('use').getAttribute('href'), '/icons.svg#icon-refresh')
  assert.equal(refresh.disabled, false)
  assert.equal(selectAll.disabled, true)
  assert.equal(dom.window.document.querySelector('.qa-list').textContent, 'Критичных проблем не найдено. Можно выгружать документ.')

  dom.window.document.querySelector('#qa-close').click()
  assert.equal(panel.hidden, false)
  assert.equal(panel.classList.contains('is-open'), false)
  assert.equal(panel.getAttribute('aria-hidden'), 'true')
  await new Promise(resolve => setTimeout(resolve, 320))
  assert.equal(panel.hidden, true)

  dom.window.document.querySelector('#qa-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  dom.window.document.querySelector('#workflow-approve').click()
  assert.equal(dom.window.document.querySelector('#studio-view').dataset.workflowStage, '4')
  assert.equal(panel.classList.contains('is-open'), false)
  assert.equal(panel.getAttribute('aria-hidden'), 'true')
  assert.equal(panel.hidden, true)
  dom.window.close()
})

test('user guide documents the complete interface and links from README', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8')
  assert.match(readme, /\[USER_GUIDE\.md\]\(USER_GUIDE\.md\)/)
  for (const label of [
    'Документация', 'Руководство', 'Компоненты', 'Документы', 'База знаний', 'AI-инструкции', 'AI-провайдер', 'Скачать DOCX', 'Скачать PDF',
    'Выбрать документы', 'Отменить обработку', 'Повторить обработку', 'Готовим документ к работе', 'Переводим документ',
    'Пересегментация макета', 'Перевести документ', 'Исправить наложения',
    'Тестирование перед выгрузкой', 'Сохранить инструкцию в список инструкций', 'Редактировать инструкцию',
    'Сохранить изменения',
    'Карточка ручного управления частями сегмента временно удалена',
    'Направление, X', 'Направление, Y', 'Добавить пару в БЗ', 'Объединить выбранные сегменты',
    'Исключить из сборки', 'Проверить подключение', 'Удалить ключ',
  ]) assert.match(userGuide, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.doesNotMatch(html, />Проверить структуру</)
  assert.match(userGuide, /Порядок чтения сегментов автоматически пересчитывается/)
  assert.match(technicalSpecification, /Добавить версионирование и резервное сохранение сцены перед пересегментацией макета/)
})

test('icon buttons use the shared local SVG sprite and accessible labels', () => {
  const dom = new JSDOM(html)
  const symbols = new Set([...iconSprite.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]))
  const iconButtons = [...dom.window.document.querySelectorAll('button.icon-button')]
  const formatButtons = [...dom.window.document.querySelectorAll('button.format-button')]
  assert.ok(iconButtons.length >= 10)
  assert.ok(formatButtons.length >= 6)

  for (const button of [...iconButtons, ...formatButtons]) {
    const use = button.querySelector('svg.ui-icon use')
    assert.ok(use, `Кнопка ${button.id || button.dataset.format || button.outerHTML} должна использовать SVG-иконку`)
    const href = use.getAttribute('href')
    assert.match(href, /^\/icons\.svg#icon-/)
    assert.ok(symbols.has(href.split('#')[1]), `Иконка ${href} должна существовать в спрайте`)
    const label = button.getAttribute('aria-label') || button.getAttribute('title')
    assert.ok(label)
    assert.doesNotMatch(label, /^\p{Ll}/u, `Тултип должен начинаться с заглавной буквы: ${label}`)
  }

  for (const [pageName, markup] of [['studio', html], ['components', uiComponentsHtml], ['legacy', legacyPrototypeHtml]]) {
    const page = new JSDOM(markup)
    for (const button of page.window.document.querySelectorAll('button:has(svg.ui-icon)')) {
      const hasVisibleText = Boolean(button.textContent.trim())
      assert.ok(
        button.classList.contains(hasVisibleText ? 'button' : 'icon-button'),
        `${pageName}: ${hasVisibleText ? 'текстовая кнопка с иконкой' : 'икон-кнопка'} должна использовать базовый класс компонента: ${button.outerHTML}`,
      )
      const href = button.querySelector('use').getAttribute('href')
      assert.ok(symbols.has(href.split('#')[1]), `${pageName}: иконка ${href} должна существовать в спрайте`)
    }
    page.window.close()
  }

  assert.match(client, /const iconMarkup = name =>/)
  assert.match(client, /iconMarkup\('close'\)/)
  assert.match(client, /iconMarkup\('grip-vertical'\)/)
  assert.match(client, /icon-button icon-button--tiny icon-button--filled scene-object__handle/)
  assert.match(uiKit, /\.ui-icon\s*\{[^}]*pointer-events:\s*none/)
  assert.match(uiKit, /\.icon-button--compact\s*\{/)
  assert.match(uiKit, /\.icon-button--ghost\s*\{/)
  assert.match(uiKit, /\.icon-button--inverse\s*\{/)
  assert.match(uiKit, /\.base-tooltip\s*\{/)
  for (const variant of ['muted', 'info', 'success', 'warning', 'danger']) {
    assert.match(uiKit, new RegExp(`\\.note--${variant}\\s*\\{`))
    assert.match(uiComponentsHtml, new RegExp(`class="note note--${variant}`))
  }
  assert.match(uiComponentsHtml, /<code>Note<\/code>/)
  assert.match(uiComponentsHtml, /<code>AiChat<\/code>/)
  assert.match(uiComponentsHtml, /ai-chat__message--assistant/)
  assert.match(uiComponentsHtml, /ai-chat__message--user/)
  assert.equal(dom.window.document.querySelector('.chat-agent-settings-stub'), null)
  assert.equal(dom.window.document.querySelector('#administration-title').textContent, 'Администрирование')
  assert.equal(dom.window.document.querySelector('#segment-batch-ai-hint'), null)
  assert.match(uiComponentsHtml, /<code>TranslationApprovalDialog<\/code>/)
  assert.match(uiKit, /\.note--compact\s*\{/)
  assert.match(uiKit, /\.note--roomy\s*\{/)
  assert.equal(dom.window.document.querySelector('#empty-inspector'), null)
  assert.ok(dom.window.document.querySelector('#segment-note.note.note--warning.note--compact'))
  assert.match(html, /<script src="\/tooltip\.js"><\/script>/)
  assert.match(uiComponentsHtml, /<script src="\/tooltip\.js" defer><\/script>/)
  assert.match(legacyPrototypeHtml, /<script src="\/tooltip\.js"><\/script>/)
  assert.match(uiKit, /\.base-checkbox__input:checked \+ \.base-checkbox__control/)
  assert.match(uiKit, /\.base-checkbox__input:indeterminate \+ \.base-checkbox__control/)
  assert.match(styles, /is-segments-mode|studio-page--segments/)
  assert.match(iconSprite, /<symbol id="icon-alert-circle"/)
  assert.match(uiComponentsHtml, /icon-alert-circle/)
  assert.match(uiComponentsHtml, /StageTools/)
  assert.match(uiComponentsHtml, /WorkflowStagebar/)
  assert.doesNotMatch(uiComponentsHtml, /InspectorNavigation|inspector-panel__navigation/)
  assert.match(client, /function setupInspectorPanels/)
  assert.match(client, /function renderInspectorPanelState/)
  assert.match(styles, /\.inspector-panel__body\s*\{[^}]*grid-auto-rows:\s*minmax\(100%, max-content\)/)
  assert.match(styles, /\.object-inspector\s*\{[^}]*display:\s*contents/)
  assert.match(styles, /\.inspector-panel\s*\{[^}]*overflow:\s*hidden;[^}]*border-left:\s*1px solid var\(--line\)/)
  assert.match(styles, /\.studio\s*\{[^}]*--inspector-width:\s*clamp\(320px, 27vw, 430px\)/)
  assert.doesNotMatch(styles, /is-inspector-panel-open|inspector-panel__navigation/)
  assert.match(styles, /\.inspector-section__content\s*\{[^}]*min-width:\s*0;[^}]*display:\s*flex;[^}]*flex-direction:\s*column/)
  assert.doesNotMatch(styles, /--minimum-checkbox-column-width/)
  assert.match(styles, /\.segment-translation-workspace\s*\{[^}]*background:\s*#fff/)
  assert.match(html, /id="format-all-segments"[\s\S]*?Применить ко всем выбранным/)
  assert.match(html, /id="typography-select-all"[^>]*aria-pressed="false"[^>]*>Выбрать все сегменты<\/button>/)
  assert.match(styles, /\.typography-card__scope \.button\.is-active\s*\{[^}]*background:\s*#eef2ff/)
  assert.doesNotMatch(html, /translation-batch-controls|translation-instruction-card__actions/)
  assert.doesNotMatch(styles, /\.document-tabs__add\s*\{/)
  assert.doesNotMatch(styles, /\.source-preview-controls \.icon-button\s*\{/)
  dom.window.close()
})

test('UI components catalog exposes an interactive SourcePreviewControls reference', () => {
  assert.match(server, /app\.get\('\/ui-components'/)
  assert.match(uiComponentsHtml, /SourcePreviewControls/)
  assert.match(uiComponentsHtml, /id="source-preview-demo"/)
  assert.match(uiComponentsHtml, /IconButton \/ BaseIcon/)
  assert.match(uiComponentsHtml, /ColorPicker/)
  assert.match(uiComponentsHtml, /BaseCheckbox/)
  assert.match(uiComponentsHtml, /BaseTooltip/)
  assert.match(uiComponentsHtml, /BaseScrollbar/)
  assert.match(uiComponentsHtml, /StageTools/)
  assert.match(uiComponentsHtml, /component-scrollbar-demo/)
  assert.match(uiComponentsHtml, /id="component-tooltip-demo"/)
  assert.match(uiComponentsHtml, /icon-layout/)
  assert.match(uiComponentsHtml, /icon-list-rows/)

  const dom = new JSDOM(uiComponentsHtml.replace('<script src="/ui-components.js" defer></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/ui-components',
  })
  dom.window.eval(uiComponentsClient)
  assert.ok(dom.window.document.querySelector('.component-stage-tools-demo'))
  assert.equal(dom.window.document.querySelector('.component-stage-tools-demo .inspector-section__title'), null)
  assert.equal(dom.window.document.querySelector('.component-stage-tools-demo__body').getAttribute('aria-label'), 'Типографика и расстановка')
  const output = dom.window.document.querySelector('#component-source-zoom-output')
  assert.equal(output.value, '70%')
  dom.window.document.querySelector('#component-source-zoom-in').click()
  assert.equal(output.value, '80%')
  dom.window.document.querySelector('#component-source-zoom-100').click()
  assert.equal(output.value, '100%')
  const colorInput = dom.window.document.querySelector('#component-text-color')
  colorInput.value = '#cc3300'
  colorInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(colorInput.closest('.color-picker').style.getPropertyValue('--color-picker-value'), '#cc3300')
  assert.equal(dom.window.document.querySelector('#component-document').style.transform, 'scale(1)')
  dom.window.close()
})

test('BaseScrollbar applies the briefing-app scrollbar across every interface', () => {
  for (const markup of [html, legacyPrototypeHtml, uiComponentsHtml, docsHtml, onlyofficeHtml]) {
    assert.match(markup, /href="\/ui-kit\.css"/)
  }
  assert.doesNotMatch(uiKit, /scrollbar-gutter/)
  assert.match(uiKit, /\*\s*\{[^}]*scrollbar-color:\s*var\(--base-scrollbar-thumb\) transparent;[^}]*scrollbar-width:\s*thin;/)
  assert.match(uiKit, /\*::-webkit-scrollbar\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;/)
  assert.match(uiKit, /\*::-webkit-scrollbar-track\s*\{[^}]*background-color:\s*transparent;/)
  assert.match(uiKit, /\*::-webkit-scrollbar-thumb\s*\{[^}]*border:\s*2px solid transparent;[^}]*background-clip:\s*content-box;/)
  assert.match(uiKit, /\*::-webkit-scrollbar-thumb:hover\s*\{[^}]*background-color:\s*var\(--base-scrollbar-thumb-hover\);/)
  assert.doesNotMatch(styles, /\.page-thumbnails\s*\{[^}]*scrollbar-width:/)
})

test('BaseTooltip labels every icon button on hover and keyboard focus', () => {
  const dom = new JSDOM('<!doctype html><button class="icon-button" type="button" aria-label="Сохранить"><svg></svg></button><button id="legacy-title" class="icon-button" type="button" title="удалить"></button>', {
    runScripts: 'dangerously', pretendToBeVisual: true,
  })
  dom.window.eval(tooltipClient)
  const button = dom.window.document.querySelector('button')
  const tooltip = dom.window.document.querySelector('#base-tooltip')
  Object.defineProperty(dom.window, 'innerWidth', { value: 320, configurable: true })
  Object.defineProperty(dom.window, 'innerHeight', { value: 240, configurable: true })
  tooltip.getBoundingClientRect = () => ({ width: 120, height: 40 })
  button.getBoundingClientRect = () => ({ left: 0, right: 28, top: 100, bottom: 128, width: 28, height: 28 })
  assert.equal(tooltip.getAttribute('role'), 'tooltip')
  button.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }))
  assert.equal(tooltip.hidden, false)
  assert.equal(tooltip.textContent, 'Сохранить')
  assert.equal(button.getAttribute('aria-describedby'), 'base-tooltip')
  assert.equal(tooltip.dataset.placement, 'right')
  button.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true }))
  assert.equal(tooltip.hidden, true)
  button.getBoundingClientRect = () => ({ left: 292, right: 320, top: 100, bottom: 128, width: 28, height: 28 })
  button.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }))
  assert.equal(tooltip.dataset.placement, 'left')
  button.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true }))
  button.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }))
  assert.equal(tooltip.hidden, false)
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(tooltip.hidden, true)
  const titleButton = dom.window.document.querySelector('#legacy-title')
  assert.equal(titleButton.getAttribute('title'), null)
  assert.equal(titleButton.getAttribute('aria-label'), 'Удалить')
  dom.window.close()
})

test('documentation pages render the maintained Markdown sources from the interface', async () => {
  assert.match(server, /app\.get\('\/documentation'/)
  assert.match(server, /app\.get\('\/user-guide'/)
  assert.match(server, /app\.get\('\/api\/docs\/:slug'/)
  assert.match(server, /TECHNICAL_SPECIFICATION\.md/)
  assert.match(server, /USER_GUIDE\.md/)
  assert.match(server, /Cache-Control', 'no-store'/)
  assert.match(agentsGuide, /Любое изменение пользовательского поведения/)
  assert.match(agentsGuide, /Любое изменение архитектуры/)
  assert.ok(technicalSpecification.length > 1_000)

  const dom = new JSDOM(docsHtml.replace('<script src="/docs.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/user-guide',
  })
  dom.window.fetch = async url => {
    assert.equal(String(url), '/api/docs/user-guide')
    return {
      ok: true,
      json: async () => ({
        title: 'Руководство пользователя',
        description: 'Актуальная справка',
        updatedAt: '2026-09-07T10:00:00.000Z',
        markdown: '# Руководство\n\n## Первый раздел\n\n| Кнопка | Действие |\n| --- | --- |\n| **Документы** | Открыть список |',
      }),
    }
  }
  dom.window.eval(docsClient)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#docs-title').textContent, 'Руководство пользователя')
  assert.equal(dom.window.document.querySelectorAll('#docs-toc a').length, 1)
  assert.equal(dom.window.document.querySelectorAll('#docs-content table').length, 1)
  assert.match(dom.window.document.querySelector('#docs-content').textContent, /Документы/)
  dom.window.close()
})

test('studio keeps an independently zoomable source beside editable page objects', () => {
  assert.match(styles, /\.source-preview-panel[\s\S]*border-right/)
  assert.match(styles, /\.source-preview-page img[\s\S]*pointer-events: none/)
  assert.match(styles, /\.source-preview-page[\s\S]*cursor: grab/)
  assert.match(styles, /\.source-preview-scroll\.is-panning[\s\S]*cursor: grabbing/)
  assert.match(client, /function beginSourcePan/)
  assert.doesNotMatch(styles, /\.scene-object\.has-inset-drag-handle/)
  assert.match(styles, /\.studio-page\s*\{[\s\S]*?overflow:\s*visible/)
  assert.match(styles, /\.scene-object__resize\s*\{[^}]*right:\s*-12px[^}]*bottom:\s*-12px/)
  assert.match(styles, /\.page-actions\s*\{[^}]*display:\s*flex/)
  assert.match(styles, /\.studio-page\.is-drag-target/)
  assert.match(styles, /\.studio-page\.is-drag-source/)
  assert.match(styles, /\.studio-page-shell\.is-drag-source-shell/)
  assert.match(styles, /\.scene-object\.is-selected\s*\{\s*z-index:/)
  assert.doesNotMatch(styles, /(?:^|\n)\.scene-object\.is-selected\s*\{[^}]*(?:outline|border):/)
  assert.match(styles, /\.scene-object\.is-selected:not\(\.is-primary-selected\) \.scene-object__handle\s*\{[^}]*background:\s*#98a2b3/)
  assert.match(styles, /\.scene-object\.is-primary-selected \.scene-object__handle\s*\{[^}]*background:\s*var\(--blue\)/)
  assert.doesNotMatch(styles, /has-inset-resize/)
  assert.doesNotMatch(client, /has-inset-resize/)
  assert.match(client, /function startPointerAction/)
  assert.match(client, /lostpointercapture/)
  assert.match(styles, /\.scene-object[\s\S]*position: absolute/)
  assert.match(styles, /\.studio-page[\s\S]*overflow: hidden/)
  assert.match(styles, /\.content-boundary/)
  assert.match(styles, /background-origin:\s*border-box/)
  assert.match(styles, /background-position:\s*left top/)
  assert.match(styles, /--grid-size/)
  assert.match(styles, /--grid-size-middle/)
  assert.match(styles, /--grid-size-outer/)
  assert.match(styles, /\.studio\.is-source-collapsed/)
  assert.match(styles, /\.studio-page--segments/)
  assert.match(styles, /\.scene-object__content[^}]*overflow:\s*hidden/)
  assert.match(styles, /\.scene-object__content[^}]*overflow-wrap:\s*normal;[^}]*word-break:\s*normal;[^}]*hyphens:\s*none;/)
  assert.doesNotMatch(styles, /\.scene-object__content[^}]*overflow-wrap:\s*anywhere/)
  assert.match(client, /overflowWrap:\s*'normal',\s*wordBreak:\s*'normal',\s*hyphens:\s*'none'/)
  assert.match(client, /function minimumObjectHeight/)
  assert.match(client, /function constrainObjectHeight/)
  assert.match(client, /function finalizeResizedObjectGeometry[\s\S]*?object\.width = horizontal\.length[\s\S]*?minimumObjectHeight\(object, object\.width\)[\s\S]*?object\.height =/)
  assert.match(client, /function constrainObjectToWorkArea/)
  assert.match(client, /function fitObjectSizeIntoFreeGridCells/)
  assert.match(client, /function fitSelectionToContent[\s\S]*fitObjectSizeIntoFreeGridCells/)
  assert.match(client, /function stretchSelectionToWorkArea[\s\S]*fitObjectSizeIntoFreeGridCells/)
  assert.match(styles, /\.knowledge-suggestion__pair\s*\{[^}]*font-size:\s*12px/)
  assert.match(styles, /\.knowledge-suggestion__value\s*\{[^}]*font-weight:\s*500/)
  assert.doesNotMatch(styles, /\.knowledge-suggestion__score/)
  assert.match(client, /object\.manualWidth === false/)
  assert.match(client, /object\.manualHeight === false/)
  assert.match(client, /object\.manualWidth = true/)
  assert.match(client, /object\.manualHeight = true/)
  assert.match(client, /fitObjectsToRenderedContent\(state\.scene\.objects, true\)/)
  assert.match(client, /function expandClippedObjects/)
})

test('studio client boots on the upload screen without runtime errors', async () => {
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error))
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously',
    url: 'http://127.0.0.1:3100/',
    virtualConsole,
  })
  dom.window.fetch = async () => ({
    ok: true,
    json: async () => ({ translationProviderConfigured: false, translationModel: null }),
  })
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#upload-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, true)
  assert.deepEqual(errors, [])
  dom.window.close()
})

test('AI settings load the live AITunnel catalog and disable text-only models', async () => {
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async url => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (String(url).endsWith('/provider/models')) return { ok: true, json: async () => ({ models: [
      { id: 'vision-a', provider: 'test', description: 'Vision', documentCapable: true },
      { id: 'text-a', provider: 'test', description: 'Text', documentCapable: false },
    ] }) }
    if (String(url).endsWith('/provider')) return { ok: true, json: async () => ({
      activeProvider: 'aitunnel', model: 'vision-a', keySource: 'session', aitunnelConfigured: true,
      aitunnelVerified: false, codexConfigured: true, apiHost: 'api.aitunnel.ru', publicKey: '',
    }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  dom.window.document.querySelector('#ai-settings-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  const options = [...dom.window.document.querySelector('#aitunnel-model').options]
  assert.equal(options.find(option => option.value === 'vision-a').disabled, false)
  assert.equal(options.find(option => option.value === 'text-a').disabled, true)
  assert.equal(dom.window.document.querySelector('#aitunnel-model').value, 'vision-a')
  assert.match(dom.window.document.querySelector('#aitunnel-model-note').textContent, /Доступно 1/)
  dom.window.close()
})

test('administration edits the persistent chat-agent prompt', async () => {
  const defaultPrompt = 'Базовый промпт чат-агента.'
  let storedPrompt = defaultPrompt
  const updates = []
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/administration')) {
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body)
        updates.push(body)
        storedPrompt = body.chatAgentPrompt
      }
      return { ok: true, json: async () => ({
        chatAgentPrompt: storedPrompt, defaultChatAgentPrompt: defaultPrompt, updatedAt: updates.length ? new Date().toISOString() : null,
      }) }
    }
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (value.endsWith('/translation-instructions')) return { ok: true, json: async () => ({ presets: [] }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    return { ok: true, json: async () => ({ jobs: [] }) }
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 20))

  dom.window.document.querySelector('#administration-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  const modal = dom.window.document.querySelector('#administration-modal')
  const input = dom.window.document.querySelector('#chat-agent-system-prompt')
  assert.equal(modal.hidden, false)
  assert.equal(input.value, defaultPrompt)
  input.value = 'Пользовательский промпт.'
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  dom.window.document.querySelector('#administration-save').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(updates, [{ chatAgentPrompt: 'Пользовательский промпт.' }])
  assert.match(dom.window.document.querySelector('#administration-status').textContent, /сохранён/)
  dom.window.document.querySelector('#administration-reset').click()
  assert.equal(input.value, defaultPrompt)
  dom.window.document.querySelector('#administration-close').click()
  assert.equal(modal.hidden, true)
  dom.window.close()
})

test('failed document jobs stop polling and show a terminal error state', async () => {
  const jobId = '3'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?job=${jobId}`,
  })
  let jobRequests = 0
  dom.window.fetch = async url => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (String(url).endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    if (String(url).endsWith(`/jobs/${jobId}`)) {
      jobRequests += 1
      return { ok: true, json: async () => ({ job: {
        id: jobId, title: 'failed.pdf', status: 'failed', stage: 'failed', progress: 30,
        error: 'AITunnel вернул некорректный JSON анализа',
      } }) }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 120))
  assert.equal(jobRequests, 1)
  assert.equal(dom.window.document.querySelector('#loading-view').classList.contains('is-failed'), true)
  assert.equal(dom.window.document.querySelector('#loading-title').textContent, 'Обработка остановлена')
  assert.equal(dom.window.document.querySelector('#loading-progress-label').textContent, 'Ошибка')
  assert.equal(dom.window.document.querySelector('#retry-job-button').hidden, false)
  dom.window.close()
})

test('failed document job can be restarted from the error screen', async () => {
  const failedJobId = '7'.repeat(32)
  const retryJobId = '8'.repeat(32)
  const documentId = '9'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?job=${failedJobId}`,
  })
  let retryRequests = 0
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    if (value.endsWith(`/jobs/${failedJobId}`)) return { ok: true, json: async () => ({ job: {
      id: failedJobId, documentId, title: 'failed.pdf', status: 'failed', stage: 'failed', progress: 30, error: 'Ошибка анализа',
    } }) }
    if (value.endsWith(`/jobs/${failedJobId}/retry`) && options.method === 'POST') {
      retryRequests += 1
      return { ok: true, json: async () => ({ job: {
        id: retryJobId, documentId, title: 'failed.pdf', status: 'queued', stage: 'queued', progress: 0, message: 'Ожидает обработки',
      } }) }
    }
    if (value.endsWith(`/jobs/${retryJobId}`)) return { ok: true, json: async () => ({ job: {
      id: retryJobId, documentId, title: 'failed.pdf', status: 'running', stage: 'rendering', progress: 10, message: 'Подготавливаем страницы документа',
    } }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  dom.window.document.querySelector('#retry-job-button').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(retryRequests, 1)
  assert.equal(dom.window.document.querySelector('#retry-job-button').hidden, true)
  assert.match(dom.window.location.search, new RegExp(retryJobId))
  dom.window.close()
})

test('completed document history is restored from local server storage after reload', async () => {
  const id = '4'.repeat(32)
  const scene = {
    title: 'Saved project', sourceLanguage: 'en', targetLanguage: 'ru', objects: [],
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async url => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (String(url).endsWith('/documents')) return { ok: true, json: async () => ({ documents: [{ id, title: 'Saved project', filename: 'saved.pdf', updatedAt: '2026-09-05T00:00:00Z' }] }) }
    if (String(url).endsWith(`/documents/${id}`)) return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 40))
  assert.equal(dom.window.document.querySelectorAll('.document-tab').length, 1)
  assert.match(dom.window.document.querySelector('.document-tab__title').textContent, /Saved project/)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#document-title').textContent, 'Saved project')
  dom.window.close()
})

test('document library shows active and archived projects with lifecycle actions', async () => {
  const activeId = '5'.repeat(32)
  const archivedId = '6'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async url => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ documentAnalysisMode: 'codex', codexAvailable: true, codexAuthenticated: true }) }
    if (value.includes('/documents?scope=all')) return { ok: true, json: async () => ({ documents: [
      { id: activeId, title: 'Active', pageCount: 3, objectCount: 10, updatedAt: '2026-09-05T00:00:00Z', archivedAt: null },
      { id: archivedId, title: 'Archived', pageCount: 2, objectCount: 4, updatedAt: '2026-09-04T00:00:00Z', archivedAt: '2026-09-05T00:00:00Z' },
    ] }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 20))
  dom.window.document.querySelector('#document-library-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))

  const rows = [...dom.window.document.querySelectorAll('.document-library-row')]
  assert.equal(rows.length, 2)
  assert.equal(rows[0].querySelector('.document-library-row__status').textContent, 'В работе')
  assert.equal(rows[1].classList.contains('is-archived'), true)
  assert.equal(rows[1].querySelector('.document-library-row__status').textContent, 'Архив')
  assert.match(rows[1].textContent, /Восстановить/)
  assert.match(rows[0].textContent, /В архив/)
  assert.match(rows[0].textContent, /Удалить/)
  dom.window.close()
})

test('multiple dropped files create independent asynchronous document tabs', async () => {
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  let created = 0
  dom.window.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/status')) return {
      ok: true,
      json: async () => ({ codexAvailable: true, codexAuthenticated: true, documentAnalysisMode: 'codex', translationProviderConfigured: false }),
    }
    if (String(url).endsWith('/jobs') && options.method === 'POST') {
      const current = ++created
      const id = String(current).repeat(32)
      return {
        ok: true,
        json: async () => ({ job: { id, documentId: String(current + 4).repeat(32), title: `file-${current}.png`, status: 'queued', progress: 0, message: `Ожидает file-${current}` } }),
      }
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 10))
  const files = [
    new dom.window.File(['first'], 'first.png', { type: 'image/png' }),
    new dom.window.File(['second'], 'second.png', { type: 'image/png' }),
  ]
  const drop = new dom.window.Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: { files } })
  dom.window.document.querySelector('#upload-zone').dispatchEvent(drop)
  await new Promise(resolve => setTimeout(resolve, 30))

  assert.equal(created, 2)
  assert.equal(dom.window.document.querySelectorAll('.document-tab').length, 2)
  assert.equal(dom.window.document.querySelector('#document-tabs').hidden, false)
  assert.equal(dom.window.document.body.classList.contains('has-document-tabs'), true)
  assert.equal(dom.window.document.querySelector('#loading-view').hidden, false)
  const tabs = [...dom.window.document.querySelectorAll('.document-tab')]
  tabs[1].click()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(dom.window.document.querySelector('#loading-message').textContent, 'Ожидает file-2')
  ;[...dom.window.document.querySelectorAll('.document-tab')].find(tab => tab.textContent.includes('file-1.png')).click()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(dom.window.document.querySelector('#loading-message').textContent, 'Ожидает file-1')
  dom.window.close()
})

test('switching tabs preserves an in-progress translation and restores its finished document', async () => {
  const firstId = 'a'.repeat(32)
  const secondId = 'b'.repeat(32)
  const makeScene = (title, sourceText) => ({
    title, sourceLanguage: 'en', targetLanguage: 'ru', workflowVersion: 2, workflowStage: 1,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: `${title}-object`, pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText, translation: '', confidence: .98, x: 40, y: 40, width: 180, height: 32,
      rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 40, width: 180, height: 32 },
    }],
  })
  const firstScene = makeScene('Первый документ', 'First source')
  const secondScene = makeScene('Второй документ', 'Second source')
  const translatedScene = structuredClone(firstScene)
  translatedScene.objects[0].translation = 'Первый перевод'
  let releaseTranslation
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${firstId}`,
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/api/studio/status')) return { ok: true, json: async () => ({ translationProviderConfigured: true, translationModel: 'test' }) }
    if (value.endsWith('/api/studio/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (value.endsWith('/api/studio/documents')) return { ok: true, json: async () => ({ documents: [
      { id: firstId, title: firstScene.title }, { id: secondId, title: secondScene.title },
    ] }) }
    if (value.endsWith(`/documents/${firstId}`) && !options.method) return { ok: true, json: async () => ({ metadata: { id: firstId }, scene: firstScene }) }
    if (value.endsWith(`/documents/${secondId}`) && !options.method) return { ok: true, json: async () => ({ metadata: { id: secondId }, scene: secondScene }) }
    if (value.endsWith(`/documents/${firstId}/translate`) && options.method === 'POST') {
      await new Promise(resolve => { releaseTranslation = resolve })
      return { ok: true, json: async () => ({ scene: translatedScene, translated: [translatedScene.objects[0].id], suggested: [], pending: [], message: 'Документ переведён' }) }
    }
    if (options.method === 'PUT') {
      const id = value.includes(firstId) ? firstId : secondId
      return { ok: true, json: async () => ({ metadata: { id, revision: 2 } }) }
    }
    if (value.endsWith('/knowledge-base/status')) return { ok: true, json: async () => ({ connected: true, persistent: false, entries: 0 }) }
    if (value.endsWith('/knowledge-base/glossaries')) return { ok: true, json: async () => ({ glossaries: [] }) }
    if (value.endsWith('/translation-instructions')) return { ok: true, json: async () => ({ instructions: [] }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 40))

  dom.window.document.querySelector('#workflow-approve').click()
  dom.window.document.querySelector('#translation-approval-submit').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(typeof releaseTranslation, 'function')
  assert.match([...dom.window.document.querySelectorAll('.document-tab')][0].textContent, /переводится/)

  const tabs = [...dom.window.document.querySelectorAll('.document-tab')]
  tabs.find(tab => tab.textContent.includes(secondScene.title)).click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#document-title').textContent, secondScene.title)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)

  ;[...dom.window.document.querySelectorAll('.document-tab')].find(tab => tab.textContent.includes(firstScene.title)).click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#loading-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#loading-title').textContent, 'Переводим документ')

  ;[...dom.window.document.querySelectorAll('.document-tab')].find(tab => tab.textContent.includes(secondScene.title)).click()
  await new Promise(resolve => setTimeout(resolve, 10))
  releaseTranslation()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelector('#document-title').textContent, secondScene.title)
  assert.equal(dom.window.document.querySelector('#studio-view').dataset.workflowStage, '1')

  ;[...dom.window.document.querySelectorAll('.document-tab')].find(tab => tab.textContent.includes(firstScene.title)).click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(dom.window.document.querySelector('#document-title').textContent, firstScene.title)
  assert.equal(dom.window.document.querySelector('#studio-view').dataset.workflowStage, '2')
  assert.equal(dom.window.document.querySelector('.scene-object--translation .scene-object__content').textContent, 'Первый перевод')
  dom.window.close()
})

test('workflow restores the segment interface without manual view switches', async () => {
  const studioDocument = new JSDOM(html).window.document
  assert.equal(studioDocument.querySelector('#view-layout-button'), null)
  assert.equal(studioDocument.querySelector('#view-segments-button'), null)
  assert.doesNotMatch(client, /setDocumentView/)
  assert.match(client, /workflowUsesSegments|studio-page--segments|segment-translation-row/)
  assert.match(styles, /studio-page--segments|segment-translation-row/)
  assert.ok(studioDocument.querySelector('#workflow-stagebar'))
  assert.equal(studioDocument.querySelector('#workflow-previous').getAttribute('aria-label'), 'Назад')
  assert.equal(studioDocument.querySelector('#workflow-approve').getAttribute('aria-label'), 'Утвердить')
  assert.match(studioDocument.querySelector('#workflow-previous use').getAttribute('href'), /icon-arrow-left$/)
  assert.match(studioDocument.querySelector('#workflow-approve use').getAttribute('href'), /icon-arrow-right$/)
  studioDocument.defaultView.close()
  return
  const id = '2'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  const makeObject = (idValue, text, x, y, readingOrder) => ({
    id: idValue, pageIndex: 0, type: 'text', readingOrder, sourceText: text, translation: '', confidence: .98,
    x, y, width: 180, height: 32, rotation: 0, excluded: false,
    style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
    sourceTextStyles: [], translationTextStyles: [], originalBounds: { x, y, width: 180, height: 32 },
  })
  const scene = {
    title: 'Reading order', sourceLanguage: 'en', targetLanguage: 'ru',
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [
      makeObject('top-right', 'Top right', 430, 43, 1),
      makeObject('second-left', 'Second left', 40, 100, 2),
      {
        ...makeObject('top-left', 'Top left', 40, 40, 99),
        confidence: .71,
        agentNotes: 'Проверьте распознанное имя по оригиналу.',
        style: { fontFamily: 'Times New Roman', fontSizePx: 24, fontWeight: 700, fontStyle: 'italic', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      },
      makeObject('second-right', 'Second right', 430, 104, 3),
      { ...makeObject('signature', '', 40, 170, 4), type: 'signature', translation: '/Подпись/' },
    ],
  }
  const translationRequests = []
  const instructionPresetRequests = []
  const instructionPresetPatchRequests = []
  const instructionPreset = { id: 'preset-1', instruction: 'Передавай имена транслитерацией.' }
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (value.endsWith('/translation-instructions') && options.method === 'POST') {
      const request = JSON.parse(options.body)
      instructionPresetRequests.push(request)
      return { ok: true, json: async () => ({ created: true, preset: { id: 'preset-2', instruction: request.instruction } }) }
    }
    if (value.endsWith('/translation-instructions/preset-1') && options.method === 'PATCH') {
      const request = JSON.parse(options.body)
      instructionPresetPatchRequests.push(request)
      return { ok: true, json: async () => ({ preset: { id: 'preset-1', ...request } }) }
    }
    if (value.endsWith('/translation-instructions')) return { ok: true, json: async () => ({ presets: [instructionPreset] }) }
    if (value.endsWith(`/documents/${id}/scene`) && options.method === 'PUT') {
      return { ok: true, json: async () => ({ metadata: { id, revision: 2 } }) }
    }
    if (value.endsWith(`/documents/${id}/translate`) && options.method === 'POST') {
      translationRequests.push(JSON.parse(options.body))
      return { ok: true, json: async () => ({ scene, translated: [], suggested: [], pending: [], message: 'Пакет обработан' }) }
    }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  dom.window.document.querySelector('#view-segments-button').click()
  assert.equal(dom.window.document.querySelector('#zoom-output').value, '100%')
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-source-collapsed'), true)
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').getAttribute('aria-expanded'), 'false')

  const reanalyzeModal = dom.window.document.querySelector('#reanalyze-confirm-modal')
  assert.equal(reanalyzeModal.hidden, true)
  dom.window.document.querySelector('#reanalyze-button').click()
  assert.equal(reanalyzeModal.hidden, false)
  dom.window.document.querySelector('#reanalyze-confirm-cancel').click()
  assert.equal(reanalyzeModal.hidden, true)
  dom.window.document.querySelector('#reanalyze-button').click()
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(reanalyzeModal.hidden, true)

  const order = [...dom.window.document.querySelectorAll('.segments-list .scene-object--source')].map(node => node.dataset.id)
  assert.deepEqual(order, ['top-left', 'top-right', 'second-left', 'second-right', 'signature'])
  assert.equal(dom.window.document.querySelectorAll('.segments-list .segment-translation-row').length, 5)
  assert.equal(dom.window.document.querySelectorAll('.segment-translation-row__meta').length, 5)
  const firstSegmentRow = dom.window.document.querySelector('.scene-object--source[data-id="top-left"]').closest('.segment-translation-row')
  const firstSegmentMeta = firstSegmentRow.querySelector('.segment-translation-row__meta')
  assert.match(firstSegmentMeta.querySelector('.segment-agent-notes').textContent, /Проверьте распознанное имя/)
  assert.equal(firstSegmentMeta.querySelector('.segment-agent-notes use').getAttribute('href'), '/icons.svg#icon-alert-circle')
  assert.equal(firstSegmentMeta.querySelector('.segment-agent-notes').firstElementChild.className, 'segment-agent-notes__icon')
  assert.equal(firstSegmentMeta.querySelector('.segment-row-confidence strong').textContent, '71%')
  assert.equal(firstSegmentMeta.querySelector('.segment-row-type select').value, 'text')
  const typeTriggerProbe = dom.window.document.createElement('button')
  firstSegmentMeta.querySelector('.segment-row-type').append(typeTriggerProbe)
  const typePointerDown = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
  typeTriggerProbe.dispatchEvent(typePointerDown)
  assert.equal(typePointerDown.defaultPrevented, false)
  typeTriggerProbe.remove()
  assert.equal(firstSegmentMeta.querySelector('.segment-translation-row__meta-controls').children.length, 2)
  const rowWithoutNotes = dom.window.document.querySelector('.scene-object--source[data-id="top-right"]').closest('.segment-translation-row')
  assert.equal(rowWithoutNotes.querySelector('.segment-agent-notes').hidden, false)
  assert.equal(rowWithoutNotes.querySelector('.segment-agent-notes').classList.contains('is-empty'), true)
  assert.equal(rowWithoutNotes.querySelector('.segment-agent-notes').children.length, 0)
  assert.equal(rowWithoutNotes.querySelector('.segment-agent-notes').getAttribute('aria-hidden'), 'true')
  assert.ok(rowWithoutNotes.querySelector('.segment-translation-row__meta-controls .segment-row-confidence'))
  assert.ok(rowWithoutNotes.querySelector('.segment-translation-row__meta-controls .segment-row-type'))
  assert.equal(firstSegmentRow.querySelector('.scene-object--translation .segment-ai-instruction'), null)
  assert.ok(firstSegmentRow.querySelector('.segment-translation-row__workspace > .segment-ai-instruction'))
  assert.equal(dom.window.document.querySelectorAll('.segment-ai-instruction textarea').length, 5)
  assert.match(styles, /\.segment-translation-row__meta\s*\{[^}]*grid-column:\s*2 \/ -1;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /\.segment-translation-row__meta-controls\s*\{[^}]*grid-column:\s*2;/)
  assert.match(styles, /\.segment-translation-row__workspace\s*\{[^}]*grid-column:\s*2 \/ -1/)
  assert.match(styles, /\.studio-page--segments \.scene-object\s*\{[^}]*min-height:\s*120px;/)
  assert.match(styles, /\.studio-page--segments \.scene-object__content\s*\{[^}]*font-family:\s*Arial, sans-serif !important;[^}]*font-size:\s*16px !important;[^}]*font-weight:\s*400 !important;[^}]*font-style:\s*normal !important/)
  assert.match(styles, /\.studio-page--segments \.scene-object__content\s*\{[^}]*min-height:\s*120px;/)
  assert.match(styles, /\.scene-object--translation\.is-untranslated \.scene-object__content:empty::before\s*\{[^}]*content:\s*"Поле для перевода";[^}]*font:\s*400 14px\/1\.35 Arial, sans-serif/)
  assert.doesNotMatch(styles, /\.studio-page--segments \.scene-object--translation\.is-untranslated \.scene-object__content:empty::before\s*\{[^}]*font-style:\s*italic/)
  const globalPresetSelect = dom.window.document.querySelector('#instruction-preset-select')
  const globalPresetSave = dom.window.document.querySelector('#instruction-preset-save')
  const reviseDocument = dom.window.document.querySelector('#revise-document-button')
  const reviseSelected = dom.window.document.querySelector('#revise-selected-button')
  assert.equal(globalPresetSave.disabled, true)
  assert.equal(reviseDocument.disabled, true)
  assert.equal(reviseSelected.disabled, true)
  globalPresetSelect.value = instructionPreset.id
  globalPresetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  dom.window.document.querySelector('#instruction-preset-apply').click()
  assert.equal(dom.window.document.querySelector('#translation-global-instruction').value, instructionPreset.instruction)
  assert.equal(globalPresetSave.disabled, false)
  assert.equal(reviseDocument.disabled, false)
  assert.equal(reviseSelected.disabled, true)
  dom.window.document.querySelector('#translation-global-instruction').value = '   '
  dom.window.document.querySelector('#translation-global-instruction').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(globalPresetSave.disabled, true)
  assert.equal(reviseDocument.disabled, true)
  assert.equal(reviseSelected.disabled, true)
  dom.window.document.querySelector('#translation-global-instruction').value = instructionPreset.instruction
  dom.window.document.querySelector('#translation-global-instruction').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  const segmentInstruction = dom.window.document.querySelector('.segment-ai-instruction')
  const segmentPresetSelect = segmentInstruction.querySelector('[data-instruction-preset-select]')
  segmentPresetSelect.value = instructionPreset.id
  segmentPresetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  segmentInstruction.querySelector('[data-instruction-preset-apply]').click()
  assert.equal(segmentInstruction.querySelector('textarea').value, instructionPreset.instruction)
  dom.window.document.querySelector('#translation-global-instruction').value = '   '
  dom.window.document.querySelector('#translation-global-instruction').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(reviseDocument.disabled, true, 'a local segment instruction must not enable full-document revision')
  dom.window.document.querySelector('#translation-global-instruction').value = instructionPreset.instruction
  dom.window.document.querySelector('#translation-global-instruction').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  dom.window.document.querySelector('#instruction-preset-edit').click()
  assert.equal(dom.window.document.querySelector('#instruction-preset-editor').hidden, false)
  dom.window.document.querySelector('#instruction-preset-text').value = 'Передавай имена по стандарту ISO 9.'
  dom.window.document.querySelector('#instruction-preset-edit-save').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.deepEqual(instructionPresetPatchRequests[0], { instruction: 'Передавай имена по стандарту ISO 9.' })
  assert.equal(dom.window.document.querySelector('#instruction-preset-editor').hidden, true)
  assert.equal(dom.window.document.querySelector('#instruction-preset-select').selectedOptions[0].textContent, 'Передавай имена по стандарту ISO 9.')
  segmentInstruction.querySelector('textarea').value = 'Сохраняй номера без изменений.'
  segmentInstruction.querySelector('textarea').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  ;[...segmentInstruction.querySelectorAll('button')].find(button => button.textContent === 'Сохранить').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(instructionPresetRequests[0].instruction, 'Сохраняй номера без изменений.')
  const checkboxes = [...dom.window.document.querySelectorAll('[data-translation-select]')]
  const selectAll = dom.window.document.querySelector('#translation-select-all')
  const clearSelection = dom.window.document.querySelector('#translation-clear-selection')
  const translate = dom.window.document.querySelector('#translate-button')
  assert.equal(checkboxes.length, 5)
  assert.ok(checkboxes.every(checkbox => checkbox.nextElementSibling.textContent === 'Выбрать'))
  assert.equal(translate.disabled, true)
  assert.equal(clearSelection.disabled, true)
  assert.equal(dom.window.document.querySelector('#translation-selection-count').textContent, 'Выбрано: 0 из 5 сегментов')

  const pageSelectAll = dom.window.document.querySelector('.segments-select-all')
  assert.equal(pageSelectAll.textContent, 'Все')
  pageSelectAll.click()
  assert.equal(checkboxes.every(checkbox => checkbox.checked), true)
  assert.ok(checkboxes.every(checkbox => checkbox.nextElementSibling.textContent === 'Выбран'))
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 5)
  assert.equal(pageSelectAll.classList.contains('is-active'), true)
  assert.equal(pageSelectAll.getAttribute('aria-pressed'), 'true')
  pageSelectAll.click()
  assert.equal(checkboxes.every(checkbox => !checkbox.checked), true)
  assert.ok(checkboxes.every(checkbox => checkbox.nextElementSibling.textContent === 'Выбрать'))
  assert.equal(pageSelectAll.classList.contains('is-active'), false)
  assert.equal(pageSelectAll.getAttribute('aria-pressed'), 'false')

  const firstCheckboxControl = checkboxes[0].nextElementSibling
  firstCheckboxControl.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
  firstCheckboxControl.click()
  assert.equal(dom.window.document.querySelector('#selection-box').hidden, true)
  assert.equal(checkboxes[0].checked, true)
  assert.equal(checkboxes[0].nextElementSibling.textContent, 'Выбран')
  assert.equal(translate.disabled, false)
  assert.equal(clearSelection.disabled, false)
  assert.equal(translate.textContent, 'Перевести выбранные (1)')
  assert.equal(reviseSelected.disabled, false)
  assert.equal(selectAll.checked, false)
  assert.equal(selectAll.indeterminate, false)

  checkboxes[1].click()
  assert.equal(checkboxes[0].checked, true)
  assert.equal(checkboxes[1].checked, true)
  assert.equal(selectAll.checked, false)
  assert.equal(selectAll.indeterminate, false)
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id, checkboxes[1].dataset.translationSelect)

  clearSelection.click()
  assert.equal(checkboxes.every(checkbox => !checkbox.checked), true)
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 0)
  assert.equal(selectAll.checked, false)
  assert.equal(clearSelection.disabled, true)

  checkboxes[0].click()
  checkboxes[1].click()

  checkboxes[0].click()
  assert.equal(checkboxes[0].checked, true)
  assert.equal(checkboxes[1].checked, true)
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id, checkboxes[0].dataset.translationSelect)
  assert.equal(checkboxes[0].closest('.segment-translation-row').classList.contains('is-primary-selected'), true)
  assert.equal(checkboxes[1].closest('.segment-translation-row').classList.contains('is-primary-selected'), false)

  checkboxes[0].click()
  assert.equal(checkboxes[0].checked, false)
  assert.equal(checkboxes[0].nextElementSibling.textContent, 'Выбрать')
  assert.equal(checkboxes[1].checked, true)
  assert.equal(checkboxes[1].nextElementSibling.textContent, 'Выбран')
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 1)
  assert.equal(dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id, checkboxes[1].dataset.translationSelect)

  selectAll.checked = true
  selectAll.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(checkboxes.every(checkbox => checkbox.checked), true)
  assert.equal(selectAll.checked, true)
  assert.equal(selectAll.indeterminate, false)
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 5)
  assert.equal(translate.textContent, 'Перевести весь документ (5)')

  const primaryBeforeSegmentClick = dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id
  const nonPrimarySelectedSegment = [...dom.window.document.querySelectorAll('.scene-object--source.is-selected')]
    .find(node => node.dataset.id !== primaryBeforeSegmentClick)
  nonPrimarySelectedSegment.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  nonPrimarySelectedSegment.querySelector('.scene-object__content').focus()
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 5)
  assert.equal(dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id, nonPrimarySelectedSegment.dataset.id)

  const anotherSelectedRow = [...dom.window.document.querySelectorAll('.segment-translation-row.is-translation-selected')]
    .find(row => row.querySelector('[data-translation-select]').dataset.translationSelect !== nonPrimarySelectedSegment.dataset.id)
  anotherSelectedRow.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 5)
  assert.equal(
    dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id,
    anotherSelectedRow.querySelector('[data-translation-select]').dataset.translationSelect,
  )

  translate.click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, 1)
  assert.deepEqual(new Set(translationRequests[0].objectIds), new Set(['top-left', 'top-right', 'second-left', 'second-right', 'signature']))

  const focusedCheckbox = dom.window.document.querySelector('.segment-translation-row.is-primary-selected [data-translation-select]')
  focusedCheckbox.click()
  assert.equal(focusedCheckbox.checked, false)
  dom.window.document.querySelector('#translate-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, 2)
  assert.equal(translationRequests[1].objectIds.length, 4)
  assert.equal(translationRequests[1].objectIds.includes(focusedCheckbox.dataset.translationSelect), false)
  const inlineType = dom.window.document.querySelector('.scene-object--source[data-id="top-left"]')
    .closest('.segment-translation-row').querySelector('.segment-row-type select')
  inlineType.value = 'stamp'
  inlineType.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(scene.objects.find(object => object.id === 'top-left').type, 'stamp')
  assert.equal(dom.window.document.querySelector('.scene-object--source[data-id="top-left"]')
    .closest('.segment-translation-row').querySelector('.segment-row-type select').value, 'stamp')
  dom.window.close()
})

test('approval advances through isolated document stages and switches the workspace automatically', async () => {
  const id = '7'.repeat(32)
  const scene = {
    title: 'Workflow', sourceLanguage: 'en', targetLanguage: 'ru', workflowStage: 1,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1000 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'workflow-object', pageIndex: 0, type: 'text', readingOrder: 2,
      sourceText: 'Source', translation: 'Перевод', confidence: .96,
      agentNotes: 'Автокоррекция макета: Заголовок смещён.\nПроверьте имя по оригиналу.',
      x: 40, y: 60, width: 200, height: 32, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], sourceRegions: [{ x: .25, y: .2, width: .1, height: .1 }], originalBounds: { x: 40, y: 60, width: 200, height: 32 },
    }, {
      id: 'workflow-object-2', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Second source', translation: 'Второй перевод', confidence: .9,
      x: 300, y: 60, width: 200, height: 32, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 18, fontWeight: 700, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 300, y: 60, width: 200, height: 32 },
    }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  Object.defineProperty(dom.window.HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      if (!this.classList?.contains('studio-page--segments')) return 0
      return this.closest('#studio-view')?.hidden ? 120 : 640
    },
  })
  const translationRequests = []
  let translationShouldFail = false
  let delayTranslation = false
  let releaseTranslation = null
  dom.window.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (String(url).endsWith('/translate') && options.method === 'POST') {
      translationRequests.push(JSON.parse(options.body))
      if (translationShouldFail) return { ok: false, status: 503, json: async () => ({ error: 'Перевод временно недоступен' }) }
      if (delayTranslation) await new Promise(resolve => { releaseTranslation = resolve })
      return { ok: true, json: async () => ({ scene, translated: [], suggested: [], pending: [], message: 'Документ переведён' }) }
    }
    if (options.method === 'PUT') return { ok: true, json: async () => ({ metadata: { id, revision: 2 } }) }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(layoutModelClient)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  const studio = dom.window.document.querySelector('#studio-view')
  const approve = dom.window.document.querySelector('#workflow-approve')
  assert.equal(studio.dataset.workflowStage, '1')
  assert.equal(studio.classList.contains('is-segments-mode'), true)
  assert.equal(dom.window.document.querySelectorAll('.segment-translation-row').length, 2)
  assert.equal(dom.window.document.querySelectorAll('.segment-translation-row .scene-object').length, 2)
  assert.ok([...dom.window.document.querySelectorAll('.scene-object__content')].every(node => node.contentEditable === 'true'))
  assert.equal(dom.window.document.querySelector('.segments-column-headings'), null)
  assert.equal(dom.window.document.querySelector('.segment-translation-selector'), null)
  assert.equal(dom.window.document.querySelector('.knowledge-highlight'), null)
  assert.equal(dom.window.document.querySelector('.scene-object__knowledge-icon'), null)
  assert.equal(dom.window.document.querySelector('.segment-content-badge--type').textContent, 'Текст')
  const reviewedWorkflowRow = dom.window.document.querySelector('[data-object-id="workflow-object"]')
  assert.equal(reviewedWorkflowRow.querySelector('.segment-content-badge--confidence').textContent, 'Уверенность 96%')
  assert.equal(reviewedWorkflowRow.querySelector('.segment-content-badges').contentEditable, 'false')
  assert.equal(reviewedWorkflowRow.querySelector('.segment-content-badge--type').tagName, 'SPAN')
  assert.equal(reviewedWorkflowRow.querySelector('.segment-content-badge--confidence').tagName, 'SPAN')
  const reviewedContent = reviewedWorkflowRow.querySelector('.scene-object__content')
  for (const child of [...reviewedContent.childNodes]) {
    if (child !== reviewedContent.querySelector('.segment-content-badges')) child.remove()
  }
  reviewedContent.append(dom.window.document.createTextNode('Исправленный исходник'))
  reviewedContent.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  reviewedContent.dispatchEvent(new dom.window.FocusEvent('blur'))
  const reviewedContentClone = reviewedContent.cloneNode(true)
  reviewedContentClone.querySelector('.segment-content-badges').remove()
  assert.equal(reviewedContentClone.textContent, 'Исправленный исходник')
  assert.equal(reviewedContent.querySelector('.segment-content-badges').contentEditable, 'false')
  assert.equal(reviewedWorkflowRow.querySelector('.segment-row-note').textContent.trim(), 'Проверьте имя по оригиналу.')
  assert.doesNotMatch(reviewedWorkflowRow.querySelector('.segment-row-note').textContent, /Автокоррекция макета/)
  assert.equal(dom.window.document.querySelector('[data-object-id="workflow-object-2"] .segment-translation-row__meta').hidden, true)
  assert.ok(dom.window.document.querySelector('.document-review-layout'))
  assert.ok(dom.window.document.querySelector('.document-review-preview'))
  const documentReviewViewport = dom.window.document.querySelector('.document-review-preview__viewport')
  assert.ok(documentReviewViewport)
  assert.equal(dom.window.document.querySelectorAll('.document-review-controls').length, 1)
  assert.equal(dom.window.document.querySelectorAll('.document-review-controls .icon-button').length, 3)
  assert.equal(dom.window.document.querySelector('.document-review-controls output').value, '100%')
  const documentReviewPage = dom.window.document.querySelector('.document-review-preview__page')
  assert.equal(documentReviewPage.style.aspectRatio, '794 / 1000')
  assert.equal(documentReviewPage.querySelector('img').style.height, '100%')
  dom.window.document.querySelector('.document-review-controls [aria-label="Увеличить оригинал"]').click()
  assert.ok(Math.abs(Number.parseFloat(documentReviewPage.style.width) - 873.4) < .001)
  assert.equal(dom.window.document.querySelector('.document-review-segments').style.transform, '')
  documentReviewViewport.scrollLeft = 100
  documentReviewViewport.scrollTop = 120
  documentReviewViewport.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 200, clientY: 200 }))
  assert.equal(documentReviewViewport.classList.contains('is-panning'), true)
  documentReviewViewport.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 150, clientY: 140 }))
  assert.equal(documentReviewViewport.scrollLeft, 150)
  assert.equal(documentReviewViewport.scrollTop, 180)
  documentReviewViewport.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }))
  assert.equal(documentReviewViewport.classList.contains('is-panning'), false)
  assert.ok(dom.window.document.querySelector('.document-review-magnifier'))
  assert.ok(dom.window.document.querySelector('.document-review-magnifier__scene img'))
  assert.equal(dom.window.document.querySelector('.document-review-overlay'), null)
  assert.equal(dom.window.document.querySelectorAll('.document-review-pin').length, 2)
  assert.equal(dom.window.document.querySelectorAll('.document-review-segment').length, 2)
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.document-review-segment')].map(node => node.dataset.objectId),
    ['workflow-object-2', 'workflow-object'],
  )
  assert.equal(dom.window.document.querySelector('.document-review-pin').dataset.reviewObjectId, 'workflow-object-2')
  assert.equal(
    dom.window.document.querySelector('.document-review-pin').style.getPropertyValue('--segment-review-color'),
    dom.window.document.querySelector('.document-review-segment').style.getPropertyValue('--segment-review-color'),
  )
  assert.equal(dom.window.document.querySelector('.document-review-pin span').textContent, '1')
  assert.match(dom.window.document.querySelector('.document-review-pin use').getAttribute('href'), /icon-map-pin$/)
  const sourceRegionPin = dom.window.document.querySelector('.document-review-pin[data-review-object-id="workflow-object"]')
  assert.ok(Math.abs(Number.parseFloat(sourceRegionPin.style.left) - 30) < .001)
  assert.ok(Math.abs(Number.parseFloat(sourceRegionPin.style.top) - 25) < .001)
  assert.equal(sourceRegionPin.querySelector('span').textContent, '2')
  const firstReviewNumber = dom.window.document.querySelector('.document-review-segment__number')
  assert.equal(firstReviewNumber.textContent, '1')
  assert.equal(firstReviewNumber.parentElement.className, 'segment-content-badges__status')
  assert.equal(firstReviewNumber.previousElementSibling.classList.contains('segment-content-badge--confidence'), true)
  const firstReviewSegment = dom.window.document.querySelector('.document-review-segment')
  const firstReviewPin = dom.window.document.querySelector('.document-review-pin')
  firstReviewSegment.dispatchEvent(new dom.window.MouseEvent('pointerenter'))
  assert.equal(firstReviewPin.classList.contains('is-review-highlighted'), true)
  firstReviewSegment.dispatchEvent(new dom.window.MouseEvent('pointerleave'))
  assert.equal(firstReviewPin.classList.contains('is-review-highlighted'), false)
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').hidden, true)
  assert.equal(dom.window.document.querySelector('.workbench-toolbar__layout-controls').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-document-review-panel'), null)
  assert.match(styles, /\.studio\[data-workflow-stage="1"\]\s*\{[^}]*--inspector-width:\s*0px/)
  assert.match(styles, /\.studio\[data-workflow-stage="1"\] \.document-canvas\s*\{[^}]*padding:\s*0[^}]*border:\s*0[^}]*outline:\s*0[^}]*box-shadow:\s*none/)
  assert.match(styles, /\.studio\[data-workflow-stage="1"\] \.studio-page--segments\s*\{[^}]*padding:\s*var\(--app-gutter, 12px\)[^}]*border:\s*0[^}]*outline:\s*0[^}]*box-shadow:\s*none/)
  assert.match(styles, /\.studio-page--segments\s*\{[^}]*position:\s*relative[^}]*overflow:\s*visible/)
  assert.match(client, /Math\.max\(120, surface\.scrollHeight \|\| 0, surface\.offsetHeight \|\| 0\)/)
  assert.match(styles, /\.document-review-pin\s*\{[^}]*width:\s*18px[^}]*height:\s*23px/)
  assert.match(styles, /\.document-review-pin\.is-review-highlighted[^}]*--review-marker-scale:\s*1\.35/)
  assert.match(styles, /\.document-review-pin::before\s*\{[^}]*border:\s*1px solid var\(--segment-review-color\)/)
  assert.match(styles, /\.document-review-pin\.is-review-highlighted::before[^}]*opacity:\s*1/)
  assert.match(styles, /\.document-review-segments\s*\{[^}]*width:\s*min\(35%, 540px\)/)
  assert.match(styles, /\.document-review-segments\s*\{[^}]*flex:\s*0 0 min\(35%, 540px\)/)
  assert.match(styles, /\.document-review-layout\s*\{[^}]*max-width:\s*100%[^}]*gap:\s*var\(--app-gutter, 12px\)/)
  assert.doesNotMatch(styles, /\.document-review-layout\s*\{[^}]*overflow:\s*(?:hidden|auto|scroll)/)
  assert.match(styles, /\.document-review-preview\s*\{[^}]*height:\s*calc\(100vh - 130px\)/)
  assert.match(styles, /\.document-review-preview\s*\{[^}]*width:\s*0[^}]*overflow:\s*hidden[^}]*contain:\s*inline-size paint/)
  assert.match(styles, /\.document-review-preview\s*\{[^}]*flex:\s*1 1 0/)
  assert.match(styles, /body\.has-document-tabs \.document-review-preview\s*\{[^}]*height:\s*calc\(100vh - 140px\)/)
  assert.match(styles, /\.document-review-preview:has\(\.document-review-magnifier\)\s*\{[^}]*grid-template-rows:\s*minmax\(152px, 1fr\) minmax\(0, 240px\)/)
  assert.match(styles, /\.document-review-preview__canvas\s*\{[^}]*max-width:\s*100%[^}]*min-height:\s*0[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto[^}]*overflow:\s*hidden/)
  assert.match(styles, /\.document-review-preview__viewport\s*\{[^}]*overflow:\s*auto[^}]*background:\s*transparent/)
  assert.match(styles, /\.document-review-preview__viewport\s*\{[^}]*contain:\s*layout paint[^}]*cursor:\s*grab/)
  assert.match(styles, /\.document-review-preview__viewport\.is-panning\s*\{[^}]*cursor:\s*grabbing/)
  assert.match(styles, /\.document-review-preview__page\s*\{[^}]*border:\s*0/)
  assert.match(styles, /\.document-review-preview\s*\{[^}]*position:\s*sticky[^}]*top:\s*12px/)
  assert.match(styles, /\.document-review-magnifier\s*\{[^}]*position:\s*relative[^}]*height:\s*100%/)
  assert.match(styles, /\.document-review-controls\s*\{[^}]*position:\s*static[^}]*flex-direction:\s*column[^}]*flex-wrap:\s*nowrap[^}]*box-shadow:\s*none/)
  assert.match(styles, /\.document-review-controls button\s*\{[^}]*width:\s*100%/)
  assert.doesNotMatch(client, /function refreshDocumentReviewSticky\(\)/)
  assert.match(client, /function documentSourceOrder\(objects\)/)
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel').hidden, true)

  let exclusionAction = dom.window.document.querySelector('[data-object-id="workflow-object"] .document-review-segment__action')
  assert.equal(exclusionAction.textContent, '')
  assert.equal(exclusionAction.getAttribute('aria-label'), 'Исключить сегмент')
  assert.equal(exclusionAction.previousElementSibling.classList.contains('document-review-segment__number'), true)
  const editableReviewContent = exclusionAction.closest('.scene-object__content')
  editableReviewContent.focus()
  const exclusionPointerDown = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })
  assert.equal(exclusionAction.dispatchEvent(exclusionPointerDown), false)
  assert.equal(exclusionPointerDown.defaultPrevented, true)
  assert.equal(dom.window.document.activeElement, editableReviewContent)
  exclusionAction.click()
  assert.equal(dom.window.document.querySelector('#confirmation-modal').hidden, false)
  assert.equal(scene.objects.find(object => object.id === 'workflow-object').excluded, false)
  dom.window.document.querySelector('#confirmation-cancel').click()
  assert.equal(dom.window.document.querySelector('#confirmation-modal').hidden, true)
  exclusionAction.click()
  dom.window.document.querySelector('#confirmation-submit').click()
  await new Promise(resolve => setTimeout(resolve, 0))
  let excludedRow = dom.window.document.querySelector('[data-object-id="workflow-object"]')
  assert.equal(scene.objects.find(object => object.id === 'workflow-object').excluded, true)
  assert.equal(excludedRow.classList.contains('is-excluded'), true)
  assert.equal(excludedRow.querySelector('.scene-object__content').contentEditable, 'false')
  assert.equal(excludedRow.querySelector('.document-review-segment__action').getAttribute('aria-label'), 'Восстановить сегмент')
  assert.match(excludedRow.querySelector('.document-review-segment__action use').getAttribute('href'), /icon-refresh$/)
  assert.equal(dom.window.document.querySelector('.document-review-pin[data-review-object-id="workflow-object"]').disabled, true)
  excludedRow.querySelector('.document-review-segment__action').click()
  dom.window.document.querySelector('#confirmation-cancel').click()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(scene.objects.find(object => object.id === 'workflow-object').excluded, true)
  dom.window.document.querySelector('[data-object-id="workflow-object"] .document-review-segment__action').click()
  dom.window.document.querySelector('#confirmation-submit').click()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(scene.objects.find(object => object.id === 'workflow-object').excluded, false)
  assert.equal(dom.window.document.querySelector('[data-object-id="workflow-object"] .scene-object__content').contentEditable, 'true')

  approve.click()
  assert.equal(studio.dataset.workflowStage, '1')
  assert.equal(dom.window.document.querySelector('#translation-approval-modal').hidden, false)
  assert.equal(dom.window.document.querySelector('#translation-approval-title').textContent, 'Отправить документ на перевод?')
  assert.ok(dom.window.document.querySelector('#translation-approval-content > .global-translation-tools'))
  assert.equal(dom.window.document.querySelector('#translation-approval-content .inspector-section__title'), null)
  assert.ok(dom.window.document.querySelector('#translation-approval-content #source-language'))
  assert.ok(dom.window.document.querySelector('#translation-approval-content #target-language'))
  assert.ok(dom.window.document.querySelector('#translation-approval-content #knowledge-base-mode'))
  assert.ok(dom.window.document.querySelector('#translation-approval-content #translation-global-instruction'))
  assert.ok(dom.window.document.querySelector('#translation-approval-content #instruction-preset-select'))
  assert.match(styles, /\.translation-approval-dialog \.global-translation-actions\s*\{[^}]*display:\s*none/)
  dom.window.document.querySelector('#translation-approval-cancel').click()
  assert.equal(dom.window.document.querySelector('#translation-approval-modal').hidden, true)
  assert.ok(dom.window.document.querySelector('#inspector-global-translation-panel .global-translation-tools'))

  translationShouldFail = true
  approve.click()
  dom.window.document.querySelector('#translation-approval-submit').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(studio.dataset.workflowStage, '1')
  assert.equal(dom.window.document.querySelector('#translation-approval-modal').hidden, true)
  assert.equal(dom.window.document.querySelector('#loading-view').hidden, true)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel').hidden, true)
  assert.ok(dom.window.document.querySelector('#inspector-global-translation-panel .global-translation-tools'))
  assert.equal(dom.window.document.querySelector('#translation-approval-submit').disabled, false)

  translationShouldFail = false
  delayTranslation = true
  approve.click()
  dom.window.document.querySelector('#translation-approval-submit').click()
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(studio.dataset.workflowStage, '1')
  assert.equal(dom.window.document.querySelector('#translation-approval-modal').hidden, true)
  assert.equal(dom.window.document.querySelector('#loading-view').hidden, false)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, true)
  assert.equal(dom.window.document.querySelector('#loading-title').textContent, 'Переводим документ')
  assert.equal(dom.window.document.querySelector('#loading-progress-label').textContent, 'Выполняется')
  assert.equal(dom.window.document.querySelector('#loading-progress-details').textContent, 'Сегментов: 2')
  assert.equal(dom.window.document.querySelector('#loading-hint').textContent, 'Перевод большого документа может занять несколько минут.')
  assert.equal(dom.window.document.querySelector('#loading-view').classList.contains('is-indeterminate'), true)
  assert.match(styles, /\.loading-view\.is-indeterminate \.job-progress span\s*\{[^}]*animation:\s*loading-progress-indeterminate/)
  assert.equal(typeof releaseTranslation, 'function')
  releaseTranslation()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(translationRequests.at(-1).objectIds, ['workflow-object', 'workflow-object-2'])
  assert.equal(translationRequests.at(-1).forceRetranslate, false)

  assert.equal(studio.dataset.workflowStage, '2')
  assert.equal(dom.window.document.querySelector('#loading-view').hidden, true)
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)
  assert.equal(studio.classList.contains('is-segments-mode'), true)
  assert.equal(dom.window.document.querySelector('.studio-page-shell').style.height, '640px')
  assert.equal(dom.window.document.querySelector('.scene-object--translation .scene-object__content').contentEditable, 'true')
  assert.equal(dom.window.document.querySelector('.scene-object--source .scene-object__content').contentEditable, 'false')
  assert.equal(dom.window.document.querySelector('.scene-object--source .scene-object__content').getAttribute('aria-readonly'), 'true')
  assert.equal(dom.window.document.querySelectorAll('.segment-content-badge--type').length, 2)
  assert.equal(dom.window.document.querySelectorAll('.segment-content-badge--confidence').length, 2)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel .memory-card') !== null, true)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel .segment-content-fields'), null)
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel').hidden, false)
  assert.equal(dom.window.document.querySelector('#undo-button').disabled, true)

  const stageTwoTranslation = dom.window.document.querySelector('.scene-object--translation .scene-object__content')
  stageTwoTranslation.focus()
  stageTwoTranslation.textContent = 'Ручная правка'
  stageTwoTranslation.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  assert.equal(dom.window.document.querySelector('#undo-button').disabled, false)

  approve.click()
  assert.equal(studio.dataset.workflowStage, '3')
  assert.equal(dom.window.document.querySelector('#undo-button').disabled, true)
  dom.window.document.querySelector('#undo-button').click()
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))
  assert.equal(studio.dataset.workflowStage, '3')
  assert.equal(studio.classList.contains('is-segments-mode'), false)
  assert.equal(dom.window.document.querySelectorAll('.studio-page .scene-object').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-geometry-locked'), false)
  assert.equal(dom.window.document.querySelector('#inspector-layout-panel').hidden, false)
  assert.equal(dom.window.document.querySelector('#inspector-layout-panel').getAttribute('aria-label'), 'Типографика и расстановка')

  approve.click()
  assert.equal(studio.dataset.workflowStage, '4')
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-geometry-locked'), true)
  assert.equal(dom.window.document.querySelector('#inspector-testing-panel').hidden, false)
  assert.equal(dom.window.document.querySelector('#export-docx-button').disabled, false)
  assert.equal(dom.window.document.querySelector('#export-pdf-button').disabled, false)
  assert.equal(approve.disabled, true)
  assert.equal(approve.getAttribute('aria-label'), 'Готово к выгрузке')

  dom.window.document.querySelector('#workflow-previous').click()
  assert.equal(studio.dataset.workflowStage, '3')
  assert.equal(dom.window.document.querySelector('#export-docx-button').disabled, true)
  dom.window.document.querySelector('#workflow-previous').click()
  assert.equal(studio.dataset.workflowStage, '2')
  dom.window.document.querySelector('#workflow-previous').click()
  assert.equal(studio.dataset.workflowStage, '1')

  const completedRequestCount = translationRequests.length
  approve.click()
  assert.equal(dom.window.document.querySelector('#translation-approval-status').hidden, false)
  assert.match(dom.window.document.querySelector('#translation-approval-status').textContent, /уже переведён/)
  assert.equal(dom.window.document.querySelector('#translation-approval-continue').hidden, false)
  assert.equal(dom.window.document.querySelector('#translation-approval-submit').hidden, true)
  assert.equal(dom.window.document.querySelector('#translation-approval-retranslate-all').hidden, false)
  const approvalInstruction = dom.window.document.querySelector('#translation-global-instruction')
  approvalInstruction.value = 'Новая общая инструкция'
  approvalInstruction.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(dom.window.document.querySelector('#translation-approval-continue').hidden, true)
  assert.equal(dom.window.document.querySelector('#translation-approval-retranslate-all').hidden, true)
  assert.equal(dom.window.document.querySelector('#translation-approval-submit').hidden, false)
  assert.equal(dom.window.document.querySelector('#translation-approval-submit').textContent, 'Перевести заново весь документ')
  approvalInstruction.value = ''
  approvalInstruction.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(dom.window.document.querySelector('#translation-approval-continue').hidden, false)
  const translationsBeforeContinue = scene.objects.map(object => object.translation)
  dom.window.document.querySelector('#translation-approval-continue').click()
  assert.equal(studio.dataset.workflowStage, '2')
  assert.equal(translationRequests.length, completedRequestCount)
  assert.deepEqual(scene.objects.map(object => object.translation), translationsBeforeContinue)

  dom.window.document.querySelector('#workflow-previous').click()
  const changedSource = dom.window.document.querySelector('[data-object-id="workflow-object-2"] .scene-object__content')
  for (const child of [...changedSource.childNodes]) {
    if (!child.dataset?.editorChrome) child.remove()
  }
  changedSource.append(dom.window.document.createTextNode('Изменённый второй исходник'))
  changedSource.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  approve.click()
  delayTranslation = false
  dom.window.document.querySelector('#translation-approval-submit').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, completedRequestCount + 1)
  assert.deepEqual(translationRequests.at(-1).objectIds, ['workflow-object-2'])
  assert.equal(translationRequests.at(-1).forceRetranslate, false)
  assert.equal(studio.dataset.workflowStage, '2')

  dom.window.document.querySelector('#workflow-previous').click()
  approve.click()
  dom.window.document.querySelector('#translation-approval-retranslate-all').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(translationRequests.length, completedRequestCount + 2)
  assert.deepEqual(translationRequests.at(-1).objectIds, ['workflow-object', 'workflow-object-2'])
  assert.equal(translationRequests.at(-1).forceRetranslate, true)
  dom.window.close()
})

test('segment stage keeps the source read-only and provides document and local AI chats', async () => {
  const id = '6'.repeat(32)
  const makeObject = (objectId, type, sourceText, readingOrder) => ({
    id: objectId, pageIndex: 0, type, readingOrder, sourceText, translation: sourceText, confidence: .87,
    agentNotes: readingOrder === 1 ? 'Проверьте текст по оригиналу.' : '',
    x: 40, y: 40 + readingOrder * 60, width: 220, height: 40, rotation: 0, excluded: false,
    style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
    sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 40 + readingOrder * 60, width: 220, height: 40 },
  })
  const scene = {
    title: 'Every segment', sourceLanguage: 'en', targetLanguage: 'ru', workflowVersion: 2, workflowStage: 2,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [makeObject('text-object', 'text', 'Text', 1), { ...makeObject('logo-object', 'logo', 'Brand', 2), translation: '' }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  const revisionRequests = []
  dom.window.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/translate/revise') && options.method === 'POST') {
      const request = JSON.parse(options.body)
      revisionRequests.push(request)
      scene.batchRevisionInstruction = ''
      scene.batchRevisionChat = [
        { role: 'user', text: request.revisionInstruction },
        { role: 'assistant', text: 'Маркировка удалена.' },
      ]
      return { ok: true, json: async () => ({ scene, revised: [{ objectId: 'logo-object' }], excluded: [], assistantMessage: 'Маркировка удалена.', message: 'Сегменты исправлены' }) }
    }
    return {
      ok: true,
      json: async () => String(url).endsWith('/status')
        ? { translationProviderConfigured: false, translationModel: null }
        : { metadata: { id, revision: 1 }, scene },
    }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  const rows = [...dom.window.document.querySelectorAll('.segment-translation-row')]
  const batchInstruction = dom.window.document.querySelector('#segment-batch-ai-instruction')
  const batchApply = dom.window.document.querySelector('#segment-batch-ai-apply')
  assert.equal(rows.length, 2)
  assert.equal(dom.window.document.querySelector('#segment-batch-ai-scope'), null)
  assert.equal(dom.window.document.querySelectorAll('[data-translation-select]').length, 0)
  rows[0].querySelector('.scene-object--source').dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  rows[1].querySelector('.scene-object--source').dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: true }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object--source.is-selected').length, 1)
  assert.equal(dom.window.document.querySelector('.scene-object--source.is-primary-selected').dataset.id, 'logo-object')
  batchInstruction.value = 'Убрать маркировку списка'
  batchInstruction.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(batchApply.disabled, false)
  assert.equal(dom.window.document.querySelector('.scene-object--source .scene-object__content').contentEditable, 'false')
  const translationEditors = [...dom.window.document.querySelectorAll('.scene-object--translation .scene-object__content')]
  assert.ok(translationEditors.every(editor => editor.contentEditable === 'true'))
  const emptyTranslationEditor = rows[1].querySelector('.scene-object--translation .scene-object__content')
  assert.equal(emptyTranslationEditor.getAttribute('aria-disabled'), 'false')
  emptyTranslationEditor.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
  emptyTranslationEditor.append(dom.window.document.createTextNode('Любой ручной перевод'))
  emptyTranslationEditor.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  assert.equal(scene.objects.find(object => object.id === 'logo-object').translation, 'Любой ручной перевод')
  assert.equal(dom.window.document.querySelectorAll('.segment-content-badge--type').length, 2)
  assert.equal(dom.window.document.querySelectorAll('.segment-content-badge--confidence').length, 2)
  assert.equal(rows[0].querySelector('.segment-row-note').parentElement.className, 'segment-translation-row__meta')
  assert.match(styles, /\.segment-translation-row__meta\s*\{[^}]*grid-column:\s*1 \/ -1/)
  assert.equal(rows[1].querySelector('.segment-translation-row__meta').hidden, true)
  assert.ok(rows[1].querySelector('.segment-ai-chat'), 'a logo must expose its local AI chat')
  assert.ok(rows[1].querySelector('[data-instruction-preset-select]'), 'saved instructions remain available in the segment chat')
  const localPresetApply = rows[1].querySelector('[data-instruction-preset-apply]')
  const localPresetSave = rows[1].querySelector('[aria-label="Сохранить инструкцию в список инструкций"]')
  assert.ok(localPresetApply.matches('.icon-button.icon-button--compact.icon-button--ghost'))
  assert.equal(localPresetApply.querySelector('use').getAttribute('href'), '/icons.svg#icon-plus')
  assert.ok(localPresetSave.matches('.icon-button.icon-button--compact.icon-button--ghost'))
  assert.equal(localPresetSave.querySelector('use').getAttribute('href'), '/icons.svg#icon-save')
  assert.equal(localPresetSave.disabled, true)
  const localChatInput = rows[1].querySelector('.ai-chat__composer textarea')
  localChatInput.value = 'Сохранить название бренда'
  localChatInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(localPresetSave.disabled, false)
  assert.match(styles, /\.studio-page--segments \.scene-object__content[^}]*text-align:\s*left !important/)
  batchApply.click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(revisionRequests[0], {
    objectIds: [], scope: 'document', revisionInstruction: 'Убрать маркировку списка', chatTarget: { kind: 'batch' },
  })
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('#segment-batch-ai-messages .ai-chat__author')].map(node => node.textContent),
    ['Вы', 'AI-агент'],
  )
  assert.ok(dom.window.document.querySelector('#inspector-translation-panel .memory-card'))
  assert.ok(dom.window.document.querySelector('#inspector-translation-panel .segment-batch-ai-card'))
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel .segment-content-fields'), null)
  dom.window.close()
})

test('segment exclusion applies to the current scene after an editor refresh race', async () => {
  const id = '9'.repeat(32)
  const style = { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' }
  const scene = {
    title: 'Exclusion race', sourceLanguage: 'en', targetLanguage: 'ru', workflowStage: 1,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1000 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'race-target', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Target', translation: '', confidence: .98,
      x: 40, y: 60, width: 200, height: 32, rotation: 0, excluded: false,
      style: { ...style }, sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 60, width: 200, height: 32 },
    }, {
      id: 'race-editor', pageIndex: 0, type: 'text', readingOrder: 2,
      sourceText: 'Editor', translation: '', confidence: .98,
      x: 40, y: 110, width: 200, height: 32, rotation: 0, excluded: false,
      style: { ...style }, sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 110, width: 200, height: 32 },
    }],
  }
  let refreshRequests = 0
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.includes('/knowledge-matches/refresh')) {
      refreshRequests += 1
      return { ok: true, json: async () => ({ metadata: { id, revision: 3 }, scene: JSON.parse(JSON.stringify(scene)), matchCount: 0 }) }
    }
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (options.method === 'PUT') return { ok: true, json: async () => ({ metadata: { id, revision: 2 } }) }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  const editor = dom.window.document.querySelector('[data-object-id="race-editor"] .scene-object__content')
  editor.focus()
  const action = dom.window.document.querySelector('[data-object-id="race-target"] .document-review-segment__action')
  action.click()
  assert.equal(dom.window.document.querySelector('#confirmation-modal').hidden, false)
  editor.dispatchEvent(new dom.window.FocusEvent('blur'))
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(refreshRequests, 1)
  dom.window.document.querySelector('#confirmation-submit').click()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(
    dom.window.document.querySelector('[data-object-id="race-target"] .document-review-segment__action').getAttribute('aria-label'),
    'Восстановить сегмент',
  )
  dom.window.close()
})

test('layout initialization inserts continuation pages, preserves source links and survives stage navigation', async () => {
  const id = '6'.repeat(32)
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error))
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`, virtualConsole })
  const scene = {
    title: 'Pagination', sourceLanguage: 'en', targetLanguage: 'ru', workflowVersion: 2, workflowStage: 2, layoutInitializationVersion: 0,
    pages: [0, 1].map(index => ({ index, sourcePageIndex: index, widthPx: 794, heightPx: 1123, imageUrl: `/api/studio/documents/${id}/pages/${index}/image`, contentBounds: { x: 40, y: 40, width: 680, height: 1020 } })),
    objects: [
      { id: 'bottom', pageIndex: 0, x: 40, y: 970, width: 200, height: 20, translation: 'Перевод текста '.repeat(80) },
      { id: 'following', pageIndex: 0, x: 40, y: 1010, width: 200, height: 20, translation: 'Следующий блок' },
      { id: 'center', pageIndex: 1, x: 120, y: 80, width: 300, height: 20, translation: 'Заголовок' },
    ].map((object, index) => ({ ...object, readingOrder: index + 1, type: 'text', sourceText: 'Source', confidence: .98, rotation: 0, excluded: false,
      manualWidth: false, manualHeight: false, manualPosition: false,
      originalBounds: { x: object.x, y: object.y, width: object.width, height: object.height },
      style: { fontFamily: 'Times New Roman', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: object.id === 'center' ? 'center' : 'left', lineHeight: 1.2, color: '#000000' },
      sourceTextStyles: [], translationTextStyles: [],
    })),
  }
  dom.window.CSS = { escape: value => String(value) }
  let savedScene = null
  dom.window.fetch = async (url, options = {}) => {
    if (options.method === 'PUT') savedScene = JSON.parse(options.body)
    return { ok: true, json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false } : { metadata: { id, revision: 1 }, scene } }
  }
  dom.window.eval(translationUnits)
  dom.window.eval(layoutModelClient)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 40))
  dom.window.document.querySelector('#workflow-approve').click()
  await new Promise(resolve => setTimeout(resolve, 720))
  assert.equal(savedScene.layoutInitializationVersion, 2)
  assert.equal(savedScene.pages.length, 3)
  assert.equal(savedScene.pages[1].layoutContinuation, true)
  assert.equal(savedScene.pages[1].imageUrl, null)
  assert.equal(savedScene.pages[2].sourcePageIndex, 1)
  const thumbnails = [...dom.window.document.querySelectorAll('#page-thumbnails .page-thumbnail')]
  assert.equal(thumbnails.length, 2)
  assert.deepEqual(thumbnails.map(node => node.querySelector('span').textContent), ['1', '2'])
  assert.equal(dom.window.document.querySelector('#page-thumbnails .page-thumbnail__blank'), null)
  const bottom = savedScene.objects.find(object => object.id === 'bottom')
  const following = savedScene.objects.find(object => object.id === 'following')
  const centered = savedScene.objects.find(object => object.id === 'center')
  assert.equal(bottom.pageIndex, 1)
  assert.equal(bottom.layoutSourcePageIndex, 0)
  assert.equal(following.pageIndex, 1)
  assert.ok(following.y >= bottom.y + bottom.height)
  assert.equal(centered.x + centered.width / 2, 270)
  assert.ok(centered.width < 300)
  const before = savedScene.objects.map(({ x, y, width, height, pageIndex }) => ({ x, y, width, height, pageIndex }))
  dom.window.document.querySelector('#workflow-previous').click()
  dom.window.document.querySelector('#workflow-approve').click()
  await new Promise(resolve => setTimeout(resolve, 720))
  assert.equal(savedScene.pages.length, 3)
  assert.deepEqual(savedScene.objects.map(({ x, y, width, height, pageIndex }) => ({ x, y, width, height, pageIndex })), before)
  dom.window.document.querySelector('#workflow-previous').click()
  dom.window.document.querySelector('#workflow-previous').click()
  assert.equal(dom.window.document.querySelectorAll('.document-review-layout').length, 2)
  assert.equal(dom.window.document.querySelectorAll('.document-review-layout')[0].querySelectorAll('.segment-translation-row').length, 2)
  assert.equal(errors.length, 0)
  dom.window.close()
})

test('studio restores a saved scene and renders editable page objects', async () => {
  const errors = []
  const virtualConsole = new VirtualConsole()
  virtualConsole.on('jsdomError', error => errors.push(error))
  const id = '1'.repeat(32)
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: `http://127.0.0.1:3100/?document=${id}`,
    virtualConsole,
  })
  const scene = {
    title: 'Fixture', sourceLanguage: 'en', targetLanguage: 'ru', workflowStage: 4,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'object-1', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Source', translation: 'Перевод', confidence: .98,
      x: 40, y: 60, width: 200, height: 32, rotation: 0, excluded: false,
      manualWidth: false, manualHeight: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [],
      originalBounds: { x: 40, y: 60, width: 200, height: 32 },
    }],
  }
  dom.window.fetch = async url => ({
    ok: true,
    json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false, translationModel: null }
      : { metadata: { id, revision: 1 }, scene },
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.Element.prototype.setPointerCapture = function setPointerCapture(pointerId) { this.__pointerId = pointerId }
  dom.window.Element.prototype.hasPointerCapture = function hasPointerCapture(pointerId) { return this.__pointerId === pointerId }
  dom.window.Element.prototype.releasePointerCapture = function releasePointerCapture(pointerId) {
    if (this.__pointerId === pointerId) this.__pointerId = null
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  assert.equal(dom.window.document.querySelector('#studio-view').hidden, false)
  assert.equal(dom.window.document.querySelectorAll('.studio-page').length, 1)
  assert.equal(dom.window.document.querySelector('#view-layout-button'), null)
  assert.equal(dom.window.document.querySelector('#view-segments-button'), null)
  assert.equal(dom.window.document.querySelectorAll('.studio-page .scene-object').length, 1)
  assert.equal(dom.window.document.querySelector('.scene-object__content').textContent, 'Перевод')
  assert.equal(dom.window.document.querySelectorAll('.inspector-section').length, 4)
  assert.equal(dom.window.document.querySelector('.inspector-section__title'), null)
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.inspector-section')].map(node => node.getAttribute('aria-label')),
    ['Перевод', 'Сегменты', 'Типографика и расстановка', 'Выгрузка'],
  )
  assert.ok(dom.window.document.querySelector('#inspector-global-translation-panel .global-translation-tools'))
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel .agent-card'), null)
  assert.ok(dom.window.document.querySelector('#inspector-global-translation-panel #agent-status').classList.contains('visually-hidden'))
  assert.ok(dom.window.document.querySelector('#inspector-testing-panel #final-testing-tools'))
  assert.ok(dom.window.document.querySelector('#inspector-testing-panel #reanalyze-button'))
  assert.equal(dom.window.document.querySelector('#layout-review-button'), null)
  assert.equal(dom.window.document.querySelector('#inspector-testing-panel #qa-button'), null)
  assert.ok(dom.window.document.querySelector('#inspector-layout-panel .layout-qa-actions #qa-button'))
  assert.equal(dom.window.document.querySelector('#inspector-layout-panel [data-layout-selection-note]'), null)
  assert.doesNotMatch(dom.window.document.querySelector('#inspector-layout-panel').textContent, /Выберите сегмент для работы с ним/)
  assert.ok(dom.window.document.querySelector('#inspector-layout-panel .inspector-section__content').lastElementChild.classList.contains('layout-qa-actions'))
  assert.equal(dom.window.document.querySelector('#inspector-testing-panel .final-testing-actions').lastElementChild.id, 'reanalyze-button')
  assert.match(styles, /\.final-testing-actions\s*\{[^}]*margin-top:\s*auto[^}]*border-top:\s*1px solid var\(--line\)/)
  assert.match(styles, /#inspector-testing-panel\s*\{[^}]*height:\s*100%[^}]*grid-template-rows:\s*minmax\(0, 1fr\)/)
  assert.match(styles, /\.final-testing-tools\s*\{[^}]*height:\s*100%[^}]*display:\s*flex[^}]*flex-direction:\s*column/)
  assert.equal(dom.window.document.querySelector('#object-inspector').hidden, false)
  assert.equal(dom.window.document.querySelector('#object-inspector').hasAttribute('inert'), false)
  assert.equal(dom.window.document.querySelector('#empty-inspector'), null)
  assert.equal(dom.window.document.querySelector('.inspector-panel__body').firstElementChild.id, 'inspector-global-translation-panel')
  assert.equal(dom.window.document.querySelector('#inspector-panel-body').hasAttribute('inert'), false)
  assert.equal(dom.window.document.querySelector('#inspector-panel-body').getAttribute('aria-hidden'), 'false')
  assert.ok(dom.window.document.querySelector('#inspector-layout-panel .typography-card'))
  assert.ok(dom.window.document.querySelector('#inspector-layout-panel .segment-actions-card'))
  assert.ok(dom.window.document.querySelector('#inspector-layout-panel .flex-layout'))
  assert.ok(dom.window.document.querySelector('#inspector-translation-panel .memory-card'))
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel .segment-content-fields'), null)
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-layout-panel').hidden, false)
  assert.equal(dom.window.document.querySelector('#inspector-testing-panel').hidden, true)
  const layoutSelectionTools = dom.window.document.querySelector('#inspector-layout-panel [data-layout-selection-content]')
  assert.equal(layoutSelectionTools.hidden, false)
  assert.equal(layoutSelectionTools.getAttribute('aria-disabled'), 'true')
  assert.ok([...layoutSelectionTools.querySelectorAll('button, input, select, textarea')].every(control => control.disabled))
  assert.equal(dom.window.document.querySelector('#qa-button').disabled, false)
  assert.ok(dom.window.document.querySelector('#inspector-global-translation-panel #translate-button'))
  assert.equal(dom.window.document.querySelectorAll('[data-requires-selection]').length, 0)
  for (const panel of dom.window.document.querySelectorAll('[data-inspector-requires-selection]')) {
    assert.equal(panel.querySelector('[data-inspector-selection-note]').hidden, false)
    assert.equal(panel.querySelector('.inspector-section__content').hidden, true)
  }
  assert.equal(dom.window.document.querySelector('.studio-page').style.getPropertyValue('--grid-size'), '17px')
  assert.equal(dom.window.document.querySelector('.studio-page').style.getPropertyValue('--grid-size-middle'), '34px')
  assert.equal(dom.window.document.querySelector('.studio-page').style.getPropertyValue('--grid-size-outer'), '68px')
  const columnLabels = [...dom.window.document.querySelectorAll('.grid-coordinate-label--column')]
  const rowLabels = [...dom.window.document.querySelectorAll('.grid-coordinate-label--row')]
  assert.equal(columnLabels.length, 10)
  assert.equal(rowLabels.length, 15)
  assert.equal(columnLabels[0].textContent, 'A')
  assert.equal(columnLabels.at(-1).textContent, 'J')
  assert.equal(rowLabels[0].textContent, '1')
  const pointer = (type, x, y) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
    Object.defineProperty(event, 'pointerId', { value: 7 })
    return event
  }
  const contentBoundary = dom.window.document.querySelector('.content-boundary')
  const contentBoundaryResize = contentBoundary.querySelector('.content-boundary__resize')
  assert.equal(contentBoundary.style.width, '680px')
  assert.equal(contentBoundary.style.height, '1020px')
  assert.ok(columnLabels.every(label => label.style.width === '68px'))
  assert.ok(rowLabels.every(label => label.style.height === '68px'))
  assert.equal(Number.parseFloat(columnLabels.at(-1).style.left) + 68, 680)
  assert.equal(Number.parseFloat(rowLabels.at(-1).style.top) + 68, 1020)
  assert.equal(contentBoundaryResize.getAttribute('aria-label'), 'Изменить высоту рабочей области документа')
  contentBoundaryResize.dispatchEvent(pointer('pointerdown', 0, 900))
  dom.window.dispatchEvent(pointer('pointermove', 0, 650))
  dom.window.dispatchEvent(pointer('pointerup', 0, 650))
  assert.ok(Number.parseFloat(contentBoundary.style.height) < 1020)
  dom.window.document.querySelector('#undo-button').click()
  assert.equal(dom.window.document.querySelector('.content-boundary').style.height, '1020px')

  const sourceScroll = dom.window.document.querySelector('#source-preview-scroll')
  sourceScroll.scrollLeft = 160
  sourceScroll.scrollTop = 240
  dom.window.document.querySelector('.source-preview-page').dispatchEvent(pointer('pointerdown', 300, 300))
  assert.equal(sourceScroll.classList.contains('is-panning'), true)
  dom.window.dispatchEvent(pointer('pointermove', 250, 210))
  assert.equal(sourceScroll.scrollLeft, 210)
  assert.equal(sourceScroll.scrollTop, 330)
  dom.window.dispatchEvent(pointer('pointerup', 250, 210))
  assert.equal(sourceScroll.classList.contains('is-panning'), false)
  dom.window.document.querySelector('#source-zoom-100').click()
  assert.equal(dom.window.document.querySelector('#source-zoom-output').value, '100%')
  dom.window.document.querySelector('#zoom-in').click()
  dom.window.document.querySelector('#zoom-100').click()
  assert.equal(dom.window.document.querySelector('#zoom-output').value, '100%')

  const initialObject = dom.window.document.querySelector('[data-id="object-1"]')
  initialObject.dispatchEvent(pointer('pointerdown', 100, 100))
  assert.equal(dom.window.document.querySelector('#object-inspector').hidden, false)
  for (const panel of dom.window.document.querySelectorAll('[data-inspector-requires-selection]')) {
    assert.equal(panel.querySelector('[data-inspector-selection-note]').hidden, true)
    assert.equal(panel.querySelector('.inspector-section__content').hidden, false)
  }
  assert.equal(dom.window.document.querySelector('#inspector-panel-body').hasAttribute('inert'), false)
  assert.equal(dom.window.document.querySelector('#translate-button').textContent, 'Перевести документ')
  assert.match(
    dom.window.document.querySelector('#segment-grid-coordinates').textContent,
    /^Координаты: [A-Z]+\d+\.[1-4]\.[1-4]\(левый верхний угол\) - [A-Z]+\d+\.[1-4]\.[1-4]\(правый нижний угол\)$/,
  )
  assert.equal(dom.window.document.querySelector('#inspector-segment-workspace').childElementCount, 0)
  assert.equal(dom.window.document.querySelector('#inspector-layout-panel').hidden, false)
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-layout-panel').hidden, false)
  assert.equal(dom.window.document.querySelector('#source-text').value, 'Source')
  let leftEdgeObject = dom.window.document.querySelector('[data-id="object-1"]')
  assert.equal(leftEdgeObject.style.left, '40px')
  assert.equal(leftEdgeObject.classList.contains('has-inset-drag-handle'), false)

  let dragHandle = leftEdgeObject.querySelector('.scene-object__handle')
  dragHandle.dispatchEvent(pointer('pointerdown', 100, 100))
  dom.window.dispatchEvent(pointer('pointermove', 140, 100))
  assert.notEqual(dom.window.document.querySelector('[data-id="object-1"]').style.left, '40px')
  dom.window.dispatchEvent(pointer('pointercancel', 140, 100))
  leftEdgeObject = dom.window.document.querySelector('[data-id="object-1"]')
  assert.equal(leftEdgeObject.style.left, '40px')
  assert.equal(dragHandle.__pointerId, null)

  dragHandle = leftEdgeObject.querySelector('.scene-object__handle')
  dragHandle.dispatchEvent(pointer('pointerdown', 100, 100))
  dom.window.dispatchEvent(pointer('pointermove', 140, 100))
  const gridStep = 17
  const dragZoom = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10) / 100
  const unsnappedDragLeft = 40 + 40 / dragZoom
  const liveDragLeft = Number.parseFloat(dom.window.document.querySelector('[data-id="object-1"]').style.left)
  assert.equal(liveDragLeft, 40 + Math.round((unsnappedDragLeft - 40) / gridStep) * gridStep, 'drag snaps while the pointer moves')
  dom.window.dispatchEvent(pointer('pointerup', 140, 100))
  const expectedDragLeft = 40 + Math.round((unsnappedDragLeft - 40) / gridStep) * gridStep
  assert.equal(dom.window.document.querySelector('[data-id="object-1"]').style.left, `${expectedDragLeft}px`)
  assert.equal(dragHandle.__pointerId, null)

  const edgeHandle = dom.window.document.querySelector('[data-id="object-1"] .scene-object__handle')
  edgeHandle.dispatchEvent(pointer('pointerdown', 140, 100))
  dom.window.dispatchEvent(pointer('pointermove', 5000, 5000))
  dom.window.dispatchEvent(pointer('pointerup', 5000, 5000))
  const edgeObject = dom.window.document.querySelector('[data-id="object-1"]')
  const edgeLeft = Number.parseFloat(edgeObject.style.left)
  const edgeTop = Number.parseFloat(edgeObject.style.top)
  assert.ok(edgeLeft >= 40, 'page boundary can override the manual grid position without enlarging the box')
  assert.ok(edgeTop >= 40)
  assert.ok(edgeLeft + Number.parseFloat(edgeObject.style.width) <= 720)
  assert.ok(edgeTop + Number.parseFloat(edgeObject.style.height) <= 1060)
  dom.window.document.querySelector('#undo-button').click()

  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-source-collapsed'), true)
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').getAttribute('aria-label'), 'Показать оригинал')
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').classList.contains('is-active'), false)
  dom.window.document.querySelector('#source-panel-toggle').click()
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-source-collapsed'), false)
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').getAttribute('aria-label'), 'Скрыть оригинал')
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').classList.contains('is-active'), true)
  assert.match(dom.window.document.querySelector('#source-panel-toggle use').getAttribute('href'), /icon-layout$/)
  dom.window.document.querySelector('#source-panel-toggle').click()
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-source-collapsed'), true)
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').getAttribute('aria-label'), 'Показать оригинал')
  assert.equal(dom.window.document.querySelector('#source-panel-toggle').classList.contains('is-active'), false)

  dom.window.document.querySelector('#source-preview-open').click()
  assert.equal(dom.window.document.querySelector('#source-preview-lightbox').hidden, false)
  assert.match(dom.window.document.querySelector('#source-preview-lightbox-title').textContent, /Fixture · страница 1 из 1/)
  assert.equal(dom.window.document.querySelector('.source-preview-lightbox__page img').src, dom.window.document.querySelector('.source-preview-page img').src)
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(dom.window.document.querySelector('#source-preview-lightbox').hidden, true)

  assert.equal(dom.window.document.querySelector('#inspector-panel-toggle'), null)
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-inspector-collapsed'), false)
  assert.equal(dom.window.document.querySelector('#inspector-panel').getAttribute('aria-hidden'), null)
  assert.equal(dom.window.document.querySelector('#inspector-panel-body').hasAttribute('inert'), false)
  assert.equal(dom.window.document.querySelector('.inspector-panel__navigation'), null)

  const automaticWidth = Number.parseFloat(dom.window.document.querySelector('.scene-object').style.width)
  const automaticHeight = Number.parseFloat(dom.window.document.querySelector('.scene-object').style.height)
  assert.ok(automaticWidth < 200)
  assert.ok(automaticHeight <= 34)
  const resizeHandle = dom.window.document.querySelector('.scene-object__resize')
  resizeHandle.dispatchEvent(pointer('pointerdown', 0, 0))
  resizeHandle.dispatchEvent(pointer('pointermove', 20, 10))
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-resizing'), true)
  assert.equal(Number.parseFloat(dom.window.document.querySelector('.scene-object').style.width), automaticWidth + 20)
  assert.equal(Number.parseFloat(dom.window.document.querySelector('.scene-object').style.height), automaticHeight + 10)
  resizeHandle.dispatchEvent(pointer('pointerup', 20, 10))
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-resizing'), false)
  assert.equal(resizeHandle.style.width, '')
  const zoom = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10) / 100
  const firstWidthMinimum = automaticWidth + 20 / zoom
  const firstWidth = Number.parseFloat(dom.window.document.querySelector('.scene-object').style.width)
  assert.ok(firstWidth >= firstWidthMinimum)
  assert.ok(Math.abs(firstWidth / gridStep - Math.round(firstWidth / gridStep)) < 0.0001)
  resizeHandle.dispatchEvent(pointer('pointerdown', 20, 10))
  resizeHandle.dispatchEvent(pointer('pointermove', 30, 20))
  resizeHandle.dispatchEvent(pointer('pointerup', 30, 20))
  const secondWidthMinimum = firstWidth + 10 / zoom
  const secondWidth = Number.parseFloat(dom.window.document.querySelector('.scene-object').style.width)
  assert.ok(secondWidth >= secondWidthMinimum)
  assert.ok(Math.abs(secondWidth / gridStep - Math.round(secondWidth / gridStep)) < 0.0001)

  resizeHandle.dispatchEvent(pointer('pointerdown', 30, 20))
  resizeHandle.dispatchEvent(pointer('pointermove', 30, -1000))
  assert.equal(Number.parseFloat(dom.window.document.querySelector('.scene-object').style.height), 0)
  resizeHandle.dispatchEvent(pointer('pointerup', 30, -1000))
  const minimumRenderedHeight = Number.parseFloat(dom.window.document.querySelector('.scene-object').style.height)
  assert.ok(minimumRenderedHeight > 12, 'resize handle must preserve the minimum text height')

  const content = dom.window.document.querySelector('.scene-object__content')
  content.dispatchEvent(pointer('pointerdown', 0, 0))
  content.focus()
  const range = dom.window.document.createRange()
  range.setStart(content.firstChild, 0)
  range.setEnd(content.firstChild, 3)
  dom.window.getSelection().removeAllRanges()
  dom.window.getSelection().addRange(range)
  content.dispatchEvent(pointer('pointerup', 0, 0))
  const fontSizeIncrease = dom.window.document.querySelector('#toolbar-font-size-increase')
  const fontSizeDecrease = dom.window.document.querySelector('#toolbar-font-size-decrease')
  const widthBeforeFontStyle = Number.parseFloat(dom.window.document.querySelector('.scene-object').style.width)
  fontSizeIncrease.click()
  assert.equal(dom.window.document.querySelector('.scene-object__content span').style.fontSize, '15px')
  assert.equal(Number.parseFloat(dom.window.document.querySelector('.scene-object').style.width), widthBeforeFontStyle)

  dom.window.document.querySelector('#workflow-previous').click()
  assert.equal(dom.window.document.querySelector('#studio-view').dataset.workflowStage, '2')
  const styledContent = dom.window.document.querySelector('.scene-object--translation .scene-object__content')
  const styledText = styledContent.querySelector('span').firstChild
  const splitRange = dom.window.document.createRange()
  splitRange.setStart(styledText, 0)
  splitRange.setEnd(styledText, 2)
  dom.window.getSelection().removeAllRanges()
  dom.window.getSelection().addRange(splitRange)
  styledContent.dispatchEvent(pointer('pointerup', 0, 0))
  dom.window.document.querySelector('#split-button').click()
  dom.window.document.querySelector('#workflow-approve').click()
  assert.equal(dom.window.document.querySelector('#studio-view').dataset.workflowStage, '3')
  assert.equal(dom.window.document.querySelectorAll('.scene-object').length, 2)

  const previouslyFocusedObject = dom.window.document.querySelector('.scene-object.is-selected')
  const objectOutsideSelection = [...dom.window.document.querySelectorAll('.scene-object')].find(node => !node.classList.contains('is-selected'))
  objectOutsideSelection.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: true }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id, objectOutsideSelection.dataset.id)

  previouslyFocusedObject.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, metaKey: true }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id, previouslyFocusedObject.dataset.id)

  previouslyFocusedObject.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, metaKey: true }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 1)
  assert.equal(dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id, objectOutsideSelection.dataset.id)
  const focusedObjectId = dom.window.document.querySelector('.scene-object.is-selected').dataset.id
  const typographySelectAll = dom.window.document.querySelector('#typography-select-all')
  assert.equal(typographySelectAll.closest('.typography-selection-toolbar').nextElementSibling.classList.contains('layout-selection-tools'), true)
  typographySelectAll.click()
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 2)
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-primary-selected').length, 1)
  assert.equal(dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id, focusedObjectId)
  assert.equal(typographySelectAll.getAttribute('aria-pressed'), 'true')
  assert.equal(typographySelectAll.textContent, 'Снять выбор со всех')
  assert.equal(typographySelectAll.classList.contains('is-active'), true)

  typographySelectAll.click()
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 0)
  assert.equal(typographySelectAll.disabled, false)
  assert.equal(typographySelectAll.getAttribute('aria-pressed'), 'false')
  assert.equal(typographySelectAll.textContent, 'Выбрать все сегменты')
  dom.window.document.querySelector('.scene-object').dispatchEvent(pointer('pointerdown', 50, 50))
  typographySelectAll.click()
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 2)

  const geometryBeforeAreaStretch = [...dom.window.document.querySelectorAll('.scene-object')].map(node => ({
    left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height,
  }))
  dom.window.document.querySelector('#stretch-work-area-width-button').click()
  for (const node of dom.window.document.querySelectorAll('.scene-object')) {
    assert.equal(node.style.left, '40px')
    assert.equal(node.style.width, '680px')
  }
  const geometryAfterAreaStretch = [...dom.window.document.querySelectorAll('.scene-object')].map(node => ({
    left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height,
  }))
  dom.window.document.querySelector('[data-format="center"]').click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => ({ left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height })),
    geometryAfterAreaStretch,
    'text alignment must preserve an explicitly stretched segment geometry'
  )
  dom.window.document.querySelector('#undo-button').click()
  dom.window.document.querySelector('#undo-button').click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => ({ left: node.style.left, top: node.style.top, width: node.style.width, height: node.style.height })),
    geometryBeforeAreaStretch
  )
  dom.window.document.querySelector('#stretch-work-area-height-button').click()
  const verticallyStretchedObjects = [...dom.window.document.querySelectorAll('.scene-object')]
    .map(node => ({
      id: node.dataset.id,
      left: Number.parseFloat(node.style.left),
      right: Number.parseFloat(node.style.left) + Number.parseFloat(node.style.width),
      top: Number.parseFloat(node.style.top),
      bottom: Number.parseFloat(node.style.top) + Number.parseFloat(node.style.height),
    }))
    .sort((first, second) => first.top - second.top)
  assert.equal(verticallyStretchedObjects[0].top, 40)
  assert.ok(
    verticallyStretchedObjects[0].bottom <= verticallyStretchedObjects[1].top,
    `stretched segments overlap: ${JSON.stringify(verticallyStretchedObjects)}`,
  )
  assert.equal(verticallyStretchedObjects.at(-1).bottom, 1060)
  dom.window.document.querySelector('#undo-button').click()

  const minContentInput = dom.window.document.querySelector('#translation-text')
  minContentInput.value = 'short exceptionallylongword short'
  minContentInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  const widthsBeforeMinContent = [...dom.window.document.querySelectorAll('.scene-object')].map(node => Number.parseFloat(node.style.width))
  dom.window.document.querySelector('#fit-min-content-width-button').click()
  const minContentObjects = [...dom.window.document.querySelectorAll('.scene-object')]
  assert.ok(minContentObjects.every((node, index) => Number.parseFloat(node.style.width) <= Math.ceil(widthsBeforeMinContent[index])), 'min-content permits only subpixel rounding when already at minimum width')
  assert.ok(minContentObjects.every(node => Number.parseFloat(node.style.height) > 12))

  fontSizeIncrease.click()
  const applyAllFormatting = dom.window.document.querySelector('#format-all-segments')
  applyAllFormatting.checked = true
  applyAllFormatting.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  const mixedFontSizeValue = dom.window.document.querySelector('#toolbar-font-size-value')
  assert.equal(mixedFontSizeValue.value, '')
  assert.equal(mixedFontSizeValue.placeholder, '≠')
  assert.equal(mixedFontSizeValue.title, 'У выбранных сегментов разные размеры шрифта')
  assert.equal(mixedFontSizeValue.closest('.number-stepper__field').classList.contains('is-mixed'), true)
  mixedFontSizeValue.value = '1'
  mixedFontSizeValue.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(mixedFontSizeValue.closest('.number-stepper__field').classList.contains('is-mixed'), false)
  mixedFontSizeValue.value = ''
  mixedFontSizeValue.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(mixedFontSizeValue.closest('.number-stepper__field').classList.contains('is-mixed'), true)
  mixedFontSizeValue.value = '14'
  mixedFontSizeValue.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.equal(mixedFontSizeValue.closest('.number-stepper__field').classList.contains('is-mixed'), false)
  const fontFamily = dom.window.document.querySelector('#toolbar-font-family')
  fontFamily.value = 'Times New Roman'
  fontFamily.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontFamily),
    ['"Times New Roman"', '"Times New Roman"']
  )
  const textColor = dom.window.document.querySelector('#toolbar-text-color')
  textColor.value = '#336699'
  textColor.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.color),
    ['rgb(51, 102, 153)', 'rgb(51, 102, 153)']
  )
  fontSizeIncrease.click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['15px', '15px']
  )
  assert.equal(dom.window.document.querySelector('#toolbar-font-size-value').value, '15')
  fontSizeDecrease.click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['14px', '14px']
  )
  const primaryBeforeUndo = dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id, primaryBeforeUndo)
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['15px', '15px']
  )
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }))
  assert.equal(dom.window.document.querySelectorAll('.scene-object.is-selected').length, 2)
  assert.equal(dom.window.document.querySelector('.scene-object.is-primary-selected').dataset.id, primaryBeforeUndo)
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['14px', '14px']
  )
  const fontSizeValue = dom.window.document.querySelector('#toolbar-font-size-value')
  fontSizeValue.value = '100'
  fontSizeValue.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['80px', '80px']
  )
  fontSizeValue.value = '22'
  fontSizeValue.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontSize),
    ['22px', '22px']
  )
  const lineHeight = dom.window.document.querySelector('#line-height')
  lineHeight.value = '1.5'
  lineHeight.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.lineHeight),
    ['1.5', '1.5']
  )
  dom.window.document.querySelector('#line-height-increase').click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.lineHeight),
    ['1.55', '1.55']
  )
  dom.window.document.querySelector('#line-height-decrease').click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.lineHeight),
    ['1.5', '1.5']
  )
  assert.equal(dom.window.document.querySelector('.scene-object__content [style*="font-size"]'), null)
  dom.window.document.querySelector('[data-format="bold"]').click()
  assert.deepEqual(
    [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.fontWeight),
    ['700', '700']
  )

  const firstObject = dom.window.document.querySelector('[data-id="object-1"]')
  dom.window.document.querySelector('#align-left-button').click()
  const alignedLefts = [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.left)
  assert.equal(new Set(alignedLefts).size, 1)
  assert.equal(dom.window.document.querySelector('#align-left-button').classList.contains('is-active'), true)
  assert.equal(dom.window.document.querySelector('#align-left-button').getAttribute('aria-pressed'), 'true')

  const alignDocumentCenter = dom.window.document.querySelector('[data-align-document="center-x"]')
  alignDocumentCenter.click()
  assert.equal(alignDocumentCenter.classList.contains('is-active'), true)
  assert.equal(alignDocumentCenter.getAttribute('aria-pressed'), 'true')

  const horizontalBetween = dom.window.document.querySelector('[data-flex-axis="row"][data-flex-layout="space-between"]')
  const verticalBetween = dom.window.document.querySelector('[data-flex-axis="column"][data-flex-layout="space-between"]')
  for (const node of dom.window.document.querySelectorAll('.scene-object')) {
    const handle = node.querySelector('.scene-object__resize')
    handle.dispatchEvent(pointer('pointerdown', 0, 0))
    dom.window.dispatchEvent(pointer('pointermove', 5000, 0))
    dom.window.dispatchEvent(pointer('pointerup', 5000, 0))
  }
  const widthsBeforeAutomaticFit = [...dom.window.document.querySelectorAll('.scene-object')].map(node => Number.parseFloat(node.style.width))
  const fontSizesBeforeAutomaticFit = [...dom.window.document.querySelectorAll('.scene-object')].map(node => Number.parseFloat(node.style.fontSize))
  assert.ok(widthsBeforeAutomaticFit.reduce((sum, width) => sum + width, 0) > 714)
  const topsBeforeHorizontalLayout = [...dom.window.document.querySelectorAll('.scene-object')].map(node => node.style.top)
  horizontalBetween.click()
  const widthsAfterAutomaticFit = [...dom.window.document.querySelectorAll('.scene-object')].map(node => Number.parseFloat(node.style.width))
  const fontSizesAfterAutomaticFit = [...dom.window.document.querySelectorAll('.scene-object')].map(node => Number.parseFloat(node.style.fontSize))
  assert.ok(widthsAfterAutomaticFit.reduce((sum, width) => sum + width, 0) <= 680.001)
  assert.ok(fontSizesAfterAutomaticFit.some((size, index) => size < fontSizesBeforeAutomaticFit[index]))
  const flexObjects = [...dom.window.document.querySelectorAll('.scene-object')]
  const flexLefts = flexObjects.map(node => Number.parseFloat(node.style.left)).sort((left, right) => left - right)
  assert.equal(flexLefts[0], 40)
  assert.equal(Math.max(...flexObjects.map(node => Number.parseFloat(node.style.left) + Number.parseFloat(node.style.width))), 720)
  assert.deepEqual(flexObjects.map(node => node.style.top), topsBeforeHorizontalLayout)
  const leftsBeforeVerticalLayout = flexObjects.map(node => node.style.left)
  verticalBetween.click()
  assert.deepEqual(flexObjects.map(node => node.style.left), leftsBeforeVerticalLayout)

  const translationInput = dom.window.document.querySelector('#translation-text')
  translationInput.value = '/Подпись/'
  translationInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  dom.window.document.querySelector('#fit-content-both-button').click()
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  let fittedObjects = [...dom.window.document.querySelectorAll('.scene-object')]
  assert.ok(fittedObjects.every(node => {
    const width = Number.parseFloat(node.style.width)
    const height = Number.parseFloat(node.style.height)
    return width >= 12 && height >= 12 && Number.isFinite(width) && Number.isFinite(height)
  }))
  assert.equal(new Set(fittedObjects.map(node => node.style.width)).size, 1)
  assert.equal(new Set(fittedObjects.map(node => node.style.height)).size, 1)
  assert.ok(fittedObjects.every((node, index) => Number.parseFloat(node.style.width) < widthsBeforeAutomaticFit[index]))
  for (const node of fittedObjects) {
    assert.ok(Number.parseFloat(node.style.left) >= 40)
    assert.ok(Number.parseFloat(node.style.top) >= 40)
    assert.ok(Number.parseFloat(node.style.left) + Number.parseFloat(node.style.width) <= 720)
    assert.ok(Number.parseFloat(node.style.top) + Number.parseFloat(node.style.height) <= 1060)
  }

  const fittedSizes = new Map(fittedObjects.map(node => [node.dataset.id, {
    width: node.style.width,
    height: node.style.height,
  }]))
  const fittedHandle = fittedObjects[0].querySelector('.scene-object__handle')
  fittedHandle.dispatchEvent(pointer('pointerdown', 200, 200))
  dom.window.dispatchEvent(pointer('pointermove', 224, 216))
  dom.window.dispatchEvent(pointer('pointerup', 224, 216))
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  for (const node of dom.window.document.querySelectorAll('.scene-object')) {
    assert.deepEqual(
      { width: node.style.width, height: node.style.height },
      fittedSizes.get(node.dataset.id),
      'dragging must not change the fitted size of this or another segment'
    )
  }

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(dom.window.document.querySelector('#inspector-global-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-panel-body').hasAttribute('inert'), false)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel').hidden, true)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel [data-inspector-selection-note]'), null)
  assert.equal(dom.window.document.querySelector('#inspector-translation-panel .inspector-section__content').hidden, false)
  let independentlyFitted = [...dom.window.document.querySelectorAll('.scene-object')]
  independentlyFitted[0].dispatchEvent(pointer('pointerdown', 240, 240))
  dom.window.document.querySelector('#fit-content-both-button').click()
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  independentlyFitted = [...dom.window.document.querySelectorAll('.scene-object')]
  const firstFittedId = independentlyFitted[0].dataset.id
  const firstFittedSize = { width: independentlyFitted[0].style.width, height: independentlyFitted[0].style.height }
  independentlyFitted[1].dispatchEvent(pointer('pointerdown', 260, 260))
  dom.window.document.querySelector('#fit-content-both-button').click()
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  const firstAfterSecondFit = dom.window.document.querySelector(`[data-id="${firstFittedId}"]`)
  assert.deepEqual(
    { width: firstAfterSecondFit.style.width, height: firstAfterSecondFit.style.height },
    firstFittedSize,
    'fitting another segment must not change the previously fitted segment'
  )

  const zoomBeforeWheel = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10)
  dom.window.document.querySelector('#canvas-scroll').dispatchEvent(new dom.window.WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -5, clientX: 100, clientY: 100,
  }))
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  const zoomAfterWheel = Number.parseInt(dom.window.document.querySelector('#zoom-output').value, 10)
  assert.ok(zoomAfterWheel >= zoomBeforeWheel, `${zoomBeforeWheel} -> ${zoomAfterWheel}`)
  assert.ok(zoomAfterWheel - zoomBeforeWheel <= 2)
  assert.deepEqual(errors, [])
  dom.window.close()
})

test('blank pages can be inserted and removed while segments move reliably between pages', async () => {
  const id = 'f'.repeat(32)
  const page = (index, sourcePageIndex = index) => ({
    index, sourcePageIndex, isAdded: false, widthPx: 794, heightPx: 1123,
    imageUrl: `/api/studio/documents/${id}/pages/${sourcePageIndex}/image`,
    sourceFrame: { x: 0, y: 0, width: 794, height: 1123 },
    contentBounds: { x: 40, y: 40, width: 714, height: 1043 },
  })
  const scene = {
    title: 'Page editing', sourceLanguage: 'en', targetLanguage: 'ru', workflowStage: 4, gridSize: 8, snapToGrid: true,
    pages: [page(0), page(1)],
    objects: [{
      id: 'moving-object', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'Move me', translation: 'Переместить', confidence: .99,
      x: 50, y: 60, width: 200, height: 40, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 50, y: 60, width: 200, height: 40 },
    }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async (url, options = {}) => ({
    ok: true,
    json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false, translationModel: null }
      : options.method === 'PUT'
        ? { metadata: { id, revision: 2 } }
        : { metadata: { id, revision: 1 }, scene },
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {}
  dom.window.Element.prototype.setPointerCapture = function setPointerCapture(pointerId) { this.__pointerId = pointerId }
  dom.window.Element.prototype.hasPointerCapture = function hasPointerCapture(pointerId) { return this.__pointerId === pointerId }
  dom.window.Element.prototype.releasePointerCapture = function releasePointerCapture(pointerId) {
    if (this.__pointerId === pointerId) this.__pointerId = null
  }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelector('#studio-view').classList.contains('is-segments-mode'), false)

  assert.equal(dom.window.document.querySelectorAll('.page-actions').length, 2)
  assert.equal(dom.window.document.querySelector('.page-actions__delete').disabled, true)
  assert.equal(dom.window.document.querySelector('.page-actions__add span'), null)
  assert.equal(dom.window.document.querySelector('.page-actions__delete span'), null)
  assert.equal(dom.window.document.querySelector('.page-actions__add').getAttribute('aria-label'), 'Добавить пустую страницу ниже')
  dom.window.document.querySelector('.page-actions__add').click()
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  assert.equal(dom.window.document.querySelectorAll('.studio-page').length, 3)
  assert.match(dom.window.document.querySelector('.source-preview-page__empty').textContent, /Пустая/)
  assert.equal(scene.pages[2].sourcePageIndex, 1)
  assert.match(scene.pages[2].imageUrl, /pages\/1\/image$/)

  dom.window.document.querySelector('.page-actions[data-page-index="1"] .page-actions__delete').click()
  await new Promise(resolve => dom.window.requestAnimationFrame(resolve))
  assert.equal(dom.window.document.querySelectorAll('.studio-page').length, 2)
  assert.equal(scene.pages[1].sourcePageIndex, 1)
  assert.match(scene.pages[1].imageUrl, /pages\/1\/image$/)

  dom.window.document.querySelector('#zoom-100').click()
  const surfaces = [...dom.window.document.querySelectorAll('.studio-page')]
  surfaces[0].getBoundingClientRect = () => ({ left: 100, top: 100, right: 894, bottom: 1223, width: 794, height: 1123 })
  surfaces[1].getBoundingClientRect = () => ({ left: 100, top: 1300, right: 894, bottom: 2423, width: 794, height: 1123 })
  const pointer = (type, x, y) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
    Object.defineProperty(event, 'pointerId', { value: 11 })
    return event
  }
  dom.window.document.querySelector('[data-id="moving-object"]').dispatchEvent(pointer('pointerdown', 150, 160))
  const dragHandle = dom.window.document.querySelector('[data-id="moving-object"] .scene-object__handle')
  dragHandle.dispatchEvent(pointer('pointerdown', 128, 160))
  dom.window.dispatchEvent(pointer('pointermove', 200, 1400))
  const liveMovingObject = dom.window.document.querySelector('[data-id="moving-object"]')
  assert.ok(
    Number.parseFloat(liveMovingObject.style.top) > scene.pages[0].contentBounds.y + scene.pages[0].contentBounds.height,
    'the captured segment must keep following the pointer beyond the source page instead of sticking to its bottom boundary',
  )
  assert.equal(surfaces[1].classList.contains('is-drag-target'), true)
  assert.equal(surfaces[0].closest('.studio-page-shell').classList.contains('is-drag-source-shell'), true)
  assert.equal(dom.window.document.querySelector('#document-canvas').classList.contains('is-object-dragging'), true)
  dom.window.dispatchEvent(pointer('pointerup', 200, 1400))
  assert.ok(dom.window.document.querySelector('.studio-page[data-page-index="1"] [data-id="moving-object"]'))
  assert.equal(dom.window.document.querySelector('#document-canvas').classList.contains('is-object-dragging'), false)
  assert.equal(dom.window.document.querySelector('.page-actions[data-page-index="1"] .page-actions__delete').disabled, true)

  const movedObject = dom.window.document.querySelector('[data-id="moving-object"]')
  movedObject.dispatchEvent(pointer('pointerdown', 200, 1400))
  const resizeHandle = movedObject.querySelector('.scene-object__resize')
  const widthBeforeResize = Number.parseFloat(movedObject.style.width)
  resizeHandle.dispatchEvent(pointer('pointerdown', 300, 1450))
  dom.window.dispatchEvent(pointer('pointermove', 340, 1480))
  resizeHandle.dispatchEvent(pointer('lostpointercapture', 340, 1480))
  assert.ok(Number.parseFloat(movedObject.style.width) > widthBeforeResize)
  assert.equal(resizeHandle.__pointerId, null)

  dom.window.close()
})

test('legacy internal units stay hidden and collapse into one unit when the full translation is edited', async () => {
  const id = 'c'.repeat(32)
  const scene = {
    title: 'Internal units', sourceLanguage: 'en', targetLanguage: 'ru', workflowStage: 3, gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'paragraph', pageIndex: 0, type: 'text', readingOrder: 1,
      sourceText: 'First sentence. Second sentence!', translation: 'Первое предложение. Второе предложение!', confidence: .99,
      x: 40, y: 80, width: 500, height: 50, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#111827' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 80, width: 500, height: 50 },
      translationUnits: [
        { id: 'paragraph-unit-1', sourceText: 'First sentence.', separatorAfter: ' ', translation: 'Первое предложение.', status: 'edited', activeTranslationSource: 'manual' },
        { id: 'paragraph-unit-2', sourceText: 'Second sentence!', separatorAfter: '', translation: 'Второе предложение!', status: 'edited', activeTranslationSource: 'manual' },
      ],
    }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async url => ({
    ok: true,
    json: async () => String(url).endsWith('/status')
      ? { translationProviderConfigured: false, translationModel: null }
      : { metadata: { id, revision: 1 }, scene },
  })
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))
  const object = dom.window.document.querySelector('.scene-object--translation')
  object.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  assert.equal(dom.window.document.querySelector('#translation-units-card'), null)
  assert.equal(dom.window.document.querySelector('#translation-text').disabled, false)
  assert.equal(object.querySelector('.scene-object__content').contentEditable, 'true')
  const translation = dom.window.document.querySelector('#translation-text')
  translation.value = 'Новый полный перевод'
  translation.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(scene.objects[0].translation, 'Новый полный перевод')
  assert.equal(scene.objects[0].translationUnits.length, 1)
  assert.equal(scene.objects[0].translationUnits[0].sourceText, scene.objects[0].sourceText)
  assert.equal(scene.objects[0].translationUnits[0].translation, 'Новый полный перевод')
  dom.window.close()
})

test('knowledge base manager lists, edits, and deletes stored entries', async () => {
  const glossary = { id: '00000000-0000-4000-8000-000000000001', name: 'Основной глоссарий', sourceLanguage: 'en', targetLanguage: 'ru' }
  const entry = {
    id: 'memory-entry-1', glossaryId: glossary.id, sourceText: 'Power of attorney', translation: 'Доверенность',
    sourceLanguage: 'en', targetLanguage: 'ru', updatedAt: '2026-09-06T08:00:00.000Z',
  }
  const requests = []
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options })
    const pathname = String(url)
    if (pathname.includes('/knowledge-base/status')) return { ok: true, json: async () => ({ mode: 'postgres-pgvector', connected: true, persistent: true, entries: 1 }) }
    if (pathname.includes('/knowledge-base/glossaries')) return { ok: true, json: async () => ({ glossaries: [glossary] }) }
    if (pathname.includes('/knowledge-base/entries') && (options.method || 'GET') === 'GET') {
      return { ok: true, json: async () => ({ entries: [entry], total: 1, limit: 25, offset: 0 }) }
    }
    if (pathname.includes('/knowledge-base/entries/') && options.method === 'PATCH') return { ok: true, json: async () => ({ entry: { ...entry, translation: 'Новая доверенность' } }) }
    if (pathname.includes('/knowledge-base/entries/') && options.method === 'DELETE') return { ok: true, status: 204, json: async () => ({}) }
    if (pathname.includes('/documents?scope=all')) return { ok: true, json: async () => ({ documents: [] }) }
    if (pathname.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (pathname.endsWith('/status')) return { ok: true, json: async () => ({ aiProviderConfigured: true, documentAnalysisMode: 'aitunnel' }) }
    return { ok: true, json: async () => ({}) }
  }
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  dom.window.document.querySelector('#knowledge-base-open-button').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelectorAll('.knowledge-base-entry').length, 1)
  dom.window.document.querySelector('.knowledge-base-entry__actions .button').click()
  const translation = dom.window.document.querySelector('#knowledge-base-entry-translation')
  assert.equal(translation.value, 'Доверенность')
  translation.value = 'Новая доверенность'
  dom.window.document.querySelector('#knowledge-base-entry-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise(resolve => setTimeout(resolve, 30))
  const patchRequest = requests.find(request => request.options.method === 'PATCH')
  assert.equal(JSON.parse(patchRequest.options.body).translation, 'Новая доверенность')

  dom.window.document.querySelector('.knowledge-base-entry__actions .button--danger').click()
  assert.equal(dom.window.document.querySelector('#confirmation-modal').hidden, false)
  dom.window.document.querySelector('#confirmation-submit').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.ok(requests.some(request => request.options.method === 'DELETE'))
  dom.window.close()
})

test('AI instruction library lists, searches, creates, edits, and deletes presets', async () => {
  const preset = {
    id: 'preset-1', instruction: 'Передавай имена транслитерацией.',
    createdAt: '2026-09-07T08:00:00.000Z', updatedAt: '2026-09-07T08:00:00.000Z',
  }
  let presets = [preset]
  const requests = []
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1:3100/',
  })
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    const method = options.method || 'GET'
    requests.push({ value, method, body: options.body ? JSON.parse(options.body) : null })
    if (value.endsWith('/translation-instructions') && method === 'GET') return { ok: true, json: async () => ({ presets }) }
    if (value.endsWith('/translation-instructions') && method === 'POST') {
      const created = { id: 'preset-2', ...JSON.parse(options.body), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      presets = [created, ...presets]
      return { ok: true, json: async () => ({ preset: created, created: true }) }
    }
    if (value.endsWith('/translation-instructions/preset-1') && method === 'PATCH') {
      const updated = { ...preset, ...JSON.parse(options.body), updatedAt: new Date().toISOString() }
      presets = [updated, ...presets.filter(item => item.id !== preset.id)]
      return { ok: true, json: async () => ({ preset: updated }) }
    }
    if (value.includes('/translation-instructions/') && method === 'DELETE') {
      const id = value.split('/').at(-1)
      presets = presets.filter(item => item.id !== id)
      return { ok: true, status: 204, json: async () => ({}) }
    }
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: false, translationModel: null }) }
    if (value.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (value.endsWith('/documents')) return { ok: true, json: async () => ({ documents: [] }) }
    throw new Error(`Unexpected fetch: ${url}`)
  }
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 30))

  dom.window.document.querySelector('#instruction-library-button').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(dom.window.document.querySelector('#instruction-library-modal').hidden, false)
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 1)
  dom.window.document.querySelector('.instruction-library-entry__actions .button').click()
  dom.window.document.querySelector('#instruction-library-text').value = 'Передавай имена по стандарту ISO 9.'
  dom.window.document.querySelector('#instruction-library-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.ok(requests.some(request => request.method === 'PATCH' && request.body.instruction === 'Передавай имена по стандарту ISO 9.'))
  assert.match(dom.window.document.querySelector('.instruction-library-entry p').textContent, /стандарту ISO 9/)

  dom.window.document.querySelector('#instruction-library-new').click()
  dom.window.document.querySelector('#instruction-library-text').value = 'Сохраняй номера без изменений.'
  dom.window.document.querySelector('#instruction-library-form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 2)

  const query = dom.window.document.querySelector('#instruction-library-query')
  query.value = 'номера'
  query.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 1)
  assert.match(dom.window.document.querySelector('.instruction-library-entry p').textContent, /номера/)
  dom.window.document.querySelector('.instruction-library-entry__actions .button--danger').click()
  assert.equal(dom.window.document.querySelector('#confirmation-modal').hidden, false)
  dom.window.document.querySelector('#confirmation-submit').click()
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(dom.window.document.querySelectorAll('.instruction-library-entry').length, 0)
  assert.ok(requests.some(request => request.method === 'DELETE' && request.value.endsWith('/preset-2')))
  dom.window.close()
})

test('layout shows knowledge matches and keeps the AI translation as an alternative', async () => {
  const id = 'f'.repeat(32)
  const sourceText = 'SÜRELİDİR\nNoteri Sabahattin'
  const glossary = { id: '00000000-0000-4000-8000-000000000001', name: 'Основной глоссарий', sourceLanguage: 'Turkish', targetLanguage: 'ru' }
  const knowledgeEntry = {
    id: 'entry-1', glossaryId: glossary.id, sourceText: 'SÜRELİDİR', translation: 'Имеет срок',
    sourceLanguage: 'Turkish', targetLanguage: 'ru', updatedAt: '2026-09-13T08:00:00.000Z',
  }
  let knowledgeEntries = [knowledgeEntry]
  let knowledgeRefreshRequests = 0
  const scene = {
    title: 'Knowledge highlights', sourceLanguage: 'Turkish', targetLanguage: 'ru', workflowStage: 4, knowledgeBaseMode: 'priority', gridSize: 8, snapToGrid: true,
    pages: [{ index: 0, widthPx: 794, heightPx: 1123, imageUrl: '/page.png', sourceFrame: { x: 0, y: 0, width: 794, height: 1123 }, contentBounds: { x: 40, y: 40, width: 714, height: 1043 } }],
    objects: [{
      id: 'memory-object', pageIndex: 0, type: 'text', readingOrder: 1, sourceText,
      translation: 'СРОК ДЕЙСТВИЯ\nНотариус Сабахаттин', confidence: .99,
      x: 40, y: 80, width: 600, height: 50, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 80, width: 600, height: 50 },
      translationUnits: [{
        id: 'memory-unit', sourceText, separatorAfter: '', translation: 'СРОК ДЕЙСТВИЯ\nНотариус Сабахаттин',
        aiTranslation: 'СРОЧНАЯ\nНотариус Сабахаттин', activeTranslationSource: 'memory-revised', status: 'memory-applied',
        knowledgeMatches: [{
          id: 'entry-1:0:10:0', entryId: 'entry-1', glossaryId: '00000000-0000-4000-8000-000000000001',
          sourceText: 'SÜRELİDİR', translation: 'Имеет срок', sourceLanguage: 'Turkish', targetLanguage: 'ru',
          start: 0, end: 'SÜRELİDİR'.length, score: 1, matchType: 'exact-fragment', fullSegment: false,
        }, {
          id: 'entry-1:11:17:1', entryId: 'entry-1', glossaryId: '00000000-0000-4000-8000-000000000001',
          sourceText: 'noteri', translation: 'Нотариус', sourceLanguage: 'Turkish', targetLanguage: 'ru',
          start: 11, end: 17, score: 1, matchType: 'exact-fragment', fullSegment: false,
        }],
        translationKnowledgeMatches: [{
          id: 'entry-1:13:21:target', entryId: 'entry-1', glossaryId: glossary.id,
          sourceText: 'Нотариус', translation: 'Noteri', sourceLanguage: 'ru', targetLanguage: 'Turkish',
          start: 14, end: 22, score: 1, matchType: 'exact-fragment', fullSegment: false,
        }],
      }],
    }, {
      id: 'fuzzy-object', pageIndex: 0, type: 'text', readingOrder: 2, sourceText: 'VEKALETNAMвE',
      translation: '', confidence: .99,
      x: 40, y: 160, width: 300, height: 50, rotation: 0, excluded: false,
      style: { fontFamily: 'Arial', fontSizePx: 14, fontWeight: 400, fontStyle: 'normal', textAlign: 'left', lineHeight: 1.2, color: '#000000' },
      sourceTextStyles: [], translationTextStyles: [], originalBounds: { x: 40, y: 160, width: 300, height: 50 },
      translationUnits: [{
        id: 'fuzzy-unit', sourceText: 'VEKALETNAMвE', separatorAfter: '', translation: '', status: 'new',
        knowledgeMatches: [{
          id: 'fuzzy-entry:fuzzy', entryId: 'fuzzy-entry', glossaryId: '00000000-0000-4000-8000-000000000001',
          sourceText: 'Vekaletname', translation: 'Доверенность', sourceLanguage: 'Turkish', targetLanguage: 'ru',
          start: 0, end: 'VEKALETNAMвE'.length, score: .94, matchType: 'fuzzy', fullSegment: false,
        }],
      }],
    }],
  }
  const dom = new JSDOM(html.replace('<script src="/studio.js"></script>', ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: `http://127.0.0.1:3100/?document=${id}`,
  })
  dom.window.fetch = async (url, options = {}) => {
    const value = String(url)
    if (value.includes('/knowledge-matches/refresh')) {
      knowledgeRefreshRequests += 1
      return { ok: true, json: async () => ({ metadata: { id, revision: 2 }, scene, matchCount: 2 }) }
    }
    if (value.includes('/knowledge-base/status')) return { ok: true, json: async () => ({ mode: 'postgres-pgvector', connected: true, persistent: true, entries: knowledgeEntries.length }) }
    if (value.includes('/knowledge-base/glossaries')) return { ok: true, json: async () => ({ glossaries: [glossary] }) }
    if (value.includes('/knowledge-base/entries/entry-1') && options.method === 'DELETE') {
      knowledgeEntries = []
      return { ok: true, status: 204, json: async () => ({}) }
    }
    if (value.includes('/knowledge-base/entries')) return { ok: true, json: async () => ({ entries: knowledgeEntries, total: knowledgeEntries.length, limit: 25, offset: 0 }) }
    if (value.includes('/documents?scope=all')) return { ok: true, json: async () => ({ documents: [] }) }
    if (value.endsWith('/jobs')) return { ok: true, json: async () => ({ jobs: [] }) }
    if (value.endsWith('/status')) return { ok: true, json: async () => ({ translationProviderConfigured: true, translationModel: 'test', documentAnalysisMode: 'aitunnel', aiProviderConfigured: true }) }
    return { ok: true, json: async () => ({ metadata: { id, revision: 1 }, scene }) }
  }
  dom.window.CSS = { escape: value => String(value) }
  dom.window.eval(translationUnits)
  dom.window.eval(client)
  await new Promise(resolve => setTimeout(resolve, 40))
  const knowledgeHighlights = [...dom.window.document.querySelectorAll('.knowledge-highlight')]
  const knowledgeHighlight = knowledgeHighlights[0]
  const layoutIndicator = dom.window.document.querySelector('.scene-object__knowledge-icon')
  assert.ok(knowledgeHighlight)
  assert.equal(knowledgeHighlight.textContent, 'Нотариус')
  assert.deepEqual(knowledgeHighlights.map(node => node.textContent), ['Нотариус'])
  assert.doesNotMatch(knowledgeHighlights.map(node => node.textContent).join(' '), /Сабахаттин/)
  assert.ok(layoutIndicator)
  assert.match(layoutIndicator.querySelector('use').getAttribute('href'), /icon-alert-circle$/)
  assert.equal(layoutIndicator.textContent, '')
  const fuzzyObject = dom.window.document.querySelector('[data-id="fuzzy-object"]')
  assert.equal(fuzzyObject.querySelector('.knowledge-highlight'), null)
  assert.equal(fuzzyObject.querySelector('.scene-object__knowledge-icon'), null)
  knowledgeHighlight.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
  assert.equal(dom.window.document.querySelector('#knowledge-suggestion-popover').hidden, false)
  assert.equal(dom.window.document.querySelector('#knowledge-suggestion-title').textContent, 'Найденные записи в БЗ')
  const firstSuggestion = dom.window.document.querySelector('.knowledge-suggestion')
  const suggestionValues = [...firstSuggestion.querySelectorAll('.knowledge-suggestion__value')]
  assert.deepEqual(suggestionValues.map(node => node.textContent), ['Нотариус', 'Noteri'])
  assert.deepEqual(suggestionValues.map(node => node.dataset.language), ['Русский', 'Турецкий'])
  assert.equal(firstSuggestion.querySelector('.knowledge-suggestion__score'), null)
  const suggestionActions = [...firstSuggestion.querySelectorAll('.knowledge-suggestion__actions .icon-button')]
  assert.deepEqual(suggestionActions.map(button => button.getAttribute('aria-label')), ['Открыть в БЗ', 'Применение доступно на этапе «Сегменты»'])
  assert.equal(suggestionActions[1].disabled, true)
  assert.match(suggestionActions[0].querySelector('use').getAttribute('href'), /icon-database$/)
  assert.match(suggestionActions[1].querySelector('use').getAttribute('href'), /icon-check$/)
  dom.window.document.querySelector('#knowledge-suggestion-close').click()
  dom.window.document.querySelector('#workflow-previous').click()
  assert.equal(dom.window.document.querySelector('#studio-view').dataset.workflowStage, '2')
  const translationBadges = dom.window.document.querySelector('.scene-object--translation .segment-content-badges--translation')
  assert.equal(translationBadges.contentEditable, 'false')
  assert.equal(translationBadges.textContent, '')
  assert.ok(translationBadges.classList.contains('segment-knowledge-actions'))
  assert.ok(translationBadges.querySelector('[aria-label="Найденные записи в БЗ"]'))
  const addPair = translationBadges.querySelector('[aria-label="Добавить пару в БЗ"]')
  assert.ok(addPair.classList.contains('icon-button'))
  assert.equal(dom.window.document.querySelector('.segment-translation-workspace .segment-knowledge-actions'), null)
  addPair.click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelector('#knowledge-base-entry-form').hidden, false)
  assert.equal(dom.window.document.querySelector('#knowledge-base-entry-source').value, sourceText)
  assert.equal(dom.window.document.querySelector('#knowledge-base-entry-translation').value, 'СРОК ДЕЙСТВИЯ\nНотариус Сабахаттин')
  assert.equal(dom.window.document.querySelector('#knowledge-base-entry-source-language').value, 'Turkish')
  assert.equal(dom.window.document.querySelector('#knowledge-base-entry-id').value, '')
  dom.window.document.querySelector('#knowledge-base-close').click()
  const editedSegment = dom.window.document.querySelector('.scene-object--translation .scene-object__content')
  editedSegment.focus()
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-knowledge-editing'), true)
  assert.equal(scene.objects[0].translationUnits[0].knowledgeMatches.length, 0)
  const pageSurface = dom.window.document.querySelector('.studio-page')
  pageSurface.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 700, clientY: 900 }))
  assert.notEqual(dom.window.document.activeElement, editedSegment)
  dom.window.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 700, clientY: 900 }))
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-knowledge-editing'), false)
  assert.equal(knowledgeRefreshRequests, 1)
  const refreshedSegment = dom.window.document.querySelector('.scene-object--translation .scene-object__content')
  refreshedSegment.focus()
  refreshedSegment.textContent = 'VEKALETNAMвE'
  refreshedSegment.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-knowledge-editing'), true)
  assert.equal(scene.objects[0].translationUnits[0].knowledgeMatches.length, 0)
  refreshedSegment.blur()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(knowledgeRefreshRequests, 2)
  assert.equal(dom.window.document.querySelector('.scene-object').classList.contains('is-knowledge-editing'), false)
  assert.equal(dom.window.document.querySelector('.scene-object__knowledge-icon'), null)
  assert.equal(dom.window.document.querySelector('.knowledge-highlight'), null)
  dom.window.document.querySelector('.scene-object').dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  const preservedTranslation = scene.objects[0].translationUnits[0].translation
  dom.window.document.querySelector('#knowledge-base-open-button').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  dom.window.document.querySelector('.knowledge-base-entry__actions .button--danger').click()
  assert.equal(dom.window.document.querySelector('#confirmation-modal').hidden, false)
  dom.window.document.querySelector('#confirmation-submit').click()
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(dom.window.document.querySelector('.scene-object__knowledge-icon'), null)
  assert.equal(dom.window.document.querySelector('.knowledge-highlight'), null)
  assert.equal(scene.objects[0].translationUnits[0].knowledgeMatches.length, 0)
  assert.equal(scene.objects[0].translationUnits[0].activeTranslationSource, 'manual')
  assert.equal(scene.objects[0].translationUnits[0].translation, preservedTranslation)
  const alternative = dom.window.document.querySelector('.ai-translation-alternative')
  assert.ok(alternative.parentElement.classList.contains('segment-translation-workspace'))
  assert.match(alternative.textContent, /СРОЧНАЯ/)
  alternative.querySelector('button').click()
  assert.equal(dom.window.document.querySelector('.scene-object--translation .scene-object__content').textContent, 'СРОЧНАЯ\nНотариус Сабахаттин')
  assert.equal(dom.window.document.querySelector('.ai-translation-alternative'), null)
  dom.window.close()
})

test('knowledge-base edits refresh matches in the active document', () => {
  assert.match(client, /translationKnowledgeMatches/)
  assert.doesNotMatch(client, /sourceLineIndex|nextSearchOffset/)
  assert.match(uiComponentsHtml, /SegmentKnowledgeActions/)
  assert.match(userGuide, /одновременно видны исходник и перевод/)
  assert.match(technicalSpecification, /Точный поиск пары двунаправленный/)
  assert.match(client, /documents\/\$\{expectedDocumentId\}\/knowledge-matches\/refresh/)
  assert.match(client, /await saveScene\(true\)[\s\S]*await refreshCurrentKnowledgeBaseMatches\(editRevision, documentId\)/)
  assert.match(styles, /\.knowledge-highlight\s*\{[^}]*background:\s*#ffe96a/)
  assert.match(styles, /\.scene-object\.is-knowledge-editing \.knowledge-highlight\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/)
  assert.match(styles, /\.scene-object\.is-knowledge-editing \.scene-object__knowledge-icon\s*\{[^}]*display:\s*none;/)
  assert.match(styles, /\.scene-object__knowledge-icon\s*\{[^}]*position:\s*absolute/)
})
