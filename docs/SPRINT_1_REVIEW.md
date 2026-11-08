# Sprint 1 review — functional foundation

## Goal

Prove a real end-to-end vertical slice: official data discovery, reproducible
processing, an aligned Swiss map, a historical year control, and a working
temperature overlay.

## Actual result

- Inspected the initially empty repository and embedded multi-screen Figma preview.
- Recorded that the referenced Requirements PDF was not supplied.
- Verified the official MeteoSwiss STAC grid and NBCN collections.
- Confirmed annual `TabsY`, `RhiresY`, and reconstructed sunshine coverage.
- Implemented the offline Python processor and generated the complete annual assets.
- Calculated the 1961–1990 cell baselines from actual observations.
- Built the initial Leaflet map, variable selector, timeline, and overlays.
- Added the first automated integrity checks.

## Demonstrable increment

The local site loaded the temperature map, changed years, and displayed
authentic MeteoSwiss data from a static server. The processor could regenerate
the assets without editing source code for a new complete year.

## Issues and decisions

- The operational sunshine product begins in 1971. `SrelrecY1961` was selected
  to preserve the complete mandatory baseline without a third-party fallback.
- The first browser render showed that valid gridded data continued outside the
  Swiss border. This issue was carried into Sprint 2 and fixed by geographic masking.
- Figma native app control was not approved; the `.fig` embedded preview was used.

## Review state

Client feedback and acceptance were not available between autonomous sprints.
They remain pending; no feedback or approval has been invented.

## Recommended Sprint 2 priorities

1. Correct the national boundary mask.
2. Complete precipitation, sunshine, and hot-day station interactions.
3. Add anomaly mode, translations, About/privacy, tests, and deployment.

