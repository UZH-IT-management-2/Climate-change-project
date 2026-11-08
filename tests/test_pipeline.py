import unittest

import numpy as np

from scripts.process_data import GridAsset, discover_grid_assets, palette_rgba


class PipelineTests(unittest.TestCase):
    def test_discovers_and_orders_matching_annual_assets(self):
        archive = {
            "assets": {
                "prefix.tabsy_ch01r.swiss.lv95_19620101000000_19620101000000.nc": {"href": "1962"},
                "prefix.other.swiss.lv95_19610101000000_19610101000000.nc": {"href": "ignored"},
                "prefix.tabsy_ch01r.swiss.lv95_19610101000000_19610101000000.nc": {"href": "1961"},
            }
        }
        self.assertEqual(
            discover_grid_assets(archive, "tabsy_ch01r", 1961, 1962),
            [
                GridAsset(1961, "prefix.tabsy_ch01r.swiss.lv95_19610101000000_19610101000000.nc", "1961"),
                GridAsset(1962, "prefix.tabsy_ch01r.swiss.lv95_19620101000000_19620101000000.nc", "1962"),
            ],
        )

    def test_diverging_palette_has_neutral_center_and_transparent_no_data(self):
        values = np.array([[-4.0, 0.0, 4.0, np.nan]], dtype=np.float32)
        palette = ["#2166ac", "#67a9cf", "#f7f7f7", "#ef8a62", "#b2182b"]
        rgba = palette_rgba(values, [-4, 4], palette)
        self.assertEqual(tuple(rgba[0, 1, :3]), (247, 247, 247))
        self.assertEqual(rgba[0, 1, 3], 218)
        self.assertEqual(rgba[0, 3, 3], 0)


if __name__ == "__main__":
    unittest.main()

