#!/usr/bin/env python3
"""Prepare, review, approve and restore documents without any cloud request."""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

import pymupdf
from PIL import Image
from lxml import etree

from document_analyzer import render_document
from privacy_core import (Detector, Finding, LANGUAGE_MODELS, PrivacyError, Registry, TOKEN_RE, draw_redactions,
                          resolve_findings,
                          key_bytes, local_ocr, private_write, read_vault, sha256, write_vault)


def json_input(path, fallback):
    if not path:
        return fallback
    try:
        return json.loads(Path(path).read_text())
    except Exception:
        raise PrivacyError("Cannot read local JSON settings.") from None


def prepare(source, output, key, language="en", known_values=None, regions=None, detector=None, rotations=None, registry=None, allow_unreadable=False):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output.exists():
        raise PrivacyError("Use a new output directory; previous approvals must not be reused.")
    detector = detector or Detector(language, known_values)
    regions = regions or []
    if not isinstance(regions, list):
        raise PrivacyError("Manual regions must be an array.")
    output.mkdir(parents=True, mode=0o700)
    os.chmod(output, 0o700)
    registry = registry or Registry()
    pages, private_pages, unreadable_pages = [], [], []
    try:
        with tempfile.TemporaryDirectory(prefix="icat-private-") as temporary:
            rendered = render_document(source, Path(temporary), rotations)
            if len(rendered["pages"]) > 500:
                raise PrivacyError("Document exceeds the local privacy page limit.")
            for index, page in enumerate(rendered["pages"]):
                path = Path(temporary) / page["image"]
                text, words = local_ocr(path, language)
                if not words and not allow_unreadable:
                    raise PrivacyError("A page could not be read locally; prepare it manually instead of sending the original.")
                if not words:
                    unreadable_pages.append(index)
                findings = detector.find(text)
                manual = []
                for region in regions:
                    if not isinstance(region, dict) or not isinstance(region.get("page"), int):
                        raise PrivacyError("Every manual region needs a zero-based page and pixel box.")
                    if region["page"] < 0 or region["page"] >= len(rendered["pages"]):
                        raise PrivacyError("Manual region refers to a missing page.")
                    if region["page"] != index:
                        continue
                    box = region.get("box")
                    if not isinstance(box, list) or len(box) != 4 or any(not isinstance(v, (int, float)) for v in box):
                        raise PrivacyError("Manual region needs four pixel coordinates.")
                    covered = [word for word in words if word["box"][0] < box[2] and word["box"][2] > box[0]
                               and word["box"][1] < box[3] and word["box"][3] > box[1]]
                    if covered:
                        findings.append(Finding(min(w["start"] for w in covered), max(w["end"] for w in covered), "MANUAL", "manual-region"))
                    value = region.get("value", " ".join(text[w["start"]:w["end"]] for w in covered) or "[hidden graphic]")
                    if not isinstance(value, str) or not value:
                        raise PrivacyError("Manual region value must be a nonempty string.")
                    manual.append({"box": box, "value": value, "start": min((w["start"] for w in covered), default=None)})
                redacted, spans = registry.redact(text, resolve_findings(findings))
                for region in manual:
                    matched = next((token for finding, token in spans if region["start"] is not None
                                    and finding.start <= region["start"] < finding.end), None)
                    region["token"] = matched or registry.register(region["value"], "MANUAL")
                with Image.open(path) as image:
                    clean, masks = draw_redactions(image, words, spans, manual)
                filename = f"page-{index + 1:03d}.png"
                image_path = output / filename
                clean.save(image_path, format="PNG")
                os.chmod(image_path, 0o600)
                text_name = f"page-{index + 1:03d}.txt"
                private_write(output / text_name, redacted.encode())
                low_confidence = sum(word["confidence"] < 70 for word in words)
                pages.append({"index": index, "image": filename, "text": text_name,
                              "width": clean.width, "height": clean.height, "masks": masks,
                              "lowConfidenceWords": low_confidence})
                private_pages.append({"index": index, "text": text, "words": words})
        review = {"version": 1, "status": "needs-review", "language": language,
                  "entityCount": len(registry.entries), "pages": pages, "unreadablePages": unreadable_pages,
                  "warning": "Review all pages, names, handwriting, photographs, seals and QR codes before approval."}
        private_write(output / "review.json", json.dumps(review, ensure_ascii=False, indent=2).encode())
        gallery = "".join(f'<section><h2>Page {p["index"] + 1}</h2>'
                          f'<p>Masks: {len(p["masks"])}; low confidence words: {p["lowConfidenceWords"]}</p>'
                          f'<img src="{html.escape(p["image"])}" alt="Locally redacted page {p["index"] + 1}"></section>' for p in pages)
        private_write(output / "review.html", ("<!doctype html><html lang=en><meta charset=utf-8>"
                      "<meta http-equiv=Content-Security-Policy content=\"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'\">"
                      "<title>Local privacy review</title><style>body{font:16px Arial;margin:24px}h1{font-size:28px}h2{font-size:20px}img{max-width:100%;border:1px solid #888}</style>"
                      "<h1>Local privacy review</h1><p>These files may still contain missed personal information. "
                      "Do not upload the directory or key. Compare every page with the original; add known values or manual regions and prepare again if needed.</p>"
                      + gallery + "</html>").encode())
        artifact_names = ["review.json", "review.html"] + [name for p in pages for name in (p["image"], p["text"])]
        hashes = {name: sha256(output / name) for name in artifact_names}
        write_vault(output / "vault.enc", key, {"version": 1, "namespace": registry.namespace,
                    "entries": registry.entries, "sourceHash": sha256(source), "pages": private_pages,
                    "review": review, "artifactHashes": hashes})
        return review
    except Exception:
        # Incomplete preparations never contain an approved cloud artifact.
        private_write(output / "FAILED", b"Preparation failed. Do not upload these files.")
        raise


def verified_vault(output, key):
    output = Path(output)
    vault = read_vault(output / "vault.enc", key)
    if vault.get("version") != 1 or not vault.get("artifactHashes") or (output / "FAILED").exists():
        raise PrivacyError("Incomplete privacy preparation.")
    try:
        for name, digest in vault["artifactHashes"].items():
            if Path(name).name != name or (output / name).is_symlink() or sha256(output / name) != digest:
                raise PrivacyError("Prepared copy changed. Prepare and review it again.")
    except OSError:
        raise PrivacyError("Prepared copy is missing an artifact.") from None
    return vault


def approve(output, key, reviewed=False):
    if not reviewed:
        raise PrivacyError("Explicit --reviewed confirmation is required after inspecting every page.")
    output = Path(output)
    vault = verified_vault(output, key)
    for index in vault["review"].get("unreadablePages", []):
        page = vault["review"]["pages"][index]
        if not any(mask["box"][0] <= 0 and mask["box"][1] <= 0 and mask["box"][2] >= page["width"]
                   and mask["box"][3] >= page["height"] for mask in page["masks"]):
            raise PrivacyError("An unreadable page must be covered by a full-page manual mask before approval.")
    if any(not mask.get("labelRendered") for page in vault["review"]["pages"] for mask in page["masks"]):
        raise PrivacyError("A mask is too small for its placeholder. Add a wider manual region and prepare again.")
    destination = output / "approved.pdf"
    if destination.exists() or destination.is_symlink():
        raise PrivacyError("Approved PDF already exists; it will not be overwritten.")
    pdf = pymupdf.open()
    try:
        for page in vault["review"]["pages"]:
            # Images only: no original OCR layer, metadata, attachments or comments.
            width = 595.28
            height = width * page["height"] / page["width"]
            target = pdf.new_page(width=width, height=height)
            target.insert_image(target.rect, stream=(output / page["image"]).read_bytes())
        pdf.set_metadata({})
        private_write(destination, pdf.tobytes(garbage=4, deflate=True))
    finally:
        pdf.close()
    write_vault(output / "approval.enc", key, {"version": 1, "pdfHash": sha256(destination),
                                               "vaultHash": sha256(output / "vault.enc")})
    return destination


def restore_xml(data, registry):
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    root = etree.fromstring(data, parser)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    found = []
    # Placeholders can span Word runs. Work on a paragraph's concatenated text.
    for paragraph in root.xpath(".//w:p[not(descendant::w:p)]", namespaces=namespace):
        nodes = paragraph.xpath(".//w:t", namespaces=namespace)
        text = "".join(node.text or "" for node in nodes)
        matches = list(TOKEN_RE.finditer(text))
        found += [match.group() for match in matches]
        for match in reversed(matches):
            replacement = registry.restore(match.group())
            offset = 0
            started = False
            for node in nodes:
                value = node.text or ""
                end = offset + len(value)
                if offset < match.end() and end > match.start():
                    left = max(0, match.start() - offset)
                    right = min(len(value), match.end() - offset)
                    node.text = value[:left] + (replacement if not started else "") + value[right:]
                    node.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
                    started = True
                offset = end
        if "ICATPII_" in "".join(node.text or "" for node in nodes):
            raise PrivacyError("Damaged privacy placeholder; check the result manually.")
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True), found


def restore(source, output, directory, key, replacements=None, allow_missing=False):
    source, output, directory = Path(source), Path(output), Path(directory)
    if output.exists() or output.is_symlink():
        raise PrivacyError("Restore output already exists.")
    vault = verified_vault(directory, key)
    approval = read_vault(directory / "approval.enc", key)
    if approval.get("vaultHash") != sha256(directory / "vault.enc") or approval.get("pdfHash") != sha256(directory / "approved.pdf"):
        raise PrivacyError("Approval does not match this preparation.")
    registry = Registry(vault["namespace"], vault["entries"])
    for token, value in (replacements or {}).items():
        if token not in registry.entries or not isinstance(value, str):
            raise PrivacyError("Invalid approved replacement.")
        registry.entries[token]["replacement"] = value
    if source.suffix.lower() == ".docx":
        buffer = __import__("io").BytesIO()
        found = []
        try:
            with ZipFile(source) as original, ZipFile(buffer, "w") as target:
                if "word/document.xml" not in original.namelist():
                    raise PrivacyError("Input is not a DOCX.")
                if sum(info.file_size for info in original.infolist()) > 100 * 1024 * 1024:
                    raise PrivacyError("DOCX is too large for local restoration.")
                for info in original.infolist():
                    data = original.read(info)
                    if re.fullmatch(r"word/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml", info.filename):
                        data, tokens = restore_xml(data, registry)
                        found += tokens
                    target.writestr(info, data)
        except PrivacyError:
            raise
        except Exception:
            raise PrivacyError("Cannot restore this DOCX.") from None
        data = buffer.getvalue()
    elif source.suffix.lower() == ".txt":
        text = source.read_text()
        found = TOKEN_RE.findall(text)
        data = registry.restore(text).encode()
    else:
        raise PrivacyError("Restore supports DOCX and UTF-8 text; PDF restoration requires layout editing.")
    if not found and registry.entries:
        raise PrivacyError("No placeholders survived in the result. Check it manually before restoring.")
    if b"ICATPII_" in data and source.suffix.lower() == ".txt":
        raise PrivacyError("Damaged privacy placeholder; check the result manually.")
    missing = sorted(set(registry.entries) - set(found))
    if missing and not allow_missing:
        raise PrivacyError("Some placeholders are missing. Check the result or explicitly use --allow-missing for intentional omissions.")
    private_write(output, data)
    return {"restoredOccurrences": len(found), "missingTokens": missing}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init-key")
    init.add_argument("key_file", type=Path)
    prep = commands.add_parser("prepare")
    prep.add_argument("source", type=Path)
    prep.add_argument("--out", type=Path, required=True)
    prep.add_argument("--key-file", type=Path, required=True)
    prep.add_argument("--language", choices=sorted(LANGUAGE_MODELS), default="en")
    prep.add_argument("--known-values", type=Path)
    prep.add_argument("--regions", type=Path)
    approved = commands.add_parser("approve")
    approved.add_argument("directory", type=Path)
    approved.add_argument("--key-file", type=Path, required=True)
    approved.add_argument("--reviewed", action="store_true")
    restored = commands.add_parser("restore")
    restored.add_argument("source", type=Path)
    restored.add_argument("--out", type=Path, required=True)
    restored.add_argument("--directory", type=Path, required=True)
    restored.add_argument("--key-file", type=Path, required=True)
    restored.add_argument("--replacements", type=Path)
    restored.add_argument("--allow-missing", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "init-key":
            key_bytes(args.key_file, create=True)
            print("Local key created. Keep it separate from document work directories.")
            return
        key = key_bytes(args.key_file)
        if args.command == "prepare":
            if args.out.resolve() in args.key_file.resolve().parents:
                raise PrivacyError("Keep the key outside the preparation directory.")
            values = json_input(args.known_values, [])
            if not isinstance(values, list):
                raise PrivacyError("Known values must be a JSON array.")
            result = prepare(args.source, args.out, key, args.language, values, json_input(args.regions, []))
            print(json.dumps({"status": result["status"], "pages": len(result["pages"]), "entities": result["entityCount"]}))
        elif args.command == "approve":
            approve(args.directory, key, args.reviewed)
            print("Approved PDF created. Upload only approved.pdf, never the preparation directory.")
        else:
            print(json.dumps(restore(args.source, args.out, args.directory, key, json_input(args.replacements, {}), args.allow_missing)))
    except PrivacyError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print("Local privacy operation failed. No original document was sent anywhere.", file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
