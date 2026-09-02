(function exposeSegmentationModel(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ICATSegmentation = api;
}(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const TEXT_NODE = 4;
  const ELEMENT_NODE_TYPE = 1;
  const TEXT_NODE_TYPE = 3;

  function elementCandidate(element, kind = "element") {
    return {
      kind,
      element,
      textRoot: element,
      sourceElements: [element],
      sourceTextNodes: [],
      styleElement: null,
      text: null,
      rect: null,
    };
  }

  function floatingShapeTextCandidates(shape) {
    const paragraphs = Array.from(shape.querySelectorAll("p"))
      .filter((paragraph) => {
        const ancestorParagraph = paragraph.parentElement?.closest("p");
        return !ancestorParagraph || !shape.contains(ancestorParagraph);
      });
    const roots = paragraphs.length
      ? paragraphs
      : Array.from(shape.querySelectorAll("text"))
        .filter((textElement) => !textElement.parentElement?.closest("text"));

    return roots.map((root) => ({
      ...elementCandidate(root, "shape-text"),
      shape,
      styleElement: root.querySelector?.("span") || root,
      rect: rectangleFromTextNodes(collectTextNodesOutside(root, null)),
    }));
  }

  function collectTextNodesOutside(container, excludedSelector = "svg") {
    const walker = container.ownerDocument.createTreeWalker(container, TEXT_NODE);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (
        node.textContent?.trim()
        && parent
        && (!excludedSelector || !parent.closest(excludedSelector))
      ) nodes.push(node);
      node = walker.nextNode();
    }
    return nodes;
  }

  function rectangleFromTextNodes(textNodes) {
    const rectangles = [];
    for (const textNode of textNodes) {
      const range = textNode.ownerDocument.createRange();
      range.selectNodeContents(textNode);
      const nodeRectangles = [];
      if (typeof range.getClientRects === "function") {
        nodeRectangles.push(...Array.from(range.getClientRects()).filter(hasArea));
      }
      if (!nodeRectangles.length && textNode.parentElement?.getBoundingClientRect) {
        const fallback = textNode.parentElement.getBoundingClientRect();
        if (hasArea(fallback)) nodeRectangles.push(fallback);
      }
      rectangles.push(...nodeRectangles);
      range.detach?.();
    }
    if (!rectangles.length) return null;
    const left = Math.min(...rectangles.map((rect) => rect.left));
    const top = Math.min(...rectangles.map((rect) => rect.top));
    const right = Math.max(...rectangles.map((rect) => rect.right));
    const bottom = Math.max(...rectangles.map((rect) => rect.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function mixedParagraphCandidate(paragraph, normalizeText) {
    const textNodes = collectTextNodesOutside(paragraph);
    const text = normalizeText(textNodes.map((node) => node.textContent || "").join(""));
    if (!text) return null;

    const sourceElements = [];
    const sourceTextNodes = [];
    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (parent && parent !== paragraph && !parent.querySelector("svg, p")) {
        if (!sourceElements.includes(parent)) sourceElements.push(parent);
      } else {
        sourceTextNodes.push(textNode);
      }
    }

    return {
      kind: "mixed-paragraph-text",
      element: sourceElements[0] || paragraph,
      textRoot: paragraph,
      sourceElements,
      sourceTextNodes,
      styleElement: textNodes[0]?.parentElement || paragraph,
      text,
      rect: rectangleFromTextNodes(textNodes),
    };
  }

  function paragraphCandidate(paragraph) {
    const textNodes = collectTextNodesOutside(paragraph, "svg");
    return {
      ...elementCandidate(paragraph, "paragraph"),
      styleElement: textNodes[0]?.parentElement || paragraph,
      rect: rectangleFromTextNodes(textNodes),
    };
  }

  function collectTextCandidates(pageElement, normalizeText) {
    const scopeSelector = "article, header, footer";
    const paragraphSelector = "article p, header p, footer p";
    const seen = new Set();
    const candidates = [];

    for (const scope of pageElement.querySelectorAll(scopeSelector)) {
      for (const shape of scope.querySelectorAll("svg")) {
        if (!shape.parentElement?.closest("svg") && shape.querySelector("p, text") && !seen.has(shape)) {
          seen.add(shape);
          candidates.push(...floatingShapeTextCandidates(shape));
        }
      }
    }

    for (const paragraph of pageElement.querySelectorAll(paragraphSelector)) {
      if (paragraph.closest("svg")) continue;
      if (paragraph.querySelector("svg")) {
        const mixedCandidate = mixedParagraphCandidate(paragraph, normalizeText);
        if (mixedCandidate) candidates.push(mixedCandidate);
        continue;
      }
      if (paragraph.querySelector("p") || seen.has(paragraph)) continue;
      seen.add(paragraph);
      candidates.push(paragraphCandidate(paragraph));
    }

    return candidates.sort(compareCandidates);
  }

  function isTabStopElement(element) {
    return element?.classList?.contains("icat-segment__tab")
      || Array.from(element?.classList || []).some((className) => className.endsWith("-tab-stop"));
  }

  function collectStyledTextRuns(element, styleResolver = () => ({}), options = {}) {
    const runs = [];
    const excludeNestedSvg = Boolean(options.excludeNestedSvg);

    function append(text, sourceElement, extra = {}) {
      if (!text) return;
      runs.push({
        text,
        ...(styleResolver(sourceElement) || {}),
        ...extra,
      });
    }

    function visit(node) {
      if (node.nodeType === TEXT_NODE_TYPE) {
        append(node.textContent || "", node.parentElement || element);
        return;
      }
      if (node.nodeType !== ELEMENT_NODE_TYPE) return;
      if (excludeNestedSvg && node !== element && node.matches?.("svg")) return;
      if (isTabStopElement(node)) {
        append("\t", node, {
          tabWidthPx: Math.max(0, Number(node.getBoundingClientRect?.().width) || 0),
        });
        return;
      }
      if (node.matches?.("br")) {
        append("\n", node);
        return;
      }
      for (const child of node.childNodes || []) visit(child);
    }

    visit(element);
    return runs;
  }

  function compareCandidates(first, second) {
    if (first.element === second.element) return 0;
    const following = first.element.ownerDocument.defaultView?.Node?.DOCUMENT_POSITION_FOLLOWING ?? 4;
    return first.element.compareDocumentPosition(second.element) & following ? -1 : 1;
  }

  function hasArea(rectangle) {
    return Number(rectangle?.width) > 0 && Number(rectangle?.height) > 0;
  }

  return {
    collectTextCandidates,
    collectTextNodesOutside,
    collectStyledTextRuns,
    floatingShapeTextCandidates,
    isTabStopElement,
    mixedParagraphCandidate,
    paragraphCandidate,
    rectangleFromTextNodes,
  };
}));
