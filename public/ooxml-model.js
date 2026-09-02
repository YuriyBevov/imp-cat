(function exposeOOXMLModel(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ICATOOXML = api;
}(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const NS = {
    word: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    word2010: "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
    compatibility: "http://schemas.openxmlformats.org/markup-compatibility/2006",
    drawing: "http://schemas.openxmlformats.org/drawingml/2006/main",
    picture: "http://schemas.openxmlformats.org/drawingml/2006/picture",
    wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    vml: "urn:schemas-microsoft-com:vml",
  };

  const EMU_PER_PX = 9525;
  const PT_TO_PX = 96 / 72;

  function finiteNumber(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function parseCssLength(value) {
    if (value == null || value === "") return null;
    const match = String(value).trim().match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(px|pt|pc|in|cm|mm)?$/i);
    if (!match) return null;
    const number = Number(match[1]);
    const unit = (match[2] || "").toLowerCase();
    const factors = {
      px: 1,
      pt: PT_TO_PX,
      pc: 16,
      in: 96,
      cm: 96 / 2.54,
      mm: 96 / 25.4,
    };
    return { value: number * (factors[unit] || 1), unitless: !unit };
  }

  function parseStyle(styleText) {
    const result = {};
    for (const declaration of String(styleText || "").split(";")) {
      const separator = declaration.indexOf(":");
      if (separator < 0) continue;
      const name = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (name) result[name] = value;
    }
    return result;
  }

  function parsePair(value, fallback) {
    const values = String(value || "").split(/[ ,]+/).map(Number).filter(Number.isFinite);
    return values.length >= 2 ? values.slice(0, 2) : fallback;
  }

  function directChild(element, namespace, localName) {
    return Array.from(element?.children || []).find((child) => (
      child.namespaceURI === namespace && child.localName === localName
    )) || null;
  }

  function descendant(element, namespace, localName) {
    return element?.getElementsByTagNameNS(namespace, localName)?.[0] || null;
  }

  function wordAttribute(element, localName) {
    return element?.getAttributeNS(NS.word, localName)
      ?? element?.getAttribute(`w:${localName}`)
      ?? element?.getAttribute(localName)
      ?? null;
  }

  function textTokens(root) {
    const tokens = [];
    function visit(node) {
      if (node.nodeType !== 1) return;
      if (node.namespaceURI === NS.word) {
        if (node.localName === "t" || node.localName === "delText") {
          tokens.push(node.textContent || "");
          return;
        }
        if (node.localName === "tab") {
          tokens.push("\t");
          return;
        }
        if (node.localName === "br" || node.localName === "cr") {
          tokens.push("\n");
          return;
        }
      }
      for (const child of node.children || []) visit(child);
    }
    visit(root);
    return tokens.join("");
  }

  function extractWordText(root) {
    const paragraphs = Array.from(root.getElementsByTagNameNS(NS.word, "p"))
      .filter((paragraph) => {
        for (let parent = paragraph.parentElement; parent && parent !== root; parent = parent.parentElement) {
          if (parent.namespaceURI === NS.word && parent.localName === "p") return false;
        }
        return true;
      });
    if (!paragraphs.length) return textTokens(root).trim();
    return paragraphs.map(textTokens).join("\n").trim();
  }

  function normalizeMatchText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\n\r ]+/g, " ")
      .trim()
      .toLocaleLowerCase();
  }

  function alternateContentAncestor(element) {
    for (let parent = element?.parentElement; parent; parent = parent.parentElement) {
      if (parent.namespaceURI === NS.compatibility && parent.localName === "AlternateContent") {
        return parent;
      }
    }
    return null;
  }

  function parsePosition(anchor, axis) {
    const localName = axis === "x" ? "positionH" : "positionV";
    const position = directChild(anchor, NS.wp, localName);
    if (!position) return { relativeFrom: "page", offsetPx: null, align: null };
    const offset = directChild(position, NS.wp, "posOffset");
    const align = directChild(position, NS.wp, "align");
    return {
      relativeFrom: position.getAttribute("relativeFrom") || "page",
      offsetPx: offset ? finiteNumber(offset.textContent, 0) / EMU_PER_PX : null,
      align: align?.textContent?.trim() || null,
    };
  }

  function parseDrawingAnchor(anchor, partName, index) {
    const extent = directChild(anchor, NS.wp, "extent");
    const docProperties = directChild(anchor, NS.wp, "docPr");
    const transform = descendant(anchor, NS.drawing, "xfrm");
    const text = extractWordText(anchor);
    if (!normalizeMatchText(text)) return null;
    return {
      id: `${partName}:drawing:${docProperties?.getAttribute("id") || index + 1}`,
      partName,
      partKind: getPartKind(partName),
      sourceType: "drawing-anchor",
      _alternateRoot: alternateContentAncestor(anchor),
      text,
      normalizedText: normalizeMatchText(text),
      x: parsePosition(anchor, "x"),
      y: parsePosition(anchor, "y"),
      widthPx: finiteNumber(extent?.getAttribute("cx"), 0) / EMU_PER_PX,
      heightPx: finiteNumber(extent?.getAttribute("cy"), 0) / EMU_PER_PX,
      rotation: finiteNumber(transform?.getAttribute("rot"), 0) / 60000,
      zIndex: finiteNumber(anchor.getAttribute("relativeHeight"), 0),
      behindText: anchor.getAttribute("behindDoc") === "1",
    };
  }

  function resolveVmlCoordinate(rawValue, transform, axis) {
    const parsed = parseCssLength(rawValue);
    if (!parsed) return null;
    const scale = axis === "x" ? transform.scaleX : transform.scaleY;
    return parsed.unitless ? parsed.value * scale : parsed.value;
  }

  function resolveVmlBox(element, parentTransform) {
    const style = parseStyle(element.getAttribute("style"));
    const x = (resolveVmlCoordinate(style.left, parentTransform, "x") ?? 0)
      + (resolveVmlCoordinate(style["margin-left"], parentTransform, "x") ?? 0);
    const y = (resolveVmlCoordinate(style.top, parentTransform, "y") ?? 0)
      + (resolveVmlCoordinate(style["margin-top"], parentTransform, "y") ?? 0);
    const width = resolveVmlCoordinate(style.width, parentTransform, "x");
    const height = resolveVmlCoordinate(style.height, parentTransform, "y");
    return {
      style,
      x: parentTransform.offsetX + x,
      y: parentTransform.offsetY + y,
      width,
      height,
    };
  }

  function parseVmlShape(shape, partName, index, transform) {
    const box = resolveVmlBox(shape, transform);
    const text = extractWordText(shape);
    if (!normalizeMatchText(text) || !(box.width > 0) || !(box.height > 0)) return null;
    return {
      id: `${partName}:vml:${shape.getAttribute("id") || "shape"}:${index + 1}`,
      partName,
      partKind: getPartKind(partName),
      sourceType: "vml-shape",
      _alternateRoot: alternateContentAncestor(shape),
      text,
      normalizedText: normalizeMatchText(text),
      x: {
        relativeFrom: box.style["mso-position-horizontal-relative"] || transform.relativeX || "page",
        offsetPx: box.x,
        align: box.style["mso-position-horizontal"] || null,
      },
      y: {
        relativeFrom: box.style["mso-position-vertical-relative"] || transform.relativeY || "page",
        offsetPx: box.y,
        align: box.style["mso-position-vertical"] || null,
      },
      widthPx: box.width,
      heightPx: box.height,
      rotation: finiteNumber(box.style.rotation, 0),
      zIndex: finiteNumber(box.style["z-index"], 0),
      behindText: box.style["z-index"]?.startsWith("-") || false,
    };
  }

  function collectVmlObjects(root, partName) {
    const result = [];
    let shapeIndex = 0;
    const initialTransform = {
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      relativeX: "page",
      relativeY: "page",
    };

    function visit(element, transform) {
      if (element.namespaceURI !== NS.vml) {
        for (const child of element.children || []) visit(child, transform);
        return;
      }
      if (element.localName === "group") {
        const box = resolveVmlBox(element, transform);
        const [originX, originY] = parsePair(element.getAttribute("coordorigin"), [0, 0]);
        const [coordWidth, coordHeight] = parsePair(element.getAttribute("coordsize"), [1, 1]);
        const width = box.width || coordWidth * transform.scaleX;
        const height = box.height || coordHeight * transform.scaleY;
        const childTransform = {
          offsetX: box.x - originX * (width / Math.max(1, coordWidth)),
          offsetY: box.y - originY * (height / Math.max(1, coordHeight)),
          scaleX: width / Math.max(1, coordWidth),
          scaleY: height / Math.max(1, coordHeight),
          relativeX: box.style["mso-position-horizontal-relative"] || transform.relativeX,
          relativeY: box.style["mso-position-vertical-relative"] || transform.relativeY,
        };
        for (const child of element.children || []) visit(child, childTransform);
        return;
      }
      if (element.localName === "shape" || element.localName === "rect" || element.localName === "roundrect") {
        const object = parseVmlShape(element, partName, shapeIndex, transform);
        shapeIndex += 1;
        if (object) result.push(object);
      }
      for (const child of element.children || []) visit(child, transform);
    }

    visit(root.documentElement || root, initialTransform);
    return result;
  }

  function getPartKind(partName) {
    if (/\/header\d*\.xml$/i.test(partName)) return "header";
    if (/\/footer\d*\.xml$/i.test(partName)) return "footer";
    return "document";
  }

  function dedupeObjects(objects) {
    const result = [];
    for (const object of objects.sort((left, right) => (
      Number(right.sourceType === "drawing-anchor") - Number(left.sourceType === "drawing-anchor")
    ))) {
      const duplicate = result.some((candidate) => {
        if (candidate.partName !== object.partName) return false;
        if (candidate._alternateRoot && candidate._alternateRoot === object._alternateRoot) return true;
        return candidate.normalizedText === object.normalizedText
          && Math.abs((candidate.widthPx || 0) - (object.widthPx || 0)) < 3
          && Math.abs((candidate.heightPx || 0) - (object.heightPx || 0)) < 3
          && Math.abs((candidate.x?.offsetPx || 0) - (object.x?.offsetPx || 0)) < 3
          && Math.abs((candidate.y?.offsetPx || 0) - (object.y?.offsetPx || 0)) < 3;
      });
      if (!duplicate) result.push(object);
    }
    return result.map((object) => {
      const { _alternateRoot, ...cleanObject } = object;
      return cleanObject;
    });
  }

  function parseFloatingObjectsFromXml(xmlText, options = {}) {
    const Parser = options.DOMParser || globalThis.DOMParser;
    if (!Parser) throw new Error("DOMParser is unavailable");
    const document = new Parser().parseFromString(xmlText, "application/xml");
    if (document.querySelector?.("parsererror")) throw new Error("Invalid OOXML part");
    const partName = options.partName || "word/document.xml";
    const drawings = Array.from(document.getElementsByTagNameNS(NS.wp, "anchor"))
      .map((anchor, index) => parseDrawingAnchor(anchor, partName, index))
      .filter(Boolean);
    return dedupeObjects([...drawings, ...collectVmlObjects(document, partName)]);
  }

  async function parseFloatingObjects(arrayBuffer, options = {}) {
    const Zip = options.JSZip || globalThis.JSZip;
    if (!Zip) throw new Error("JSZip is unavailable");
    const archive = await Zip.loadAsync(arrayBuffer);
    const partNames = Object.keys(archive.files)
      .filter((name) => /^word\/(?:document|header\d+|footer\d+)\.xml$/i.test(name))
      .sort((left, right) => Number(left !== "word/document.xml") - Number(right !== "word/document.xml") || left.localeCompare(right));
    const objects = [];
    for (const partName of partNames) {
      const xmlText = await archive.file(partName).async("string");
      objects.push(...parseFloatingObjectsFromXml(xmlText, { ...options, partName }));
    }
    return dedupeObjects(objects);
  }

  function matchFloatingObject(objects, text, usedKeys = new Set(), options = {}) {
    const normalizedText = normalizeMatchText(text);
    if (!normalizedText) return null;
    const partKind = options.partKind || null;
    const pageIndex = Number(options.pageIndex) || 0;
    const candidates = (objects || []).filter((object) => {
      if (partKind && object.partKind !== partKind) return false;
      const useKey = object.partKind === "document" ? object.id : `${object.id}:${pageIndex}`;
      if (usedKeys.has(useKey)) return false;
      return object.normalizedText === normalizedText
        || object.normalizedText.includes(normalizedText)
        || normalizedText.includes(object.normalizedText);
    }).sort((left, right) => (
      Number(right.normalizedText === normalizedText) - Number(left.normalizedText === normalizedText)
      || Math.abs(left.normalizedText.length - normalizedText.length)
        - Math.abs(right.normalizedText.length - normalizedText.length)
    ));
    const match = candidates[0] || null;
    if (match) {
      usedKeys.add(match.partKind === "document" ? match.id : `${match.id}:${pageIndex}`);
    }
    return match;
  }

  function resolveAxis(position, pageSize, contentStart, contentSize, objectSize, fallback) {
    const relative = String(position?.relativeFrom || "page").toLowerCase();
    let origin;
    let available;
    if (relative === "page") {
      origin = 0;
      available = pageSize;
    } else if (["margin", "column", "text"].includes(relative)) {
      origin = contentStart;
      available = contentSize;
    } else {
      return fallback;
    }
    const align = String(position?.align || "").toLowerCase();
    if (["center", "inside", "outside"].includes(align)) {
      if (align === "center") return origin + (available - objectSize) / 2;
      return align === "inside" ? origin : origin + available - objectSize;
    }
    if (["right", "bottom"].includes(align)) return origin + available - objectSize;
    if (["left", "top"].includes(align)) return origin;
    if (Number.isFinite(position?.offsetPx)) return origin + position.offsetPx;
    return fallback;
  }

  function resolveFloatingGeometry(object, page, fallback) {
    if (!object) return { ...fallback, resolved: false };
    const width = object.widthPx > 0 ? object.widthPx : fallback.width;
    const height = object.heightPx > 0 ? object.heightPx : fallback.height;
    const bounds = page.contentBounds;
    return {
      x: resolveAxis(object.x, page.width, bounds.x, bounds.width, width, fallback.x),
      y: resolveAxis(object.y, page.height, bounds.y, bounds.height, height, fallback.y),
      width,
      height,
      resolved: true,
    };
  }

  return {
    EMU_PER_PX,
    extractWordText,
    matchFloatingObject,
    normalizeMatchText,
    parseCssLength,
    parseFloatingObjects,
    parseFloatingObjectsFromXml,
    parseStyle,
    resolveFloatingGeometry,
  };
}));
