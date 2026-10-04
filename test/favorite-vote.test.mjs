import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import worker from "../src/worker.js";
import { LAKES, handleFavorite } from "../src/favorite.js";

const root = fileURLToPath(new URL("..", import.meta.url));

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function memoryKv() {
  const store = new Map();
  return {
    async get(key, options) {
      if (!store.has(key)) return null;
      const value = store.get(key);
      const type = typeof options === "string" ? options : options && options.type;
      if (type === "json") return JSON.parse(value);
      return value;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
  };
}

function request(method, body, { ip = "203.0.113.10", origin, path = "/api/favorite" } = {}) {
  const headers = { "cf-connecting-ip": ip };
  if (origin) headers.origin = origin;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`https://waltondunelakes.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function call(method, body, options, env) {
  const response = await handleFavorite(request(method, body, options), env);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, json, text };
}

let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log("ok", name);
  } catch (error) {
    console.error("FAIL", name);
    console.error(error);
    process.exitCode = 1;
  }
}

await check("lists the 15 lakes west to east", async () => {
  assert.deepEqual(
    LAKES.map((lake) => lake.slug),
    [
      "fuller",
      "morris",
      "campbell",
      "stallworth",
      "allen",
      "oyster",
      "draper",
      "big-redfish",
      "little-redfish",
      "alligator",
      "western",
      "eastern",
      "deer",
      "camp-creek",
      "powell",
    ],
  );
  assert.equal(LAKES[0].name, "Fuller Lake");
  assert.equal(LAKES[14].name, "Lake Powell");
  assert.equal(LAKES.find((lake) => lake.slug === "camp-creek").name, "Camp Creek Lake");
});

await check("returns 503 when FAVORITE_VOTES is missing and does not invent counts", async () => {
  const get = await call("GET", undefined, { ip: "203.0.113.20" }, {});
  assert.equal(get.response.status, 503);
  assert.equal(get.json.ok, false);
  assert.equal(get.text.includes("votes so far"), false);
  assert.equal(Object.hasOwn(get.json, "counts"), false);
  const post = await call("POST", { lake: "western" }, { ip: "203.0.113.21" }, {});
  assert.equal(post.response.status, 503);
  assert.equal(post.json.error, "Voting is not available yet.");
});

await check("starts at zero, then keeps one shared tally", async () => {
  const env = { FAVORITE_VOTES: memoryKv() };
  const first = await call("GET", undefined, { ip: "203.0.113.30" }, env);
  assert.equal(first.response.status, 200);
  assert.equal(first.response.headers.get("cache-control"), "no-store");
  assert.equal(first.json.ok, true);
  assert.equal(first.json.total, 0);
  assert.equal(Object.keys(first.json.counts).length, 15);
  for (const lake of LAKES) assert.equal(first.json.counts[lake.slug], 0);

  const voted = await call("POST", { lake: "western" }, { ip: "203.0.113.31" }, env);
  assert.equal(voted.response.status, 200);
  assert.equal(voted.json.lake, "western");
  assert.equal(voted.json.total, 1);
  assert.equal(voted.json.counts.western, 1);
  assert.equal(voted.json.counts.fuller, 0);

  const again = await call("POST", { lake: "fuller" }, { ip: "203.0.113.32" }, env);
  assert.equal(again.json.total, 2);
  assert.equal(again.json.counts.fuller, 1);
  assert.equal(again.json.counts.western, 1);

  const shared = await call("GET", undefined, { ip: "203.0.113.33" }, env);
  assert.equal(shared.json.total, 2);
  assert.equal(shared.json.counts.western, 1);
});

await check("rejects an unknown lake without writing", async () => {
  const env = { FAVORITE_VOTES: memoryKv() };
  const bad = await call("POST", { lake: "gulf" }, { ip: "203.0.113.40" }, env);
  assert.equal(bad.response.status, 400);
  assert.equal(bad.json.error, "Pick a lake from the list.");
  const empty = await call("GET", undefined, { ip: "203.0.113.41" }, env);
  assert.equal(empty.json.total, 0);
  const junk = await call("POST", "not-json", { ip: "203.0.113.42" }, env);
  assert.equal(junk.response.status, 400);
  const huge = await call("POST", "x".repeat(2001), { ip: "203.0.113.43" }, env);
  assert.equal(huge.response.status, 413);
});

await check("ignores a mismatched origin and a disallowed method", async () => {
  const env = { FAVORITE_VOTES: memoryKv() };
  const cross = await call(
    "POST",
    { lake: "deer" },
    { ip: "203.0.113.50", origin: "https://example.com" },
    env,
  );
  assert.equal(cross.response.status, 403);
  const after = await call("GET", undefined, { ip: "203.0.113.51" }, env);
  assert.equal(after.json.total, 0);
  const put = await call("PUT", { lake: "deer" }, { ip: "203.0.113.52" }, env);
  assert.equal(put.response.status, 405);
});

await check("normalizes stored counts and keeps parallel votes", async () => {
  const kv = memoryKv();
  await kv.put("tally", JSON.stringify({ counts: { western: "2", nope: 9, fuller: -3 } }));
  const env = { FAVORITE_VOTES: kv };
  const seeded = await call("GET", undefined, { ip: "203.0.113.60" }, env);
  assert.equal(seeded.json.counts.western, 2);
  assert.equal(seeded.json.counts.fuller, 0);
  assert.equal(seeded.json.total, 2);
  assert.equal(Object.hasOwn(seeded.json.counts, "nope"), false);

  const posts = [];
  for (let i = 0; i < 8; i += 1) {
    posts.push(call("POST", { lake: "oyster" }, { ip: `203.0.113.${70 + i}` }, env));
  }
  const saved = await Promise.all(posts);
  assert.equal(saved.every((item) => item.response.status === 200), true);
  const done = await call("GET", undefined, { ip: "203.0.113.90" }, env);
  assert.equal(done.json.counts.oyster, 8);
  assert.equal(done.json.counts.western, 2);
  assert.equal(done.json.total, 10);
});

await check("limits a burst from one address", async () => {
  const env = { FAVORITE_VOTES: memoryKv() };
  const statuses = [];
  for (let i = 0; i < 11; i += 1) {
    const result = await call("POST", { lake: "allen" }, { ip: "203.0.113.100" }, env);
    statuses.push(result.response.status);
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
  assert.equal(statuses[10], 429);
  const tally = await call("GET", undefined, { ip: "203.0.113.101" }, env);
  assert.equal(tally.json.counts.allen, 10);
});

await check("routes /api/favorite through the Worker", async () => {
  const seen = [];
  const env = {
    FAVORITE_VOTES: memoryKv(),
    ASSETS: {
      fetch(assetRequest) {
        seen.push(new URL(assetRequest.url).pathname);
        return new Response("static", { status: 200 });
      },
    },
  };
  const posted = await worker.fetch(
    request("POST", { lake: "powell" }, { ip: "203.0.113.110", path: "/api/favorite/" }),
    env,
  );
  const body = await posted.json();
  assert.equal(posted.status, 200);
  assert.equal(body.counts.powell, 1);
  assert.deepEqual(seen, []);

  const page = await worker.fetch(new Request("https://waltondunelakes.com/lakes/"), env);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "static");
  assert.deepEqual(seen, ["/lakes/"]);
});

const lakesPage = read("lakes/index.html");
const home = read("index.html");
const css = read("styles.css");
const siteJs = read("site.js");
const readme = read("README.md");
const wrangler = read("wrangler.jsonc");

await check("places the ballot on the lakes page before the map", async () => {
  const start = lakesPage.indexOf('id="favorite-lake"');
  const end = lakesPage.indexOf('class="section-head"');
  const block = lakesPage.slice(start, end);
  assert.ok(start > -1 && start < lakesPage.indexOf('class="map-frame"'));
  assert.ok(start < lakesPage.indexOf('class="lake-grid"'));
  assert.match(block, /<h2 id="favorite-heading">Which lake is your favorite\?<\/h2>/);
  assert.match(block, /Pick one\. Results appear after you vote\./);
  const slugs = [...block.matchAll(/data-vote="([^"]+)"/g)].map((match) => match[1]);
  const names = [...block.matchAll(/data-vote="[^"]+">([^<]+)<\/button>/g)].map((match) => match[1]);
  assert.deepEqual(slugs, LAKES.map((lake) => lake.slug));
  assert.deepEqual(names, LAKES.map((lake) => lake.name));
  assert.equal(block.includes("votes so far"), false);
  assert.equal(/\d/.test(names.join(" ")), false);
  assert.equal(/heart|❤|♥/i.test(block), false);
  assert.equal(block.includes("—"), false);
  assert.equal(block.includes("–"), false);
  assert.match(block, /<button type="button"/);
  assert.equal((lakesPage.match(/data-vote="/g) || []).length, 15);
});

await check("keeps the home hero photo and avatar, with a short teaser in the text", async () => {
  const avatarAt = home.indexOf('class="hero-avatar"');
  const copyAt = home.indexOf('class="hero-copy"');
  const teaserAt = home.indexOf('class="hero-vote"');
  assert.ok(avatarAt > -1 && avatarAt < copyAt && copyAt < teaserAt);
  assert.equal(home.slice(avatarAt, copyAt).includes("hero-vote"), false);
  assert.equal(home.slice(avatarAt, copyAt).includes("favorite"), false);
  assert.match(
    home,
    /<img src="images\/topsail-beach\.jpg" alt="Gulf beach and primary dunes at Topsail Hill Preserve State Park" style="object-position: center 62%"/,
  );
  assert.match(home, /<source src="videos\/dune-lakes-aerial-hero\.mp4" type="video\/mp4">/);
  assert.match(home, /<p class="hero-vote"><a href="lakes\/#favorite-lake">Vote for your favorite dune lake<\/a><\/p>/);
  assert.equal(home.includes("data-vote"), false);
  assert.equal(home.includes("Which lake is your favorite?"), false);
  assert.equal(home.includes("—"), false);
  assert.equal(home.includes("–"), false);
  const voteCss = css.slice(css.indexOf(".hero-vote {"), css.indexOf(".actions {"));
  assert.match(voteCss, /\.hero-vote \{/);
  assert.equal(/position\s*:/.test(voteCss), false);
  assert.equal(voteCss.includes("hero-avatar"), false);
  assert.match(css, /\.hero-avatar \{\s*position: relative;/);
  assert.match(css, /width: clamp\(8\.75rem, 16vw, 12\.5rem\)/);
  assert.match(css, /\.hero-avatar \{ width: min\(8\.5rem, 42vw\); \}/);
});

await check("documents the FAVORITE_VOTES binding and does not enable the Worker for every page", async () => {
  assert.match(wrangler, /"\/api\/favorite"/);
  assert.match(wrangler, /"\/api\/favorite\/"/);
  assert.doesNotMatch(wrangler, /"run_worker_first"\s*:\s*true/);
  assert.match(wrangler, /FAVORITE_VOTES/);
  assert.match(wrangler, /PASTE_THE_NAMESPACE_ID/);
  assert.match(wrangler, /\/\/ "kv_namespaces":/);
  assert.doesNotMatch(wrangler, /^\s*"kv_namespaces"\s*:/m);
  assert.match(readme, /binding name must be exactly `FAVORITE_VOTES`/);
  assert.match(readme, /npx wrangler kv namespace create FAVORITE_VOTES/);
  assert.match(readme, /waltondunelakes-favorite-lake/);
  assert.equal(readme.includes("—"), false);
  assert.equal(readme.includes("–"), false);
  for (const lake of LAKES) {
    const page = read(`lakes/${lake.slug}/index.html`);
    assert.equal(page.includes("favorite-vote"), false, lake.slug);
    assert.equal(page.includes("data-vote"), false, lake.slug);
  }
});

function makeEl(tag) {
  const node = {
    tagName: tag,
    attrs: {},
    children: [],
    className: "",
    hidden: false,
    disabled: false,
    style: {},
    listeners: {},
    _text: "",
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren() {
      this.children = Array.prototype.slice.call(arguments);
    },
    focus() {
      this.focused = true;
    },
    querySelector(sel) {
      return this.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const out = [];
      for (const child of this.children) collect(child, sel, out);
      return out;
    },
  };
  Object.defineProperty(node, "textContent", {
    get() {
      const nested = this.children.map((child) => child.textContent || "").join("");
      return this._text + nested;
    },
    set(value) {
      this._text = String(value);
      this.children = [];
    },
  });
  return node;
}

function collect(node, sel, out) {
  if (matches(node, sel)) out.push(node);
  for (const child of node.children) collect(child, sel, out);
}

function matches(node, sel) {
  if (sel.startsWith(".")) return node.className.split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith("[") && sel.endsWith("]")) {
    return Object.prototype.hasOwnProperty.call(node.attrs, sel.slice(1, -1));
  }
  return false;
}

function mountVote({ stored = "", fetchImpl }) {
  const calls = [];
  const data = Object.create(null);
  if (stored) data["waltondunelakes-favorite-lake"] = stored;
  const localStorage = {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
  };
  const ballot = makeEl("div");
  ballot.className = "vote-ballot";
  for (const lake of LAKES) {
    const button = makeEl("button");
    button.className = "vote-chip";
    button.setAttribute("data-vote", lake.slug);
    button.textContent = lake.name;
    ballot.appendChild(button);
  }
  const lead = makeEl("p");
  lead.className = "favorite-vote-lead";
  const status = makeEl("p");
  status.className = "vote-status";
  const results = makeEl("ol");
  results.className = "vote-results";
  results.hidden = true;
  const favorite = makeEl("div");
  favorite.className = "favorite-vote";
  favorite.appendChild(lead);
  favorite.appendChild(ballot);
  favorite.appendChild(status);
  favorite.appendChild(results);

  const sandbox = {
    localStorage,
    fetch(url, init) {
      calls.push({ url, init });
      return Promise.resolve(fetchImpl(url, init));
    },
    document: {
      createElement: makeEl,
      querySelector(sel) {
        return sel === ".favorite-vote" ? favorite : null;
      },
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      },
      addEventListener() {},
    },
    window: { addEventListener() {} },
    console,
  };
  vm.runInNewContext(siteJs, sandbox);
  return { calls, data, ballot, status, results, lead, favorite };
}

function jsonResponse(payload, ok = true) {
  return {
    ok,
    json() {
      return Promise.resolve(payload);
    },
  };
}

await check("ranks ties west to east and phrases the total", async () => {
  const sandbox = {
    document: {
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      },
      addEventListener() {},
    },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(siteJs, sandbox);
  const ranked = sandbox.rankFavoriteLakes(
    [
      { slug: "fuller", name: "Fuller Lake" },
      { slug: "morris", name: "Morris Lake" },
      { slug: "oyster", name: "Oyster Lake" },
    ],
    { fuller: 2, morris: 2, oyster: 5 },
  );
  assert.deepEqual(ranked.map((lake) => lake.slug), ["oyster", "fuller", "morris"]);
  assert.equal(sandbox.favoriteVoteSummary(1, "Deer Lake"), "1 vote so far. You picked Deer Lake.");
  assert.equal(
    sandbox.favoriteVoteSummary(128, "Western Lake"),
    "128 votes so far. You picked Western Lake.",
  );
});

await check("shows only names until a vote, then the shared tally", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const view = mountVote({
    fetchImpl() {
      return gate.then(() => jsonResponse({
        ok: true,
        total: 4,
        counts: { western: 3, fuller: 1 },
      }));
    },
  });
  assert.equal(view.ballot.hidden, false);
  assert.equal(view.results.hidden, true);
  assert.equal(view.results.children.length, 0);
  assert.equal(view.calls.length, 0);
  assert.equal(view.lead.hidden, false);

  const western = view.ballot.querySelectorAll("[data-vote]")[10];
  assert.equal(western.getAttribute("data-vote"), "western");
  western.listeners.click();
  western.listeners.click();
  assert.equal(view.calls.length, 1);
  assert.equal(view.calls[0].url, "/api/favorite");
  assert.equal(view.calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(view.calls[0].init.body), { lake: "western" });
  assert.equal(view.data["waltondunelakes-favorite-lake"], undefined);
  release();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(view.data["waltondunelakes-favorite-lake"], "western");
  assert.equal(view.ballot.hidden, true);
  assert.equal(view.lead.hidden, true);
  assert.equal(view.results.hidden, false);
  assert.equal(view.results.children.length, 15);
  assert.equal(view.status.textContent, "4 votes so far. You picked Western Lake.");
  assert.equal(view.results.children[0].getAttribute("data-vote"), "western");
  assert.equal(view.results.children[0].className.includes("is-choice"), true);
  assert.equal(view.results.children[1].getAttribute("data-vote"), "fuller");
  assert.equal(view.results.children[2].getAttribute("data-vote"), "morris");
  assert.equal(view.results.children[0].querySelector(".vote-bar-fill").style.width, "100%");
  assert.equal(view.results.children[1].querySelector(".vote-bar-fill").style.width, "33.3%");
  assert.equal(view.results.children[2].querySelector(".vote-count").textContent, "0");
  assert.match(view.results.children[0].querySelector(".vote-name").textContent, /your vote/);
  assert.equal(view.status.focused, true);
});

await check("does not store a vote or show counts when the tally cannot be saved", async () => {
  const view = mountVote({
    fetchImpl() {
      return jsonResponse({ ok: false, error: "Voting is not available yet." }, false);
    },
  });
  view.ballot.querySelectorAll("[data-vote]")[0].listeners.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.ballot.hidden, false);
  assert.equal(view.results.hidden, true);
  assert.equal(view.results.children.length, 0);
  assert.equal(view.status.textContent, "Voting is not available yet.");
  assert.equal(view.data["waltondunelakes-favorite-lake"], undefined);
  assert.equal(view.ballot.querySelectorAll("[data-vote]")[0].disabled, false);
  assert.equal(view.status.textContent.includes("votes so far"), false);
});

await check("loads the tally for a browser that already voted", async () => {
  const view = mountVote({
    stored: "deer",
    fetchImpl(url, init) {
      assert.equal(url, "/api/favorite");
      assert.equal(init.method, undefined);
      return jsonResponse({ ok: true, total: 2, counts: { deer: 2 } });
    },
  });
  assert.equal(view.ballot.hidden, true);
  assert.equal(view.calls.length, 1);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.results.children[0].getAttribute("data-vote"), "deer");
  assert.equal(view.status.textContent, "2 votes so far. You picked Deer Lake.");
  assert.equal(view.calls.length, 1);
  assert.equal(view.status.focused, undefined);
});

await check("keeps a previous choice hidden when the tally cannot be loaded", async () => {
  const view = mountVote({
    stored: "powell",
    fetchImpl() {
      return jsonResponse({ ok: false, error: "Voting is not available yet." }, false);
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.ballot.hidden, true);
  assert.equal(view.results.hidden, true);
  assert.equal(view.results.children.length, 0);
  assert.equal(view.status.textContent, "You picked Lake Powell. The tally could not be loaded.");
  assert.equal(view.status.textContent.includes("0"), false);
});

if (process.exitCode) {
  console.error(`${passed} checks passed before a failure`);
} else {
  console.log(`${passed} checks passed`);
}
