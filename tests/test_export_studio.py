import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "export_studio.py"
SPEC = importlib.util.spec_from_file_location("export_studio", SCRIPT_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class StudioExporterTests(unittest.TestCase):
    def scene(self):
        return {
            "title": "Translation fixture",
            "pages": [
                {"index": 0, "widthPx": 794, "heightPx": 1123},
                {"index": 1, "widthPx": 794, "heightPx": 1123},
            ],
            "objects": [
                {
                    "id": "text-1", "pageIndex": 0, "type": "text",
                    "sourceText": "Original", "translation": "Перевод документа",
                    "x": 60, "y": 80, "width": 400, "height": 60,
                    "style": {"fontFamily": "Arial", "fontSizePx": 18, "fontWeight": 700, "fontStyle": "normal", "lineHeight": 1.2, "textAlign": "left", "color": "#111827"},
                },
                {
                    "id": "signature-1", "pageIndex": 1, "type": "signature",
                    "sourceText": "Signature", "translation": "/Подпись/",
                    "x": 500, "y": 900, "width": 180, "height": 28,
                    "style": {"fontFamily": "Arial", "fontSizePx": 14, "fontWeight": 400, "fontStyle": "italic", "lineHeight": 1.2, "textAlign": "center", "color": "#111827"},
                },
                {
                    "id": "excluded", "pageIndex": 0, "type": "text", "excluded": True,
                    "sourceText": "Must not be exported", "translation": "Не экспортировать",
                    "x": 0, "y": 0, "width": 200, "height": 20, "style": {},
                },
            ],
        }

    def test_normalize_prefers_translation_and_skips_excluded_objects(self):
        payload = MODULE.normalize_scene(self.scene())
        self.assertEqual(len(payload["segments"]), 2)
        self.assertEqual(payload["segments"][0]["text"], "Перевод документа")

    def test_exports_valid_two_page_docx_and_pdf(self):
        payload = MODULE.normalize_scene(self.scene())
        with tempfile.TemporaryDirectory() as directory:
            docx_path = Path(directory) / "result.docx"
            pdf_path = Path(directory) / "result.pdf"
            MODULE.export_layout(payload, docx_path)
            MODULE.export_pdf(payload, pdf_path)
            self.assertGreater(docx_path.stat().st_size, 1_000)
            self.assertGreater(pdf_path.stat().st_size, 1_000)
            with ZipFile(docx_path) as archive:
                xml = archive.read("word/document.xml").decode("utf-8")
                self.assertIn("Перевод документа", xml)
                self.assertNotIn("Не экспортировать", xml)
            self.assertTrue(pdf_path.read_bytes().startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
