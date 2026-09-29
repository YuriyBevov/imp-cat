"""Unicode fonts shared by export measurement and PDF drawing."""
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FONT_DIRECTORY = Path(__file__).resolve().parents[1] / "public" / "fonts"
FAMILIES = ("Arial", "Times New Roman", "Courier New", "Georgia", "Verdana", "Tahoma", "Cambria", "Calibri")


def font_name(family, bold=False, italic=False):
    if family not in FAMILIES:
        family = "Arial"
    name = f"ICAT-{family.replace(' ', '')}-{int(bold)}{int(italic)}"
    if name not in pdfmetrics.getRegisteredFontNames():
        suffix = " Bold Italic" if bold and italic else " Bold" if bold else " Italic" if italic else ""
        system = Path("/System/Library/Fonts/Supplemental") / f"{family}{suffix}.ttf"
        fallback = "Serif" if family in ("Times New Roman", "Georgia", "Cambria") else "Mono" if family == "Courier New" else "Sans"
        variant = "BoldItalic" if bold and italic else "Bold" if bold else "Italic" if italic else "Regular"
        filename = system if system.exists() else FONT_DIRECTORY / f"Liberation{fallback}-{variant}.ttf"
        pdfmetrics.registerFont(TTFont(name, str(filename)))
    return name


def glyph_font(name, character):
    if character.isspace() or ord(character) in pdfmetrics.getFont(name).face.charToGlyph:
        return name
    # macOS supplies a wide Unicode fallback. Other platforms fail explicitly
    # instead of producing an apparently successful file with missing glyphs.
    fallback = "ICAT-Unicode"
    filename = Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")
    if filename.exists():
        if fallback not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(fallback, str(filename)))
        if ord(character) in pdfmetrics.getFont(fallback).face.charToGlyph:
            return fallback
    raise ValueError(f"Шрифт не содержит символ {character!r} (U+{ord(character):04X}). Выберите шрифт с поддержкой языка.")
