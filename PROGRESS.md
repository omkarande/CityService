# CityService — Progress & Resume Notes

> Session handoff doc. Read this first in a new session, then `ARCHITECTURE.md` for the full data model and reasoning (including §10's data-acquisition methods and their current Pune+PCMC status), then `DESIGN.md` for the original design tokens/spec this was built from. Git/PR/Render mistakes from the first deploy: [`GIT-AND-DEPLOY.md`](./GIT-AND-DEPLOY.md).

## Status (as of 2026-08-26)

Shared coverage API is in the repo: `server/` (Express + Postgres). On start the catalog **upserts** from JSON: named Pune localities, gap pincode centroids, platforms, and Zepto MIDC hub rings as `source: seed`. Live `/probe` rows and GPS places are kept. Public visitors stay login-free. `/probe` is team-password gated (`PROBE_SECRET`). Android wrap via Capacitor 7 (`android/`, same `dist/` as the website).

**Production is deployed** on Render (Web Service + existing PostgreSQL). Shipping branch is **`main`** (PR #3 from `om`); feature work is on **`om`**. Production API: `https://cityservice.onrender.com`. End-to-end smoke test of the live URL is **not done yet**. Pitfalls from the first deploy: [`GIT-AND-DEPLOY.md`](./GIT-AND-DEPLOY.md).

**Maps:** OSM / Leaflet / Photon / Nominatim / Overpass are **removed** from the live search/map path. Search and maps use Google Maps Platform:

| API | Role |
|---|---|
| Maps JavaScript API | Map canvas (Search + Nearby). Client key. |
| Places API (New) | Autocomplete, Place Details, Nearby Search (3 km labels). Server key. |
| Geocoding API | Show on map (forward) and reverse geocode when the pin is dragged. Server key. |

Do **not** enable Auth, OAuth consent, Data Access, Maps SDK for Android, Geolocation API, or Navigation Connect. GPS is Capacitor / browser geolocation.

**One Google Cloud key is enough** for now (all three APIs on that key). Put the same value in `VITE_GOOGLE_MAPS_KEY` and `GOOGLE_MAPS_SERVER_KEY`. Two keys later is a security split, not a Google requirement.

**Billing:** Maps stays grey (“for development purposes only” / “is this your website?”) until the Cloud project has an **active billing account with a payment method on file**. Claiming $300 credits then deleting auto-pay counts as no billing. Leave the payment method attached; use a **budget alert** instead. No OAuth setup is required.

**Coverage ring vs pin:** The user can search/drop a pin **anywhere in India**. The **3 km** circle is only (1) named POI labels around that pin, and (2) borrowing a nearby locality’s coverage (`NEARBY_KM = 3` in `src/domain/geo.ts`). It does not limit where the pin can go.

**Real live-checked coverage: 1 locality × 8 platforms** (Pimpri-Chinchwad, pincode 411018, 2026-08-14).

## Resume after reboot (copy-paste)

```bash
cd CityService
git status                 # confirm branch
npm install                # only if node_modules is missing
# .env already has keys locally; do not cp .env.example over it (would wipe secrets)
npm run dev:server         # → http://localhost:3000 (GOOGLE_MAPS_SERVER_KEY)
npm run dev                # → http://localhost:5173 (VITE_USE_API=true, VITE_GOOGLE_MAPS_KEY)
npx tsc -b
npm test
npm run cap:android        # APK; needs JDK 21; VITE_GOOGLE_MAPS_KEY from .env.production
```

Node 20+, npm 10+. **Do not commit** `.env`, `.env.production`, `login.json`, `record.json`, or real keys. `.env.example` is placeholders only.

### Where the keys live

| Variable | File / place | Used for |
|---|---|---|
| `VITE_GOOGLE_MAPS_KEY` | `.env` (Vite dev) and `.env.production` (APK / `vite build`) | Maps JavaScript in the browser / WebView |
| `GOOGLE_MAPS_SERVER_KEY` | `.env` (local Node) and **Render env** | Places + Geocoding via `/api/places/*` and `/api/geocode`, `/api/reverse` |
| `VITE_USE_API=true` | `.env` | Laptop talks to `dev:server` instead of seed JSON |
| `VITE_API_BASE` | `.env.production` | `https://cityservice.onrender.com` for the APK |
| `PROBE_SECRET` / `DATABASE_URL` | `.env` local; Render Internal URL in prod | Unchanged |

Native Android WebView is `https://localhost`. If the key uses HTTP referrer restrictions, allow `http://localhost:5173/*`, `http://127.0.0.1:5173/*`, and `https://localhost/*`. For early testing, Application restriction **None** is easiest.

- **Website (shared API locally):** both `dev:server` and `dev` with `VITE_USE_API=true`.
- **Render:** add `GOOGLE_MAPS_SERVER_KEY` or phone search/geocode will 503 even if the laptop works.
- **Android:** rebuild after changing `VITE_*` (`npm run cap:android`). Native shell: `overlay: false`, **no extra CSS status-bar pad** (`html.is-native-app .app-safe-top { padding-top: 0 }`).
- **UI copy:** no hyphen / en-dash / em-dash in user-visible strings (ETA is `3 to 6 min`, not `3-6 min`).

**Git.** `origin` → `github.com/omkarande/CityService`. User commits and pushes themselves.

## Session report — 2026-08-25 / 26 (Google Maps + native inset + UI dashes)

- Replaced OSM search/map with Google: `src/lib/googlePlaces.ts` (server), `src/lib/googleMaps.ts` + `GoogleMapCanvas.tsx` (client). Leaflet / `react-leaflet` uninstalled.
- Search: Places Autocomplete → Place Details on tap → map. “Show on map” is Geocoding. Nearby labels: Places Nearby Search, 3000 m around the **chosen** pin. Drag pin: Geocoding reverse.
- Removed Pune `locationBias` so search is India-wide. Pin can be dropped anywhere (map minZoom 5, maxZoom 21).
- Coverage `NEARBY_KM` 2 → **3**. Platform detail copy: “within 3 km”.
- Native top gap: Android already insets the WebView; extra 48 px CSS was empty space. Native `app-safe-top` is 0.
- Visible UI text: no `-` / `—` / `–` (Home banner, source line, recorded toast, ETA, seed notes that show on detail).
- APIs to enable: Maps JavaScript, Places API (New), Geocoding only.

## Session report — 2026-08-24 (API + search map + merge)

- Added `server/index.ts` + `server/store.ts`. Frontend `httpAdapter` in production; `mockAdapter` for Vite without `VITE_USE_API` (Google place methods return empty in mock mode).
- Unknown search → map → `/at?lat=&lng=&q=`. Resolver: exact pin → nearby specific place (now ≤3 km) → general suburb/city.
- Capacitor native shell + GPS; production native API base `https://cityservice.onrender.com`.
- PR #3 (`om` → `main`) merged. Render Web Service deploy succeeded after Windows lockfile / Linux `npm ci` issues (see `GIT-AND-DEPLOY.md`). Live site smoke test deferred.

## Session report — 2026-08-23 (Capacitor + pipeline)

**Capacitor 7 Android wrap.** Scripts: `npm run cap:sync` / `cap:android`. Needs **JDK 21**.

**Hub pipeline.** `src/data/hubs.pune-pcmc.json`, `scripts/lib/pipeline.mjs`, pick/record/infer. See `ARCHITECTURE.md` §10.

## Real data already in the JSON

Counted from the files on 2026-08-23. **Coverage that is actually live-checked: 1 locality × 8 platforms.** Everything else the app shows as coverage is placeholder and capped below Verified.

| File | Real | Not real / notes |
|---|---|---|
| `src/data/coverage.seed.json` | **8** `source: probe`, all `pimpri-chinchwad` / pincode **411018**, checked 2026-08-14: Swiggy, Instamart, Zepto, Blinkit, Zomato, Amazon, Flipkart, BigBasket — all `available` | **41** `seed-placeholder`. **0** hub-inferred `seed` rows at last infer. **49** records total. |
| `src/data/checkpoints.log.json` | **8** rows, same 411018 × 8 platforms | — |
| `src/data/hubs.pune-pcmc.json` | **1** hub: Zepto MIDC, lat/lng from Nominatim “MIDC Pimpri” (historical geocode; live map is Google) | Blinkit / Instamart hubs: none |
| `src/data/pincodes.pune-pcmc.json` | **55** confirmed pins (39 PMC, 15 PCMC, 1 uncertain) | Geography only — not coverage |
| `src/data/localities.pune.json` | **19** hand-curated places; display name **Pimpri Chinchwad** (hyphen kept as an alias) | No coverage probes for Ravet / Gahunje |
| `src/data/platforms.json` | **15** catalogue rows | Uber, Ola, Rapido, Porter, Urban Company, PharmEasy, Dunzo untried (tier-2) |

Eight live checks (all `available`):

| Platform | What was actually seen |
|---|---|
| Swiggy | Pizza Hut 20 to 25 min, Barbeque Nation 35 to 45 min |
| Instamart | “6 Mins Delivery” |
| Zepto | “Delivery in 8 Mins”, nearest store MIDC |
| Blinkit | “Delivery in 11 minutes” |
| Zomato | McDonald's 18 min, KFC 15 min |
| Amazon | pincode 411018 accepted; fast-delivery items shown |
| Flipkart | address confirmed to MIDC, Pimpri Colony, 411018 |
| BigBasket | “Delivery in 11 mins” to 411019 |

## What's built (app)

React 18 + Vite + TypeScript (strict) + Tailwind, React Router, Google Maps JS + Places (New) + Geocoding, Vitest. Android wrapper via Capacitor 7. Production backend: Express + Postgres (`server/`). Mock adapter still reads local JSON for Vite without `VITE_USE_API` (no live Google search in that mode).

**Domain logic** (`src/domain/`): `confidence.ts` / `resolve.ts` (exact → nearby specific ≤3 km → suburb/city; placeholder cap 0.69) / `search.ts` / `seedCatalog.ts`.

**Screens:** Home, Search, City, Results, PlatformDetail, Nearby, Saved, Account, plus team `Probe` at `/probe`. Search: autocomplete list first, then Google map. Home “use my location” uses Capacitor GPS on Android and opens `/at?lat=&lng=`.

**Trust mechanics:** thumbs up/down reporting recomputes confidence live on this device (`localStorage`).

## Roadmap

| Phase | What | Status |
|---|---|---|
| **0** | Cleanup: dead code, CI, Wikimedia attribution | Mostly done — visual verification pass still open |
| **1** | Data completeness for Pune+PCMC: pincodes, picker, then M1 checks, then M4 hub radii | Foundation done; **checking volume still thin** |
| — | Legal/ToS review — gates scaling M1 | Not started |
| **2** | Shared backend | **Express + Postgres on Render** (not Supabase). Live. |
| **2b** | Google Maps search/map | **Code landed.** Blocked on Cloud **billing** + Render `GOOGLE_MAPS_SERVER_KEY` until the watermark is gone. |
| **3a** | Auth: stay anonymous for public visitors | Done by design (Google OAuth not used) |
| **3b** | Real user accounts | Not started; not needed for public read |
| **4** | Crowdsourcing loop: move reports off `localStorage` | Not started |
| **5** | Production readiness: Render deploy, brand/logo licensing | **Render Web Service is live.** Visual/smoke test of the production URL, brand/logo review still open |

## Where to pick up (next session)

1. **Render:** set `GOOGLE_MAPS_SERVER_KEY`, wait for deploy. Then `npm run cap:android` so the APK has `VITE_GOOGLE_MAPS_KEY` from `.env.production`.
2. **Smoke-test production:** `/api/health`, Home / Search / a Results page, then `/probe` with `PROBE_SECRET`. Incognito should see a probe record with no login. First load may be slow if the service was asleep.
3. **Sanity-check search:** `mustard mart, shinde vasti, ravet` should land on the shop (or a precise pin), with nearby names around it — not Ravet’s centroid unless Places has no shop.
4. **Resume Phase 1 checking** at `/probe`. For Zepto, the picker skips the MIDC inner disk and queues the 3–5 km rim first.
5. **Visually sanity-check** Results / PlatformDetail / Nearby / Saved / Account (and native top: Pune flush under the status bar, no 48 px cream band).
6. **Calibrate hub radii** with rim checks around MIDC. Do not treat 5–6 km as served.

## Known gaps

- Google Maps will not look production-ready until billing stays attached.
- Only Pune-area localities have seeded coverage; other home-grid cities are presentation-only. A pin in another city is valid; answers may be empty.
- Tiny kiranas still missing from Places: keep “drop a pin”.
- No PMC/PCMC administrative boundary polygon in OSM — taluka-level fallback is documented (geography seed, not the live map).
- The 55-pincode list is a verified floor, not proven exhaustive for PCMC’s outer edge.
- Instamart’s logo is Swiggy’s mark.
- Brand logos: skim Amazon/Uber guidelines before public launch.
- Visual verification of several screens (and the live Render URL) is still outstanding.
- Legal/ToS review still gates unattended probing.
- Thumbs-up reports still live in `localStorage` on this device only.
