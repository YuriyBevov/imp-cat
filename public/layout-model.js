(function exposeLayoutModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ICATLayout = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function screenDeltaToDocument(screenDelta, viewScale) {
    const scale = clamp(Number(viewScale) || 1, 0.25, 2.5);
    return Number(screenDelta) / scale;
  }

  function getSegmentHorizontalGeometry(
    rectangle,
    pageLeft,
    pageWidth,
    contentBounds,
    stretchToContentWidth,
    minimumWidth = 20,
  ) {
    const safePageWidth = Math.max(minimumWidth, Number(pageWidth) || minimumWidth);
    const sourceX = clamp((Number(rectangle?.left) || 0) - (Number(pageLeft) || 0), 0, safePageWidth - minimumWidth);
    const sourceWidth = clamp(
      Math.max(Number(rectangle?.width) || 0, minimumWidth),
      minimumWidth,
      safePageWidth - sourceX,
    );
    if (!stretchToContentWidth) return { x: sourceX, width: sourceWidth };

    const contentX = clamp(Number(contentBounds?.x) || 0, 0, safePageWidth - minimumWidth);
    const contentWidth = clamp(
      Number(contentBounds?.width) || safePageWidth - contentX,
      minimumWidth,
      safePageWidth - contentX,
    );
    return { x: contentX, width: contentWidth };
  }

  function normalizeRectangle(rectangle) {
    const left = Number(rectangle.left ?? rectangle.x) || 0;
    const top = Number(rectangle.top ?? rectangle.y) || 0;
    const width = Math.max(0, Number(rectangle.width) || 0);
    const height = Math.max(0, Number(rectangle.height) || 0);
    return {
      left,
      top,
      right: Number(rectangle.right) || left + width,
      bottom: Number(rectangle.bottom) || top + height,
      width,
      height,
    };
  }

  function rectangleOverlapRatio(firstRectangle, secondRectangle) {
    const first = normalizeRectangle(firstRectangle);
    const second = normalizeRectangle(secondRectangle);
    const intersectionWidth = Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left));
    const intersectionHeight = Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
    const intersectionArea = intersectionWidth * intersectionHeight;
    const smallerArea = Math.min(first.width * first.height, second.width * second.height);
    return smallerArea > 0 ? intersectionArea / smallerArea : 0;
  }

  function rectanglesIntersect(firstRectangle, secondRectangle) {
    const first = normalizeRectangle(firstRectangle);
    const second = normalizeRectangle(secondRectangle);
    return first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
  }

  function clampGroupDelta(rectangles, deltaX, deltaY, pageWidth, pageHeight) {
    if (!rectangles.length) return { x: 0, y: 0 };
    const normalized = rectangles.map(normalizeRectangle);
    const bounds = {
      left: Math.min(...normalized.map((rectangle) => rectangle.left)),
      top: Math.min(...normalized.map((rectangle) => rectangle.top)),
      right: Math.max(...normalized.map((rectangle) => rectangle.right)),
      bottom: Math.max(...normalized.map((rectangle) => rectangle.bottom)),
    };
    return {
      x: clamp(Number(deltaX) || 0, -bounds.left, Math.max(0, Number(pageWidth) || 0) - bounds.right),
      y: clamp(Number(deltaY) || 0, -bounds.top, Math.max(0, Number(pageHeight) || 0) - bounds.bottom),
    };
  }

  function findSegmentOverlaps(segments, minimumRatio = 0.12) {
    const overlaps = [];
    for (let firstIndex = 0; firstIndex < segments.length; firstIndex += 1) {
      const first = segments[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < segments.length; secondIndex += 1) {
        const second = segments[secondIndex];
        if (first.pageIndex !== second.pageIndex) continue;
        const ratio = rectangleOverlapRatio(first, second);
        if (ratio >= minimumRatio) overlaps.push({ firstId: first.id, secondId: second.id, ratio });
      }
    }
    return overlaps;
  }

  function resolveVerticalOverlaps(segments, gap = 4, minimumRatio = 0.12) {
    const positions = new Map();
    const pageIndexes = [...new Set(segments.map((segment) => segment.pageIndex))];
    for (const pageIndex of pageIndexes) {
      const placed = [];
      const pageSegments = segments
        .filter((segment) => segment.pageIndex === pageIndex)
        .sort((first, second) => first.y - second.y || first.x - second.x || first.zIndex - second.zIndex);

      for (const segment of pageSegments) {
        let nextY = Number(segment.y) || 0;
        for (let attempt = 0; attempt <= placed.length; attempt += 1) {
          const candidate = { ...segment, y: nextY };
          const blockers = placed.filter(
            (placedSegment) => rectangleOverlapRatio(candidate, placedSegment) >= minimumRatio,
          );
          if (!blockers.length) break;
          nextY = Math.max(...blockers.map((blocker) => blocker.y + blocker.height)) + gap;
        }
        positions.set(segment.id, nextY);
        placed.push({ ...segment, y: nextY });
      }
    }
    return positions;
  }

  return {
    clampGroupDelta,
    findSegmentOverlaps,
    getSegmentHorizontalGeometry,
    rectangleOverlapRatio,
    rectanglesIntersect,
    resolveVerticalOverlaps,
    screenDeltaToDocument,
  };
});
