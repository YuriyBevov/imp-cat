import sys
import unittest
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from table_border_evidence import edge_evidence

class BorderEvidenceTests(unittest.TestCase):
    def test_visible_vertical_edges_without_inventing_horizontal_rules(self):
        image = Image.new('L', (1000, 1000), 255)
        draw = ImageDraw.Draw(image)
        draw.line((100, 100, 100, 400), fill=0, width=2)
        draw.line((500, 100, 500, 400), fill=0, width=2)
        result = edge_evidence(image, dict(x=.1, y=.1, width=.4, height=.3))
        self.assertEqual(result, dict(top=False, bottom=False, left=True, right=True))

    def test_short_edges_and_partial_lines_are_uncertain(self):
        image = Image.new('L', (1000, 1000), 255)
        ImageDraw.Draw(image).line((100, 100, 300, 100), fill=0, width=1)
        self.assertIsNone(edge_evidence(image, dict(x=.1, y=.1, width=.4, height=.01))['top'])
        self.assertIsNone(edge_evidence(image, dict(x=.1, y=.1, width=.4, height=.01))['left'])
