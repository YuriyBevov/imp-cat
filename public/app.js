const DEFAULT_GRID_SIZE = 4;
const MIN_SEGMENT_WIDTH = 20;
const MIN_SEGMENT_HEIGHT = 16;
const MIN_PARKING_HEIGHT = 210;
const MIN_PARKING_WIDTH = 340;
const MAX_PARKING_HEIGHT = 4000;
const MAX_PARKING_WIDTH = 2000;
const PARKING_HEADER_HEIGHT = 64;
const HISTORY_LIMIT = 100;

const state = {
  title: "Новый документ",
  fileName: "",
  pages: [],
  segments: [],
  selectedId: null,
  selectedIds: new Set(),
  gridSize: DEFAULT_GRID_SIZE,
  viewScale: 1,
  viewMode: "fit",
  parkingElement: null,
  parkingOverlay: null,
  parkingHeight: 0,
  parkingWidth: 0,
  parkingResizeObserver: null,
  dropTargetElement: null,
  loading: false,
  history: window.ICATHistory.create(HISTORY_LIMIT),
  activeTextEdit: null,
  savedEditorRange: null,
  restoringHistory: false,
};

const elements = {
  fileInput: document.querySelector("#file-input"),
  uploadButton: document.querySelector("#upload-button"),
  sampleButton: document.querySelector("#sample-button"),
  sampleEmptyButton: document.querySelector("#empty-sample-button"),
  exportButton: document.querySelector("#export-button"),
  gridSize: document.querySelector("#grid-size"),
  gridHint: document.querySelector("#grid-hint"),
  viewScale: document.querySelector("#view-scale"),
  zoomValue: document.querySelector("#zoom-value"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  fitWidth: document.querySelector("#fit-width"),
  viewScaleHint: document.querySelector("#view-scale-hint"),
  workspace: document.querySelector("#workspace"),
  dropZone: document.querySelector("#drop-zone"),
  loading: document.querySelector("#loading"),
  loadingText: document.querySelector("#loading strong"),
  documentStage: document.querySelector("#document-stage"),
  docxHost: document.querySelector("#docx-host"),
  documentName: document.querySelector("#document-name"),
  pageCount: document.querySelector("#page-count"),
  segmentCount: document.querySelector("#segment-count"),
  overlapCount: document.querySelector("#overlap-count"),
  parkedCount: document.querySelector("#parked-count"),
  resolveOverlaps: document.querySelector("#resolve-overlaps"),
  selectionEmpty: document.querySelector("#selection-empty"),
  selectionDetails: document.querySelector("#selection-details"),
  selectionId: document.querySelector("#selection-id"),
  selectionPage: document.querySelector("#selection-page"),
  selectionCell: document.querySelector("#selection-cell"),
  selectionPosition: document.querySelector("#selection-position"),
  selectionSize: document.querySelector("#selection-size"),
  selectionCount: document.querySelector("#selection-count"),
  selectionArea: document.querySelector("#selection-area"),
  editorToolbar: document.querySelector("#editor-toolbar"),
  editorFontSize: document.querySelector("#editor-font-size"),
  editorActionButtons: Array.from(document.querySelectorAll("#editor-toolbar [data-editor-action]")),
  toast: document.querySelector("#toast"),
};

elements.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) {
    await loadDocument(file, file.name);
  }
  event.target.value = "";
});

elements.sampleButton.addEventListener("click", loadSample);
elements.sampleEmptyButton.addEventListener("click", loadSample);
elements.exportButton.addEventListener("click", exportDocument);
elements.gridSize.addEventListener("change", () => setGridSize(Number(elements.gridSize.value)));
elements.viewScale.addEventListener("input", () => setViewScale(Number(elements.viewScale.value)));
elements.zoomOut.addEventListener("click", () => setViewScale(state.viewScale * 100 - 10));
elements.zoomIn.addEventListener("click", () => setViewScale(state.viewScale * 100 + 10));
elements.fitWidth.addEventListener("click", fitDocumentWidth);
elements.resolveOverlaps.addEventListener("click", resolveSegmentOverlaps);
elements.workspace.addEventListener("wheel", handleWorkspaceZoom, { passive: false });
for (const button of elements.editorActionButtons) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });
  button.addEventListener("click", () => runSelectedEditorAction(button.dataset.editorAction));
}
elements.editorFontSize.addEventListener("pointerdown", rememberActiveEditorSelection);
elements.editorFontSize.addEventListener("change", () => {
  runSelectedEditorAction("font-size", Number(elements.editorFontSize.value));
});
document.addEventListener("selectionchange", rememberActiveEditorSelection);
window.addEventListener("resize", () => {
  if (state.viewMode === "fit" && state.pages.length) requestAnimationFrame(fitDocumentWidth);
});

for (const eventName of ["dragenter", "dragover"]) {
  elements.workspace.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!state.loading) elements.workspace.classList.add("is-dragging-file");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  elements.workspace.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.workspace.classList.remove("is-dragging-file");
  });
}

elements.workspace.addEventListener("drop", async (event) => {
  const [file] = event.dataTransfer.files;
  if (file) await loadDocument(file, file.name);
});

function handleDocumentPointerDown(event) {
  const insideSegment = event.target.closest?.(".icat-segment");
  if (!event.target.closest?.(".icat-segment__menu, .icat-segment__more")) closeAllMenus();
  if (!insideSegment) clearSegmentFocus();
}

function handleFocusShortcut(event) {
  if (event.key !== "Escape") return;
  event.preventDefault();
  clearSegmentFocus();
}

function clearSegmentFocus() {
  if (document.activeElement?.closest?.(".icat-segment")) document.activeElement.blur();
  closeAllMenus();
  selectSegments([]);
}

document.addEventListener("pointerdown", handleDocumentPointerDown);

document.addEventListener("keydown", handleUndoShortcut);
document.addEventListener("keydown", handleFocusShortcut);
updateEditorToolbarState(null);

async function loadSample() {
  try {
    setLoading(true, "Загружаем пример…");
    const response = await fetch("/api/sample");
    if (!response.ok) throw new Error("Не удалось получить пример документа");
    const blob = await response.blob();
    await loadDocument(blob, "пример-документа.docx");
  } catch (error) {
    setLoading(false);
    showToast(error.message, "error");
  }
}

async function loadDocument(blob, fileName) {
  if (!fileName.toLowerCase().endsWith(".docx")) {
    showToast("Для прототипа поддерживается только формат DOCX", "error");
    return;
  }

  if (!window.docx?.renderAsync) {
    showToast("Модуль просмотра DOCX не загрузился", "error");
    return;
  }

  try {
    clearDocument();
    setLoading(true, "Разбираем DOCX…");
    state.fileName = fileName;
    state.title = fileName.replace(/\.docx$/i, "") || "document";

    // docx-preview can build DOM inside a hidden container, but browser geometry
    // (clientWidth/getBoundingClientRect) stays zero until the stage participates
    // in layout. Keep it visually hidden while making it measurable.
    elements.documentStage.hidden = false;
    elements.documentStage.classList.add("is-measuring");
    elements.documentStage.setAttribute("aria-hidden", "true");

    await window.docx.renderAsync(await blob.arrayBuffer(), elements.docxHost, null, {
      className: "docx",
      inWrapper: true,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      experimental: true,
    });

    if (document.fonts?.ready) await document.fonts.ready;
    await waitForWordTabLayout();
    await nextPaint();
    await nextPaint();
    extractDocumentModel();
    elements.documentStage.classList.remove("is-measuring");
    elements.documentStage.removeAttribute("aria-hidden");
    setLoading(false);
    elements.dropZone.hidden = true;
    elements.documentStage.hidden = false;
    fitDocumentWidth();
    updateSummary();
    const overlapCount = getSegmentOverlaps().length;
    showToast(`Документ загружен: ${state.segments.length} сегментов${overlapCount ? `, наложений: ${overlapCount}` : ""}`);
  } catch (error) {
    clearDocument();
    setLoading(false);
    showToast(`Не удалось открыть DOCX: ${error.message}`, "error");
  }
}

function clearDocument() {
  state.parkingResizeObserver?.disconnect();
  elements.docxHost.replaceChildren();
  elements.documentStage.classList.remove("is-measuring");
  elements.documentStage.removeAttribute("aria-hidden");
  state.pages = [];
  state.segments = [];
  state.selectedId = null;
  state.selectedIds = new Set();
  state.viewMode = "fit";
  state.parkingElement = null;
  state.parkingOverlay = null;
  state.parkingHeight = 0;
  state.parkingWidth = 0;
  state.parkingResizeObserver = null;
  state.dropTargetElement = null;
  state.savedEditorRange = null;
  clearHistory();
  elements.documentStage.hidden = true;
  elements.dropZone.hidden = false;
  elements.uploadButton.hidden = false;
  updateEditorToolbarState(null);
  updateSummary();
}

function extractDocumentModel() {
  const sourcePageElements = Array.from(
    elements.docxHost.querySelectorAll(":scope > .docx-wrapper > section.docx"),
  );

  if (!sourcePageElements.length) {
    sourcePageElements.push(...elements.docxHost.querySelectorAll("section.docx"));
  }

  if (!sourcePageElements.length) throw new Error("в документе не найдены страницы");

  const sourcePages = sourcePageElements.map((pageElement, sourcePageIndex) => {
    const pageStyle = getComputedStyle(pageElement);
    const physicalSize = window.ICATLayout.getPhysicalPageSize(
      numberOr(pageStyle.width, 0),
      numberOr(pageStyle.minHeight, numberOr(pageStyle.height, 0)),
      pageElement.clientWidth,
      pageElement.clientHeight,
    );
    const { width, height } = physicalSize;
    const contentBounds = getPageContentBounds(pageElement, width, height);
    const pageRect = pageElement.getBoundingClientRect();
    const candidates = collectTextCandidates(pageElement).map((candidate, sourceIndex) => {
      const sourceElement = candidate.element;
      const rect = candidate.rect ?? getCandidateRect(sourceElement);
      const styleElement = candidate.styleElement
        || sourceElement.querySelector("p span, span, p")
        || sourceElement;
      const computedStyle = getComputedStyle(styleElement);
      const fontSizePx = numberOr(computedStyle.fontSize, 14);
      const lineHeight = normalizeLineHeight(computedStyle.lineHeight, fontSizePx);
      const runs = getCandidateRichTextRuns(candidate);
      const richText = runs.map((run) => run.text).join("");
      const text = richText || candidate.text || getCandidateText(sourceElement);
      const isFlow = isCandidateInNormalFlow(candidate, pageElement);
      const rawY = Math.max(0, rect.top - pageRect.top);
      return {
        candidate,
        sourceIndex,
        text,
        runs,
        rect,
        isFlow,
        isSequentialFlow: isSequentialFlowCandidate(candidate, pageElement, isFlow),
        rawY,
        measuredHeight: Math.max(rect.height, fontSizePx * lineHeight, MIN_SEGMENT_HEIGHT),
        computedStyle,
        fontSizePx,
        lineHeight,
        flowPlacement: null,
      };
    });
    const contentBottom = contentBounds.y + contentBounds.height;
    const sequentialLayout = window.ICATLayout.layoutSequentialFlowBoxes(
      candidates
        .filter((preparedCandidate) => preparedCandidate.isSequentialFlow)
        .map((preparedCandidate) => ({
          id: preparedCandidate.sourceIndex,
          y: preparedCandidate.rawY,
          height: preparedCandidate.measuredHeight,
          order: preparedCandidate.sourceIndex,
        })),
      height,
      contentBounds.y,
      contentBottom,
    );
    for (const preparedCandidate of candidates) {
      if (preparedCandidate.isSequentialFlow) {
        preparedCandidate.flowPlacement = sequentialLayout.placements.get(preparedCandidate.sourceIndex);
      }
    }
    const flowBottom = candidates.reduce((bottom, preparedCandidate) => {
      if (!preparedCandidate.isFlow) return bottom;
      return Math.max(bottom, preparedCandidate.rect.bottom - pageRect.top);
    }, height);
    const pageCount = Math.max(
      window.ICATLayout.getFlowPageCount(flowBottom, height, contentBounds.y),
      sequentialLayout.pageCount,
    );
    return {
      sourcePageIndex,
      element: pageElement,
      blankTemplate: pageElement.cloneNode(false),
      pageRect,
      width,
      height,
      contentBounds,
      candidates,
      pageCount,
      pages: [],
    };
  });

  state.pages = [];
  for (const sourcePage of sourcePages) {
    let previousElement = sourcePage.element;
    for (let flowPageOffset = 0; flowPageOffset < sourcePage.pageCount; flowPageOffset += 1) {
      const pageElement = flowPageOffset === 0
        ? sourcePage.element
        : sourcePage.blankTemplate.cloneNode(false);
      if (flowPageOffset > 0) {
        pageElement.classList.add("icat-flow-page");
        pageElement.removeAttribute("data-page-index");
        previousElement.parentNode.insertBefore(pageElement, previousElement.nextSibling);
        previousElement = pageElement;
      }
      const page = createPageRecord(
        pageElement,
        state.pages.length,
        sourcePage.width,
        sourcePage.height,
        sourcePage.contentBounds,
        {
          sourcePageIndex: sourcePage.sourcePageIndex,
          flowPageOffset,
        },
      );
      sourcePage.pages.push(page);
      state.pages.push(page);
    }
  }

  const wrapper = elements.docxHost.querySelector(":scope > .docx-wrapper")
    || elements.docxHost.querySelector(".docx-wrapper")
    || sourcePages[0].element.parentElement;
  const editorLayout = createEditorLayout(wrapper);
  createParkingArea(editorLayout);

  for (const sourcePage of sourcePages) {
    const accepted = [];

    sourcePage.candidates.forEach((preparedCandidate) => {
      const {
        candidate, sourceIndex, text, runs, rect, isFlow, rawY, measuredHeight,
        computedStyle, fontSizePx, lineHeight, flowPlacement,
      } = preparedCandidate;
      const sourceElement = candidate.element;
      if (!text || rect.width < 2 || rect.height < 2) return;
      if (isDuplicateCandidate(text, rect, accepted)) return;
      accepted.push({ text, rect });

      const stretchToContentWidth = isFlow && !sourceElement.closest("td, th");
      const placement = flowPlacement || (isFlow
        ? window.ICATLayout.getFlowPagePlacement(
          rawY,
          measuredHeight,
          sourcePage.height,
          sourcePage.pageCount,
          sourcePage.contentBounds.y,
        )
        : { pageOffset: 0, y: clamp(rawY, 0, sourcePage.height - MIN_SEGMENT_HEIGHT) });
      const page = sourcePage.pages[placement.pageOffset];
      const horizontalGeometry = window.ICATLayout.getSegmentHorizontalGeometry(
        rect,
        sourcePage.pageRect.left,
        page.width,
        page.contentBounds,
        stretchToContentWidth,
        MIN_SEGMENT_WIDTH,
      );
      const x = horizontalGeometry.x;
      const y = placement.y;
      const width = horizontalGeometry.width;
      const height = clamp(
        measuredHeight,
        MIN_SEGMENT_HEIGHT,
        page.height - y,
      );

      const segment = {
        id: `segment-${page.pageIndex + 1}-${sourceIndex + 1}`,
        pageId: page.id,
        pageIndex: page.pageIndex,
        text,
        runs: runs.map((run) => ({ ...run })),
        x,
        y,
        width,
        height,
        zIndex: state.segments.length + 1,
        deleted: false,
        parked: false,
        lastPageIndex: page.pageIndex,
        sourceElement,
        sourceElements: candidate.sourceElements,
        element: null,
        style: {
          fontFamily: normalizeFontFamily(computedStyle.fontFamily),
          fontSizePx,
          fontWeight: normalizeFontWeight(computedStyle.fontWeight),
          fontStyle: normalizeFontStyle(computedStyle.fontStyle),
          color: colorToHex(computedStyle.color),
          textAlign: normalizeAlignment(computedStyle.textAlign),
          lineHeight,
        },
      };

      segment.original = snapshotSegment(segment);
      hideCandidateSource(candidate);
      state.segments.push(segment);
      createSegmentElement(segment);
    });
  }

  renderPageInsertControls();
}

function createPageRecord(element, pageIndex, width, height, contentBounds, options = {}) {
  const contentBoundary = document.createElement("div");
  contentBoundary.className = "icat-content-boundary";
  contentBoundary.setAttribute("aria-hidden", "true");
  const overlay = document.createElement("div");
  overlay.className = "icat-overlay-layer";
  overlay.setAttribute("aria-label", `Редактируемый слой страницы ${pageIndex + 1}`);

  element.dataset.pageIndex = String(pageIndex);
  element.style.height = `${height}px`;
  element.style.minHeight = `${height}px`;
  overlay.style.height = `${height}px`;
  element.append(contentBoundary, overlay);

  const page = {
    id: `page-${pageIndex + 1}`,
    pageIndex,
    width,
    height,
    contentBounds: { ...contentBounds },
    contentBoundary,
    element,
    overlay,
    sourcePageIndex: options.sourcePageIndex ?? null,
    flowPageOffset: options.flowPageOffset ?? null,
    isAdded: Boolean(options.isAdded),
    insertControl: null,
  };
  element.addEventListener("pointerdown", (event) => beginMarqueeSelection(page, event));
  renderContentBoundary(page);
  return page;
}

function createEditorLayout(wrapper) {
  const layout = document.createElement("div");
  layout.className = "icat-editor-layout";
  const pagesColumn = document.createElement("div");
  pagesColumn.className = "icat-pages-column";
  wrapper.insertBefore(layout, state.pages[0].element);
  for (const page of state.pages) pagesColumn.append(page.element);
  layout.append(pagesColumn);
  return layout;
}

function createParkingArea(editorLayout) {
  const parking = document.createElement("section");
  parking.className = "icat-parking";
  parking.innerHTML = `
    <div class="icat-parking__heading">
      <strong>Вне документа</strong>
      <span>Перемещенные внутрь блока сегменты не будут учавствовать в сборке финального документа</span>
    </div>
    <div class="icat-parking__overlay" aria-label="Сегменты вне документа"></div>
  `;
  editorLayout.append(parking);
  state.parkingElement = parking;
  state.parkingOverlay = parking.querySelector(".icat-parking__overlay");
  setParkingSurfaceWidth(MIN_PARKING_WIDTH);
  setParkingSurfaceHeight(MIN_PARKING_HEIGHT);
  observeParkingResize();
}

function observeParkingResize() {
  state.parkingResizeObserver?.disconnect();
  if (!window.ResizeObserver || !state.parkingElement || !state.parkingOverlay) return;
  state.parkingResizeObserver = new ResizeObserver(([entry]) => {
    if (!entry || entry.target !== state.parkingElement) return;
    const nextWidth = clamp(Math.round(entry.contentRect.width), MIN_PARKING_WIDTH, MAX_PARKING_WIDTH);
    const nextHeight = clamp(
      Math.round(entry.contentRect.height - PARKING_HEADER_HEIGHT),
      MIN_PARKING_HEIGHT,
      MAX_PARKING_HEIGHT,
    );
    state.parkingWidth = nextWidth;
    state.parkingHeight = nextHeight;
    state.parkingOverlay.style.width = `${nextWidth}px`;
    state.parkingOverlay.style.height = `${nextHeight}px`;
  });
  state.parkingResizeObserver.observe(state.parkingElement);
}

function setParkingSurfaceWidth(width) {
  if (!state.parkingElement || !state.parkingOverlay) return false;
  const nextWidth = clamp(Math.ceil(width), MIN_PARKING_WIDTH, MAX_PARKING_WIDTH);
  if (nextWidth === state.parkingWidth) return false;
  state.parkingWidth = nextWidth;
  state.parkingElement.style.width = `${nextWidth}px`;
  state.parkingOverlay.style.width = `${nextWidth}px`;
  return true;
}

function setParkingSurfaceHeight(height) {
  if (!state.parkingElement || !state.parkingOverlay) return false;
  const nextHeight = clamp(Math.ceil(height), MIN_PARKING_HEIGHT, MAX_PARKING_HEIGHT);
  if (nextHeight === state.parkingHeight) return false;
  state.parkingHeight = nextHeight;
  state.parkingElement.style.height = `${nextHeight + PARKING_HEADER_HEIGHT}px`;
  state.parkingOverlay.style.height = `${nextHeight}px`;
  return true;
}

function ensureParkingCapacity(origins) {
  const left = Math.min(...origins.map((item) => item.x));
  const right = Math.max(...origins.map((item) => item.x + item.width));
  const top = Math.min(...origins.map((item) => item.y));
  const bottom = Math.max(...origins.map((item) => item.y + item.height));
  const widthChanged = setParkingSurfaceWidth(Math.max(state.parkingWidth, right - left));
  const heightChanged = setParkingSurfaceHeight(Math.max(state.parkingHeight, bottom - top));
  return widthChanged || heightChanged;
}

function syncParkingSurfaceHeight() {
  const parkedSegments = state.segments.filter((segment) => !segment.deleted && segment.parked);
  const contentBottom = parkedSegments.reduce(
    (bottom, segment) => Math.max(bottom, segment.y + segment.height),
    MIN_PARKING_HEIGHT,
  );
  setParkingSurfaceHeight(Math.max(state.parkingHeight, contentBottom));
}

function renderPageInsertControls() {
  for (const control of elements.docxHost.querySelectorAll(".icat-page-insert")) control.remove();
  for (const page of state.pages) {
    const control = document.createElement("div");
    control.className = "icat-page-insert";
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "icat-page-insert__add";
    addButton.textContent = "+ Добавить пустую страницу здесь";
    addButton.addEventListener("click", () => insertBlankPage(page.pageIndex));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icat-page-insert__delete";
    deleteButton.dataset.pageIndex = String(page.pageIndex);
    deleteButton.textContent = "Удалить пустую страницу";
    deleteButton.addEventListener("click", () => removeEmptyPage(page.pageIndex));
    control.append(addButton, deleteButton);
    page.element.insertAdjacentElement("afterend", control);
    page.insertControl = control;
  }
  updatePageDeleteControls();
}

function updatePageDeleteControls() {
  for (const button of elements.docxHost.querySelectorAll(".icat-page-insert__delete")) {
    const pageIndex = Number.parseInt(button.dataset.pageIndex, 10);
    const isLastPage = state.pages.length <= 1;
    const isEmpty = window.ICATLayout.isPageEmpty(state.segments, pageIndex);
    button.disabled = isLastPage || !isEmpty;
    button.title = isLastPage
      ? "В документе должна остаться хотя бы одна страница"
      : isEmpty ? "Удалить страницу" : "Сначала перенесите или удалите все сегменты страницы";
  }
}

function insertBlankPage(afterPageIndex) {
  commitActiveTextEdit();
  const referencePage = state.pages[afterPageIndex];
  if (!referencePage) return;
  const before = createHistorySnapshot();

  for (const control of elements.docxHost.querySelectorAll(".icat-page-insert")) control.remove();
  const pageElement = referencePage.element.cloneNode(false);
  pageElement.classList.remove("icat-flow-page");
  pageElement.classList.add("icat-added-page");
  pageElement.removeAttribute("data-page-index");
  referencePage.element.parentNode.insertBefore(pageElement, referencePage.element.nextSibling);

  const page = createPageRecord(
    pageElement,
    afterPageIndex + 1,
    referencePage.width,
    referencePage.height,
    referencePage.contentBounds,
    { isAdded: true },
  );
  state.pages.splice(afterPageIndex + 1, 0, page);

  for (const segment of state.segments) {
    if (!segment.parked && segment.pageIndex > afterPageIndex) segment.pageIndex += 1;
    if (segment.lastPageIndex > afterPageIndex) segment.lastPageIndex += 1;
    if (!segment.original.parked && segment.original.pageIndex > afterPageIndex) {
      segment.original.pageIndex += 1;
      segment.original.pageId = `page-${segment.original.pageIndex + 1}`;
    }
    if (segment.original.lastPageIndex > afterPageIndex) segment.original.lastPageIndex += 1;
  }
  reindexPages();
  renderPageInsertControls();
  updateSummary();
  if (commitHistory(before, "добавление страницы")) {
    state.history.entries.at(-1).insertedPage = page;
  }
  if (state.viewMode === "fit") requestAnimationFrame(fitDocumentWidth);
  showToast(`Добавлена пустая страница ${page.pageIndex + 1}`);
}

function removeEmptyPage(pageIndex) {
  commitActiveTextEdit();
  const page = state.pages[pageIndex];
  if (!page) return;
  if (state.pages.length <= 1) {
    showToast("В документе должна остаться хотя бы одна страница", "error");
    return;
  }
  if (!window.ICATLayout.isPageEmpty(state.segments, pageIndex)) {
    showToast("Страница не пустая. Сначала перенесите или удалите её сегменты.", "error");
    return;
  }

  const before = createHistorySnapshot();
  const originalSegments = state.segments.map((segment) => ({
    id: segment.id,
    original: { ...segment.original },
  }));
  for (const control of elements.docxHost.querySelectorAll(".icat-page-insert")) control.remove();
  page.element.remove();
  state.pages.splice(pageIndex, 1);

  for (const segment of state.segments) {
    if (!segment.parked) {
      segment.pageIndex = window.ICATLayout.remapPageIndexAfterRemoval(
        segment.pageIndex,
        pageIndex,
        state.pages.length,
      );
    }
    segment.lastPageIndex = window.ICATLayout.remapPageIndexAfterRemoval(
      segment.lastPageIndex,
      pageIndex,
      state.pages.length,
    );
    segment.original.pageIndex = window.ICATLayout.remapPageIndexAfterRemoval(
      segment.original.pageIndex,
      pageIndex,
      state.pages.length,
    );
    segment.original.lastPageIndex = window.ICATLayout.remapPageIndexAfterRemoval(
      segment.original.lastPageIndex,
      pageIndex,
      state.pages.length,
    );
    segment.original.pageId = Number.isInteger(segment.original.pageIndex)
      ? `page-${segment.original.pageIndex + 1}`
      : null;
  }

  reindexPages();
  renderPageInsertControls();
  updateSummary();
  if (commitHistory(before, "удаление пустой страницы")) {
    state.history.entries.at(-1).removedPage = { page, pageIndex, originalSegments };
  }
  if (state.viewMode === "fit") requestAnimationFrame(fitDocumentWidth);
  showToast(`Удалена пустая страница ${pageIndex + 1}`);
}

function reindexPages() {
  state.pages.forEach((page, pageIndex) => {
    page.pageIndex = pageIndex;
    page.id = `page-${pageIndex + 1}`;
    page.element.dataset.pageIndex = String(pageIndex);
    page.overlay.setAttribute("aria-label", `Редактируемый слой страницы ${pageIndex + 1}`);
  });
  for (const segment of state.segments) {
    if (segment.parked) continue;
    segment.pageId = state.pages[segment.pageIndex]?.id || null;
    segment.lastPageIndex = segment.pageIndex;
    renderSegmentPosition(segment);
  }
}

function collectTextCandidates(pageElement) {
  return window.ICATSegmentation.collectTextCandidates(pageElement, normalizeText);
}

function isCandidateInNormalFlow(candidate, pageElement) {
  if (candidate.kind.startsWith("shape")) return false;
  for (
    let element = candidate.element;
    element && element !== pageElement;
    element = element.parentElement
  ) {
    const position = getComputedStyle(element).position;
    if (position === "absolute" || position === "fixed") return false;
  }
  return true;
}

function isSequentialFlowCandidate(candidate, pageElement, isFlow = null) {
  if (!(isFlow ?? isCandidateInNormalFlow(candidate, pageElement))) return false;
  const sourceElement = candidate.element;
  return Boolean(sourceElement.closest("article"))
    && !sourceElement.closest("table, thead, tbody, tfoot, tr, td, th");
}

function getCandidateText(element) {
  if (element.matches("svg")) {
    const lines = Array.from(element.querySelectorAll("p"))
      .map((paragraph) => normalizeText(paragraph.textContent))
      .filter(Boolean);
    if (lines.length) return lines.join("\n");
    return Array.from(element.querySelectorAll("text"))
      .filter((textElement) => !textElement.parentElement?.closest("text"))
      .map((textElement) => normalizeText(textElement.textContent))
      .filter(Boolean)
      .join("\n");
  }
  return normalizeText(element.textContent);
}

function getCandidateRichTextRuns(candidate) {
  const rawRuns = [];
  const appendElementRuns = (element, options = {}) => {
    rawRuns.push(...window.ICATSegmentation.collectStyledTextRuns(
      element,
      getSourceRunStyle,
      options,
    ));
  };

  if (candidate.kind === "shape") {
    const paragraphs = Array.from(candidate.element.querySelectorAll("p"))
      .filter((paragraph) => !paragraph.parentElement?.closest("p"));
    const roots = paragraphs.length
      ? paragraphs
      : Array.from(candidate.element.querySelectorAll("text"))
        .filter((textElement) => !textElement.parentElement?.closest("text"));
    roots.forEach((root, index) => {
      if (index > 0) rawRuns.push({ text: "\n", ...getSourceRunStyle(root) });
      appendElementRuns(root);
    });
  } else {
    appendElementRuns(candidate.textRoot || candidate.element, {
      excludeNestedSvg: candidate.kind === "mixed-paragraph-text",
    });
  }

  return normalizeRichTextRuns(rawRuns);
}

function getSourceRunStyle(element) {
  const directStyle = getDirectRunStyle(element);
  let { backgroundColor } = directStyle;
  for (let ancestor = element.parentElement; !backgroundColor && ancestor; ancestor = ancestor.parentElement) {
    backgroundColor = normalizeBackgroundColor(getComputedStyle(ancestor).backgroundColor);
    if (ancestor.matches("p, article, header, footer")) break;
  }
  return { ...directStyle, backgroundColor };
}

function getDirectRunStyle(element) {
  const computedStyle = getComputedStyle(element);
  return {
    fontFamily: normalizeFontFamily(computedStyle.fontFamily),
    fontSizePx: numberOr(computedStyle.fontSize, 16),
    fontWeight: normalizeFontWeight(computedStyle.fontWeight),
    fontStyle: normalizeFontStyle(computedStyle.fontStyle),
    color: colorToHex(computedStyle.color),
    backgroundColor: normalizeBackgroundColor(computedStyle.backgroundColor),
  };
}

function getEditorRunStyle(element) {
  const directStyle = getDirectRunStyle(element);
  let { backgroundColor } = directStyle;
  for (let ancestor = element.parentElement; !backgroundColor && ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.classList.contains("icat-segment__content")) break;
    backgroundColor = normalizeBackgroundColor(getComputedStyle(ancestor).backgroundColor);
  }
  return { ...directStyle, backgroundColor };
}

function normalizeRichTextRuns(rawRuns) {
  const result = [];
  let pendingSpace = null;
  let newlineCount = 0;

  const append = (text, style) => {
    if (!text) return;
    const normalizedStyle = {
      fontFamily: normalizeFontFamily(style.fontFamily),
      fontSizePx: clamp(numberOr(style.fontSizePx, 16), 6, 96),
      fontWeight: normalizeFontWeight(style.fontWeight),
      fontStyle: normalizeFontStyle(style.fontStyle),
      color: style.color ? colorToHex(style.color) : "#111827",
      backgroundColor: style.backgroundColor || null,
      ...(style.tabWidthPx > 0 ? { tabWidthPx: style.tabWidthPx } : {}),
    };
    const previous = result.at(-1);
    if (previous && richRunStylesEqual(previous, normalizedStyle)) {
      previous.text += text;
    } else {
      result.push({ text, ...normalizedStyle });
    }
  };

  for (const rawRun of rawRuns || []) {
    const value = String(rawRun.text || "").replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n");
    for (const character of value) {
      if (character === " " || character === "\f" || character === "\v") {
        if (result.length && result.at(-1).text.at(-1) !== "\n" && !pendingSpace) pendingSpace = rawRun;
        continue;
      }
      if (character === "\n") {
        pendingSpace = null;
        if (result.length && newlineCount < 2) append("\n", rawRun);
        newlineCount += 1;
        continue;
      }
      if (character === "\t") {
        pendingSpace = null;
        append("\t", rawRun);
        newlineCount = 0;
        continue;
      }
      if (pendingSpace) append(" ", pendingSpace);
      pendingSpace = null;
      append(character, rawRun);
      newlineCount = 0;
    }
  }

  while (result.length && /^[\n ]+$/.test(result.at(-1).text)) result.pop();
  if (result.length) result.at(-1).text = result.at(-1).text.replace(/[\n ]+$/g, "");
  return result.filter((run) => run.text);
}

function richRunStylesEqual(first, second) {
  return first.fontFamily === second.fontFamily
    && first.fontSizePx === second.fontSizePx
    && first.fontWeight === second.fontWeight
    && first.fontStyle === second.fontStyle
    && first.color === second.color
    && first.backgroundColor === second.backgroundColor
    && Number(first.tabWidthPx || 0) === Number(second.tabWidthPx || 0);
}

function hideCandidateSource(candidate) {
  for (const sourceElement of candidate.sourceElements) {
    sourceElement.classList.add("icat-source-hidden");
  }
  for (const textNode of candidate.sourceTextNodes) {
    if (!textNode.isConnected || textNode.parentElement?.closest(".icat-source-hidden")) continue;
    const wrapper = document.createElement("span");
    wrapper.className = "icat-source-hidden";
    textNode.parentNode.insertBefore(wrapper, textNode);
    wrapper.append(textNode);
  }
}

function getCandidateRect(element) {
  const rect = element.getBoundingClientRect();
  if (rect.width >= 2 && rect.height >= 2) return rect;
  const children = Array.from(element.querySelectorAll("p"))
    .map((paragraph) => paragraph.getBoundingClientRect())
    .filter((candidate) => candidate.width >= 2 && candidate.height >= 2);
  if (!children.length) return rect;
  const left = Math.min(...children.map((candidate) => candidate.left));
  const top = Math.min(...children.map((candidate) => candidate.top));
  const right = Math.max(...children.map((candidate) => candidate.right));
  const bottom = Math.max(...children.map((candidate) => candidate.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function isDuplicateCandidate(text, rect, accepted) {
  return accepted.some((candidate) => (
    candidate.text === text
    && window.ICATLayout.rectangleOverlapRatio(rect, candidate.rect) >= 0.75
  ));
}

function getPageContentBounds(pageElement, pageWidth, pageHeight) {
  const style = getComputedStyle(pageElement);
  let left = numberOr(style.paddingLeft, 0);
  let right = numberOr(style.paddingRight, 0);
  let top = numberOr(style.paddingTop, 0);
  let bottom = numberOr(style.paddingBottom, 0);

  if (left + right < 2) {
    const article = pageElement.querySelector(":scope > article");
    if (article) {
      const pageRect = pageElement.getBoundingClientRect();
      const articleRect = article.getBoundingClientRect();
      left = Math.max(0, articleRect.left - pageRect.left);
      right = Math.max(0, pageRect.right - articleRect.right);
      top = Math.max(0, articleRect.top - pageRect.top);
    }
  }

  return {
    x: left,
    y: top,
    width: Math.max(20, pageWidth - left - right),
    height: Math.max(20, pageHeight - top - bottom),
    bottomInset: bottom,
  };
}

function createSegmentElement(segment) {
  const page = state.pages[segment.pageIndex];
  const segmentElement = document.createElement("div");
  segmentElement.className = "icat-segment";
  segmentElement.dataset.segmentId = segment.id;

  const tools = document.createElement("div");
  tools.className = "icat-segment__tools";

  const dragButton = document.createElement("button");
  dragButton.type = "button";
  dragButton.className = "icat-segment__button icat-segment__drag";
  dragButton.title = "Переместить сегмент";
  dragButton.setAttribute("aria-label", "Переместить сегмент");
  dragButton.textContent = "⠿";

  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "icat-segment__button icat-segment__more";
  menuButton.title = "Действия с сегментом";
  menuButton.setAttribute("aria-label", "Открыть меню сегмента");
  menuButton.textContent = "⋮";

  tools.append(dragButton, menuButton);

  const content = document.createElement("div");
  content.className = "icat-segment__content";
  content.contentEditable = "true";
  content.spellcheck = true;
  applyTypography(content, segment.style);
  renderSegmentText(content, segment);

  const menu = createSegmentMenu(segment);

  const cellBadge = document.createElement("span");
  cellBadge.className = "icat-segment__cell";

  const resizeHandle = document.createElement("button");
  resizeHandle.type = "button";
  resizeHandle.className = "icat-segment__resize";
  resizeHandle.title = "Изменить размер";
  resizeHandle.setAttribute("aria-label", "Изменить размер сегмента");

  segmentElement.append(tools, content, menu, cellBadge, resizeHandle);
  page.overlay.append(segmentElement);
  segment.element = segmentElement;
  renderSegmentPosition(segment);

  segmentElement.addEventListener("pointerdown", () => {
    if (!state.selectedIds.has(segment.id)) selectSegment(segment.id);
  });
  content.addEventListener("focus", () => {
    beginTextEdit(segment);
    selectSegment(segment.id);
    rememberActiveEditorSelection();
  });
  content.addEventListener("input", () => {
    syncSegmentTextFromEditor(segment, content);
    growSegmentToFit(segment, content);
    updateEditorToolbarState(segment);
    updateSummary();
  });
  content.addEventListener("blur", () => commitActiveTextEdit());
  content.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    runEditorAction(segment, content, "insert-tab");
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !menu.classList.contains("is-open");
    closeAllMenus();
    menu.classList.toggle("is-open", willOpen);
    segmentElement.classList.toggle("is-menu-open", willOpen);
    if (!state.selectedIds.has(segment.id)) selectSegment(segment.id);
    menuButton.blur();
  });
  menuButton.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  attachDragBehavior(segment, dragButton);
  attachResizeBehavior(segment, resizeHandle);
}

function syncSegmentTextFromEditor(segment, content) {
  segment.runs = normalizeRichTextRuns(
    window.ICATSegmentation.collectStyledTextRuns(content, getEditorRunStyle),
  );
  segment.text = segment.runs.map((run) => run.text).join("")
    || normalizeEditableText(content.innerText);
}

function getSelectedEditorTarget() {
  const segment = state.segments.find((candidate) => (
    candidate.id === state.selectedId && !candidate.deleted
  ));
  const content = segment?.element?.querySelector(".icat-segment__content");
  return segment && content ? { segment, content } : null;
}

function runSelectedEditorAction(action, value = null) {
  const target = getSelectedEditorTarget();
  if (!target) return;
  restoreActiveEditorSelection(target.content, target.segment.id);
  runEditorAction(target.segment, target.content, action, value);
}

function rememberActiveEditorSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const content = node?.closest?.(".icat-segment__content");
  const segmentElement = content?.closest(".icat-segment");
  if (!content || !segmentElement) return;
  state.savedEditorRange = {
    segmentId: segmentElement.dataset.segmentId,
    range: range.cloneRange(),
  };
}

function restoreActiveEditorSelection(content, segmentId) {
  const saved = state.savedEditorRange;
  if (!saved || saved.segmentId !== segmentId) return false;
  const commonNode = saved.range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? saved.range.commonAncestorContainer
    : saved.range.commonAncestorContainer.parentElement;
  if (!commonNode?.isConnected || !content.contains(commonNode)) return false;
  const selection = window.getSelection();
  content.focus({ preventScroll: true });
  selection.removeAllRanges();
  selection.addRange(saved.range);
  return true;
}

function runEditorAction(segment, content, action, value = null) {
  commitActiveTextEdit();
  const before = createHistorySnapshot();
  if (action === "bold" || action === "italic") {
    selectEditorTextIfNeeded(content);
    document.execCommand(action, false);
    syncSegmentTextFromEditor(segment, content);
    growSegmentToFit(segment, content);
  } else if (action === "font-size") {
    const fontSizePx = clamp(Number(value) * (96 / 72), 6, 96);
    selectEditorTextIfNeeded(content);
    applyEditorFontSize(content, fontSizePx);
    syncSegmentTextFromEditor(segment, content);
    growSegmentToFit(segment, content);
  } else if (action === "insert-tab") {
    ensureEditorCaret(content);
    insertEditorTab(content, segment);
    syncSegmentTextFromEditor(segment, content);
    growSegmentToFit(segment, content);
  } else {
    const alignment = {
      "align-left": "left",
      "align-center": "center",
      "align-right": "right",
    }[action];
    if (!alignment) return;
    segment.style.textAlign = alignment;
    content.style.textAlign = alignment;
  }
  updateEditorToolbarState(segment);
  updateSummary();
  commitHistory(before, describeEditorAction(action));
  if (document.activeElement === content) {
    rememberActiveEditorSelection();
    beginTextEdit(segment);
  }
}

function selectEditorTextIfNeeded(content) {
  const selection = window.getSelection();
  if (!selection) return;
  restoreActiveEditorSelection(content, content.closest(".icat-segment")?.dataset.segmentId);
  const activeRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const insideEditor = activeRange && content.contains(
    activeRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? activeRange.commonAncestorContainer
      : activeRange.commonAncestorContainer.parentElement,
  );
  if (insideEditor && !activeRange.collapsed) return;
  content.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(content);
  selection.removeAllRanges();
  selection.addRange(range);
}

function ensureEditorCaret(content) {
  const segmentId = content.closest(".icat-segment")?.dataset.segmentId;
  if (restoreActiveEditorSelection(content, segmentId)) return;
  const selection = window.getSelection();
  content.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function applyEditorFontSize(content, fontSizePx) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  const selectedContent = range.extractContents();
  const wrapper = document.createElement("span");
  wrapper.style.fontSize = `${fontSizePx}px`;
  wrapper.append(selectedContent);
  range.insertNode(wrapper);
  range.selectNodeContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertEditorTab(content, segment) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const tab = document.createElement("span");
  tab.className = "icat-segment__run icat-segment__tab";
  tab.style.width = `${Math.max(24, segment.style.fontSizePx * 4)}px`;
  tab.textContent = "\t";
  range.insertNode(tab);
  range.setStartAfter(tab);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function updateEditorToolbarState(segment) {
  const activeSegment = segment && !segment.deleted ? segment : null;
  const runs = activeSegment?.runs || [];
  const allBold = runs.length > 0 && runs.every((run) => Number(run.fontWeight) >= 600);
  const allItalic = runs.length > 0 && runs.every((run) => run.fontStyle === "italic");
  const states = {
    bold: allBold,
    italic: allItalic,
    "align-left": activeSegment?.style.textAlign === "left",
    "align-center": activeSegment?.style.textAlign === "center",
    "align-right": activeSegment?.style.textAlign === "right",
  };
  elements.editorToolbar.setAttribute("aria-disabled", String(!activeSegment));
  for (const button of elements.editorActionButtons) {
    button.disabled = !activeSegment;
    button.setAttribute("aria-pressed", String(Boolean(states[button.dataset.editorAction])));
  }
  elements.editorFontSize.disabled = !activeSegment;
  if (activeSegment) {
    const representativeSize = numberOr(runs[0]?.fontSizePx, activeSegment.style.fontSizePx);
    const points = Math.round(representativeSize * 0.75);
    const closest = Array.from(elements.editorFontSize.options).reduce((best, option) => (
      Math.abs(Number(option.value) - points) < Math.abs(Number(best.value) - points) ? option : best
    ));
    elements.editorFontSize.value = closest.value;
  }
}

function describeEditorAction(action) {
  return {
    bold: "изменение жирности текста",
    italic: "изменение курсива текста",
    "align-left": "выравнивание текста по левому краю",
    "align-center": "выравнивание текста по центру",
    "align-right": "выравнивание текста по правому краю",
    "font-size": "изменение размера шрифта",
    "insert-tab": "вставка табуляции",
  }[action] || "форматирование текста";
}

function createSegmentMenu(segment) {
  const menu = document.createElement("div");
  menu.className = "icat-segment__menu";
  menu.setAttribute("role", "menu");

  const actions = [
    ["reset", "Вернуть в исходное положение в документе"],
    ["delete", "Удалить сегмент"],
  ];

  for (const [action, label] of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;
    if (action === "delete") button.className = "is-danger";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      runSegmentAction(segment, action);
      closeAllMenus();
      button.blur();
    });
    menu.append(button);
  }

  return menu;
}

function runSegmentAction(segment, action) {
  commitActiveTextEdit();
  const before = createHistorySnapshot();
  const targets = window.ICATLayout.getSegmentActionTargets(
    state.segments,
    state.selectedIds,
    segment.id,
  );
  if (action === "reset") {
    const restoredIds = [];
    for (const target of targets) {
      const original = target.original;
      const originalPage = state.pages[original.pageIndex];
      if (!originalPage) continue;
      Object.assign(target, {
        pageId: originalPage.id,
        pageIndex: originalPage.pageIndex,
        x: clamp(original.x, 0, Math.max(0, originalPage.width - target.width)),
        y: clamp(original.y, 0, Math.max(0, originalPage.height - target.height)),
        deleted: false,
        parked: false,
        lastPageIndex: originalPage.pageIndex,
      });
      originalPage.overlay.append(target.element);
      renderSegmentPosition(target);
      restoredIds.push(target.id);
    }
    syncParkingSurfaceHeight();
    selectSegments(restoredIds, segment.id);
    updateSummary();
    showToast(targets.length > 1
      ? `В исходное положение возвращено сегментов: ${restoredIds.length}`
      : "Сегмент возвращён в исходное положение");
  } else if (action === "delete") {
    for (const target of targets) {
      target.deleted = true;
      target.element.remove();
    }
    syncParkingSurfaceHeight();
    selectSegments([]);
    updateSummary();
    showToast(targets.length > 1
      ? `Удалено сегментов: ${targets.length}`
      : "Сегмент удалён из результата");
  }
  const label = targets.length > 1
    ? action === "reset" ? "групповой возврат в исходное положение" : "групповое удаление сегментов"
    : describeSegmentAction(action);
  commitHistory(before, label);
}

function getSegmentSurface(segment) {
  if (segment.parked) {
    return {
      kind: "parking",
      element: state.parkingElement,
      overlay: state.parkingOverlay,
      width: state.parkingOverlay?.clientWidth || 1,
      height: state.parkingOverlay?.clientHeight || 1,
    };
  }
  const page = state.pages[segment.pageIndex];
  return page ? {
    kind: "page",
    page,
    element: page.element,
    overlay: page.overlay,
    width: page.width,
    height: page.height,
  } : null;
}

function measureDropSurfaces() {
  const surfaces = state.pages.map((page) => ({
    kind: "page",
    page,
    element: page.element,
    overlay: page.overlay,
    width: page.width,
    height: page.height,
    rectangle: page.element.getBoundingClientRect(),
  }));
  if (state.parkingOverlay) {
    surfaces.push({
      kind: "parking",
      element: state.parkingElement,
      overlay: state.parkingOverlay,
      width: state.parkingOverlay.clientWidth,
      height: state.parkingHeight,
      rectangle: state.parkingOverlay.getBoundingClientRect(),
    });
  }
  return surfaces;
}

function findDropSurface(clientX, clientY, surfaces) {
  return surfaces.find((surface) => pointInsideRectangle(clientX, clientY, surface.rectangle)) || null;
}

function pointInsideRectangle(x, y, rectangle) {
  return x >= rectangle.left && x <= rectangle.right && y >= rectangle.top && y <= rectangle.bottom;
}

function surfacePointFromCoordinates(surface, clientX, clientY) {
  return window.ICATLayout.surfacePointFromCoordinates(
    surface.rectangle,
    clientX,
    clientY,
    state.viewScale,
    surface.width,
    surface.height,
  );
}

function showDropTarget(surface) {
  const nextElement = surface?.element || null;
  if (state.dropTargetElement === nextElement) return;
  state.dropTargetElement?.classList.remove("is-drop-target");
  nextElement?.classList.add("is-drop-target");
  state.dropTargetElement = nextElement;
}

function attachDragBehavior(segment, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    handle.blur();
    if (!state.selectedIds.has(segment.id)) selectSegment(segment.id);
    closeAllMenus();
    commitActiveTextEdit();
    const before = createHistorySnapshot();

    const selectedSegments = state.segments.filter(
      (candidate) => !candidate.deleted
        && candidate.parked === segment.parked
        && (segment.parked || candidate.pageIndex === segment.pageIndex)
        && state.selectedIds.has(candidate.id),
    );
    const origins = selectedSegments.map((candidate) => ({
      segment: candidate,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
    }));
    let dropSurfaces = measureDropSurfaces();
    const sourceSurface = dropSurfaces.find((surface) => (
      segment.parked ? surface.kind === "parking" : surface.page === state.pages[segment.pageIndex]
    ));
    if (!sourceSurface) return;
    const primaryOrigin = origins.find((item) => item.segment === segment);
    const startPoint = surfacePointFromCoordinates(
      sourceSurface,
      event.clientX,
      event.clientY,
    );
    const pointerOffset = { x: startPoint.x - segment.x, y: startPoint.y - segment.y };
    let activeSurface = sourceSurface;
    let pendingPoint = null;
    let lastPointer = { clientX: event.clientX, clientY: event.clientY };
    let surfacesDirty = false;
    let animationFrame = null;
    for (const item of origins) item.segment.element.classList.add("is-dragging");

    const applyMove = (pointEvent) => {
      let targetSurface = findDropSurface(pointEvent.clientX, pointEvent.clientY, dropSurfaces);
      if (!targetSurface) return;
      if (targetSurface.kind === "parking" && ensureParkingCapacity(origins)) {
        dropSurfaces = measureDropSurfaces();
        targetSurface = findDropSurface(pointEvent.clientX, pointEvent.clientY, dropSurfaces);
        if (!targetSurface) return;
      }
      showDropTarget(targetSurface);
      const point = surfacePointFromCoordinates(
        targetSurface,
        pointEvent.clientX,
        pointEvent.clientY,
      );
      const requestedDeltaX = snap(point.x - pointerOffset.x) - primaryOrigin.x;
      const requestedDeltaY = snap(point.y - pointerOffset.y) - primaryOrigin.y;
      const clampedDelta = window.ICATLayout.clampGroupDelta(
        origins,
        requestedDeltaX,
        requestedDeltaY,
        targetSurface.width,
        targetSurface.height,
      );
      for (const item of origins) {
        const surfaceChanged = item.segment.element.parentElement !== targetSurface.overlay;
        if (targetSurface.kind === "parking") {
          if (!item.segment.parked) item.segment.lastPageIndex = item.segment.pageIndex;
          item.segment.parked = true;
          item.segment.pageIndex = null;
          item.segment.pageId = null;
        } else {
          item.segment.parked = false;
          item.segment.pageIndex = targetSurface.page.pageIndex;
          item.segment.pageId = targetSurface.page.id;
          item.segment.lastPageIndex = targetSurface.page.pageIndex;
        }
        if (surfaceChanged) targetSurface.overlay.append(item.segment.element);
        item.segment.x = item.x + clampedDelta.x;
        item.segment.y = item.y + clampedDelta.y;
        if (surfaceChanged) {
          renderSegmentPosition(item.segment);
        } else {
          renderSegmentCoordinates(item.segment);
        }
      }
      activeSurface = targetSurface;
    };

    const flushMove = () => {
      animationFrame = null;
      if (!pendingPoint) return;
      if (surfacesDirty) {
        dropSurfaces = measureDropSurfaces();
        surfacesDirty = false;
      }
      const pointEvent = pendingPoint;
      pendingPoint = null;
      applyMove(pointEvent);
    };

    const move = (moveEvent) => {
      if (moveEvent.pointerId !== event.pointerId) return;
      lastPointer = { clientX: moveEvent.clientX, clientY: moveEvent.clientY };
      pendingPoint = lastPointer;
      if (animationFrame === null) animationFrame = requestAnimationFrame(flushMove);
    };

    const refreshDragAfterScroll = () => {
      surfacesDirty = true;
      pendingPoint = lastPointer;
      if (animationFrame === null) animationFrame = requestAnimationFrame(flushMove);
    };

    const finish = (finishEvent) => {
      if (finishEvent.pointerId !== event.pointerId) return;
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
      if (pendingPoint) flushMove();
      showDropTarget(null);
      for (const item of origins) {
        item.segment.element.classList.remove("is-dragging");
        renderSegmentPosition(item.segment);
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("scroll", refreshDragAfterScroll, true);
      elements.workspace.removeEventListener("scroll", refreshDragAfterScroll);
      updateSummary();
      syncParkingSurfaceHeight();
      const label = activeSurface.kind === "parking"
        ? "вынос сегментов из документа"
        : origins.length > 1 ? "групповое перемещение" : "перемещение сегмента";
      commitHistory(before, label);
      if (activeSurface.kind === "parking") {
        showToast(`Вне документа: ${origins.length}. Эти сегменты не попадут в экспорт.`);
      } else if (origins.length > 1) {
        showToast(`Перемещено сегментов: ${origins.length}`);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("scroll", refreshDragAfterScroll, true);
    elements.workspace.addEventListener("scroll", refreshDragAfterScroll, { passive: true });
  });
}

function attachResizeBehavior(segment, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    selectSegment(segment.id);
    commitActiveTextEdit();
    const before = createHistorySnapshot();

    const surface = getSegmentSurface(segment);
    if (!surface) return;
    const origin = {
      clientX: event.clientX,
      clientY: event.clientY,
      width: segment.width,
      height: segment.height,
    };
    handle.setPointerCapture(event.pointerId);
    segment.element.classList.add("is-resizing");

    const move = (moveEvent) => {
      const deltaX = window.ICATLayout.screenDeltaToDocument(
        moveEvent.clientX - origin.clientX,
        state.viewScale,
      );
      const deltaY = window.ICATLayout.screenDeltaToDocument(
        moveEvent.clientY - origin.clientY,
        state.viewScale,
      );
      segment.width = clamp(
        snapUp(origin.width + deltaX),
        MIN_SEGMENT_WIDTH,
        surface.width - segment.x,
      );
      segment.height = clamp(
        snapUp(origin.height + deltaY),
        MIN_SEGMENT_HEIGHT,
        surface.height - segment.y,
      );
      renderSegmentPosition(segment);
      updateSelectedDetails();
    };

    const finish = () => {
      segment.element.classList.remove("is-resizing");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      updateSummary();
      commitHistory(before, "изменение размера сегмента");
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });
}

function growSegmentToFit(segment, content) {
  const surface = getSegmentSurface(segment);
  if (!surface) return;
  const desiredHeight = snapUp(content.scrollHeight);
  if (desiredHeight > segment.height) {
    segment.height = clamp(desiredHeight, MIN_SEGMENT_HEIGHT, surface.height - segment.y);
    renderSegmentPosition(segment);
  }
}

function renderSegmentCoordinates(segment) {
  if (!segment.element) return;
  segment.element.style.left = `${segment.x}px`;
  segment.element.style.top = `${segment.y}px`;
}

function renderSegmentGeometry(segment) {
  if (!segment.element) return;
  renderSegmentCoordinates(segment);
  Object.assign(segment.element.style, {
    width: `${segment.width}px`,
    height: `${segment.height}px`,
    zIndex: String(segment.zIndex),
  });
}

function renderSegmentPosition(segment) {
  if (!segment.element) return;
  renderSegmentGeometry(segment);
  segment.element.querySelector(".icat-segment__tools")
    ?.classList.toggle("is-inside", segment.y < 34);
  segment.element.classList.toggle("is-parked", segment.parked);
  segment.element.classList.toggle("is-in-page-margin", !segment.parked && !isInsideWordTextArea(segment));
  const cell = getCellReference(segment);
  segment.element.querySelector(".icat-segment__cell").textContent = cell.id;
}

function selectSegment(segmentId) {
  selectSegments([segmentId], segmentId);
}

function selectSegments(segmentIds, primaryId = null) {
  const activeIds = new Set(
    segmentIds.filter((segmentId) => state.segments.some(
      (segment) => segment.id === segmentId && !segment.deleted,
    )),
  );
  state.selectedIds = activeIds;
  state.selectedId = activeIds.has(primaryId) ? primaryId : activeIds.values().next().value || null;
  for (const segment of state.segments) {
    segment.element?.classList.toggle("is-selected", activeIds.has(segment.id));
  }
  updateEditorToolbarState(
    state.segments.find((segment) => segment.id === state.selectedId && !segment.deleted) || null,
  );
  updateSelectedDetails();
}

function beginMarqueeSelection(page, event) {
  if (event.button !== 0 || state.loading || !state.pages.length) return;
  if (event.target.closest(".icat-segment, button, input, select, a, [contenteditable='true']")) return;
  event.preventDefault();
  closeAllMenus();

  const additive = event.shiftKey || event.ctrlKey || event.metaKey;
  const originalIds = additive ? new Set(state.selectedIds) : new Set();
  const start = pagePointFromEvent(page, event);
  const selectionBox = document.createElement("div");
  selectionBox.className = "icat-selection-box";
  page.overlay.append(selectionBox);
  page.element.classList.add("is-lasso-selecting");
  page.element.setPointerCapture(event.pointerId);
  let dragged = false;

  const move = (moveEvent) => {
    const current = pagePointFromEvent(page, moveEvent);
    const rectangle = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };
    dragged ||= rectangle.width * state.viewScale >= 4 || rectangle.height * state.viewScale >= 4;
    Object.assign(selectionBox.style, {
      left: `${rectangle.x}px`,
      top: `${rectangle.y}px`,
      width: `${rectangle.width}px`,
      height: `${rectangle.height}px`,
    });
    if (!dragged) return;

    const nextIds = new Set(originalIds);
    for (const segment of state.segments) {
      if (segment.deleted || segment.pageIndex !== page.pageIndex) continue;
      if (window.ICATLayout.rectanglesIntersect(rectangle, segment)) nextIds.add(segment.id);
    }
    selectSegments([...nextIds]);
  };

  const finish = () => {
    selectionBox.remove();
    page.element.classList.remove("is-lasso-selecting");
    page.element.removeEventListener("pointermove", move);
    page.element.removeEventListener("pointerup", finish);
    page.element.removeEventListener("pointercancel", finish);
    if (!dragged && !additive) selectSegments([]);
    if (dragged && state.selectedIds.size) showToast(`Выбрано сегментов: ${state.selectedIds.size}`);
  };

  page.element.addEventListener("pointermove", move);
  page.element.addEventListener("pointerup", finish);
  page.element.addEventListener("pointercancel", finish);
}

function pagePointFromEvent(page, event) {
  const rectangle = page.element.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rectangle.left) / state.viewScale, 0, page.width),
    y: clamp((event.clientY - rectangle.top) / state.viewScale, 0, page.height),
  };
}

function isInsideWordTextArea(segment) {
  if (segment.parked) return false;
  const bounds = state.pages[segment.pageIndex]?.contentBounds;
  if (!bounds) return false;
  return segment.x >= bounds.x
    && segment.y >= bounds.y
    && segment.x + segment.width <= bounds.x + bounds.width
    && segment.y + segment.height <= bounds.y + bounds.height;
}

function updateSelectedDetails() {
  const segment = state.segments.find(
    (candidate) => candidate.id === state.selectedId && !candidate.deleted,
  );

  if (!segment) {
    elements.selectionEmpty.hidden = false;
    elements.selectionDetails.hidden = true;
    return;
  }

  const cell = getCellReference(segment);
  elements.selectionEmpty.hidden = true;
  elements.selectionDetails.hidden = false;
  elements.selectionId.textContent = segment.id;
  elements.selectionCount.textContent = String(state.selectedIds.size);
  elements.selectionPage.textContent = segment.parked ? "—" : String(cell.pageIndex + 1);
  elements.selectionCell.textContent = cell.id;
  elements.selectionPosition.textContent = segment.parked
    ? "— (вне документа)"
    : `${formatGeometry(segment.x)} × ${formatGeometry(segment.y)} px`;
  elements.selectionSize.textContent = `${formatGeometry(segment.width)} × ${formatGeometry(segment.height)} px`;
  elements.selectionArea.textContent = segment.parked
    ? "Вне документа — не экспортируется"
    : isInsideWordTextArea(segment) ? "Текстовая область" : "Поле страницы";
}

function updateSummary() {
  const activeSegments = state.segments.filter(window.ICATLayout.isDocumentSegment);
  const parkedSegments = state.segments.filter((segment) => !segment.deleted && segment.parked);
  const overlaps = getSegmentOverlaps();
  elements.documentName.textContent = state.fileName || "Документ не открыт";
  elements.pageCount.textContent = String(state.pages.length);
  elements.segmentCount.textContent = String(activeSegments.length);
  elements.parkedCount.textContent = String(parkedSegments.length);
  elements.overlapCount.textContent = String(overlaps.length);
  elements.overlapCount.closest("div")?.classList.toggle("has-warning", overlaps.length > 0);
  elements.exportButton.disabled = state.loading || activeSegments.length === 0;
  elements.resolveOverlaps.disabled = state.loading || overlaps.length === 0;
  updatePageDeleteControls();
  updateSelectedDetails();
}

function getSegmentOverlaps() {
  return window.ICATLayout.findSegmentOverlaps(
    state.segments.filter(window.ICATLayout.isDocumentSegment),
    0.12,
  );
}

function resolveSegmentOverlaps() {
  commitActiveTextEdit();
  const before = createHistorySnapshot();
  const activeSegments = state.segments.filter(window.ICATLayout.isDocumentSegment);
  const placements = window.ICATLayout.resolveVerticalOverlaps(
    activeSegments,
    state.gridSize,
    0.12,
  );
  let moved = 0;
  for (const segment of activeSegments) {
    const nextY = placements.get(segment.id);
    const page = state.pages[segment.pageIndex];
    const boundedY = Number.isFinite(nextY)
      ? clamp(nextY, 0, Math.max(0, page.height - segment.height))
      : segment.y;
    if (Math.abs(boundedY - segment.y) >= 0.5) {
      segment.y = boundedY;
      renderSegmentPosition(segment);
      moved += 1;
    }
  }
  updateSummary();
  commitHistory(before, "разнесение наложений");
  showToast(moved ? `Разнесено сегментов: ${moved}` : "Значимых наложений не найдено");
}

function setGridSize(value) {
  state.gridSize = clamp(Math.round(value || DEFAULT_GRID_SIZE), 1, 96);
  const majorGridSize = Math.max(16, state.gridSize * 4);
  elements.gridSize.value = String(state.gridSize);
  elements.workspace.style.setProperty("--grid-size", `${state.gridSize}px`);
  elements.workspace.style.setProperty("--major-grid-size", `${majorGridSize}px`);
  elements.gridHint.textContent = `Сетка отображается только на листах. Шаг ${state.gridSize} px применяется при перемещении и изменении размера.`;
  for (const segment of state.segments) renderSegmentPosition(segment);
  updateSelectedDetails();
}

function handleWorkspaceZoom(event) {
  if (!(event.ctrlKey || event.metaKey) || !state.pages.length) return;
  event.preventDefault();
  const direction = event.deltaY < 0 ? 1 : -1;
  const nextPercent = state.viewScale * 100 + direction * 10;
  setViewScale(nextPercent, { clientX: event.clientX, clientY: event.clientY });
}

function setViewScale(percent, anchor = null) {
  const wrapper = elements.docxHost.querySelector(":scope > .docx-wrapper")
    || elements.docxHost.querySelector(".docx-wrapper");
  const zoomAnchor = anchor && wrapper
    ? window.ICATLayout.captureZoomAnchor(
      wrapper.getBoundingClientRect(),
      anchor.clientX,
      anchor.clientY,
    )
    : null;
  state.viewMode = "manual";
  state.viewScale = clamp((Number(percent) || 100) / 100, 0.25, 2.5);
  applyViewScale();
  if (zoomAnchor && wrapper) {
    const adjustment = window.ICATLayout.getZoomScrollAdjustment(
      zoomAnchor,
      wrapper.getBoundingClientRect(),
    );
    elements.workspace.scrollLeft += adjustment.x;
    elements.workspace.scrollTop += adjustment.y;
  }
}

function fitDocumentWidth() {
  const wrapper = elements.docxHost.querySelector(":scope > .docx-wrapper")
    || elements.docxHost.querySelector(".docx-wrapper");
  if (!wrapper || !state.pages.length) return;
  const wrapperStyle = getComputedStyle(wrapper);
  const padding = numberOr(wrapperStyle.paddingLeft, 0) + numberOr(wrapperStyle.paddingRight, 0);
  const editorLayout = wrapper.querySelector(":scope > .icat-editor-layout");
  const layoutStyle = editorLayout ? getComputedStyle(editorLayout) : null;
  const layoutGap = numberOr(layoutStyle?.columnGap, 0);
  const documentWidth = Math.max(...state.pages.map((page) => page.width))
    + state.parkingWidth
    + layoutGap
    + padding;
  const availableWidth = Math.max(240, elements.workspace.clientWidth - 24);
  state.viewMode = "fit";
  state.viewScale = clamp(availableWidth / documentWidth, 0.25, 2.5);
  applyViewScale();
}

function applyViewScale() {
  const percent = Math.round(state.viewScale * 100);
  elements.viewScale.value = String(Math.round(state.viewScale * 100));
  const wrapper = elements.docxHost.querySelector(":scope > .docx-wrapper")
    || elements.docxHost.querySelector(".docx-wrapper");
  if (wrapper) wrapper.style.zoom = String(state.viewScale);
  elements.zoomValue.textContent = `${percent}%`;
  elements.fitWidth.classList.toggle("is-active", state.viewMode === "fit");
  elements.viewScaleHint.textContent = `${state.viewMode === "fit" ? "По ширине поля" : "Ручной зум"} — ${percent}%. Cmd/Ctrl + колесо меняет зум под курсором; экспорт остаётся в масштабе 100%.`;
}

function renderContentBoundary(page) {
  const bounds = page.contentBounds;
  Object.assign(page.contentBoundary.style, {
    left: `${bounds.x}px`,
    top: `${bounds.y}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
  });
}

async function exportDocument() {
  commitActiveTextEdit();
  const activeSegments = state.segments.filter(window.ICATLayout.isDocumentSegment);
  if (!activeSegments.length) {
    showToast("В документе нет сегментов для экспорта. Верните хотя бы один блок из области «Вне документа».", "error");
    return;
  }

  const payload = createExportPayload(activeSegments);

  const originalLabel = elements.exportButton.textContent;
  elements.exportButton.disabled = true;
  elements.exportButton.textContent = "Собираем DOCX…";

  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Не удалось собрать документ");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sanitizeFileName(state.title)}-edited.docx`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("DOCX собран и передан на скачивание");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    elements.exportButton.textContent = originalLabel;
    updateSummary();
  }
}

function setLoading(isLoading, message = "Обрабатываем документ…") {
  state.loading = isLoading;
  elements.loading.hidden = !isLoading;
  elements.uploadButton.hidden = isLoading || state.pages.length > 0;
  elements.loadingText.textContent = message;
  if (isLoading) {
    elements.dropZone.hidden = true;
    elements.documentStage.hidden = true;
  }
  updateSummary();
}

function closeAllMenus() {
  for (const segment of state.segments) {
    if (!segment.element) continue;
    segment.element.querySelector(".icat-segment__menu")?.classList.remove("is-open");
    segment.element.classList.remove("is-menu-open");
  }
}

let toastTimer;
function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.toggle("is-error", type === "error");
  elements.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3600);
}

function snapshotSegment(segment) {
  return {
    pageId: segment.pageId,
    pageIndex: segment.pageIndex,
    text: segment.text,
    runs: (segment.runs || []).map((run) => ({ ...run })),
    style: { ...segment.style },
    x: segment.x,
    y: segment.y,
    width: segment.width,
    height: segment.height,
    deleted: segment.deleted,
    parked: segment.parked,
    lastPageIndex: segment.lastPageIndex,
  };
}

function createHistorySnapshot() {
  return {
    pages: state.pages.map((page) => ({ id: page.id, isAdded: page.isAdded })),
    segments: state.segments.map((segment) => ({ id: segment.id, ...snapshotSegment(segment) })),
    selectedIds: [...state.selectedIds],
    selectedId: state.selectedId,
  };
}

function historyDocumentSignature(snapshot) {
  return JSON.stringify({ pages: snapshot.pages, segments: snapshot.segments });
}

function commitHistory(before, label) {
  if (!before || state.restoringHistory) return false;
  const after = createHistorySnapshot();
  return window.ICATHistory.record(
    state.history,
    before,
    after,
    label,
    historyDocumentSignature,
  );
}

function clearHistory() {
  window.ICATHistory.clear(state.history);
  state.activeTextEdit = null;
}

function beginTextEdit(segment) {
  if (state.restoringHistory || state.activeTextEdit?.segmentId === segment.id) return;
  commitActiveTextEdit();
  state.activeTextEdit = {
    segmentId: segment.id,
    before: createHistorySnapshot(),
  };
}

function commitActiveTextEdit() {
  const activeEdit = state.activeTextEdit;
  if (!activeEdit) return false;
  state.activeTextEdit = null;
  return commitHistory(activeEdit.before, "редактирование текста");
}

function handleUndoShortcut(event) {
  const isUndoKey = event.code === "KeyZ" || event.key.toLowerCase() === "z";
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || !isUndoKey) return;
  event.preventDefault();
  commitActiveTextEdit();
  undoLastAction();
  const editingSegmentId = event.target.closest?.(".icat-segment")?.dataset.segmentId;
  const editingSegment = state.segments.find(
    (segment) => segment.id === editingSegmentId && !segment.deleted,
  );
  if (event.target.isContentEditable && editingSegment) beginTextEdit(editingSegment);
}

function undoLastAction() {
  const entry = window.ICATHistory.undo(state.history);
  if (!entry) {
    showToast("Нет действий для отмены");
    return;
  }
  if (entry.insertedPage) {
    undoInsertedPage(entry);
  } else if (entry.removedPage) {
    undoRemovedPage(entry);
  } else {
    restoreHistorySnapshot(entry.snapshot);
  }
  showToast(`Отменено: ${entry.label}`);
}

function undoRemovedPage(entry) {
  const {
    page, pageIndex, originalSegments,
  } = entry.removedPage;
  const pagesColumn = elements.docxHost.querySelector(".icat-pages-column");
  if (!pagesColumn || state.pages.includes(page)) {
    restoreHistorySnapshot(entry.snapshot);
    return;
  }

  for (const control of elements.docxHost.querySelectorAll(".icat-page-insert")) control.remove();
  const referenceElement = state.pages[pageIndex]?.element || null;
  pagesColumn.insertBefore(page.element, referenceElement);
  state.pages.splice(pageIndex, 0, page);
  const originalsById = new Map(originalSegments.map((item) => [item.id, item.original]));
  for (const segment of state.segments) {
    const original = originalsById.get(segment.id);
    if (original) segment.original = { ...original };
  }
  reindexPages();
  renderPageInsertControls();
  restoreHistorySnapshot(entry.snapshot);
  if (state.viewMode === "fit") requestAnimationFrame(fitDocumentWidth);
}

function undoInsertedPage(entry) {
  const pageIndex = state.pages.indexOf(entry.insertedPage);
  if (pageIndex < 0) {
    restoreHistorySnapshot(entry.snapshot);
    return;
  }

  for (const control of elements.docxHost.querySelectorAll(".icat-page-insert")) control.remove();
  entry.insertedPage.element.remove();
  state.pages.splice(pageIndex, 1);
  for (const segment of state.segments) {
    if (segment.original.pageIndex > pageIndex) {
      segment.original.pageIndex -= 1;
      segment.original.pageId = `page-${segment.original.pageIndex + 1}`;
    }
    if (segment.original.lastPageIndex > pageIndex) segment.original.lastPageIndex -= 1;
  }
  reindexPages();
  renderPageInsertControls();
  restoreHistorySnapshot(entry.snapshot);
  if (state.viewMode === "fit") requestAnimationFrame(fitDocumentWidth);
}

function restoreHistorySnapshot(snapshot) {
  const previousRestoringState = state.restoringHistory;
  state.restoringHistory = true;
  state.activeTextEdit = null;
  try {
    const savedSegments = new Map(snapshot.segments.map((segment) => [segment.id, segment]));
    for (const segment of state.segments) {
      const saved = savedSegments.get(segment.id);
      if (!saved) continue;
      Object.assign(segment, saved);
      const content = segment.element?.querySelector(".icat-segment__content");
      if (content) {
        applyTypography(content, segment.style);
        renderSegmentText(content, segment);
      }
      if (segment.deleted) {
        segment.element?.remove();
        continue;
      }
      const surface = getSegmentSurface(segment);
      surface?.overlay.append(segment.element);
      renderSegmentPosition(segment);
    }

    selectSegments(snapshot.selectedIds, snapshot.selectedId);
    syncParkingSurfaceHeight();
    updateSummary();
  } finally {
    state.restoringHistory = previousRestoringState;
  }
}

function describeSegmentAction(action) {
  return {
    reset: "возврат сегмента в исходное положение",
    delete: "удаление сегмента",
  }[action] || "изменение сегмента";
}

function getCellReference(segment) {
  if (segment.parked) {
    return { row: null, column: null, pageIndex: null, id: "Вне документа" };
  }
  const row = Math.floor(segment.y / state.gridSize) + 1;
  const column = Math.floor(segment.x / state.gridSize) + 1;
  return {
    row,
    column,
    pageIndex: segment.pageIndex,
    id: `P${segment.pageIndex + 1}:R${row}:C${column}`,
  };
}

function createExportPayload(activeSegments) {
  const pages = state.pages.map((page) => ({
    id: page.id,
    index: page.pageIndex,
    widthPx: page.width,
    heightPx: page.height,
  }));

  const segments = activeSegments.map((segment) => {
    const page = state.pages[segment.pageIndex];
    return {
      id: segment.id,
      pageId: segment.pageId,
      pageIndex: segment.pageIndex,
      text: segment.text,
      runs: (segment.runs || []).map((run) => ({ ...run })),
      x: segment.x,
      y: segment.y,
      width: segment.width,
      height: Math.min(segment.height, page.height - segment.y),
      zIndex: segment.zIndex,
      cellId: getCellReference(segment).id,
      style: { ...segment.style },
    };
  });

  return {
    title: state.title,
    gridSize: state.gridSize,
    pages,
    segments,
  };
}

function applyTypography(element, style) {
  Object.assign(element.style, {
    fontFamily: style.fontFamily,
    fontSize: `${style.fontSizePx}px`,
    fontWeight: String(style.fontWeight),
    fontStyle: normalizeFontStyle(style.fontStyle),
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: String(style.lineHeight),
  });
}

function renderSegmentText(content, segment) {
  content.replaceChildren();
  const runs = Array.isArray(segment.runs) && segment.runs.length
    ? segment.runs
    : [{
      text: segment.text,
      fontFamily: segment.style.fontFamily,
      fontSizePx: segment.style.fontSizePx,
      fontWeight: segment.style.fontWeight,
      fontStyle: segment.style.fontStyle,
      color: segment.style.color,
      backgroundColor: null,
    }];
  for (const run of runs) {
    const runElement = document.createElement("span");
    runElement.className = "icat-segment__run";
    runElement.style.fontFamily = normalizeFontFamily(run.fontFamily || segment.style.fontFamily);
    runElement.style.fontSize = `${clamp(numberOr(run.fontSizePx, segment.style.fontSizePx), 6, 96)}px`;
    runElement.style.fontWeight = String(normalizeFontWeight(run.fontWeight));
    runElement.style.fontStyle = normalizeFontStyle(run.fontStyle);
    runElement.style.color = run.color || segment.style.color;
    if (run.backgroundColor) runElement.style.backgroundColor = run.backgroundColor;
    if (run.text === "\t" && Number(run.tabWidthPx) > 0) {
      runElement.classList.add("icat-segment__tab");
      runElement.style.width = `${run.tabWidthPx}px`;
    }
    runElement.textContent = run.text;
    content.append(runElement);
  }
}

function normalizeText(value) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \n]+|[ \n]+$/g, "");
}

function normalizeEditableText(value) {
  return normalizeText(value);
}

function normalizeFontFamily(value) {
  const first = (value || "Arial").split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  return first || "Arial";
}

function normalizeFontWeight(value) {
  if (value === "bold") return 700;
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : 400;
}

function normalizeFontStyle(value) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "italic" || normalized.startsWith("oblique") ? "italic" : "normal";
}

function normalizeAlignment(value) {
  return ["left", "right", "center", "justify"].includes(value) ? value : "left";
}

function normalizeLineHeight(value, fontSizePx) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return 1.2;
  return clamp(numeric / fontSizePx, 0.8, 3);
}

function colorToHex(value) {
  if (!value || value === "transparent") return "#111827";
  if (value.startsWith("#")) return value.slice(0, 7);
  const match = value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
  if (!match) return "#111827";
  return `#${[match[1], match[2], match[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function normalizeBackgroundColor(value) {
  if (!value || value === "transparent") return null;
  const alphaMatch = value.match(/rgba\([^)]*[, /](0(?:\.0+)?)\s*\)$/i);
  if (alphaMatch) return null;
  return colorToHex(value);
}

function numberOr(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatGeometry(value) {
  return String(Math.round(value * 10) / 10);
}

function snap(value) {
  return Math.round(value / state.gridSize) * state.gridSize;
}

function snapUp(value) {
  return Math.ceil(value / state.gridSize) * state.gridSize;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function sanitizeFileName(value) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "document";
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForWordTabLayout() {
  const tabStops = Array.from(elements.docxHost.querySelectorAll(".docx-tab-stop"));
  if (!tabStops.length) return;
  const startedAt = performance.now();
  while (
    tabStops.some((tabStop) => !tabStop.style.wordSpacing)
    && performance.now() - startedAt < 900
  ) {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

updateSummary();
setGridSize(DEFAULT_GRID_SIZE);
setViewScale(100);
