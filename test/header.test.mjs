import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
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
      ["./lakes/", "The lakes", ""],
      ["./#about", "Understanding Coastal Dune Lakes", ""],
      ["./contact/", "Contact", ""],
    ],
  },
  {
    pathname: "/index.html",
    src: "header.js",
    brand: "./",
    links: [
      ["./lakes/", "The lakes", ""],
      ["./#about", "Understanding Coastal Dune Lakes", ""],
      ["./contact/", "Contact", ""],
    ],
  },
  {
    pathname: "/contact/",
    src: "../header.js",
    brand: "../",
    links: [
      ["../lakes/", "The lakes", ""],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["./", "Contact", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/contact/index.html",
    src: "../header.js",
    brand: "../",
    links: [
      ["../lakes/", "The lakes", ""],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["./", "Contact", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/lakes/",
    src: "../header.js",
    brand: "../",
    links: [
      ["./", "The lakes", ' aria-current="page"'],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["../contact/", "Contact", ""],
    ],
  },
  {
    pathname: "/lakes/index.html",
    src: "../header.js",
    brand: "../",
    links: [
      ["./", "The lakes", ' aria-current="page"'],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["../contact/", "Contact", ""],
    ],
  },
  {
    pathname: "/lakes/western/",
    src: "../../header.js",
    brand: "../../",
    links: [
      ["../", "The lakes", ""],
      ["../../#about", "Understanding Coastal Dune Lakes", ""],
      ["../../contact/", "Contact", ""],
    ],
  },
  {
    pathname: "/lakes/western/index.html",
    src: "../../header.js",
    brand: "../../",
    links: [
      ["../", "The lakes", ""],
      ["../../#about", "Understanding Coastal Dune Lakes", ""],
      ["../../contact/", "Contact", ""],
    ],
  },
  {
    pathname: "/lakes/camp-creek",
    src: "../../header.js",
    brand: "../../",
    links: [
      ["../", "The lakes", ""],
      ["../../#about", "Understanding Coastal Dune Lakes", ""],
      ["../../contact/", "Contact", ""],
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

assert.equal(pagesWithHeader.length, 18);

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

console.log("header tests passed");
