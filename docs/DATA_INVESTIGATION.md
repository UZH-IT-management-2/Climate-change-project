# Data availability investigation

Investigation date: 8 November 2026. All findings below were checked against the
official `data.geo.admin.ch` STAC API and MeteoSwiss Open Data documentation.

## Catalogue findings

Collection: `ch.meteoschweiz.ogd-surface-derived-grid`

The `archive-ch` item contains consolidated annual assets through 2025. The
application deliberately excludes 2026 because it is incomplete.

| Variable | Selected product | Coverage used | Format / CRS | Finding |
| --- | --- | --- | --- | --- |
| Mean temperature | `TabsY` | 1961–2025 | NetCDF, Swiss LV95 EPSG:2056 | 65 annual files; primary requested product |
| Precipitation | `RhiresY` | 1961–2025 | NetCDF, Swiss LV95 EPSG:2056 | 65 annual files; primary requested product |
| Sunshine | `SrelrecY1961` | 1961–2025 | NetCDF, WGS84 EPSG:4326 | selected because operational `SrelY` begins in 1971 |
| Hot days | NBCN `ths30xy0` | 1961–2025 | annual semicolon CSV, WGS84 station points | official annual count, 29 catalogue stations |

The official documentation describes the spatial analyses as station-derived
pseudo-observations on a roughly kilometre-scale national grid. The sampled
`TabsY` and `RhiresY` annual files have 240 × 370 cells and two-dimensional
latitude/longitude coordinates in addition to LV95 axes. The sunshine
reconstruction has 103 × 241 WGS84 cells.

## Baseline availability

`TabsY`, `RhiresY`, and `SrelrecY1961` all contain every year from 1961 through
1990. The baseline is therefore calculated separately at every grid cell from
30 real annual observations. NBCN station baselines use all published values in
that period and require at least 20 valid years; insufficient baselines are
represented as missing.

No 1991–2020 anomaly product is used because the specification explicitly
requires 1961–1990. Precipitation and sunshine differences remain arithmetic
differences in millimetres and percentage points.

## Coordinates and alignment

The LV95 products are never treated as latitude/longitude. The pipeline builds
the source transform in EPSG:2056, flips south-to-north source rows into raster
order, and uses Rasterio's bilinear reprojection to EPSG:4326. The WGS84
sunshine grid uses its published coordinate axes. A geoBoundaries polygon masks
all reprojected rasters to Switzerland before PNG and lookup export.

The first browser increment revealed that official grid cells continue beyond
the Swiss border. This was fixed by country masking and recorded in commit
`c73295f`.

## Station data

Collection: `ch.meteoschweiz.ogd-nbcn`

The catalogue exposes 29 NBCN stations, their WGS84 coordinates, and annual CSV
files. `ths30xy0` is the published annual hot-day count used by the application.
The processor extracts it directly; daily records are not re-aggregated.

Validation evidence for Zürich/Fluntern, Lugano, and Säntis is generated in
`docs/data_validation.json`. Selected official values are:

| Station | 1961 | 2003 | 2025 | 1961–1990 mean |
| --- | ---: | ---: | ---: | ---: |
| Zürich / Fluntern | 2 | 27 | 14 | 2.6 |
| Lugano | 0 | 47 | 31 | 2.2 |
| Säntis | 0 | 0 | 0 | 0.0 |

## Licensing and attribution

The STAC collection declares CC BY and identifies MeteoSwiss as producer and
licensor. The MeteoSwiss documentation requires the attribution:

> Source: MeteoSwiss

That attribution appears in the map and About page. OpenStreetMap and
geoBoundaries are attributed separately.

## File-size decision

The downloaded annual grids are roughly 0.1–1.1 MB each. Raw sources are not
committed. The distributable result contains 390 optimized 640 × 300 PNGs plus
compact lookup JSON, approximately 39 MB in total. The app lazy-loads the active
year and preloads only adjacent years.

## Exclusions

- No Open-Meteo or ERA5 fallback was used, so no fallback approval was needed.
- Snow is excluded because a suitable harmonized annual series for the complete
  historical period was not established without processing large daily data.
- Monthly grids are lower priority and not included in this delivery.

