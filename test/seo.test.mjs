import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://waltondunelakes.com";

const pages = [
  ["index.html", `${ORIGIN}/`],
  ["lakes/index.html", `${ORIGIN}/lakes/`],
  ["lakes/fuller/index.html", `${ORIGIN}/lakes/fuller/`],
  ["lakes/morris/index.html", `${ORIGIN}/lakes/morris/`],
  ["lakes/campbell/index.html", `${ORIGIN}/lakes/campbell/`],
  ["lakes/stallworth/index.html", `${ORIGIN}/lakes/stallworth/`],
  ["lakes/allen/index.html", `${ORIGIN}/lakes/allen/`],
  ["lakes/oyster/index.html", `${ORIGIN}/lakes/oyster/`],
  ["lakes/draper/index.html", `${ORIGIN}/lakes/draper/`],
  ["lakes/big-redfish/index.html", `${ORIGIN}/lakes/big-redfish/`],
  ["lakes/little-redfish/index.html", `${ORIGIN}/lakes/little-redfish/`],
  ["lakes/alligator/index.html", `${ORIGIN}/lakes/alligator/`],
  ["lakes/western/index.html", `${ORIGIN}/lakes/western/`],
  ["lakes/eastern/index.html", `${ORIGIN}/lakes/eastern/`],
  ["lakes/deer/index.html", `${ORIGIN}/lakes/deer/`],
  ["lakes/camp-creek/index.html", `${ORIGIN}/lakes/camp-creek/`],
  ["lakes/powell/index.html", `${ORIGIN}/lakes/powell/`],
  ["the-data/index.html", `${ORIGIN}/the-data/`],
  ["contact/index.html", `${ORIGIN}/contact/`],
];

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function attr(html, pattern) {
  const match = html.match(pattern);
  assert.ok(match, pattern.toString());
  return match[1]
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}

function jsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n  <\/script>/);
  assert.ok(match, "json-ld missing");
  return JSON.parse(match[1]);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const titles = new Set();
const descriptions = new Set();

for (const [file, url] of pages) {
  const html = read(file);
  const title = attr(html, /<title>([^<]+)<\/title>/);
  const description = attr(html, /<meta name="description" content="([^"]*)">/);
  assert.equal(titles.has(title), false, "duplicate title " + title);
  assert.equal(descriptions.has(description), false, "duplicate description " + description);
  titles.add(title);
  descriptions.add(description);
  assert.ok(title.length <= 70, file + " title length " + title.length);
  assert.ok(description.length >= 110 && description.length <= 165, file + " description length " + description.length);
  assert.match(description, /Walton County/);
  assert.match(description, /coastal dune lake/i);
  assert.equal(attr(html, /<link rel="canonical" href="([^"]+)">/), url);
  assert.equal(attr(html, /<meta property="og:title" content="([^"]*)">/), title);
  assert.equal(attr(html, /<meta property="og:description" content="([^"]*)">/), description);
  assert.equal(attr(html, /<meta property="og:url" content="([^"]+)">/), url);
  const image = attr(html, /<meta property="og:image" content="([^"]+)">/);
  assert.match(image, /^https:\/\/waltondunelakes\.com\/images\//);
  assert.equal(attr(html, /<meta property="og:type" content="([^"]+)">/), "website");
  assert.equal(attr(html, /<meta name="twitter:card" content="([^"]+)">/), "summary_large_image");
  assert.equal(attr(html, /<meta name="twitter:image" content="([^"]+)">/), image);
  assert.ok(attr(html, /<meta property="og:image:alt" content="([^"]*)">/).length > 10);
  const data = jsonLd(html);
  assert.equal(data["@context"], "https://schema.org");
  const h1s = html.match(/<h1[\s>]/g) || [];
  assert.equal(h1s.length, 1, file + " h1 count");
}

const home = jsonLd(read("index.html"));
const homeTypes = home["@graph"].map((node) => node["@type"]);
assert.deepEqual(homeTypes, ["Organization", "WebSite", "FAQPage"]);
const questions = [...read("index.html").matchAll(/<span class="faq-question">([\s\S]*?)<\/span>/g)].map((m) => m[1].trim());
const answers = [...read("index.html").matchAll(/<div class="faq-answer">\s*<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].trim());
const faq = home["@graph"].find((node) => node["@type"] === "FAQPage");
assert.equal(faq.mainEntity.length, questions.length);
assert.ok(questions.length >= 14);
faq.mainEntity.forEach((item, index) => {
  assert.equal(item.name, questions[index]);
  assert.equal(item.acceptedAnswer.text, answers[index]);
});

const fuller = jsonLd(read("lakes/fuller/index.html"));
const fullerLake = fuller["@graph"].find((node) => node["@type"] === "Lake");
assert.equal(fullerLake.geo.latitude, 30.37347);
assert.equal(fullerLake.geo.longitude, -86.31747);
assert.match(read("lakes/fuller/index.html"), /30\.37347 N, 86\.31747 W/);

for (const [file] of pages) {
  if (!file.startsWith("lakes/") || file === "lakes/index.html") continue;
  const data = jsonLd(read(file));
  assert.equal(data["@graph"].some((node) => node["@type"] === "Lake"), true, file);
  assert.equal(data["@graph"].some((node) => node["@type"] === "BreadcrumbList"), true, file);
}

const lakesPage = jsonLd(read("lakes/index.html"));
const list = lakesPage["@graph"].find((node) => node["@type"] === "ItemList");
assert.equal(list.numberOfItems, 15);
assert.equal(list.itemListElement[0].url, `${ORIGIN}/lakes/fuller/`);
assert.equal(list.itemListElement[14].url, `${ORIGIN}/lakes/powell/`);

const contact = jsonLd(read("contact/index.html"));
assert.equal(contact["@type"], "ContactPage");

const dataPage = read("the-data/index.html");
assert.equal(jsonLd(dataPage)["@type"], "WebPage");
assert.match(dataPage, /<h1>THE DATA<\/h1>/);
assert.match(dataPage, /Kayla Wingard, CBAEP/);
assert.match(dataPage, /Hyman 2026 Coastal Dune Lake 2025 Water Chemistry Report/);
assert.match(dataPage, /https:\/\/basinalliance-wq-dashboard\.share\.connect\.posit\.cloud\//);
assert.match(dataPage, /https:\/\/www\.basinalliance\.org\//);
assert.match(dataPage, /Credit: Choctawhatchee Basin Alliance \(CBAEP\)/);
assert.match(dataPage, /for public education only/);
assert.equal(dataPage.includes("—"), false);
assert.equal((dataPage.match(/<h1[\s>]/g) || []).length, 1);

const robots = read("robots.txt");
assert.match(robots, /User-agent: \*\nAllow: \/\n/);
assert.match(robots, /Sitemap: https:\/\/waltondunelakes\.com\/sitemap\.xml/);
assert.equal(/^\s*Disallow\s*:/m.test(robots), false);
assert.match(robots, /# llms\.txt: https:\/\/waltondunelakes\.com\/llms\.txt/);
assert.match(robots, /# llms-full\.txt: https:\/\/waltondunelakes\.com\/llms-full\.txt/);

const crawlers = [
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "ClaudeBot",
  "anthropic-ai",
  "PerplexityBot",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "meta-externalagent",
  "FacebookBot",
];
for (const agent of crawlers) {
  assert.match(robots, new RegExp(`User-agent: ${agent}\\nAllow: /\\n`), agent);
}

const sitemap = read("sitemap.xml");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert.deepEqual(locs, pages.map(([, url]) => url));

const ignore = read(".assetsignore");
assert.equal(ignore.includes("robots.txt"), false);
assert.equal(ignore.includes("sitemap.xml"), false);
assert.equal(ignore.includes("llms.txt"), false);
assert.equal(ignore.includes("llms-full.txt"), false);

const llms = read("llms.txt");
const llmsFull = read("llms-full.txt");
assert.ok(llmsFull.length > llms.length);
const publicUrls = [...pages.map(([, url]) => url), `${ORIGIN}/#about`, `${ORIGIN}/#explore`];
for (const body of [llms, llmsFull]) {
  assert.equal(body.includes("<"), false, "llms file should be plain text");
  assert.equal(/get-involved|\/impact\/|\/membership\//.test(body), false);
  for (const url of publicUrls) {
    assert.ok(body.includes(url), "missing " + url);
  }
  assert.ok(body.includes(`${ORIGIN}/sitemap.xml`));
}
assert.ok(llms.includes(`${ORIGIN}/llms-full.txt`));
assert.ok(llmsFull.includes(`${ORIGIN}/llms.txt`));
const headers = read("_headers");
assert.match(headers, /\/llms\.txt\n {2}Content-Type: text\/plain; charset=utf-8/);
assert.match(headers, /\/llms-full\.txt\n {2}Content-Type: text\/plain; charset=utf-8/);
const wrangler = read("wrangler.jsonc");
assert.match(wrangler, /"directory": "\."/);
assert.equal(wrangler.includes("sitemap"), false);

for (const file of ["get-involved/index.html", "impact/index.html", "membership/index.html"]) {
  const html = read(file);
  assert.match(html, /noindex/);
  assert.match(html, /rel="canonical" href="https:\/\/waltondunelakes\.com\/"/);
  assert.equal(locs.includes(`${ORIGIN}/get-involved/`), false);
}

const homeHtml = read("index.html");
assert.equal(homeHtml.includes("more details.</a>"), false);
assert.match(homeHtml, /href="lakes\/"/);
for (const slug of ["fuller", "morris", "campbell", "stallworth", "allen", "oyster", "draper", "big-redfish", "little-redfish", "alligator", "western", "eastern", "deer", "camp-creek", "powell"]) {
  assert.match(homeHtml, new RegExp(`href="lakes/${slug}/"`));
  assert.match(read("lakes/index.html"), new RegExp(`href="${slug}/"`));
  const lakeHtml = read(`lakes/${slug}/index.html`);
  assert.match(lakeHtml, /href="\.\.\/\.\.\/"/);
  assert.match(lakeHtml, /href="\.\.\/"/);
}

for (const path of walk(root)) {
  if (!path.endsWith(".html") && !path.endsWith(".js")) continue;
  const html = readFileSync(path, "utf8");
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = match[0];
    const alt = tag.match(/\salt="([^"]*)"/);
    assert.ok(alt, "missing alt " + path + " " + tag.slice(0, 80));
    assert.ok(alt[1].trim().length > 0, "empty alt " + path);
  }
}
