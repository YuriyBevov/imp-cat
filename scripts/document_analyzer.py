#!/usr/bin/env python3
"""Render PDF pages and raster images for the ICAT multimodal document agent."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence

import pymupdf
from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:
    pass


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".heic", ".bmp"}


def env_float(name: str, fallback: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.environ.get(name, fallback))
    except (TypeError, ValueError):
        value = fallback
    return min(maximum, max(minimum, value))


def env_int(name: str, fallback: int, minimum: int, maximum: int) -> int:
    return int(env_float(name, fallback, minimum, maximum))


def render_scale(width: float, height: float) -> float:
    requested = env_float("DOCUMENT_RENDER_DPI", 300, 144, 450) / 72.0
    maximum_pixels = env_int("DOCUMENT_RENDER_MAX_PIXELS", 16_000_000, 2_000_000, 40_000_000)
    if width * height * requested * requested > maximum_pixels:
        requested = math.sqrt(maximum_pixels / max(1.0, width * height))
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

    minimum_width = env_int("DOCUMENT_RENDER_MIN_WIDTH", 1800, 800, 3600)
    maximum_pixels = env_int("DOCUMENT_RENDER_MAX_PIXELS", 16_000_000, 2_000_000, 40_000_000)
    scale = max(1.0, minimum_width / max(1, image.width))
    if image.width * image.height * scale * scale > maximum_pixels:
        scale = math.sqrt(maximum_pixels / max(1, image.width * image.height))
    if abs(scale - 1.0) > 0.01:
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    return image


def page_manifest(index: int, image: Image.Image, filename: str) -> dict[str, Any]:
    return {
        "index": index,
        "width": image.width,
        "height": image.height,
        "image": filename,
    }


def render_document(source: Path, pages_directory: Path) -> dict[str, Any]:
    extension = source.suffix.lower()
    if extension != ".pdf" and extension not in IMAGE_EXTENSIONS:
        raise RuntimeError("Поддерживаются PDF, PNG, JPEG, WEBP, TIFF, HEIC и BMP")
    pages_directory.mkdir(parents=True, exist_ok=True)
    pages: list[dict[str, Any]] = []

    if extension == ".pdf":
        try:
            document = pymupdf.open(source)
        except Exception as error:
            raise RuntimeError(f"Не удалось прочитать PDF: {error}") from error
        with document:
            if document.needs_pass:
                raise RuntimeError("PDF защищён паролем")
            for index, page in enumerate(document):
                scale = render_scale(page.rect.width, page.rect.height)
                pixmap = page.get_pixmap(
                    matrix=pymupdf.Matrix(scale, scale),
                    alpha=False,
                    colorspace=pymupdf.csRGB,
                )
                image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
                filename = f"page-{index + 1:03d}.png"
                image.save(pages_directory / filename, format="PNG", optimize=True)
                pages.append(page_manifest(index, image, filename))
    else:
        image = normalize_raster(source)
        filename = "page-001.png"
        image.save(pages_directory / filename, format="PNG", optimize=True)
        pages.append(page_manifest(0, image, filename))

    return {
        "engine": "PyMuPDF/Pillow page renderer",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pages": pages,
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare document pages for the ICAT multimodal agent")
    parser.add_argument("input", type=Path)
    parser.add_argument("output_directory", type=Path)
    parser.add_argument("output_json", type=Path)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        result = render_document(args.input, args.output_directory)
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output_json.with_suffix(args.output_json.suffix + ".tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")
        temporary.replace(args.output_json)
        print(json.dumps({"pages": len(result["pages"]), "engine": result["engine"]}, ensure_ascii=False))
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
