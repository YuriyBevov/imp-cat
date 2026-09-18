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

  function surfacePointFromCoordinates(rectangle, clientX, clientY, viewScale, width, height) {
    const scale = clamp(Number(viewScale) || 1, 0.25, 2.5);
    return {
      x: clamp(((Number(clientX) || 0) - (Number(rectangle?.left) || 0)) / scale, 0, width),
      y: clamp(((Number(clientY) || 0) - (Number(rectangle?.top) || 0)) / scale, 0, height),
    };
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

  function createSegmentMergePlan(segments) {
    const active = (segments || []).filter((segment) => segment && !segment.deleted);
    if (active.length < 2) {
      return { valid: false, reason: "select-at-least-two", ordered: [] };
    }
    const first = active[0];
    const sameSurface = active.every((segment) => (
      Boolean(segment.parked) === Boolean(first.parked)
      && (first.parked || segment.pageIndex === first.pageIndex)
    ));
    if (!sameSurface) {
      return { valid: false, reason: "different-surfaces", ordered: [] };
    }

    const byTop = [...active].sort((left, right) => (
      left.y - right.y || left.x - right.x || left.zIndex - right.zIndex
    ));
    const rows = [];
    for (const segment of byTop) {
      const centerY = segment.y + segment.height / 2;
      let row = rows.find((candidate) => (
        centerY >= candidate.top - 2 && centerY <= candidate.bottom + 2
      ));
      if (!row) {
        row = { top: segment.y, bottom: segment.y + segment.height, segments: [] };
        rows.push(row);
      }
      row.top = Math.min(row.top, segment.y);
      row.bottom = Math.max(row.bottom, segment.y + segment.height);
      row.segments.push(segment);
    }
    rows.sort((left, right) => left.top - right.top);
    const ordered = rows.flatMap((row) => row.segments.sort((left, right) => (
      left.x - right.x || left.y - right.y || left.zIndex - right.zIndex
    )));
    const left = Math.min(...active.map((segment) => segment.x));
    const top = Math.min(...active.map((segment) => segment.y));
    const right = Math.max(...active.map((segment) => segment.x + segment.width));
    const bottom = Math.max(...active.map((segment) => segment.y + segment.height));
    return {
      valid: true,
      reason: null,
      ordered,
      bounds: { x: left, y: top, width: right - left, height: bottom - top },
    };
  }

  function getMergeSeparator(previous, current) {
    const previousCenter = previous.y + previous.height / 2;
    const currentCenter = current.y + current.height / 2;
    const sameRow = Math.abs(previousCenter - currentCenter)
      <= Math.max(4, Math.min(previous.height, current.height) / 2);
    if (!sameRow) return { text: "\n", tabWidthPx: 0 };
    return {
      text: "\t",
      tabWidthPx: Math.max(8, current.x - (previous.x + previous.width)),
    };
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

  function gridCellRectsOverlap(first, second) {
    return first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top;
  }

  // Input boxes have already been measured by the rendering engine. Keep the
  // source column and propagate growth only through vertically related boxes.
  // Page offsets are relative to this source page, never another source page.
  function layoutSourceFlow(boxes, area, obstacles = []) {
    const horizontalOverlap = (a, b) => a.x < b.x + b.width - .01 && a.x + a.width > b.x + .01;
    const ordered = [...boxes].sort((a, b) => a.anchor.y - b.anchor.y
      || a.anchor.x - b.anchor.x || (a.order || 0) - (b.order || 0));
    const bands = [];
    for (const box of ordered) {
      if (box.width > area.width + .01 || box.height > area.height + .01) {
        throw new Error(`Сегмент ${box.id} больше целой страницы. Разделите его на несколько блоков.`);
      }
      const previous = box.rowGroup ? bands.find(band => band.rowGroup === box.rowGroup) : null;
      if (previous) previous.boxes.push(box);
      else bands.push({ y: box.anchor.y, rowGroup: box.rowGroup, boxes: [box] });
    }
    const placed = [];
    const placements = new Map();
    let pageCount = 1;
    for (const band of bands) {
      const rowHeight = Math.max(...band.boxes.map(box => box.height));
      const predecessors = placed.filter(item => band.boxes.some(box => horizontalOverlap(box.anchor, item.anchor)));
      let pageOffset = Math.max(0, ...predecessors.map(item => item.pageOffset));
      let y = pageOffset ? area.y : Math.max(area.y, band.y);
      for (const predecessor of predecessors.filter(item => item.pageOffset === pageOffset)) {
        const sourceGap = Math.max(0, band.y - predecessor.anchor.y - predecessor.anchor.height);
        y = Math.max(y, predecessor.y + predecessor.height + sourceGap);
      }
      const positioned = band.boxes.map(box => ({ ...box, x: clamp(box.x, area.x, area.x + area.width - box.width) }));
      const firstOnPage = () => [...placed.filter(item => item.pageOffset === pageOffset), ...(pageOffset === 0 ? obstacles : [])];
      const moveBelowBlockers = () => {
        for (let attempt = 0; attempt <= placed.length + obstacles.length; attempt += 1) {
          const blockers = firstOnPage().filter(item => positioned.some(box => horizontalOverlap(box, item)
            && y < item.y + item.height - .01 && y + rowHeight > item.y + .01));
          if (!blockers.length) break;
          y = Math.max(...blockers.map(item => item.y + item.height + 2));
        }
      };
      moveBelowBlockers();
      if (y + rowHeight > area.y + area.height + .01) {
        pageOffset += 1;
        y = area.y;
        moveBelowBlockers();
        while (y + rowHeight > area.y + area.height + .01) {
          pageOffset += 1;
          y = area.y;
          moveBelowBlockers();
        }
      }
      for (const box of positioned) {
        if (band.rowGroup) {
          const result = { x: box.x, y, width: box.width, height: rowHeight, pageOffset };
          placements.set(box.id, result);
          placed.push({ ...box, ...result });
          pageCount = Math.max(pageCount, pageOffset + 1);
          continue;
        }
        // Source boxes on the same line can themselves overlap (e.g. OCR).
        // Keep the column; move this box down rather than placing text on text.
        let boxY = y;
        let boxPage = pageOffset;
        while (true) {
          const blockers = [...placed.filter(item => item.pageOffset === boxPage), ...(boxPage === 0 ? obstacles : [])]
            .filter(item => horizontalOverlap(box, item) && boxY < item.y + item.height - .01 && boxY + box.height > item.y + .01);
          if (blockers.length) boxY = Math.max(...blockers.map(item => item.y + item.height + 2));
          if (boxY + box.height > area.y + area.height + .01) { boxPage += 1; boxY = area.y; continue; }
          if (!blockers.length) break;
        }
        const result = { x: box.x, y: boxY, width: box.width, height: box.height, pageOffset: boxPage };
        placements.set(box.id, result);
        placed.push({ ...box, ...result });
        pageCount = Math.max(pageCount, boxPage + 1);
      }
    }
    return { placements, pageCount };
  }

  function alignTableColumnsToGrid(boxes, area, gridSize) {
    const size = Math.max(1, Number(gridSize) || 1);
    const columns = Math.max(1, Math.floor(Number(area?.width) / size + .000001));
    const aligned = (boxes || []).map(box => ({ ...box, anchor: { ...box.anchor } }));
    const tables = new Map();
    for (const box of aligned) {
      if (!box.tableId || !Number.isInteger(box.columnIndex)) continue;
      if (!tables.has(box.tableId)) tables.set(box.tableId, []);
      tables.get(box.tableId).push(box);
    }
    const median = values => {
      const sorted = [...values].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    };

    for (const [tableId, tableBoxes] of tables) {
      const columnCount = Math.max(...tableBoxes.map(box => box.columnIndex + Math.max(1, Number(box.columnSpan) || 1)));
      const candidates = Array.from({ length: columnCount + 1 }, () => []);
      for (const box of tableBoxes) {
        const span = Math.max(1, Math.trunc(Number(box.columnSpan) || 1));
        candidates[box.columnIndex].push(box.anchor.x);
        candidates[Math.min(columnCount, box.columnIndex + span)].push(box.anchor.x + box.anchor.width);
      }
      const rawBoundaries = candidates.map((values, index) => {
        if (values.length) return median(values);
        const previous = candidates.slice(0, index).map((items, offset) => items.length ? { offset, value: median(items) } : null).filter(Boolean).at(-1);
        const nextOffset = candidates.findIndex((items, offset) => offset > index && items.length);
        if (!previous || nextOffset < 0) return Number(area.x) + index * size;
        const nextValue = median(candidates[nextOffset]);
        return previous.value + (nextValue - previous.value) * (index - previous.offset) / (nextOffset - previous.offset);
      });
      const desired = rawBoundaries.map(value => Math.round((value - Number(area.x)) / size));
      const preferredWidths = Array.from(
        { length: columnCount },
        (_, index) => Math.max(1, desired[index + 1] - desired[index]),
      );
      const requiredWidths = [...preferredWidths];
      for (const box of tableBoxes) {
        const span = Math.max(1, Math.trunc(Number(box.columnSpan) || 1));
        const required = Math.max(1, Math.ceil((Number(box.minimumWidth) || 1) / size - .000001));
        const current = requiredWidths.slice(box.columnIndex, box.columnIndex + span).reduce((sum, value) => sum + value, 0);
        if (current < required) requiredWidths[Math.min(columnCount - 1, box.columnIndex + span - 1)] += required - current;
      }
      if (columnCount > columns) {
        throw new Error(`В таблице ${tableId} больше колонок, чем малых ячеек сетки на странице.`);
      }
      const widths = [...preferredWidths];
      while (widths.reduce((sum, value) => sum + value, 0) > columns) {
        const shrinkIndex = widths.reduce((best, value, index) => (
          value > 1 && (best < 0 || value > widths[best]) ? index : best
        ), -1);
        if (shrinkIndex < 0) break;
        widths[shrinkIndex] -= 1;
      }
      let remaining = columns - widths.reduce((sum, value) => sum + value, 0);
      while (remaining > 0) {
        const growIndex = widths.reduce((best, value, index) => {
          if (value >= requiredWidths[index]) return best;
          if (best < 0) return index;
          const pressure = requiredWidths[index] / value;
          const bestPressure = requiredWidths[best] / widths[best];
          return pressure > bestPressure
            || (pressure === bestPressure && requiredWidths[index] - value > requiredWidths[best] - widths[best])
            ? index : best;
        }, -1);
        if (growIndex < 0) break;
        widths[growIndex] += 1;
        remaining -= 1;
      }
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      const desiredStart = Math.round((rawBoundaries[0] - Number(area.x)) / size);
      const start = clamp(desiredStart, 0, columns - totalWidth);
      const boundaries = [start];
      for (const width of widths) boundaries.push(boundaries.at(-1) + width);
      for (const box of tableBoxes) {
        const span = Math.max(1, Math.trunc(Number(box.columnSpan) || 1));
        const left = boundaries[box.columnIndex];
        const right = boundaries[Math.min(columnCount, box.columnIndex + span)];
        box.x = Number(area.x) + left * size;
        box.width = (right - left) * size;
        box.widthLimit = box.width;
        box.anchor.x = box.x;
        box.anchor.width = box.width;
      }
    }
    return aligned;
  }

  function findNearestFreeGridRect(anchor, occupiedRects, columns, rows) {
    const columnCount = Math.max(1, Math.trunc(Number(columns) || 1));
    const rowCount = Math.max(1, Math.trunc(Number(rows) || 1));
    const width = clamp(
      Math.max(1, Math.trunc(Number(anchor?.right) - Number(anchor?.left)) || 1),
      1,
      columnCount,
    );
    const height = clamp(
      Math.max(1, Math.trunc(Number(anchor?.bottom) - Number(anchor?.top)) || 1),
      1,
      rowCount,
    );
    const desiredLeft = clamp(Math.trunc(Number(anchor?.left) || 0), 0, columnCount - width);
    const desiredTop = clamp(Math.trunc(Number(anchor?.top) || 0), 0, rowCount - height);
    const occupied = Array.isArray(occupiedRects) ? occupiedRects : [];
    const candidates = [];

    for (let top = 0; top <= rowCount - height; top += 1) {
      for (let left = 0; left <= columnCount - width; left += 1) {
        const rectangle = { left, top, right: left + width, bottom: top + height };
        if (occupied.some(obstacle => gridCellRectsOverlap(rectangle, obstacle))) continue;
        const verticalDistance = Math.abs(top - desiredTop);
        const horizontalDistance = Math.abs(left - desiredLeft);
        candidates.push({
          rectangle,
          // Keep the recognized column whenever possible. Moving down preserves
          // document reading order better than pushing a segment sideways.
          distance: verticalDistance + horizontalDistance * (rowCount + 1),
          beforeAnchor: top < desiredTop,
        });
      }
    }

    candidates.sort((first, second) => (
      Number(first.beforeAnchor) - Number(second.beforeAnchor)
      || first.distance - second.distance
      || first.rectangle.top - second.rectangle.top
      || first.rectangle.left - second.rectangle.left
    ));
    return candidates[0]?.rectangle || null;
  }

  return {
    captureZoomAnchor,
    alignTableColumnsToGrid,
    clampGroupDelta,
    createSegmentMergePlan,
    findSegmentOverlaps,
    findNearestFreeGridRect,
    layoutSourceFlow,
    getFlowPageCount,
    getFlowPagePlacement,
    getMergeSeparator,
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
    surfacePointFromCoordinates,
  };
});
