// POST /api/contact
// The destination inbox is CONTACT_EMAIL, a Worker variable or secret.
// This module delivers through FormSubmit and never returns that address.

const MAX_BODY = 12000;
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;
const recentHits = new Map();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function html(body, status) {
  const heading = body.ok ? "Message sent" : "Message not sent";
  const text = body.ok
    ? "Thank you. Your note is on its way."
    : body.error || "Could not send that message. Please try again.";
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)} · Coastal Dune Lakes</title>
</head>
<body>
  <main>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(text)}</p>
    <p><a href="/contact/">Back to the contact form</a></p>
  </main>
</body>
</html>`;
  return new Response(page, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
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

function singleLine(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

// FormSubmit treats a fetch with no web Referer as a file:// page
// ("open this page through a web server"). Origin alone and the _url field
// alone still get that rejection. A same-site Referer moves the response to
// activation or delivery. Keep the inbox out of the page by sending these
// from the Worker, using the public request origin rather than a foreign header.
function formSubmitSource(request) {
  const origin = new URL(request.url).origin;
  const formUrl = new URL("/contact/", origin).href;

  let referer = formUrl;
  const incomingReferer = request.headers.get("referer");
  if (incomingReferer) {
    try {
      const parsed = new URL(incomingReferer);
      if (parsed.origin === origin) referer = parsed.href;
    } catch {
      // Ignore a malformed Referer and use the contact page.
    }
  }

  return { origin, referer, formUrl };
}

export async function handleContact(request, env = {}) {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const type = (request.headers.get("content-type") || "").toLowerCase();
  const asJson = type.includes("application/json") || accept.includes("application/json");
  const reply = (body, status) => (asJson ? json(body, status) : html(body, status));

  if (request.method !== "POST") {
    return reply({ ok: false, error: "Use the contact form to send a message." }, 405);
  }

  const lengthHeader = Number(request.headers.get("content-length") || 0);
  if (lengthHeader > MAX_BODY) {
    return reply({ ok: false, error: "That message is too long." }, 413);
  }

  const isJson = type.includes("application/json");
  const isForm = type.includes("application/x-www-form-urlencoded");
  if (!isJson && !isForm) {
    return reply({ ok: false, error: "Could not read that message." }, 415);
  }

  if (rateLimited(clientIp(request))) {
    return reply({ ok: false, error: "Please wait a minute and try again." }, 429);
  }

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return reply({ ok: false, error: "Could not read that message." }, 400);
  }
  if (!raw.trim()) {
    return reply({ ok: false, error: "Please add a message." }, 400);
  }
  if (raw.length > MAX_BODY) {
    return reply({ ok: false, error: "That message is too long." }, 413);
  }

  let data;
  try {
    data = isJson ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw).entries());
  } catch {
    return reply({ ok: false, error: "Could not read that message." }, 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return reply({ ok: false, error: "Could not read that message." }, 400);
  }

  const honeypot = singleLine(data.hp_field || data.company || data.website);
  if (honeypot) {
    return reply({ ok: false, error: "Could not send that message." }, 400);
  }

  const name = singleLine(data.name);
  const email = singleLine(data.email);
  const subject = singleLine(data.subject);
  const message = String(data.message ?? "").trim();

  if (!name) return reply({ ok: false, error: "Please add your name." }, 400);
  if (name.length > 100) return reply({ ok: false, error: "That name is too long." }, 400);
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return reply({ ok: false, error: "Please enter a valid email address." }, 400);
  }
  if (subject.length > 140) return reply({ ok: false, error: "That subject is too long." }, 400);
  if (!message) return reply({ ok: false, error: "Please add a message." }, 400);
  if (message.length > 4000) return reply({ ok: false, error: "That message is too long." }, 400);

  const to = typeof env.CONTACT_EMAIL === "string" ? env.CONTACT_EMAIL.trim() : "";
  if (!to || !EMAIL_RE.test(to)) {
    return reply({ ok: false, error: "The contact form is not available right now." }, 503);
  }

  const source = formSubmitSource(request);
  const payload = {
    name,
    email,
    message,
    _replyto: email,
    _subject: subject || `Coastal Dune Lakes note from ${name}`,
    _template: "table",
    _captcha: "false",
    _url: source.formUrl,
  };

  let upstream;
  try {
    upstream = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        origin: source.origin,
        referer: source.referer,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return reply({ ok: false, error: "Could not send that message. Please try again." }, 502);
  }

  let result = null;
  try {
    result = await upstream.json();
  } catch {
    result = null;
  }

  const upstreamMessage = result && typeof result.message === "string" ? result.message : "";
  if (/activat/i.test(upstreamMessage)) {
    return reply(
      {
        ok: false,
        error: "The contact form needs a one-time activation. Please try again later.",
      },
      503,
    );
  }

  const delivered = upstream.ok && result && (result.success === true || result.success === "true");
  if (!delivered) {
    return reply({ ok: false, error: "Could not send that message. Please try again." }, 502);
  }

  return reply({ ok: true }, 200);
}
