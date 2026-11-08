#!/usr/bin/env python3
"""Build static web assets from official MeteoSwiss Open Data.

The script discovers annual assets from the FSDI STAC catalogue, downloads
NetCDF/CSV source files, reprojects grids to WGS84, calculates the 1961–1990
baseline, and writes transparent PNG overlays plus compact lookup JSON.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import math
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import requests
import xarray as xr
from PIL import Image, ImageColor
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.transform import from_bounds
from rasterio.warp import reproject


ROOT = Path(__file__).resolve().parents[1]
LOGGER = logging.getLogger("climate-pipeline")
YEAR_RE = re.compile(r"_(\d{4})0101000000_\d{4}0101000000\.nc$")
STATION_YEAR_RE = re.compile(r"\d{2}\.\d{2}\.(\d{4})")
OUTPUT_WIDTH = 640
OUTPUT_HEIGHT = 300
SAMPLE_WIDTH = 80
SAMPLE_HEIGHT = 38
HOT_DAY_PARAMETER = "ths30xy0"
COUNTRY_BOUNDARY = ROOT / "data/switzerland.geojson"
_COUNTRY_GEOMETRIES: list[dict[str, Any]] | None = None


@dataclass(frozen=True)
class GridAsset:
    year: int
    name: str
    href: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=ROOT / "config/config.json")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / "data/cache")
    parser.add_argument("--start-year", type=int, default=None)
    parser.add_argument("--end-year", type=int, default=None)
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Use cached source files and fail instead of accessing the network.",
    )
    parser.add_argument(
        "--keep-raw",
        action="store_true",
        help="Retain downloaded NetCDF and CSV files under data/cache.",
    )
    return parser.parse_args()


class Downloader:
    def __init__(self, cache_dir: Path, offline: bool = False) -> None:
        self.cache_dir = cache_dir
        self.offline = offline
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "SwissHistoricalClimateExplorer/1.0 (university project)"}
        )

    def get_json(self, url: str, relative_path: str) -> dict[str, Any]:
        path = self.cache_dir / relative_path
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        if self.offline:
            raise FileNotFoundError(f"Missing cached metadata: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        LOGGER.info("Fetching metadata %s", url)
        response = self.session.get(url, timeout=60)
        response.raise_for_status()
        payload = response.json()
        path.write_text(json.dumps(payload), encoding="utf-8")
        return payload

    def download(self, url: str, relative_path: str) -> Path:
        path = self.cache_dir / relative_path
        if path.exists() and path.stat().st_size:
            return path
        if self.offline:
            raise FileNotFoundError(f"Missing cached source file: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".part")
        LOGGER.info("Downloading %s", url)
        with self.session.get(url, timeout=180, stream=True) as response:
            response.raise_for_status()
            with temporary.open("wb") as target:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        target.write(chunk)
        temporary.replace(path)
        return path


def read_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def discover_grid_assets(
    archive: dict[str, Any], pattern: str, start: int, end: int | None
) -> list[GridAsset]:
    assets: list[GridAsset] = []
    for name, details in archive.get("assets", {}).items():
        if f".{pattern}." not in name:
            continue
        match = YEAR_RE.search(name)
        if not match:
            continue
        year = int(match.group(1))
        if year < start or (end is not None and year > end):
            continue
        assets.append(GridAsset(year, name, details["href"]))
    assets.sort(key=lambda item: item.year)
    if not assets:
        raise RuntimeError(f"No STAC assets matched {pattern!r}")
    return assets


def _source_grid(dataset: xr.Dataset, variable_name: str) -> tuple[np.ndarray, Any, CRS]:
    variable = dataset[variable_name]
    values = np.asarray(variable.squeeze(drop=True).values, dtype=np.float32)
    if values.ndim != 2:
        raise ValueError(f"Expected 2D grid for {variable_name}, got {values.shape}")

    if "E" in dataset.coords and "N" in dataset.coords:
        east = np.asarray(dataset["E"].values, dtype=float)
        north = np.asarray(dataset["N"].values, dtype=float)
        x_step = float(np.median(np.diff(east)))
        y_step = float(np.median(np.diff(north)))
        bounds = (
            east.min() - abs(x_step) / 2,
            north.min() - abs(y_step) / 2,
            east.max() + abs(x_step) / 2,
            north.max() + abs(y_step) / 2,
        )
        source_crs = CRS.from_epsg(2056)
    elif "lon" in dataset.coords and "lat" in dataset.coords:
        longitude = np.asarray(dataset["lon"].values, dtype=float)
        latitude = np.asarray(dataset["lat"].values, dtype=float)
        x_step = float(np.median(np.diff(longitude)))
        y_step = float(np.median(np.diff(latitude)))
        bounds = (
            longitude.min() - abs(x_step) / 2,
            latitude.min() - abs(y_step) / 2,
            longitude.max() + abs(x_step) / 2,
            latitude.max() + abs(y_step) / 2,
        )
        source_crs = CRS.from_epsg(4326)
    else:
        raise ValueError(f"Unrecognized coordinate system in {variable_name}")

    # MeteoSwiss coordinates run south-to-north. Rasterio row zero is north.
    values = np.flipud(values)
    source_transform = from_bounds(*bounds, values.shape[1], values.shape[0])
    return values, source_transform, source_crs


def reproject_grid(path: Path, variable_name: str, bounds: list[list[float]]) -> np.ndarray:
    with xr.open_dataset(path, decode_times=False) as dataset:
        source, source_transform, source_crs = _source_grid(dataset, variable_name)

    south, west = bounds[0]
    north, east = bounds[1]
    destination = np.full((OUTPUT_HEIGHT, OUTPUT_WIDTH), np.nan, dtype=np.float32)
    destination_transform = from_bounds(
        west, south, east, north, OUTPUT_WIDTH, OUTPUT_HEIGHT
    )
    reproject(
        source=source,
        destination=destination,
        src_transform=source_transform,
        src_crs=source_crs,
        src_nodata=np.nan,
        dst_transform=destination_transform,
        dst_crs=CRS.from_epsg(4326),
        dst_nodata=np.nan,
        resampling=Resampling.bilinear,
    )
    global _COUNTRY_GEOMETRIES
    if _COUNTRY_GEOMETRIES is None:
        boundary = json.loads(COUNTRY_BOUNDARY.read_text(encoding="utf-8"))
        _COUNTRY_GEOMETRIES = [feature["geometry"] for feature in boundary["features"]]
    inside_switzerland = geometry_mask(
        _COUNTRY_GEOMETRIES,
        out_shape=destination.shape,
        transform=destination_transform,
        invert=True,
        all_touched=True,
    )
    destination[~inside_switzerland] = np.nan
    return destination


def palette_rgba(
    values: np.ndarray, domain: list[float], palette: list[str], opacity: int = 218
) -> np.ndarray:
    valid = np.isfinite(values)
    low, high = float(domain[0]), float(domain[1])
    normalized = np.clip((values - low) / (high - low), 0, 1)
    normalized = np.where(valid, normalized, 0)
    stops = np.linspace(0, 1, len(palette))
    colors = np.asarray([ImageColor.getrgb(color) for color in palette], dtype=float)
    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    for channel in range(3):
        rgba[..., channel] = np.interp(normalized, stops, colors[:, channel]).astype(
            np.uint8
        )
    rgba[..., 3] = np.where(valid, opacity, 0).astype(np.uint8)
    return rgba


def write_overlay(
    values: np.ndarray, domain: list[float], palette: list[str], output: Path
) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    image = Image.fromarray(palette_rgba(values, domain, palette), mode="RGBA")
    image.save(output, optimize=True, compress_level=9)


def compact_value(value: float, decimals: int) -> float | int | None:
    if not math.isfinite(float(value)):
        return None
    rounded = round(float(value), decimals)
    return int(rounded) if decimals == 0 else rounded


def sampled_grid(values: np.ndarray, decimals: int) -> list[list[float | int | None]]:
    rows = np.linspace(0, values.shape[0] - 1, SAMPLE_HEIGHT).round().astype(int)
    columns = np.linspace(0, values.shape[1] - 1, SAMPLE_WIDTH).round().astype(int)
    subset = values[np.ix_(rows, columns)]
    return [
        [compact_value(value, decimals) for value in row]
        for row in subset
    ]


def process_grid_variable(
    variable_id: str,
    definition: dict[str, Any],
    assets: list[GridAsset],
    downloader: Downloader,
    config: dict[str, Any],
) -> dict[str, Any]:
    bounds = config["map"]["overlayBounds"]
    baseline_start = config["baseline"]["start"]
    baseline_end = config["baseline"]["end"]
    arrays: dict[int, np.ndarray] = {}

    LOGGER.info("Processing %s (%d years)", variable_id, len(assets))
    for index, asset in enumerate(assets, start=1):
        LOGGER.info("%s %s (%d/%d)", variable_id, asset.year, index, len(assets))
        source = downloader.download(
            asset.href, f"grids/{variable_id}/{asset.year}.nc"
        )
        arrays[asset.year] = reproject_grid(source, definition["dataset"], bounds)

    baseline_years = [
        year for year in arrays if baseline_start <= year <= baseline_end
    ]
    if baseline_years != list(range(baseline_start, baseline_end + 1)):
        raise RuntimeError(
            f"{variable_id}: incomplete baseline years {baseline_years[0]}–{baseline_years[-1]}"
        )
    with np.errstate(invalid="ignore"):
        baseline = np.nanmean(
            np.stack([arrays[year] for year in baseline_years]), axis=0
        )

    overlay_root = ROOT / "data/overlays" / variable_id
    sample_payload: dict[str, Any] = {
        "variable": variable_id,
        "dataset": definition["dataset"],
        "units": definition["units"],
        "bounds": bounds,
        "width": SAMPLE_WIDTH,
        "height": SAMPLE_HEIGHT,
        "baselinePeriod": [baseline_start, baseline_end],
        "baseline": sampled_grid(baseline, definition["decimals"]),
        "years": {},
    }

    for year, values in arrays.items():
        anomaly = values - baseline
        write_overlay(
            values,
            definition["absoluteDomain"],
            definition["absolutePalette"],
            overlay_root / "absolute" / f"{year}.png",
        )
        write_overlay(
            anomaly,
            definition["anomalyDomain"],
            definition["anomalyPalette"],
            overlay_root / "anomaly" / f"{year}.png",
        )
        sample_payload["years"][str(year)] = sampled_grid(
            values, definition["decimals"]
        )

    samples_path = ROOT / "data/samples" / f"{variable_id}.json"
    samples_path.parent.mkdir(parents=True, exist_ok=True)
    samples_path.write_text(
        json.dumps(sample_payload, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    years = sorted(arrays)
    return {
        "type": "raster",
        "dataset": definition["dataset"],
        "years": years,
        "units": definition["units"],
        "decimals": definition["decimals"],
        "bounds": bounds,
        "absoluteDomain": definition["absoluteDomain"],
        "anomalyDomain": definition["anomalyDomain"],
        "absolutePalette": definition["absolutePalette"],
        "anomalyPalette": definition["anomalyPalette"],
        "absolutePath": f"data/overlays/{variable_id}/absolute/{{year}}.png",
        "anomalyPath": f"data/overlays/{variable_id}/anomaly/{{year}}.png",
        "samples": f"data/samples/{variable_id}.json",
        "source": "MeteoSwiss Open Data",
    }


def station_name(title: str, station_id: str) -> str:
    suffix = f" ({station_id.upper()})"
    return title[: -len(suffix)] if title.endswith(suffix) else title


def process_stations(
    items: dict[str, Any],
    downloader: Downloader,
    start_year: int,
    end_year: int,
    config: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    years = list(range(start_year, end_year + 1))
    stations: list[dict[str, Any]] = []
    validation: dict[str, Any] = {}
    for feature in sorted(items.get("features", []), key=lambda item: item["id"]):
        station_id = feature["id"]
        annual_asset = next(
            (
                asset
                for name, asset in feature.get("assets", {}).items()
                if name.endswith("_y.csv")
            ),
            None,
        )
        if not annual_asset:
            continue
        source = downloader.download(
            annual_asset["href"], f"stations/{station_id}_y.csv"
        )
        observations: dict[int, int | None] = {}
        with source.open("r", encoding="cp1252", newline="") as handle:
            for row in csv.DictReader(handle, delimiter=";"):
                match = STATION_YEAR_RE.search(row.get("reference_timestamp", ""))
                if not match:
                    continue
                year = int(match.group(1))
                if year < start_year or year > end_year:
                    continue
                raw_value = row.get(HOT_DAY_PARAMETER, "").strip()
                observations[year] = int(round(float(raw_value))) if raw_value else None

        baseline_values = [
            value
            for year, value in observations.items()
            if config["baseline"]["start"] <= year <= config["baseline"]["end"]
            and value is not None
        ]
        baseline = (
            round(float(np.mean(baseline_values)), 1)
            if len(baseline_values) >= 20
            else None
        )
        values = [observations.get(year) for year in years]
        anomalies = [
            round(value - baseline, 1)
            if value is not None and baseline is not None
            else None
            for value in values
        ]
        longitude, latitude = feature["geometry"]["coordinates"]
        record = {
            "id": station_id,
            "abbr": station_id.upper(),
            "name": station_name(feature["properties"]["title"], station_id),
            "lat": latitude,
            "lon": longitude,
            "baseline": baseline,
            "values": values,
            "anomalies": anomalies,
            "sourceUrl": annual_asset["href"],
        }
        stations.append(record)

        if station_id in {"sma", "lug", "sae"}:
            validation[station_id] = {
                "station": record["name"],
                "source": annual_asset["href"],
                "parameter": HOT_DAY_PARAMETER,
                "baseline": baseline,
                "observations": {
                    str(year): observations.get(year) for year in (1961, 2003, 2025)
                },
            }

    payload = {
        "source": "MeteoSwiss NBCN homogenized annual station observations",
        "sourceCollection": config["data"]["stationCollection"],
        "parameter": HOT_DAY_PARAMETER,
        "definition": "Annual count of days with daily maximum temperature at or above 30 °C, as published in the NBCN annual series.",
        "baselinePeriod": [config["baseline"]["start"], config["baseline"]["end"]],
        "years": years,
        "stations": stations,
    }
    output = ROOT / "data/stations/hot-days.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    manifest = {
        "type": "stations",
        "dataset": f"NBCN {HOT_DAY_PARAMETER}",
        "years": years,
        "units": "days",
        "decimals": 0,
        "absoluteDomain": config["variables"]["hotDays"]["absoluteDomain"],
        "anomalyDomain": config["variables"]["hotDays"]["anomalyDomain"],
        "absolutePalette": config["variables"]["hotDays"]["absolutePalette"],
        "anomalyPalette": config["variables"]["hotDays"]["anomalyPalette"],
        "data": "data/stations/hot-days.json",
        "source": "MeteoSwiss NBCN",
    }
    return manifest, validation


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    config = read_config(args.config)
    downloader = Downloader(args.cache_dir, args.offline)
    baseline_start = config["baseline"]["start"]
    requested_start = args.start_year or baseline_start

    stac_base = config["data"]["stacBase"]
    grid_collection = config["data"]["gridCollection"]
    archive_url = f"{stac_base}/collections/{grid_collection}/items/archive-ch"
    archive = downloader.get_json(archive_url, "metadata/grid-archive.json")

    definitions = {
        key: value
        for key, value in config["variables"].items()
        if key != "hotDays"
    }
    discovered = {
        variable_id: discover_grid_assets(
            archive,
            definition["assetPattern"],
            requested_start,
            args.end_year,
        )
        for variable_id, definition in definitions.items()
    }
    latest_complete = min(assets[-1].year for assets in discovered.values())
    earliest = max(requested_start, max(assets[0].year for assets in discovered.values()))
    if earliest > baseline_start:
        raise RuntimeError("Requested range excludes the 1961–1990 baseline")

    manifest_variables: dict[str, Any] = {}
    for variable_id, definition in definitions.items():
        assets = [
            asset
            for asset in discovered[variable_id]
            if earliest <= asset.year <= latest_complete
        ]
        manifest_variables[variable_id] = process_grid_variable(
            variable_id, definition, assets, downloader, config
        )

    station_collection = config["data"]["stationCollection"]
    station_url = f"{stac_base}/collections/{station_collection}/items?limit=100"
    station_items = downloader.get_json(station_url, "metadata/nbcn-items.json")
    hot_days_manifest, validation = process_stations(
        station_items, downloader, earliest, latest_complete, config
    )
    manifest_variables["hotDays"] = hot_days_manifest

    manifest = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "latestCompleteYear": latest_complete,
        "earliestYear": earliest,
        "baselinePeriod": [
            config["baseline"]["start"],
            config["baseline"]["end"],
        ],
        "source": {
            "name": "MeteoSwiss Open Data",
            "attribution": "Source: MeteoSwiss",
            "collection": grid_collection,
            "stac": archive_url,
            "license": "CC BY; MeteoSwiss terms of use apply",
        },
        "variables": manifest_variables,
        "limitations": [
            "Sunshine uses the MeteoSwiss SrelrecY1961 reconstructed annual series so that the complete 1961–1990 baseline is available.",
            "Raster point inspection uses a compact grid sampled from the official reprojected raster; values may differ slightly from the original 1–2 km cell due to bilinear reprojection and rounding.",
            "The final year is the latest year shared by all required annual grid series, not the current partial year.",
        ],
    }
    manifest_path = ROOT / "data/manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    validation_path = ROOT / "docs/data_validation.json"
    validation_path.parent.mkdir(parents=True, exist_ok=True)
    validation_path.write_text(
        json.dumps(
            {
                "generatedAt": manifest["generatedAt"],
                "method": "Direct extraction of the published NBCN annual hot-day parameter; no interpolation or synthetic values.",
                "stations": validation,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    if not args.keep_raw:
        for subdirectory in (args.cache_dir / "grids", args.cache_dir / "stations"):
            if subdirectory.exists():
                shutil.rmtree(subdirectory)
    LOGGER.info("Finished. Manifest: %s", manifest_path)


if __name__ == "__main__":
    main()

