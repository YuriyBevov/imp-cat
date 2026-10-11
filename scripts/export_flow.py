"""Semantic DOCX: normal paragraphs and native tables, with Word pagination.

Workspace fragments sharing an ID are joined by global row address. Source
coordinates are retained in ICAT, not converted to floating Word text boxes.
"""
from __future__ import annotations

import copy
from pathlib import Path
from docx import Document
from docx.oxml.ns import qn
from export_docx import configure_section, create_text_box_paragraph, create_word_table, word_attr


def logical_blocks(payload: dict) -> list[dict]:
    fragments = [dict(item, kind='paragraph') for item in payload['segments']]
    fragments += [dict(item, kind='table') for item in payload.get('tables', [])]
    fragments.sort(key=lambda item: (item['pageIndex'], item['y'], item['x']))
    blocks = []
    occupied_by_id, columns_by_id = {}, {}
    for fragment in fragments:
        if fragment['kind'] == 'paragraph':
            blocks.append(copy.deepcopy(fragment))
            continue
        key = fragment['id']
        if columns_by_id.setdefault(key, fragment['columnCount']) != fragment['columnCount']:
            raise ValueError(f"Таблица {key}: число колонок меняется между страницами.")
        # A paragraph between continuations must stay between them. Word cannot
        # contain an ordinary body paragraph inside a single native table.
        if not blocks or blocks[-1]['kind'] != 'table' or blocks[-1]['id'] != key:
            blocks.append({**copy.deepcopy(fragment), 'cells': [], 'sourceRowStart': 0})
        table = blocks[-1]
        occupied = occupied_by_id.setdefault(key, set())
        for original in fragment['cells']:
            cell = {**copy.deepcopy(original), 'rowIndex': original['rowIndex'] + fragment.get('sourceRowStart', 0)}
            for row in range(cell['rowIndex'], cell['rowIndex'] + cell.get('rowSpan', 1)):
                for col in range(cell['columnIndex'], cell['columnIndex'] + cell.get('columnSpan', 1)):
                    if (row, col) in occupied:
                        raise ValueError(f"Таблица {key}: повторяющиеся адреса ячеек между страницами.")
                    occupied.add((row, col))
            table['cells'].append(cell)
    for table in (item for item in blocks if item['kind'] == 'table'):
        first = min(cell['rowIndex'] for cell in table['cells'])
        for cell in table['cells']:
            cell['rowIndex'] -= first
        table['rowCount'] = max(cell['rowIndex'] + cell.get('rowSpan', 1) for cell in table['cells'])
        table['cells'].sort(key=lambda cell: (cell['rowIndex'], cell['columnIndex']))
        table.pop('rowHeights', None)
        table['flow'] = True
    return blocks


def flow_paragraph(segment: dict):
    node = create_text_box_paragraph(segment)
    spacing = node.find('w:pPr/w:spacing', {'w': qn('w:p')[1:].split('}')[0]})
    # Flexible line height must accommodate tall glyphs and later Word edits.
    word_attr(spacing, 'lineRule', 'auto')
    word_attr(spacing, 'line', round(float(segment.get('lineHeight', 1.2)) * 240))
    word_attr(spacing, 'after', 80)
    return node


def export_flow(payload: dict, output_path: Path) -> None:
    if not payload.get('pages'):
        raise ValueError('Scene has no pages')
    document = Document()
    document.core_properties.title = payload.get('title', 'ICAT')
    configure_section(document.sections[0], payload['pages'][0])
    body = document._element.body
    section = body.sectPr
    available_width = float(payload['pages'][0]['contentBounds']['width'])
    for block in logical_blocks(payload):
        for text in block.get('cells', [block]):
            text['fontSizePx'] = max(text['fontSizePx'], text.get('requestedFontSizePx', text['fontSizePx']))
        if block['kind'] == 'table':
            scale = min(1, available_width / max(1, block['width']))
            block['width'] *= scale
            block['columnWidths'] = [value * scale for value in block['columnWidths']]
            node = create_word_table(block)
            # Let rows grow. Fixed workspace heights are not Word constraints.
            for height in node.iter(qn('w:trHeight')):
                height.getparent().remove(height)
            for spacing in node.iter(qn('w:spacing')):
                word_attr(spacing, 'lineRule', 'auto')
                word_attr(spacing, 'line', 276)
        else:
            node = flow_paragraph(block)
        section.addprevious(node)
    document.save(output_path)
