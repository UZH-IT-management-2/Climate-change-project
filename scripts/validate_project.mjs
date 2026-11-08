import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(root, "data/manifest.json"), "utf8"));

for (const entry of ["index.html", "about.html", "config/config.json", "data/switzerland.geojson", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css"]) {
  await access(path.join(root, entry));
}

for (const [variable, definition] of Object.entries(manifest.variables)) {
  assert.ok(definition.years.length, `${variable} has no years`);
  assert.equal(definition.years[0], 1961, `${variable} start year`);
  assert.equal(definition.years.at(-1), 2025, `${variable} end year`);
  if (definition.type !== "raster") continue;
  for (const template of [definition.absolutePath, definition.anomalyPath]) {
    for (const year of definition.years) {
      const file = path.join(root, template.replace("{year}", year));
      assert.ok((await stat(file)).size > 0, file);
    }
  }
}

console.log(`Validated ${Object.keys(manifest.variables).length} variables through ${manifest.latestCompleteYear}.`);
