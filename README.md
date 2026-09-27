# Coastal Dune Lakes of Walton County

A static reference and education site about the coastal dune lakes of Walton County, Florida. The home page introduces the lakes, an illustrated west-to-east map, and photo cards for all 15 named lakes. Each lake has its own page.

The older Friends of Scenic 30A sandbox pages are gone. Visits to `/get-involved/`, `/impact/`, and `/membership/` redirect to the home page.

## Preview

From the repository root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. That server only shows the static pages. Contact delivery is the Worker in `src/worker.js`. Check it with:

```bash
node test/contact-function.test.mjs
```

## Deploy

Cloudflare Workers Builds deploys this repository from `wrangler.jsonc`. The project name is still `douglassemail`.

`main` is `src/worker.js`. Static files use the `ASSETS` binding (`assets.directory` is `.`). `assets.run_worker_first` is `true`, so every request enters the Worker. `POST /api/contact` and `POST /api/contact/` run the contact handler. Every other path is served with `env.ASSETS.fetch(request)`, which keeps the same HTML URLs (`/`, `/lakes/`, `/contact/`, `styles.css`, `site.js`, and `images/`).

The old Pages `functions/` folder and `_routes.json` are not used. Workers static assets ignore Pages Functions, which is why `/contact/` returned 200 while `/api/contact` returned 404. An assets-only Worker also cannot store variables (“Variables cannot be added to a Worker that only has static assets”), so `CONTACT_EMAIL` could not be saved until this script existed.

`.assetsignore` keeps the Worker source, tests, Wrangler config, and this README out of the public upload. Visits to `/get-involved/`, `/impact/`, and `/membership/` still redirect to the home page. Those rules live in `_redirects` and are repeated in `src/worker.js`, because redirects in `_redirects` are not applied to responses the Worker serves.

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

Do not commit the address in `wrangler.jsonc`. The first message through FormSubmit still sends an activation email to that inbox; open it and confirm once. Until `CONTACT_EMAIL` is set, `POST /api/contact` returns a clear error (HTTP 503) instead of a static 404.

Slugs, west to east: `fuller`, `morris`, `campbell`, `stallworth`, `allen`, `oyster`, `draper`, `big-redfish`, `little-redfish`, `alligator`, `western`, `eastern`, `deer`, `camp-creek`, `powell`.

Shared files are `styles.css` and `site.js` (menu, map highlighting, and the contact form). Photographs live in `images/`. `CREDITS.md` lists which pictures are a named lake, including the public-domain U.S. Geological Survey aerials in `images/lakes/`.

Acreages are approximate and vary by source. Photo credits stay beside the pictures and in `CREDITS.md`. The footer notes that the site is an independent educational resource, lists partners, and links to the contact page.
