(function exposeSegmentationModel(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ICATSegmentation = api;
}(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const TEXT_NODE = 4;

  function elementCandidate(element, kind = "element") {
    return {
      kind,
      element,
      sourceElements: [element],
      sourceTextNodes: [],
      styleElement: null,
      text: null,
      rect: null,
    };
  }

  function collectTextNodesOutside(container, excludedSelector = "svg") {
    const walker = container.ownerDocument.createTreeWalker(container, TEXT_NODE);
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      if (node.textContent?.trim() && parent && !parent.closest(excludedSelector)) nodes.push(node);
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
      sourceElements,
      sourceTextNodes,
      styleElement: textNodes[0]?.parentElement || paragraph,
      text,
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
          candidates.push(elementCandidate(shape, "shape"));
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
      candidates.push(elementCandidate(paragraph, "paragraph"));
    }

    return candidates.sort(compareCandidates);
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
    mixedParagraphCandidate,
    rectangleFromTextNodes,
  };
}));
