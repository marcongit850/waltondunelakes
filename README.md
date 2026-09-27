# Coastal Dune Lakes of Walton County

A static reference and education site about the coastal dune lakes of Walton County, Florida. The home page introduces the lakes, an illustrated west-to-east map, and photo cards for all 15 named lakes. Each lake has its own page.

The older Friends of Scenic 30A sandbox pages are gone. Visits to `/get-involved/`, `/impact/`, and `/membership/` redirect to the home page.

## Preview

From the repository root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`.

Cloudflare Pages serves this directory as static assets (`wrangler.jsonc`, `assets.directory` set to `.`). The Wrangler project name is still `douglassemail` so an existing Pages project can keep deploying this folder.

## Pages

- `/` explains what coastal dune lakes are, and leads into the map and lake cards
- `/lakes/` is the guide map and the same west-to-east cards
- `/lakes/<slug>/` is one lake, for example `/lakes/western/`
- `/contact/` is a short form for questions and corrections

The contact form posts to the Pages Function at `/api/contact`. That function reads the destination inbox from the `CONTACT_EMAIL` environment variable and does not put the address in the pages sent to the browser. Set `CONTACT_EMAIL` in Cloudflare Pages → Settings → Environment variables for both Production and Preview. The first message through FormSubmit may require a confirmation click in that inbox.

Slugs, west to east: `fuller`, `morris`, `campbell`, `stallworth`, `allen`, `oyster`, `draper`, `big-redfish`, `little-redfish`, `alligator`, `western`, `eastern`, `deer`, `camp-creek`, `powell`.

Shared files are `styles.css` and `site.js` (menu, map highlighting, and the contact form). Photographs live in `images/`. `CREDITS.md` lists which pictures are a named lake, including the public-domain U.S. Geological Survey aerials in `images/lakes/`.

Acreages are approximate and vary by source. Photo credits stay beside the pictures and in `CREDITS.md`. The footer notes that the site is an independent educational resource, lists partners, and links to the contact page.
