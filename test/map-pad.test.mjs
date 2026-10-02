import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const labels = ["Pan west", "Pan east", "Zoom in", "Zoom out"];

for (const file of ["index.html", "lakes/index.html"]) {
  const html = read(file);
  for (const label of labels) {
    assert.equal(
      html.includes(`aria-label="${label}"`),
      true,
      file + " missing " + label
    );
  }
  assert.equal((html.match(/class="map-pad"/g) || []).length, 1, file);
  assert.ok(html.indexOf('class="map-pad"') < html.indexOf('class="map-scroll"'), file + " pad tab order");

  const illustration = html.slice(
    html.indexOf('data-map-panel="illustration"'),
    html.indexOf('data-map-panel="satellite"')
  );
  assert.equal(illustration.includes("map-pad"), false, file + " illustration pad");
  assert.equal(illustration.includes("Pan west"), false, file + " illustration label");
  assert.equal(illustration.includes("Zoom in"), false, file + " illustration zoom");

  const satellite = html.slice(
    html.indexOf('data-map-panel="satellite"'),
    html.indexOf('class="map-more"')
  );
  assert.equal(satellite.includes("map-pad"), false, file + " pad scrolls with the photo");
  assert.match(satellite, /Arrow keys pan and zoom when this map is focused/);
}

const css = read("styles.css");
assert.match(css, /\.map-pad \{\s*display: none;/);
assert.match(css, /\.map-frame\.is-satellite \.map-pad \{\s*display: grid;\s*\}/);
assert.equal(css.includes(".illustrated-map .map-pad"), false);

const js = read("site.js");
for (const move of ["west", "east", "in", "out"]) {
  assert.match(js, new RegExp('data-map-move="' + move + '"'));
}
assert.match(js, /ArrowLeft: "west"/);
assert.match(js, /ArrowUp: "in"/);
assert.match(js, /scrollBy/);
