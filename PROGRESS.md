# CityService — Progress & Resume Notes

> Session handoff doc. Read this first in a new session, then `ARCHITECTURE.md` for the full data model and reasoning (including §10's data-acquisition methods and their current Pune+PCMC status), then `DESIGN.md` for the original design tokens/spec this was built from.

## What this is

A mobile-first web app: search a locality (down to a single vasti), see which delivery/ride/quick-commerce apps actually serve it, with a confidence rating and provenance for every answer. Full product framing is in `ARCHITECTURE.md`.

## Status: frontend prototype, running, no backend, data pipeline foundation just built for Pune + Pimpri-Chinchwad

The app is fully built and functional. A phased roadmap to take it from prototype to a real product was designed and approved this session (see "Roadmap" below) — Phase 0 (cleanup) is done, and Phase 1's foundation (real pincode list, boundary data, a next-point picker script, all scoped to Pune + PCMC) is built and verified. Actual data-checking volume is still thin — see "Real data collection" below.

## Resume in 60 seconds

```bash
cd CityService
npm install         # if node_modules isn't present
npm run dev          # → http://localhost:5173 (falls back to 5174+ if taken — check the terminal output)
npx tsc -b            # type-check
npm run build          # production build
npm test                # vitest
npm run pipeline:pick   # next (pincode, platform) pairs
npm run pipeline:infer  # apply hub inner/edge disks to coverage.seed.json
# then npm run dev → http://localhost:5173/probe  to record live checks
npm run cap:sync        # production build + copy into android/
npm run cap:android     # sync, then run on a device or emulator (needs JDK 21)
```

Node 20, npm 10. No `.env`, no external services, no accounts required — everything runs local. The website is `npm run dev`; the same `dist/` is wrapped for Android via Capacitor 7. Live coverage recording needs the Vite server (`/probe` + `/api/probe`). Start it fresh if it is not running.

**Git repo, pushed to GitHub.** `origin` → `github.com/omkarande/CityService`, `main` branch. **This session's changes are NOT committed yet** — working tree has real, verified, uncommitted changes (see "What changed this session" below). Decide whether to commit before starting new work on top of it.

## Session report — 2026-08-23

Complete write-up of this stretch: Capacitor wrap, coverage-fetch strategy, the `/probe` pipeline, and an exact count of what in the JSON is real. Older 2026-08-14 / 2026-08-19 notes below are unchanged.

### What we did

**Capacitor 7 Android wrap.** The website is unchanged. Capacitor wraps the same Vite `dist/` in `android/` so the app can run as an APK. Packages: `@capacitor/android`, `@capacitor/app`, `@capacitor/geolocation`, `@capacitor/splash-screen`, `@capacitor/status-bar`. Scripts: `npm run cap:sync` (build + copy) and `npm run cap:android` (sync then run). Capacitor 7 needs **JDK 21** — Gradle will not compile on JDK 17. Play Store listing, signing keys, and a privacy-policy URL for location are later. See `README.md` → Android.

**Strategy.** Re-read M1–M6 in `ARCHITECTURE.md` §10. Researched whether Zepto, Blinkit, Instamart, Swiggy, Zomato, Amazon, Flipkart, or BigBasket expose a public “do you deliver here?” API. They do not. Live website checks stay the only ground truth. For dark stores, a flat 5–6 km “everywhere deliverable” circle would over-claim on the outskirts; 5–6 km is the outer maybe, not the inner yes.

**Built.** `src/data/hubs.pune-pcmc.json` (one Zepto MIDC hub, Nominatim-approx road point). `scripts/lib/pipeline.mjs` plus `pick-next-check` / `record-check` / `infer-hubs`. Picker is hub-edge biased for Zepto/Blinkit/Instamart (skip the inner disk, queue the 3–5 km rim). Dev-only `/probe` console and Vite `/api/probe` write plugin so a session does not hand-edit JSON. Coverage-collection write-up added to `ARCHITECTURE.md` §10.

**Not done today.** No new live M1 checks beyond the existing eight. `infer-hubs` wrote **0** rows — the only locality inside the MIDC inner disk already has a `probe`. `/probe` was verified via the state API, not a full browser click-through. The Vite server used for that check was stopped.

### Fetch strategies we discussed

**Keep**

| Method | Decision |
|---|---|
| **M1** | Real browser, set location on their public site, read the rendered UI. Only ground truth. |
| **M5** | Coarse grid, then bisect where neighbors disagree. For Zepto/Blinkit/Instamart: skip the inner disk; check the 3–5 km rim first. |
| **M4 two rings** | Inner ~2.5–3 km → inferred `available` (`source: seed`). Edge ~3–5 km → `partial` / live check. Do **not** publish 5–6 km as served. Overlapping stores = union of disks. Does not apply to Swiggy food, Zomato, Amazon, or Flipkart scheduled. |
| **M2 / M6** | 55 real pincodes and taluka-level polygons are enough to start checking. More GIS later. |
| **Assisted `/probe`** | Human still sets the location. The console only queues, copies the place string, opens the site, and writes JSON. |

**Ruled out / parked**

- Bare HTTP (already 500'd on Amazon).
- Scraping or replaying private serviceability endpoints / grid-sweeps.
- Amazon SP-API / Flipkart Seller as a consumer coverage map.
- Swiggy MCP / Builders Club as a citywide index (their terms: serve that user’s order, not analytics).
- Delhivery / Shiprocket pincode APIs as Zepto or Amazon Fast.
- Unattended Playwright against platform checkers.
- Licensed dark-store CSVs unless we pay and the license allows product use.

`/probe` is a **dev workbench**, not a user-facing screen. It is registered only when `import.meta.env.DEV` is true. It exists so recording a live check is one tap instead of editing two JSON files.

### Real data already in the JSON

Counted from the files on 2026-08-23. **Coverage that is actually live-checked: 1 locality × 8 platforms.** Everything else the app shows as coverage is placeholder and capped below Verified.

| File | Real | Not real / notes |
|---|---|---|
| `src/data/coverage.seed.json` | **8** `source: probe`, all `pimpri-chinchwad` / pincode **411018**, checked 2026-08-14: Swiggy, Instamart, Zepto, Blinkit, Zomato, Amazon, Flipkart, BigBasket — all `available` | **41** `seed-placeholder` (Shinde Vasti, Chikhali, Baner, Hinjewadi, Wagholi, Moshi, Talegaon, city-level Pune). **0** hub-inferred `seed` rows. **49** records total. |
| `src/data/checkpoints.log.json` | **8** rows, same 411018 × 8 platforms | — |
| `src/data/hubs.pune-pcmc.json` | **1** hub: Zepto MIDC, lat/lng from Nominatim “MIDC Pimpri” (road point, not a store door) | Blinkit / Instamart hubs: none |
| `src/data/pincodes.pune-pcmc.json` | **55** confirmed pins (39 PMC, 15 PCMC, 1 uncertain), each via `api.postalpincode.in` + Nominatim | Geography only — not coverage |
| `src/data/localities.pune.json` | **19** hand-curated places; Ravet and Gahunje have real coords | No coverage probes for Ravet / Gahunje |
| `src/data/platforms.json` | **15** catalogue rows | Uber, Ola, Rapido, Porter, Urban Company, PharmEasy, Dunzo untried (tier-2) |

The eight live checks (all `available`):

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

## Stack

React 18 + Vite + TypeScript (strict) + Tailwind, React Router, Leaflet/OpenStreetMap for maps, Vitest for unit tests. Android wrapper via Capacitor 7 (same `dist/` as the website). No backend — a mock adapter reads local JSON. See `ARCHITECTURE.md` §4/§6 for the intended phase-2 (Supabase) architecture and file layout.

## What's built

**Domain logic** (`src/domain/`) — the real engine, not just UI:
- `confidence.ts` / `resolve.ts`: the fallback ladder (exact locality → same pincode → nearest ancestor → unknown) and confidence scoring (recency decay by category, crowd agreement, source weight). A city-level guess can never score as "verified"; placeholder data is hard-capped at 0.69, one point below the verified threshold — see `ARCHITECTURE.md` §3.
- `search.ts`: locality search over name/alias/pincode, Devanagari-aware.
- 47 unit tests in `confidence.test.ts` / `resolve.test.ts` — **confirmed green this session** (`npx vitest run`, run directly, not just claimed). The `mergeReports` signature concern flagged in a previous session's notes is resolved — no longer an open gap.

**Data layer** (`src/api/`, `src/data/`):
- `types.ts` is the full contract (`Locality`, `Platform`, `Coverage`, `UserReport`, `ResolvedCoverage`, `AreaResult`, `MapPin`).
- `mockAdapter.ts` is the only module that touches `src/data/*` — swapping to a real backend means writing an `httpAdapter` with the same surface and changing one line in `client.ts`.
- Seed data: ~19 Pune-area localities (`localities.pune.json`), 15 platforms (`platforms.json`), 49 coverage records (`coverage.seed.json`) — 8 real (`source: "probe"`, Pimpri-Chinchwad), the rest `source: "seed-placeholder"`.
- `featuredCities.ts`: hardcoded home-screen city rail (9 cities) — only Pune's areas carry real `localityId`s; every other city's areas intentionally link to an unseeded id so Results shows its honest "we don't know this place yet" state instead of a fabricated answer.
- Pune+PCMC data-pipeline foundation: `pincodes.pune-pcmc.json`, `boundaries.pune-pcmc.geojson`, `checkpoints.log.json`, `hubs.pune-pcmc.json`, picker / record / infer scripts, and a dev-only `/probe` console.

**Screens** (`src/screens/`), all reachable and wired: `Home`, `Search`, `City`, `Results`, `PlatformDetail`, `Nearby`, `Saved`, `Account`, plus dev-only `Probe` at `/probe`. Only Home has been visually checked in a real browser across sessions; Results/PlatformDetail/Nearby/Saved/Account are still type-check/build-verified only — **still an open item, see "Where to pick up."**

**Assets**: 13 of 15 platform logos are real. 9 real landmark photos (`public/landmarks/`) via Wikipedia's REST API — **now has a real Wikimedia Commons attribution/credit line** under the city grid on Home (`src/screens/Home.tsx`), fixing a gap flagged in a previous session.

**Trust mechanics**: unchanged — thumbs up/down reporting recomputes confidence live and can promote a placeholder record past the verified threshold once enough real reports attach.

## What changed this session (uncommitted)

**Coverage pipeline (2026-08-23):** documented that no public yes/no API exists; added two-ring hub model (5–6 km is the outer maybe, not a guaranteed disk); seeded `src/data/hubs.pune-pcmc.json` from the Zepto MIDC probe note; picker is hub-edge biased for Zepto/Blinkit/Instamart; `record-check` / `infer-hubs` write JSON; dev-only `/probe` console records live checks without hand-editing. Infer currently writes 0 rows because the only locality inside the MIDC inner disk already has a `probe`.

A phased roadmap (Phase 0 → Phase 5) was designed, discussed, and approved — see "Roadmap" below. Phase 0 and part of Phase 1 were then implemented:

**Phase 0 — cleanup:**
- Deleted `src/components/MapPreview.tsx` (confirmed dead code, zero imports).
- Removed `TopBar.tsx`'s non-functional "Menu" hamburger button (had no `onClick`, no drawer existed) — clean deletion, `Icon` import still used by the back-button branch.
- Added a real Wikimedia Commons attribution line under the city grid on `Home.tsx`.
- Added `.github/workflows/ci.yml` — runs `npx tsc -b` + `npm test` on push/PR to `main`.
- Visual verification pass of Results/PlatformDetail/Nearby/Saved/Account: **not done yet** — dev server was started and handed to the user, but no confirmation received this session. Still open.

**Phase 1 steps 1-3 — Pune+PCMC data pipeline foundation** (the M2/M5/M6 methods from `ARCHITECTURE.md` §10, scoped concretely to Pune + Pimpri-Chinchwad per this session's discussion — see `ARCHITECTURE.md` §10's new "Status" subsection for full detail):
- `src/data/pincodes.pune-pcmc.json` — 55 real, individually-verified pincodes (39 PMC, 15 PCMC, 1 uncertain), each confirmed via `api.postalpincode.in` and geocoded via Nominatim. Real numbers corrected the original ~90-100 planning estimate downward — documented honestly in the file itself.
- `src/data/boundaries.pune-pcmc.geojson` — honest negative finding: no PMC/PCMC administrative polygon exists in OSM (verified two ways). File holds the coarser taluka-level polygons that do exist instead, clearly labeled, plus real city-center points. Getting an actual municipal boundary is an open follow-up (GIS portal / ward-map digitization / approximation from existing data), not yet attempted.
- `src/data/checkpoints.log.json` — checked-points log for the picker, auto-seeded from the 8 real Pimpri-Chinchwad probe records.
- `scripts/pick-next-check.mjs` — working M5 next-point picker (coarse farthest-point sampling, then boundary-bisection), scoped to 8 tier-1 platforms. Verified by running it directly.
- One-line mention of the new script added to `README.md`'s project-structure block.
- Confirmed `npx tsc -b` and `npx vitest run` (47/47) both still clean after all of the above, run directly, not just claimed by whoever did the work.

All of the above was independently spot-checked (files read, script actually run, tsc/vitest actually run) before being reported as done — worth knowing if you're deciding how much to trust this handoff note versus re-verifying yourself.

## Roadmap (approved this session)

Full detail lives in the session's plan discussion; this is the durable summary so a fresh session has it without needing external state.

| Phase | What | Status |
|---|---|---|
| **0** | Cleanup: dead code, non-functional UI, CI, Wikimedia attribution, visual verification pass | Mostly done — visual verification pass still open |
| **1** | Data completeness for Pune+PCMC: real pincode list (M2) + boundary data (M6) + next-point picker (M5) as foundation, then M1 browser-probing checks driven by the picker (tier-1 platforms first: Zepto, Blinkit, Instamart, Swiggy, Zomato, Amazon, Flipkart, BigBasket), then M4 hub-radius geocoding once a few hubs are calibrated | Foundation (steps 1-3) done; **actual checking (step 4) not resumed yet** |
| — | Legal/ToS review — gates scaling M1 checking volume and any future scheduled/unattended probing | Not started; needed before Phase 1 checking scales much further or Phase 4 automates probes |
| **2** | Backend: **Supabase** (Postgres + PostGIS + auth), chosen over Node/Express+Railway because `resolve.ts`/`confidence.ts` are already pure server-portable TS and can run unchanged as a Supabase Edge Function. Tables map 1:1 from `src/api/types.ts`; `src/api/httpAdapter.ts` swaps in via the one-line seam in `client.ts` | Not started |
| **3a** | Auth: stay anonymous-only through the Phase 2 cutover (carry `reporterId()` forward as Supabase anonymous sign-in) | Not started, gated on Phase 2 |
| **3b** | Auth: real accounts (Supabase Auth, magic link), only once Phase 4's report volume actually needs reporter-quality weighting | Not started, gated on Phase 4 |
| **4** | Crowdsourcing loop: move reports from `localStorage` to Supabase, admin screen to hand-correct coverage, real scheduled probes (distinct from today's manual `claude-in-chrome` sessions) | Not started, gated on Phase 2 live + legal review |
| **5** | Production readiness: deploy to Vercel/Netlify, brand/logo licensing review, confirm legal sign-off | Not started |

Dependency shape: Phase 0 and Phase 1's foundation (steps 1-3) have no dependencies and are done. Phase 1's checking (step 4) can resume any time. Phase 2 (backend) has no hard dependency on Phase 1 and could start in parallel. Phases 3-5 cascade after Phase 2.

## Real data collection

### Pimpri-Chinchwad (prior session, 2026-08-14)

8 platforms verified live for Pimpri-Chinchwad, written into `coverage.seed.json` as real records (`source: "probe"`, evidence `{positive:1, negative:0}`):

| Platform | Status | Real detail observed |
|---|---|---|
| Swiggy | available | Pizza Hut 20-25 min, Barbeque Nation 35-45 min |
| Swiggy Instamart | available | "6 Mins Delivery" |
| Zepto | available | "Delivery in 8 Mins", nearest store MIDC |
| Blinkit | available | "Delivery in 11 minutes" |
| Zomato | available | McDonald's 18 min, KFC 15 min |
| Amazon | available | pincode 411018 accepted, fast-delivery items shown |
| Flipkart | available | address confirmed to MIDC, Pimpri Colony, 411018 |
| BigBasket | available | "Delivery in 11 mins" to 411019 |

What actually worked: plain `fetch`/scripted HTTP does **not** work (Amazon 500'd on a bare request — bot/session protection). `claude-in-chrome` (real browser, real session, real rendering) does, and works on more platforms than originally assumed — Swiggy/Zomato/Zepto/Blinkit/Instamart all have genuine web ordering flows, not just the e-commerce sites originally assumed to be checkable.

`pune-ravet` and `pune-gahunje` localities were added with real pincode/coordinates (sourced from Wikipedia) but still have **no coverage data** — pending.

### Pune+PCMC pipeline foundation (this session, 2026-08-19)

Scoped the six data-acquisition methods from `ARCHITECTURE.md` §10 down from "nationwide" to specifically Pune + Pimpri-Chinchwad, per this session's discussion, and built the M2/M5/M6 foundation — see "What changed this session" above and `ARCHITECTURE.md` §10's "Status" subsection for full detail. Headline numbers: 55 real pincodes (not the ~90-100 originally guessed), no real PMC/PCMC boundary polygon exists in OSM (documented honestly, taluka-level fallback used instead), and a working next-point picker script.

**Not yet done**: no M1 checking has happened against this new systematic ordering yet — `node scripts/pick-next-check.mjs` currently just returns coarse-grid suggestions since only Pimpri-Chinchwad has data. Untried platforms remain untried (Uber, Ola, Rapido, Porter, Urban Company, PharmEasy, Dunzo — tier-2, lower priority by design).

## Known gaps / honest caveats

- **This session's work is uncommitted.** Working tree has real, verified changes (see "What changed this session") but nothing has been pushed or even locally committed — decide on that before layering more work on top.
- Only Pune-area localities have any real/seeded data; every other city in the home-screen grid is presentation-only by design (see `featuredCities.ts` comment) — intentional, not a bug.
- No PMC/PCMC administrative boundary polygon exists in OpenStreetMap — confirmed, not a fetch failure. `boundaries.pune-pcmc.geojson` uses coarser taluka-level polygons instead, clearly labeled. Getting a real municipal polygon is an open follow-up (GIS portal, ward-map digitization, or approximation), not attempted yet.
- The 55-pincode list is a verified floor, not a proven-exhaustive ceiling — PCMC's outer edge in particular may have pincodes outside the ranges swept.
- Instamart's logo is Swiggy's mark (no separate asset exists).
- Brand logos: standard fair-use territory for a directory app, but worth a skim of Amazon/Uber's brand guidelines before public launch (Phase 5 item).
- Visual verification of Results/PlatformDetail/Nearby/Saved/Account in a real browser is still outstanding — dev server was made available this session but not confirmed checked.
- No deployment target chosen yet (Phase 5 — Vercel/Netlify recommended once Phase 2's Supabase backend exists).
- Legal/ToS review for scaling `claude-in-chrome` probing volume has not happened — gates how far Phase 1's checking (step 4) and Phase 4's future scheduled probes should scale.
- A collaborator cloned the repo once (before this session) and initially saw a static, non-interactive Home page — resolved itself, root cause never confirmed, suspect stale `npm install`/Node version/browser cache rather than a repo problem if it recurs.

## Where to pick up

Roughly in priority order:
1. **Decide on committing this session's changes** (Phase 0 cleanup + Phase 1 foundation files) — nothing is committed yet.
2. **Resume Phase 1 checking**: `npm run dev` → `/probe`. For Zepto, the picker now skips the MIDC inner disk and queues the 3–5 km rim first. Food and e-commerce still use the coarse pin grid. Record store names when the UI shows them, then `npm run pipeline:infer`.
3. **Visually sanity-check** Results/PlatformDetail/Nearby/Saved/Account — `npm run dev`, phone-width viewport, still not done across any session so far. Per user preference, don't reach for the `claude-in-chrome` extension for this unprompted — hand over the localhost URL instead, unless asked.
4. **Calibrate hub radii** with rim checks around MIDC (and any new store names). `infer-hubs.mjs` already writes inner/edge disks — do not treat 5–6 km as served.
5. **Decide on Phase 2** (Supabase backend) timing — it has no hard dependency on Phase 1 finishing and could start in parallel if there's appetite.
6. Everything else — auth staging, crowdsourcing loop, production readiness — cascades after Phase 2 per the Roadmap table above.
