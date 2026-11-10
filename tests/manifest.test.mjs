import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const readJson = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const manifest = await readJson("data/manifest.json");
const requiredVariables = ["temperature", "precipitation", "sunshine", "hotDays"];

test("manifest exposes the complete shared annual record", () => {
  assert.equal(manifest.earliestYear, 1961);
  assert.equal(manifest.latestCompleteYear, 2025);
  assert.deepEqual(manifest.baselinePeriod, [1961, 1990]);
  assert.deepEqual(Object.keys(manifest.variables), requiredVariables);
  for (const variable of requiredVariables) {
    const years = manifest.variables[variable].years;
    assert.equal(years.length, 65, variable);
    assert.deepEqual(years, Array.from({ length: 65 }, (_, index) => 1961 + index));
  }
});

test("every declared raster overlay is a non-empty 640 × 300 PNG", async () => {
  for (const variable of requiredVariables.slice(0, 3)) {
    const definition = manifest.variables[variable];
    for (const mode of ["absolute", "anomaly"]) {
      const template = definition[`${mode}Path`];
      for (const year of definition.years) {
        const relative = template.replace("{year}", year);
        const file = path.join(root, relative);
        assert.ok((await stat(file)).size > 200, relative);
        const header = await readFile(file);
        assert.equal(header.subarray(1, 4).toString("ascii"), "PNG", relative);
        assert.equal(header.readUInt32BE(16), 640, relative);
        assert.equal(header.readUInt32BE(20), 300, relative);
      }
    }
  }
});

test("published sample baselines equal the 1961–1990 observations within rounding tolerance", async () => {
  const tolerances = { temperature: 0.15, precipitation: 1.1, sunshine: 1.1 };
  for (const variable of Object.keys(tolerances)) {
    const samples = await readJson(`data/samples/${variable}.json`);
    const baselineYears = Array.from({ length: 30 }, (_, index) => String(1961 + index));
    let checked = 0;
    for (let row = 0; row < samples.height; row += 5) {
      for (let column = 0; column < samples.width; column += 7) {
        const expected = samples.baseline[row][column];
        const values = baselineYears.map((year) => samples.years[year][row][column]).filter((value) => value != null);
        if (expected == null || values.length !== 30) continue;
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        assert.ok(Math.abs(mean - expected) <= tolerances[variable], `${variable} ${row},${column}: ${mean} vs ${expected}`);
        checked += 1;
      }
    }
    assert.ok(checked > 20, `${variable}: insufficient valid cells checked`);
  }
});

test("station baselines and anomalies are calculated from real 1961–1990 values", async () => {
  const payload = await readJson("data/stations/hot-days.json");
  assert.equal(payload.stations.length, 29);
  for (const station of payload.stations) {
    const baselineValues = station.values.slice(0, 30).filter((value) => value != null);
    if (station.baseline == null) {
      assert.ok(baselineValues.length < 20);
      continue;
    }
    const mean = baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length;
    assert.equal(station.baseline, Number(mean.toFixed(1)), station.id);
    station.values.forEach((value, index) => {
      const expected = value == null ? null : Number((value - station.baseline).toFixed(1));
      assert.equal(station.anomalies[index], expected, `${station.id} ${payload.years[index]}`);
    });
  }
});

test("all four locales have the same complete key set", async () => {
  const locales = await Promise.all(["en", "de", "fr", "it"].map((language) => readJson(`locales/${language}.json`)));
  const reference = Object.keys(locales[0]).sort();
  for (const locale of locales.slice(1)) assert.deepEqual(Object.keys(locale).sort(), reference);
  assert.ok(reference.length > 50);
  for (const key of ["whyHeading", "heatHeading", "mapLearningHeading", "readingHeading"]) assert.ok(reference.includes(key));
});

test("about page includes the educational climate section and trusted Swiss resources", async () => {
  const source = await readFile(path.join(root, "about.html"), "utf8");
  assert.match(source, /class="learning-section"/);
  assert.match(source, /data-i18n="heatTipHydrate"/);
  assert.match(source, /https:\/\/www\.meteoswiss\.admin\.ch/);
  assert.match(source, /https:\/\/www\.bag\.admin\.ch\/en\/heat/);
  assert.match(source, /https:\/\/www\.nccs\.admin\.ch\/nccs\/en\/home\.html/);
});

test("frontend is framework-free and contains no analytics or cookie code", async () => {
  const files = await Promise.all(["index.html", "about.html", "assets/js/app.js"].map((file) => readFile(path.join(root, file), "utf8")));
  const source = files.join("\n").toLowerCase();
  assert.doesNotMatch(source, /react|next\.js|vue|angular/);
  assert.doesNotMatch(source, /google-analytics|googletagmanager|plausible|segment\.com/);
  assert.doesNotMatch(source, /document\.cookie|localstorage/);
  assert.match(files[0], /vendor\/leaflet\/leaflet\.js/);
});

