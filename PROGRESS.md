# CityService — Progress & Resume Notes

> **Read this first in a new session.** Then `ARCHITECTURE.md` (data model + §10 collection methods), then `DESIGN.md` (tokens). This file is enough to continue after closing the laptop — nothing important lives only in chat.

## Status (as of 2026-08-24)

Shared coverage API is in the repo: `server/` (Express + Postgres). On start the catalog **upserts** from JSON: named Pune localities, gap pincode centroids, platforms, and Zepto MIDC hub rings as `source: seed`. Live `/probe` rows and GPS places are kept. Public visitors stay login-free. `/probe` is team-password gated (`PROBE_SECRET`). **Real live-checked coverage: 1 locality × 8 platforms** (Pimpri-Chinchwad, pincode 411018, 2026-08-14).

Branch: **`map-zoom`**. Deploy: Render **Web Service** + existing **PostgreSQL** (Internal `DATABASE_URL`). See README.

Closing the laptop does not lose work that is already in these files or in git. Start the next session by opening this repo and reading this page — you do not need the previous chat.

## Resume after reboot (copy-paste)

```bash
cd CityService
git status                 # confirm branch; android/ should show as untracked
npm install                # only if node_modules is missing
cp .env.example .env       # once; set PROBE_SECRET
npm run dev                # → http://localhost:5173 (seed JSON)
npx tsc -b
npm test
```

Node 20+, npm 10+. Copy `.env.example` → `.env` for `PROBE_SECRET` / optional `DATABASE_URL`. Do not commit `.env`.

- **Website (seed JSON):** `npm run dev`, then open the URL Vite prints.
- **Website (shared API locally):** `npm run dev:server` plus `VITE_USE_API=true` and `npm run dev`. Without `DATABASE_URL` the store is in-memory and resets on restart.
- **Render:** Web Service build `npm ci --include=dev && npm run build`, start `npx tsx server/index.ts`, env `DATABASE_URL`, `PROBE_SECRET`, `NODE_ENV=production`. Bookmark `/probe`; Account does not link it in production.
- **Android:** `android/` is on disk but **not committed**, and `package.json` on this branch does **not** list Capacitor scripts/deps. Needs JDK 21 if you rebuild the native project.
- **Live coverage recording:** `/probe` exists. Production talks to Postgres; local Vite still uses `probeStore` + the Vite disk plugin unless `VITE_USE_API=true`.

**Git.** `origin` → `github.com/omkarande/CityService`. Decide whether to commit `android/` before more native work.

## Session report — 2026-08-23 (shared coverage)

- Added `server/index.ts` + `server/store.ts`: seed from `src/data/*.json` into Postgres (or memory if no `DATABASE_URL`). Public GET `/api/area`, search, platforms, map-pins, nearest. Team `POST /api/probe/login` + `POST /api/probe/record`.
- Frontend `httpAdapter` is used in production; `mockAdapter` remains for local Vite.
- `/probe` password gate; records POST to the API when using HTTP. Account “Record coverage” link is hidden in production.

## Session report — 2026-08-23

### What we did

- Reviewed M1–M6 in `ARCHITECTURE.md` §10. Researched public APIs for Zepto, Blinkit, Instamart, Swiggy, Zomato, Amazon, Flipkart, BigBasket. **None** offer a third-party “do you deliver here?” feed.
- Decided live website checks (set location in *their* UI, read what they render) stay the only ground truth. Bare HTTP already failed (Amazon 500).
- Decided dark-store coverage is **two rings**, not “5–6 km everywhere”: inner ~2.5–3 km inferred available (`source: seed`); 3–5 km is the edge to check live; do not publish 5–6 km as served.
- Designed (and later restored) an assisted `/probe` console + picker + hub file. `/probe` and `scripts/` are on this branch again; shared writes go through the Node API.
- Capacitor Android wrap was added as `android/` (app id `app.cityservice`, `webDir: dist`). Untracked. Website routes unchanged.
- User asked whether the agent can run as a Chrome extension and check every site/location. **No.** No standing extension, no unattended sweep. Optional later: a scorekeeper that only records a page the human already loaded. A live Chrome session (same method as 2026-08-14) can still do one pair at a time if the user asks in-session.

### Fetch strategies — keep vs park

**Keep**

| Method | Decision |
|---|---|
| **M1** | Real browser, their location picker, read the UI. Only ground truth. |
| **M5** | Coarse grid, then bisect disagreements. For Zepto/Blinkit/Instamart: skip inner disk; check the 3–5 km rim first. |
| **M4 two rings** | Inner ~2.5–3 km → `available` as `seed`. Edge ~3–5 km → `partial` / live check. Not for Swiggy food, Zomato, Amazon, Flipkart scheduled. |
| **M2 / M6** | Pincode list + polygons are supporting geography. Enough to *plan* checks; the pin/boundary JSON from an earlier session is **not on this branch**. |
| **Assisted recording** | Human sets the location. A console or scorekeeper only queues, copies, and writes JSON. |

**Parked / do not build**

- Bare HTTP, private serviceability scrapes, grid-sweeps.
- Amazon SP-API / Flipkart Seller as a consumer coverage map.
- Swiggy MCP as a citywide index (their terms: that user’s order, not analytics).
- Delhivery/Shiprocket as Zepto or Amazon Fast.
- Unattended Playwright against platform checkers.
- Licensed dark-store CSVs unless paid and license allows product use.

### Real data in JSON (counted 2026-08-23 on this branch)

**Live-checked coverage: 1 locality × 8 platforms.** Everything else the UI shows as coverage is `seed-placeholder`, capped below Verified.

| File | Real | Notes |
|---|---|---|
| `src/data/coverage.seed.json` | **8** `source: probe`, `areaId: pimpri-chinchwad`, pin **411018**, 2026-08-14 | Swiggy, Instamart, Zepto, Blinkit, Zomato, Amazon, Flipkart, BigBasket — all `available`. **41** placeholders. **49** total. |
| `src/data/localities.pune.json` | **19** places including Ravet and Gahunje (real coords) | Ravet/Gahunje have **no** probe coverage. |
| `src/data/platforms.json` | **15** catalogue rows | Uber, Ola, Rapido, Porter, Urban Company, PharmEasy, Dunzo untried. |
| `src/data/pincodes.pune-pcmc.json` | — | **Not on this branch.** |
| `src/data/hubs.pune-pcmc.json` | — | **Not on this branch.** Planned seed: Zepto MIDC from the 2026-08-14 note. |
| `src/data/checkpoints.log.json` | — | **Not on this branch.** Would be 8 rows for 411018 if restored. |

Eight live checks (all `available`):

| Platform | Seen |
|---|---|
| Swiggy | Pizza Hut 20–25 min, Barbeque Nation 35–45 min |
| Instamart | “6 Mins Delivery” |
| Zepto | “Delivery in 8 Mins”, nearest store MIDC |
| Blinkit | “Delivery in 11 minutes” |
| Zomato | McDonald's 18 min, KFC 15 min |
| Amazon | 411018 accepted; fast-delivery items |
| Flipkart | MIDC, Pimpri Colony, 411018 |
| BigBasket | “Delivery in 11 mins” to 411019 |

## What's built (app)

React 18 + Vite + TypeScript + Tailwind, React Router, Leaflet. Mock adapter reads `src/data`. Domain: `resolve.ts` / `confidence.ts` / `search.ts` (placeholder cap 0.69). Screens: Home, Search, City, Results, PlatformDetail, Nearby, Saved, Account. Search map + street-level zoom (this branch). No `/probe`.

Tests: run `npm test` at the start of the next session and treat that result as truth (older notes about 45 vs 47 tests and an un-run `mergeReports` change may be stale).

## Where to pick up (next session)

In order:

1. **Open this file, then `ARCHITECTURE.md` §10.** Do not re-litigate “is there a public API?”
2. **Run the app:** `npm run dev`, confirm Home / Search / a Results page still work after reboot.
3. **Decide first build:** (a) restore the probe console + hub picker on this branch, or (b) do the next live checks in Chrome one-by-one and hand-edit `coverage.seed.json` the way 2026-08-14 was done. First suggested Zepto rim (when hubs exist): Kalewadi 411017, then Bhosari / Chinchwadgaon.
4. **Ravet** still has no coverage — user was going to check it manually.
5. **Commit `android/`** only if you want the native project in git; also add Capacitor deps/scripts to `package.json` if you will run the APK again.
6. Visual pass of Results / PlatformDetail / Nearby / Saved / Account still outstanding. Prefer handing the user localhost over driving Chrome unprompted.
7. Phase 2 Supabase is still optional and parallel.

## Known gaps

- Pipeline files (`scripts/`, hubs, pincodes, `/probe`) are **specified, not present** on `map-zoom`.
- `android/` untracked; Capacitor not in `package.json` on this branch.
- No PMC/PCMC municipal polygon in OSM (honest miss from an earlier session).
- Legal/ToS review still gates any unattended probing.
- Only Pune localities are seeded; other home-grid cities are presentation-only.
- Brand/logo review before public launch.
