# CityService — Architecture & Data Model

> Status: planning doc. Written before any app code exists.
> Current repo contents: `DESIGN.md` (design tokens), `code.html` (static mockup), `screen*.png` (UI references).

---

## 1. What the product is

**One sentence:** Enter a location, see which service apps actually work there.

Every quick-commerce, delivery, and ride-hailing platform has an internal serviceability map. None of them expose it. The only way to find out whether Zepto delivers to Shinde Vasti today is to install Zepto, sign up, add the address, and get rejected. CityService is the missing public index of that coverage.

**Primary user:** someone in a peri-urban / outskirt / tier-2 locality — new townships, villages absorbed into a city's edge, areas just outside the delivery radius. Also: anyone evaluating a flat or an area before moving in.

**What it is not:** not a listing of shops or restaurants (Google Maps does that), not a booking app. It answers exactly one question — *is this platform live at this spot, and how sure are we?*

### The differentiator is honesty about the data

We will often not know. The design already gets this right (`screen2.png` shows "Last Updated" and "Source"). Every answer carries **provenance** and **confidence**, and the UI never shows a bare green tick for something we inferred from city-level data. That trust surface is the product.

---

## 2. Domain model

Six entities. These types are the contract — the frontend codes against them from day one, and the backend later serves exactly this shape.

```ts
// ---------- Geography ----------

type AreaKind = 'city' | 'suburb' | 'locality' | 'village' | 'pincode';

interface Locality {
  id: string;              // 'pune-chikhali-shinde-vasti'
  name: string;            // 'Shinde Vasti'
  aliases: string[];       // ['Shinde Wasti', 'शिंदे वस्ती']
  kind: AreaKind;
  parentId: string | null; // 'pune-chikhali' -> 'pune'
  pincode: string | null;  // '411062'
  city: string;            // 'Pune'
  state: string;           // 'Maharashtra'
  center: { lat: number; lng: number };
  bbox?: [number, number, number, number];
}
```

Disambiguation matters: there are several "Shinde Vasti"s in Maharashtra. Search results must always render the parent chain — *Shinde Vasti · Chikhali · Pune · 411062*.

```ts
// ---------- Platforms ----------

type CategoryId =
  | 'ride-hailing' | 'bike-taxi' | 'food-delivery' | 'quick-commerce'
  | 'grocery' | 'ecommerce' | 'courier' | 'home-services' | 'pharmacy';

interface Platform {
  id: string;          // 'zepto'
  name: string;        // 'Zepto'
  categoryId: CategoryId;
  logoUrl: string;
  brandColor: string;
  website: string;
  deeplink?: string;   // to hand the user off once they know it works
}
```

```ts
// ---------- Coverage: the core record ----------

type CoverageStatus = 'available' | 'partial' | 'unavailable' | 'unknown';
type SourceKind     = 'official' | 'probe' | 'seed' | 'user-report' | 'seed-placeholder';

interface Coverage {
  platformId: string;
  areaId: string;              // Locality.id this was recorded against
  status: CoverageStatus;
  source: SourceKind;
  lastVerifiedAt: string;      // ISO
  evidence: { positive: number; negative: number };
  details?: {
    etaMinutes?: [number, number];   // [3, 7]
    coverageStrength?: 'wide' | 'partial' | 'edge';
    deliveryFee?: number;
    minOrder?: number;
    note?: string;                    // 'Only until 10pm'
  };
}
```

```ts
// ---------- User reports (the freshness engine) ----------

interface UserReport {
  id: string;
  platformId: string;
  areaId: string;
  verdict: 'works' | 'not-working';
  reportedAt: string;
  note?: string;
  atLocation: boolean;   // was the reporter physically inside the area? weighted higher
  reporterId: string;    // anon device id in v1
}
```

```ts
// ---------- What the API actually returns to a screen ----------

interface ResolvedCoverage {
  platform: Platform;
  status: CoverageStatus;
  confidence: number;                              // 0..1
  tier: 'verified' | 'likely' | 'unconfirmed';
  resolvedFrom: 'exact' | 'pincode' | 'polygon' | 'city' | 'none';
  lastVerifiedAt: string | null;
  source: SourceKind;
  details?: Coverage['details'];
}

interface AreaResult {
  locality: Locality;
  results: ResolvedCoverage[];
  generatedAt: string;
}
```

---

## 3. Coverage resolution

The interesting logic. Given `(localityId, platformId)`, walk a **fallback ladder** and degrade confidence at each step down:

| Step | Match | `resolvedFrom` | Confidence multiplier |
|---|---|---|---|
| 1 | Coverage record on this exact locality | `exact` | 1.0 |
| 2 | Record on a *different* locality sharing the pincode | `pincode` | 0.8 |
| 3 | Point-in-polygon against a coverage shape *(phase 2, PostGIS)* | `polygon` | 0.9 |
| 4 | Record on the nearest ancestor — suburb, then city | `city` | 0.45 |
| 5 | Nothing | `none` | → status `unknown` |

Step 4 walks the whole parent chain rather than jumping straight to the city, so a Pimpri-Chinchwad record beats a Pune one for a locality inside PCMC. The path is still labelled `city`; `resolvedAreaName` carries which ancestor actually answered.

Then score (implemented in `src/domain/confidence.ts`):

```
recency   = 2 ^ (-daysSinceVerified / halfLife[category])   // exactly 0.5 at one half-life
              quick-commerce 60d · food-delivery 90d · grocery 120d
              ride-hailing / bike-taxi / courier / home-services / pharmacy 180d
              ecommerce 365d
agreement = (positive + 1) / (positive + negative + 2)      // Laplace smoothed
volume    = min(1, (positive + negative) / 5)
crowdLift = 0.5 × volume × (2×agreement − 1)                // −0.5 .. +0.5
sourceW   = official 1.0 | probe 0.8 | seed 0.6 | user-report 0.5 | seed-placeholder 0.45

weight     = clamp(sourceW + crowdLift, 0.1, 1)
confidence = weight × recency × ladderMultiplier
```

Evidence is counted **relative to the recorded status**: `positive` corroborates whatever the record says, `negative` contradicts it. So an `unavailable` record with nine positives means nine people agreed it does not work there. This keeps one formula working across all four statuses.

Crowd corroboration sits inside `weight` rather than as a separate factor, which means a strong crowd consensus can lift a weak source — twenty people agreeing *is* verification, regardless of where the claim originally came from.

Bucket into the badge the UI shows:

- `confidence >= 0.70` → **verified** — solid colour badge
- `0.40 – 0.70` → **likely** — outlined badge + "based on city-level data" / "last checked 4 months ago"
- `< 0.40` → **unconfirmed** — grey, with a prominent "Do you know? Tell us" CTA

A city-level inference can never reach `verified` — the 0.45 ladder multiplier caps it below the threshold no matter how good the underlying record is. That's deliberate: it's the rule that keeps us from lying. Both invariants are locked down by tests in `src/domain/resolve.test.ts`.

### Seed data honesty

The prototype ships with hand-entered Pune data marked `source: 'seed-placeholder'`. **This is illustrative, not researched** — it is not a claim about real coverage. Three things enforce that:

1. A persistent, non-dismissible banner at the top of the app.
2. A hard ceiling of **0.69** on any placeholder-sourced confidence, one point below the `verified` threshold. Placeholders can read as "likely" so the UI is demonstrable, never as verified.
3. The ceiling lifts only when **real user reports** attach to the record — at which point `mergeReports` swaps the effective source to `user-report`, because it is now humans carrying the claim rather than the placeholder.

That third rule is also the best demo of the mechanic: tapping "Yes, it works" a few times visibly moves a card from *likely* to *verified*. Before launch, every placeholder must be replaced by a real record.

---

## 4. Architecture, in three phases

### Phase 1 — Frontend prototype (what we build now)

- **React 18 + Vite + TypeScript + Tailwind**, porting the tokens out of `DESIGN.md`
- **Mobile-first.** Phone-width layout is the design target; on desktop it renders centred in a max-`420px` column
- Seed JSON in `src/data/`, shaped as the exact API response
- All data access goes through **one module**, `src/api/client.ts`. Local Vite uses `mockAdapter`; production (and `VITE_USE_API=true`) uses `httpAdapter`
- Resolution logic lives in `src/domain/resolve.ts`, pure functions, **portable to the server unchanged**
- Saved locations + queued user reports in `localStorage`
- Map: **Leaflet + OpenStreetMap** tiles (free, no API key, no billing setup)

### Phase 2 — Backend (this cut)

**Render Web Service (Node 20 + Express) + Render PostgreSQL.** `DATABASE_URL` and `PROBE_SECRET` are env vars. The public site stays login-free; only `/probe` write routes require the team password (httpOnly cookie after `POST /api/probe/login`, or `Authorization: Bearer`).

Tables map 1:1 to the types above: `categories`, `localities`, `platforms`, `coverage`. Resolution runs server-side (`src/domain/resolve.ts`) and returns `AreaResult`. User reports and PostGIS polygons are still out of scope.

Local `npm run dev` can keep seed JSON, or set `VITE_USE_API=true` and run `npm run dev:server`.

### Phase 3 — Keeping it true

- Crowdsourcing loop: report → recompute confidence → surface the change
- Lightweight admin screen to seed and correct coverage
- Serviceability probes, run as a scheduled job. Corrected understanding as of 2026-08-14 (see `PROGRESS.md` "Real data collection"): a bare HTTP fetch does not work here — Amazon's checker 500'd on a plain request — but a real browser session does, and works on more platforms than expected. Swiggy, Zomato, Zepto, Blinkit, and Instamart all have a genuine web ordering flow (set a location, read back real rendered restaurants/products/ETAs), not just the e-commerce sites (Amazon, Flipkart, BigBasket) originally assumed. Automating this at real volume is a ToS question, not a security one — worth legal review before scaling past occasional manual-triggered checks.

---

## 5. Screens

Brand-level lists, per `screen3.png` — the categories-only variant in `screen1.png` is superseded. Categories become **filter chips**, not the list items.

| Route | Screen | Notes |
|---|---|---|
| `/` | Home | City grid, hero pitch; search bar opens `/search` on focus, "use my location" |
| `/search` | Search | Locality match list + a compact map that expands into a full-screen, zoomable picker with a draggable pin |
| `/city/:cityId` | City | Area list for a featured city — Pune's areas carry real coverage data, every other city is presentation-only |
| `/l/:localityId` | Results | Locality header with inline star rating, category chips, platform cards with status badges |
| `/l/:localityId/:platformId` | Platform detail | `screen2.png` — ETA, coverage, last updated, source, thumbs up/down |
| `/nearby` | Map | Leaflet, coverage pins around you |
| `/saved` | Saved | localStorage-backed |
| `/account` | Account | Stub in v1 |

---

## 6. File structure

```
src/
  api/
    client.ts          // picks httpAdapter vs mockAdapter
    httpAdapter.ts     // fetch /api/*
    mockAdapter.ts     // reads src/data, applies resolve()
    types.ts           // the interfaces in §2
  domain/
    resolve.ts         // fallback ladder + confidence  (server-portable)
    confidence.ts
    search.ts          // fuzzy locality match over aliases
  data/
    localities.pune.json
    platforms.json
    coverage.seed.json
  components/
    AppShell.tsx  TopBar.tsx  BottomNav.tsx
    SearchBar.tsx  LocalityCard.tsx
    PlatformCard.tsx  StatusBadge.tsx  ConfidenceNote.tsx
    CategoryChips.tsx  MapView.tsx
  screens/
    Home.tsx  Results.tsx  PlatformDetail.tsx
    Nearby.tsx  Saved.tsx  Account.tsx  Probe.tsx
  theme/
    tokens.ts          // ported from DESIGN.md
server/
  index.ts             // Express: public GET + team POST /api/probe/*
  store.ts             // Postgres or in-memory
```

## 7. Frontend build order

1. Scaffold Vite + TS + Tailwind, port `DESIGN.md` tokens, build `AppShell` / `TopBar` / `BottomNav`
2. Write the types and seed data — Pune, ~15 localities × ~14 platforms
3. `resolve.ts` + `confidence.ts` with unit tests (pure logic, cheap to test, hard to debug later)
4. `mockAdapter` + `client`
5. Home → search → Results (the core loop; usable end-to-end at this point)
6. Platform detail + report buttons
7. Saved, then Nearby/map last (heaviest, least essential)

---

## 8. Decisions taken

Made now so the build isn't blocked; each is cheap to revisit:

- **React + Vite + TS + Tailwind** — matches the existing Tailwind mockup
- **Pune as seed city** — matches the driving example (Shinde Vasti, Chikhali)
- **Brand-level cards, categories as filters** — `screen3.png` over `screen1.png`
- **Leaflet + OSM** for maps — no API key, no billing
- **Render Node + Postgres** for shared coverage (not Supabase, for this cut)

## 9. Open questions

- **Auth:** anonymous device-id reports only, or accounts? (Anonymous is fine for v1; accounts matter for report quality later)
- **Coverage granularity:** locality + pincode gets us far. Polygons are more accurate but need real boundary data — worth it only once we have real coverage data to draw
- **Cold start:** which real localities do we verify by hand first, and how? This is the actual gate on launching, not any of the code above

## 10. Data acquisition methods (beyond one-at-a-time manual checks)

Planning only, written up 2026-08-15 for team review — nothing here is implemented yet. The `claude-in-chrome` browser-automation probing described in §3 / `PROGRESS.md`'s "Real data collection" (used to verify 8 platforms for Pimpri-Chinchwad) is one instance of a broader family of methods. Six approaches, ordered by what they cost to run once built:

| # | Method | Marginal cost | Automation | Accuracy | Best for |
|---|---|---|---|---|---|
| M1 | Call each platform's own serviceability endpoint directly — what the browser-automation probing already does | Free per call, high maintenance | Full, but brittle — undocumented endpoints break without notice | Ground truth | Calibration / spot checks, not bulk |
| M2 | Sweep known pincode centroids (public dataset, ~19k pincodes India-wide) instead of an arbitrary coordinate grid | Free data | Full | Good in dense areas, weaker where one pincode spans a large area | First citywide pass |
| M3 | Extract a platform's own coverage polygon/geofence, if one is exposed by its map UI | Free if it exists | Full, if found | Exact, when available | Opportunistic upgrade — don't plan a timeline around it |
| M4 | Geocode dark-store/hub addresses once, compute coverage as radius geometry | Near zero after setup | Full after a one-time calibration against M1 | Approximate — real coverage isn't a perfect circle | Scaling quick-commerce coverage checks for free |
| M5 | Adaptive/binary-search sampling — coarse grid first, then bisect only where neighboring points disagree | Cuts M1/M2 query volume roughly 70-90% | Full — it's an algorithm layered on M1 or M2 | High exactly at the served/not-served boundary, which is what matters | The sampling strategy to run on top of M1 or M2, not a data source itself |
| M6 | Sample real locality/ward polygons (OSM Overpass API, municipal GIS portals) instead of raw coordinates | Free, one-time GIS effort | Full — boundaries rarely change | High representativeness, matches how localities are named in the app | Turning raw sample points into locality-level results |

**Recommended path**, extending the pipeline note in §3: keep M1 (browser-automation probing) as the sparse ground-truth/calibration layer. Add M6 (real locality boundaries) + M5 (adaptive sampling) on top of M1/M2 for cheap, boundary-accurate citywide coverage — this is the direct answer to "cheapest method that's still automatable and accurate." Add M4 once a handful of quick-commerce hubs are calibrated against M1, making future Blinkit/Zepto/Instamart checks free (pure local geometry, no network call). Keep an eye out for M3 while reverse-engineering each platform for M1, but don't depend on it.

**Before scaling M1 or M3 past occasional manual-triggered checks**: both call private endpoints built for these platforms' own frontends, not for outside use. Rate-limit deliberately, expect breakage without notice, and get a ToS/legal read before automating at real volume — the same caution §3's pipeline note already flags, worth repeating here since it applies to the whole family, not just the one method already in use.

**Recommended path**, extending the pipeline note in §3: keep M1 (browser-automation probing) as the sparse ground-truth/calibration layer. Add M6 (real locality boundaries) + M5 (adaptive sampling) on top of M1/M2 for cheap, boundary-accurate citywide coverage — this is the direct answer to "cheapest method that's still automatable and accurate." Add M4 once a handful of quick-commerce hubs are calibrated against M1, making future Blinkit/Zepto/Instamart checks free (pure local geometry, no network call). Keep an eye out for M3 while reverse-engineering each platform for M1, but don't depend on it.

**Before scaling M1 or M3 past occasional manual-triggered checks**: both call private endpoints built for these platforms' own frontends, not for outside use. Rate-limit deliberately, expect breakage without notice, and get a ToS/legal read before automating at real volume — the same caution §3's pipeline note already flags, worth repeating here since it applies to the whole family, not just the one method already in use.

### Status: Pune + PCMC pipeline foundation (built 2026-08-19)

Scoped M2/M5/M6 down from "nationwide" to specifically Pune Municipal Corporation (PMC) + Pimpri-Chinchwad Municipal Corporation (PCMC), since that's the actual near-term area of interest. Concrete findings, not estimates:

- **M2 — `src/data/pincodes.pune-pcmc.json`**: 55 real pincodes (39 PMC, 15 PCMC, 1 left `"uncertain"` rather than force-classified), each individually confirmed via `api.postalpincode.in` (not scraped in bulk — verified one pincode at a time) and geocoded via Nominatim. This is fewer than the ~90-100 originally guessed in planning discussion — corrected downward once actually checked, per this project's own data-honesty principle. Treat 55 as a verified floor: the sweep covered 411xxx fully plus a 412xxx candidate band, not proven exhaustive for PCMC's outer edge.
- **M6 — `src/data/boundaries.pune-pcmc.geojson`**: honest negative result — **neither PMC nor PCMC has an administrative boundary polygon in OpenStreetMap**, verified two independent ways (Overpass relation search, Nominatim lookup). What the file actually holds is the coarser admin_level-6 taluka polygons that do exist (Pune City + Haveli subdistricts), clearly labeled as coarser than a true municipal boundary, plus real city-center points. Getting an actual PMC/PCMC polygon needs one of: the municipal corporations' own GIS portals, digitizing an official ward map, or an approximation from taluka ∩ seeded-locality points — none attempted yet, flagged as an open follow-up rather than faked.
- **M5 — `scripts/pick-next-check.mjs`**: working next-point picker (farthest-point coarse sampling, then boundary-bisection where neighboring pincodes disagree), scoped to the 8 tier-1 platforms (`zepto`, `blinkit`, `instamart`, `swiggy`, `zomato`, `amazon`, `flipkart`, `bigbasket`) agreed as the first priority tier over ride-hailing/courier/home-services. Auto-seeds `src/data/checkpoints.log.json` from the real Pimpri-Chinchwad `source: "probe"` records already in `coverage.seed.json`. Run via `node scripts/pick-next-check.mjs [count]`.

M1 checking (actually probing the suggested pincode/platform pairs via `claude-in-chrome`) has not resumed yet using this new systematic ordering — see `PROGRESS.md` for current status and next steps.

### Coverage collection (how we get yes/no, not just places)

None of the eight first-wave platforms publish a public “do you deliver to this pincode?” API for a third-party directory. Seller APIs, Swiggy MCP, and courier pincode APIs answer a different question. Bare HTTP already failed. So coverage is still collected by watching each platform’s **own public website** after setting a location (M1). Geography fetch scripts cannot download this.

**What a live check looks at**

| Category | Platforms | Available | Partial | Unavailable |
|---|---|---|---|---|
| Quick-commerce | Zepto, Blinkit, Instamart, BB Now | storefront + products + ETA | thin catalogue / very long ETA | not-in-your-area |
| Food | Swiggy, Zomato | real restaurant list with ETAs | few far kitchens, 45–60+ min | location rejected |
| E-commerce | Amazon, Flipkart, BigBasket scheduled | pincode accepted + a delivery promise | accepted, only slow shipping | cannot deliver |

Always write `source: "probe"`. Captcha / login wall / empty mess → `unknown`. If the UI names a dark store, write that name into `src/data/hubs.pune-pcmc.json`.

**Two-ring hub model (M4) — Zepto / Blinkit / Instamart only**

Coverage is “stores + a short bike ride,” not a city switch. A flat 5–6 km “everywhere deliverable” circle over-claims on the outskirts.

| Distance to nearest same-platform store | Status we infer | Source |
|---|---|---|
| 0–inner (~2.5–3 km) | `available`, `coverageStrength: wide` | `seed` until an M1 check exists |
| inner–edge (~3–5 km) | `partial`, `coverageStrength: edge` | `seed`, then replace with `probe` when checked |
| beyond edge (~5 km+) | do **not** invent `unavailable` | we may not know every store yet |

Defaults: Zepto `innerKm: 2.5` / `edgeKm: 4.5`; Blinkit and Instamart `3` / `5`. After a few live points around the same hub, replace those defaults with that store’s measured radius. Overlapping stores are a union of disks. This model does **not** apply to Swiggy food, Zomato, Amazon, or Flipkart scheduled.

**Assisted probe loop**

1. `/probe` (password-gated in production via `PROBE_SECRET`) or `node scripts/pick-next-check.mjs` — M5, hub-edge biased for q-comm (skip the inner disk; check the rim).
2. Open the platform site, set the copied place string in **their** location picker.
3. Record in `/probe` → Postgres (or local Vite `probeStore` + JSON when `VITE_USE_API` is unset). Optional hub name into `src/data/hubs.pune-pcmc.json`.
4. `node scripts/infer-hubs.mjs` writes `source: seed` disks. Never overwrites a `probe`. Never marks geometry as `verified`.

Team UI: [http://localhost:5173/probe](http://localhost:5173/probe) locally, or `/probe` on Render. CLI aliases: `npm run pipeline:pick` / `pipeline:record` / `pipeline:infer`. Do not add unattended Playwright against platform checkers.

