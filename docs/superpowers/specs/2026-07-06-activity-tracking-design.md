# Activity tracking & mentor timeline — design

Date: 2026-07-06. Approved by mentor.

## Problem

The mentor cannot tell when the student is in the app, whether lessons were
loaded/read, or how lesson checks went — even though the app logs all of it.

**Root cause (bug):** `/api/result` validates `kind` against a whitelist that
predates the lessons feature. `lesson_progress`, `lesson_check`, and `notebook`
are rejected with a 400, and the server rejects the *whole batch* on the first
bad row. Since `sync.js` posts the entire pending queue as one batch, sync has
been bricked for **all** kinds since the student's first lesson event. A 400
still returns JSON, so the client reports `state: 'ok'` — a silent failure,
violating SPEC §8. The queue never discards, so all data is recoverable once
the server accepts the kinds.

## Design

### 1. Sync repair (urgent)

- `functions/api/_validate.mjs` (new, shared, `_`-prefixed = not routed):
  `KINDS` (now including `lesson_progress`, `lesson_check`, `notebook`, `nav`),
  `validateRow(row)`, `partitionRows(rows)` → `{valid, rejected:[{id,error}]}`.
  Unit-tested with node:test.
- `functions/api/result.ts`: per-row handling — insert valid rows, respond
  `{ok:true, received:N, rejected:[{id,error}]}`. An unknown kind can never
  brick the queue again.
- `src/js/sync.js` + `store.js`: mark accepted ids synced; park rejected ids
  out of the queue (kept under `rumbo_rejected_v1` for diagnosis); surface a
  new `'error'` banner state instead of silently reporting `'ok'` when the
  POST is non-ok or rows were rejected.

### 2. `nav` instrumentation (enter/leave)

New kind `nav`, `detail: {screen, section?, chapter?, action:'enter'|'leave'}`.

- `session.js runBlock` → enter per block (`screen:'bloque'`, block type,
  chapter).
- `lessons.js` → enter per lesson section (teach screen) and per check screen,
  so "loaded but never finished" is visible.
- `main.js` → enter on home render (deduped: consecutive identical enters
  within 60 s are skipped); `visibilitychange`/`pagehide` → leave/enter for
  the current screen.
- `derive.js`: no change — `nav` is deliberately **not** study activity
  (streaks/gates can't be gamed by opening the app). Guarded by a test.

### 3. Mentor dashboard: last-seen + activity timeline

- `src/js/timeline.js` (new, pure, unit-tested):
  `buildTimeline(rows, {gapMinutes=25})` → days → sessions (gap-clustered) →
  human-readable entries (consecutive `lesson_check` rows for one section
  collapse into `checks n/k`); flags lesson sections entered but never
  finished (`abandoned`). `lastSeen(rows)` → `{ts, label}`.
- `progreso/dash.js`: "Last seen: N min ago · <screen>" header line + an
  "Activity timeline" section (last 7 days). Client flushes every 90 s, so
  this is near-live.

### 4. Housekeeping

- SPEC/README note for the new kind + endpoints contract; `schema.sql` comment
  updated; `content_version` bump (SW re-keys the student's cached app).
- Tests: `tests/result-validate.test.mjs`, `tests/timeline.test.mjs`,
  derive `nav`-inertness case in `tests/derive.test.mjs`, store parking test.

## Sequencing

Server fix deploys with everything else, ASAP — before the student's next
study day — so his queued history drains before any browser-data loss.
