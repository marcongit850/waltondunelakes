import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const home = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "styles.css"), "utf8");
const siteJs = readFileSync(join(root, "site.js"), "utf8");

const heroStart = home.indexOf('class="hero-photo"');
const heroEnd = home.indexOf('class="section statement"');
const hero = home.slice(heroStart, heroEnd);
const avatarStart = hero.indexOf('class="hero-avatar"');
const avatarEnd = hero.indexOf('class="hero-copy"');
const avatar = hero.slice(avatarStart, avatarEnd);

assert.ok(avatarStart > -1, "home hero includes the avatar");
assert.ok(avatarEnd > avatarStart, "avatar sits before the hero text");
assert.match(avatar, /alt="Video"/);
assert.match(avatar, /class="hero-avatar-poster" src="images\/dune-hero-avatar-poster\.jpg"/);
assert.match(avatar, /<source src="videos\/dune-hero-avatar\.mp4" type="video\/mp4">/);
assert.equal(avatar.includes("<figcaption"), false);
assert.equal(avatar.includes("—"), false);
assert.equal(avatar.includes("–"), false);
assert.equal(avatar.includes("caption"), false);

const videoTag = avatar.match(/<video class="hero-avatar-video"[^>]*>/)[0];
assert.match(videoTag, /poster="images\/dune-hero-avatar-poster\.jpg"/);
assert.match(videoTag, /playsinline/);
assert.equal(/\sautoplay(?:=|\s|>)/.test(videoTag), false);
assert.equal(/\sloop(?:=|\s|>)/.test(videoTag), false);
assert.equal(/\smuted(?:=|\s|>)/.test(videoTag), false);
assert.match(avatar, /aria-label="Play video"/);
assert.equal(avatar.includes("Stop video"), false);

const videoPath = join(root, "videos/dune-hero-avatar.mp4");
const posterPath = join(root, "images/dune-hero-avatar-poster.jpg");
assert.equal(existsSync(videoPath), true);
assert.equal(existsSync(posterPath), true);
assert.equal(statSync(videoPath).size, 2044768);
assert.equal(statSync(posterPath).size, 57554);

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

for (const file of htmlFiles(root)) {
  const html = readFileSync(join(root, file), "utf8");
  if (file === "index.html") {
    assert.equal(html.includes("hero-avatar"), true);
  } else {
    assert.equal(html.includes("hero-avatar"), false, file);
    assert.equal(html.includes("dune-hero-avatar"), false, file);
  }
}

assert.match(css, /\.hero-stage\s*\{[^}]*display:\s*flex;/);
assert.match(css, /\.hero-stage\s*\{[^}]*align-items:\s*flex-end;/);
assert.match(css, /flex-direction:\s*column;[\s\S]*?\.hero-avatar\s*\{\s*width:\s*min\(8\.5rem,\s*42vw\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.hero-photo > video\s*\{\s*display:\s*none;\s*\}/);
assert.equal(css.includes(".hero-photo video { display: none; }"), false);
assert.match(siteJs, /function initHeroAvatar\(root\)/);
assert.match(siteJs, /video\.muted = false/);
assert.match(siteJs, /addEventListener\("ended", showPoster\)/);

function classList() {
  const names = new Set();
  return {
    add(name) { names.add(name); },
    remove(name) { names.delete(name); },
    contains(name) { return names.has(name); },
  };
}

function mountAvatar() {
  const playIcon = { hidden: false };
  const stopIcon = { hidden: true };
  const button = {
    attrs: { "aria-label": "Play video" },
    listeners: {},
    getAttribute(name) { return this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const video = {
    muted: false,
    defaultMuted: false,
    paused: true,
    currentTime: 12,
    listeners: {},
    attributes: { muted: "" },
    removeAttribute(name) { delete this.attributes[name]; },
    pause() { this.paused = true; },
    play() {
      this.paused = false;
      if (this.listeners.playing) this.listeners.playing();
      return Promise.resolve();
    },
    addEventListener(type, fn) { this.listeners[type] = fn; },
  };
  const root = {
    classList: classList(),
    video,
    button,
    querySelector(sel) {
      if (sel === ".hero-avatar-video") return video;
      if (sel === ".hero-avatar-control") return button;
      if (sel === ".hero-avatar-icon-play") return playIcon;
      if (sel === ".hero-avatar-icon-stop") return stopIcon;
      return null;
    },
  };
  const sandbox = {
    document: {
      querySelector(sel) { return sel === ".hero-avatar" ? root : null; },
      getElementById() { return null; },
      querySelectorAll() { return []; },
      addEventListener() {},
    },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(siteJs, sandbox);
  return { root, video, button, playIcon, stopIcon };
}

const player = mountAvatar();
assert.equal(player.root.classList.contains("is-playing"), false);
assert.equal(player.button.getAttribute("aria-label"), "Play video");

player.button.listeners.click();
assert.equal(player.video.muted, false);
assert.equal(player.video.attributes.muted, undefined);
assert.equal(player.video.paused, false);
assert.equal(player.root.classList.contains("is-playing"), true);
assert.equal(player.button.getAttribute("aria-label"), "Stop video");
assert.equal(player.playIcon.hidden, true);
assert.equal(player.stopIcon.hidden, false);

player.video.currentTime = 8;
player.button.listeners.click();
assert.equal(player.video.paused, true);
assert.equal(player.video.currentTime, 0);
assert.equal(player.root.classList.contains("is-playing"), false);
assert.equal(player.button.getAttribute("aria-label"), "Play video");
assert.equal(player.playIcon.hidden, false);
assert.equal(player.stopIcon.hidden, true);

player.button.listeners.click();
assert.equal(player.root.classList.contains("is-playing"), true);
player.video.listeners.ended();
assert.equal(player.video.paused, true);
assert.equal(player.video.currentTime, 0);
assert.equal(player.root.classList.contains("is-playing"), false);
assert.equal(player.button.getAttribute("aria-label"), "Play video");

const blocked = mountAvatar();
blocked.video.play = function () {
  this.paused = true;
  return Promise.reject(new Error("blocked"));
};
blocked.button.listeners.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(blocked.root.classList.contains("is-playing"), false);
assert.equal(blocked.button.getAttribute("aria-label"), "Play video");
assert.equal(blocked.video.paused, true);
