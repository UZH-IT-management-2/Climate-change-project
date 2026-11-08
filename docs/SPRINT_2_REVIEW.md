# Sprint 2 review — completion and refinement

## Goal

Complete mandatory interactions, scientific comparison mode, station features,
translations, visual refinement, acceptance evidence, and deployment readiness.

## Actual result

- Clipped all raster values to the country polygon and regenerated 390 overlays.
- Completed temperature, precipitation, sunshine, and hot-day selection.
- Implemented the 1961–1990 difference mode with fixed scales and neutral zero.
- Added raster point inspection and 29 NBCN station popups with history sparklines.
- Added manifest-driven play/pause and year preloading.
- Added English, German, French, and Italian JSON locales.
- Added the About, methodology, limitations, attribution, and privacy content.
- Added local Leaflet 1.9.4 files and a static GitHub Pages workflow.
- Added automated data, baseline, asset, locale, privacy, and palette tests.
- Completed local Chrome browser QA for the primary demonstration path and a
  Safari rendering/control smoke test.

## Browser demonstration evidence

The local Chrome check verified:

- initial map and official 1961 temperature overlay;
- boundary transparency outside Switzerland;
- difference-mode scale and text;
- hot-day station rendering;
- language switching to German without resetting the map;
- About navigation;
- playback advancing from 1961 and pausing at 1972.
- Safari map rendering, difference mode, playback advance, and pause.

## Outstanding limitations

- Public GitHub Pages deployment remains pending until the workflow runs.
- Firefox and Edge are not claimed as tested.
- Monthly and snow views remain optional future backlog items.
- Client review/sign-off remains pending.

