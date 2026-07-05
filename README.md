# Rumbo ✈️ — DGAC PPL Study Platform

An 8-week, PHAK-first study program for the DGAC (Peru) private pilot written exam. One student, one mentor. Offline-first PWA on Cloudflare Pages. **SPEC.md is the source of truth** — read it before changing anything.

**Deployed (2026-07-04):** https://rumbo-atk.pages.dev — student app; `/progreso/` — mentor dashboard.

**Lecciones (2026-07-05):** the app now teaches every assigned PHAK chapter in-app (`data/lessons/chNN.json`, rendered by `src/js/lessons.js`), with guided step-by-step math, notebook prompts, checks, and badges. Content workflow: edit lesson JSON → `node scripts/validate-lessons.mjs` → `node scripts/sync-chapters.mjs` (regenerates `chapters.json` sections + the SW precache index) → bump `content_version` in `data/config.json` → deploy. Authoring rules: `docs/lesson-authoring.md`. Tests: `node --test tests/*.mjs`.
Cloudflare account `dspeer@outlook.com` · D1 `rumbo` · R2 `rumbo-audio` · Access team `little-bar-6fd6.cloudflareaccess.com` (two apps: site-wide for student+mentor, mentor-only for `/progreso*` + `/api/progress`; 1-month sessions, email OTP). Only rows stamped with `STUDENT_EMAIL` count toward progress — the mentor can use the student app without polluting it.

## Layout

```
index.html, src/          student app (Spanish, vanilla ES modules, no build step)
progreso/                 mentor dashboard (English)
functions/api/            Pages Functions: result, log, progress, audio, feedback
data/                     bank.json (901 questions), figures/, config, chapters,
                          math-templates, scenarios
data/lessons/             chNN.json (16 authored chapter lessons) + diagrams/ + index.json
sw.js, manifest.webmanifest, icons/   PWA + offline precache (figures + lessons + diagrams)
schema.sql, wrangler.toml
scripts/                  import-bank.mjs, validate-lessons.mjs, sync-chapters.mjs
tests/                    node:test suites (mathgen steps, derive rules)
```

## Local development

```sh
npx wrangler d1 execute rumbo --local --file=schema.sql   # once
npx wrangler pages dev . --port 8788
```

Open http://localhost:8788. `MENTOR_EMAIL` is a placeholder locally, so exercise the dashboard with:
`curl -H 'Cf-Access-Authenticated-User-Email: REPLACE_WITH_MENTOR_EMAIL' localhost:8788/api/progress`
`/api/feedback` returns 501 until `ANTHROPIC_API_KEY` is set.

## Deployment (once)

1. **Pages project** — connect this repo in the Cloudflare dashboard (or `npx wrangler pages deploy .`). Build output dir: `.` (no build command).
2. **D1** — `npx wrangler d1 create rumbo`; paste the returned `database_id` into `wrangler.toml`; then `npx wrangler d1 execute rumbo --remote --file=schema.sql`.
3. **R2** — `npx wrangler r2 bucket create rumbo-audio`.
4. **Vars & secrets** — set `MENTOR_EMAIL` in `wrangler.toml` (or Pages dashboard) and `npx wrangler pages secret put ANTHROPIC_API_KEY` (powers `/api/feedback`; app works without it, minus AI feedback).
5. **Cloudflare Access** (Zero Trust → Access → Applications) — two **separate applications** (SPEC §8; do not rely on one app with two policies):
   - `rumbo` app covering the domain root — Allow policy: student's + mentor's emails (email OTP). Session duration: **1 month**.
   - `rumbo-progreso` app covering `<domain>/progreso*` **and** `<domain>/api/progress` — Allow policy: mentor only.

## Content tasks still owned by humans (SPEC §10)

- `data/chapters.json`: PHAK page ranges per chapter + per-section `key_points` (grounds the AI recall feedback) — **mentor, week 0**.
- Exam pass mark + per-category weighting + whether the mechanical E6B is allowed → `data/config.json`.
- `data/scenarios.json` drafts are marked BORRADOR — mentor reviews.
- Re-import the bank after corrections: `node scripts/import-bank.mjs` then bump `content_version` in `data/config.json` (this re-keys the offline cache).

## Architecture in one paragraph

Every study action appends an immutable result row to a local log (localStorage) and syncs to D1 when online (`POST /api/result`, idempotent by UUID). All state — math ladder, Leitner boxes, SRS due dates, error deck, streaks, gates — is derived by replaying that log (`src/js/derive.js`), identically in the app and the dashboard. localStorage is a cache: "Restaurar progreso" rebuilds from `GET /api/log`. The service worker precaches the entire app, data, and all figures, so a full study day works with zero connectivity; an expired Access session surfaces as a loud banner, never a silent sync failure.
