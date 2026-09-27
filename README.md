# Coastal Dune Lakes of Walton County

A static reference and education site about the coastal dune lakes of Walton County, Florida. The home page introduces the lakes, an illustrated west-to-east map, and photo cards for all 15 named lakes. Each lake has its own page.

The older Friends of Scenic 30A sandbox pages are gone. Visits to `/get-involved/`, `/impact/`, and `/membership/` redirect to the home page.

## Preview

From the repository root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. That server only shows the static pages. Contact delivery is the Worker in `src/worker.js`. Check the contact Worker, shared footer, and shared header with:

```bash
npm test
```

## Deploy

Cloudflare Workers Builds deploys this repository from `wrangler.jsonc`. The project name is still `douglassemail`.

`main` is `src/worker.js`. Static files use the `ASSETS` binding (`assets.directory` is `.`). `assets.run_worker_first` is only `/api/contact` and `/api/contact/`, so those requests run the contact handler. Every other path is a static asset, which keeps the same HTML URLs (`/`, `/lakes/`, `/contact/`, `styles.css`, `site.js`, `header.js`, `footer.js`, and `images/`).

This stays on the Workers Free plan. Static asset requests are free and unlimited. A contact post is one Worker invocation plus one outbound request to FormSubmit, which fits the free daily request allowance and the 10 ms CPU limit for a low-volume form. `CONTACT_EMAIL` is a single variable or secret. The Worker does not use Workers Paid, Email Routing, R2, Queues, or any other paid Cloudflare product. Mail goes out through FormSubmit.

The old Pages `functions/` folder and `_routes.json` are not used. Workers static assets ignore Pages Functions, which is why `/contact/` returned 200 while `/api/contact` returned 404. An assets-only Worker also cannot store variables (“Variables cannot be added to a Worker that only has static assets”), so `CONTACT_EMAIL` could not be saved until this script existed.

`.assetsignore` keeps the Worker source, tests, Wrangler config, and this README out of the public upload. Visits to `/get-involved/`, `/impact/`, and `/membership/` still redirect to the home page. Those rules live in `_redirects`, which the asset router applies on ordinary page views. `src/worker.js` repeats them when a request reaches the Worker instead.

## Pages

- `/` explains what coastal dune lakes are, and leads into the map and lake cards
- `/lakes/` is the guide map and the same west-to-east cards
- `/lakes/<slug>/` is one lake, for example `/lakes/western/`
- `/contact/` is a short form for questions and corrections

The contact form posts to `/api/contact`. The Worker reads the destination inbox from `env.CONTACT_EMAIL` only and does not put the address in the pages sent to the browser.

After this change is merged and deployed, set the inbox in Cloudflare:

1. Open **Workers & Pages** → **douglassemail** → **Settings** → **Variables and Secrets**.
2. Add `CONTACT_EMAIL` = `352marc@gmail.com` for Production. Add it for Preview too if that environment is offered.
3. Redeploy after saving the variable.

Do not commit the address in `wrangler.jsonc`. The Worker posts to FormSubmit's AJAX endpoint with this site's `Origin`, a `Referer` for the contact page, and FormSubmit's `_url` field. A server fetch without that web `Referer` is rejected as if the page were opened as an HTML file. The first accepted message still sends an activation email to the inbox; open it and confirm once. Until that link is confirmed, `POST /api/contact` returns HTTP 503 and says the form needs a one-time activation. Until `CONTACT_EMAIL` is set, it returns a different HTTP 503 instead of a static 404.

Slugs, west to east: `fuller`, `morris`, `campbell`, `stallworth`, `allen`, `oyster`, `draper`, `big-redfish`, `little-redfish`, `alligator`, `western`, `eastern`, `deer`, `camp-creek`, `powell`.

Shared files are `styles.css`, `site.js` (menu, map highlighting, and the contact form), `header.js` (the site header and primary nav), and `footer.js` (the site footer). Edit `header.js` to change the brand and primary navigation on every page that has a header. Edit `footer.js` to change footer navigation and the Resources links on every page that has a footer. Each script fills in relative hrefs from the page depth and marks the current page with `aria-current` where that page already did. Redirect pages do not load them. Photographs live in `images/`. `CREDITS.md` lists which pictures are a named lake, including the public-domain U.S. Geological Survey aerials in `images/lakes/`.

Acreages are approximate and vary by source. Photo credits stay beside the pictures and in `CREDITS.md`. The footer notes that the site is an independent educational resource, lists Resources, and links to the contact page.
