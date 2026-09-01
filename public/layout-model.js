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

  function captureZoomAnchor(rectangle, clientX, clientY) {
    const width = Math.max(1, Number(rectangle?.width) || 1);
    const height = Math.max(1, Number(rectangle?.height) || 1);
    const left = Number(rectangle?.left) || 0;
    const top = Number(rectangle?.top) || 0;
    return {
      clientX: Number(clientX) || 0,
      clientY: Number(clientY) || 0,
      ratioX: ((Number(clientX) || 0) - left) / width,
      ratioY: ((Number(clientY) || 0) - top) / height,
    };
  }

  function getZoomScrollAdjustment(anchor, rectangle) {
    const width = Math.max(1, Number(rectangle?.width) || 1);
    const height = Math.max(1, Number(rectangle?.height) || 1);
    const left = Number(rectangle?.left) || 0;
    const top = Number(rectangle?.top) || 0;
    return {
      x: left + width * (Number(anchor?.ratioX) || 0) - (Number(anchor?.clientX) || 0),
      y: top + height * (Number(anchor?.ratioY) || 0) - (Number(anchor?.clientY) || 0),
    };
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

  function getPhysicalPageSize(declaredWidth, declaredHeight, fallbackWidth, fallbackHeight) {
    const width = Number(declaredWidth) > 0 ? Number(declaredWidth) : Number(fallbackWidth);
    const height = Number(declaredHeight) > 0 ? Number(declaredHeight) : Number(fallbackHeight);
    return {
      width: clamp(width || 793.7, 200, 2_112),
      height: clamp(height || 1_122.5, 200, 2_112),
    };
  }

  function getFlowPageCount(flowBottom, pageHeight, contentTop = 0) {
    const safePageHeight = Math.max(1, Number(pageHeight) || 1);
    const safeFlowBottom = Math.max(0, Number(flowBottom) || 0);
    const safeContentTop = clamp(Number(contentTop) || 0, 0, safePageHeight - 1);
    if (safeFlowBottom <= safePageHeight + 1) return 1;
    const continuationCapacity = Math.max(1, safePageHeight - safeContentTop);
    return 1 + Math.ceil((safeFlowBottom - safePageHeight - 1) / continuationCapacity);
  }

  function getFlowPagePlacement(y, height, pageHeight, pageCount, contentTop = 0) {
    const safePageHeight = Math.max(1, Number(pageHeight) || 1);
    const safePageCount = Math.max(1, Math.round(Number(pageCount) || 1));
    const safeHeight = Math.max(0, Number(height) || 0);
    const safeContentTop = clamp(Number(contentTop) || 0, 0, safePageHeight - 1);
    const continuationCapacity = Math.max(1, safePageHeight - safeContentTop);
    const safeY = Math.max(0, Number(y) || 0);
    let pageOffset = 0;
    let localY = safeY;
    if (safeY >= safePageHeight && safePageCount > 1) {
      const continuationY = safeY - safePageHeight;
      pageOffset = 1 + Math.floor(continuationY / continuationCapacity);
      localY = safeContentTop + (continuationY % continuationCapacity);
    }
    pageOffset = clamp(pageOffset, 0, safePageCount - 1);
    if (
      localY + safeHeight > safePageHeight
      && pageOffset < safePageCount - 1
      && safeHeight <= continuationCapacity
    ) {
      pageOffset += 1;
      localY = safeContentTop;
    }
    return {
      pageOffset,
      y: clamp(localY, 0, Math.max(0, safePageHeight - Math.min(safeHeight, safePageHeight))),
    };
  }

  function layoutSequentialFlowBoxes(boxes, pageHeight, contentTop = 0, contentBottom = pageHeight) {
    const safePageHeight = Math.max(1, Number(pageHeight) || 1);
    const safeContentTop = clamp(Number(contentTop) || 0, 0, safePageHeight - 1);
    const safeContentBottom = clamp(
      Number(contentBottom) || safePageHeight,
      safeContentTop + 1,
      safePageHeight,
    );
    const continuationCapacity = Math.max(1, safeContentBottom - safeContentTop);
    const ordered = [...(boxes || [])].sort((first, second) => (
      (Number(first.y) || 0) - (Number(second.y) || 0)
      || (Number(first.order) || 0) - (Number(second.order) || 0)
    ));
    const placements = new Map();
    let previousSourceBottom = null;
    let previousPlacedBottom = null;
    let pageCount = 1;

    for (const box of ordered) {
      const sourceY = Math.max(0, Number(box.y) || 0);
      const height = Math.max(0, Number(box.height) || 0);
      const sourceBottom = sourceY + height;
      const sourceGap = previousSourceBottom == null
        ? 0
        : Math.max(0, sourceY - previousSourceBottom);
      let globalY = previousPlacedBottom == null
        ? sourceY
        : Math.max(sourceY, previousPlacedBottom + sourceGap);
      let pageOffset = Math.floor(globalY / safePageHeight);
      let localY = globalY - pageOffset * safePageHeight;

      if (pageOffset > 0 && localY < safeContentTop) localY = safeContentTop;
      if (localY + height > safeContentBottom) {
        if (height <= continuationCapacity || localY > safeContentTop) {
          pageOffset += 1;
          localY = safeContentTop;
        }
      }

      globalY = pageOffset * safePageHeight + localY;
      const occupiedPages = Math.max(1, Math.ceil(Math.max(height, 1) / continuationCapacity));
      pageCount = Math.max(pageCount, pageOffset + occupiedPages);
      placements.set(box.id, { pageOffset, y: localY });
      previousSourceBottom = Math.max(previousSourceBottom ?? 0, sourceBottom);
      previousPlacedBottom = globalY + height;
    }

    return { placements, pageCount };
  }

  function isDocumentSegment(segment) {
    return Boolean(segment)
      && !segment.deleted
      && !segment.parked
      && Number.isInteger(segment.pageIndex)
      && segment.pageIndex >= 0
      && typeof segment.pageId === "string"
      && segment.pageId.length > 0;
  }

  function isPageEmpty(segments, pageIndex) {
    return !segments.some(
      (segment) => isDocumentSegment(segment) && segment.pageIndex === pageIndex,
    );
  }

  function getSegmentActionTargets(segments, selectedIds, triggerId) {
    const selection = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    const triggerIsSelected = selection.has(triggerId);
    return segments.filter(
      (segment) => !segment.deleted
        && (triggerIsSelected ? selection.has(segment.id) : segment.id === triggerId),
    );
  }

  function remapPageIndexAfterRemoval(pageIndex, removedPageIndex, remainingPageCount) {
    if (!Number.isInteger(pageIndex)) return pageIndex;
    const safeRemainingCount = Math.max(1, Math.round(Number(remainingPageCount) || 1));
    if (pageIndex > removedPageIndex) return pageIndex - 1;
    if (pageIndex === removedPageIndex) return clamp(removedPageIndex, 0, safeRemainingCount - 1);
    return pageIndex;
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
    const bucketSize = 256;
    const segmentsByPage = new Map();
    for (const segment of segments) {
      const pageSegments = segmentsByPage.get(segment.pageIndex) || [];
      pageSegments.push({ segment, rectangle: normalizeRectangle(segment) });
      segmentsByPage.set(segment.pageIndex, pageSegments);
    }
    for (const pageSegments of segmentsByPage.values()) {
      const buckets = new Map();
      for (let currentIndex = 0; currentIndex < pageSegments.length; currentIndex += 1) {
        const current = pageSegments[currentIndex];
        const firstColumn = Math.floor(current.rectangle.left / bucketSize);
        const lastColumn = Math.floor(Math.max(current.rectangle.left, current.rectangle.right - 0.001) / bucketSize);
        const firstRow = Math.floor(current.rectangle.top / bucketSize);
        const lastRow = Math.floor(Math.max(current.rectangle.top, current.rectangle.bottom - 0.001) / bucketSize);
        const candidateIndexes = new Set();
        for (let row = firstRow; row <= lastRow; row += 1) {
          for (let column = firstColumn; column <= lastColumn; column += 1) {
            const key = `${row}:${column}`;
            for (const candidateIndex of buckets.get(key) || []) candidateIndexes.add(candidateIndex);
          }
        }
        for (const candidateIndex of candidateIndexes) {
          const candidate = pageSegments[candidateIndex];
          if (
            current.rectangle.left >= candidate.rectangle.right
            || current.rectangle.right <= candidate.rectangle.left
            || current.rectangle.top >= candidate.rectangle.bottom
            || current.rectangle.bottom <= candidate.rectangle.top
          ) continue;
          const ratio = rectangleOverlapRatio(current.rectangle, candidate.rectangle);
          if (ratio >= minimumRatio) {
            overlaps.push({
              firstId: candidate.segment.id,
              secondId: current.segment.id,
              ratio,
            });
          }
        }
        for (let row = firstRow; row <= lastRow; row += 1) {
          for (let column = firstColumn; column <= lastColumn; column += 1) {
            const key = `${row}:${column}`;
            const bucket = buckets.get(key) || [];
            bucket.push(currentIndex);
            buckets.set(key, bucket);
          }
        }
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
    captureZoomAnchor,
    clampGroupDelta,
    findSegmentOverlaps,
    getFlowPageCount,
    getFlowPagePlacement,
    layoutSequentialFlowBoxes,
    getPhysicalPageSize,
    getSegmentActionTargets,
    getSegmentHorizontalGeometry,
    getZoomScrollAdjustment,
    isDocumentSegment,
    isPageEmpty,
    rectangleOverlapRatio,
    rectanglesIntersect,
    remapPageIndexAfterRemoval,
    resolveVerticalOverlaps,
    screenDeltaToDocument,
  };
});
