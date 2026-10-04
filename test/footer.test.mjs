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

function rootFromScriptSrc(scriptSrc) {
  let src = scriptSrc;
  let depth = 0;
  while (src.startsWith("../")) {
    depth += 1;
    src = src.slice(3);
  }
  return depth === 0 ? "./" : "../".repeat(depth);
}

function assertFooterIdentity(html, scriptSrc) {
  assert.match(html, /<h2>Coastal Dune Lakes of Walton County<\/h2>/);
  assert.match(html, /Not affiliated with Walton County, Florida DEP, or Choctawhatchee Basin Alliance\./);
  assert.doesNotMatch(html, /scenicwalton|footer-partners|partners-heading|>Resources</);

  const friends = html.match(/<div class="footer-friends">[\s\S]*?<\/div>/);
  assert.ok(friends, "footer friends block missing");
  const logoSrc = rootFromScriptSrc(scriptSrc) + "images/partners/friends-of-scenic-30a.png";
  assert.match(
    friends[0],
    /<p>Please be sure to check out<\/p>\s*<a href="https:\/\/friendsofscenic30a\.org\/">\s*<img src="([^"]+)" width="1000" height="320" alt="Friends of Scenic 30A">\s*<\/a>/
  );
  const src = friends[0].match(/src="([^"]+)"/)[1];
  assert.equal(src, logoSrc);
  assert.ok(
    html.indexOf('class="footer-friends"') < html.indexOf('class="footer-nav"'),
    "friends mark should sit in the left column"
  );

  const sponsorSrc = rootFromScriptSrc(scriptSrc) + "images/sponsors/eating-on-30a-eating-in-destin.webp";
  assert.match(html, /<p>Sponsored by<\/p>/);
  assert.match(
    html,
    new RegExp(
      `<img src="${sponsorSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" width="1120" height="672" alt="Eating on 30A and Eating in Destin" loading="lazy">`
    )
  );
  assert.match(
    html,
    /<a class="footer-sponsor-link footer-sponsor-30a" href="https:\/\/www\.eatingon30a\.com\/" target="_blank" rel="noopener noreferrer">\s*<span class="visually-hidden">Eating on 30A \(opens in a new tab\)<\/span>\s*<\/a>/
  );
  assert.match(
    html,
    /<a class="footer-sponsor-link footer-sponsor-destin" href="https:\/\/www\.eatingindestin\.com\/" target="_blank" rel="noopener noreferrer">\s*<span class="visually-hidden">Eating in Destin \(opens in a new tab\)<\/span>\s*<\/a>/
  );
  assert.ok(
    html.indexOf('class="footer-friends"') < html.indexOf('class="footer-sponsor"'),
    "sponsor ad should sit to the right of the friends mark"
  );
  assert.ok(
    html.indexOf('class="footer-sponsor"') < html.indexOf('class="footer-nav"'),
    "sponsor ad should stay in the left footer column"
  );
  assert.equal(html.includes("—"), false);
  assert.equal(html.includes("–"), false);
}

const cases = [
  {
    pathname: "/",
    src: "footer.js",
    links: [
      ["./", "HOME", ""],
      ["./lakes/", "THE LAKES", ""],
      ["./#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./the-data/", "THE DATA", ""],
      ["./contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/index.html",
    src: "footer.js",
    links: [
      ["./", "HOME", ""],
      ["./lakes/", "THE LAKES", ""],
      ["./#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./the-data/", "THE DATA", ""],
      ["./contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/contact/",
    src: "../footer.js",
    links: [
      ["../", "HOME", ""],
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["./", "CONTACT US", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/contact/index.html",
    src: "../footer.js",
    links: [
      ["../", "HOME", ""],
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["./", "CONTACT US", ' aria-current="page"'],
    ],
  },
  {
    pathname: "/lakes/",
    src: "../footer.js",
    links: [
      ["../", "HOME", ""],
      ["./", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["../contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/lakes/index.html",
    src: "../footer.js",
    links: [
      ["../", "HOME", ""],
      ["./", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../the-data/", "THE DATA", ""],
      ["../contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/lakes/western/",
    src: "../../footer.js",
    links: [
      ["../../", "HOME", ""],
      ["../", "THE LAKES", ""],
      ["../../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../../the-data/", "THE DATA", ""],
      ["../../contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/lakes/western/index.html",
    src: "../../footer.js",
    links: [
      ["../../", "HOME", ""],
      ["../", "THE LAKES", ""],
      ["../../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../../the-data/", "THE DATA", ""],
      ["../../contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/lakes/camp-creek",
    src: "../../footer.js",
    links: [
      ["../../", "HOME", ""],
      ["../", "THE LAKES", ""],
      ["../../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["../../the-data/", "THE DATA", ""],
      ["../../contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/the-data/",
    src: "../footer.js",
    links: [
      ["../", "HOME", ""],
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./", "THE DATA", ' aria-current="page"'],
      ["../contact/", "CONTACT US", ""],
    ],
  },
  {
    pathname: "/the-data/index.html",
    src: "../footer.js",
    links: [
      ["../", "HOME", ""],
      ["../lakes/", "THE LAKES", ""],
      ["../#about", "UNDERSTANDING DUNE LAKES", ""],
      ["./", "THE DATA", ' aria-current="page"'],
      ["../contact/", "CONTACT US", ""],
    ],
  },
];

for (const item of cases) {
  const html = renderFooter(item.pathname, item.src);
  assert.equal(html.match(/<footer/g).length, 1, item.pathname);
  assertFooterIdentity(html, item.src);
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
  if (rel === "index.html") {
    assert.match(html, /class="partner-strip"/);
    assert.match(html, /aria-label="Partners"/);
    assert.doesNotMatch(html, /Watched in Partnership/);
    assert.doesNotMatch(html, /These organizations monitor, study, or care/);
    assert.doesNotMatch(html, /class="partner-name"/);
    assert.match(html, /images\/partners\/choctawhatchee-basin-alliance\.png"/);
    assert.match(html, /alt="Choctawhatchee Basin Alliance"/);
    assert.match(html, /https:\/\/www\.basinalliance\.org\//);
    assert.match(html, /https:\/\/basinalliance-wq-dashboard\.share\.connect\.posit\.cloud\//);
    assert.match(html, /images\/partners\/visit-south-walton\.svg"/);
    assert.match(html, /alt="Visit South Walton"/);
    assert.match(html, /https:\/\/www\.visitsouthwalton\.com\//);
    assert.match(html, /images\/partners\/friends-of-scenic-30a\.png"/);
    assert.match(html, /alt="Friends of Scenic 30A"/);
    assert.match(html, /https:\/\/www\.friendsofscenic30a\.org\//);
    assert.match(html, /images\/partners\/scenic-walton\.png"/);
    assert.match(html, /alt="Scenic Walton"/);
    assert.match(html, /https:\/\/www\.scenic\.org\/scenic-walton\//);
    assert.match(html, /images\/partners\/walton-county\.png"/);
    assert.match(html, /alt="Walton County"/);
    assert.match(html, /https:\/\/www\.mywaltonfl\.gov\/97\/Coastal-Dune-Lakes/);
    assert.match(html, /images\/partners\/uf-ifas\.png"/);
    assert.match(html, /alt="UF\/IFAS Florida LAKEWATCH"/);
    assert.match(html, /https:\/\/lakewatch\.ifas\.ufl\.edu\//);
    assert.equal(html.includes("—"), false);
    assert.equal(html.includes("–"), false);
  } else {
    assert.doesNotMatch(html, /friendsofscenic30a|scenicwalton|partner-strip|images\/partners\//, `${rel} should not repeat partner logos`);
  }

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

assert.equal(pagesWithFooter.length, 19);

const sponsorAd = join(root, "images/sponsors/eating-on-30a-eating-in-destin.webp");
const sponsorBytes = statSync(sponsorAd).size;
assert.ok(sponsorBytes < 200 * 1024, `sponsor ad should stay under 200KB, got ${sponsorBytes}`);
assert.ok(sponsorBytes > 40 * 1024, `sponsor ad looks too small to be the real artwork, got ${sponsorBytes}`);

assert.match(wrangler, /"main": "src\/worker\.js"/);
assert.match(wrangler, /"directory": "\."/);
assert.match(
  wrangler,
  /"run_worker_first": \["\/api\/contact", "\/api\/contact\/", "\/api\/favorite", "\/api\/favorite\/"\]/
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
