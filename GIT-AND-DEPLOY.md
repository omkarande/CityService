# Git, PR, and Render — what we learned (2026-08-24)

A short record of problems from merging `map-zoom` into `om`, opening PR #3, merging to `main`, and deploying on Render. **The site is live on Render as of 2026-08-24; smoke testing the URL is still pending.** Read this when the same confusion comes back.

## 1. Two feature branches

We had **`om`** (Capacitor Android + data pipeline) and **`map-zoom`** (API, search map, probe, Render). Work lived on both, so `git checkout om` then `git merge map-zoom` hit **conflicts**.

**Lesson:** pick one shipping branch. After the merge, delete the extra branch and do new commits only on `om` (then PR `om` → `main`). Two long-lived branches on the same files will conflict again.

Keep both sides of a conflict when they do different jobs:

| Keep from `om` | Keep from `map-zoom` |
|---|---|
| Capacitor, `initNativeShell`, `getCurrentCoords` | Express/Postgres API, `/probe`, search map |
| `base: '/'` for the Android WebView | Vite proxy when `VITE_USE_API=true` |

`MapPreview.tsx` stayed **deleted** — nothing imported it.

**Do not `git add`:** `.env` (secrets), `login.json` / `record.json` (accidental dumps), Android **build** junk. `.gitignore` already ignores `.env`; it does not ignore those JSON dumps.

A merge that stops with `fix conflicts and then commit` is unfinished until you `git commit`. Until that commit exists, `map-zoom` is not fully inside `om`.

## 2. Raising the PR

PR was **`om` → `main`**, not `map-zoom` → `main`. After merging locally into `om`, push `om` and open the PR from that branch.

GitHub’s **“Checking for ability to merge automatically…”** spinner is not always a conflict. PR #3 was already mergeable. The spinner stayed because **CI had failed** (`mergeable_state: unstable`). Refresh the page; look at the **Checks** tab, not only the merge box.

## 3. What CI is

**CI** = GitHub Actions (`.github/workflows/ci.yml`). On every push/PR it runs on **Linux**:

1. `npm ci` — install from the lockfile  
2. `npx tsc -b` — type-check  
3. `npm test` — Vitest  

Green = those three passed on GitHub’s machine. Red does not mean your laptop app is broken. Our first red CI was missing Linux Rollup/esbuild binaries in a **Windows-generated** `package-lock.json`.

Do **not** “fix” that by deleting `package-lock.json` in CI. `npm ci` **requires** the lockfile. The real fix is: put the missing optional packages in the lockfile, **or** use `npm install` on the Linux host.

## 4. After merge, code is not live yet

Merging the PR only updates **GitHub `main`**. The public site is whatever **Render** last built. That step is done: a Web Service (not a Static Site) plus the existing Postgres. Recreating it later still needs:

Env on the Web Service:

- `DATABASE_URL` — Postgres **Internal** URL (laptop uses **External**)  
- `PROBE_SECRET` — team `/probe` password, **not** the DB password  
- `NODE_ENV=production`  

Do not apply a Blueprint that creates a second database named `cityservice-db`.

## 5. Render build failed on `npm ci`

Error: lockfile out of sync, `Missing: @rollup/rollup-linux-…` (and macOS/Windows optional binaries).

**Why:** `package-lock.json` was created on Windows. Newer Linux `npm ci` wants **every** optional Rollup/esbuild binary listed in the lockfile, not only the one for your PC.

**What did not work:** editing `render.yaml` on the laptop. An **existing** Render service uses the **dashboard Build Command**. Until you change that box or **commit + push** a new lockfile, Render keeps building the old `main` with `npm ci --include=dev && npm run build`.

**What to do:**

1. Commit and `git push origin main` (dashboard never sees uncommitted files).  
2. Manual Deploy → **Deploy latest commit**.  
3. Confirm the log **timestamp changed**. Same log name as last time = you are reading the old failure.  
4. Optional instant workaround in the dashboard (does not wait on git):

```text
npm install --include=dev && npm run build
```

**Outcome:** the Web Service came up after switching the dashboard build to `npm install --include=dev && npm run build` (and/or pushing a lockfile that lists the optional binaries). Start command stays `npx tsx server/index.ts`. Live-URL testing was deferred.

## 6. Cheat sheet

| Symptom | Meaning |
|---|---|
| `Automatic merge failed; fix conflicts` | Edit files, `git add`, then **commit** the merge |
| Merge spinner forever | Usually CI pending/failed, not a conflict — refresh, open Checks |
| PR merged, site unchanged | Render has not deployed that commit yet |
| `npm ci` missing `@rollup/rollup-linux-…` | Windows lockfile vs Linux CI/Render |
| Same Render log filename as last fail | Old deploy; you did not push, or you opened an old log |
| Secrets on GitHub | Never commit `.env`; commit `.env.example` only |

Local API still needs two processes: `npm run dev` and `npm run dev:server`, with `VITE_USE_API=true` in `.env`.
