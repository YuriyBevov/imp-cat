import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("document_analyzer", ROOT / "scripts" / "document_analyzer.py")
ANALYZER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = ANALYZER
SPEC.loader.exec_module(ANALYZER)


class DocumentRendererTests(unittest.TestCase):
    def test_pdf_pages_are_rendered_without_extracting_a_text_layer(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "native.pdf"
            output = directory / "pages"
            pdf = canvas.Canvas(str(source), pagesize=(240, 320))
            pdf.drawString(24, 280, "Page one")
            pdf.showPage()
            pdf.drawString(24, 280, "Page two")
            pdf.save()

            analysis = ANALYZER.render_document(source, output)

            self.assertEqual(analysis["engine"], "PyMuPDF/Pillow page renderer")
            self.assertEqual(len(analysis["pages"]), 2)
            self.assertTrue((output / "page-001.png").is_file())
            self.assertTrue((output / "page-002.png").is_file())
            self.assertNotIn("lines", analysis["pages"][0])
            self.assertGreater(analysis["pages"][0]["width"], 0)
            self.assertGreater(analysis["pages"][0]["height"], 0)

    def test_raster_is_normalized_and_rendered_as_one_page(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "scan.png"
            output = directory / "pages"
            Image.new("RGB", (900, 1200), "white").save(source)

            analysis = ANALYZER.render_document(source, output)

            self.assertEqual(len(analysis["pages"]), 1)
            self.assertEqual(analysis["pages"][0]["image"], "page-001.png")
            self.assertTrue((output / "page-001.png").is_file())


if __name__ == "__main__":
    unittest.main()
