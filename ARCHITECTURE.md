# Walton Dune Lakes: architecture

Last checked against the code and Cloudflare on Oct 8, 2026.

## What it does

A reference and education site about the coastal dune lakes of Walton County, FL: an illustrated map, a page for each of the 15 named lakes, the data page, a favorite lake vote, and a contact form.

## Domains and Worker

- Worker: `waltondunelakes`
- Custom domains (attached in the Cloudflare dashboard): `waltondunelakes.com`, `www.waltondunelakes.com`
- workers.dev host is enabled.

## Data and images

- Pages and images are static files in this repo (photo credits in `CREDITS.md`).
- Favorite lake vote tallies: KV namespace `3599e0a3741542a4bbede3c018b025b4`, binding `FAVORITE_VOTES` (key `tally`, created on the first vote).
- Bindings: `ASSETS` (static assets, directory `.`), `FAVORITE_VOTES` (KV). No D1 or R2.
- External services: Resend (contact mail), Google Analytics 4 tag on pages.

## Secrets and env vars (names only)

Secrets set: `RESEND_API_KEY`, `CONTACT_EMAIL`.

## Cron and scheduled jobs

None. The Worker has only a fetch handler and no cron trigger.

## How it deploys

- Cloudflare Workers Builds, auto deploy on merge to `main`. Repo `marcongit850/waltondunelakes`, trigger `87283c23-4b70-4994-9f61-1b58ac42442f`, build command empty, deploy command `npx wrangler deploy`, root `/`.
- If a merge does not deploy: `POST /accounts/f1c59948520f1ec39473238b621c7e24/builds/triggers/87283c23-4b70-4994-9f61-1b58ac42442f/builds` with body `{"branch": "main", "commit_hash": "<full 40 character sha>"}`. Check builds with `GET /accounts/f1c59948520f1ec39473238b621c7e24/builds/workers/7be6a2f266ff4cff9bf9cf8a9d8929c8/builds?per_page=2` and match `commit_hash`.

## Known gotchas

- Only `/api/contact` and `/api/favorite` run the Worker. Do not set `run_worker_first` to `true`; every page view would count against the Workers Free request limit and can 429 the site.
- Legacy redirects (`/get-involved/`, `/impact/`, `/membership/` to `/`) live in both `_redirects` and `LEGACY_REDIRECTS` in `src/worker.js`. Keep them in sync.
- Contact mail is sent from Resend's onboarding sender (`Coastal Dune Lakes <onboarding@resend.dev>`), hardcoded in the code. That sender only delivers to the email on the Resend account, so `CONTACT_EMAIL` must be that address until a domain is verified in Resend and the From line is changed.

## Not this Worker: douglassemail

- The `douglassemail` Worker does NOT serve this site and is not a renamed copy of it. It is a separate, live Worker serving `douglassemail.com` and `www.douglassemail.com` (a one page "coming soon" sandbox) from its own repo, `marcongit850/douglassemail` (Workers Builds trigger `bf1e2c46-ce09-4e00-919a-ba19cbc030b5`).
- On Oct 8, 2026 a manual build was started on that trigger with a commit from this repo by mistake. It failed at "Cloning repository" ("error occurred while fetching repository"), most likely because that commit does not exist in the douglassemail repo. The douglassemail site itself was not changed. This site deployed normally from its own trigger.
- Use only this repo's trigger (`87283c23-4b70-4994-9f61-1b58ac42442f`) for Walton Dune Lakes.

TODO: decide whether douglassemail.com (Worker `douglassemail`, repo `marcongit850/douglassemail`) should keep its coming soon page or be removed. Nothing has been deleted.

## Standing rule

Any PR that changes architecture (new secret, cron, storage, binding, or deploy change) must update this file in the same PR.
