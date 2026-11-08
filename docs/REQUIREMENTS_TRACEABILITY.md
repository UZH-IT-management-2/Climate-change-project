# Requirements traceability

Statuses describe the repository at delivery time.

| ID | Requirement | Implementation | Verification | Status |
| --- | --- | --- | --- | --- |
| F1 | Interactive map | Leaflet map, OSM base, pan/zoom, four layers | Chrome browser QA | PASS |
| F2 | Approximate IP positioning | One timed ipwho.is request, CH zoom, fallback bounds | Successful Swiss regional view; fallback code review | PASS |
| F3 | Historical timeline | Years loaded from each manifest entry | Automated 65-year continuity test | PASS |
| F4 | Play/pause | Sequential timer waits for render; stop at last year | Chrome advanced and paused; no overlapping timer | PASS |
| F5 | Variable sidebar | Figma-derived left rail, legend, units, source | Visual browser QA | PASS |
| F6 | Absolute/anomaly | Cell/station 1961–1990 baselines | Automated baseline/anomaly tests | PASS |
| F7 | Hot-day stations | 29 NBCN station markers from `ths30xy0` | Station baseline test and Chrome QA | PASS |
| F8 | Point inspection | Authentic sampled raster lookup and station popup | Source inspection; interactive station QA | PASS |
| F9 | EN/DE/FR/IT | Separate JSON files, browser detection, live switch | Locale parity test; German browser QA | PASS |
| F10 | Extra variables | Four mandatory variables supplied | Manifest test | PASS |
| F11 | Monthly view | Not implemented; lower priority | Repository inspection | NOT APPLICABLE / OPTIONAL |
| F12 | Station time series | Popup sparkline | Chrome station mode QA | PASS |
| DATA-1 | MeteoSwiss primary source | Official STAC and NBCN collections only | Manifest and generated source URLs | PASS |
| DATA-2 | 1961–latest complete | Continuous 1961–2025 record | Automated test | PASS |
| DATA-3 | Correct CRS | LV95 EPSG:2056 to WGS84 reprojection | Pipeline unit/source review and map alignment | PASS |
| DATA-4 | Country clipping | Rasterio geometry mask | Browser boundary check | PASS |
| DATA-5 | Missing data | NaN to transparent/null | Python alpha test | PASS |
| PRIV-1 | No analytics/cookies/accounts | None present | Automated source scan | PASS |
| PRIV-2 | Privacy disclosure | About page documents geolocation and tiles | Browser/About review | PASS |
| DOC-1 | Setup/refresh/deploy docs | README and docs set | Link/file validation | PASS |
| DOC-2 | AI disclosure | `docs/AI_USAGE.md` | File inspection | PASS |
| SCRUM-1 | Two sprint records | Backlog and two factual reviews | File inspection | PASS |
| DEPLOY-1 | GitHub Pages ready | Actions workflow and relative paths | Local HTTP checks; public workflow pending | PASS (configuration) |
| DESIGN-1 | Figma visual direction | Red header, 326 px rail, map, timeline, About | Embedded preview comparison; Chrome and Safari QA | PASS with access limitation |

