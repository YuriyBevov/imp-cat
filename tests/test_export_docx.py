import tempfile
import unittest
from pathlib import Path
import sys

from docx import Document
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from export_docx import export_layout  # noqa: E402


class ExportDocxTests(unittest.TestCase):
    def test_exports_positioned_editable_text_on_two_pages(self):
        payload = {
            "title": "Position test",
            "pages": [
                {"id": "page-1", "index": 0, "widthPx": 800, "heightPx": 1100},
                {"id": "page-2", "index": 1, "widthPx": 800, "heightPx": 1100},
            ],
            "segments": [
                {
                    "id": "one", "pageIndex": 0, "text": "First page", "x": 32, "y": 48,
                    "width": 300, "height": 60, "fontFamily": "Arial", "fontSizePx": 16,
                    "fontWeight": 400, "lineHeight": 1.2, "color": "#111827",
                    "alignment": "left", "zIndex": 1,
                },
                {
                    "id": "two", "pageIndex": 1, "text": "Second page", "x": 64, "y": 96,
                    "width": 320, "height": 70, "fontFamily": "Arial", "fontSizePx": 18,
                    "fontWeight": 700, "lineHeight": 1.2, "color": "#223344",
                    "alignment": "center", "zIndex": 2,
                },
            ],
        }

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output.docx"
            export_layout(payload, output)
            document = Document(output)

        self.assertEqual(len(document.sections), 2)
        text = "".join(node.text or "" for node in document.element.body.xpath(".//w:txbxContent//w:t"))
        self.assertIn("First page", text)
        self.assertIn("Second page", text)

        anchors = document.element.body.xpath(".//wp:anchor")
        self.assertEqual(len(anchors), 0)
        self.assertEqual(len(document.element.body.xpath(".//w:framePr")), 0)
        shapes = document.element.body.xpath(
            ".//*[local-name()='shape' and namespace-uri()='urn:schemas-microsoft-com:vml']"
        )
        self.assertEqual(len(shapes), 2)
        shape_types = document.element.body.xpath(
            ".//*[local-name()='shapetype' and namespace-uri()='urn:schemas-microsoft-com:vml']"
        )
        self.assertEqual(len(shape_types), 1)
        shape_ids = [shape.get("{urn:schemas-microsoft-com:office:office}spid") for shape in shapes]
        self.assertEqual(len(shape_ids), len(set(shape_ids)))
        shape_defaults = document.settings.element.xpath(
            ".//*[local-name()='shapedefaults' and namespace-uri()='urn:schemas-microsoft-com:office:office']"
        )
        self.assertGreater(
            max(int(node.get("spidmax", 0)) for node in shape_defaults),
            max(int(shape_id.rsplit("s", 1)[-1]) for shape_id in shape_ids),
        )
        self.assertIn("margin-left:24pt", shapes[0].get("style"))
        self.assertIn("margin-top:36pt", shapes[0].get("style"))
        self.assertIn("width:225pt", shapes[0].get("style"))
        self.assertIn("height:45pt", shapes[0].get("style"))
        self.assertIn("mso-position-horizontal-relative:page", shapes[0].get("style"))
        self.assertIn("mso-position-vertical-relative:page", shapes[0].get("style"))
        alternate_content = document.element.body.xpath(
            ".//*[local-name()='AlternateContent' and namespace-uri()='http://schemas.openxmlformats.org/markup-compatibility/2006']"
        )
        self.assertEqual(len(alternate_content), 0)

    def test_many_segments_share_one_flow_anchor_per_page(self):
        pages = [
            {"id": "page-1", "index": 0, "widthPx": 800, "heightPx": 1100},
            {"id": "page-2", "index": 1, "widthPx": 800, "heightPx": 1100},
        ]
        segments = []
        for index in range(240):
            page_index = index // 120
            segments.append({
                "id": f"segment-{index}",
                "pageIndex": page_index,
                "text": f"Text {index}",
                "x": (index % 6) * 120,
                "y": ((index // 6) % 20) * 50,
                "width": 110,
                "height": 40,
                "fontFamily": "Arial",
                "fontSizePx": 12,
                "fontWeight": 400,
                "lineHeight": 1.2,
                "color": "#111827",
                "alignment": "left",
                "zIndex": index + 1,
            })

        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "many.docx"
            export_layout({"title": "Many", "pages": pages, "segments": segments}, output)
            document = Document(output)

        self.assertEqual(len(document.sections), 2)
        vml_shapes = document.element.body.xpath(
            ".//*[local-name()='shape' and namespace-uri()='urn:schemas-microsoft-com:vml']"
        )
        self.assertEqual(len(document.element.body.xpath(".//wp:anchor")), 0)
        self.assertEqual(len(vml_shapes), 240)
        self.assertEqual(len(document.element.body.xpath(
            ".//*[local-name()='shapetype' and namespace-uri()='urn:schemas-microsoft-com:vml']"
        )), 1)
        self.assertEqual(len({
            shape.get("{urn:schemas-microsoft-com:office:office}spid") for shape in vml_shapes
        }), 240)
        self.assertEqual(len(document.element.body.xpath(".//w:framePr")), 0)
        self.assertEqual(len(document.element.body.xpath("./w:p")), 3)


if __name__ == "__main__":
    unittest.main()
