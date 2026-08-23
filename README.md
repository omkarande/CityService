# CityService

Search a locality — right down to a single vasti or society — and see which delivery, ride-hailing, and quick-commerce apps actually serve it, with a confidence rating and provenance for every answer.

Every quick-commerce, delivery, and ride-hailing platform keeps its own private map of where it actually works, and none of them show it to you until after you've installed the app, signed up, and typed in your address. CityService is the missing public index of that coverage.

> **Status:** public app is login-free. Coverage is served from a Node API + Postgres on Render; `/probe` is locked with a team password. Local `npm run dev` still uses seed JSON unless `VITE_USE_API=true`. Most coverage data is still placeholder, clearly marked in the UI. **After a reboot, start at [`PROGRESS.md`](./PROGRESS.md)**.

![CityService screens](./screen3.png)

## Features

- **Search** a locality by name, alias, or pincode (Devanagari-aware), or drop a pin on a map to find the nearest tracked locality
- **Coverage report** per locality: every tracked platform, its status (available / partial / unavailable / unknown), ETA, and a confidence tier (Verified / Likely / Unconfirmed) — a city-level guess can never read as "Verified"
- **Provenance for every answer**: how the answer was resolved (exact locality → same pincode → nearest ancestor) and when it was last checked
- **"Use my location"** — GPS to nearest tracked locality
- **Crowd reporting** — thumbs up/down on any platform recomputes its confidence live
- **Saved localities** and recents, stored locally

## Tech stack

React 18 + Vite + TypeScript (strict) + Tailwind CSS, React Router, Leaflet/OpenStreetMap for maps, Vitest for unit tests. Production is a Node 20 Express server (`server/`) that serves the Vite `dist/` and `/api/*`, with PostgreSQL for shared coverage. The public site has no user accounts. An Android folder (`android/`) may exist from Capacitor 7; on branch `map-zoom` it is not necessarily committed — see `PROGRESS.md`.

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

## Deploy on Render

Use a **Web Service** (not a Static Site) plus **PostgreSQL**. Static hosts cannot write a database.

1. Create a PostgreSQL instance and copy `DATABASE_URL`.
2. Create a Web Service from this repo, root directory = repo root, Node 20.
3. **Build:** `npm ci --include=dev && npm run build`  
   (`--include=dev` is required so Vite/TypeScript are present even when `NODE_ENV=production`.)
4. **Start:** `npx tsx server/index.ts`
5. Env vars: `DATABASE_URL` (Internal URL on the Web Service), `PROBE_SECRET`, `NODE_ENV=production`.
6. Health check path: `/api/health` (already set in `render.yaml`).

If the Postgres instance **already exists**, create the Web Service and set `DATABASE_URL` to that instance’s **Internal** URL. Do not apply the Blueprint on top — it would try to create a second database named `cityservice-db`.

On every start the server **upserts** seed JSON (named localities, gap pincodes, platforms, inferred hub rings). Live `/probe` rows and GPS places are never deleted. JSON never overwrites `source: probe`.

There is a [`render.yaml`](./render.yaml) Blueprint if you prefer that. Set `PROBE_SECRET` in the dashboard (it is marked `sync: false`). Share the password in a password manager, not in git. Change it if it leaks.

After the first deploy: open `https://<service>.onrender.com/probe`, enter the team password, record one platform, then confirm an incognito window sees it on Results with no login. The Account screen does not link to `/probe` in production — bookmark the URL.

Free/starter web services sleep; Postgres data stays. The first request after sleep is slow.

## Project structure

```
src/
  api/        client.ts picks httpAdapter (production) or mockAdapter (local Vite)
  domain/     pure resolution/confidence/search logic — also imported by the server
  data/       seed JSON: Pune localities, platforms, coverage records
  components/ shared UI pieces (cards, map, chips, badges...)
  screens/    one file per route
server/       Express + Postgres (or in-memory if DATABASE_URL is unset)
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full data model, the coverage-resolution algorithm, and how the API is wired.

## Docs

- [`PROGRESS.md`](./PROGRESS.md) — **start here after closing the laptop** (resume commands, real-data inventory, next steps)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — data model, confidence/resolution, §10 collection methods
- [`DESIGN.md`](./DESIGN.md) — original design tokens/spec

## Known limitations

- Only Pune has real locality data seeded; every other city on the home screen is presentation-only by design
- Most Pune coverage records are placeholder data (`source: "seed-placeholder"`), capped below the "Verified" confidence tier so the demo never overstates certainty — a handful of localities have real, verified checks (see `PROGRESS.md`)
- Thumbs-up reports still live in `localStorage` on this device only
- Without `DATABASE_URL`, the Node server uses an in-memory store that resets on restart
