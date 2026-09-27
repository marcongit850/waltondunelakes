import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../functions/api/contact.js", import.meta.url), "utf8");
const { onRequest } = await import("data:text/javascript," + encodeURIComponent(source));

const INBOX = "inbox@example.com";
let fetchCalls = [];
const realFetch = globalThis.fetch;

function installFetch(handler) {
  fetchCalls = [];
  globalThis.fetch = async (url, init) => {
    fetchCalls.push({ url, init });
    return handler(url, init);
  };
}

function restoreFetch() {
  globalThis.fetch = realFetch;
}

async function post(body, { ip = "203.0.113.10", env = { CONTACT_EMAIL: INBOX }, raw, headers } = {}) {
  const payload = raw === undefined ? JSON.stringify(body) : raw;
  const request = new Request("https://douglassemail.com/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      ...(headers || {}),
    },
    body: payload,
  });
  const response = await onRequest({ request, env });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { response, text, json };
}

const valid = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Deer Lake acreage",
  message: "A short correction about the outfall.",
  hp_field: "",
};

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

await check("rejects a filled honeypot without sending mail", async () => {
  installFetch(async () => {
    throw new Error("fetch should not run");
  });
  const { response, json, text } = await post(
    { ...valid, hp_field: "http://spam.test" },
    { ip: "203.0.113.21" },
  );
  assert.equal(response.status, 400);
  assert.equal(json.ok, false);
  assert.equal(fetchCalls.length, 0);
  assert.equal(text.includes(INBOX), false);
  restoreFetch();
});

await check("rejects missing and invalid fields", async () => {
  installFetch(async () => {
    throw new Error("fetch should not run");
  });
  const missingName = await post({ ...valid, name: "  " }, { ip: "203.0.113.22" });
  assert.equal(missingName.response.status, 400);
  assert.match(missingName.json.error, /name/i);
  const badEmail = await post({ ...valid, email: "not-an-email" }, { ip: "203.0.113.23" });
  assert.equal(badEmail.response.status, 400);
  assert.match(badEmail.json.error, /email/i);
  const missingMessage = await post({ ...valid, message: "" }, { ip: "203.0.113.24" });
  assert.equal(missingMessage.response.status, 400);
  assert.equal(fetchCalls.length, 0);
  restoreFetch();
});

await check("rejects an empty or oversized body", async () => {
  const empty = await post(null, { ip: "203.0.113.25", raw: "   " });
  assert.equal(empty.response.status, 400);
  const huge = await post(null, { ip: "203.0.113.26", raw: "x".repeat(12001) });
  assert.equal(huge.response.status, 413);
  assert.equal(huge.text.includes(INBOX), false);
});

await check("does not send when CONTACT_EMAIL is missing", async () => {
  installFetch(async () => {
    throw new Error("fetch should not run");
  });
  const { response, json, text } = await post(valid, { ip: "203.0.113.27", env: {} });
  assert.equal(response.status, 503);
  assert.equal(json.ok, false);
  assert.equal(fetchCalls.length, 0);
  assert.equal(text.includes("@"), false);
  restoreFetch();
});

await check("posts to FormSubmit using only the env inbox", async () => {
  installFetch(async () => new Response(JSON.stringify({ success: "true" }), { status: 200 }));
  const { response, json, text } = await post(valid, { ip: "203.0.113.28" });
  assert.equal(response.status, 200);
  assert.deepEqual(json, { ok: true });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, `https://formsubmit.co/ajax/${encodeURIComponent(INBOX)}`);
  const sent = JSON.parse(fetchCalls[0].init.body);
  assert.equal(sent.email, valid.email);
  assert.equal(sent._replyto, valid.email);
  assert.equal(sent._subject, valid.subject);
  assert.equal(text.includes(INBOX), false);
  restoreFetch();
});

await check("hides upstream failures and activation details", async () => {
  installFetch(async () =>
    new Response(JSON.stringify({ success: false, message: `Activate ${INBOX} to continue` }), {
      status: 200,
    }),
  );
  const activation = await post(valid, { ip: "203.0.113.29" });
  assert.equal(activation.response.status, 503);
  assert.equal(activation.text.includes(INBOX), false);
  assert.match(activation.json.error, /one-time setup/i);

  installFetch(async () => new Response("nope", { status: 500 }));
  const failed = await post(valid, { ip: "203.0.113.30" });
  assert.equal(failed.response.status, 502);
  assert.equal(failed.json.ok, false);
  assert.equal(failed.text.includes("nope"), false);
  restoreFetch();
});

await check("returns an HTML page for a normal form post", async () => {
  installFetch(async () => new Response(JSON.stringify({ success: "true" }), { status: 200 }));
  const body = new URLSearchParams({
    name: "Ada Lovelace",
    email: "ada@example.com",
    subject: "Hello",
    message: "A note from a browser without the script.",
    hp_field: "",
  }).toString();
  const request = new Request("https://douglassemail.com/api/contact", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html",
      "cf-connecting-ip": "203.0.113.51",
    },
    body,
  });
  const response = await onRequest({ request, env: { CONTACT_EMAIL: INBOX } });
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  assert.match(text, /Thank you/);
  assert.equal(text.includes(INBOX), false);
  assert.equal(text.includes('{"ok"'), false);
  restoreFetch();
});

await check("rejects non-POST and rate-limits a busy address", async () => {
  const get = await onRequest({
    request: new Request("https://douglassemail.com/api/contact", { method: "GET" }),
    env: { CONTACT_EMAIL: INBOX },
  });
  assert.equal(get.status, 405);

  installFetch(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  const ip = "203.0.113.40";
  for (let i = 0; i < 5; i += 1) {
    const result = await post(valid, { ip });
    assert.equal(result.response.status, 200);
  }
  const blocked = await post(valid, { ip });
  assert.equal(blocked.response.status, 429);
  restoreFetch();
});

if (process.exitCode) {
  console.error(`${passed} checks passed before a failure`);
} else {
  console.log(`${passed} checks passed`);
}
