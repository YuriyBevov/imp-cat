(function exposeLayoutModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ICATLayout = api;
})(typeof globalThis === "object" ? globalThis : window, () => {
  const MIN_PAGE_SIZE = 200;
  const MAX_WORD_PAGE_SIZE = 2_112;

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
  }

  function screenDeltaToDocument(screenDelta, viewScale) {
    const scale = clamp(Number(viewScale) || 1, 0.25, 2.5);
    return Number(screenDelta) / scale;
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

  function getWorkspacePageHeight(baseHeight, heightScale, contentBottom = 0, padding = 0) {
    const normalizedBaseHeight = Math.max(MIN_PAGE_SIZE, Number(baseHeight) || MIN_PAGE_SIZE);
    const normalizedScale = clamp(Number(heightScale) || 1, 1, 4);
    const protectedContentBottom = Math.max(0, Number(contentBottom) || 0) + Math.max(0, Number(padding) || 0);
    return Math.ceil(Math.max(normalizedBaseHeight * normalizedScale, protectedContentBottom));
  }

  function paginatePages(pages) {
    let nextOutputPageIndex = 0;
    const sourcePages = pages.map((page) => {
      const nominalHeight = clamp(
        Number(page.nominalHeight || page.height),
        MIN_PAGE_SIZE,
        MAX_WORD_PAGE_SIZE,
      );
      const heightRatio = Number(page.height) / nominalHeight;
      const sliceCount = Math.max(1, Math.ceil(heightRatio - 0.02));
      const mapping = {
        page,
        firstOutputPageIndex: nextOutputPageIndex,
        nominalHeight,
        sliceCount,
      };
      nextOutputPageIndex += sliceCount;
      return mapping;
    });
    return { sourcePages, totalPages: nextOutputPageIndex };
  }

  function placeSegment(segment, pagination, minimumSegmentHeight = 16) {
    const mapping = pagination.sourcePages[segment.pageIndex];
    if (!mapping) {
      return { pageIndex: 0, x: segment.x, y: segment.y, pageHeight: 1_122 };
    }

    let sliceIndex = clamp(
      Math.floor(segment.y / mapping.nominalHeight),
      0,
      mapping.sliceCount - 1,
    );
    let localY = segment.y - sliceIndex * mapping.nominalHeight;
    if (
      mapping.nominalHeight - localY < minimumSegmentHeight
      && sliceIndex < mapping.sliceCount - 1
    ) {
      sliceIndex += 1;
      localY = 0;
    }

    return {
      pageIndex: mapping.firstOutputPageIndex + sliceIndex,
      x: segment.x,
      y: clamp(localY, 0, mapping.nominalHeight - minimumSegmentHeight),
      pageHeight: mapping.nominalHeight,
    };
  }

  return {
    MAX_WORD_PAGE_SIZE,
    findSegmentOverlaps,
    getWorkspacePageHeight,
    paginatePages,
    placeSegment,
    rectangleOverlapRatio,
    resolveVerticalOverlaps,
    screenDeltaToDocument,
  };
});
