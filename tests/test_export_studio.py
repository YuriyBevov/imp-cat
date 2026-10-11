import importlib.util
import json
import tempfile
import unittest
import copy
import pymupdf
from lxml import etree
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
                    "translationTextStyles": [{"start": 0, "end": 7, "fontSizePx": 24, "fontStyle": "italic"}],
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
        self.assertEqual(payload["segments"][0]["runs"][0]["fontSizePx"], 24)
        self.assertEqual(payload["segments"][0]["runs"][0]["text"], "Перевод")

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
                self.assertIn("Перевод", xml)
                self.assertIn(" документа", xml)
                self.assertNotIn("Не экспортировать", xml)
            self.assertTrue(pdf_path.read_bytes().startswith(b"%PDF"))

    def test_wrap_breaks_long_styled_words_without_losing_text(self):
        long_word = "неразрываемоедлинноеслово"
        self.assertEqual(MODULE.wrap_text(long_word, "Helvetica", 12, 20), [long_word])

        segment = {
            "text": long_word,
            "fontFamily": "Arial", "fontSizePx": 16, "fontWeight": 400,
            "fontStyle": "normal", "lineHeight": 1.2,
            "runs": [
                {"text": "неразрываемое", "fontWeight": 700},
                {"text": "длинноеслово", "fontWeight": 400},
            ],
        }
        lines = MODULE.wrap_styled_runs(segment, 20)
        self.assertGreater(len(lines), 1)
        self.assertEqual("".join(text for line in lines for text, _ in line), long_word)
        for line in lines:
            self.assertLessEqual(sum(MODULE.pdfmetrics.stringWidth(text, *MODULE.run_font(segment, run)) for text, run in line), 20.01)

    def test_exports_structural_cells_as_one_native_word_table(self):
        scene = self.scene()
        for row in range(2):
            for column in range(2):
                scene["objects"].append({
                    "id": f"cell-{row}-{column}", "pageIndex": 0, "type": "table_cell",
                    "tableId": "table-1", "rowIndex": row, "columnIndex": column,
                    "rowSpan": 1, "columnSpan": 1,
                    "sourceText": f"Cell {row + 1}:{column + 1}", "translation": f"Ячейка {row + 1}:{column + 1}",
                    "x": 60 + column * 200, "y": 220 + row * 40, "width": 200, "height": 40,
                    "style": {"fontFamily": "Arial", "fontSizePx": 12, "fontWeight": 400, "fontStyle": "normal", "lineHeight": 1.2, "textAlign": "left", "color": "#111827"},
                })
        payload = MODULE.normalize_scene(scene)
        self.assertEqual(len(payload["tables"]), 1)
        self.assertEqual(len(payload["tables"][0]["cells"]), 4)
        self.assertFalse(any(segment["id"].startswith("cell-") for segment in payload["segments"]))
        with tempfile.TemporaryDirectory() as directory:
            docx_path = Path(directory) / "table.docx"
            MODULE.export_layout(payload, docx_path)
            with ZipFile(docx_path) as archive:
                xml = archive.read("word/document.xml").decode("utf-8")
                self.assertEqual(xml.count("<w:tbl>"), 1)
                self.assertIn("Ячейка 2:2", xml)
                self.assertIn('style="mso-fit-shape-to-text:t"', xml)

    def table_scene(self):
        scene = self.scene()
        scene["objects"] = []
        for row in range(2):
            for column in range(2):
                scene["objects"].append({
                    "id": f"cell-{row}-{column}", "pageIndex": 0, "type": "table_cell",
                    "tableId": "table-1", "rowIndex": row + 13, "columnIndex": column,
                    "rowSpan": 1, "columnSpan": 1,
                    "sourceText": "", "translation": "Итог Ђорђе" if column == 0 else "",
                    "x": 60 + column * 100, "y": 220 + row * 40, "width": 100 if column == 0 else 300, "height": 40,
                    "style": {"fontFamily": "Courier New", "fontSizePx": 14},
                })
        return scene

    def test_empty_cells_widths_and_continuation_rows_survive_both_exports(self):
        payload = MODULE.prepare_export(MODULE.normalize_scene(self.table_scene()))
        table = payload["tables"][0]
        self.assertEqual(len(table["cells"]), 4)
        self.assertEqual(table["rowCount"], 2)
        self.assertEqual(table["sourceRowStart"], 13)
        self.assertEqual(table["columnWidths"], [100, 300])
        with tempfile.TemporaryDirectory() as directory:
            docx = Path(directory) / "table.docx"
            pdf = Path(directory) / "table.pdf"
            MODULE.export_layout(payload, docx)
            MODULE.export_pdf(payload, pdf)
            with ZipFile(docx) as archive:
                root = etree.fromstring(archive.read("word/document.xml"))
                ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                self.assertEqual(len(root.findall(".//w:tr", ns)), 2)
                self.assertEqual([node.get("{" + ns["w"] + "}w") for node in root.findall(".//w:gridCol", ns)], ["1500", "4500"])
            with pymupdf.open(pdf) as doc:
                self.assertEqual(len(doc[0].get_drawings()), 0)  # Unknown borders are not fabricated.
                self.assertIn("Ђорђе", doc[0].get_text())

    def test_cyrillic_embedded_for_every_family_and_style(self):
        for family in ("Arial", "Times New Roman", "Courier New", "Georgia", "Verdana", "Tahoma", "Cambria", "Calibri"):
            for bold, italic in ((False, False), (True, False), (False, True), (True, True)):
                scene = self.scene()
                item = scene["objects"][0]
                item["translation"] = "Перевод Ђорђе"
                item["translationTextStyles"] = []
                item["style"].update(fontFamily=family, fontWeight=700 if bold else 400, fontStyle="italic" if italic else "normal")
                with tempfile.TemporaryDirectory() as directory:
                    pdf = Path(directory) / "font.pdf"
                    MODULE.export_pdf(MODULE.prepare_export(MODULE.normalize_scene(scene)), pdf)
                    with pymupdf.open(pdf) as doc:
                        self.assertIn("Перевод Ђорђе", doc[0].get_text())
                        self.assertFalse(any("ZapfDingbats" in str(font) for font in doc[0].get_fonts()))

    def test_duplicate_and_overlapping_cells_are_rejected(self):
        scene = self.table_scene()
        scene["objects"].append({**scene["objects"][0], "id": "duplicate"})
        with self.assertRaisesRegex(ValueError, "пересекаются"):
            MODULE.normalize_scene(scene)
        scene["objects"].pop()
        scene["objects"][0]["columnSpan"] = 2
        with self.assertRaisesRegex(ValueError, "пересекаются"):
            MODULE.normalize_scene(scene)

    def test_table_growth_paginates_without_changing_scene_or_losing_cells(self):
        scene = self.table_scene()
        scene["pages"] = [{"widthPx": 794, "heightPx": 400}]
        for cell in scene["objects"]:
            cell["translation"] = "Очень длинный текст " * 18 if cell["columnIndex"] == 1 else "Итог"
        original = copy.deepcopy(scene)
        payload = MODULE.prepare_export(MODULE.normalize_scene(scene))
        self.assertEqual(scene, original)
        self.assertGreater(len(payload["pages"]), 1)
        self.assertEqual(sum(len(table["cells"]) for table in payload["tables"]), 4)
        for table in payload["tables"]:
            self.assertEqual(min(cell["rowIndex"] for cell in table["cells"]), 0)
            for cell in table["cells"]:
                self.assertLessEqual(MODULE.measured_height(cell, True), cell["height"] + .01)
                self.assertLessEqual(cell["y"] + cell["height"], 360.01)

    def assert_no_overlaps(self, payload):
        objects = payload['segments'] + [cell for table in payload['tables'] for cell in table['cells']]
        for index, a in enumerate(objects):
            for b in objects[index + 1:]:
                if a['pageIndex'] != b['pageIndex']:
                    continue
                overlap = (min(a['x'] + a['width'], b['x'] + b['width']) > max(a['x'], b['x']) + .01
                           and min(a['y'] + a['height'], b['y'] + b['height']) > max(a['y'], b['y']) + .01)
                self.assertFalse(overlap, f"{a['id']} overlaps {b['id']}")

    def test_pdf_keeps_row_gaps_and_stamp_placed_between_rows(self):
        scene = self.table_scene()
        for cell in scene['objects'][2:]:
            cell['y'] = 340
        stamp = {**self.scene()['objects'][1], 'id': 'stamp-in-gap', 'type': 'seal',
                 'pageIndex': 0, 'x': 160, 'y': 280, 'width': 100, 'height': 40}
        scene['objects'].append(stamp)
        payload = MODULE.prepare_export(MODULE.normalize_scene(scene))
        actual = {item['id']: item for item in payload['segments'] + payload['tables'][0]['cells']}
        for item in scene['objects']:
            for key in ('pageIndex', 'x', 'y', 'width', 'height'):
                self.assertEqual(actual[item['id']][key], item[key], (item['id'], key))
        self.assert_no_overlaps(payload)

    def test_table_pagination_does_not_stack_independent_stamps_on_last_page(self):
        scene = self.table_scene()
        scene['pages'] = [{'widthPx': 794, 'heightPx': 400}]
        for cell in scene['objects']:
            cell['translation'] = 'Очень длинный текст ' * 18 if cell['columnIndex'] else 'Итог'
        for index, y in enumerate((230, 280, 320)):
            scene['objects'].append({**self.scene()['objects'][1], 'id': f'stamp-{index}',
                                     'pageIndex': 0, 'x': 500, 'y': y})
        payload = MODULE.prepare_export(MODULE.normalize_scene(scene))
        self.assertGreater(len(payload['pages']), 1)
        self.assertEqual([(item['pageIndex'], item['y']) for item in payload['segments']],
                         [(0, 230), (0, 280), (0, 320)])
        self.assert_no_overlaps(payload)

    def test_growing_stamp_pushes_only_content_in_its_column(self):
        scene = self.scene()
        first = scene['objects'][0]
        first.update(type='seal', x=60, y=80, width=170, height=17,
                     translation='Печать организации ' * 10, translationTextStyles=[])
        second = scene['objects'][1]
        second.update(pageIndex=0, x=60, y=110, width=170, height=34)
        scene['objects'].append({**second, 'id': 'independent', 'x': 500})
        payload = MODULE.prepare_export(MODULE.normalize_scene(scene))
        by_id = {item['id']: item for item in payload['segments']}
        self.assertGreater(by_id[second['id']]['y'], second['y'])
        self.assertEqual(by_id['independent']['y'], 110)
        self.assert_no_overlaps(payload)

    def test_pdf_preserves_manually_shifted_row_column_positions(self):
        scene = self.table_scene()
        for cell in scene['objects'][2:]:
            cell['x'] += 34
        payload = MODULE.prepare_export(MODULE.normalize_scene(scene))
        actual = {cell['id']: cell for table in payload['tables'] for cell in table['cells']}
        for cell in scene['objects']:
            self.assertEqual(actual[cell['id']]['x'], cell['x'])
            self.assertEqual(actual[cell['id']]['width'], cell['width'])
        self.assert_no_overlaps(payload)

    def test_vertical_merge_moves_as_one_group_and_keeps_following_stamp_after_it(self):
        scene = self.table_scene()
        scene['pages'] = [{'widthPx': 794, 'heightPx': 400}]
        scene['objects'][0].update(rowSpan=2, height=80, translation='Печать ' * 10)
        scene['objects'] = [cell for cell in scene['objects'] if cell['id'] != 'cell-1-0']
        scene['objects'].append({**self.scene()['objects'][1], 'pageIndex': 0, 'x': 60,
                                 'y': 315, 'height': 28})
        payload = MODULE.prepare_export(MODULE.normalize_scene(scene))
        self.assertEqual(sum(len(table['cells']) for table in payload['tables']), 3)
        self.assertEqual(len({cell['pageIndex'] for table in payload['tables'] for cell in table['cells']}), 1)
        self.assert_no_overlaps(payload)


if __name__ == "__main__":
    unittest.main()
