#!/usr/bin/env python3
"""Export an ICAT Studio scene to an editable DOCX or a fixed-layout PDF."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_docx import export_layout


FONT_FILES = {
    (False, False): "/System/Library/Fonts/Supplemental/Arial.ttf",
    (True, False): "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    (False, True): "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
    (True, True): "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf",
}
FONT_NAMES = {
    (False, False): "ICATArial",
    (True, False): "ICATArialBold",
    (False, True): "ICATArialItalic",
    (True, True): "ICATArialBoldItalic",
}


def register_fonts() -> None:
    for key, filename in FONT_FILES.items():
        if Path(filename).exists():
            pdfmetrics.registerFont(TTFont(FONT_NAMES[key], filename))


def output_text(item: dict) -> str:
    return str(item.get("translation") or item.get("sourceText") or "")


def text_runs(item: dict, text: str) -> list[dict]:
    field = "translation" if item.get("translation") else "sourceText"
    ranges = item.get("translationTextStyles" if field == "translation" else "sourceTextStyles") or []
    points = {0, len(text)}
    valid_ranges = []
    for candidate in ranges:
        start = max(0, min(len(text), int(candidate.get("start", 0))))
        end = max(start, min(len(text), int(candidate.get("end", start))))
        if end <= start:
            continue
        valid_ranges.append({**candidate, "start": start, "end": end})
        points.update((start, end))
    sorted_points = sorted(points)
    runs: list[dict] = []
    for index in range(len(sorted_points) - 1):
        start, end = sorted_points[index], sorted_points[index + 1]
        if end <= start:
            continue
        run = {"text": text[start:end]}
        for candidate in valid_ranges:
            if candidate["start"] <= start < candidate["end"]:
                for key in ("fontFamily", "fontSizePx", "fontWeight", "fontStyle", "color"):
                    if key in candidate:
                        run[key] = candidate[key]
        comparable = {key: value for key, value in run.items() if key != "text"}
        if runs and {key: value for key, value in runs[-1].items() if key != "text"} == comparable:
            runs[-1]["text"] += run["text"]
        else:
            runs.append(run)
    return runs


def normalize_scene(scene: dict) -> dict:
    pages = [
        {
            "id": f"page-{index + 1}",
            "index": index,
            "widthPx": float(page.get("widthPx", 794)),
            "heightPx": float(page.get("heightPx", 1123)),
            "contentBounds": {
                "x": float((page.get("contentBounds") or {}).get("x", 40)),
                "y": float((page.get("contentBounds") or {}).get("y", 40)),
                "width": float((page.get("contentBounds") or {}).get("width", float(page.get("widthPx", 794)) - 80)),
                "height": float((page.get("contentBounds") or {}).get("height", float(page.get("heightPx", 1123)) - 80)),
            },
        }
        for index, page in enumerate(scene.get("pages", []))
    ]
    objects = [item for item in scene.get("objects", []) if not item.get("excluded") and output_text(item).strip()]

    def normalize_segment(item: dict, index: int) -> dict:
        text = output_text(item)
        style = item.get("style") or {}
        return {
            "id": str(item.get("id") or f"object-{index + 1}"),
            "pageIndex": int(item.get("pageIndex", 0)),
            "text": text,
            "x": float(item.get("x", 0)),
            "y": float(item.get("y", 0)),
            "width": float(item.get("width", 120)),
            "height": float(item.get("height", 32)),
            "rotation": float(item.get("rotation", 0)),
            "zIndex": index + 1,
            "fontFamily": str(style.get("fontFamily") or "Arial"),
            "fontSizePx": float(style.get("fontSizePx", 14)),
            "fontWeight": float(style.get("fontWeight", 400)),
            "fontStyle": "italic" if style.get("fontStyle") == "italic" else "normal",
            "lineHeight": float(style.get("lineHeight", 1.2)),
            "color": str(style.get("color") or "#111827"),
            "alignment": str(style.get("textAlign") or "left"),
            "runs": text_runs(item, text),
        }

    table_groups: dict[tuple[int, str], list[tuple[int, dict]]] = {}
    for index, item in enumerate(objects):
        if item.get("type") != "table_cell" or not item.get("tableId"):
            continue
        if not isinstance(item.get("rowIndex"), int) or not isinstance(item.get("columnIndex"), int):
            continue
        key = (int(item.get("pageIndex", 0)), str(item["tableId"]))
        table_groups.setdefault(key, []).append((index, item))

    structural_ids = {str(item.get("id")) for cells in table_groups.values() for _, item in cells}
    segments = [normalize_segment(item, index) for index, item in enumerate(objects) if str(item.get("id")) not in structural_ids]
    tables = []
    for (page_index, table_id), source_cells in table_groups.items():
        cells = []
        for index, item in source_cells:
            cell = normalize_segment(item, index)
            cell.update({
                "rowIndex": max(0, int(item.get("rowIndex", 0))),
                "columnIndex": max(0, int(item.get("columnIndex", 0))),
                "rowSpan": max(1, int(item.get("rowSpan", 1))),
                "columnSpan": max(1, int(item.get("columnSpan", 1))),
            })
            cells.append(cell)
        left = min(cell["x"] for cell in cells)
        top = min(cell["y"] for cell in cells)
        right = max(cell["x"] + cell["width"] for cell in cells)
        bottom = max(cell["y"] + cell["height"] for cell in cells)
        tables.append({
            "id": table_id,
            "pageIndex": page_index,
            "x": left,
            "y": top,
            "width": right - left,
            "height": bottom - top,
            "rowCount": max(cell["rowIndex"] + cell["rowSpan"] for cell in cells),
            "columnCount": max(cell["columnIndex"] + cell["columnSpan"] for cell in cells),
            "cells": sorted(cells, key=lambda cell: (cell["rowIndex"], cell["columnIndex"])),
        })
    return {
        "title": str(scene.get("title") or "Translated document"),
        "gridSize": 1,
        "pages": pages,
        "segments": segments,
        "tables": tables,
    }


def split_long_word(word: str, font_name: str, font_size: float, width: float) -> list[str]:
    pieces: list[str] = []
    current = ""
    for character in word:
        candidate = current + character
        if current and pdfmetrics.stringWidth(candidate, font_name, font_size) > width:
            pieces.append(current)
            current = character
        else:
            current = candidate
    if current:
        pieces.append(current)
    return pieces


def wrap_text(text: str, font_name: str, font_size: float, width: float) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        words: list[str] = []
        for word in re.split(r"\s+", paragraph.strip()):
            if not word:
                continue
            if pdfmetrics.stringWidth(word, font_name, font_size) > width:
                words.extend(split_long_word(word, font_name, font_size, width))
            else:
                words.append(word)
        if not words:
            result.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if pdfmetrics.stringWidth(candidate, font_name, font_size) <= width:
                current = candidate
            else:
                result.append(current)
                current = word
        result.append(current)
    return result


def parse_color(value: str) -> tuple[float, float, float]:
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", value or ""):
        return (0.07, 0.09, 0.13)
    return tuple(int(value[index:index + 2], 16) / 255 for index in (1, 3, 5))


def run_font(segment: dict, run: dict) -> tuple[str, float]:
    bold = float(run.get("fontWeight", segment["fontWeight"])) >= 600
    italic = run.get("fontStyle", segment["fontStyle"]) == "italic"
    family = str(run.get("fontFamily", segment.get("fontFamily", "Arial")))
    if family in {"Times New Roman", "Cambria", "Georgia"}:
        name = "Times-BoldItalic" if bold and italic else "Times-Bold" if bold else "Times-Italic" if italic else "Times-Roman"
    elif family == "Courier New":
        name = "Courier-BoldOblique" if bold and italic else "Courier-Bold" if bold else "Courier-Oblique" if italic else "Courier"
    else:
        name = FONT_NAMES[(bold, italic)] if FONT_NAMES[(bold, italic)] in pdfmetrics.getRegisteredFontNames() else (
            "Helvetica-BoldOblique" if bold and italic else "Helvetica-Bold" if bold else "Helvetica-Oblique" if italic else "Helvetica"
        )
    return name, max(4.5, float(run.get("fontSizePx", segment["fontSizePx"])) * 0.75)


def wrap_styled_runs(segment: dict, available_width: float) -> list[list[tuple[str, dict]]]:
    lines: list[list[tuple[str, dict]]] = [[]]
    line_width = 0.0
    for run in segment.get("runs") or [{"text": segment["text"]}]:
        font_name, font_size = run_font(segment, run)
        for token in re.split(r"(\n|\s+)", str(run.get("text", ""))):
            if not token:
                continue
            if token == "\n":
                lines.append([])
                line_width = 0.0
                continue
            token_width = pdfmetrics.stringWidth(token, font_name, font_size)
            if token.isspace() and not lines[-1]:
                continue
            if line_width + token_width <= available_width:
                lines[-1].append((token, run))
                line_width += token_width
                continue
            if lines[-1]:
                lines.append([])
                line_width = 0.0
                if token.isspace():
                    continue
            if token_width <= available_width:
                lines[-1].append((token, run))
                line_width = token_width
                continue
            current = ""
            for character in token:
                candidate = current + character
                if current and pdfmetrics.stringWidth(candidate, font_name, font_size) > available_width:
                    lines[-1].append((current, run))
                    lines.append([])
                    current = character
                else:
                    current = candidate
            if current:
                lines[-1].append((current, run))
                line_width = pdfmetrics.stringWidth(current, font_name, font_size)
    return lines


def export_pdf(payload: dict, output_path: Path) -> None:
    register_fonts()
    first_page = payload["pages"][0]
    canvas = Canvas(
        str(output_path),
        pagesize=(first_page["widthPx"] * 0.75, first_page["heightPx"] * 0.75),
        pageCompression=1,
    )
    for page_index, page in enumerate(payload["pages"]):
        page_width = page["widthPx"] * 0.75
        page_height = page["heightPx"] * 0.75
        if page_index:
            canvas.setPageSize((page_width, page_height))
        page_segments = [item for item in payload["segments"] if item["pageIndex"] == page["index"]]
        for table in payload.get("tables", []):
            if table["pageIndex"] != page["index"]:
                continue
            page_segments.extend({**cell, "_tableCell": True} for cell in table["cells"])
        for segment in sorted(
            page_segments,
            key=lambda item: (item["zIndex"], item["y"], item["x"]),
        ):
            available_width = max(8, segment["width"] * 0.75)
            lines = wrap_styled_runs(segment, available_width)
            canvas.saveState()
            origin_x = segment["x"] * 0.75
            y = page_height - segment["y"] * 0.75
            if segment.get("_tableCell"):
                canvas.setStrokeColorRGB(0.5, 0.5, 0.5)
                canvas.setLineWidth(0.5)
                canvas.rect(origin_x, y - segment["height"] * 0.75, segment["width"] * 0.75, segment["height"] * 0.75, stroke=1, fill=0)
            for line in lines:
                metrics = [run_font(segment, run) for _, run in line]
                maximum_size = max((size for _, size in metrics), default=max(4.5, segment["fontSizePx"] * 0.75))
                y -= maximum_size
                if y < 0:
                    break
                line_width = sum(pdfmetrics.stringWidth(text, *run_font(segment, run)) for text, run in line)
                alignment = segment["alignment"]
                if alignment == "center":
                    x = origin_x + max(0, (available_width - line_width) / 2)
                elif alignment == "right":
                    x = origin_x + max(0, available_width - line_width)
                else:
                    x = origin_x
                for text, run in line:
                    font_name, font_size = run_font(segment, run)
                    red, green, blue = parse_color(str(run.get("color", segment["color"])))
                    canvas.setFillColorRGB(red, green, blue)
                    canvas.setFont(font_name, font_size)
                    canvas.drawString(x, y, text)
                    x += pdfmetrics.stringWidth(text, font_name, font_size)
                y -= maximum_size * max(0.9, segment["lineHeight"]) - maximum_size
            canvas.restoreState()
        canvas.showPage()
    canvas.save()


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: export_studio.py SCENE.json OUTPUT.(docx|pdf) FORMAT")
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    requested_format = sys.argv[3].lower()
    scene = json.loads(input_path.read_text(encoding="utf-8"))
    payload = normalize_scene(scene)
    if not payload["pages"]:
        raise ValueError("Scene has no pages")
    if requested_format == "docx":
        export_layout(payload, output_path)
    elif requested_format == "pdf":
        export_pdf(payload, output_path)
    else:
        raise ValueError("Unsupported export format")
    print(json.dumps({"format": requested_format, "pages": len(payload["pages"]), "objects": len(payload["segments"])}))


if __name__ == "__main__":
    main()
