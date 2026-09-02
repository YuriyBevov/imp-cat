#!/usr/bin/env python3
"""Extract translation-sized text units from a DOCX without changing the file.

The extractor works against OOXML directly.  Every segment keeps a structural
address (part + paragraph + character range) so the CAT layer does not have to
use browser coordinates as the source of truth.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any
from zipfile import BadZipFile, ZipFile

from lxml import etree


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "w14": "http://schemas.microsoft.com/office/word/2010/wordml",
}
W = f"{{{NS['w']}}}"
W14 = f"{{{NS['w14']}}}"


def part_sort_key(name: str) -> tuple[int, int, str]:
    if name == "word/document.xml":
        return (0, 0, name)
    match = re.fullmatch(r"word/header(\d+)\.xml", name)
    if match:
        return (1, int(match.group(1)), name)
    match = re.fullmatch(r"word/footer(\d+)\.xml", name)
    if match:
        return (2, int(match.group(1)), name)
    if name == "word/footnotes.xml":
        return (3, 0, name)
    if name == "word/endnotes.xml":
        return (4, 0, name)
    return (9, 0, name)


def translatable_parts(names: list[str]) -> list[str]:
    parts = [
        name
        for name in names
        if name == "word/document.xml"
        or re.fullmatch(r"word/(?:header|footer)\d+\.xml", name)
        or name in {"word/footnotes.xml", "word/endnotes.xml"}
    ]
    return sorted(parts, key=part_sort_key)


def on_off(run: etree._Element | None, property_name: str) -> bool:
    if run is None:
        return False
    node = run.find(f"w:rPr/w:{property_name}", namespaces=NS)
    if node is None:
        return False
    value = node.get(f"{W}val")
    return value not in {"0", "false", "off", "none"}


def run_style(run: etree._Element | None) -> dict[str, Any]:
    if run is None:
        return {}
    properties = run.find("w:rPr", namespaces=NS)
    fonts = properties.find("w:rFonts", namespaces=NS) if properties is not None else None
    size = properties.find("w:sz", namespaces=NS) if properties is not None else None
    color = properties.find("w:color", namespaces=NS) if properties is not None else None
    return {
        "bold": on_off(run, "b"),
        "italic": on_off(run, "i"),
        "underline": properties is not None and properties.find("w:u", namespaces=NS) is not None,
        "font": (fonts.get(f"{W}ascii") or fonts.get(f"{W}hAnsi")) if fonts is not None else None,
        "fontSizePt": round(int(size.get(f"{W}val")) / 2, 2) if size is not None and (size.get(f"{W}val") or "").isdigit() else None,
        "color": color.get(f"{W}val") if color is not None else None,
    }


def nearest_ancestor(node: etree._Element, tag: str) -> etree._Element | None:
    parent = node.getparent()
    while parent is not None:
        if parent.tag == f"{W}{tag}":
            return parent
        parent = parent.getparent()
    return None


def paragraph_text_and_runs(paragraph: etree._Element) -> tuple[str, list[dict[str, Any]]]:
    chunks: list[str] = []
    runs: list[dict[str, Any]] = []
    offset = 0

    for node in paragraph.iter():
        if nearest_ancestor(node, "del") is not None:
            continue
        if node.tag == f"{W}t":
            value = node.text or ""
        elif node.tag == f"{W}tab":
            value = "\t"
        elif node.tag in {f"{W}br", f"{W}cr"}:
            value = "\n"
        elif node.tag == f"{W}noBreakHyphen":
            value = "‑"
        elif node.tag == f"{W}softHyphen":
            value = "\u00ad"
        else:
            continue

        if not value:
            continue
        owner_run = nearest_ancestor(node, "r")
        style = run_style(owner_run)
        start = offset
        offset += len(value)
        chunks.append(value)
        if runs and runs[-1]["style"] == style and runs[-1]["end"] == start:
            runs[-1]["end"] = offset
        else:
            runs.append({"start": start, "end": offset, "style": style})

    return "".join(chunks), runs


def next_non_space(text: str, index: int) -> str:
    while index < len(text) and text[index].isspace():
        index += 1
    return text[index] if index < len(text) else ""


def previous_word(text: str, index: int) -> str:
    match = re.search(r"([\wА-Яа-яЁё]+)[.!?…»”\"')\]]*$", text[:index])
    return match.group(1) if match else ""


def segment_spans(text: str) -> list[tuple[int, int]]:
    """Split at line breaks and conservative sentence boundaries."""
    boundaries = {0, len(text)}
    for match in re.finditer(r"\n+", text):
        boundaries.add(match.start())
        boundaries.add(match.end())

    for match in re.finditer(r"[.!?…]+[»”\"')\]]*\s+", text):
        punctuation_end = match.start()
        following = next_non_space(text, match.end())
        word = previous_word(text, punctuation_end + 1)
        if not following:
            boundaries.add(match.end())
            continue
        if following.isupper() or following.isdigit() or following in "«„“\"(":
            if not (text[punctuation_end] == "." and len(word) <= 2):
                boundaries.add(match.end())

    ordered = sorted(boundaries)
    spans: list[tuple[int, int]] = []
    for start, end in zip(ordered, ordered[1:]):
        while start < end and text[start].isspace():
            start += 1
        while end > start and text[end - 1].isspace():
            end -= 1
        if start < end:
            spans.append((start, end))
    return spans


def paragraph_kind(part_name: str, paragraph: etree._Element) -> str:
    if nearest_ancestor(paragraph, "txbxContent") is not None:
        return "text-box"
    if nearest_ancestor(paragraph, "tc") is not None:
        return "table-cell"
    if "/header" in part_name:
        return "header"
    if "/footer" in part_name:
        return "footer"
    if part_name.endswith("footnotes.xml"):
        return "footnote"
    if part_name.endswith("endnotes.xml"):
        return "endnote"
    return "paragraph"


def element_index(elements: list[etree._Element], target: etree._Element) -> int | None:
    for index, element in enumerate(elements):
        if element is target:
            return index
    return None


def structural_location(
    root: etree._Element,
    paragraph: etree._Element,
    paragraph_index: int,
    sentence_index: int,
    start: int,
    end: int,
) -> dict[str, Any]:
    location: dict[str, Any] = {
        "paragraphIndex": paragraph_index,
        "sentenceIndex": sentence_index,
        "charStart": start,
        "charEnd": end,
        "xmlPath": root.getroottree().getpath(paragraph),
    }
    paragraph_id = paragraph.get(f"{W14}paraId")
    if paragraph_id:
        location["paragraphId"] = paragraph_id

    cell = nearest_ancestor(paragraph, "tc")
    row = nearest_ancestor(paragraph, "tr")
    table = nearest_ancestor(paragraph, "tbl")
    if table is not None:
        location["tableIndex"] = element_index(root.xpath(".//w:tbl", namespaces=NS), table)
    if row is not None and table is not None:
        location["rowIndex"] = element_index(table.xpath("./w:tr", namespaces=NS), row)
    if cell is not None and row is not None:
        location["cellIndex"] = element_index(row.xpath("./w:tc", namespaces=NS), cell)
    return location


def formatting_for_span(runs: list[dict[str, Any]], start: int, end: int) -> dict[str, Any]:
    styles = [run["style"] for run in runs if run["end"] > start and run["start"] < end]
    if not styles:
        return {}
    fonts = sorted({style["font"] for style in styles if style.get("font")})
    sizes = sorted({style["fontSizePt"] for style in styles if style.get("fontSizePt") is not None})
    colors = sorted({style["color"] for style in styles if style.get("color")})
    return {
        "hasBold": any(style.get("bold") for style in styles),
        "allBold": all(style.get("bold") for style in styles),
        "hasItalic": any(style.get("italic") for style in styles),
        "allItalic": all(style.get("italic") for style in styles),
        "hasUnderline": any(style.get("underline") for style in styles),
        "fonts": fonts,
        "fontSizesPt": sizes,
        "colors": colors,
    }


def extract_docx_segments(document_path: Path) -> dict[str, Any]:
    segments: list[dict[str, Any]] = []
    kind_counts: dict[str, int] = {}

    try:
        archive = ZipFile(document_path)
    except (BadZipFile, FileNotFoundError) as error:
        raise ValueError("Файл не является читаемым DOCX") from error

    with archive:
        parts = translatable_parts(archive.namelist())
        for part_name in parts:
            root = etree.fromstring(archive.read(part_name))
            # A host paragraph around a text box contains another w:p.  Taking
            # only leaf paragraphs avoids extracting the same visible text twice.
            paragraphs = root.xpath(".//w:p[not(descendant::w:p)]", namespaces=NS)
            for paragraph_index, paragraph in enumerate(paragraphs):
                text, runs = paragraph_text_and_runs(paragraph)
                if not text.strip():
                    continue
                kind = paragraph_kind(part_name, paragraph)
                for sentence_index, (start, end) in enumerate(segment_spans(text)):
                    source = text[start:end]
                    location = structural_location(
                        root, paragraph, paragraph_index, sentence_index, start, end
                    )
                    anchor = location.get("paragraphId") or location["xmlPath"]
                    digest = hashlib.sha256(
                        f"{part_name}|{anchor}|{sentence_index}".encode("utf-8")
                    ).hexdigest()[:18]
                    segment = {
                        "id": f"seg-{digest}",
                        "order": len(segments) + 1,
                        "source": source,
                        "kind": kind,
                        "part": part_name,
                        "location": location,
                        "formatting": formatting_for_span(runs, start, end),
                    }
                    segments.append(segment)
                    kind_counts[kind] = kind_counts.get(kind, 0) + 1

    return {
        "version": 2,
        "summary": {
            "total": len(segments),
            "parts": len(parts),
            "byKind": kind_counts,
        },
        "segments": segments,
    }


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: extract_docx_segments.py input.docx")
    result = extract_docx_segments(Path(sys.argv[1]))
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
