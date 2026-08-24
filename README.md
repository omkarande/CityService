# CityService

Search a locality — right down to a single vasti or society — and see which delivery, ride-hailing, and quick-commerce apps actually serve it, with a confidence rating and provenance for every answer.

Every quick-commerce, delivery, and ride-hailing platform keeps its own private map of where it actually works, and none of them show it to you until after you've installed the app, signed up, and typed in your address. CityService is the missing public index of that coverage.

> **Status:** public app is login-free and **deployed on Render** (Node API + Postgres). `/probe` is locked with a team password. Live-URL smoke testing is still pending. Local `npm run dev` still uses seed JSON unless `VITE_USE_API=true`. Most coverage data is still placeholder, clearly marked in the UI. **After a reboot, start at [`PROGRESS.md`](./PROGRESS.md)**.

![CityService screens](./screen3.png)

## Features

- **Search** a locality by name, alias, or pincode (Devanagari-aware), or drop a pin on a map to find the nearest tracked locality
- **Coverage report** per locality: every tracked platform, its status (available / partial / unavailable / unknown), ETA, and a confidence tier (Verified / Likely / Unconfirmed) — a city-level guess can never read as "Verified"
- **Provenance for every answer**: how the answer was resolved (exact locality → same pincode → nearest ancestor) and when it was last checked
- **"Use my location"** — GPS to nearest tracked locality
- **Crowd reporting** — thumbs up/down on any platform recomputes its confidence live
- **Saved localities** and recents, stored locally

## Tech stack

React 18 + Vite + TypeScript (strict) + Tailwind CSS, React Router, Leaflet/OpenStreetMap for maps, Vitest for unit tests. Production is a Node 20 Express server (`server/`) that serves the Vite `dist/` and `/api/*`, with PostgreSQL for shared coverage. The public site has no user accounts. The same `dist/` is wrapped for Android via Capacitor 7.

## Getting started

```bash
npm install
cp .env.example .env   # set PROBE_SECRET; DATABASE_URL optional locally
npm run dev            # → http://localhost:5173 (seed JSON; also on your LAN IP)
```

To exercise the shared API locally (in-memory store unless `DATABASE_URL` is set):

```bash
# terminal 1
npm run dev:server     # → http://localhost:3000

# terminal 2 — .env must contain VITE_USE_API=true
npm run dev            # Vite proxies /api to :3000
```

Other useful commands:

```bash
npx tsc -b       # type-check the frontend
npm run build    # production frontend into dist/
npm start        # serve dist/ + /api (after a build)
npm test         # vitest
```

Requires Node 20+ and npm 10+.

## Android (Capacitor)

The website is unchanged. Capacitor wraps the same Vite `dist/` in a native Android shell so you can install an APK / later publish to Play Store. One codebase, two outputs.

```bash
npm run cap:sync      # production build + copy into android/
npm run cap:android   # sync, then run on a device or emulator
```

Needs **JDK 21** and Android Studio (an emulator or a phone with USB debugging). Capacitor 7’s Gradle build will not compile on JDK 17. First-time setup: open the `android/` folder in Android Studio, set Gradle JDK to 21, and let it sync.

Play Store listing, signing keys, and a privacy-policy URL for the location permission are a later step — not required to run the APK locally.

## Deploy on Render

The app **is deployed** as a Render **Web Service** (not a Static Site) plus the existing **PostgreSQL**. Static hosts cannot write a database.

If you recreate the service:

1. Create a PostgreSQL instance and copy `DATABASE_URL` (or attach the instance you already have).
2. Create a Web Service from this repo, branch **`main`**, root directory = repo root, Node 20.
3. **Build:** `npm install --include=dev && npm run build`  
   (`--include=dev` is required so Vite/TypeScript are present even when `NODE_ENV=production`. Use `npm install`, not `npm ci` — the lockfile is generated on Windows, and Linux `npm ci` then fails on optional Rollup/esbuild binaries.)
4. **Start:** `npx tsx server/index.ts`
5. Env vars: `DATABASE_URL` (Internal URL on the Web Service), `PROBE_SECRET`, `NODE_ENV=production`.
6. Health check path: `/api/health` (already set in `render.yaml`).

If the Postgres instance **already exists**, create the Web Service and set `DATABASE_URL` to that instance’s **Internal** URL. Do not apply the Blueprint on top — it would try to create a second database named `cityservice-db`.

On every start the server **upserts** seed JSON (named localities, gap pincodes, platforms, inferred hub rings). Live `/probe` rows and GPS places are never deleted. JSON never overwrites `source: probe`.

There is a [`render.yaml`](./render.yaml) Blueprint if you prefer that. An **existing** service uses the dashboard Build Command; changing `render.yaml` locally does nothing until you push **and** the dashboard matches. Set `PROBE_SECRET` in the dashboard (it is marked `sync: false`). Share the password in a password manager, not in git. Change it if it leaks.

**Smoke test (still pending):** open `/api/health`, the homepage, search a place, then `/probe` with the team password. Confirm an incognito window sees a new record on Results with no login. The Account screen does not link to `/probe` in production — bookmark the URL.

Free/starter web services sleep; Postgres data stays. The first request after sleep is slow.

## Project structure

```
src/
  api/        client.ts picks httpAdapter (production) or mockAdapter (local Vite)
  domain/     pure resolution/confidence/search logic — also imported by the server
  data/       seed JSON: Pune localities, platforms, coverage records
  components/ shared UI pieces (cards, map, chips, badges...)
  screens/    one file per route
  lib/        localStorage, GPS helper, Capacitor native shell
android/      Capacitor Android project — same dist/ as the website
server/       Express + Postgres (or in-memory if DATABASE_URL is unset)
scripts/
  pick-next-check.mjs   next (pincode, platform) to check — also `npm run pipeline:pick`
  record-check.mjs      write a live check into checkpoints + coverage
  infer-hubs.mjs        apply Zepto/Blinkit/Instamart inner/edge disks
```

Coverage checks: `/probe` (team password in production). Copy the place string, set it on the platform site, record. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §10.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full data model, the coverage-resolution algorithm, and how the API is wired.

## Docs

- [`PROGRESS.md`](./PROGRESS.md) — **start here after closing the laptop** (resume commands, real-data inventory, next steps)
- [`GIT-AND-DEPLOY.md`](./GIT-AND-DEPLOY.md) — git branches, PR/CI, and Render pitfalls from the first production deploy
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data model, confidence/resolution, §10 collection methods
- [`DESIGN.md`](./DESIGN.md) — original design tokens/spec

## Known limitations

- Only Pune has real locality data seeded; every other city on the home screen is presentation-only by design
- Most Pune coverage records are placeholder data (`source: "seed-placeholder"`), capped below the "Verified" confidence tier so the demo never overstates certainty — a handful of localities have real, verified checks (see `PROGRESS.md`)
- Thumbs-up reports still live in `localStorage` on this device only
- Without `DATABASE_URL`, the Node server uses an in-memory store that resets on restart
