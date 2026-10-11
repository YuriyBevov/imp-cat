"""Fit a PDF copy without repacking the user's positioned scene."""
from __future__ import annotations

import copy


def overlaps_x(a, b):
    return min(a['x'] + a['width'], b['x'] + b['width']) > max(a['x'], b['x']) + .01


def table_units(table, measure):
    """Keep vertically merged rows indivisible and preserve existing row gaps."""
    cells = table['cells']
    rows = sorted({row for cell in cells for row in range(cell['rowIndex'], cell['rowIndex'] + cell['rowSpan'])})
    groups = []
    for row in rows:
        if groups and row < groups[-1][1]:
            continue
        end = row + 1
        while True:
            expanded = max([end] + [cell['rowIndex'] + cell['rowSpan'] for cell in cells if row <= cell['rowIndex'] < end])
            if expanded == end:
                break
            end = expanded
        groups.append((row, end))
    for start, end in groups:
        group = [cell for cell in cells if start <= cell['rowIndex'] < end]
        top = min(cell['y'] for cell in group)
        bottom = max(cell['y'] + cell['height'] for cell in group)
        growth = {row: 0.0 for row in range(start, end)}
        # A spanning cell may use growth already contributed by shorter cells.
        for cell in sorted(group, key=lambda item: item['rowSpan']):
            first, last = cell['rowIndex'], cell['rowIndex'] + cell['rowSpan']
            missing = measure(cell, True) - cell['height'] - sum(growth[row] for row in range(first, last))
            if missing > .01:
                growth[last - 1] += missing
        fitted = []
        for cell in group:
            first, last = cell['rowIndex'], cell['rowIndex'] + cell['rowSpan']
            fitted.append({**cell,
                'y': cell['y'] - top + sum(growth[row] for row in range(start, first)),
                'height': cell['height'] + sum(growth[row] for row in range(first, last))})
        left = min(cell['x'] for cell in group)
        right = max(cell['x'] + cell['width'] for cell in group)
        yield {'x': left, 'y': top, 'width': right - left, 'originalHeight': bottom - top,
               'height': bottom - top + sum(growth.values()), 'table': table,
               'start': start, 'end': end, 'cells': fitted}


def prepare_pdf_layout(payload, measure):
    payload = copy.deepcopy(payload)
    pages, segments, tables = [], [], []
    for source in payload['pages']:
        area = source['contentBounds']
        bottom = min(source['heightPx'], area['y'] + area['height'])
        source_pages = []

        def ensure_page(index):
            while len(source_pages) <= index:
                page = {**copy.deepcopy(source), 'index': len(pages)}
                source_pages.append(page)
                pages.append(page)
            return source_pages[index]['index']

        ensure_page(0)
        units = []
        for table in payload['tables']:
            if table['pageIndex'] == source['index']:
                units.extend(table_units(table, measure))
        for segment in payload['segments']:
            if segment['pageIndex'] == source['index']:
                units.append({**{key: segment[key] for key in ('x', 'y', 'width')},
                              'originalHeight': segment['height'],
                              'height': max(segment['height'], measure(segment)), 'segment': segment})
        placed = []
        fragments = {}
        for unit in sorted(units, key=lambda item: (item['y'], item['x'])):
            height = unit['height']
            if height > bottom - area['y'] + .1:
                raise ValueError('Строка таблицы или сегмент выше страницы. Уменьшите шрифт или разделите содержимое.')
            target_page, target_y = 0, max(area['y'], unit['y'])
            for previous in placed:
                if not overlaps_x(unit, previous):
                    continue
                # Follow content that was above this block in the original scene.
                # A table on the left must never carry a stamp on the right away.
                original_end = previous['y'] + previous['originalHeight']
                if original_end <= unit['y'] + .01:
                    gap = max(0, unit['y'] - original_end)
                    after = previous['targetY'] + previous['height'] + gap
                    if previous['targetPage'] > target_page:
                        target_page, target_y = previous['targetPage'], after
                    elif previous['targetPage'] == target_page:
                        target_y = max(target_y, after)
            while True:
                if target_y + height > bottom + .1:
                    target_page += 1
                    target_y = area['y']
                collisions = [previous for previous in placed
                              if previous['targetPage'] == target_page and overlaps_x(unit, previous)
                              and target_y < previous['targetY'] + previous['height'] - .01
                              and target_y + height > previous['targetY'] + .01]
                if not collisions:
                    break
                target_y = max(previous['targetY'] + previous['height'] for previous in collisions)
            page_index = ensure_page(target_page)
            placed.append({**unit, 'targetPage': target_page, 'targetY': target_y})
            if 'segment' in unit:
                segments.append({**unit['segment'], 'pageIndex': page_index, 'y': target_y, 'height': height})
                continue
            table = unit['table']
            key = (id(table), page_index)
            if key not in fragments:
                fragments[key] = {**table, 'pageIndex': page_index, 'cells': [], '_firstRow': unit['start']}
                tables.append(fragments[key])
            fragment = fragments[key]
            fragment['_firstRow'] = min(fragment['_firstRow'], unit['start'])
            fragment['cells'].extend({**cell, 'pageIndex': page_index, 'y': target_y + cell['y']} for cell in unit['cells'])
        for fragment in fragments.values():
            first = fragment.pop('_firstRow')
            fragment['sourceRowStart'] += first
            for cell in fragment['cells']:
                cell['rowIndex'] -= first
            fragment['rowCount'] = max(cell['rowIndex'] + cell['rowSpan'] for cell in fragment['cells'])
            fragment['y'] = min(cell['y'] for cell in fragment['cells'])
            fragment['height'] = max(cell['y'] + cell['height'] for cell in fragment['cells']) - fragment['y']
            fragment['cells'].sort(key=lambda item: (item['rowIndex'], item['columnIndex']))
    payload.update(pages=pages, segments=segments, tables=tables)
    return payload
