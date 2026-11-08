# Technical summary for presentation slides

## Outcome

Static, multilingual Swiss historical climate explorer covering 1961–2025 with
authentic MeteoSwiss data, fixed scientific scales, and no runtime backend.

## Architecture

- **Offline supplier pipeline:** Python, Xarray, Rasterio, NumPy, Pillow.
- **Source:** official FSDI STAC / MeteoSwiss NetCDF and NBCN CSV.
- **Coordinate handling:** EPSG:2056 → EPSG:4326, Swiss boundary mask.
- **Delivery:** HTML5, modern CSS, vanilla ES modules, Leaflet 1.9.4.
- **Hosting:** static GitHub Pages workflow.

## Key supplier decisions

- Use consolidated annual archive files, never the incomplete current year.
- Use official reconstructed sunshine to preserve the full 1961–1990 baseline.
- Use published NBCN annual hot-day counts instead of inconsistent re-aggregation.
- Commit compact processed assets, not large raw datasets.

## Main challenge and mitigation

The official grids contain valid cells outside Switzerland. Browser QA revealed
the rectangular footprint. The pipeline was corrected to mask reprojected data
with a real Swiss polygon; all 390 overlays were regenerated and tested.

## Quality evidence

- 65 continuous years for every indicator.
- 390 raster images verified for dimensions and non-empty content.
- Cell and station baselines tested against source years.
- Four locale key sets verified.
- Chrome primary journey and Safari smoke path verified manually.

## Remaining risks

Public Pages verification, remaining desktop browsers, and client sign-off are
pending. Optional snow and monthly features remain outside the completed core.

