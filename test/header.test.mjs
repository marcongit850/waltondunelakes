import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const headerJs = readFileSync(join(root, "header.js"), "utf8");
const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function renderHeader(pathname, scriptSrc) {
  let html = "";
  const script = {
    getAttribute(name) {
      return name === "src" ? scriptSrc : null;
    },
    insertAdjacentHTML(position, markup) {
      assert.equal(position, "beforebegin");
      html += markup;
    },
  };
  vm.runInNewContext(headerJs, {
    document: { currentScript: script },
    location: { pathname },
  });
  return html;
}

function navLinks(html) {
  const nav = html.match(/<nav class="nav" id="site-nav"[\s\S]*?<\/nav>/);
  assert.ok(nav, "primary nav missing");
  return [...nav[0].matchAll(/<a href="([^"]*)"([^>]*)>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1],
    attrs: match[2],
    text: match[3],
  }));
}

function assertChrome(html, brandHref) {
  assert.match(html, /<a class="skip-link" href="#content">Skip to content<\/a>/);
  assert.match(html, /<header class="site-header">/);
  assert.match(html, /<details class="nav-disclosure">/);
  assert.match(html, /<summary class="menu-toggle">Menu<\/summary>/);
  const brand = brandHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    html,
    new RegExp(
      '<a class="brand" href="' + brand + '">' +
      '\\s*<img class="brand-logo" src="' + brand + 'images/logo-walton-dune-lakes.png" alt="Walton Dune Lakes, Walton County, Florida" width="960" height="654">'
    )
  );
  assert.ok(html.indexOf("skip-link") < html.indexOf("<header"), "skip link precedes header");
}

const cases = [
  {
    pathname: "/",
    src: "header.js",
    brand: "./",
    links: [
      ["./lakes/", "THE LAKES", ""],
      ["./#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./the-data/", "THE DATA", ""],
      ["./contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/index.html",
    src: "header.js",
    brand: "./",
    links: [
      ["./lakes/", "THE LAKES", ""],
      ["./#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./the-data/", "THE DATA", ""],
      ["./contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/contact/",
    src: "../header.js",
    brand: "../",
    links: [
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["./", "CONTACT", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/contact/index.html",
    src: "../header.js",
    brand: "../",
    links: [
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["./", "CONTACT", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/lakes/",
    src: "../header.js",
    brand: "../",
    links: [
      ["./", "THE LAKES", ' aria-current="page"'],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["../contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/lakes/index.html",
    src: "../header.js",
    brand: "../",
    links: [
      ["./", "THE LAKES", ' aria-current="page"'],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["../contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/lakes/western/",
    src: "../../header.js",
    brand: "../../",
    links: [
      ["../", "THE LAKES", ""],
      ["../../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../../the-data/", "THE DATA", ""],
      ["../../contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/lakes/western/index.html",
    src: "../../header.js",
    brand: "../../",
    links: [
      ["../", "THE LAKES", ""],
      ["../../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../../the-data/", "THE DATA", ""],
      ["../../contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/lakes/camp-creek",
    src: "../../header.js",
    brand: "../../",
    links: [
      ["../", "THE LAKES", ""],
      ["../../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../../the-data/", "THE DATA", ""],
      ["../../contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/the-data/",
    src: "../header.js",
    brand: "../",
    links: [
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./", "THE DATA", ' aria-current="page"'],
      ["../contact/", "CONTACT", ""],
    ],
  },
  {
    pathname: "/the-data/index.html",
    src: "../header.js",
    brand: "../",
    links: [
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./", "THE DATA", ' aria-current="page"'],
      ["../contact/", "CONTACT", ""],
    ],
  },
];

for (const item of cases) {
  const html = renderHeader(item.pathname, item.src);
  assert.equal(html.match(/<header/g).length, 1, item.pathname);
  assertChrome(html, item.brand);
  const links = navLinks(html);
  assert.deepEqual(
    links.map((link) => [link.href, link.text, link.attrs]),
    item.links,
    item.pathname
  );
  const current = links.filter((link) => link.attrs.includes("aria-current"));
  const expectedCurrent = item.links.filter((link) => link[2].includes("aria-current"));
  assert.equal(current.length, expectedCurrent.length, item.pathname);
}

const htmlFiles = walk(root).filter((path) => path.endsWith(".html"));
const redirectPages = new Set([
  "get-involved/index.html",
  "impact/index.html",
  "membership/index.html",
]);
const pagesWithHeader = [];

for (const path of htmlFiles) {
  const rel = relative(root, path);
  const html = readFileSync(path, "utf8");
  assert.doesNotMatch(html, /<header\b/, `${rel} should not inline a header`);
  assert.doesNotMatch(html, /skip-link|site-header|nav-disclosure|id="site-nav"/, `${rel} should not duplicate header chrome`);

  if (redirectPages.has(rel)) {
    assert.doesNotMatch(html, /header\.js/, `${rel} is redirect-only`);
    assert.doesNotMatch(html, /footer\.js/, `${rel} is redirect-only`);
    continue;
  }

  const style = html.match(/<link rel="stylesheet" href="([^"]*)styles\.css">/);
  assert.ok(style, `${rel} should load styles.css`);
  const assetPrefix = style[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    html,
    new RegExp(`<link rel="icon" href="${assetPrefix}images/favicon\\.png" type="image/png" sizes="192x192">`),
    `${rel} favicon png`
  );
  assert.match(
    html,
    new RegExp(`<link rel="icon" href="${assetPrefix}images/favicon\\.ico" sizes="any">`),
    `${rel} favicon ico`
  );
  assert.match(
    html,
    new RegExp(`<link rel="apple-touch-icon" href="${assetPrefix}images/apple-touch-icon\\.png">`),
    `${rel} apple touch icon`
  );
  assert.doesNotMatch(html, /favicon\.svg/, `${rel} should use the Walton Dune Lakes mark`);

  const site = html.match(/<script src="([^"]*)site\.js"><\/script>/);
  const footer = html.match(/<script src="([^"]*)footer\.js"><\/script>/);
  const header = html.match(/<script src="([^"]*)header\.js"><\/script>/);
  assert.ok(site, `${rel} should load site.js`);
  assert.ok(footer, `${rel} should load footer.js`);
  assert.ok(header, `${rel} should load header.js`);
  assert.equal(header[1], site[1], `${rel} header.js depth should match site.js`);
  assert.equal(header[1], footer[1], `${rel} header.js depth should match footer.js`);
  const mainAt = html.indexOf("<main");
  assert.ok(mainAt > -1, `${rel} should have a main element`);
  assert.ok(html.indexOf(header[0]) < mainAt, `${rel} should insert the header before main`);
  assert.ok(
    html.indexOf(header[0]) < html.indexOf(footer[0]) && html.indexOf(footer[0]) < html.indexOf(site[0]),
    `${rel} should load header.js, then footer.js, then site.js`
  );
  pagesWithHeader.push(rel);
}

assert.equal(pagesWithHeader.length, 19);

assert.match(wrangler, /"main": "src\/worker\.js"/);
assert.match(wrangler, /"directory": "\."/);
assert.match(
  wrangler,
  /"run_worker_first": \["\/api\/contact", "\/api\/contact\/"\]/
);
assert.doesNotMatch(wrangler, /run_worker_first"\s*:\s*true/);

const worker = readFileSync(join(root, "src/worker.js"), "utf8");
assert.match(worker, /isContactPath/);
assert.doesNotMatch(worker, /header\.js|site-header/);

const contactPage = readFileSync(join(root, "contact/index.html"), "utf8");
assert.match(contactPage, /action="\/api\/contact"/);
const siteJs = readFileSync(join(root, "site.js"), "utf8");
assert.match(siteJs, /fetch\("\/api\/contact"/);
assert.match(siteJs, /\.nav-disclosure/);

function decodePng(buf) {
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idats = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  assert.equal(bitDepth, 8, "png bit depth");
  assert.equal(interlace, 0, "png should not be interlaced");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  assert.ok(channels, "png color type " + colorType);
  const raw = inflateSync(Buffer.concat(idats));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const rowStart = y * stride;
    const prevStart = rowStart - stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? pixels[rowStart + i - channels] : 0;
      const up = y > 0 ? pixels[prevStart + i] : 0;
      const upLeft = y > 0 && i >= channels ? pixels[prevStart + i - channels] : 0;
      const value = raw[src++];
      let decoded = value;
      if (filter === 1) decoded = value + left;
      else if (filter === 2) decoded = value + up;
      else if (filter === 3) decoded = value + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const paeth = left + up - upLeft;
        const pa = Math.abs(paeth - left);
        const pb = Math.abs(paeth - up);
        const pc = Math.abs(paeth - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        decoded = value + predictor;
      } else if (filter !== 0) {
        throw new Error("unsupported png filter " + filter);
      }
      pixels[rowStart + i] = decoded & 255;
    }
  }
  return { width, height, colorType, channels, pixels };
}

function pngPixel(png, x, y) {
  const i = (y * png.width + x) * png.channels;
  return [...png.pixels.subarray(i, i + png.channels)];
}

function assertTransparentMark(png, label) {
  assert.equal(png.colorType, 6, `${label} should be RGBA so the tab is not a filled square`);
  for (const [x, y] of [
    [0, 0],
    [png.width - 1, 0],
    [0, png.height - 1],
    [png.width - 1, png.height - 1],
  ]) {
    const pixel = pngPixel(png, x, y);
    assert.equal(pixel[3], 0, `${label} corner ${x},${y} should be transparent, got ${pixel}`);
  }
  const center = pngPixel(png, Math.floor(png.width / 2), Math.floor(png.height / 2));
  assert.equal(center[3], 255, `${label} center should be opaque artwork`);
  assert.ok(center[0] + center[1] + center[2] > 40, `${label} center should not be a black fill`);
  let transparent = 0;
  let opaqueBlack = 0;
  const count = png.width * png.height;
  for (let i = 0; i < png.pixels.length; i += png.channels) {
    const r = png.pixels[i];
    const g = png.pixels[i + 1];
    const b = png.pixels[i + 2];
    const a = png.pixels[i + 3];
    if (a === 0) transparent += 1;
    if (a > 200 && r < 12 && g < 12 && b < 12) opaqueBlack += 1;
  }
  assert.ok(transparent / count > 0.08, `${label} should keep the area outside the circle clear`);
  assert.equal(opaqueBlack, 0, `${label} should not bake in an opaque black background`);
}

const faviconPng = decodePng(readFileSync(join(root, "images/favicon.png")));
assert.equal(faviconPng.width, 192);
assert.equal(faviconPng.height, 192);
assertTransparentMark(faviconPng, "favicon.png");

const apple = decodePng(readFileSync(join(root, "images/apple-touch-icon.png")));
assert.equal(apple.width, 180);
assert.equal(apple.height, 180);
assert.equal(apple.colorType, 2, "apple touch icon stays opaque; iOS paints transparency black");
const appleCorner = pngPixel(apple, 0, 0);
assert.ok(appleCorner[0] > 240 && appleCorner[1] > 240 && appleCorner[2] > 240, "apple touch corner should be white, not a black square");
const appleCenter = pngPixel(apple, 90, 90);
assert.ok(appleCenter[0] + appleCenter[1] + appleCenter[2] > 40, "apple touch icon should contain the lake mark");

const ico = readFileSync(join(root, "images/favicon.ico"));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
const icoCount = ico.readUInt16LE(4);
assert.ok(icoCount >= 3, "favicon.ico should include multiple sizes");
const icoSizes = [];
for (let i = 0; i < icoCount; i++) {
  const entry = 6 + i * 16;
  const width = ico[entry] || 256;
  const height = ico[entry + 1] || 256;
  const bitCount = ico.readUInt16LE(entry + 6);
  const size = ico.readUInt32LE(entry + 8);
  const imageOffset = ico.readUInt32LE(entry + 12);
  assert.equal(bitCount, 32, `favicon.ico ${width}px should carry an alpha channel`);
  const frame = decodePng(ico.subarray(imageOffset, imageOffset + size));
  assert.equal(frame.width, width);
  assert.equal(frame.height, height);
  assertTransparentMark(frame, `favicon.ico ${width}px`);
  icoSizes.push(width);
}
for (const size of [16, 32, 48]) {
  assert.ok(icoSizes.includes(size), `favicon.ico missing ${size}px`);
}

console.log("header tests passed");
