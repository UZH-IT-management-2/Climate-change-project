# Swiss Historical Climate Explorer

Swiss Shift is a desktop-first, static web application for exploring how the
Swiss climate changed from 1961 through 2025. It combines official MeteoSwiss
annual grids with homogenized NBCN station observations, a Leaflet map, a
historical timeline, a 1961–1990 comparison mode, and English, German, French,
and Italian interfaces.

The repository includes the processed web assets required to run the explorer.
No backend, API key, build step, or synthetic climate data is required.

## Current scope

- Annual mean temperature (`TabsY`), precipitation (`RhiresY`), and
  reconstructed relative sunshine (`SrelrecY1961`) grids for 1961–2025.
- Official NBCN annual hot-day counts (`ths30xy0`) for 29 stations.
- Absolute values and arithmetic differences from the actual 1961–1990 mean.
- Fixed scientific color scales, transparent boundary-clipped overlays, raster
  point inspection, station popups, and station history sparklines.
- One-time approximate IP geolocation with a safe national-view fallback.
- A static About page, four locales, automated checks, documentation, and a
  GitHub Pages deployment workflow.

Snow and monthly views are not included; see [Known limitations](#known-limitations).

## Quick start

The committed application can be served without installing dependencies:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. Opening `index.html` directly from the filesystem
will not work because browsers restrict JSON module requests from `file://` URLs.

For full development and data regeneration:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm test
npm run serve
```

The project uses Node's built-in test runner; `npm install` is not required.

## Architecture

```text
index.html / about.html
├── assets/css/app.css            visual system and responsive layout
├── assets/js/app.js              map, timeline, layers, stations, geolocation
├── assets/js/i18n.js             locale loader and DOM translation
├── vendor/leaflet/               pinned Leaflet 1.9.4 runtime
├── locales/{en,de,fr,it}.json    interface translations
├── config/config.json            map, data, scale, and service configuration
└── data/
    ├── manifest.json             available years and generated asset paths
    ├── overlays/                 390 transparent PNG map layers
    ├── samples/                  authentic compact raster lookup grids
    ├── stations/hot-days.json    official station histories and baselines
    └── switzerland.geojson       simplified country boundary

scripts/process_data.py
└── STAC discovery → download → NetCDF read → reprojection → boundary mask
    → baseline calculation → PNG/JSON export
```

The web application is buildless and framework-free. All paths are relative so
the site works under a GitHub Pages project subpath.

## Data sources and processing

The pipeline queries the official FSDI STAC collections:

- `ch.meteoschweiz.ogd-surface-derived-grid`
- `ch.meteoschweiz.ogd-nbcn`

For each annual grid, the processor:

1. discovers available assets rather than hardcoding a year range;
2. downloads the official NetCDF file to an ignored cache;
3. reads the scientific values and missing-data mask;
4. interprets Swiss LV95 as EPSG:2056 where applicable;
5. reprojects to WGS84 for Leaflet;
6. clips cells to the Switzerland boundary;
7. calculates each cell's 1961–1990 arithmetic mean;
8. exports fixed-scale absolute and anomaly PNGs and a sampled lookup grid.

For hot days, the processor reads the official NBCN yearly CSV parameter
`ths30xy0`. It does not invent values or infer counts from map colors.

Attribution required in redistributed data: **Source: MeteoSwiss**.

More detail is in [DATA_INVESTIGATION.md](docs/DATA_INVESTIGATION.md).

## Regenerating and refreshing data

Run:

```bash
.venv/bin/python scripts/process_data.py
```

The script discovers the newest annual assets. The published end year is the
latest complete year shared by all required gridded variables, so a partial
current year cannot silently enter the timeline. Source files are cached during
the run and removed after a successful build. Add `--keep-raw` to retain the
ignored cache, or `--offline` to require cached inputs.

Optional range flags are available for pipeline diagnostics:

```bash
.venv/bin/python scripts/process_data.py --start-year 1961 --end-year 2025
```

Do not set the start year after 1961: the application requires the complete
1961–1990 baseline.

## Testing

```bash
npm test
npm run check
```

The tests verify:

- all four variables expose the continuous 1961–2025 record;
- all 390 raster assets exist and are valid 640 × 300 PNGs;
- published sample baselines match the 30 source years within rounding tolerance;
- station baselines and anomalies are mathematically correct;
- all locales have the same key set;
- no framework, analytics, cookie, or persistent-storage code is present;
- anomaly zero maps to the neutral palette color and no-data stays transparent.

Manual browser evidence and untested areas are recorded in
[ACCEPTANCE_REPORT.md](docs/ACCEPTANCE_REPORT.md).

## GitHub Pages deployment

The workflow at `.github/workflows/pages.yml` tests and deploys the repository
root when `main` is pushed. In the GitHub repository settings, set **Pages →
Build and deployment → Source** to **GitHub Actions** if it is not already set.

The expected project URL is:

`https://uzh-it-management-2.github.io/Climate-change-project/`

Do not call a deployment complete until the workflow succeeds and the public
URL has been opened and checked.

## Configuration

Changeable values live in [config/config.json](config/config.json): baseline,
map bounds, OpenStreetMap tile endpoint, geolocation endpoint, playback speed,
data paths, product metadata, domains, and palettes. Timeline years come from
the generated data manifest, never from frontend constants.

## Privacy

There are no analytics, ads, cookies, accounts, or personal-data databases. The
browser makes one best-effort request to `ipwho.is` to estimate whether the
visitor is in Switzerland; the response is not persisted. It also contacts the
OpenStreetMap tile service to render the base map. Blocking either service does
not prevent the climate data and controls from loading.

## Known limitations

- Sunshine uses MeteoSwiss's `SrelrecY1961` reconstructed annual series because
  the operational `SrelY` archive begins in 1971 and cannot provide the full
  mandatory baseline.
- Raster inspection is sampled from the authentic reprojected grid and rounded;
  it is not a fabricated reverse lookup from image color.
- Snow was not added because no suitable, harmonized annual historical series
  was established for the full period without expanding into large daily data.
- Monthly views are not implemented. The optional station time-series feature is
  implemented as a compact sparkline.
- Local browser QA was completed in current Chrome and Safari. Firefox and Edge
  were not available in the controlled QA path and are not claimed as passed.
- The Requirements PDF referenced by the implementation brief was not supplied
  in the repository or attachments. The pasted master specification was used.

## Project records

- [Requirements traceability](docs/REQUIREMENTS_TRACEABILITY.md)
- [Acceptance report](docs/ACCEPTANCE_REPORT.md)
- [Product backlog](docs/BACKLOG.md)
- [Sprint 1 review](docs/SPRINT_1_REVIEW.md)
- [Sprint 2 review](docs/SPRINT_2_REVIEW.md)
- [Decisions and issue log](docs/DECISIONS_AND_ISSUES.md)
- [Handover note](docs/HANDOVER.md)
- [Five-minute demo guide](docs/DEMO_GUIDE.md)
- [Technical presentation summary](docs/TECHNICAL_SUMMARY.md)
- [AI usage disclosure](docs/AI_USAGE.md)

## License

Application code is MIT licensed. MeteoSwiss data, OpenStreetMap tiles,
geoBoundaries data, and Leaflet retain their respective terms and attributions.
