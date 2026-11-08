# Decisions and issue log

| ID | Decision or issue | Evidence / resolution | State |
| --- | --- | --- | --- |
| D-01 | Use Leaflet, not a framework | Static raster/station requirements fit Leaflet; runtime pinned locally at 1.9.4 | Closed |
| D-02 | Use 2025 as latest complete year | It is the newest year shared by all required annual grid products | Closed |
| D-03 | Use `SrelrecY1961` for sunshine | Operational `SrelY` begins in 1971; reconstruction supplies the full baseline | Closed |
| D-04 | Keep anomalies arithmetic | Temperature °C, precipitation mm, sunshine percentage points, hot days | Closed |
| D-05 | Use annual NBCN `ths30xy0` | Official count avoids inconsistent daily re-aggregation | Closed |
| D-06 | Use a compact authentic lookup grid | Enables raster inspection without decoding displayed image colors | Closed |
| D-07 | Use ipwho.is best-effort lookup | No key, one request, timeout, no storage, national fallback | Closed |
| I-01 | Requirements PDF absent | Pasted master specification used; gap disclosed | Open external dependency |
| I-02 | Native Figma access not approved | Embedded `.fig` preview used for layout and visual language | Closed with limitation |
| I-03 | Raster rectangle visible outside country | Fixed with WGS84 boundary mask; verified in Chrome | Closed |
| I-04 | Snow series not established | Optional feature excluded; no large daily processing undertaken | Deferred |
| I-05 | Cross-browser availability | Chrome passed; remaining browsers not claimed | Deferred |
| I-06 | Client feedback unavailable | No review, acceptance, or sign-off fabricated | Pending client |

