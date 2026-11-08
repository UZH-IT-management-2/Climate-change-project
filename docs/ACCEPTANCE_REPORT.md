# Acceptance report

Generated from actual automated and manual checks on 8 November 2026.

## Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Static application | PASS | Local HTTP 200 for HTML, manifest, and PNG; no backend |
| Authentic data | PASS | Official MeteoSwiss STAC/NBCN URLs in pipeline and outputs |
| Mapping | PASS | Chrome map pan/zoom, clipped overlays, station markers |
| Timeline and playback | PASS | Manifest-driven 1961–2025; Chrome play/pause |
| Baseline math | PASS | Node and Python tests |
| Languages | PASS | Four equal locale sets; German live-switch QA |
| Privacy | PASS | No analytics/cookies/storage; disclosures present |
| Public deployment | NOT TESTED | Workflow prepared; public run pending push/action |
| Cross-browser | PARTIAL | Chrome and Safari passed; Firefox/Edge not claimed |
| Client acceptance | NOT TESTED | No client review or sign-off supplied |

## Detailed criteria

### Mapping

- PASS — Switzerland outline and OSM base display.
- PASS — Zoom and pan controls operate.
- PASS — LV95 grids align after EPSG:2056 reprojection.
- PASS — Rasters are transparent outside the Swiss boundary.
- PASS — Switching among temperature, precipitation, sunshine, and hot days updates the visualization.
- PASS — Missing values become transparent pixels or null lookup values.

### Timeline

- PASS — Earliest year 1961 and latest complete year 2025.
- PASS — Slider selects all 65 available years.
- PASS — Play advanced observed years in Chrome; pause stopped at 1972.
- PASS — Final-year logic stops playback.
- PASS — Domains and palettes remain fixed between years.

### Baseline

- PASS — Every raster baseline uses 30 years, 1961–1990 inclusive.
- PASS — Station baseline and anomaly tests pass for all 29 stations.
- PASS — Zero anomaly maps to the exact neutral center color.
- PASS — Precipitation remains mm; sunshine differences are percentage points.

### Stations and accuracy samples

- PASS — Station coordinates come from NBCN STAC point geometry.
- PASS — Hot-day values come directly from annual `ths30xy0`.
- PASS — Zürich/Fluntern official counts: 1961 = 2, 2003 = 27, 2025 = 14.
- PASS — Lugano official counts: 1961 = 0, 2003 = 47, 2025 = 31.
- PASS — Säntis mountain counts: 1961 = 0, 2003 = 0, 2025 = 0.
- PASS — Baselines: Zürich/Fluntern 2.6, Lugano 2.2, Säntis 0.0 days.

Source URLs and machine-readable values are in `docs/data_validation.json`.

### Geolocation

- PASS — A Swiss IP response produced a regional map view in Chrome.
- PASS — One fetch only, no browser GPS call, no IP persistence.
- PASS (code path) — Timeout, network failure, failed response, and non-CH result leave the national view intact.

### Languages

- PASS — English, German, French, and Italian JSON files load.
- PASS — Automated locale keys match exactly.
- PASS — German switch changed controls, legend, timeline, and map labels without rebuilding the map.

### Browser results

| Browser | Result | Notes |
| --- | --- | --- |
| Chrome | PASS | Full primary flow and visual QA on local server |
| Safari | PASS | Rendering, clipped raster, difference mode, play and pause smoke test |
| Firefox | NOT TESTED | Browser unavailable in the controlled QA path |
| Edge | NOT TESTED | Browser unavailable in the controlled QA path |

### Commands executed

```text
npm test       → 6 Node tests passed; 2 Python tests passed
npm run check  → 4 variables validated through 2025
curl -I local  → HTML, manifest, and overlay returned HTTP 200
```

