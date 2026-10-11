"""Read local page images for conservative straight-line border evidence.

Uses source coordinates only. No OCR, network calls, or changes to saved scenes.
Uncertain edges remain null; the visual model can supply explicit border data.
"""
import json
import sys
from pathlib import Path
from PIL import Image

SIDES = ('top', 'right', 'bottom', 'left')


def edge_evidence(image, region):
    width, height = image.size
    x0, y0 = round(region['x'] * width), round(region['y'] * height)
    x1, y1 = round((region['x'] + region['width']) * width), round((region['y'] + region['height']) * height)
    radius = max(2, round(min(width, height) * .003))
    result = {}
    for side in SIDES:
        horizontal = side in ('top', 'bottom')
        coordinate = {'top': y0, 'bottom': y1, 'left': x0, 'right': x1}[side]
        start, end = (x0, x1) if horizontal else (y0, y1)
        extent, cross_extent = (width, height) if horizontal else (height, width)
        start, end = max(0, start + 2), min(extent, end - 2)
        if end - start < 20:
            result[side] = None
            continue
        coverage = []
        for position in range(max(0, coordinate - radius), min(cross_extent, coordinate + radius + 1)):
            rectangle = (start, position, end, position + 1) if horizontal else (position, start, position + 1, end)
            histogram = image.crop(rectangle).histogram()
            coverage.append(histogram[0] / (end - start))
        score = max(coverage, default=0)
        result[side] = True if score >= .8 else False if score < .12 else None
    return result


def inspect_scene(scene, directory):
    output = {}
    pages = {page['index']: page for page in scene['pages']}
    for page_index in sorted({item['pageIndex'] for item in scene['objects'] if item.get('type') == 'table_cell'}):
        page = pages[page_index]
        source_index = page.get('sourcePageIndex', page_index)
        if source_index is None:
            continue
        filename = Path(directory) / f'page-{source_index + 1:03d}.png'
        with Image.open(filename) as source:
            image = source.convert('L').point(lambda pixel: 0 if pixel < 180 else 255)
        for cell in scene['objects']:
            regions = cell.get('sourceRegions') or []
            if cell.get('type') != 'table_cell' or cell['pageIndex'] != page_index or len(regions) != 1:
                continue
            output[cell['id']] = edge_evidence(image, regions[0])
    return output


if __name__ == '__main__':
    scene = json.loads(Path(sys.argv[1]).read_text())
    print(json.dumps(inspect_scene(scene, sys.argv[2])))
