#!/usr/bin/env python3
"""Local ICAT integration. JSON output is for the local backend, never an AI API."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

from anonymize_document import approve, prepare, verified_vault
from privacy_core import Detector, PrivacyError, Registry, TOKEN_RE, key_bytes, read_vault, write_vault

TEXT_KEYS = re.compile(r"text|translation|instruction|message|title|notes|language|summary|prompt|name|^source$", re.I)


def load_state(directory, key):
    base = verified_vault(directory, key)
    approval = read_vault(directory / "approval.enc", key)
    from privacy_core import sha256
    if approval.get("vaultHash") != sha256(directory / "vault.enc") or approval.get("pdfHash") != sha256(directory / "approved.pdf"):
        raise PrivacyError("Privacy approval does not match the prepared copy.")
    text_path = directory / "text-vault.enc"
    value = read_vault(text_path, key) if text_path.exists() else {
        "namespace": base["namespace"], "entries": base["entries"], "language": base["review"]["language"], "safeHashes": []}
    if value["namespace"] != base["namespace"]:
        raise PrivacyError("Mismatched text registry.")
    return base, value


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def text_values(value, field=""):
    if isinstance(value, dict):
        for name, child in value.items():
            yield from text_values(child, name)
    elif isinstance(value, list):
        for child in value:
            yield from text_values(child, field)
    elif isinstance(value, str) and TEXT_KEYS.search(field) and value.strip():
        yield value


def text_records(value, field="", path=""):
    if isinstance(value, dict):
        for name, child in value.items():
            yield from text_records(child, name, path + "/" + name)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            identity = child.get('id', index) if isinstance(child, dict) else index
            yield from text_records(child, field, path + "/" + str(identity))
    elif isinstance(value, str) and TEXT_KEYS.search(field) and value.strip():
        yield path, value


def transform(value, replace, field=""):
    if isinstance(value, dict):
        result = {name: transform(child, replace, name) for name, child in value.items()}
        if result.get("sourceText") != value.get("sourceText"):
            if "sourceTextStyles" in result: result["sourceTextStyles"] = []
        if result.get("translation") != value.get("translation"):
            if "translationTextStyles" in result: result["translationTextStyles"] = []
        return result
    if isinstance(value, list):
        return [transform(child, replace, field) for child in value]
    if isinstance(value, str) and TEXT_KEYS.search(field):
        return replace(value)
    return value


def known_replace(text, registry):
    values = sorted((value for value in registry.by_value if value), key=len, reverse=True)
    if not values:
        return text
    pattern = re.compile("|".join((r"(?<!\w)" if value[0].isalnum() else "") + re.escape(value)
                                + (r"(?!\w)" if value[-1].isalnum() else "") for value in values), re.I)
    lookup = {value.casefold(): registry.by_value[value] for value in values}
    # Existing placeholders are protected from matching short known values.
    parts = []
    last = 0
    for token in TOKEN_RE.finditer(text):
        parts.append(pattern.sub(lambda m: lookup[m.group().casefold()], text[last:token.start()]))
        parts.append(token.group())
        last = token.end()
    parts.append(pattern.sub(lambda m: lookup[m.group().casefold()], text[last:]))
    return "".join(parts)


def sanitize(directory, key, context, known_values=None):
    base, state = load_state(directory, key)
    registry = Registry(state["namespace"], state["entries"])
    detector = Detector(state["language"], known_values=known_values, allow_values=state.get("allowValues"))
    cached = {}
    changed = []
    safe = set(state.get("safeHashes", []))
    new_values = {text for path, text in text_records(context) if digest(path + '\0' + text) not in safe}
    unreviewed = []
    def replace(text):
        if text in cached:
            return cached[text]
        cleaned = known_replace(text, registry)
        cleaned, spans = registry.redact(cleaned, detector.find(cleaned))
        cached[text] = cleaned
        if cleaned != text:
            changed.append({"text": cleaned, "tokens": [token for _, token in spans]})
        if text.strip() and text in new_values:
            unreviewed.append(cleaned)
        return cleaned
    result = transform(context, replace)
    state["entries"] = registry.entries
    write_vault(directory / "text-vault.enc", key, state)
    return {"context": result, "needsReview": bool(unreviewed), "unreviewed": list(dict.fromkeys(unreviewed)),
            "changes": changed, "entityCount": len(registry.entries)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["init", "prepare", "review", "verify", "approve", "replacements", "sanitize", "seal", "restore", "settings", "open"])
    parser.add_argument("--key", type=Path, required=True)
    parser.add_argument("--directory", type=Path)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        if args.operation == "init":
            if not args.key.exists():
                try: key_bytes(args.key, create=True)
                except PrivacyError:
                    if not args.key.exists(): raise
            key_bytes(args.key)
            result = {"ok": True}
        else:
            key = key_bytes(args.key)
            directory = args.directory
            payload = json.loads(args.input.read_text()) if args.input and args.operation not in {"prepare", "open"} else {}
            if args.operation == "settings":
                write_vault(args.output, key, payload)
                result = {"ok": True}
            elif args.operation == "prepare":
                settings = read_vault(args.input, key)
                registry = None
                if settings.get("previousDirectory"):
                    previous = Path(settings["previousDirectory"])
                    _, state = load_state(previous, key)
                    registry = Registry(state["namespace"], state["entries"])
                detector = Detector(settings["language"], settings.get("knownValues"), allow_values=settings.get("allowValues"))
                result = prepare(settings["source"], directory, key, language=settings["language"], regions=settings.get("regions"),
                                 detector=detector, rotations=settings.get("rotations"), registry=registry, allow_unreadable=True)
                value = verified_vault(directory, key)
                value["allowValues"] = settings.get("allowValues", [])
                write_vault(directory / "vault.enc", key, value)
            elif args.operation == "review":
                value = verified_vault(directory, key)
                tokens = {mask["token"] for page in value["review"]["pages"] for mask in page["masks"]}
                if (directory / "approval.enc").exists():
                    _, state = load_state(directory, key)
                    value["entries"] = state["entries"]
                result = {**value["review"], "entities": [{"token": token, **entry} for token, entry in value["entries"].items() if token in tokens]}
            elif args.operation == "replacements":
                if not payload.get("reviewed"):
                    raise PrivacyError("Confirm the reviewed local replacements.")
                _, state = load_state(directory, key)
                for token, replacement in payload.get("replacements", {}).items():
                    if token not in state["entries"] or not isinstance(replacement, str) or len(replacement) > 10000:
                        raise PrivacyError("Invalid local replacement.")
                    state["entries"][token]["replacement"] = replacement
                write_vault(directory / "text-vault.enc", key, state)
                result = {"ok": True}
            elif args.operation == "approve":
                if not payload.get("reviewed"):
                    raise PrivacyError("All pages must be reviewed before approval.")
                value = verified_vault(directory, key)
                for token, replacement in payload.get("replacements", {}).items():
                    if token not in value["entries"] or not isinstance(replacement, str) or len(replacement) > 10000:
                        raise PrivacyError("Invalid local replacement.")
                    value["entries"][token]["replacement"] = replacement
                # Replacement edits affect the authenticated registry, not preview artifacts.
                write_vault(directory / "vault.enc", key, value)
                approve(directory, key, reviewed=True)
                state = {"namespace": value["namespace"], "entries": value["entries"], "language": value["review"]["language"],
                         "allowValues": value.get("allowValues", []), "safeHashes": []}
                write_vault(directory / "text-vault.enc", key, state)
                result = {"ok": True}
            elif args.operation == "sanitize":
                result = sanitize(directory, key, payload["context"], payload.get("knownValues"))
            elif args.operation == "verify":
                base, _ = load_state(directory, key)
                result = {"review": base["review"], "artifactHashes": base["artifactHashes"], "sourceHash": base["sourceHash"]}
            elif args.operation == "open":
                result = read_vault(args.input, key)
            elif args.operation == "seal":
                _, state = load_state(directory, key)
                safe = set(state.get("safeHashes", []))
                safe.update(digest(path + '\0' + value) for path, value in text_records(payload))
                if len(safe) > 100000:
                    raise PrivacyError("Document exceeds the protected text limit.")
                state["safeHashes"] = sorted(safe)
                write_vault(directory / "text-vault.enc", key, state)
                result = {"ok": True}
            else:
                _, state = load_state(directory, key)
                registry = Registry(state["namespace"], state["entries"])
                def restore_checked(text):
                    if "ICATPII_" in TOKEN_RE.sub("", text):
                        raise PrivacyError("Malformed privacy placeholder; correct the document locally before restoration.")
                    return registry.restore(text)
                result = transform(payload, restore_checked)
        if args.output and args.operation not in {"settings"}:
            from privacy_core import private_write
            private_write(args.output, json.dumps(result, ensure_ascii=False).encode())
            print(json.dumps({"ok": True}))
        else:
            print(json.dumps(result, ensure_ascii=False))
    except PrivacyError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2) from None
    except Exception:
        print("Local document privacy operation failed. No document was sent to an AI service.", file=sys.stderr)
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
