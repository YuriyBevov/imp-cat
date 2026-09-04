#!/usr/bin/env python3
"""Cross-platform document renderer and multi-pass OCR for ICAT.

The analyzer keeps the JSON contract previously produced by the macOS-only
Vision executable.  PDF text is extracted directly when available and is
supplemented with raster OCR.  Scans and images are recognized with RapidOCR
using ONNX Runtime, so the same code runs on macOS, Linux and Windows.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence

import pymupdf
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".heic", ".bmp"}
LANGUAGE_NAMES = {
    "arabic": "ARABIC",
    "ch": "CH",
    "ch_doc": "CH_DOC",
    "chinese_cht": "CHINESE_CHT",
    "cyrillic": "CYRILLIC",
    "devanagari": "DEVANAGARI",
    "el": "EL",
    "en": "EN",
    "eslav": "ESLAV",
    "japan": "JAPAN",
    "ka": "KA",
    "korean": "KOREAN",
    "latin": "LATIN",
    "ta": "TA",
    "te": "TE",
    "th": "TH",
}
USEFUL_TEXT = re.compile(r"[^\W_]", re.UNICODE)


@dataclass
class Observation:
    text: str
    confidence: float
    alternatives: list[str]
    x: float
    y: float
    width: float
    height: float
    source: str = "rapidocr"
    type: str = "text"
    fontFamily: str | None = None
    fontSize: float | None = None
    fontWeight: int | None = None
    fontStyle: str | None = None
    textStyles: list[dict[str, Any]] = field(default_factory=list)


def env_float(name: str, fallback: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.environ.get(name, fallback))
    except (TypeError, ValueError):
        value = fallback
    return min(maximum, max(minimum, value))


def env_int(name: str, fallback: int, minimum: int, maximum: int) -> int:
    return int(env_float(name, fallback, minimum, maximum))


def clean_text(value: Any) -> str:
    return re.sub(r"[ \t\f\v]+", " ", str(value or "")).strip()


def is_useful_text(value: str) -> bool:
    text = clean_text(value)
    return bool(text and USEFUL_TEXT.search(text))


def normalized_text(value: str) -> str:
    return re.sub(r"\s+", " ", clean_text(value)).casefold()


def polygon_bounds(polygon: Sequence[Sequence[float]]) -> tuple[float, float, float, float]:
    points = [(float(point[0]), float(point[1])) for point in polygon if len(point) >= 2]
    if not points:
        return 0.0, 0.0, 0.0, 0.0
    left = min(point[0] for point in points)
    top = min(point[1] for point in points)
    right = max(point[0] for point in points)
    bottom = max(point[1] for point in points)
    return left, top, max(0.0, right - left), max(0.0, bottom - top)


def overlap_ratio(left: Observation, right: Observation) -> float:
    intersection_width = max(0.0, min(left.x + left.width, right.x + right.width) - max(left.x, right.x))
    intersection_height = max(0.0, min(left.y + left.height, right.y + right.height) - max(left.y, right.y))
    smaller = min(left.width * left.height, right.width * right.height)
    return intersection_width * intersection_height / smaller if smaller > 0 else 0.0


def axis_overlap(start: float, length: float, other_start: float, other_length: float) -> float:
    intersection = max(0.0, min(start + length, other_start + other_length) - max(start, other_start))
    return intersection / max(1.0, min(length, other_length))


def area_similarity(left: Observation, right: Observation) -> float:
    smaller = min(left.width * left.height, right.width * right.height)
    larger = max(left.width * left.height, right.width * right.height)
    return smaller / larger if larger > 0 else 0.0


def text_quality(text: str) -> float:
    value = clean_text(text)
    if not value:
        return -2.0
    useful = sum(character.isalnum() for character in value)
    punctuation = sum(not character.isalnum() and not character.isspace() for character in value)
    quality = useful / max(1, len(value))
    if useful == 0:
        quality -= 1.0
    if punctuation > useful * 1.5:
        quality -= 0.5
    if re.search(r"(.)\1{5,}", value):
        quality -= 0.35
    return quality


def candidate_score(observation: Observation) -> float:
    source_bonus = 1.5 if observation.source == "native-pdf" else 0.0
    return observation.confidence + text_quality(observation.text) * 0.22 + source_bonus


def merge_observations(observations: Iterable[Observation]) -> list[Observation]:
    merged: list[Observation] = []
    ordered = sorted(observations, key=lambda item: (item.y, item.x, -item.width))
    for candidate in ordered:
        if not is_useful_text(candidate.text) or candidate.width < 1 or candidate.height < 1:
            continue
        candidate_text = normalized_text(candidate.text)
        matching_index = None
        for index, current in enumerate(merged):
            current_text = normalized_text(current.text)
            same_text = current_text == candidate_text
            nested_text = (
                min(len(current_text), len(candidate_text)) >= 3
                and (current_text in candidate_text or candidate_text in current_text)
            )
            geometry_match = overlap_ratio(current, candidate) >= 0.62 and area_similarity(current, candidate) >= 0.42
            same_text_match = overlap_ratio(current, candidate) >= 0.38 and same_text
            # A tile often sees only the middle of a long line. Treat that fragment
            # as an alternative of the full observation instead of a new segment.
            tile_fragment_match = (
                nested_text
                and axis_overlap(current.y, current.height, candidate.y, candidate.height) >= 0.62
                and axis_overlap(current.x, current.width, candidate.x, candidate.width) >= 0.62
            )
            if geometry_match or same_text_match or tile_fragment_match:
                matching_index = index
                break
        if matching_index is None:
            merged.append(candidate)
            continue
        current = merged[matching_index]
        current_text = normalized_text(current.text)
        candidate_text = normalized_text(candidate.text)
        if current.source == "native-pdf" and candidate.source != "native-pdf":
            preferred, secondary = current, candidate
        elif candidate.source == "native-pdf" and current.source != "native-pdf":
            preferred, secondary = candidate, current
        elif current_text in candidate_text and len(candidate_text) > len(current_text):
            preferred, secondary = candidate, current
        elif candidate_text in current_text and len(current_text) > len(candidate_text):
            preferred, secondary = current, candidate
        else:
            preferred, secondary = (candidate, current) if candidate_score(candidate) > candidate_score(current) else (current, candidate)
        alternatives: list[str] = []
        for value in [preferred.text, *preferred.alternatives, secondary.text, *secondary.alternatives]:
            value = clean_text(value)
            if value and normalized_text(value) != normalized_text(preferred.text) and value not in alternatives:
                alternatives.append(value)
        preferred.alternatives = alternatives[:8]
        preferred.confidence = max(preferred.confidence, secondary.confidence)
        merged[matching_index] = preferred
    return sorted(merged, key=lambda item: (item.y, item.x))


def render_scale(width: float, height: float) -> float:
    requested = env_float("DOCUMENT_OCR_DPI", 300, 144, 450) / 72.0
    max_pixels = env_int("DOCUMENT_OCR_MAX_PIXELS", 16_000_000, 2_000_000, 40_000_000)
    if width * height * requested * requested > max_pixels:
        requested = math.sqrt(max_pixels / max(1.0, width * height))
    return max(1.0, requested)


def normalize_raster(source: Path) -> Image.Image:
    try:
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
    except Exception as error:
        if source.suffix.lower() == ".heic":
            raise RuntimeError(
                "Не удалось прочитать HEIC. Установите зависимости из requirements.txt, включая pillow-heif"
            ) from error
        raise RuntimeError(f"Не удалось прочитать изображение: {error}") from error
    minimum_width = env_int("DOCUMENT_OCR_MIN_WIDTH", 1800, 800, 3600)
    maximum_pixels = env_int("DOCUMENT_OCR_MAX_PIXELS", 16_000_000, 2_000_000, 40_000_000)
    scale = max(1.0, minimum_width / max(1, image.width))
    if image.width * image.height * scale * scale > maximum_pixels:
        scale = math.sqrt(maximum_pixels / max(1, image.width * image.height))
    if abs(scale - 1.0) > 0.01:
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    return image


def dominant_span_style(spans: list[dict[str, Any]], scale: float) -> dict[str, Any]:
    if not spans:
        return {}
    dominant = max(spans, key=lambda span: len(clean_text(span.get("text"))))
    flags = int(dominant.get("flags", 0))
    return {
        "fontFamily": clean_text(dominant.get("font")) or "Arial",
        "fontSize": max(1.0, float(dominant.get("size", 10)) * scale),
        "fontWeight": 700 if flags & pymupdf.TEXT_FONT_BOLD else 400,
        "fontStyle": "italic" if flags & pymupdf.TEXT_FONT_ITALIC else "normal",
    }


def native_pdf_lines(page: pymupdf.Page, scale: float) -> list[Observation]:
    observations: list[Observation] = []
    document = page.get_text("dict", sort=True)
    for block in document.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = [span for span in line.get("spans", []) if clean_text(span.get("text"))]
            if not spans:
                continue
            text_parts: list[str] = []
            styles: list[dict[str, Any]] = []
            cursor = 0
            previous_right: float | None = None
            for span in spans:
                value = re.sub(r"[ \t\f\v]+", " ", str(span.get("text") or "")).strip()
                if not value:
                    continue
                bbox = span.get("bbox") or (0, 0, 0, 0)
                if (
                    text_parts
                    and not text_parts[-1].endswith((" ", "-", "–", "—", "/"))
                    and not value.startswith((" ", ",", ".", ":", ";", "!", "?", ")", "]", "}"))
                    and previous_right is not None
                    and float(bbox[0]) - previous_right > max(1.5, float(span.get("size", 10)) * 0.18)
                ):
                    text_parts.append(" ")
                    cursor += 1
                start = cursor
                text_parts.append(value)
                cursor += len(value)
                flags = int(span.get("flags", 0))
                styles.append({
                    "start": start,
                    "end": cursor,
                    "fontSizePx": max(1.0, float(span.get("size", 10)) * scale),
                    "fontWeight": 700 if flags & pymupdf.TEXT_FONT_BOLD else 400,
                    "fontStyle": "italic" if flags & pymupdf.TEXT_FONT_ITALIC else "normal",
                })
                previous_right = float(bbox[2])
            text = "".join(text_parts).strip()
            if not is_useful_text(text):
                continue
            bbox = line.get("bbox") or block.get("bbox") or (0, 0, 0, 0)
            style = dominant_span_style(spans, scale)
            observations.append(Observation(
                text=text,
                confidence=0.999,
                alternatives=[],
                x=float(bbox[0]) * scale,
                y=float(bbox[1]) * scale,
                width=max(1.0, (float(bbox[2]) - float(bbox[0])) * scale),
                height=max(1.0, (float(bbox[3]) - float(bbox[1])) * scale),
                source="native-pdf",
                textStyles=styles,
                **style,
            ))
    return observations


def enhanced_image(image: Image.Image) -> Image.Image:
    grayscale = ImageOps.grayscale(image)
    grayscale = ImageOps.autocontrast(grayscale, cutoff=1)
    grayscale = ImageEnhance.Contrast(grayscale).enhance(1.3)
    grayscale = grayscale.filter(ImageFilter.UnsharpMask(radius=1.0, percent=135, threshold=3))
    return grayscale.convert("RGB")


class RapidOcrBackend:
    def __init__(self, language_names: Sequence[str]):
        try:
            from rapidocr import LangRec, ModelType, OCRVersion, RapidOCR
        except ImportError as error:
            raise RuntimeError(
                "Локальный OCR не установлен. Выполните: .venv/bin/pip install -r requirements.txt"
            ) from error
        self.engines: list[tuple[str, Any]] = []
        for language_name in language_names:
            enum_name = LANGUAGE_NAMES.get(language_name.lower())
            if not enum_name or not hasattr(LangRec, enum_name):
                continue
            language = getattr(LangRec, enum_name)
            if language_name.lower() in {"ch", "ch_doc", "en"}:
                parameters = {"Rec.lang_type": language}
            else:
                parameters = {
                    "Rec.lang_type": language,
                    "Rec.model_type": ModelType.MOBILE,
                    "Rec.ocr_version": OCRVersion.PPOCRV5,
                }
            self.engines.append((language_name.lower(), RapidOCR(params=parameters)))
        if not self.engines:
            raise RuntimeError("Не настроен ни один поддерживаемый язык OCR")

    @staticmethod
    def _array(image: Image.Image):
        import numpy

        # RapidOCR/OpenCV expects BGR channel order.
        return numpy.asarray(image)[:, :, ::-1].copy()

    def recognize(self, image: Image.Image, offset_x: float = 0, offset_y: float = 0, source: str = "rapidocr") -> list[Observation]:
        array = self._array(image)
        observations: list[Observation] = []
        for language_name, engine in self.engines:
            result = engine(array, text_score=0.24, box_thresh=0.24, unclip_ratio=1.72)
            boxes = getattr(result, "boxes", None)
            texts = getattr(result, "txts", None) or ()
            scores = getattr(result, "scores", None) or ()
            if boxes is None:
                continue
            for polygon, text, score in zip(boxes, texts, scores):
                text = clean_text(text)
                if not is_useful_text(text):
                    continue
                x, y, width, height = polygon_bounds(polygon)
                observations.append(Observation(
                    text=text,
                    confidence=float(score),
                    alternatives=[],
                    x=x + offset_x,
                    y=y + offset_y,
                    width=width,
                    height=height,
                    source=f"{source}:{language_name}",
                ))
        return observations


def tile_origins(length: int, tile_size: int, overlap: int) -> list[int]:
    if length <= tile_size:
        return [0]
    step = max(1, tile_size - overlap)
    origins = list(range(0, max(1, length - tile_size + 1), step))
    last = max(0, length - tile_size)
    if not origins or origins[-1] != last:
        origins.append(last)
    return origins


def recognize_page(image: Image.Image, backend: RapidOcrBackend, enable_tiles: bool = True) -> tuple[list[Observation], dict[str, int]]:
    primary = backend.recognize(image, source="rapidocr-full")
    enhanced = backend.recognize(enhanced_image(image), source="rapidocr-enhanced")
    tiled: list[Observation] = []
    tile_size = env_int("DOCUMENT_OCR_TILE_SIZE", 1800, 900, 2800)
    overlap = min(tile_size // 3, env_int("DOCUMENT_OCR_TILE_OVERLAP", 160, 40, 500))
    if enable_tiles and (image.width > tile_size * 1.15 or image.height > tile_size * 1.15):
        for top in tile_origins(image.height, tile_size, overlap):
            for left in tile_origins(image.width, tile_size, overlap):
                crop = image.crop((left, top, min(image.width, left + tile_size), min(image.height, top + tile_size)))
                tiled.extend(backend.recognize(crop, left, top, source="rapidocr-tile"))
    return merge_observations([*primary, *enhanced, *tiled]), {
        "primaryLineCount": len(primary),
        "secondaryLineCount": len(enhanced) + len(tiled),
        "tileLineCount": len(tiled),
    }


def serialize_observation(observation: Observation) -> dict[str, Any]:
    value = asdict(observation)
    return {key: item for key, item in value.items() if item not in (None, [], "")}


def analyze_document(source: Path, pages_directory: Path, enable_ocr: bool = True) -> dict[str, Any]:
    extension = source.suffix.lower()
    if extension != ".pdf" and extension not in IMAGE_EXTENSIONS:
        raise RuntimeError("Поддерживаются PDF, PNG, JPEG, WEBP, TIFF, HEIC и BMP")
    pages_directory.mkdir(parents=True, exist_ok=True)
    configured_languages = [
        value.strip().lower()
        for value in os.environ.get("DOCUMENT_OCR_LANGUAGES", "latin,cyrillic").split(",")
        if value.strip()
    ]
    backend = RapidOcrBackend(configured_languages) if enable_ocr else None
    disable_tiles = os.environ.get("DOCUMENT_OCR_TILING", "true").strip().lower() in {"0", "false", "no", "off"}
    pages: list[dict[str, Any]] = []

    if extension == ".pdf":
        try:
            document = pymupdf.open(source)
        except Exception as error:
            raise RuntimeError(f"Не удалось прочитать PDF: {error}") from error
        with document:
            for index, page in enumerate(document):
                scale = render_scale(page.rect.width, page.rect.height)
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False, colorspace=pymupdf.csRGB)
                image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                filename = f"page-{index + 1:03d}.png"
                image.save(pages_directory / filename, format="PNG", optimize=True)
                native = native_pdf_lines(page, scale)
                if backend:
                    raster, stats = recognize_page(image, backend, enable_tiles=not disable_tiles)
                else:
                    raster, stats = [], {"primaryLineCount": 0, "secondaryLineCount": 0, "tileLineCount": 0}
                lines = merge_observations([*native, *raster])
                pages.append({
                    "index": index,
                    "width": image.width,
                    "height": image.height,
                    "image": filename,
                    "lines": [serialize_observation(item) for item in lines],
                    "nativeLineCount": len(native),
                    "recoveredLineCount": max(0, len(lines) - len(native)),
                    **stats,
                })
    else:
        image = normalize_raster(source)
        filename = "page-001.png"
        image.save(pages_directory / filename, format="PNG", optimize=True)
        if backend:
            lines, stats = recognize_page(image, backend, enable_tiles=not disable_tiles)
        else:
            lines, stats = [], {"primaryLineCount": 0, "secondaryLineCount": 0, "tileLineCount": 0}
        pages.append({
            "index": 0,
            "width": image.width,
            "height": image.height,
            "image": filename,
            "lines": [serialize_observation(item) for item in lines],
            "nativeLineCount": 0,
            "recoveredLineCount": len(lines),
            **stats,
        })

    return {
        "engine": f"RapidOCR/ONNX + PyMuPDF ({','.join(configured_languages)})",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pages": pages,
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cross-platform ICAT document analyzer")
    parser.add_argument("input", type=Path)
    parser.add_argument("output_directory", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--no-ocr", action="store_true", help="Render and extract a native PDF text layer only")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        result = analyze_document(args.input, args.output_directory, enable_ocr=not args.no_ocr)
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output_json.with_suffix(args.output_json.suffix + ".tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        temporary.replace(args.output_json)
        print(json.dumps({
            "pages": len(result["pages"]),
            "lines": sum(len(page["lines"]) for page in result["pages"]),
            "engine": result["engine"],
        }, ensure_ascii=False))
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
