import { I18n } from "./i18n.js";

const VARIABLE_KEYS = {
  temperature: "temperatureName",
  precipitation: "precipitationName",
  sunshine: "sunshineName",
  hotDays: "hotDaysName",
};

const state = {
  variable: "temperature",
  mode: "absolute",
  year: null,
  years: [],
  playing: false,
  playbackTimer: null,
  renderToken: 0,
  overlay: null,
  stationLayer: null,
  stationData: null,
  sampleCache: new Map(),
};

const elements = {
  language: document.querySelector("#language-select"),
  yearRange: document.querySelector("#year-range"),
  yearOutput: document.querySelector("#year-output"),
  mapYear: document.querySelector("#map-year"),
  firstYear: document.querySelector("#first-year"),
  lastYear: document.querySelector("#last-year"),
  playButton: document.querySelector("#play-button"),
  playIcon: document.querySelector("#play-icon"),
  playLabel: document.querySelector("#play-label"),
  legendTitle: document.querySelector("#legend-title"),
  legendUnit: document.querySelector("#legend-unit"),
  legendGradient: document.querySelector("#legend-gradient"),
  legendLabels: document.querySelector("#legend-labels"),
  legendNote: document.querySelector("#legend-note"),
  modeExplanation: document.querySelector("#mode-explanation"),
  activeVariable: document.querySelector("#active-variable-label"),
  activeMode: document.querySelector("#active-mode-label"),
  loading: document.querySelector("#loading-pill"),
  message: document.querySelector("#map-message"),
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebar-toggle"),
};

const [config, manifest] = await Promise.all([
  fetchJson("config/config.json"),
  fetchJson("data/manifest.json"),
]);

const i18n = new I18n(config.app.defaultLanguage);
await i18n.setLanguage(i18n.detect());
elements.language.value = i18n.language;

const countryBounds = L.latLngBounds(config.map.countryBounds);
const map = L.map("map", {
  center: config.map.center,
  zoom: config.map.zoom,
  minZoom: config.map.minZoom,
  maxZoom: config.map.maxZoom,
  zoomControl: false,
  maxBounds: countryBounds.pad(0.7),
  preferCanvas: true,
});

L.tileLayer(config.map.tileUrl, {
  attribution: config.map.tileAttribution,
  maxZoom: config.map.maxZoom,
  crossOrigin: true,
}).addTo(map);
L.control.zoom({ position: "bottomright" }).addTo(map);
map.fitBounds(countryBounds, { padding: [20, 20] });

try {
  const boundary = await fetchJson("data/switzerland.geojson");
  L.geoJSON(boundary, {
    className: "country-outline",
    style: { color: "#173f61", weight: 1.2, opacity: 0.9, fillOpacity: 0 },
    interactive: false,
  }).addTo(map);
} catch (error) {
  console.warn("Boundary unavailable", error);
}

bindControls();
await selectVariable("temperature", { preserveYear: false });
attemptRegionalPositioning();

function bindControls() {
  document.querySelectorAll("[data-variable]").forEach((button) => {
    button.addEventListener("click", () => selectVariable(button.dataset.variable));
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  elements.yearRange.addEventListener("input", () => {
    stopPlayback();
    setYear(state.years[Number(elements.yearRange.value)]);
  });
  elements.playButton.addEventListener("click", () => {
    state.playing ? stopPlayback() : startPlayback();
  });
  elements.language.addEventListener("change", async () => {
    await i18n.setLanguage(elements.language.value);
    refreshTranslatedUi();
  });
  elements.sidebarToggle.addEventListener("click", () => {
    const isOpen = elements.sidebar.classList.toggle("is-open");
    elements.sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    setTimeout(() => map.invalidateSize(), 260);
  });
  map.on("click", inspectRasterPoint);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPlayback();
  });
}

async function selectVariable(variable, { preserveYear = true } = {}) {
  if (!manifest.variables[variable]) return;
  stopPlayback();
  state.variable = variable;
  const definition = manifest.variables[variable];
  const previousYear = state.year;
  state.years = definition.years;
  state.year = preserveYear && previousYear
    ? nearestYear(previousYear, state.years)
    : state.years[0];

  document.querySelectorAll("[data-variable]").forEach((button) => {
    const active = button.dataset.variable === variable;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  configureTimeline();
  refreshTranslatedUi();
  await updateVisualization();
}

function setMode(mode) {
  if (!['absolute', 'anomaly'].includes(mode) || mode === state.mode) return;
  stopPlayback();
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  refreshTranslatedUi();
  updateVisualization();
}

function configureTimeline() {
  elements.yearRange.min = "0";
  elements.yearRange.max = String(state.years.length - 1);
  elements.yearRange.value = String(state.years.indexOf(state.year));
  elements.firstYear.textContent = state.years[0];
  elements.lastYear.textContent = state.years.at(-1);
  updateYearLabels();
}

function setYear(year) {
  if (!state.years.includes(year)) return Promise.resolve();
  state.year = year;
  elements.yearRange.value = String(state.years.indexOf(year));
  updateYearLabels();
  return updateVisualization();
}

function updateYearLabels() {
  elements.yearOutput.value = state.year;
  elements.yearOutput.textContent = state.year;
  elements.mapYear.textContent = state.year;
}

async function updateVisualization() {
  hideMessage();
  const definition = manifest.variables[state.variable];
  if (definition.type === "stations") {
    if (state.overlay) {
      map.removeLayer(state.overlay);
      state.overlay = null;
    }
    await renderStations(definition);
    return;
  }
  if (state.stationLayer) {
    map.removeLayer(state.stationLayer);
    state.stationLayer = null;
  }
  await renderRaster(definition);
}

async function renderRaster(definition) {
  const token = ++state.renderToken;
  const template = state.mode === "absolute" ? definition.absolutePath : definition.anomalyPath;
  const url = template.replace("{year}", state.year);
  elements.loading.hidden = false;
  const newOverlay = L.imageOverlay(url, definition.bounds, {
    opacity: 0,
    interactive: false,
    className: "climate-overlay",
  }).addTo(map);

  await new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve("timeout"), 5000);
    newOverlay.once("load", () => {
      clearTimeout(timeout);
      resolve("load");
    });
    newOverlay.once("error", () => {
      clearTimeout(timeout);
      resolve("error");
    });
  }).then((result) => {
    if (token !== state.renderToken) {
      map.removeLayer(newOverlay);
      return;
    }
    if (result === "error") {
      map.removeLayer(newOverlay);
      showMessage(i18n.t("layerError"));
      return;
    }
    const previous = state.overlay;
    state.overlay = newOverlay;
    newOverlay.setOpacity(0.78);
    if (previous && map.hasLayer(previous)) map.removeLayer(previous);
    preloadAdjacent(definition);
  }).finally(() => {
    if (token === state.renderToken) elements.loading.hidden = true;
  });
}

async function renderStations(definition) {
  elements.loading.hidden = false;
  if (!state.stationData) state.stationData = await fetchJson(definition.data);
  if (state.stationLayer) map.removeLayer(state.stationLayer);
  const layer = L.layerGroup();
  const yearIndex = state.stationData.years.indexOf(state.year);
  const domain = state.mode === "absolute" ? definition.absoluteDomain : definition.anomalyDomain;
  const palette = state.mode === "absolute" ? definition.absolutePalette : definition.anomalyPalette;

  state.stationData.stations.forEach((station) => {
    const series = state.mode === "absolute" ? station.values : station.anomalies;
    const value = series[yearIndex];
    if (value == null) return;
    const marker = L.circleMarker([station.lat, station.lon], {
      radius: 5 + Math.min(7, Math.abs(value) / (state.mode === "absolute" ? 7 : 5)),
      color: "#ffffff",
      weight: 1.5,
      fillColor: colorForValue(value, domain, palette),
      fillOpacity: 0.92,
      bubblingMouseEvents: false,
    });
    marker.bindTooltip(`${station.name}: ${formatValue(value, definition)}`, { direction: "top" });
    marker.on("click", () => {
      marker.bindPopup(stationPopup(station, definition, yearIndex), {
        className: "climate-popup",
        maxWidth: 310,
      }).openPopup();
    });
    layer.addLayer(marker);
  });
  layer.addTo(map);
  state.stationLayer = layer;
  elements.loading.hidden = true;
}

async function inspectRasterPoint(event) {
  const definition = manifest.variables[state.variable];
  if (!definition || definition.type !== "raster") return;
  let samples = state.sampleCache.get(state.variable);
  if (!samples) {
    samples = await fetchJson(definition.samples);
    state.sampleCache.set(state.variable, samples);
  }
  const [[south, west], [north, east]] = samples.bounds;
  const { lat, lng } = event.latlng;
  if (lat < south || lat > north || lng < west || lng > east) return;
  const column = Math.min(samples.width - 1, Math.max(0, Math.floor(((lng - west) / (east - west)) * samples.width)));
  const row = Math.min(samples.height - 1, Math.max(0, Math.floor(((north - lat) / (north - south)) * samples.height)));
  const value = samples.years[String(state.year)]?.[row]?.[column];
  const baseline = samples.baseline?.[row]?.[column];
  if (value == null || baseline == null) {
    L.popup({ className: "climate-popup" }).setLatLng(event.latlng).setContent(`<p>${escapeHtml(i18n.t("noData"))}</p>`).openOn(map);
    return;
  }
  const anomaly = Number((value - baseline).toFixed(definition.decimals));
  const primary = state.mode === "absolute" ? value : anomaly;
  const html = `
    <span class="popup-eyebrow">${escapeHtml(i18n.t("mapPointLabel"))}</span>
    <h3 class="popup-title">${escapeHtml(i18n.t(VARIABLE_KEYS[state.variable]))} · ${state.year}</h3>
    <div class="popup-values">
      ${popupValue(i18n.t("selectedYear"), formatValue(primary, definition, state.mode === "anomaly"))}
      ${popupValue(i18n.t("baselineAverage"), formatValue(baseline, definition))}
      ${popupValue(i18n.t("differenceLabel"), formatValue(anomaly, definition, true))}
      ${popupValue(i18n.t("locationLabel"), `${lat.toFixed(3)}, ${lng.toFixed(3)}`)}
    </div>`;
  L.popup({ className: "climate-popup", maxWidth: 310 }).setLatLng(event.latlng).setContent(html).openOn(map);
}

function stationPopup(station, definition, yearIndex) {
  const absolute = station.values[yearIndex];
  const anomaly = station.anomalies[yearIndex];
  const primary = state.mode === "absolute" ? absolute : anomaly;
  const series = state.mode === "absolute" ? station.values : station.anomalies;
  return `
    <span class="popup-eyebrow">${escapeHtml(i18n.t("stationLabel"))} · ${escapeHtml(station.abbr)}</span>
    <h3 class="popup-title">${escapeHtml(station.name)} · ${state.year}</h3>
    <div class="popup-values">
      ${popupValue(i18n.t("selectedYear"), formatValue(primary, definition, state.mode === "anomaly"))}
      ${popupValue(i18n.t("baselineAverage"), formatValue(station.baseline, definition))}
      ${popupValue(i18n.t("differenceLabel"), formatValue(anomaly, definition, true))}
    </div>
    ${sparkline(series, state.stationData.years, yearIndex)}
  `;
}

function sparkline(series, years, selectedIndex) {
  const valid = series.map((value, index) => ({ value, index })).filter((item) => item.value != null);
  if (valid.length < 2) return "";
  const values = valid.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = valid.map(({ value, index }) => `${(index / (series.length - 1) * 100).toFixed(2)},${(42 - ((value - min) / span) * 38).toFixed(2)}`).join(" ");
  const markerX = (selectedIndex / (series.length - 1)) * 100;
  return `<svg class="station-sparkline" viewBox="0 0 100 46" role="img" aria-label="${escapeHtml(i18n.t("chartLabel", { start: years[0], end: years.at(-1) }))}" preserveAspectRatio="none"><line x1="0" y1="42" x2="100" y2="42"></line><line x1="${markerX}" y1="1" x2="${markerX}" y2="44" style="stroke:#d52b1e;opacity:.28"></line><polyline points="${points}"></polyline></svg>`;
}

function startPlayback() {
  if (state.playing) return;
  if (state.year === state.years.at(-1)) setYear(state.years[0]);
  state.playing = true;
  refreshPlaybackButton();
  scheduleNextYear();
}

function scheduleNextYear() {
  clearTimeout(state.playbackTimer);
  if (!state.playing) return;
  state.playbackTimer = setTimeout(async () => {
    const index = state.years.indexOf(state.year);
    if (index >= state.years.length - 1) {
      stopPlayback();
      return;
    }
    await setYear(state.years[index + 1]);
    scheduleNextYear();
  }, config.playback.intervalMs);
}

function stopPlayback() {
  state.playing = false;
  clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  refreshPlaybackButton();
}

function refreshPlaybackButton() {
  elements.playIcon.textContent = state.playing ? "Ⅱ" : "▶";
  elements.playLabel.textContent = i18n.t(state.playing ? "pause" : "play");
  elements.playButton.setAttribute("aria-label", i18n.t(state.playing ? "pauseTimeline" : "playTimeline"));
}

function refreshTranslatedUi() {
  const definition = manifest.variables[state.variable];
  const variableName = i18n.t(VARIABLE_KEYS[state.variable]);
  elements.activeVariable.textContent = variableName;
  elements.legendTitle.textContent = variableName;
  elements.legendUnit.textContent = displayUnit(definition);
  elements.activeMode.textContent = i18n.t(state.mode === "absolute" ? "absoluteValue" : "differenceValue");
  elements.modeExplanation.textContent = i18n.t(state.mode === "absolute" ? "absoluteExplanation" : "anomalyExplanation");
  elements.legendNote.textContent = i18n.t(state.mode === "absolute" ? "legendAbsolute" : "legendAnomaly");
  updateLegend(definition);
  refreshPlaybackButton();
}

function updateLegend(definition) {
  const domain = state.mode === "absolute" ? definition.absoluteDomain : definition.anomalyDomain;
  const palette = state.mode === "absolute" ? definition.absolutePalette : definition.anomalyPalette;
  elements.legendGradient.style.background = `linear-gradient(90deg, ${palette.join(",")})`;
  const ticks = Array.from({ length: 5 }, (_, index) => domain[0] + (domain[1] - domain[0]) * (index / 4));
  elements.legendLabels.innerHTML = ticks.map((value) => `<span>${formatNumber(value, definition.decimals, state.mode === "anomaly")}</span>`).join("");
}

function preloadAdjacent(definition) {
  if (!config.playback.preloadAdjacentYears || definition.type !== "raster") return;
  const index = state.years.indexOf(state.year);
  [state.years[index - 1], state.years[index + 1]].filter(Boolean).forEach((year) => {
    const template = state.mode === "absolute" ? definition.absolutePath : definition.anomalyPath;
    const image = new Image();
    image.src = template.replace("{year}", year);
  });
}

async function attemptRegionalPositioning() {
  if (!config.geolocation.enabled) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.geolocation.timeoutMs);
  try {
    const response = await fetch(config.geolocation.url, { signal: controller.signal, cache: "no-store", referrerPolicy: "no-referrer" });
    if (!response.ok) return;
    const location = await response.json();
    if (location.success !== false && location.country_code === config.geolocation.swissCountryCode && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
      map.setView([location.latitude, location.longitude], config.geolocation.regionalZoom, { animate: true });
    }
  } catch (error) {
    if (error.name !== "AbortError") console.info("Approximate location unavailable; using national view.");
  } finally {
    clearTimeout(timeout);
  }
}

function nearestYear(year, years) {
  return years.reduce((nearest, candidate) => Math.abs(candidate - year) < Math.abs(nearest - year) ? candidate : nearest, years[0]);
}

function formatValue(value, definition, signed = false) {
  if (value == null) return "—";
  return `${formatNumber(value, definition.decimals, signed)} ${displayUnit(definition)}`;
}

function displayUnit(definition) {
  return definition.units === "days" ? i18n.t("daysUnit") : definition.units;
}

function formatNumber(value, decimals = 0, signed = false) {
  const number = Number(value);
  const prefix = signed && number > 0 ? "+" : "";
  return `${prefix}${number.toLocaleString(i18n.language, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function popupValue(label, value) {
  return `<div class="popup-value"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
}

function colorForValue(value, [minimum, maximum], palette) {
  const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  const position = ratio * (palette.length - 1);
  const lower = Math.floor(position);
  const upper = Math.min(palette.length - 1, Math.ceil(position));
  const amount = position - lower;
  const a = hexToRgb(palette[lower]);
  const b = hexToRgb(palette[upper]);
  return `rgb(${Math.round(a.r + (b.r - a.r) * amount)} ${Math.round(a.g + (b.g - a.g) * amount)} ${Math.round(a.b + (b.b - a.b) * amount)})`;
}

function hexToRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 };
}

function showMessage(message) {
  elements.message.textContent = message;
  elements.message.hidden = false;
}

function hideMessage() {
  elements.message.hidden = true;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

