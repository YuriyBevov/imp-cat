import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from privacy_core import Detector, Registry
from privacy_service import digest, known_replace, sanitize, text_records


class PrivacyServiceTests(unittest.TestCase):
    def detector(self, *args, **kwargs):
        return Detector(*args, **kwargs, nlp=lambda text: SimpleNamespace(ents=[]))

    def test_text_review_is_bound_to_field_and_object_not_only_words(self):
        context = {'scene': {'objects': [{'id': 'one', 'sourceText': 'Public phrase'}]}}
        state = {'namespace': '1234ABCD', 'entries': {}, 'language': 'en',
                 'safeHashes': [digest(p + '\0' + t) for p, t in text_records(context)]}
        with tempfile.TemporaryDirectory() as root, patch('privacy_service.load_state', return_value=({}, state)), \
             patch('privacy_service.write_vault'), patch('privacy_service.Detector', side_effect=self.detector):
            self.assertFalse(sanitize(Path(root), b'', context)['needsReview'])
            changed = {'scene': {'objects': [{'id': 'two', 'sourceText': 'Public phrase'}]}}
            self.assertTrue(sanitize(Path(root), b'', changed)['needsReview'])
            self.assertTrue(sanitize(Path(root), b'', {'body': {'instruction': 'Public phrase'}})['needsReview'])

    def test_known_values_replaced_even_when_repeated_without_corrupting_tokens(self):
        registry = Registry('1234ABCD')
        token = registry.register('Alice Example', 'PERSON')
        self.assertEqual(known_replace(f'Alice Example; alice example; {token}', registry), f'{token}; {token}; {token}')
        registry.entries[token]['replacement'] = 'Approved spelling'
        self.assertEqual(registry.restore(token), 'Approved spelling')

    def test_explicit_known_mask_wins_public_allowlist(self):
        findings = self.detector('en', ['alice@example.test'], allow_values=['alice@example.test']).find('alice@example.test')
        self.assertTrue(findings)
        self.assertEqual(self.detector('en', allow_values=['alice@example.test']).find('alice@example.test'), [])


if __name__ == '__main__':
    unittest.main()
