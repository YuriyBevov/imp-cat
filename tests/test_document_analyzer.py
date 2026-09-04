import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("document_analyzer", ROOT / "scripts" / "document_analyzer.py")
ANALYZER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = ANALYZER
SPEC.loader.exec_module(ANALYZER)


class DocumentAnalyzerTests(unittest.TestCase):
    def test_native_pdf_text_and_typographic_styles_are_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / "native.pdf"
            output = directory / "pages"
            pdf = canvas.Canvas(str(source), pagesize=(240, 320))
            pdf.setFont("Times-Roman", 11)
            pdf.drawString(24, 280, "Normal text")
            pdf.setFont("Times-Bold", 15)
            pdf.drawString(24, 245, "Bold heading")
            pdf.save()

            analysis = ANALYZER.analyze_document(source, output, enable_ocr=False)

            self.assertEqual(len(analysis["pages"]), 1)
            page = analysis["pages"][0]
            self.assertTrue((output / "page-001.png").is_file())
            self.assertEqual(page["nativeLineCount"], 2)
            by_text = {line["text"]: line for line in page["lines"]}
            self.assertIn("Normal text", by_text)
            self.assertIn("Bold heading", by_text)
            self.assertEqual(by_text["Bold heading"]["fontWeight"], 700)
            self.assertGreater(by_text["Bold heading"]["fontSize"], by_text["Normal text"]["fontSize"])

    def test_multi_pass_merge_keeps_best_text_and_alternatives(self):
        first = ANALYZER.Observation("Univeristy", 0.72, [], 10, 20, 180, 24, source="rapidocr-full:latin")
        second = ANALYZER.Observation("University", 0.96, [], 11, 20, 179, 24, source="rapidocr-enhanced:latin")

        merged = ANALYZER.merge_observations([first, second])

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].text, "University")
        self.assertIn("Univeristy", merged[0].alternatives)

    def test_tile_fragment_is_merged_into_the_complete_line(self):
        fragment = ANALYZER.Observation("New Hampshire", 0.97, [], 120, 60, 150, 24, source="rapidocr-tile:latin")
        complete = ANALYZER.Observation("University of New Hampshire", 0.91, [], 20, 59, 260, 25, source="rapidocr-full:latin")

        merged = ANALYZER.merge_observations([fragment, complete])

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].text, "University of New Hampshire")
        self.assertIn("New Hampshire", merged[0].alternatives)

    def test_native_pdf_text_wins_over_raster_alternative(self):
        native = ANALYZER.Observation("Faculty of Law", 0.999, [], 20, 59, 180, 25, source="native-pdf")
        raster = ANALYZER.Observation("Faculty of tau", 0.999, [], 20, 59, 180, 25, source="rapidocr-full:latin")

        merged = ANALYZER.merge_observations([raster, native])

        self.assertEqual(merged[0].text, "Faculty of Law")
        self.assertIn("Faculty of tau", merged[0].alternatives)

    def test_tile_origins_cover_both_page_edges(self):
        origins = ANALYZER.tile_origins(3508, 1800, 160)
        self.assertEqual(origins[0], 0)
        self.assertEqual(origins[-1], 1708)


if __name__ == "__main__":
    unittest.main()
