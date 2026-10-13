import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const home = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");

function htmlFiles(dir, prefix = "") {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) found.push(...htmlFiles(full, rel));
    else if (name.endsWith(".html")) found.push(rel);
  }
  return found;
}

const scripts = [...home.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const script = scripts.find((body) => body.includes("hide-week-badge"));
assert.ok(script, "home page includes the badge cutoff script");
assert.match(script, /var cutoff = Date\.parse\("2026-11-07T06:00:00Z"\)/);
assert.match(script, /if \(Date\.now\(\) >= cutoff\) document\.documentElement\.classList\.add\("hide-week-badge"\)/);
assert.ok(home.indexOf(script) < home.indexOf("</head>"), "cutoff runs before the hero paints");
assert.match(
  home,
  /<img class="hero-week-badge" src="images\/coastal-dune-lakes-week\.webp" alt="Coastal Dune Lakes Week, November 2-6"/,
);
assert.match(css, /\.hide-week-badge \.hero-week-badge\s*\{\s*display:\s*none;\s*\}/);

for (const file of htmlFiles(root)) {
  if (file === "index.html") continue;
  const html = readFileSync(join(root, file), "utf8");
  assert.equal(html.includes("hide-week-badge"), false, file);
  assert.equal(html.includes("hero-week-badge"), false, file);
  assert.equal(html.includes("coastal-dune-lakes-week"), false, file);
}

function chicagoParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
    zone: get("timeZoneName"),
  };
}

const cutoff = new Date("2026-11-07T06:00:00Z");
assert.deepEqual(chicagoParts(cutoff), {
  year: "2026",
  month: "11",
  day: "07",
  hour: "00",
  minute: "00",
  second: "00",
  zone: "CST",
});
assert.deepEqual(chicagoParts(new Date(cutoff.getTime() - 1)), {
  year: "2026",
  month: "11",
  day: "06",
  hour: "23",
  minute: "59",
  second: "59",
  zone: "CST",
});

function hiddenAt(ms) {
  const classes = new Set();
  vm.runInNewContext(script, {
    Date: class extends Date {
      static now() {
        return ms;
      }
      static parse(value) {
        return Date.parse(value);
      }
    },
    document: {
      documentElement: {
        classList: {
          add(name) {
            classes.add(name);
          },
        },
      },
    },
  });
  return classes.has("hide-week-badge");
}

assert.equal(hiddenAt(Date.parse("2026-11-02T00:00:00-06:00")), false);
assert.equal(hiddenAt(Date.parse("2026-11-06T23:59:00-06:00")), false);
assert.equal(hiddenAt(cutoff.getTime() - 1), false);
assert.equal(hiddenAt(cutoff.getTime()), true);
assert.equal(hiddenAt(Date.parse("2026-11-07T00:00:01-06:00")), true);
