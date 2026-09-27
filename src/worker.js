import { handleContact } from "./contact.js";

// Same 301s as `_redirects`. The asset router applies `_redirects` for normal
// page views. These repeats cover a request that reaches the Worker instead.
export const LEGACY_REDIRECTS = new Map([
  ["/get-involved", "/"],
  ["/get-involved/", "/"],
  ["/impact", "/"],
  ["/impact/", "/"],
  ["/membership", "/"],
  ["/membership/", "/"],
]);

function isContactPath(pathname) {
  return pathname === "/api/contact" || pathname === "/api/contact/";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isContactPath(url.pathname)) {
      return handleContact(request, env);
    }

    const redirectTo = LEGACY_REDIRECTS.get(url.pathname);
    if (redirectTo) {
      return Response.redirect(new URL(redirectTo, url.origin), 301);
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Not found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
