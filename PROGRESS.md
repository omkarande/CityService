# CityService — Progress & Resume Notes

> Session handoff doc. Read this first in a new session, then `ARCHITECTURE.md` for the full data model and reasoning, then `DESIGN.md` for the original design tokens/spec this was built from.

## What this is

A mobile-first web app: search a locality (down to a single vasti), see which delivery/ride/quick-commerce apps actually serve it, with a confidence rating and provenance for every answer. Full product framing is in `ARCHITECTURE.md`.

## Status: frontend prototype, running, no backend, mostly placeholder data — but real data collection has started

The app is fully built and functional. Almost all coverage data is still **hand-invented placeholder data**, except for one real, verified pocket — see "Real data collection" below, which is new this session and is the template for closing the rest of the gap.

## Resume in 60 seconds

```bash
cd CityService
npm install        # if node_modules isn't present
npm run dev         # → http://localhost:5173 (also on your LAN IP, for phone testing)
npx tsc --noEmit     # type-check
npm run build        # production build
npm test              # vitest — see "Known gaps" before trusting this
```

Node 20, npm 10. No `.env`, no external services, no accounts required — everything runs local.

**Git repo, pushed to GitHub.** `origin` → `github.com/omkarande/CityService`, `main` branch. Two commits: `Initial commit: CityService prototype`, then `UI changes` (the TopBar merge below). Working tree was clean and `main` in sync with `origin/main` as of this session's end.

## Stack

React 18 + Vite + TypeScript (strict) + Tailwind, React Router, Leaflet/OpenStreetMap for maps, Vitest for unit tests. No backend — a mock adapter reads local JSON. See `ARCHITECTURE.md` §4/§6 for the intended phase-2 (Supabase) architecture and file layout.

## What's built

**Domain logic** (`src/domain/`) — the real engine, not just UI:
- `confidence.ts` / `resolve.ts`: the fallback ladder (exact locality → same pincode → nearest ancestor → unknown) and confidence scoring (recency decay by category, crowd agreement, source weight). A city-level guess can never score as "verified"; placeholder data is hard-capped at 0.69, one point below the verified threshold — see `ARCHITECTURE.md` §3.
- `search.ts`: locality search over name/alias/pincode, Devanagari-aware.
- 45 unit tests in `confidence.test.ts` / `resolve.test.ts` — **last known-green before the `mergeReports` signature change** (see Known gaps).

**Data layer** (`src/api/`, `src/data/`):
- `types.ts` is the full contract (`Locality`, `Platform`, `Coverage`, `UserReport`, `ResolvedCoverage`, `AreaResult`, `MapPin`).
- `mockAdapter.ts` is the only module that touches `src/data/*` — swapping to a real backend means writing an `httpAdapter` with the same surface and changing one line in `client.ts`.
- Seed data: ~17 Pune localities (`localities.pune.json`), 15 platforms (`platforms.json`), ~40 coverage records (`coverage.seed.json`) — **all invented**, all `source: "seed-placeholder"`.
- `featuredCities.ts`: hardcoded home-screen city rail (9 cities) — only Pune's areas carry real `localityId`s; every other city's areas intentionally link to an unseeded id so Results shows its honest "we don't know this place yet" state instead of a fabricated answer.

**Screens** (`src/screens/`), all reachable and wired:
- `Home` — intro + search + "use my location" (GPS → nearest seeded locality), city grid (3×3 landscape photo tiles with real Wikimedia landmark photos, thin-bordered panel), live map preview with tap-to-search, recent/popular localities, "How it works", "What is CityService?" about section.
- `Results` — locality header, 4-way status count strip, category filter chips, platform cards (logo, status badge, confidence meter, caveat).
- `PlatformDetail` — status hero sentence, ETA/coverage facts, "how we know" provenance, thumbs up/down reporting that recomputes confidence live.
- `Nearby` — full Leaflet map, one pin per locality colored by coverage ratio.
- `Saved`, `Account` — localStorage-backed; Account has a "clear my reports" control and the demo-data warning.

**Assets**: 13 of 15 platform logos are real (`public/logos/`, fetched from each brand's own favicon/site — BigBasket and Dunzo fall back to initials tiles, no usable source found). 9 real landmark photos (`public/landmarks/`) via Wikipedia's REST API, self-hosted — **needs a proper Wikimedia Commons attribution/credits line before anything public-facing**; currently just a small "Photos via Wikimedia Commons" caption under the city grid.

**Trust mechanics** (the actual point of the product, not just a UI flourish):
- Every answer shows its confidence tier (Verified/Likely/Unconfirmed) and a plain-language caveat when the answer was inherited from a pincode or city rather than the exact locality.
- Reporting on the Platform Detail screen (thumbs up/down) writes to `localStorage`, and a placeholder record with enough real reports attached promotes past the placeholder ceiling and starts reading as "Verified" — demonstrable end-to-end on Shinde Vasti today.

## Real data collection (started this session)

The user's original objection to closing the data gap was scale: manual checking only covers their own location, and asking other people to help costs too much time/goodwill. Resolution: split the work by location, in parallel — the user checks **Ravet** (their home area) themselves; I checked **Pimpri-Chinchwad** via `claude-in-chrome` browser automation.

**What actually worked, empirically tested (not assumed):**
- Plain `WebFetch`/scripted HTTP requests **do not work** for this — Amazon's pincode-check flow returned an HTTP 500 on a bare fetch (bot/session protection). Confirmed dead end for a headless pipeline.
- `claude-in-chrome` (real browser, real session, real rendering) **does work**, and works on far more platforms than originally assumed. Original guess was that only Amazon/Flipkart/BigBasket/PharmEasy expose public checkers — wrong. **Swiggy, Zomato, Zepto, Blinkit, and Swiggy Instamart all have a real web ordering flow** where setting a location and reading back the rendered result (real restaurants/products/ETAs, not a generic page) is a completely genuine serviceability check. This meaningfully changes the pipeline plan — see `ARCHITECTURE.md` §3 pipeline section, worth revisiting.

**Result: 8 platforms verified live for Pimpri-Chinchwad on 2026-08-14**, written into `coverage.seed.json` as real records (`source: "probe"`, `evidence: {positive:1, negative:0}` — one real check, not inflated) at the top of the file, clearly separated from the placeholder block below by a `_verifiedNote`:

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

Bonus finding, not yet acted on: Flipkart's header showed **Flipkart Minutes** (their own quick-commerce arm, 13-min delivery) live at this address — not currently one of the 15 tracked platforms. Worth a call on whether to add it.

**New localities added** (real pincode/coordinates, sourced from Wikipedia, not guessed): `pune-ravet` (412101) and `pune-gahunje` (412101, MCA Cricket Stadium) in `localities.pune.json`. Neither has coverage data yet — Ravet is pending the user's own manual check; Gahunje and the "1-2 more locations" the user mentioned are still unassigned.

**Not yet checked for Chinchwad**: ride-hailing (Uber/Ola/Rapido — lower priority since these tend to be city-wide, not hyperlocal), Porter, Urban Company, PharmEasy, Dunzo.

Recommended next steps: get Ravet's data from the user, get the names of the remaining 1-2 locations, then repeat this same `claude-in-chrome` method for them. The technique is now proven — it's just repetition from here.

**Also this session, planning only (nothing implemented):** wrote up six methods for scaling data collection past one-locality-at-a-time manual/browser-automation checks — condensed version now in `ARCHITECTURE.md` §10, full narrative version was shared with the user as a standalone write-up (not stored in this repo). Headline recommendation: layer adaptive/binary-search sampling (bisect only where neighboring points disagree on coverage, cutting query volume ~70-90% vs a uniform grid) on top of the existing browser-automation probing, and geocode dark-store/hub addresses once so future quick-commerce coverage checks (Blinkit/Zepto/Instamart) become free local geometry instead of repeated probes. See `ARCHITECTURE.md` §10 for the full method comparison and phased plan — worth a team discussion before picking what to prototype next.

## Known gaps / honest caveats

- **`mergeReports` signature changed but the test suite was never re-run to confirm.** During this session `resolve.ts`'s `mergeReports` gained a third parameter (`targetAreaId`) so a report filed on Shinde Vasti attaches even when the displayed answer was inherited from Chikhali. `resolve.test.ts` was updated to match and `tsc --noEmit` is clean, but the user asked to skip running tests while focused on UI — **run `npm test` before relying on this.**
- Only Pune has real locality/coverage data. Every other city in the home-screen grid is presentation-only by design (see `featuredCities.ts` comment) — this is intentional, not a bug, but worth remembering before "why doesn't Delhi work" comes up.
- Instamart's logo is Swiggy's mark (no separate asset exists) — slightly hurts scannability between the Food and Quick Commerce rows.
- Brand logos are used for identification purposes in a directory app; standard fair-use territory, but worth a skim of Amazon/Uber's brand guidelines before any public launch.
- No CI. No deployment target chosen yet.
- **Home screen only** has now been visually verified in a real browser (`claude-in-chrome`, this session) — the TopBar-merge change renders correctly, scrolls correctly, bottom nav intact, no console errors, `tsc --noEmit` clean. Every other screen (Results, PlatformDetail, Nearby, Saved, Account) is still unverified visually — confirmed via `tsc`/build only. **User asked not to use the Claude-in-Chrome browser extension for now** — for future visual checks, run `npm run dev` and hand the user the localhost URL to view themselves rather than opening it via the extension, unless they ask for it again.
- A collaborator cloned the repo (after the `UI changes` commit) and initially saw a static, non-interactive Home page — no cards or clicks working. Root cause was **not** a repo/commit problem: `git status` was clean, `main` matched `origin/main` exactly (0 ahead/behind), `package-lock.json` is committed, `.gitignore` correctly excludes `node_modules`/`dist`/env files. Resolved itself without a confirmed root cause (their side reported "fine it is running now"). If this recurs with another collaborator: suspect a stale/incomplete `npm install`, wrong Node version, or a browser cache issue before suspecting the code — ask for the terminal output of `npm run dev` and the browser console (F12).

## Recent UI iteration (this session, chronological)

1. Built all 6 screens + full domain/API layer from scratch.
2. Added real platform logos (favicon-sourced, self-hosted).
3. Added city grid + landmark photos + about section + map click-to-search (in response to "make the home page more attractive").
4. Shrunk the hero, merged search+location into one line, dropped a redundant "Map" button, shrank the city grid to 4 cols.
5. City grid → 3 columns with landscape (3:2) tiles inside a thin-bordered panel; hero gradient band removed entirely and merged with the search row into one plain-background section, to stop the page reading as disconnected colored blocks.
6. Folded the standalone sticky `TopBar` into the hero card — the "CityService" wordmark + menu icon now live inside the same rounded card as the search/pitch section (`rounded-b-2xl`, `shadow-soft`), so brand and pitch read as one unit instead of a nav bar sitting on top of a separate block. `TopBar` itself is untouched and still used on every other screen (Results, PlatformDetail, Nearby, Saved, Account). Committed as `UI changes` (`0e9ebcf`), pushed to `main`.
7. **Most recent** (after a teammate's PR, `Restyle home around a cream header, pitch card, and grainy nav.`, merged as `31c7b97`): added a dedicated `/search` screen. Home's search bar now just opens it on focus, so Home stays a plain landing page (city grid + hero pitch only, no inline search state). `/search` shows the locality match list plus a compact map (`SearchMap.tsx`) that expands into a full-screen, zoomable picker with a draggable pin — tap anywhere or drag-and-drop resolves to the nearest tracked locality, reusing the same `api.nearest` logic `useMyLocation` already relied on. Also redesigned two other card surfaces per user feedback: the City screen's area rows (`AreaCard.tsx`) now show a two-letter initials avatar toned from the theme's `-fixed` palette (identity colour, deliberately decoupled from the red/amber/green status colour), a pincode/kind tag, and a plain-English coverage read (`coverageLabel()`); the Results screen dropped its 4-number stat grid in favour of an inline 0–5 star rating (`CoverageStars.tsx`, `starsFor()` / `starRatingLabel()`) right-aligned on the same line as the locality name. Not yet committed — left staged for the user to commit themselves.

Next UI feedback, if any, should build on state #7 above — that's what's currently live at `localhost:5173` (or whatever port Vite falls back to if that's taken).

## Where to pick up

No pending task list — everything asked for so far has been delivered. Natural next steps, roughly in priority order:
1. Get Ravet's real data from the user (they're checking it manually) and the names of the remaining 1-2 locations; repeat the `claude-in-chrome` method from "Real data collection" above for those.
2. Visually sanity-check the other five screens (Results, PlatformDetail, Nearby, Saved, Account) in a real browser — only Home has been checked so far. Per this session's feedback, don't reach for `claude-in-chrome` for this unprompted; run `npm run dev` and let the user drive, or ask before using the extension again.
3. Run `npm test`, fix anything the `mergeReports` signature change broke.
4. Decide which of the six data-acquisition methods in `ARCHITECTURE.md` §10 to prototype first — the doc recommends starting with adaptive sampling layered on the existing probing method, plus hub-geocoding for quick-commerce.
5. Everything else is incremental UI polish or phase-2 backend work — see `ARCHITECTURE.md` §4/§7/§9 for the planned shape of that.
