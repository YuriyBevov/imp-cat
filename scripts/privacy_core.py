"""Local, reversible document redaction. This module never calls a network API."""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


class PrivacyError(ValueError):
    """Public errors must not include document contents."""


TOKEN_RE = re.compile(r"ICATPII_[A-F0-9]{8}_[A-Z]+_[0-9]{4}")
LANGUAGE_MODELS = {"en": "en_core_web_sm", "de": "de_core_news_sm", "fr": "fr_core_news_sm",
                   "es": "es_core_news_sm", "it": "it_core_news_sm", "pt": "pt_core_news_sm"}
OCR_LANGUAGES = {"en": "eng", "de": "deu", "fr": "fra", "es": "spa", "it": "ita", "pt": "por"}
FIELD_LABELS = {
    "en": r"full name|first name|last name|given names?|surname|name|residential address|mailing address|address|date of birth|dob|passport(?:\s+(?:number|no\.?))?|national id|identity number|account(?:\s+(?:number|no\.?))?|tax id|social security number",
    "de": r"vollständiger name|vorname|nachname|name|anschrift|adresse|geburtsdatum|reisepassnummer|passnummer|kontonummer|steueridentifikationsnummer",
    "fr": r"nom complet|prénom|nom|adresse|date de naissance|numéro de passeport|passeport|numéro de compte|identifiant fiscal",
    "es": r"nombre completo|nombre|apellidos?|dirección|fecha de nacimiento|número de pasaporte|pasaporte|número de cuenta|identificación fiscal",
    "it": r"nome completo|nome|cognome|indirizzo|data di nascita|numero di passaporto|passaporto|numero di conto|codice fiscale",
    "pt": r"nome completo|nome|sobrenome|morada|endereço|data de nascimento|número do passaporte|passaporte|número da conta|identificação fiscal",
}


@dataclass(frozen=True)
class Finding:
    start: int
    end: int
    kind: str
    method: str


def resolve_findings(findings: list[Finding]) -> list[Finding]:
    """Union intersecting spans instead of leaving partially detected PII exposed."""
    result = []
    for item in sorted(findings, key=lambda f: (f.start, -f.end)):
        if item.start < 0 or item.end <= item.start:
            continue
        if result and item.start < result[-1].end:
            previous = result.pop()
            result.append(Finding(previous.start, max(previous.end, item.end),
                                  previous.kind if previous.kind == item.kind else "PRIVATE", "combined"))
        else:
            result.append(item)
    return result


class Detector:
    """Rules plus an installed local NER model; no model download at runtime."""
    def __init__(self, language="en", known_values=None, nlp=None):
        if language not in LANGUAGE_MODELS:
            raise PrivacyError("Language is not supported for privacy detection.")
        self.language = language
        self.known_values = known_values or []
        if nlp is None:
            try:
                import spacy
                nlp = spacy.load(LANGUAGE_MODELS[language], disable=["parser", "lemmatizer"])
            except Exception:
                raise PrivacyError("Local NER model is unavailable. Install privacy dependencies and the documented model.") from None
        self.nlp = nlp

    def find(self, text: str) -> list[Finding]:
        # Preserve offsets while preventing NER/rules from re-detecting placeholders.
        visible = TOKEN_RE.sub(lambda m: " " * len(m.group()), text)
        findings = []
        patterns = [
            ("EMAIL", r"(?<![\w.+-])[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+"),
            ("PHONE", r"(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]){2,4}\d{2,4}(?!\w)"),
            ("IDENTIFIER", r"(?<!\w)\d{3}-\d{2}-\d{4}(?!\w)"),
            ("BANK", r"\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b"),
            # Deliberately broad numeric sequences: over-redaction is reviewable.
            ("IDENTIFIER", r"(?<!\w)\d(?:[ -]?\d){7,18}(?!\w)"),
        ]
        for kind, pattern in patterns:
            for match in re.finditer(pattern, visible, re.IGNORECASE):
                findings.append(Finding(match.start(), match.end(), kind, "pattern"))
        labels = FIELD_LABELS[self.language] + ("|" + FIELD_LABELS["en"] if self.language != "en" else "")
        field = re.compile(r"\b(?P<label>" + labels + r")\s*[:=]\s*(?P<value>[^\n;]+)", re.IGNORECASE)
        for match in field.finditer(visible):
            start, end = match.span("value")
            while end > start and visible[end - 1].isspace():
                end -= 1
            if end > start:
                findings.append(Finding(start, end, "FIELD", "field"))
        for value in self.known_values:
            if not isinstance(value, str) or not value.strip():
                raise PrivacyError("Known values must be nonempty strings.")
            for match in re.finditer(re.escape(value), visible, re.IGNORECASE):
                findings.append(Finding(match.start(), match.end(), "KNOWN", "known-value"))
        try:
            # Linewise processing bounds memory and keeps field offsets deterministic.
            offset = 0
            for line in visible.splitlines(keepends=True):
                for entity in self.nlp(line).ents:
                    if entity.label_ in {"PERSON", "PER", "ORG", "GPE", "LOC", "FAC"}:
                        kind = "PERSON" if entity.label_ in {"PERSON", "PER"} else "LOCATION" if entity.label_ in {"GPE", "LOC", "FAC"} else "ORG"
                        findings.append(Finding(offset + entity.start_char, offset + entity.end_char, kind, "ner"))
                offset += len(line)
        except Exception:
            raise PrivacyError("Local entity detection failed; no export is permitted.") from None
        return resolve_findings(findings)


class Registry:
    def __init__(self, namespace=None, entries=None):
        self.namespace = namespace or os.urandom(4).hex().upper()
        self.entries = entries or {}
        self.by_value = {v["original"]: k for k, v in self.entries.items()}

    def register(self, value, kind):
        if value in self.by_value:
            return self.by_value[value]
        token = f"ICATPII_{self.namespace}_{kind}_{len(self.entries) + 1:04d}"
        if len(self.entries) >= 9999:
            raise PrivacyError("Document exceeds the privacy entity limit.")
        self.entries[token] = {"original": value, "replacement": value, "kind": kind}
        self.by_value[value] = token
        return token

    def redact(self, text, findings):
        spans = []
        for finding in findings:
            token = self.register(text[finding.start:finding.end], finding.kind)
            spans.append((finding, token))
        result = text
        for finding, token in reversed(spans):
            result = result[:finding.start] + token + result[finding.end:]
        return result, spans

    def restore(self, text):
        def replace(match):
            entry = self.entries.get(match.group())
            if entry is None:
                raise PrivacyError("Unknown privacy placeholder; check the translated document.")
            return entry["replacement"]
        return TOKEN_RE.sub(replace, text)


def private_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if path.is_symlink():
        raise PrivacyError("Symlinks are not allowed for privacy artifacts.")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(data)


def key_bytes(path: Path, create=False):
    from cryptography.fernet import Fernet
    if create:
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            raise PrivacyError("Key already exists; it will not be overwritten.") from None
        with os.fdopen(descriptor, "wb") as output:
            output.write(Fernet.generate_key())
    if path.is_symlink() or not path.is_file():
        raise PrivacyError("A regular local key file is required.")
    if os.name != "nt" and path.stat().st_mode & 0o077:
        raise PrivacyError("Key permissions must be 0600.")
    try:
        key = path.read_bytes().strip()
        Fernet(key)
        return key
    except Exception:
        raise PrivacyError("Invalid local encryption key.") from None


def write_vault(path, key, value):
    from cryptography.fernet import Fernet
    private_write(path, Fernet(key).encrypt(json.dumps(value, ensure_ascii=False).encode()))


def read_vault(path, key):
    from cryptography.fernet import Fernet
    try:
        return json.loads(Fernet(key).decrypt(path.read_bytes()))
    except Exception:
        raise PrivacyError("Cannot authenticate the local privacy vault.") from None


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def words_from_tsv(tsv):
    words = []
    text = ""
    previous_line = None
    try:
        for row in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
            value = (row.get("text") or "").strip()
            if row.get("level") != "5" or not value:
                continue
            line = tuple(row[k] for k in ("page_num", "block_num", "par_num", "line_num"))
            if text:
                text += " " if line == previous_line else "\n"
            start = len(text)
            text += value
            x, y, width, height = (int(row[k]) for k in ("left", "top", "width", "height"))
            if min(x, y, width, height) < 0 or width == 0 or height == 0:
                raise ValueError()
            words.append({"start": start, "end": len(text), "box": [x, y, x + width, y + height],
                          "line": list(line), "confidence": float(row["conf"])})
            previous_line = line
    except Exception:
        raise PrivacyError("Invalid local OCR result.") from None
    return text, words


def local_ocr(image_path, language="en", executable="tesseract"):
    if language not in OCR_LANGUAGES:
        raise PrivacyError("OCR language is not enabled.")
    try:
        result = subprocess.run([executable, str(image_path), "stdout", "-l", OCR_LANGUAGES[language], "tsv"],
                                capture_output=True, timeout=180, check=True)
    except Exception:
        raise PrivacyError("Local OCR failed. Check Tesseract and installed language data.") from None
    return words_from_tsv(result.stdout.decode("utf-8"))


def draw_redactions(image, words, spans, manual_regions=()):
    """Overwrite pixel data; rebuild an RGB image without source metadata."""
    clean = Image.new("RGB", image.size, "white")
    clean.paste(image.convert("RGB"))
    draw = ImageDraw.Draw(clean)
    font_path = Path(__file__).resolve().parents[1] / "public/fonts/LiberationSans-Regular.ttf"
    boxes = []
    for finding, token in spans:
        lines = {}
        for word in words:
            if word["start"] < finding.end and word["end"] > finding.start:
                lines.setdefault(tuple(word["line"]), []).append(word["box"])
        if not lines:
            raise PrivacyError("A detected entity has no image coordinates.")
        for group in lines.values():
            boxes.append(([min(b[0] for b in group), min(b[1] for b in group),
                           max(b[2] for b in group), max(b[3] for b in group)], token))
    boxes += [(region["box"], region["token"]) for region in manual_regions]
    output = []
    for box, token in boxes:
        x0, y0, x1, y1 = box
        if not (0 <= x0 < x1 <= clean.width and 0 <= y0 < y1 <= clean.height):
            raise PrivacyError("Redaction coordinates are outside the page.")
        padding = max(4, round((y1 - y0) * .2))
        area = [max(0, x0 - padding), max(0, y0 - padding),
                min(clean.width, x1 + padding), min(clean.height, y1 + padding)]
        output.append({"box": area, "token": token})
    output = [mask for i, mask in enumerate(output) if not any(
        other["token"] == mask["token"] and j != i
        and other["box"][0] <= mask["box"][0] and other["box"][1] <= mask["box"][1]
        and other["box"][2] >= mask["box"][2] and other["box"][3] >= mask["box"][3]
        and (other["box"] != mask["box"] or j < i)
        for j, other in enumerate(output))]
    # Remove all originals first. Overlapping masks cannot reveal earlier pixels.
    for mask in output:
        draw.rectangle(mask["box"], fill="white")
    for mask in output:
        x0, y0, x1, y1 = mask["box"]
        size = max(10, min(48, int(y1 - y0) - 6))
        font = ImageFont.truetype(str(font_path), size)
        while font.getlength(mask["token"]) > x1 - x0 - 4 and size > 10:
            size -= 1
            font = ImageFont.truetype(str(font_path), size)
        # Do not spill labels onto unmasked source text. Approval rejects missing labels.
        mask["labelRendered"] = font.getlength(mask["token"]) <= x1 - x0 - 4 and y1 - y0 >= 14
        if mask["labelRendered"]:
            draw.text((x0 + 2, y0 + 2), mask["token"], font=font, fill="black")
    return clean, output
