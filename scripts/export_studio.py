#!/usr/bin/env python3
"""Export an ICAT Studio scene to an editable DOCX or a fixed-layout PDF."""

from __future__ import annotations

import json
import re
import sys
import copy
from statistics import median
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_docx import export_layout
from export_flow import export_flow


from export_fonts import font_name, glyph_font


def register_fonts() -> None:
    for family in ("Arial", "Times New Roman", "Courier New"):
        for bold, italic in ((False, False), (True, False), (False, True), (True, True)):
            font_name(family, bold, italic)


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
    objects = [item for item in scene.get("objects", []) if not item.get("excluded") and (item.get("type") == "table_cell" or output_text(item).strip())]

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
            "requestedFontSizePx": float(style.get("fontSizePx", 14) if item.get("manualTypography") else item.get("agentRequestedFontSizePx", style.get("fontSizePx", 14))),
            "fontWeight": float(style.get("fontWeight", 400)),
            "fontStyle": "italic" if style.get("fontStyle") == "italic" else "normal",
            "lineHeight": float(style.get("lineHeight", 1.2)),
            "color": str(style.get("color") or "#111827"),
            "alignment": str(style.get("textAlign") or "left"),
            "runs": text_runs(item, text),
            "borders": item.get("borders"),
            "isTableHeader": item.get("isTableHeader") is True,
        }

    table_groups: dict[tuple[int, str], list[tuple[int, dict]]] = {}
    for index, item in enumerate(objects):
        if item.get("type") != "table_cell":
            continue
        if not item.get("tableId") or not isinstance(item.get("rowIndex"), int) or not isinstance(item.get("columnIndex"), int):
            raise ValueError(f"Ячейка {item.get('id')}: укажите ID таблицы, строку и колонку.")
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
        first_row = min(cell["rowIndex"] for cell in cells)
        occupied = set()
        for cell in cells:
            cell["rowIndex"] -= first_row
            for row in range(cell["rowIndex"], cell["rowIndex"] + cell["rowSpan"]):
                for column in range(cell["columnIndex"], cell["columnIndex"] + cell["columnSpan"]):
                    if (row, column) in occupied:
                        raise ValueError(f"Таблица {table_id}, страница {page_index + 1}: пересекаются ячейки в строке {row + first_row + 1}, колонке {column + 1}.")
                    occupied.add((row, column))
        left = min(cell["x"] for cell in cells)
        top = min(cell["y"] for cell in cells)
        right = max(cell["x"] + cell["width"] for cell in cells)
        bottom = max(cell["y"] + cell["height"] for cell in cells)
        tables.append({
            "id": table_id,
            "pageIndex": page_index,
            "sourceRowStart": first_row,
            "x": left,
            "y": top,
            "width": right - left,
            "height": bottom - top,
            "rowCount": max(cell["rowIndex"] + cell["rowSpan"] for cell in cells),
            "columnCount": max(cell["columnIndex"] + cell["columnSpan"] for cell in cells),
            "cells": sorted(cells, key=lambda cell: (cell["rowIndex"], cell["columnIndex"])),
        })
    for table in tables:
        count = table["columnCount"]
        candidates = [[] for _ in range(count + 1)]
        for cell in table["cells"]:
            candidates[cell["columnIndex"]].append(cell["x"])
            candidates[cell["columnIndex"] + cell["columnSpan"]].append(cell["x"] + cell["width"])
        boundaries = [median(values) if values else None for values in candidates]
        boundaries[0], boundaries[-1] = table["x"], table["x"] + table["width"]
        known = [i for i, value in enumerate(boundaries) if value is not None]
        for start, end in zip(known, known[1:]):
            for i in range(start + 1, end):
                boundaries[i] = boundaries[start] + (boundaries[end] - boundaries[start]) * (i - start) / (end - start)
        widths = [boundaries[i + 1] - boundaries[i] for i in range(count)]
        if any(width <= 0 for width in widths):
            raise ValueError(f"Таблица {table['id']}: нарушен порядок колонок. Исправьте адреса ячеек.")
        table["columnWidths"] = widths
        for cell in table["cells"]:
            start = cell["columnIndex"]
            cell["x"] = boundaries[start]
            cell["width"] = boundaries[start + cell["columnSpan"]] - boundaries[start]
    return {
        "title": str(scene.get("title") or "Translated document"),
        "gridSize": 1,
        "pages": pages,
        "segments": segments,
        "tables": tables,
    }


def wrap_text(text: str, font_name: str, font_size: float, width: float) -> list[str]:
    result: list[str] = []
    for paragraph in text.split("\n"):
        words = [word for word in re.split(r"\s+", paragraph.strip()) if word]
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
    name = run.get("_font") or font_name(family, bold, italic)
    return name, max(4.5, float(run.get("fontSizePx", segment["fontSizePx"])) * 0.75)


def unicode_runs(segment):
    result = []
    for run in segment.get("runs") or [{"text": segment["text"]}]:
        name, _ = run_font(segment, run)
        for character in str(run.get("text", "")):
            resolved = glyph_font(name, character)
            style = {**run, "_font": resolved}
            style.pop("text", None)
            if result and result[-1][1] == style:
                result[-1] = (result[-1][0] + character, style)
            else:
                result.append((character, style))
    return [{**style, "text": text} for text, style in result]


def wrap_styled_runs(segment: dict, available_width: float) -> list[list[tuple[str, dict]]]:
    lines: list[list[tuple[str, dict]]] = [[]]
    line_width = 0.0
    pending_word: list[tuple[str, dict]] = []
    pending_space: list[tuple[str, dict]] = []

    def parts_width(parts: list[tuple[str, dict]]) -> float:
        return sum(pdfmetrics.stringWidth(text, *run_font(segment, run)) for text, run in parts)

    def append_word() -> None:
        nonlocal line_width, pending_word, pending_space
        if not pending_word:
            return
        leading = pending_space if lines[-1] else []
        candidate = [*leading, *pending_word]
        candidate_width = parts_width(candidate)
        if lines[-1] and line_width + candidate_width > available_width:
            lines.append([])
            line_width = 0.0
            candidate = pending_word
            candidate_width = parts_width(candidate)
        if candidate_width > available_width:
            for text, run in candidate:
                for character in text:
                    width = parts_width([(character, run)])
                    if lines[-1] and line_width + width > available_width:
                        lines.append([])
                        line_width = 0.0
                    if lines[-1] and lines[-1][-1][1] == run:
                        old, _ = lines[-1][-1]
                        lines[-1][-1] = (old + character, run)
                    else:
                        lines[-1].append((character, run))
                    line_width += width
        else:
            lines[-1].extend(candidate)
            line_width += candidate_width
        pending_word = []
        pending_space = []

    for run in unicode_runs(segment):
        for token in re.split(r"(\n|[^\S\n]+)", str(run.get("text", ""))):
            if not token:
                continue
            if token == "\n":
                append_word()
                pending_space = []
                lines.append([])
                line_width = 0.0
                continue
            if token.isspace():
                append_word()
                if lines[-1]:
                    pending_space.append((token, run))
                continue
            pending_word.append((token, run))
    append_word()
    return lines


def measured_height(segment: dict, table_cell=False) -> float:
    width = segment["width"] * .75 - (6 if table_cell else 0)
    if width <= 0:
        raise ValueError(f"Сегмент {segment['id']}: недостаточная ширина ячейки.")
    lines = wrap_styled_runs(segment, width)
    height = 0
    for line in lines:
        sizes = [run_font(segment, run)[1] for _, run in line]
        if sum(pdfmetrics.stringWidth(text, *run_font(segment, run)) for text, run in line) > width + .1:
            raise ValueError(f"Сегмент {segment['id']}: колонка уже одного символа. Увеличьте ширину.")
        height += max(sizes, default=segment["fontSizePx"] * .75) * max(.9, segment["lineHeight"])
    return height / .75 + (4 if table_cell else 0)


def prepare_export(payload: dict) -> dict:
    """Fit table rows, keep merged cells together, paginate identically for both formats.

    Only the export copy changes. Existing page boundaries remain boundaries;
    growth of a table moves the following content down by the same amount.
    """
    payload = copy.deepcopy(payload)
    original_pages = payload["pages"]
    result_pages, result_tables, result_segments = [], [], []
    for source_page in original_pages:
        page = copy.deepcopy(source_page)
        page["index"] = len(result_pages)
        result_pages.append(page)
        area = page["contentBounds"]
        bottom = min(page["heightPx"], area["y"] + area["height"])
        blocks = [(table["y"], 0, table) for table in payload["tables"] if table["pageIndex"] == source_page["index"]]
        blocks += [(item["y"], 1, item) for item in payload["segments"] if item["pageIndex"] == source_page["index"]]
        displacement = 0
        page_shift = 0

        def place(y, height):
            nonlocal page, page_shift
            target = max(area["y"] if page_shift else 0, y - page_shift)
            if height > bottom - area["y"] + .1:
                raise ValueError("Строка таблицы или сегмент выше страницы. Уменьшите шрифт или разделите содержимое.")
            if target + height > bottom + .1:
                page = copy.deepcopy(source_page)
                page["index"] = len(result_pages)
                result_pages.append(page)
                page_shift = y - area["y"]
                target = area["y"]
            return target

        for original_y, kind, block in sorted(blocks, key=lambda entry: (entry[0], entry[1], entry[2]["x"])):
            if kind:
                block["height"] = max(block["height"], measured_height(block))
                block["y"] = place(original_y + displacement, block["height"])
                block["pageIndex"] = page["index"]
                result_segments.append(block)
                continue
            table = block
            heights = [0.0] * table["rowCount"]
            for cell in table["cells"]:
                start, span = cell["rowIndex"], cell["rowSpan"]
                for row in range(start, start + span):
                    heights[row] = max(heights[row], cell["height"] / span)
            for cell in sorted(table["cells"], key=lambda cell: cell["rowSpan"]):
                start, span = cell["rowIndex"], cell["rowSpan"]
                missing = measured_height(cell, True) - sum(heights[start:start + span])
                if missing > 0:
                    heights[start + span - 1] += missing
            # A page break cannot pass through a vertically merged cell.
            groups = []
            start = 0
            while start < len(heights):
                end = start + 1
                while True:
                    expanded = max([end] + [cell["rowIndex"] + cell["rowSpan"] for cell in table["cells"] if start <= cell["rowIndex"] < end])
                    if expanded == end: break
                    end = expanded
                groups.append((start, end))
                start = end
            fragment = None
            for start, end in groups:
                height = sum(heights[start:end])
                y = place(original_y + displacement + sum(heights[:start]), height)
                if fragment is None or fragment["pageIndex"] != page["index"]:
                    fragment = {**table, "pageIndex": page["index"], "y": y, "height": 0, "rowCount": 0,
                                "sourceRowStart": table["sourceRowStart"] + start, "rowHeights": [], "cells": []}
                    result_tables.append(fragment)
                for cell in table["cells"]:
                    if not start <= cell["rowIndex"] < end: continue
                    row = cell["rowIndex"]
                    fragment["cells"].append({**cell, "pageIndex": page["index"],
                        "rowIndex": row - (fragment["sourceRowStart"] - table["sourceRowStart"]),
                        "y": y + sum(heights[start:row]), "height": sum(heights[row:row + cell["rowSpan"]])})
                fragment["height"] += height
                fragment["rowCount"] += end - start
                fragment["rowHeights"].extend(heights[start:end])
            displacement += sum(heights) - table["height"]
    payload.update(pages=result_pages, tables=result_tables, segments=result_segments)
    return payload


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
            padding_x = 3 if segment.get("_tableCell") else 0
            available_width = max(1, segment["width"] * 0.75 - 2 * padding_x)
            lines = wrap_styled_runs(segment, available_width)
            canvas.saveState()
            origin_x = segment["x"] * 0.75
            y = page_height - segment["y"] * 0.75
            if segment.get("_tableCell"):
                canvas.setStrokeColorRGB(0, 0, 0)
                canvas.setLineWidth(0.5)
                right, bottom = origin_x + segment["width"] * .75, y - segment["height"] * .75
                edges = {"top": (origin_x, y, right, y), "bottom": (origin_x, bottom, right, bottom),
                         "left": (origin_x, y, origin_x, bottom), "right": (right, y, right, bottom)}
                for side, coordinates in edges.items():
                    if (segment.get("borders") or {}).get(side) is True:
                        canvas.line(*coordinates)
            origin_x += padding_x
            if segment.get("_tableCell"): y -= 1.5
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
    if requested_format != 'docx':
        payload = prepare_export(payload)
    if not payload["pages"]:
        raise ValueError("Scene has no pages")
    if requested_format == "docx":
        export_flow(payload, output_path)
    elif requested_format == "pdf":
        export_pdf(payload, output_path)
    else:
        raise ValueError("Unsupported export format")
    print(json.dumps({"format": requested_format, "pages": len(payload["pages"]), "objects": len(payload["segments"])}))


if __name__ == "__main__":
    main()
