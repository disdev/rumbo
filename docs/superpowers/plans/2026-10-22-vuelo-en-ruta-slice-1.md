# Vuelo en ruta — Slice 1 (chart + missions 1–2 + tracking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first usable slice of the Vuelo en ruta missions. That means a Peru training chart, missions 1 (Leer el mapa) and 2 (Medir) with bridge steps onto the exam figures and real-question pruebas, and full mentor tracking in `/progreso`.

**Architecture:** Pure logic (geometry, grading, progress/report derivation) lives in `src/js/misiones-logic.js` and is tested with `node:test`. The chart is rendered from data (`data/misiones/carta-costa-central.json`) by `src/js/carta.js`. Exam figures get an image-coordinate overlay (`src/js/figura-overlay.js`). The mission player `src/js/misiones.js` walks steps defined in `data/misiones.json` and appends log rows. Progress is always derived from the log, never stored. The dashboard reuses the same pure report function.

**Tech Stack:** Vanilla ES modules with no build step, SVG, pointer events, `node --test`, Cloudflare Pages Functions (only `_validate.mjs` changes), service worker precache.

**Spec:** `docs/superpowers/specs/2026-10-22-vuelo-en-ruta-misiones-design.md`. Also read `SPEC.md` §3.4, §5.11 and §7, plus `README.md` (content workflow).

## Global Constraints

- No build step, no frameworks, no new dependencies. Match the existing module style (`el()` from `players.js`, `svg()/txt()/uid()` from `widget-kit.js`).
- Student-facing text is Spanish in second person ("tú"). The dashboard (`/progreso`) is English. Follow the existing files.
- At most about **40 words of instruction per step screen**. No step should take longer than about 60 seconds.
- Exam-day tools: **none**. No calculator, no plotter, no E6B. In-app plotter/strip tools appear only on the Peru chart and only in the "see it once" steps. **Exam-figure steps never offer a plotter.**
- The chart must show the label **"Carta de entrenamiento — no usar para navegación"**.
- Use the app's CSS tokens (`src/css/app.css :root`) for the UI. The chart keeps a paper surface in dark mode (it is framed, not inverted). **Laptop first:** target 1280×800 and 1440×900.
  - At ≥ 1024px the surface (chart/figure) goes on the left and the step panel on the right, with no scrolling between map and question.
  - Mouse/trackpad drag and rotate.
  - Number answers typed on the keyboard, Enter submits, and focus lands in the input automatically.
  - Narrower windows stack the panels and must not break. Phone polish is not a goal.
- Every new JS/data file is precached in `sw.js` and works fully offline.
- Content workflow for the final task: bump `content_version` in `data/config.json` → `node scripts/sync-sw-version.mjs`.
- Missions are never a gate and never homework. Nothing in `planner.js` schedules them.
- Aviation facts must trace back to PHAK chapters 15–16 or the bank's `reason` text. Real-world positions and variation must cite their source in the data file.
- Test command: `node --test tests/*.mjs` must pass. Baseline is 0 failures.

## Review Focus

1. **Leaving mid-mission.** This covers the back button, backgrounding the app, and reloading. The expected behavior is that he resumes at the same step, no step is logged twice, and the mentor sees where he stopped. Pinned by tests in Task 2 (`missionProgress` on partial logs) and Task 8 (exit writes `mission_progress {completed:false}`).
2. **Angle wraparound when grading.** Entering 2° when 358° is expected, or 360 vs 0, must grade as close and correct. Pinned in Task 2 (`gradeAnswer`).
3. **Replaying a mission.** Repeated runs must not inflate "first try" stats. The before/after metric uses each question's first attempt on each side of the first mission completion. Pinned in Task 2 (`missionReport`, `missionAccuracy`).
4. **Offline.** Opening the taller and running a mission with no network must work. Pinned in Task 10 (test that `CORE` lists every new file).
5. **Trackpad drag selects text or drags the page instead of moving the plane or plotter, or the pointer leaves the SVG mid-drag and the drag sticks.** Pinned in Task 5 (`user-select: none` and `setPointerCapture` on the chart surface, plus a manual trackpad check at 1280×800).

---

## File map

| File | Responsibility |
|---|---|
| `src/js/misiones-logic.js` (new) | Pure. Projection/distance/course, `gradeAnswer`, `missionProgress`, `missionReport`, `missionAccuracy` |
| `data/misiones/carta-costa-central.json` (new) | Chart data for the Peru training chart |
| `src/js/carta.js` (new) | Renders the chart SVG and the interaction tools (tap, place, plotter, paper strip, feedback drawing) |
| `src/js/figura-overlay.js` (new) | Exam-figure image with hotspots in image px, plus a dev coordinate picker |
| `data/misiones.json` (new) | Missions, steps, recetas, the question→mission mapping for all 77 questions |
| `src/js/misiones.js` (new) | Mission player and logging |
| `src/js/taller.js` | Entry section at the top of the taller |
| `src/js/planner.js` | `selectQuestions` source `'ids'` |
| `src/js/players.js` | `quizPlayer` handles `'ids'` (category, mission, missed list). Remove the E6B note |
| `src/js/main.js` | `nav()` dedup key includes all of `extra` |
| `src/js/timeline.js` | Labels for mission rows and the `mision` nav, plus abandoned flag |
| `functions/api/_validate.mjs` | New kinds |
| `progreso/dash.js`, `progreso/index.html` | Misiones section |
| `src/css/app.css` | Mission, chart and overlay styles |
| `sw.js`, `data/config.json`, `SPEC.md` | Precache, version, docs |

---

### Task 1: Tracking plumbing (server kinds, nav dedup, timeline labels)

**Files:**
- Modify: `functions/api/_validate.mjs` (`KINDS`)
- Modify: `src/js/main.js` (`nav()` key)
- Modify: `src/js/timeline.js` (`SCREEN_LABELS`, `navLabel`, `entryFor`, `flagAbandoned`)
- Test: `tests/result-validate.test.mjs`, `tests/timeline.test.mjs`

**Interfaces:**
- Produces these row shapes, which every later task uses exactly:
  - `{kind:'mission_attempt', detail:{mission, step, try, answer, correct, off_by, ms_to_answer, hint_shown}}`
  - `{kind:'mission_step', detail:{mission, step, title, tries, first_try_correct, revealed, seconds}}`
  - `{kind:'mission_progress', detail:{mission, title, completed, seconds, steps_done, last_step}}`
  - nav: `ctx.nav('mision', {mission, step, view})` with `view ∈ 'briefing'|'step'|'receta'|'prueba'|'fin'` (`step` is null outside step views)
- Ids: missions are `'m1'…'m6'`, steps are `'m1-1'`, `'m1-2'`, … (1-based, in mission order).

- [ ] **Step 1: Write failing tests**

In `tests/result-validate.test.mjs`:
```js
test('acepta los kinds de misiones', () => {
  for (const k of ['mission_attempt', 'mission_step', 'mission_progress']) {
    assert.equal(validateRow(row(k)), null, `kind ${k} debería ser válido`);
  }
});
```
In `tests/timeline.test.mjs` (reuse its `row()` helper):
```js
test('misiones: paso con título, intentos y tiempo; intentos sueltos no aparecen', () => {
  const rows = [
    row(10, 'nav', { detail: { screen: 'mision', mission: 'm2', step: 'm2-3', view: 'step', action: 'enter' } }),
    row(9, 'mission_attempt', { detail: { mission: 'm2', step: 'm2-3', try: 1, correct: false } }),
    row(8, 'mission_step', { detail: { mission: 'm2', step: 'm2-3', title: 'Mide el curso', tries: 2, first_try_correct: false, revealed: false, seconds: 100 } }),
    row(7, 'mission_progress', { detail: { mission: 'm2', title: 'Medir', completed: false, seconds: 300, steps_done: 3, last_step: 'm2-3' } }),
  ];
  const labels = buildTimeline(rows)[0].sessions[0].entries.map(e => e.label);
  assert.ok(labels.some(l => l.includes('Misión 2 · paso 3 «Mide el curso» · 2 intentos · 1 min 40 s')));
  assert.ok(labels.some(l => l.includes('Misión 2') && l.includes('salió en el paso 3')));
  assert.equal(labels.filter(l => /intento 1/.test(l)).length, 0);
});
test('misiones: paso abierto sin mission_step posterior se marca abandonado', () => {
  const rows = [row(5, 'nav', { detail: { screen: 'mision', mission: 'm1', step: 'm1-4', view: 'step', action: 'enter' } })];
  const e = buildTimeline(rows)[0].sessions[0].entries[0];
  assert.equal(e.abandoned, true);
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `node --test tests/result-validate.test.mjs tests/timeline.test.mjs`
Expected: the new tests FAIL. The existing tests still pass.

- [ ] **Step 3: Implement**

- Add the three kinds to `KINDS`.
- In `main.js` `nav()`, change the dedup key to `JSON.stringify([screen, extra])`. Mission screens differ only in `mission/step/view`, and the old key would swallow step changes within 60s.
- In `timeline.js`:
  - add `mision: 'Misión'` to `SCREEN_LABELS`.
  - `navLabel` appends `m2 · paso 3 (step)` style info when `d.mission` is present.
  - `entryFor` handles three cases:
    - `mission_step` → icon `🛩️`. Label `Misión N · paso K «title» · T intento(s) · M min S s`. Use `N`/`K` from the ids. Use seconds-only `S s` under 60 s. Add `· mostrada` when `revealed`.
    - `mission_progress` → completed: `🏁 Misión N «title» completa · M min`. Not completed: `⚠️ Misión N «title»: salió en el paso K`.
    - `mission_attempt` → `null`.
  - Generalize `flagAbandoned`: a `mision` nav entry with `view:'step'` is abandoned if there is no later `mission_step` row with the same `detail.step` in that session.

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.mjs`
Expected: all pass.

- [ ] **Step 5: Commit** `feat(misiones): tracking kinds, nav dedup by full extra, timeline labels`

---

### Task 2: Pure mission logic

**Files:**
- Create: `src/js/misiones-logic.js`
- Test: `tests/misiones-logic.test.mjs`

**Interfaces:**
- Consumes: `hdg`, `angleDiff`, `toMagnetic` from `src/js/ops-logic.js`. Read `toMagnetic`'s sign convention there; variation is `+E / −W`.
- Produces:
  - `distanceNM(a:{lat,lon}, b:{lat,lon}) → number`. Uses a flat-earth local approximation: `dN = Δlat·60`, `dE = Δlon·60·cos(mean lat)`, `√(dN²+dE²)`. Latitudes south and longitudes west are negative.
  - `trueCourse(a, b) → number` (1–360, `hdg` convention), where `atan2(dE, dN)`.
  - `project(bounds:{north,south,west,east}, size:{w,h}) → {toXY({lat,lon}) → {x,y}, toLatLon({x,y}) → {lat,lon}}`. Equirectangular, with x scaled by `cos(mid lat)` so angles on screen match `trueCourse`. `size.h` is derived by the caller from `w` with the same ratio. Export `chartAspect(bounds) → h/w` too.
  - `expectedValue(step, chart) → number`. Resolves `step.expected` (a number) or `step.compute`:
    - `'true_course'` → `trueCourse(route.from, route.to)`
    - `'distance_nm'` → `distanceNM(route.from, route.to)`
    - `'magnetic_course'` → `toMagnetic(trueCourse, chart.variation.deg)`
    - `'obstacle_clearance'` → `obstacle.msl + step.clearance_ft`

    Here `route` is `chart.routes.find(r => r.id === step.route)` with airport coordinates resolved, and `obstacle` is `chart.obstacles.find(o => o.id === step.obstacle)`.
  - `gradeAnswer(step, answer, chart) → {correct:boolean, off_by:number|null}`, by step kind:
    - `tap`: `answer.feature` in `step.targets`, `off_by:null`
    - `choice`: `answer.option === step.answer`, `off_by:null`. `answer.option` is the index into `step.options` *before* shuffling.
    - `number` with `step.unit === 'deg'`: `off_by = angleDiff(answer.value, expected)`, correct if `|off_by| ≤ step.tol`
    - `number` otherwise: `off_by = answer.value − expected`, same tolerance rule
    - `place`: `off_by = distanceNM(answer, step.target)` (always ≥ 0), correct if `≤ step.tol`
  - `missionProgress(rows, missions) → {[missionId]: {started, completed, done:Set<stepId>, next:stepId|'prueba'|null, lastTs}}`. `next` is the first step not done. If all steps are done but there's no completed `mission_progress`, `next` is `'prueba'`. If completed, `next` is null. A later replay doesn't reset `completed`.
  - `missionAccuracy(rows, mission, completedTs) → {before:{n,ok}, after:{n,ok}}`. Covers questions in `mission.questions`, taken from `quiz|redo|simulacro` rows (`detail.items[].qid/correct`). It counts only the **first** attempt per qid strictly before `completedTs` and the **first** attempt per qid at or after it.
  - `missionReport(rows, missions) → [{id, title, status:'done'|'in_progress'|'not_started', seconds, prueba:{score,total}|null, accuracy, steps:[{id, title, status:'done'|'opened'|'not_started', seconds, tries, first_try_correct, revealed, attempts:[{ts, answer, correct, off_by, ms_to_answer, hint_shown}]}]}]` plus a `stuck` list. Exact shape: `{missions:[…], stuck:[{mission, step, title, tries, revealed}]}`. Rules:
    - Step `status`: `'done'` if any `mission_step` exists for it, else `'opened'` if a `mision` nav enter or a `mission_attempt` exists for it, else `'not_started'`.
    - `seconds` sums `mission_step.seconds` across runs.
    - `tries` counts *all* `mission_attempt` rows.
    - `first_try_correct` comes from the **first** `mission_step` for that step.
    - `prueba` is the latest `quiz` row with `detail.mission === id`.
    - `stuck` holds the top 5 steps by `tries + 2·(revealed ? 1 : 0)` where `tries > 1 || revealed`.

- [ ] **Step 1: Write failing tests**

Use fixtures with real-ish coordinates and hand-checked values:
```js
const LIMA = { lat: -12.0219, lon: -77.1143 }, NORTE = { lat: -11.0219, lon: -77.1143 };
test('1° de latitud = 60 NM y curso 360 hacia el norte', () => {
  assert.ok(Math.abs(distanceNM(LIMA, NORTE) - 60) < 0.01);
  assert.equal(trueCourse(LIMA, NORTE), 360);
  assert.equal(trueCourse(NORTE, LIMA), 180);
});
test('al oeste en el hemisferio sur el curso es 270', () => {
  assert.equal(trueCourse(LIMA, { lat: LIMA.lat, lon: LIMA.lon - 0.5 }), 270);
});
test('project ida y vuelta conserva lat/lon', () => { /* toLatLon(toXY(p)) ≈ p within 1e-9 */ });
test('gradeAnswer: 2° vs 358° esperado es off_by +4 y correcto con tol 5', () => {
  const step = { kind: 'number', unit: 'deg', expected: 358, tol: 5 };
  assert.deepEqual(gradeAnswer(step, { value: 2 }, {}), { correct: true, off_by: 4 });
  assert.equal(gradeAnswer(step, { value: 360 }, {}).off_by, 2);
  assert.equal(gradeAnswer(step, { value: 178 }, {}).correct, false); // recíproco
});
test('gradeAnswer: place mide NM al objetivo', () => { /* 0.1° lat off → off_by ≈ 6, tol 3 → false */ });
test('gradeAnswer: tap y choice', () => { /* targets / pre-shuffle index */ });
test('expectedValue: obstacle_clearance = msl + clearance_ft', () => { /* msl 1249, 500 → 1749 */ });
test('missionProgress: paso a medias → next es ese paso; todos hechos sin prueba → "prueba"', () => {});
test('missionProgress: completed se mantiene si luego repite la misión', () => {});
test('missionAccuracy: solo el primer intento por qid a cada lado de completedTs', () => {});
test('missionReport: tries cuenta todos los intentos; first_try_correct del primer mission_step; stuck ordena por tries+2·revealed', () => {});
```
Fill in each stub with concrete rows and asserted numbers. The comments give the values.

- [ ] **Step 2: Run to confirm failure**

Run: `node --test tests/misiones-logic.test.mjs`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/js/misiones-logic.js`** with the signatures above. Start the file with a header comment in the repo's style (Spanish, cite the spec).

- [ ] **Step 4: Run** `node --test tests/*.mjs`. Expected: all pass.

- [ ] **Step 5: Commit** `feat(misiones): pure geometry, grading and progress/report derivation`

---

### Task 3: Prueba by explicit question ids

**Files:**
- Modify: `src/js/planner.js` (`selectQuestions`, new `case 'ids'`)
- Modify: `src/js/players.js` (`quizPlayer`: category, `detail.mission`, missed-items list. Remove the E6B note at `players.js:322`)
- Test: `tests/select-questions-category.test.mjs`

**Interfaces:**
- Produces the block shape `{type:'quiz', source:'ids', ids:string[], category:'VUELO EN RUTA', mission:'m1', cap:8}`.
- `quizPlayer` logs `{kind:'quiz', category:block.category, detail:{items, mission}}`. `missionReport` (Task 2) reads `detail.mission`.

- [ ] **Step 1: Write failing tests**

```js
test('source: ids — solo esos ids, no vistos primero, luego fallados, tope cap', () => {
  const bank = ['a','b','c','d'].map(id => ({ id, category: 'VUELO EN RUTA', options: ['x','y','z'], answer: 0 }));
  const itemStats = new Map([
    ['q:a', { lastDays: [{ correct: true }] }],
    ['q:b', { lastDays: [{ correct: false }] }],
  ]);
  const qs = selectQuestions({ type: 'quiz', source: 'ids', ids: ['a','b','c'], cap: 2 }, { itemStats }, { bank }, () => 0.5);
  assert.deepEqual(qs.map(q => q.id), ['c', 'b']);
});
test('source: ids — ids inexistentes se ignoran', () => { /* ids ['zz','a'] → ['a'] */ });
```

- [ ] **Step 2: Run to confirm failure**: `node --test tests/select-questions-category.test.mjs`

- [ ] **Step 3: Implement.** The order is unseen → latest wrong → rest. Dedupe, then `slice(0, block.cap ?? 8)`. Shuffle within each group using `rng`.

  In `quizPlayer`:
  - category is `block.category` when `source === 'ids'`.
  - spread `mission` into `detail`.
  - compute `missedItems` for `'ids'` as for `'category'`.

  Delete the E6B reminder line in `practicaBurst`'s renderer (`players.js:322`) and its use.

- [ ] **Step 4: Run** `node --test tests/*.mjs`. All pass.

- [ ] **Step 5: Commit** `feat(misiones): quiz source 'ids' for mission pruebas; drop E6B reminder`

---

### Task 4: Peru training chart data

**Files:**
- Create: `data/misiones/carta-costa-central.json`
- Test: `tests/misiones-data.test.mjs` (chart part)

**Interfaces:**
- Produces the chart schema that Tasks 5, 7 and 8 read:
```json
{
  "id": "costa-central",
  "label": "Carta de entrenamiento — no usar para navegación",
  "bounds": { "north": -10.5, "south": -12.5, "west": -78.0, "east": -76.5 },
  "variation": { "deg": 0, "source": "" },
  "coast": [[-10.5, -77.9], "..."], "coast_source": "",
  "terrain": [{ "top_ft": 1000, "poly": [["lat","lon"]] }],
  "airports": [{ "id": "SPJC", "name": "Lima · Jorge Chávez", "lat": 0, "lon": 0, "tower": true, "fuel": true,
                 "elev_ft": 0, "rwy_len_ft": 0, "lighted": true, "ct_freq": "118.1", "source": "" }],
  "obstacles": [{ "id": "ob1", "lat": 0, "lon": 0, "msl": 1249, "agl": 349, "lighted": true, "group": false }],
  "checkpoints": [{ "id": "cp-huaral", "lat": 0, "lon": 0, "name": "Huaral" }],
  "airspace": [{ "id": "lima-c", "class": "C", "center": "SPJC", "rings": [
                 { "radius_nm": 5, "floor": "SFC", "ceiling": 4000 }, { "radius_nm": 10, "floor": 1200, "ceiling": 4000 }] }],
  "mef": [{ "lat_n": -10.5, "lon_w": -78.0, "ft": 4600 }],
  "routes": [{ "id": "lima-huacho", "from": "SPJC", "to": "HUACHO" }]
}
```
(The values shown are placeholders for the schema. The real values follow the rules below.)

Content rules:
- **Real positions with a cited source:**
  - SPJC from OurAirports or Wikipedia (~12°01′S 77°07′W, elev ~113 ft).
  - Huacho is a real small GA/ultralight airstrip with no ICAO code (OurAirports ident `PE-0025`). Use its listed position and draw it **magenta** (no tower), which teaches the color rule.
  - Coastline: ≥ 25 points, within about 2 NM of the real coast, source cited (e.g. Natural Earth 1:10m).
- **Variation:** NOAA WMM value for 12.0°S 77.1°W on today's date, as signed `deg` (+E / −W). Record it with source and date.
- **Invented features** (`obstacles`, `checkpoints`, `airspace`, `mef`) must be plausible. Include at least one obstacle near the route and one Huacho-side checkpoint flag.
- **MEF:** one entry per 30′×30′ quadrant (4 rows × 3 cols = 12). Each MEF is a multiple of 100 and ≥ both the highest obstacle MSL and the highest terrain `top_ft` intersecting that quadrant.

- [ ] **Step 1: Write failing data tests** in `tests/misiones-data.test.mjs`:
  - every airport, obstacle and checkpoint is inside `bounds`
  - `variation.source`, `coast_source` and every airport `source` are non-empty
  - `coast.length >= 25`
  - there are exactly 12 MEF quadrants covering `bounds` with no gaps
  - the MEF rule above holds
  - every route resolves to two airports
  - the `lima-huacho` route's `distanceNM` is between 50 and 80, and `trueCourse` is between 300 and 360 (a sanity check that Huacho is NNW of Lima)

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Author the JSON**, looking up the real values. Note each source in the file.

- [ ] **Step 4: Run** `node --test tests/*.mjs`. All pass.

- [ ] **Step 5: Commit** `content(misiones): Peru central-coast training chart data`

---

### Task 5: The living chart component

**Files:**
- Create: `src/js/carta.js`
- Modify: `src/css/app.css` (chart styles)

**Interfaces:**
- Consumes: the chart JSON (Task 4), and `project`, `chartAspect`, `distanceNM`, `trueCourse` (Task 2).
- Produces:
  - `renderCarta(container, chart, opts?) → api`, with `opts = {layers?: {aeropuertos, espacio, terreno, obstaculos}, explain?: boolean, route?: routeId}`.
  - `api` methods:
    - `setLayers(partial)`
    - `onTap(fn(featureId))`
    - `highlight(featureIds, tone:'ok'|'bad'|'hint')`
    - `clearMarks()`
    - `drawRoute(routeId)`
    - `drawLine(fromLatLon, courseDeg, nm, tone)`, used to show *his* course vs the true one
    - `placePlane(initialLatLon) → Promise<{lat,lon}>`, a drag-and-drop marker that resolves on "Listo"
    - `showRing(latLon, nm, tone)`
    - `plotter(routeId) → Promise<number>`, a rotatable plotter centered on the route midpoint that resolves to the course read
    - `paperStrip(routeId) → Promise<number>`, which marks the route ends on a paper strip, lets him drag the strip onto the latitude scale, and resolves to NM
    - `sideView(airspaceId, planeAltFt?)`, the corte lateral panel
    - `destroy()`
  - Feature ids are the data ids (`SPJC`, `ob1`, `cp-huaral`, `lima-c`, `mef:-11.0:-77.5`).

Visual requirements, from the spec's "Visual bar":
- Sectional conventions:
  - blue (`tower:true`) / magenta airports, with fuel ticks
  - airport data box: name, `CT freq`, `elev L rwy/100`
  - solid magenta Class C rings with `ceiling/floor` labels
  - terrain tints by `top_ft` band
  - bold MEF in each quadrant, big thousands and small hundreds
  - obstacle symbol with bold MSL and `(AGL)`
  - magenta flag checkpoints
  - lat/long graticule with minute ticks on meridians, which the paper-strip step needs
  - the training label in a corner
- Pinch/scroll zoom is not required. The chart fits the width, with a tap-to-enlarge full-screen mode.
- `user-select: none` and `touch-action: none` on the interactive SVG surface. Use pointer events with `setPointerCapture` for drag and rotate, and keep 60fps (update transforms, don't re-render the SVG on every move). The plotter also rotates with the scroll wheel or the arrow keys for fine adjustment.
- When `explain` is on, tapping any feature shows a one-line Spanish popover.

- [ ] **Step 1: Build a dev harness page** `scripts/carta-dev.html`. It is not precached. It loads the chart and buttons calling each `api` method.

- [ ] **Step 2: Implement `carta.js` and its CSS.**

- [ ] **Step 3: Verify in the browser** (`npx wrangler pages dev . --port 8788` → `/scripts/carta-dev.html`). Check light and dark mode at **1280×800** and **1440×900**, and confirm 900px wide stacks without breaking. Check:
  - the dragged plane follows the trackpad without selecting text, and releasing outside the SVG ends the drag
  - the plotter rotates smoothly
  - the paper strip reads the same NM as `distanceNM` (±2)
  - the side view shows the plane inside or outside the shelf correctly

  Screenshot each state for the reviewer.

- [ ] **Step 4: Run** `node --test tests/*.mjs` (no regressions).

- [ ] **Step 5: Commit** `feat(misiones): living sectional-style chart component with tools`

---

### Task 6: Exam-figure overlay

**Files:**
- Create: `src/js/figura-overlay.js`
- Modify: `src/css/app.css`

**Interfaces:**
- Produces:
  - `renderFigura(container, {figure, hotspots:[{id, x, y, r}]}) → api`, where `x, y, r` are in the image's natural px.
  - `api` methods: `onTap(fn(hotspotId|null))`, `highlight(ids, tone)`, `drawLine({x,y}, {x,y}, tone)`, `destroy()`.
  - No plotter method, deliberately.
- Dev picker: when `location.search` has `pick`, tapping the image logs `{x, y}` in natural px to the console and shows them on screen. This is how hotspots get authored in Task 7.

- [ ] **Step 1: Implement.** Use an `<img>` from `data/figures/` with an absolutely positioned SVG overlay whose `viewBox` is the image's natural size, so coordinates survive any scale. Tap tolerance is `max(r, 22 screen px)`.

- [ ] **Step 2: Verify in the browser** on Figure 20 at 1280×800. Clicking a hotspot fires its id, click-to-zoom works, and the picker logs coordinates.

- [ ] **Step 3: Commit** `feat(misiones): exam-figure overlay with hotspots and coordinate picker`

---

### Task 7: Mission content (m1, m2) and the 77-question mapping

**Files:**
- Create: `data/misiones.json`
- Test: `tests/misiones-data.test.mjs` (mission part)

**Interfaces:**
- Produces this schema, read by the player (Task 8), the dashboard (Task 9) and `missionReport` (Task 2):
```json
{
  "missions": [{
    "id": "m1", "n": 1, "title": "Leer el mapa", "live": true, "chart": "costa-central", "route": "lima-huacho",
    "briefing": "Mañana vuelas a Huacho. Primero: ¿qué hay en el camino?",
    "lessons": [["16", "16-1", "La carta seccional"], ["16", "16-2", "Símbolos"]],
    "steps": [{
      "id": "m1-1", "title": "¿Quién tiene torre?", "kind": "tap", "surface": "carta",
      "prompt": "Toca el aeropuerto que tiene torre de control.", "targets": ["SPJC"],
      "hint": "Azul = con torre. Magenta = sin torre.", "explain_ok": "…", "receta": null
    }],
    "recetas": [{ "id": "r-obst", "title": "Librar un obstáculo", "body": "Cima MSL + 500 ft (+1 000 sobre zona poblada)" }],
    "questions": ["q3637", "…"]
  }],
  "question_map": { "q3637": { "mission": "m1", "method": "…", "by_hand_ok": true } }
}
```
- Step fields by kind:
  - `tap`: `targets[]`
  - `choice`: `options[]` and `answer` (pre-shuffle index)
  - `number`: `unit` (`'deg'|'nm'|'ft'`), `tol`, `expected` **or** `compute` (+ `route`/`obstacle`/`clearance_ft`), optional `tool` (`'plotter'|'paper_strip'`)
  - `place`: `target{lat,lon}`, `tol` in NM
- `surface` is `"carta"` or `{"figure": "Figure 20.jpg", "hotspots": [...]}`. **Steps on a figure surface must not use `tool` or `place`.**
- `receta` names a receta id the step unlocks after it's done.
- `live: false` missions (m3–m6) exist in the file with title, `n` and `questions` only. That lets the mapping test cover all 77, and the taller shows them as "próximamente".

Content for this slice:
- **m1 · Leer el mapa** (about 7 steps). The spec's coverage list is the requirement. Suggested order: airport color (tap) → airport data box, e.g. Lima's elevation (number, `ft`, tol 0) → terrain tint and MEF on the route, i.e. the highest of the quadrants crossed (choice) → obstacle clearance (number, `compute:'obstacle_clearance'`, `clearance_ft:500`) → checkpoint flag (tap, then choice of what it means) → drop the plane on Huacho's lat/long (place, tol 3 NM) → **bridge** on an exam figure (tap a matching symbol, then choice). Recetas: MEF rule and obstacle clearance.
- **m2 · Medir** (about 7 steps): plotter once (number, `compute:'true_course'`, `tool:'plotter'`, tol 3) → by hand: quadrant (choice) then estimate (number, tol 10, no tool) → reciprocal trap (choice between TC and TC±180) → paper-strip distance (number, `compute:'distance_nm'`, `tool:'paper_strip'`, tol 3) → magnetic course (number, `compute:'magnetic_course'`, tol 1) → deviation from a compass card (choice) → **bridge** estimating a course by hand on an exam figure (number or choice). The bridge must use a different airport pair than any bank question in m2's pool. Recetas: "1′ de latitud = 1 NM", "RM = RV − Este / + Oeste".
- **Question map:** assign all 77 `VUELO EN RUTA` ids to the mission that *teaches the skill*:
  - m1: symbols, colors, airport data, obstacles, MEF, flags, lat/long
  - m2: course, distance, variation, deviation
  - m3: wind, heading, groundspeed, distance/time/speed
  - m4: airspace classes, dimensions, requirements, special-use areas, airspace read on a chart
  - m5: ETE, fuel, required airspeed, time zones
  - m6: any question needing skills from more than one mission
- `method` (one short Spanish line describing the by-hand way to solve it) and `by_hand_ok` are **required for every m1/m2 question**. Leave them null for m3–m6, to be done in their slice. If a question can't be solved by hand among its 3 options, set `by_hand_ok:false` and explain why in `method`.
- Each `missions[].questions` must equal the ids mapped to it.

- [ ] **Step 1: Write failing data tests:**
  - `question_map` keys are exactly the 77 bank ids with category `VUELO EN RUTA`, and none are missing or extra
  - each mission's `questions` equals its mapped ids
  - m1 and m2 each own ≥ 5 questions
  - every m1/m2 entry has a non-empty `method` and boolean `by_hand_ok`
  - step ids are `${mission}-${k}` sequential and unique
  - each step validates against its kind's required fields
  - no figure-surface step has `tool` or `kind:'place'`
  - every `compute` step resolves via `expectedValue` to a finite number against the chart
  - every `receta` reference exists
  - each prompt is ≤ 40 words (`prompt.split(/\s+/).length <= 40`)
  - every hotspot's figure file exists in `data/figures/`

- [ ] **Step 2: Run to confirm failure.**

- [ ] **Step 3: Author the content.** Read each of the 77 questions and its `reason` to map it. Use `?pick` (Task 6) on the figures to author the hotspots.

- [ ] **Step 4: Run** `node --test tests/*.mjs`. All pass.

- [ ] **Step 5: Commit** `content(misiones): missions 1–2 and full question→mission mapping`

---

### Task 8: Mission player, taller entry and logging

**Files:**
- Create: `src/js/misiones.js`
- Modify: `src/js/taller.js` (new top section)
- Modify: `src/js/main.js` (load `data/misiones.json` and the chart into `ctx.data`)
- Modify: `src/css/app.css`

**Interfaces:**
- Consumes: Task 1 row shapes and nav, Task 2 `gradeAnswer`, `expectedValue`, `missionProgress`, Task 3 block shape, Task 5 `renderCarta` api, Task 6 `renderFigura` api, Task 7 schema.
- Produces: `misionesView(root, ctx, onExit)`, plus `ctx.data.misiones` and `ctx.data.cartas` (`{[chartId]: chart}`).

Behavior:
- **Taller top section "🛩️ Vuelo en ruta — misiones":**
  - a progress line across the 6 missions (done / current / próximamente for `live:false`)
  - a primary button **"Continuar"** that goes straight to `missionProgress(...)[current].next`
  - a list of missions, where finished ones can be replayed
- **Briefing** (`nav view:'briefing'`): the chart with the route drawn, the briefing line, and one button.
- **Step** (`nav view:'step'`): the step progress bar at the top, the surface, then the prompt and answer control.
  - On submit, append `mission_attempt` with `try`, `answer`, `correct`, `off_by`, `ms_to_answer` (from render to submit) and `hint_shown`.
  - **Wrong answer** → show the consequence on the surface and the `hint`, then allow a retry:
    - `number`/`deg`: `drawLine` of his course next to the true route
    - `place`: his drop + `showRing` at the target + "a N NM"
    - `tap`: `highlight` the right feature as `hint`
  - **After 2 misses** → reveal the answer on the surface and show a "Seguir" button (`revealed:true`).
  - **On success** → append `mission_step` with `seconds` = visible time on this step (pause while `document.hidden`). Show the `explain_ok` line, and the receta card if the step unlocks one (`nav view:'receta'`).
  - Steps never block. Reveal guarantees progress.
- **Prueba** (`nav view:'prueba'`): `quizPlayer(root, {type:'quiz', source:'ids', ids: mission.questions, category:'VUELO EN RUTA', mission: mission.id, cap: 8}, ctx)`.
- **Fin** (`nav view:'fin'`): append `mission_progress {completed:true, seconds, steps_done, last_step}`. Celebrate with the plane flying the route (`flashCelebrate` plus an animation along the route), then show a "Siguiente misión" button.
- **Exiting:** "← Salir" on any mission screen appends `mission_progress {completed:false, …, last_step}` before `onExit`. Reloading or backgrounding writes nothing extra. Resume comes from `missionProgress`.
- **Lesson links** (`mission.lessons`) use `lessonReview`, as `taller.js` does.

- [ ] **Step 1: Implement the player and the taller section.**

- [ ] **Step 2: Browser run-through** at 1280×800 in light and dark, using only mouse/trackpad and keyboard:
  - Play m1 and m2 end to end, including deliberately wrong answers, a reveal, a receta, the bridge and the prueba.
  - Then quit m2 halfway, reload, press "Continuar", and confirm it resumes at the same step.
  - In the console, dump `getLog()` and check every row shape against Task 1. Check that there are no duplicate `mission_step` rows for one completion and that `mission_progress` exists for both the quit and the finish.
  - Screenshot each screen type.

- [ ] **Step 3: Run** `node --test tests/*.mjs`.

- [ ] **Step 4: Commit** `feat(misiones): mission player, taller entry, full step logging`

---

### Task 9: Mentor dashboard — Misiones section

**Files:**
- Modify: `progreso/dash.js` (fetch `../data/misiones.json`, new section after the activity timeline)
- Modify: `progreso/index.html` (styles only, if needed)
- Test: covered by Task 2's `missionReport` tests. Add one more there if rendering needs a field the report lacks.

**Interfaces:**
- Consumes: `missionReport(rows, missions)` (Task 2) and the timeline labels (Task 1).

Rendering (English):
- **Missions × steps grid.** Cells are colored done / opened / not started. Each cell shows `M:SS`, tries and ✓ first try or ↺ revealed.
- **Clicking a cell** expands every attempt: time, answer as readable text (e.g. `347° (off +15°)`, `dropped 4.2 NM away`, `tapped ob1`), correct/incorrect, and seconds to answer.
- **Per mission:** status, total time, prueba `score/total`, and **before → after** first-attempt accuracy on its questions (e.g. `before 3/8 (38%) → after 6/7 (86%)`).
- **"Stuck" list** from `report.stuck`, with a note that this is where to dig at the Sunday check-in.
- Missions with `live:false` show as "not built yet".

- [ ] **Step 1: Implement.**

- [ ] **Step 2: Verify locally** with the log produced in Task 8, using the README's `curl` and the mentor-header method or a seeded local D1. Check that grid numbers match what you did in Task 8's run-through.

- [ ] **Step 3: Commit** `feat(progreso): Misiones section — every step, attempt and before/after accuracy`

---

### Task 10: Offline, docs, version — ship it

**Files:**
- Modify: `sw.js` (`CORE` gets `src/js/misiones.js`, `src/js/misiones-logic.js`, `src/js/carta.js`, `src/js/figura-overlay.js`, `data/misiones.json`, `data/misiones/carta-costa-central.json`)
- Modify: `SPEC.md`:
  - §5.11: new "Misiones de Vuelo en ruta" subsection summarizing the spec, logging kinds, and the dashboard section
  - §3.3 and §10: record "exam-day tools: no calculator, no plotter, no E6B (mentor, 2026-10-22)" and remove the E6B assumption and the reminder text
  - §3.2 note: Vuelo en ruta's airspace questions are taught in chapter 15, and the chapter mapping is intentionally unchanged
- Modify: `data/config.json` (`content_version`) → run `node scripts/sync-sw-version.mjs`
- Test: `tests/sw-version.test.mjs`

- [ ] **Step 1: Write a failing test.** It parses the `CORE` array literal out of `sw.js` and asserts that it contains each of the six new paths.

- [ ] **Step 2: Run to confirm failure,** then add the paths to `CORE`.

- [ ] **Step 3: Update SPEC.md, bump `content_version`, run `node scripts/sync-sw-version.mjs`.**

- [ ] **Step 4: Full check.** Run `node --test tests/*.mjs` (all pass). In the browser: load the app once, go offline (DevTools → Network: Offline), reload, and run m1's first three steps. Confirm the rows are queued and sync once you're back online.

- [ ] **Step 5: Commit** `chore(misiones): precache, SPEC §5.11/§10, content_version bump`

Deployment follows the README and is the mentor's call. It is not part of this plan.
