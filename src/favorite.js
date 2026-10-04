// GET/POST /api/favorite
// Tallies live in a Cloudflare KV namespace bound as FAVORITE_VOTES.
// The Worker creates the "tally" key on the first vote. Until that binding
// exists, both methods return 503 and the page does not invent counts.
//
// One vote per browser is remembered in localStorage. This route still
// checks the lake slug, same-origin posts, and a short per-IP burst limit.

export const LAKES = [
  { slug: "fuller", name: "Fuller Lake" },
  { slug: "morris", name: "Morris Lake" },
  { slug: "campbell", name: "Campbell Lake" },
  { slug: "stallworth", name: "Stallworth Lake" },
  { slug: "allen", name: "Allen Lake" },
  { slug: "oyster", name: "Oyster Lake" },
  { slug: "draper", name: "Draper Lake" },
  { slug: "big-redfish", name: "Big Redfish Lake" },
  { slug: "little-redfish", name: "Little Redfish Lake" },
  { slug: "alligator", name: "Alligator Lake" },
  { slug: "western", name: "Western Lake" },
  { slug: "eastern", name: "Eastern Lake" },
  { slug: "deer", name: "Deer Lake" },
  { slug: "camp-creek", name: "Camp Creek Lake" },
  { slug: "powell", name: "Lake Powell" },
];

const TALLY_KEY = "tally";
const MAX_BODY = 2000;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 10;
const recentHits = new Map();
const SLUGS = new Set(LAKES.map((lake) => lake.slug));

let writeChain = Promise.resolve();

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function kvBinding(env) {
  const kv = env && env.FAVORITE_VOTES;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") return null;
  return kv;
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const stamps = (recentHits.get(ip) || []).filter((time) => now - time < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) {
    recentHits.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentHits.set(ip, stamps);
  if (recentHits.size > 1000) {
    for (const [key, times] of recentHits) {
      const fresh = times.filter((time) => now - time < WINDOW_MS);
      if (fresh.length) recentHits.set(key, fresh);
      else recentHits.delete(key);
    }
  }
  return false;
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function emptyCounts() {
  const counts = {};
  for (const lake of LAKES) counts[lake.slug] = 0;
  return counts;
}

export function normalizeCounts(stored) {
  const counts = emptyCounts();
  const source = stored && typeof stored === "object" ? stored.counts : null;
  if (!source || typeof source !== "object") return counts;
  for (const lake of LAKES) {
    const raw = source[lake.slug];
    const n = typeof raw === "number" ? raw : Number(raw);
    counts[lake.slug] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return counts;
}

function totalOf(counts) {
  return LAKES.reduce((sum, lake) => sum + counts[lake.slug], 0);
}

function payload(counts) {
  return {
    ok: true,
    total: totalOf(counts),
    counts,
  };
}

// KV rejects cacheTtl below 30. cacheTtl 0 throws
// "Invalid cache_ttl of 0. Cache TTL must be at least 30."
// on every read, including a missing key, so the first vote never saves.
// Omit cacheTtl and use the default. A missing key resolves to null.
async function readCounts(kv) {
  const stored = await kv.get(TALLY_KEY, { type: "json" });
  if (stored == null) return emptyCounts();
  return normalizeCounts(stored);
}

function enqueueWrite(task) {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => {},
    () => {},
  );
  return run;
}

export async function handleFavorite(request, env) {
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "POST") {
    return json({ ok: false, error: "That method is not allowed." }, 405);
  }

  const kv = kvBinding(env);
  if (!kv) {
    return json({ ok: false, error: "Voting is not available yet." }, 503);
  }

  if (method === "GET") {
    try {
      return json(payload(await readCounts(kv)), 200);
    } catch {
      return json({ ok: false, error: "The tally could not be loaded." }, 503);
    }
  }

  if (!sameOrigin(request)) {
    return json({ ok: false, error: "That vote could not be saved." }, 403);
  }
  if (rateLimited(clientIp(request))) {
    return json({ ok: false, error: "Please wait a minute and try again." }, 429);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return json({ ok: false, error: "That vote could not be read." }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "That vote could not be read." }, 400);
  }
  const lake = body && typeof body.lake === "string" ? body.lake.trim() : "";
  if (!SLUGS.has(lake)) {
    return json({ ok: false, error: "Pick a lake from the list." }, 400);
  }

  try {
    const counts = await enqueueWrite(async () => {
      const next = await readCounts(kv);
      next[lake] += 1;
      await kv.put(TALLY_KEY, JSON.stringify({ counts: next }));
      return next;
    });
    return json({ ...payload(counts), lake }, 200);
  } catch {
    return json({ ok: false, error: "That vote could not be saved. Please try again." }, 503);
  }
}
