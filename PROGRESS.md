# CityService — Progress & Resume Notes

> Session handoff doc. Read this first in a new session, then `ARCHITECTURE.md` for the full data model and reasoning (including §10's data-acquisition methods and their current Pune+PCMC status), then `DESIGN.md` for the original design tokens/spec this was built from.

## Status (as of 2026-08-24)

Shared coverage API is in the repo: `server/` (Express + Postgres). On start the catalog **upserts** from JSON: named Pune localities, gap pincode centroids, platforms, and Zepto MIDC hub rings as `source: seed`. Live `/probe` rows and GPS places are kept. Public visitors stay login-free. `/probe` is team-password gated (`PROBE_SECRET`). Android wrap via Capacitor 7 (`android/`, same `dist/` as the website). **Real live-checked coverage: 1 locality × 8 platforms** (Pimpri-Chinchwad, pincode 411018, 2026-08-14).

Branch to ship: **`om`** (after merging `map-zoom`). Deploy: Render **Web Service** + existing **PostgreSQL** (Internal `DATABASE_URL`). See README.

## Resume after reboot (copy-paste)

```bash
cd CityService
git status                 # confirm branch
npm install                # only if node_modules is missing
cp .env.example .env       # once; set PROBE_SECRET and local External DATABASE_URL
npm run dev                # → http://localhost:5173 (seed JSON unless VITE_USE_API=true)
npm run dev:server         # → http://localhost:3000 (needed for /probe writes when VITE_USE_API=true)
npx tsc -b
npm test
npm run pipeline:pick      # next (pincode, platform) pairs
npm run pipeline:infer     # apply hub inner/edge disks to coverage.seed.json
npm run cap:sync           # production build + copy into android/
npm run cap:android        # sync, then run on a device or emulator (needs JDK 21)
```

Node 20+, npm 10+. Copy `.env.example` → `.env` for `PROBE_SECRET` / optional `DATABASE_URL`. Do not commit `.env`.

- **Website (seed JSON):** `npm run dev`, then open the URL Vite prints.
- **Website (shared API locally):** `npm run dev:server` plus `VITE_USE_API=true` and `npm run dev`. Without `DATABASE_URL` the store is in-memory and resets on restart.
- **Render:** Web Service build `npm install --include=dev && npm run build`, start `npx tsx server/index.ts`, env Internal `DATABASE_URL`, `PROBE_SECRET`, `NODE_ENV=production`. Bookmark `/probe`; Account does not link it in production.
- **Android:** Capacitor 7. `npm run cap:sync` / `cap:android`. Needs **JDK 21**. Play Store listing, signing keys, and a privacy-policy URL for location are later.
- **Live coverage recording:** `/probe` (map pin / GPS / known place, then Service tab). Production talks to Postgres; local Vite still uses the disk plugin unless `VITE_USE_API=true`.

**Git.** `origin` → `github.com/omkarande/CityService`. Do not commit `.env`, `login.json`, or `record.json`. Decide whether `android/` belongs in git before adding it.

## Session report — 2026-08-24 (API + search map + merge)

- Added `server/index.ts` + `server/store.ts`: seed from `src/data/*.json` into Postgres (or memory if no `DATABASE_URL`). Public GET `/api/area`, search, platforms, map-pins, nearest. Team `POST /api/probe/login` + `POST /api/probe/record` + `POST /api/probe/place`.
- Frontend `httpAdapter` is used in production; `mockAdapter` remains for local Vite.
- Unknown search always shows a map + “Select this location” → `/at?lat=&lng=&q=`. Resolver: exact pin → nearby specific place ≤2 km → general suburb/city.
- `/probe` password gate; records POST to the API when using HTTP. Account “Record coverage” link is hidden in production.
- Merge of `map-zoom` into `om`: keep Capacitor native shell + GPS helper, keep API/search/probe, keep pipeline scripts.

## Session report — 2026-08-23 (Capacitor + pipeline)

**Capacitor 7 Android wrap.** The website is unchanged. Capacitor wraps the same Vite `dist/` in `android/` so the app can run as an APK. Packages: `@capacitor/android`, `@capacitor/app`, `@capacitor/geolocation`, `@capacitor/splash-screen`, `@capacitor/status-bar`. Scripts: `npm run cap:sync` (build + copy) and `npm run cap:android` (sync then run). Capacitor 7 needs **JDK 21** — Gradle will not compile on JDK 17.

**Strategy.** Re-read M1–M6 in `ARCHITECTURE.md` §10. None of the eight first-wave platforms expose a public “do you deliver here?” API. Live website checks stay the only ground truth. For dark stores, a flat 5–6 km “everywhere deliverable” circle would over-claim on the outskirts.

**Built.** `src/data/hubs.pune-pcmc.json` (one Zepto MIDC hub). `scripts/lib/pipeline.mjs` plus `pick-next-check` / `record-check` / `infer-hubs`. Picker is hub-edge biased for Zepto/Blinkit/Instamart. Coverage-collection write-up in `ARCHITECTURE.md` §10.

**Keep vs park** — M1 / M5 / M4 two-rings / M2–M6 geography stay. Parked: bare HTTP, private endpoint scrapes, unattended Playwright, seller APIs as a consumer map.

## Real data already in the JSON

Counted from the files on 2026-08-23. **Coverage that is actually live-checked: 1 locality × 8 platforms.** Everything else the app shows as coverage is placeholder and capped below Verified.

| File | Real | Not real / notes |
|---|---|---|
| `src/data/coverage.seed.json` | **8** `source: probe`, all `pimpri-chinchwad` / pincode **411018**, checked 2026-08-14: Swiggy, Instamart, Zepto, Blinkit, Zomato, Amazon, Flipkart, BigBasket — all `available` | **41** `seed-placeholder`. **0** hub-inferred `seed` rows at last infer. **49** records total. |
| `src/data/checkpoints.log.json` | **8** rows, same 411018 × 8 platforms | — |
| `src/data/hubs.pune-pcmc.json` | **1** hub: Zepto MIDC, lat/lng from Nominatim “MIDC Pimpri” | Blinkit / Instamart hubs: none |
| `src/data/pincodes.pune-pcmc.json` | **55** confirmed pins (39 PMC, 15 PCMC, 1 uncertain) | Geography only — not coverage |
| `src/data/localities.pune.json` | **19** hand-curated places; Ravet and Gahunje have real coords | No coverage probes for Ravet / Gahunje |
| `src/data/platforms.json` | **15** catalogue rows | Uber, Ola, Rapido, Porter, Urban Company, PharmEasy, Dunzo untried (tier-2) |

Eight live checks (all `available`):

| Platform | What was actually seen |
|---|---|
| Swiggy | Pizza Hut 20–25 min, Barbeque Nation 35–45 min |
| Instamart | “6 Mins Delivery” |
| Zepto | “Delivery in 8 Mins”, nearest store MIDC |
| Blinkit | “Delivery in 11 minutes” |
| Zomato | McDonald's 18 min, KFC 15 min |
| Amazon | pincode 411018 accepted; fast-delivery items shown |
| Flipkart | address confirmed to MIDC, Pimpri Colony, 411018 |
| BigBasket | “Delivery in 11 mins” to 411019 |

## What's built (app)

React 18 + Vite + TypeScript (strict) + Tailwind, React Router, Leaflet/OpenStreetMap, Vitest. Android wrapper via Capacitor 7. Production backend: Express + Postgres (`server/`). Mock adapter still reads local JSON for Vite without `VITE_USE_API`.

**Domain logic** (`src/domain/`): `confidence.ts` / `resolve.ts` (exact → nearby specific ≤2 km → suburb/city; placeholder cap 0.69) / `search.ts` / `seedCatalog.ts`.

**Screens:** Home, Search, City, Results, PlatformDetail, Nearby, Saved, Account, plus team `Probe` at `/probe`. Search map + street-level zoom. Home “use my location” uses Capacitor GPS on Android and opens `/at?lat=&lng=`.

**Trust mechanics:** thumbs up/down reporting recomputes confidence live on this device (`localStorage`).

## Roadmap

| Phase | What | Status |
|---|---|---|
| **0** | Cleanup: dead code, CI, Wikimedia attribution | Mostly done — visual verification pass still open |
| **1** | Data completeness for Pune+PCMC: pincodes, picker, then M1 checks, then M4 hub radii | Foundation done; **checking volume still thin** |
| — | Legal/ToS review — gates scaling M1 | Not started |
| **2** | Shared backend | **Express + Postgres on Render** (not Supabase). Live. |
| **3a** | Auth: stay anonymous for public visitors | Done by design |
| **3b** | Real user accounts | Not started; not needed for public read |
| **4** | Crowdsourcing loop: move reports off `localStorage` | Not started |
| **5** | Production readiness: Render deploy, brand/logo licensing | Deploy wiring in repo; first production URL still the user’s next step |

## Where to pick up (next session)

1. **Finish the `om` merge commit** if it is still in progress, then `git push origin om` and open a PR to `main`.
2. **Render Web Service** from GitHub (`om` or `main` after merge). Attach the **existing** Postgres Internal `DATABASE_URL`. Do not apply Blueprint if it would create a second DB.
3. **Resume Phase 1 checking** at `/probe`. For Zepto, the picker skips the MIDC inner disk and queues the 3–5 km rim first.
4. **Visually sanity-check** Results / PlatformDetail / Nearby / Saved / Account.
5. **Calibrate hub radii** with rim checks around MIDC. Do not treat 5–6 km as served.
6. **Commit `android/`** only if you want the native project in git.

## Known gaps

- Only Pune-area localities have seeded data; other home-grid cities are presentation-only.
- No PMC/PCMC administrative boundary polygon in OSM — taluka-level fallback is documented.
- The 55-pincode list is a verified floor, not proven exhaustive for PCMC’s outer edge.
- Instamart’s logo is Swiggy’s mark.
- Brand logos: skim Amazon/Uber guidelines before public launch.
- Visual verification of several screens in a real browser is still outstanding.
- Legal/ToS review still gates unattended probing.
- Thumbs-up reports still live in `localStorage` on this device only.
