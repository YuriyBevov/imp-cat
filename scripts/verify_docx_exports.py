"""Export private replay scenes and audit native Word text/table completeness.

Usage: .venv/bin/python scripts/verify_docx_exports.py REPLAY_OUTPUT_DIR
Does not open or modify the application's document storage.
"""
import json
import sys
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
from lxml import etree
from export_studio import normalize_scene
from export_flow import export_flow, logical_blocks

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}


def text_key(value):
    return ''.join(str(value).split())


def verify(directory):
    report = []
    for source in sorted(directory.glob('*.scene.json')):
        payload = normalize_scene(json.loads(source.read_text()))
        output = source.with_name(source.name.replace('.scene.json', '.docx'))
        export_flow(payload, output)
        with ZipFile(output) as archive:
            root = etree.fromstring(archive.read('word/document.xml'))
        expected = Counter(text_key(item['text']) for item in payload['segments'])
        for table in payload['tables']:
            expected.update(text_key(cell['text']) for cell in table['cells'])
        actual = Counter(text_key(''.join(p.xpath('.//w:t/text()', namespaces=NS)))
                         for p in root.xpath('//w:body//w:p', namespaces=NS))
        expected.pop('', None)
        actual.pop('', None)
        assert actual == expected, f'{source.name}: missing or duplicated text blocks'
        table_count = len(root.xpath('//w:body/w:tbl', namespaces=NS))
        assert table_count == sum(block['kind'] == 'table' for block in logical_blocks(payload)), f'{source.name}: fragmented tables'
        assert not root.xpath('//w:txbxContent|//w:trHeight', namespaces=NS), f'{source.name}: fixed layout in flow export'
        result = dict(scene=source.name, status='passed', textBlocks=sum(expected.values()), nativeTables=table_count)
        report.append(result)
        print(json.dumps(result))
    if not report:
        raise ValueError('No replay scenes found')
    (directory / 'docx-report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    verify(Path(sys.argv[1] if len(sys.argv) > 1 else '.build/real-document-verification'))
