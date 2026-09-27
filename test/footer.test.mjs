import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const footerJs = readFileSync(join(root, "footer.js"), "utf8");
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

function renderFooter(pathname, scriptSrc) {
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
  vm.runInNewContext(footerJs, {
    document: { currentScript: script },
    location: { pathname },
  });
  return html;
}

function navLinks(html) {
  const nav = html.match(/<nav class="footer-nav"[\s\S]*?<\/nav>/);
  assert.ok(nav, "footer nav missing");
  return [...nav[0].matchAll(/<a href="([^"]*)"([^>]*)>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1],
    attrs: match[2],
    text: match[3],
  }));
}

function assertResources(html) {
  assert.match(html, /<h2 id="partners-heading">Resources<\/h2>/);
  assert.match(
    html,
    /<a href="https:\/\/www\.friendsofscenic30a\.org\/" target="_blank" rel="noopener noreferrer">Friends of Scenic 30A<span class="visually-hidden"> \(opens in a new tab\)<\/span><\/a>/
  );
  assert.match(
    html,
    /<a href="https:\/\/www\.scenicwalton\.org\/" target="_blank" rel="noopener noreferrer">Scenic Walton<span class="visually-hidden"> \(opens in a new tab\)<\/span><\/a>/
  );
  assert.match(html, /Independent educational resource\./);
}

const cases = [
  {
    pathname: "/",
    src: "footer.js",
    links: [
      ["./", "Home", ""],
      ["./lakes/", "The lakes", ""],
      ["./#about", "Understanding Coastal Dune Lakes", ""],
      ["./contact/", "Contact Us", ""],
    ],
  },
  {
    pathname: "/index.html",
    src: "footer.js",
    links: [
      ["./", "Home", ""],
      ["./lakes/", "The lakes", ""],
      ["./#about", "Understanding Coastal Dune Lakes", ""],
      ["./contact/", "Contact Us", ""],
    ],
  },
  {
    pathname: "/contact/",
    src: "../footer.js",
    links: [
      ["../", "Home", ""],
      ["../lakes/", "The lakes", ""],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["./", "Contact Us", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/contact/index.html",
    src: "../footer.js",
    links: [
      ["../", "Home", ""],
      ["../lakes/", "The lakes", ""],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["./", "Contact Us", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/lakes/",
    src: "../footer.js",
    links: [
      ["../", "Home", ""],
      ["./", "The lakes", ""],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["../contact/", "Contact Us", ""],
    ],
  },
  {
    pathname: "/lakes/index.html",
    src: "../footer.js",
    links: [
      ["../", "Home", ""],
      ["./", "The lakes", ""],
      ["../#about", "Understanding Coastal Dune Lakes", ""],
      ["../contact/", "Contact Us", ""],
    ],
  },
  {
    pathname: "/lakes/western/",
    src: "../../footer.js",
    links: [
      ["../../", "Home", ""],
      ["../", "The lakes", ""],
      ["../../#about", "Understanding Coastal Dune Lakes", ""],
      ["../../contact/", "Contact Us", ""],
    ],
  },
  {
    pathname: "/lakes/western/index.html",
    src: "../../footer.js",
    links: [
      ["../../", "Home", ""],
      ["../", "The lakes", ""],
      ["../../#about", "Understanding Coastal Dune Lakes", ""],
      ["../../contact/", "Contact Us", ""],
    ],
  },
  {
    pathname: "/lakes/camp-creek",
    src: "../../footer.js",
    links: [
      ["../../", "Home", ""],
      ["../", "The lakes", ""],
      ["../../#about", "Understanding Coastal Dune Lakes", ""],
      ["../../contact/", "Contact Us", ""],
    ],
  },
];

for (const item of cases) {
  const html = renderFooter(item.pathname, item.src);
  assert.equal(html.match(/<footer/g).length, 1, item.pathname);
  assertResources(html);
  const links = navLinks(html);
  assert.deepEqual(
    links.map((link) => [link.href, link.text, link.attrs]),
    item.links,
    item.pathname
  );
}

const htmlFiles = walk(root).filter((path) => path.endsWith(".html"));
const redirectPages = new Set([
  "get-involved/index.html",
  "impact/index.html",
  "membership/index.html",
]);
const pagesWithFooter = [];

for (const path of htmlFiles) {
  const rel = relative(root, path);
  const html = readFileSync(path, "utf8");
  assert.doesNotMatch(html, /<footer\b/, `${rel} should not inline a footer`);
  assert.doesNotMatch(html, /friendsofscenic30a|scenicwalton/, `${rel} should not duplicate Resources links`);

  if (redirectPages.has(rel)) {
    assert.doesNotMatch(html, /footer\.js/, `${rel} is redirect-only`);
    continue;
  }

  const site = html.match(/<script src="([^"]*)site\.js"><\/script>/);
  const footer = html.match(/<script src="([^"]*)footer\.js"><\/script>/);
  assert.ok(site, `${rel} should load site.js`);
  assert.ok(footer, `${rel} should load footer.js`);
  assert.equal(footer[1], site[1], `${rel} footer.js depth should match site.js`);
  assert.ok(
    html.indexOf(footer[0]) < html.indexOf(site[0]),
    `${rel} should insert the footer before site.js`
  );
  pagesWithFooter.push(rel);
}

assert.equal(pagesWithFooter.length, 18);

assert.match(wrangler, /"main": "src\/worker\.js"/);
assert.match(wrangler, /"directory": "\."/);
assert.match(
  wrangler,
  /"run_worker_first": \["\/api\/contact", "\/api\/contact\/"\]/
);
assert.doesNotMatch(wrangler, /run_worker_first"\s*:\s*true/);

const worker = readFileSync(join(root, "src/worker.js"), "utf8");
assert.match(worker, /isContactPath/);
assert.doesNotMatch(worker, /footer/);

const contactPage = readFileSync(join(root, "contact/index.html"), "utf8");
assert.match(contactPage, /action="\/api\/contact"/);
const siteJs = readFileSync(join(root, "site.js"), "utf8");
assert.match(siteJs, /fetch\("\/api\/contact"/);

console.log("footer tests passed");
