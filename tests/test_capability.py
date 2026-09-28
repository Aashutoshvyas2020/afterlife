import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "person1/build/dna-feature-map/service.py"
spec = importlib.util.spec_from_file_location("capability_service", SERVICE)
service = importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)
sample = json.loads((SERVICE.parent / "verification/input_alpha.json").read_text())


class InputValidation(unittest.TestCase):
    def test_known_good(self):
        service.validate(sample)

    def test_invalid_coordinates(self):
        for start, end in [(-1, 20), (10, 9), (0, 999999), (True, 10)]:
            with self.subTest(start=start, end=end):
                value = copy.deepcopy(sample)
                value["features"][0].update(start=start, end=end)
                with self.assertRaises(ValueError):
                    service.validate(value)

    def test_resource_limits_and_sequence(self):
        for key, value in [("sequence", "X"), ("sequence", "A" * 20001), ("figure_width", 1000), ("figure_width", float("nan")), ("features", [{}] * 101), ("name", "")]:
            with self.subTest(key=key):
                with self.assertRaises(ValueError):
                    service.validate({**sample, key: value})

    def test_unknown_color(self):
        value = copy.deepcopy(sample)
        value["features"][0]["color"] = "not a color"
        with self.assertRaises(ValueError):
            service.validate(value)
