import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const galleryDir = join(root, "images/statement-gallery");
const bridgeAlt = "County Road 30A crossing Western Lake, with coastal dunes beyond";
const outfallAlt = "Shallow turquoise water toward beach houses at a coastal dune lake outfall.";

const home = readFileSync(join(root, "index.html"), "utf8");
const statement = home.slice(
  home.indexOf('class="section statement"'),
  home.indexOf('class="wrap facts-wrap"'),
);
const manifest = JSON.parse(readFileSync(join(galleryDir, "gallery.json"), "utf8"));
const readme = readFileSync(join(galleryDir, "README.md"), "utf8");
const westernPage = readFileSync(join(root, "lakes/western/index.html"), "utf8");
const siteJs = readFileSync(join(root, "site.js"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");

assert.match(statement, /class="statement-gallery"/);
assert.match(statement, /data-gallery="images\/statement-gallery\/gallery\.json"/);
assert.match(statement, /class="statement-gallery-nav statement-gallery-prev"/);
assert.match(statement, /class="statement-gallery-nav statement-gallery-next"/);
assert.match(statement, /aria-label="Previous photo"/);
assert.match(statement, /aria-label="Next photo"/);
assert.match(
  statement,
  new RegExp(`src="images/statement-gallery/western-bridge\\.jpg"[^>]*alt="${bridgeAlt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`),
);
assert.equal(statement.includes("</a>."), false);
assert.equal(statement.includes("<figcaption>"), false);
assert.match(statement, /class="essay statement-copy"/);
assert.match(westernPage, /src="\.\.\/\.\.\/images\/western-bridge\.jpg"/);
assert.equal(existsSync(join(root, "images/western-bridge.jpg")), true);

assert.equal(Array.isArray(manifest), true);
assert.equal(manifest.length, 2);
assert.equal(manifest[0].file, "western-bridge.jpg");
assert.equal(manifest[0].alt, bridgeAlt);
assert.equal(manifest[1].file, "outfall-shore.jpg");
assert.equal(manifest[1].alt, outfallAlt);
for (const item of manifest) {
  const file = typeof item === "string" ? item : item.file;
  assert.match(file, /\.(jpe?g|png|webp)$/i);
  assert.equal(file.includes("/"), false);
  assert.equal(existsSync(join(galleryDir, file)), true);
}

const photoRule = css.slice(css.indexOf(".statement-photo img {"), css.indexOf(".statement-gallery-nav {"));
assert.match(photoRule, /aspect-ratio:\s*4\s*\/\s*3/);
assert.match(photoRule, /object-fit:\s*cover/);
assert.match(css, /\.statement-photo img \{\s*aspect-ratio:\s*16\s*\/\s*10;\s*\}/);

assert.match(readme, /gallery\.json/);
assert.match(readme, /ask Bob/);
assert.match(readme, /Drop a new photo/i);

function galleryApi() {
  const sandbox = {
    document: {
      querySelector() { return null; },
      getElementById() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    fetch() {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    },
  };
  vm.runInNewContext(siteJs, sandbox);
  return sandbox;
}

const api = galleryApi();

assert.deepEqual(
  JSON.parse(JSON.stringify(api.statementGalleryPhotos([
    { file: "western-bridge.jpg", alt: bridgeAlt, position: "center 45%" },
    "dune-outfall.png",
    { src: "shore.webp", alt: "  Shore at dusk  " },
    "../secret.jpg",
    "notes.txt",
    "https://example.com/a.jpg",
    { file: "nested/photo.jpg" },
  ], "images/statement-gallery/gallery.json"))),
  [
    {
      src: "images/statement-gallery/western-bridge.jpg",
      alt: bridgeAlt,
      position: "center 45%",
    },
    {
      src: "images/statement-gallery/dune-outfall.png",
      alt: "dune outfall",
      position: "",
    },
    {
      src: "images/statement-gallery/shore.webp",
      alt: "Shore at dusk",
      position: "",
    },
  ],
);

function mount(list) {
  const img = {
    alt: "",
    src: "images/statement-gallery/western-bridge.jpg",
    style: {},
    getAttribute(name) {
      return name === "src" ? this.src : null;
    },
  };
  const button = () => ({
    hidden: true,
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
  });
  const root = {
    attrs: { "data-gallery": "images/statement-gallery/gallery.json" },
    tabIndex: -1,
    listeners: {},
    img,
    prev: button(),
    next: button(),
    status: { textContent: "" },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    querySelector(sel) {
      if (sel === "img") return img;
      if (sel === ".statement-gallery-prev") return this.prev;
      if (sel === ".statement-gallery-next") return this.next;
      if (sel === ".statement-gallery-status") return this.status;
      return null;
    },
  };
  const sandbox = {
    document: {
      querySelector(sel) {
        return sel === ".statement-gallery" ? root : null;
      },
      getElementById() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    fetch(url) {
      assert.equal(url, "images/statement-gallery/gallery.json");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(list),
      });
    },
  };
  vm.runInNewContext(siteJs, sandbox);
  return root;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const single = mount([
  { file: "western-bridge.jpg", alt: bridgeAlt, position: "center 45%" },
]);
await settle();
assert.equal(single.prev.hidden, true);
assert.equal(single.next.hidden, true);
assert.equal(single.img.alt, bridgeAlt);
assert.equal(single.img.src, "images/statement-gallery/western-bridge.jpg");
assert.equal(single.img.style.objectPosition, "center 45%");
assert.equal(single.status.textContent, "");
assert.equal(single.attrs.role, undefined);
assert.equal(single.listeners.keydown, undefined);

const live = mount(manifest);
await settle();
assert.equal(live.prev.hidden, false);
assert.equal(live.next.hidden, false);
assert.equal(live.img.src, "images/statement-gallery/western-bridge.jpg");
assert.equal(live.img.alt, bridgeAlt);
assert.equal(live.img.style.objectPosition, "center 45%");
assert.equal(live.status.textContent, "Photo 1 of 2");
live.next.listeners.click();
assert.equal(live.img.src, "images/statement-gallery/outfall-shore.jpg");
assert.equal(live.img.alt, outfallAlt);
assert.equal(live.img.style.objectPosition, "center");
assert.equal(live.status.textContent, "Photo 2 of 2");

const multi = mount([
  { file: "western-bridge.jpg", alt: bridgeAlt, position: "center 45%" },
  { file: "dune-outfall.jpg", alt: "A dune outfall meeting the Gulf" },
]);
await settle();
assert.equal(multi.prev.hidden, false);
assert.equal(multi.next.hidden, false);
assert.equal(multi.attrs.role, "region");
assert.equal(multi.attrs["aria-roledescription"], "carousel");
assert.equal(multi.status.textContent, "Photo 1 of 2");
assert.equal(multi.tabIndex, 0);

multi.next.listeners.click();
assert.equal(multi.img.src, "images/statement-gallery/dune-outfall.jpg");
assert.equal(multi.img.alt, "A dune outfall meeting the Gulf");
assert.equal(multi.img.style.objectPosition, "center");
assert.equal(multi.status.textContent, "Photo 2 of 2");

multi.listeners.keydown({ key: "ArrowLeft", preventDefault() {} });
assert.equal(multi.img.alt, bridgeAlt);
assert.equal(multi.status.textContent, "Photo 1 of 2");

multi.listeners.touchstart({ touches: [{ clientX: 180 }] });
multi.listeners.touchend({ changedTouches: [{ clientX: 40 }] });
assert.equal(multi.img.alt, "A dune outfall meeting the Gulf");

const broken = (() => {
  const img = {
    alt: bridgeAlt,
    src: "images/statement-gallery/western-bridge.jpg",
    style: { objectPosition: "center 45%" },
    getAttribute(name) { return name === "src" ? this.src : null; },
  };
  const root = {
    attrs: { "data-gallery": "images/statement-gallery/gallery.json" },
    img,
    prev: { hidden: true },
    next: { hidden: true },
    status: { textContent: "" },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel === "img") return img;
      if (sel === ".statement-gallery-prev") return this.prev;
      if (sel === ".statement-gallery-next") return this.next;
      if (sel === ".statement-gallery-status") return this.status;
      return null;
    },
  };
  vm.runInNewContext(siteJs, {
    document: {
      querySelector(sel) { return sel === ".statement-gallery" ? root : null; },
      getElementById() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    fetch() {
      return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
    },
  });
  return root;
})();
await settle();
assert.equal(broken.prev.hidden, true);
assert.equal(broken.img.alt, bridgeAlt);
assert.equal(broken.img.src, "images/statement-gallery/western-bridge.jpg");

console.log("statement gallery checks passed");
