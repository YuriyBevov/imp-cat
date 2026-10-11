import sys
import unittest
import tempfile
from pathlib import Path
from zipfile import ZipFile
from lxml import etree
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from export_flow import export_flow, logical_blocks
from export_studio import normalize_scene


class FlowExportTests(unittest.TestCase):
    def payload(self):
        style = dict(fontFamily='Arial', fontSizePx=14, lineHeight=1.2)
        pages = [dict(widthPx=794, heightPx=1123) for _ in range(2)]
        objects = [dict(id='text', type='text', pageIndex=0, x=40, y=40, width=600, height=34,
                        sourceText='A paragraph\nwith two lines', style=style)]
        for row in range(4):
            for col in range(2):
                objects.append(dict(id=f'cell-{row}-{col}', type='table_cell', tableId='one',
                    pageIndex=row // 2, rowIndex=row, columnIndex=col, rowSpan=1, columnSpan=1,
                    x=40 + col * 200, y=100 + row % 2 * 34, width=200, height=34,
                    sourceText=f'{row}:{col}' if col else '', style=style))
        return normalize_scene(dict(pages=pages, objects=objects))

    def test_one_native_table_across_pages_and_normal_paragraphs(self):
        payload = self.payload()
        blocks = logical_blocks(payload)
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[1]['rowCount'], 4)
        self.assertEqual(len(blocks[1]['cells']), 8)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.docx'
            export_flow(payload, path)
            with ZipFile(path) as archive:
                root = etree.fromstring(archive.read('word/document.xml'))
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            self.assertEqual(len(root.xpath('//w:body/w:tbl', namespaces=ns)), 1)
            self.assertEqual(len(root.xpath('//w:tbl/w:tr', namespaces=ns)), 4)
            self.assertEqual(len(root.xpath('//w:tc', namespaces=ns)), 8)
            self.assertEqual(root.xpath('count(//w:txbxContent)', namespaces=ns), 0)
            self.assertEqual(root.xpath('count(//w:trHeight)', namespaces=ns), 0)
            self.assertIn('A paragraph', root.xpath('//w:body/w:p//w:t/text()', namespaces=ns))

    def test_intervening_text_stays_before_the_next_table_part(self):
        payload = self.payload()
        payload['segments'].append(dict(payload['segments'][0], id='between', text='Page subtotal', y=200))
        blocks = logical_blocks(payload)
        self.assertEqual([block['kind'] for block in blocks], ['paragraph', 'table', 'paragraph', 'table'])
        self.assertEqual(blocks[2]['text'], 'Page subtotal')
        self.assertEqual([block['rowCount'] for block in blocks if block['kind'] == 'table'], [2, 2])

    def test_duplicate_addresses_across_pages_are_rejected(self):
        payload = self.payload()
        payload['tables'][1]['sourceRowStart'] = 0
        with self.assertRaisesRegex(ValueError, 'повторяющиеся адреса'):
            logical_blocks(payload)

    def test_merged_cell_survives_export(self):
        payload = self.payload()
        table = payload['tables'][0]
        table['cells'] = [cell for cell in table['cells'] if not (cell['rowIndex'] == 0 and cell['columnIndex'] == 1)]
        table['cells'][0]['columnSpan'] = 2
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'merged.docx'
            export_flow(payload, path)
            with ZipFile(path) as archive:
                xml = archive.read('word/document.xml').decode()
            self.assertIn('w:gridSpan w:val="2"', xml)

class BorderExportTests(unittest.TestCase):
    def test_only_source_borders_are_printed(self):
        from export_docx import create_word_table
        table = FlowExportTests().payload()['tables'][0]
        table['cells'][0]['borders'] = {'top': True, 'left': False, 'right': None, 'bottom': False}
        root = create_word_table(table)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        self.assertEqual(root.xpath('count(w:tblPr/w:tblBorders/*[@w:val="single"])', namespaces=ns), 0)
        self.assertEqual(root.xpath('count(.//w:tcBorders/*[@w:val="single"])', namespaces=ns), 1)
        self.assertEqual(root.xpath('local-name(.//w:tcBorders/*[@w:val="single"])', namespaces=ns), 'top')

class TableHeaderTests(unittest.TestCase):
    def test_only_explicit_leading_headers_repeat_in_word(self):
        from export_docx import create_word_table
        payload = FlowExportTests().payload()
        table = logical_blocks(payload)[1]
        for cell in table['cells']:
            cell['isTableHeader'] = cell['rowIndex'] in (0, 3)
        root = create_word_table(table)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        self.assertEqual(root.xpath('count(w:tr/w:trPr/w:tblHeader)', namespaces=ns), 1)
        self.assertEqual(root.xpath('count(w:tr[1]/w:trPr/w:tblHeader)', namespaces=ns), 1)

if __name__ == '__main__':
    unittest.main()
