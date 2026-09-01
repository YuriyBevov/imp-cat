const DEFAULT_GRID_SIZE = 4;
const MIN_SEGMENT_WIDTH = 20;
const MIN_SEGMENT_HEIGHT = 16;
const HISTORY_LIMIT = 100;

const state = {
  title: "Новый документ",
  fileName: "",
  pages: [],
  segments: [],
  selectedId: null,
  selectedIds: new Set(),
  gridSize: DEFAULT_GRID_SIZE,
  gridVisible: true,
  viewScale: 1,
  viewMode: "fit",
  workspaceHeightScale: 1,
  loading: false,
  history: window.ICATHistory.create(HISTORY_LIMIT),
  activeTextEdit: null,
  restoringHistory: false,
};

const elements = {
  fileInput: document.querySelector("#file-input"),
  sampleButton: document.querySelector("#sample-button"),
  sampleEmptyButton: document.querySelector("#empty-sample-button"),
  exportButton: document.querySelector("#export-button"),
  gridButton: document.querySelector("#grid-toggle"),
  gridSize: document.querySelector("#grid-size"),
  gridHint: document.querySelector("#grid-hint"),
  viewScale: document.querySelector("#view-scale"),
  zoomValue: document.querySelector("#zoom-value"),
  zoomOut: document.querySelector("#zoom-out"),
  zoomIn: document.querySelector("#zoom-in"),
  fitWidth: document.querySelector("#fit-width"),
  viewScaleHint: document.querySelector("#view-scale-hint"),
  workspaceHeightScale: document.querySelector("#workspace-height-scale"),
  workspaceHeightHint: document.querySelector("#workspace-height-hint"),
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
elements.gridButton.addEventListener("click", toggleGrid);
elements.gridSize.addEventListener("change", () => setGridSize(Number(elements.gridSize.value)));
elements.viewScale.addEventListener("input", () => setViewScale(Number(elements.viewScale.value)));
elements.zoomOut.addEventListener("click", () => setViewScale(state.viewScale * 100 - 10));
elements.zoomIn.addEventListener("click", () => setViewScale(state.viewScale * 100 + 10));
elements.fitWidth.addEventListener("click", fitDocumentWidth);
elements.resolveOverlaps.addEventListener("click", resolveSegmentOverlaps);
elements.workspaceHeightScale.addEventListener("change", () => {
  const before = createHistorySnapshot();
  setWorkspaceHeightScale(Number(elements.workspaceHeightScale.value));
  commitHistory(before, "изменение высоты рабочего поля");
});
elements.workspace.addEventListener("wheel", handleWorkspaceZoom, { passive: false });
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

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".icat-segment__menu, .icat-segment__more")) {
    closeAllMenus();
  }
});

document.addEventListener("keydown", handleUndoShortcut);

async function loadSample() {
  try {
    setLoading(true, "Загружаем пример…");
    const response = await fetch("/api/sample");
    if (!response.ok) throw new Error("Не удалось получить пример документа");
    const blob = await response.blob();
    await loadDocument(blob, "пример-документа.docx", { loadingAlreadySet: true });
  } catch (error) {
    setLoading(false);
    showToast(error.message, "error");
  }
}

async function loadDocument(blob, fileName, options = {}) {
  if (!fileName.toLowerCase().endsWith(".docx")) {
    showToast("Для прототипа поддерживается только формат DOCX", "error");
    return;
  }

  if (!window.docx?.renderAsync) {
    showToast("Модуль просмотра DOCX не загрузился", "error");
    return;
  }

  try {
    if (!options.loadingAlreadySet) setLoading(true, "Разбираем DOCX…");
    clearDocument();
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
    await nextPaint();
    await nextPaint();
    extractDocumentModel();
    applyWorkspaceHeightScale();
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
  elements.docxHost.replaceChildren();
  elements.documentStage.classList.remove("is-measuring");
  elements.documentStage.removeAttribute("aria-hidden");
  state.pages = [];
  state.segments = [];
  state.selectedId = null;
  state.selectedIds = new Set();
  state.viewMode = "fit";
  clearHistory();
  elements.documentStage.hidden = true;
  elements.dropZone.hidden = false;
  updateSummary();
}

function extractDocumentModel() {
  const pageElements = Array.from(
    elements.docxHost.querySelectorAll(":scope > .docx-wrapper > section.docx"),
  );

  if (!pageElements.length) {
    pageElements.push(...elements.docxHost.querySelectorAll("section.docx"));
  }

  if (!pageElements.length) throw new Error("в документе не найдены страницы");

  state.pages = pageElements.map((pageElement, pageIndex) => {
    const width = pageElement.clientWidth;
    const height = pageElement.clientHeight;
    const nominalHeight = clamp(
      numberOr(getComputedStyle(pageElement).minHeight, height),
      200,
      2_112,
    );
    const contentBounds = getPageContentBounds(pageElement, width, nominalHeight);
    const contentBoundary = document.createElement("div");
    contentBoundary.className = "icat-content-boundary";
    contentBoundary.setAttribute("aria-hidden", "true");
    const pageBreakLayer = document.createElement("div");
    pageBreakLayer.className = "icat-page-break-layer";
    pageBreakLayer.setAttribute("aria-hidden", "true");
    const overlay = document.createElement("div");
    overlay.className = "icat-overlay-layer";
    overlay.setAttribute("aria-label", `Редактируемый слой страницы ${pageIndex + 1}`);
    pageElement.dataset.pageIndex = String(pageIndex);
    pageElement.append(contentBoundary, pageBreakLayer, overlay);

    const page = {
      id: `page-${pageIndex + 1}`,
      pageIndex,
      width,
      baseHeight: height,
      height,
      nominalHeight,
      contentBounds,
      contentBoundary,
      pageBreakLayer,
      element: pageElement,
      overlay,
    };
    pageElement.addEventListener("pointerdown", (event) => beginMarqueeSelection(page, event));
    return page;
  });

  for (const page of state.pages) {
    const pageRect = page.element.getBoundingClientRect();
    const candidates = collectTextCandidates(page.element);
    const accepted = [];

    candidates.forEach((candidate, sourceIndex) => {
      const sourceElement = candidate.element;
      const text = candidate.text ?? getCandidateText(sourceElement);
      const rect = candidate.rect ?? getCandidateRect(sourceElement);
      if (!text || rect.width < 2 || rect.height < 2) return;
      if (isDuplicateCandidate(text, rect, accepted)) return;
      accepted.push({ text, rect });

      const styleElement = candidate.styleElement
        || sourceElement.querySelector("p span, span, p")
        || sourceElement;
      const computedStyle = getComputedStyle(styleElement);
      const fontSizePx = numberOr(computedStyle.fontSize, 14);
      const lineHeight = normalizeLineHeight(computedStyle.lineHeight, fontSizePx);
      const x = clamp(rect.left - pageRect.left, 0, page.width - MIN_SEGMENT_WIDTH);
      const y = clamp(rect.top - pageRect.top, 0, page.height - MIN_SEGMENT_HEIGHT);
      const width = clamp(Math.max(rect.width, MIN_SEGMENT_WIDTH), MIN_SEGMENT_WIDTH, page.width - x);
      const height = clamp(
        Math.max(rect.height, fontSizePx * lineHeight, MIN_SEGMENT_HEIGHT),
        MIN_SEGMENT_HEIGHT,
        page.height - y,
      );

      const segment = {
        id: `segment-${page.pageIndex + 1}-${sourceIndex + 1}`,
        pageId: page.id,
        pageIndex: page.pageIndex,
        text,
        x,
        y,
        width,
        height,
        zIndex: state.segments.length + 1,
        deleted: false,
        sourceElement,
        sourceElements: candidate.sourceElements,
        element: null,
        style: {
          fontFamily: normalizeFontFamily(computedStyle.fontFamily),
          fontSizePx,
          fontWeight: normalizeFontWeight(computedStyle.fontWeight),
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
}

function collectTextCandidates(pageElement) {
  return window.ICATSegmentation.collectTextCandidates(pageElement, normalizeText);
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

function getPageContentBounds(pageElement, pageWidth, nominalHeight) {
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
    height: Math.max(20, nominalHeight - top - bottom),
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
  content.textContent = segment.text;
  applyTypography(content, segment.style);

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

  segmentElement.addEventListener("pointerdown", () => selectSegment(segment.id));
  content.addEventListener("focus", () => {
    beginTextEdit(segment);
    selectSegment(segment.id);
  });
  content.addEventListener("input", () => {
    segment.text = normalizeEditableText(content.innerText);
    growSegmentToFit(segment, content);
    updateSummary();
  });
  content.addEventListener("blur", () => commitActiveTextEdit());

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = !menu.classList.contains("is-open");
    closeAllMenus();
    menu.classList.toggle("is-open", willOpen);
    segmentElement.classList.toggle("is-menu-open", willOpen);
    selectSegment(segment.id);
  });

  attachDragBehavior(segment, dragButton);
  attachResizeBehavior(segment, resizeHandle);
}

function createSegmentMenu(segment) {
  const menu = document.createElement("div");
  menu.className = "icat-segment__menu";
  menu.setAttribute("role", "menu");

  const actions = [
    ["reset", "Вернуть исходное"],
    ["previous-page", "На предыдущую страницу"],
    ["next-page", "На следующую страницу"],
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
    });
    menu.append(button);
  }

  return menu;
}

function runSegmentAction(segment, action) {
  commitActiveTextEdit();
  const before = createHistorySnapshot();
  if (action === "reset") {
    const original = segment.original;
    Object.assign(segment, {
      pageId: original.pageId,
      pageIndex: original.pageIndex,
      text: original.text,
      x: original.x,
      y: original.y,
      width: original.width,
      height: original.height,
      deleted: false,
    });
    state.pages[segment.pageIndex].overlay.append(segment.element);
    segment.element.querySelector(".icat-segment__content").textContent = segment.text;
    renderSegmentPosition(segment);
    selectSegment(segment.id);
    showToast("Сегмент возвращён в исходное состояние");
  } else if (action === "previous-page") {
    moveSegmentToPage(segment, segment.pageIndex - 1);
  } else if (action === "next-page") {
    moveSegmentToPage(segment, segment.pageIndex + 1);
  } else if (action === "delete") {
    segment.deleted = true;
    segment.element.remove();
    const remainingSelection = [...state.selectedIds].filter((segmentId) => segmentId !== segment.id);
    selectSegments(remainingSelection);
    updateSummary();
    showToast("Сегмент удалён из результата");
  }
  commitHistory(before, describeSegmentAction(action));
}

function moveSegmentToPage(segment, targetPageIndex) {
  const targetPage = state.pages[targetPageIndex];
  if (!targetPage) {
    showToast("Такой страницы нет", "error");
    return;
  }

  segment.pageIndex = targetPageIndex;
  segment.pageId = targetPage.id;
  segment.x = clamp(segment.x, 0, Math.max(0, targetPage.width - segment.width));
  segment.y = clamp(segment.y, 0, Math.max(0, targetPage.height - segment.height));
  targetPage.overlay.append(segment.element);
  renderSegmentPosition(segment);
  selectSegment(segment.id);
  showToast(`Сегмент перемещён на страницу ${targetPageIndex + 1}`);
}

function attachDragBehavior(segment, handle) {
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (!state.selectedIds.has(segment.id)) selectSegment(segment.id);
    closeAllMenus();
    commitActiveTextEdit();
    const before = createHistorySnapshot();

    const page = state.pages[segment.pageIndex];
    const selectedSegments = state.segments.filter(
      (candidate) => !candidate.deleted
        && candidate.pageIndex === segment.pageIndex
        && state.selectedIds.has(candidate.id),
    );
    const origins = selectedSegments.map((candidate) => ({
      segment: candidate,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
    }));
    const origin = { clientX: event.clientX, clientY: event.clientY, x: segment.x, y: segment.y };
    handle.setPointerCapture(event.pointerId);
    for (const item of origins) item.segment.element.classList.add("is-dragging");

    const move = (moveEvent) => {
      const deltaX = window.ICATLayout.screenDeltaToDocument(
        moveEvent.clientX - origin.clientX,
        state.viewScale,
      );
      const deltaY = window.ICATLayout.screenDeltaToDocument(
        moveEvent.clientY - origin.clientY,
        state.viewScale,
      );
      const requestedDeltaX = snap(origin.x + deltaX) - origin.x;
      const requestedDeltaY = snap(origin.y + deltaY) - origin.y;
      const clampedDelta = window.ICATLayout.clampGroupDelta(
        origins,
        requestedDeltaX,
        requestedDeltaY,
        page.width,
        page.height,
      );
      for (const item of origins) {
        item.segment.x = item.x + clampedDelta.x;
        item.segment.y = item.y + clampedDelta.y;
        renderSegmentPosition(item.segment);
      }
      updateSelectedDetails();
    };

    const finish = () => {
      for (const item of origins) item.segment.element.classList.remove("is-dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
      updateSummary();
      commitHistory(before, origins.length > 1 ? "групповое перемещение" : "перемещение сегмента");
      if (origins.length > 1) showToast(`Перемещено сегментов: ${origins.length}`);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
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

    const page = state.pages[segment.pageIndex];
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
        page.width - segment.x,
      );
      segment.height = clamp(
        snapUp(origin.height + deltaY),
        MIN_SEGMENT_HEIGHT,
        page.height - segment.y,
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
  const page = state.pages[segment.pageIndex];
  const desiredHeight = snapUp(content.scrollHeight);
  if (desiredHeight > segment.height) {
    segment.height = clamp(desiredHeight, MIN_SEGMENT_HEIGHT, page.height - segment.y);
    renderSegmentPosition(segment);
  }
}

function renderSegmentPosition(segment) {
  if (!segment.element) return;
  Object.assign(segment.element.style, {
    left: `${segment.x}px`,
    top: `${segment.y}px`,
    width: `${segment.width}px`,
    height: `${segment.height}px`,
    zIndex: String(segment.zIndex),
  });
  segment.element.classList.toggle("is-in-page-margin", !isInsideWordTextArea(segment));
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
  const bounds = state.pages[segment.pageIndex]?.contentBounds;
  if (!bounds) return false;
  const placement = getExportPlacement(segment);
  return placement.x >= bounds.x
    && placement.y >= bounds.y
    && placement.x + segment.width <= bounds.x + bounds.width
    && placement.y + segment.height <= bounds.y + bounds.height;
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
  elements.selectionPage.textContent = String(cell.pageIndex + 1);
  elements.selectionCell.textContent = cell.id;
  elements.selectionPosition.textContent = `${formatGeometry(segment.x)} × ${formatGeometry(segment.y)} px`;
  elements.selectionSize.textContent = `${formatGeometry(segment.width)} × ${formatGeometry(segment.height)} px`;
  elements.selectionArea.textContent = isInsideWordTextArea(segment)
    ? "Текстовая область"
    : "Поле страницы";
}

function updateSummary() {
  const activeSegments = state.segments.filter((segment) => !segment.deleted);
  const overlaps = getSegmentOverlaps();
  elements.documentName.textContent = state.fileName || "Документ не открыт";
  elements.pageCount.textContent = String(getDocumentPagination().totalPages);
  elements.segmentCount.textContent = String(activeSegments.length);
  elements.overlapCount.textContent = String(overlaps.length);
  elements.overlapCount.closest("div")?.classList.toggle("has-warning", overlaps.length > 0);
  elements.exportButton.disabled = state.loading || activeSegments.length === 0;
  elements.resolveOverlaps.disabled = state.loading || overlaps.length === 0;
  updateSelectedDetails();
}

function getSegmentOverlaps() {
  return window.ICATLayout.findSegmentOverlaps(
    state.segments.filter((segment) => !segment.deleted),
    0.12,
  );
}

function resolveSegmentOverlaps() {
  commitActiveTextEdit();
  const before = createHistorySnapshot();
  const activeSegments = state.segments.filter((segment) => !segment.deleted);
  const placements = window.ICATLayout.resolveVerticalOverlaps(
    activeSegments,
    state.gridSize,
    0.12,
  );
  let moved = 0;
  for (const segment of activeSegments) {
    const nextY = placements.get(segment.id);
    if (Number.isFinite(nextY) && Math.abs(nextY - segment.y) >= 0.5) {
      segment.y = nextY;
      renderSegmentPosition(segment);
      moved += 1;
    }
  }
  applyWorkspaceHeightScale();
  updateSummary();
  commitHistory(before, "разнесение наложений");
  showToast(moved ? `Разнесено сегментов: ${moved}` : "Значимых наложений не найдено");
}

function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  elements.workspace.classList.toggle("grid-enabled", state.gridVisible);
  elements.gridButton.classList.toggle("is-on", state.gridVisible);
  elements.gridButton.setAttribute("aria-pressed", String(state.gridVisible));
}

function setGridSize(value) {
  state.gridSize = clamp(Math.round(value || DEFAULT_GRID_SIZE), 1, 96);
  const majorGridSize = Math.max(16, state.gridSize * 4);
  elements.gridSize.value = String(state.gridSize);
  elements.workspace.style.setProperty("--grid-size", `${state.gridSize}px`);
  elements.workspace.style.setProperty("--major-grid-size", `${majorGridSize}px`);
  elements.gridHint.textContent = `Крупная линия — ${majorGridSize} px. Исходная геометрия сохраняется без округления; настройка применяется только при ручном перемещении.`;
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
  const previousScale = state.viewScale;
  const workspaceRectangle = elements.workspace.getBoundingClientRect();
  const pointer = anchor ? {
    x: anchor.clientX - workspaceRectangle.left,
    y: anchor.clientY - workspaceRectangle.top,
  } : null;
  const contentAnchor = pointer ? {
    x: (elements.workspace.scrollLeft + pointer.x) / previousScale,
    y: (elements.workspace.scrollTop + pointer.y) / previousScale,
  } : null;
  state.viewMode = "manual";
  state.viewScale = clamp((Number(percent) || 100) / 100, 0.25, 2.5);
  applyViewScale();
  if (contentAnchor && pointer) {
    elements.workspace.scrollLeft = contentAnchor.x * state.viewScale - pointer.x;
    elements.workspace.scrollTop = contentAnchor.y * state.viewScale - pointer.y;
  }
}

function fitDocumentWidth() {
  const wrapper = elements.docxHost.querySelector(":scope > .docx-wrapper")
    || elements.docxHost.querySelector(".docx-wrapper");
  if (!wrapper || !state.pages.length) return;
  const wrapperStyle = getComputedStyle(wrapper);
  const padding = numberOr(wrapperStyle.paddingLeft, 0) + numberOr(wrapperStyle.paddingRight, 0);
  const documentWidth = Math.max(...state.pages.map((page) => page.width)) + padding;
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

function setWorkspaceHeightScale(percent) {
  state.workspaceHeightScale = clamp((Number(percent) || 100) / 100, 1, 4);
  elements.workspaceHeightScale.value = String(Math.round(state.workspaceHeightScale * 100));
  applyWorkspaceHeightScale();
  updateSummary();
}

function applyWorkspaceHeightScale() {
  for (const page of state.pages) {
    const occupiedBottom = state.segments
      .filter((segment) => !segment.deleted && segment.pageIndex === page.pageIndex)
      .reduce((bottom, segment) => Math.max(bottom, segment.y + segment.height), 0);
    page.height = window.ICATLayout.getWorkspacePageHeight(
      page.baseHeight,
      state.workspaceHeightScale,
      occupiedBottom,
      state.gridSize,
    );
    page.element.style.height = `${page.height}px`;
    page.element.style.minHeight = `${page.height}px`;
    page.overlay.style.height = `${page.height}px`;
    renderContentBoundary(page);
    renderPageBreaks(page);
  }
  for (const segment of state.segments) {
    if (!segment.deleted) renderSegmentPosition(segment);
  }

  const totalPages = state.pages.length ? getDocumentPagination().totalPages : 0;
  elements.workspaceHeightHint.textContent = `Поле — ${Math.round(state.workspaceHeightScale * 100)}%. Сегменты не растягиваются; свободное место добавляется снизу${totalPages ? `, экспорт: ${totalPages} стр.` : ""}.`;
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

function renderPageBreaks(page) {
  page.pageBreakLayer.replaceChildren();
  for (let boundaryY = page.nominalHeight; boundaryY < page.height - 1; boundaryY += page.nominalHeight) {
    const line = document.createElement("div");
    line.className = "icat-export-page-break";
    line.style.top = `${boundaryY}px`;
    line.dataset.label = `Граница страницы Word ${Math.round(boundaryY / page.nominalHeight) + 1}`;
    page.pageBreakLayer.append(line);
  }
}

async function exportDocument() {
  commitActiveTextEdit();
  const activeSegments = state.segments.filter((segment) => !segment.deleted);
  if (!activeSegments.length) {
    showToast("В документе нет сегментов для экспорта", "error");
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
    x: segment.x,
    y: segment.y,
    width: segment.width,
    height: segment.height,
    deleted: segment.deleted,
  };
}

function createHistorySnapshot() {
  return {
    segments: state.segments.map((segment) => ({ id: segment.id, ...snapshotSegment(segment) })),
    workspaceHeightScale: state.workspaceHeightScale,
    selectedIds: [...state.selectedIds],
    selectedId: state.selectedId,
  };
}

function historyDocumentSignature(snapshot) {
  return JSON.stringify({
    segments: snapshot.segments,
    workspaceHeightScale: snapshot.workspaceHeightScale,
  });
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
  restoreHistorySnapshot(entry.snapshot);
  showToast(`Отменено: ${entry.label}`);
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
      if (content) content.textContent = segment.text;
      if (segment.deleted) {
        segment.element?.remove();
        continue;
      }
      const page = state.pages[segment.pageIndex];
      page?.overlay.append(segment.element);
      renderSegmentPosition(segment);
    }

    state.workspaceHeightScale = snapshot.workspaceHeightScale;
    elements.workspaceHeightScale.value = String(Math.round(state.workspaceHeightScale * 100));
    applyWorkspaceHeightScale();
    selectSegments(snapshot.selectedIds, snapshot.selectedId);
    updateSummary();
  } finally {
    state.restoringHistory = previousRestoringState;
  }
}

function describeSegmentAction(action) {
  return {
    reset: "сброс сегмента",
    "previous-page": "перенос на предыдущую страницу",
    "next-page": "перенос на следующую страницу",
    delete: "удаление сегмента",
  }[action] || "изменение сегмента";
}

function getCellReference(segment) {
  const placement = getExportPlacement(segment);
  const row = Math.floor(placement.y / state.gridSize) + 1;
  const column = Math.floor(placement.x / state.gridSize) + 1;
  return {
    row,
    column,
    pageIndex: placement.pageIndex,
    id: `P${placement.pageIndex + 1}:R${row}:C${column}`,
  };
}

function getDocumentPagination() {
  return window.ICATLayout.paginatePages(state.pages);
}

function getExportPlacement(segment, pagination = getDocumentPagination()) {
  const placement = window.ICATLayout.placeSegment(segment, pagination, MIN_SEGMENT_HEIGHT);
  return {
    ...placement,
    pageId: `export-page-${placement.pageIndex + 1}`,
    height: placement.pageHeight,
  };
}

function createExportPayload(activeSegments) {
  const pagination = getDocumentPagination();
  const pages = [];

  for (const mapping of pagination.sourcePages) {
    for (let sliceIndex = 0; sliceIndex < mapping.sliceCount; sliceIndex += 1) {
      const pageIndex = mapping.firstOutputPageIndex + sliceIndex;
      pages.push({
        id: `export-page-${pageIndex + 1}`,
        index: pageIndex,
        widthPx: mapping.page.width,
        heightPx: mapping.nominalHeight,
      });
    }
  }

  const segments = activeSegments.map((segment) => {
    const placement = getExportPlacement(segment, pagination);
    return {
      id: segment.id,
      pageId: placement.pageId,
      pageIndex: placement.pageIndex,
      text: segment.text,
      x: placement.x,
      y: placement.y,
      width: segment.width,
      height: Math.min(segment.height, placement.height - placement.y),
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
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: String(style.lineHeight),
  });
}

function normalizeText(value) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeEditableText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
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

updateSummary();
elements.workspace.classList.toggle("grid-enabled", state.gridVisible);
setGridSize(DEFAULT_GRID_SIZE);
setViewScale(100);
setWorkspaceHeightScale(100);
