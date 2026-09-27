# Coastal Dune Lakes of Walton County

A static reference and education site about the coastal dune lakes of Walton County, Florida. The home page introduces the lakes, a west-to-east guide map, and photo cards for all 15 named lakes. Each lake has its own page.

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

Slugs, west to east: `fuller`, `morris`, `campbell`, `stallworth`, `allen`, `oyster`, `draper`, `big-redfish`, `little-redfish`, `alligator`, `western`, `eastern`, `deer`, `camp-creek`, `powell`.

Shared files are `styles.css` and `site.js` (menu and map highlighting only). Photographs live in `images/`. `CREDITS.md` lists which pictures are a named lake, including the public-domain U.S. Geological Survey aerials in `images/lakes/`.

Acreages are approximate and vary by source. Photo credits stay beside the pictures and in `CREDITS.md`. The footer is a short note that the site is an independent educational resource.
