# La carta, paso a paso — Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the guided chart-reading class with chapters 1–3 (La hoja · Aeropuertos · Altura, obstáculos y puntos), «Mis trucos», a per-chapter prueba, full tracking and the `/progreso` section.

**Architecture:** A new card player (`src/js/clase.js`) built like the mission player. The chart sits on the left and the card on the right, it uses the same CSS grid, and it logs every screen and answer. Cards are data (`data/clase-carta.json`). A card draws on one of three surfaces: the living Peru chart (`carta.js`), an exam figure (`figura-overlay.js`), or a new close-up legend illustration (`src/js/leyenda.js`). Progress, trucos and the mentor report are derived from the log. They use generic unit/item functions extracted from `misiones-logic.js`, so missions and chapters share one implementation.

**Tech Stack:** Vanilla ES modules, no build step, SVG, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-22-carta-paso-a-paso-design.md`

## Global Constraints

- All student-facing copy is Spanish, in Piero's casual register. Mentor-facing `/progreso` copy is English.
- Card prompt ≤ 40 words; one card ≈ ≤ 60 s.
- A wrong answer never only says "Incorrecto": it says what he touched or chose. After 2 misses the answer is revealed and he continues. Nothing is ever a gate.
- Every fact or mnemonic is traceable to PHAK ch. 15–16, the FAA sectional legend conventions seen in Figures 20–26, or bank `reason` text. The reviewer's corrections are binding: ★ after the CT frequency = part-time tower, ★ on top of the symbol = beacon; MEF = highest terrain/obstacle + 100–300 ft, rounded up to the next 100; «Este resta» is true → magnetic only; symbol shapes by runway length/surface.
- Chart colours are fixed paper colours (no inversion in dark mode). Use the existing `carta.js` palette constants (`INK`, `MAG`, `BLUE`, `TERRAIN`).
- Laptop first: at ≥ 1024 px the surface is on the left and the card on the right (reuse `.mision-grid`, `body.misiones-wide`).
- New log kinds: exactly `clase_attempt`, `clase_card`, `clase_progress`. Detail keys: `clase` (chapter id, e.g. `c2`) and `card` (e.g. `c2-4`). **Never pass `chapter` in `nav()` extras**: `main.js#nav` copies `extra.chapter` into the row's PHAK chapter column.
- Content workflow: bump `content_version` in `data/config.json`, then `node scripts/sync-sw-version.mjs`; full test run `node --test tests/*.mjs`.

## Review Focus

1. **Mission regressions from the shared-logic refactor.** `missionProgress` / `missionReport` must return byte-identical results for mission rows. The existing `tests/misiones-logic.test.mjs` must stay green with no edits (Task 1).
2. **A "mira" card (no answer) in the report.** It must show as done with `first_try_correct: null`, not ✗, and never appear in "stuck" (Task 1 test).
3. **Resuming mid-chapter.** Leaving at card 5 and coming back via «Continuar» must start at card 5, not card 1, and leaving must write a `clase_progress {completed:false}` with `last_card` (Task 1 test + Task 5 browser check).
4. **A prueba with fewer than 3 or more than 5 teaches ids.** Cap at 5, and use all of them when fewer (Task 5: `cap: 5` passed; the `ids` selector already returns all when the pool is smaller).
5. **Dark mode and a 1280×800 viewport.** The legend close-ups must keep their paper look and must not overflow the left pane (Task 3/5 browser check).

---

### Task 1: Shared unit/item progress + report, and clase-logic

**Files:**
- Modify: `src/js/misiones-logic.js` (extract generics from `missionProgress`, `missionAccuracy`, `missionReport`)
- Create: `src/js/clase-logic.js`
- Test: `tests/clase-logic.test.mjs` (new); `tests/misiones-logic.test.mjs` must pass unchanged

**Interfaces:**
- Produces in `misiones-logic.js`:
  - `export const MISSION_SPEC = { unit: 'mission', item: 'step', items: 'steps', questions: 'questions', kinds: { attempt: 'mission_attempt', item: 'mission_step', progress: 'mission_progress' } }`
  - `export function unitProgress(rows, units, spec)` → `{[unitId]: {started, completed, done:Set, next: itemId|'prueba'|null, lastTs}}`
  - `export function unitReport(rows, units, spec)` → `{units: [...], stuck: [...]}`. Each unit report is the same shape as today's mission report, but items are keyed `items` (not `steps`), and `first_try_correct` is `null` when an item finished with zero attempts.
  - `missionProgress(rows, missions)` = `unitProgress(rows, missions, MISSION_SPEC)`; `missionReport(rows, missions)` returns `{ missions: r.units with each .steps = .items, stuck }`. Keep the old shape exactly.
  - `missionAccuracy(rows, mission, ts)` is kept; add `unitAccuracy(rows, qids, ts)`.
- Produces in `clase-logic.js`:
  - `export const CLASE_SPEC = { unit: 'clase', item: 'card', items: 'cards', questions: 'teaches', kinds: { attempt: 'clase_attempt', item: 'clase_card', progress: 'clase_progress' } }`
  - `export const claseProgress = (rows, chapters) => unitProgress(rows, chapters, CLASE_SPEC)`
  - `export const claseReport = (rows, chapters) => unitReport(rows, chapters, CLASE_SPEC)`
  - `export function gradeCard(card, answer, chart)` → `{correct, off_by}`. Delegates `tap|choice|number|place` to `gradeAnswer`; `drag` answers `{label, part}` → `{correct: card.slots[label] === part, off_by: null}`.
  - `export function unlockedTrucos(rows, chapters)` → `[{chapter, card, truco}]` in chapter/card order, one per card that has a `truco` and at least one `clase_card` row.
  - `export function cardWords(card)` → number of words in `card.prompt` (used by the data test).

- [ ] **Step 1: Write failing tests** in `tests/clase-logic.test.mjs`. Use a 2-chapter fixture (c1: cards `c1-1` mira with truco, `c1-2` tap, `c1-3` drag; c2: `c2-1` choice) and hand-built rows:
  - `claseProgress` with no rows → `started:false, next:'c1-1'`. With a `clase_card` for c1-1 and c1-2 → `next:'c1-3'`. With all cards done → `next:'prueba'`. With a `clase_progress {completed:true}` → `completed:true, next:null`.
  - `claseReport`: c1-1 done with no attempts → `items[0].first_try_correct === null`, `status:'done'`, and absent from `stuck`. c1-2 with attempts [wrong, right] → `tries:2`, `first_try_correct:false`, present in `stuck`.
  - `claseReport` accuracy: a quiz row `{detail:{clase:'c1', items:[{qid:'q1',correct:true}]}}` after an earlier quiz row on q1 that was wrong → `accuracy.before {n:1,ok:0}`, `after {n:1,ok:1}` when `teaches:['q1']`.
  - `gradeCard` drag: `{label:'elev', part:'p-elev'}` with `slots:{elev:'p-elev'}` → correct; wrong part → incorrect.
  - `unlockedTrucos`: only c1-1 returns once, even if c1-1 was finished twice.
- [ ] **Step 2: Run** `node --test tests/clase-logic.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3: Refactor** `misiones-logic.js` to the generic functions using `spec` field names: `r.detail[spec.unit]`, `r.detail[spec.item]`, and `spec.kinds.*`. Nav rows match by `r.detail[spec.unit] === id` (mission nav already carries `mission`). Then write `clase-logic.js`.
- [ ] **Step 4: Run** `node --test tests/clase-logic.test.mjs tests/misiones-logic.test.mjs`. Expected: all PASS, with no edit to the misiones test.
- [ ] **Step 5: Commit** `feat(clase): shared unit progress/report + clase-logic`.

### Task 2: Tracking plumbing (validator, derive, quiz rows, timeline)

**Files:**
- Modify: `functions/api/_validate.mjs` (add the 3 kinds), `src/js/derive.js:112` (ignore `clase_` like `mission_`), `src/js/players.js:100` (pass `block.clase` into quiz `detail.clase`), `src/js/timeline.js` (labels)
- Test: `tests/result-validate.test.mjs`, `tests/timeline.test.mjs`, `tests/derive.test.mjs`

**Interfaces:** Row shapes, all `detail`:
- `clase_attempt {clase, card, try, answer, correct, off_by, ms_to_answer, hint_shown}`
- `clase_card {clase, card, title, tries, first_try_correct, revealed, seconds}`
- `clase_progress {clase, title, completed, seconds, cards_done, last_card}`
- nav `{screen:'clase', clase, card, view}` with view ∈ `menu|card|prueba|fin|trucos`

- [ ] **Step 1: Failing tests.**
  - The validator accepts each of the three kinds.
  - A timeline `clase_card` row `{clase:'c2', card:'c2-4', title:'La caja de datos', tries:2, seconds:40}` renders the label `Clase · cap. 2 · tarjeta 4 «La caja de datos» · 2 intentos · 40 s` with icon `📘`.
  - `clase_progress` completed renders `Clase cap. 2 «Aeropuertos» completa · N min`; abandoned renders `Clase cap. 2 «Aeropuertos»: salió en la tarjeta 4`.
  - Nav with `screen:'clase'` renders `Clase 2 · tarjeta 4 (card)`.
  - derive: a day with only `clase_*` and nav rows has `act.any === false`, so it doesn't count toward streaks.
- [ ] **Step 2: Run** those three test files. Expected: FAIL.
- [ ] **Step 3: Implement.** In timeline, add `clase: 'Clase'` to `SCREEN_LABELS`. Ids `c2` / `c2-4` → `2` / `4` via the same strip-prefix helpers. `navLabel` handles `d.clase` like `d.mission`.
- [ ] **Step 4: Run** `node --test tests/*.mjs`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat(clase): tracking kinds, derive ignore, quiz clase tag, timeline labels`.

### Task 3: Legend close-ups (`src/js/leyenda.js`) and the chart pulse

**Files:**
- Create: `src/js/leyenda.js`
- Modify: `src/js/carta.js` (add `pulse(ids)` to the api; a CSS class on highlight marks), `src/css/app.css` (`.c-pulse` keyframes, `.leyenda-*` styles)

**Interfaces:**
- `export const SIMBOLOS` — map id → `{title, parts: {[partId]: {says}}, draw(svg, H) }`. `H` is a helper that registers a tappable/droppable part: `H.part(partId, ...svgNodes)`.
- `export function renderSimbolo(container, id)` → api compatible with what `clase.js` uses from carta/figura:
  `{kind:'simbolo', onTap(fn), highlight(ids, tone), pulse(ids), clearMarks(), explainFeature(id) /* shows parts[id].says in a popover */, partRect(id) /* DOMRect for drag hit-testing */, destroy()}`.
- `carta.js` api gains `pulse(ids)`: like `highlight(ids,'hint')`, but the ring animates (`.c-pulse`).

Symbols for slice 1. They're drawn large on a paper background (`#f3ecd8`) in the chart palette. Each part's `says` is the one-line "what this is", shown on a wrong tap:
- `reticula`: a 1°×1° graticule close-up, N/W-agnostic, with parallels (`lat-*`), meridians (`lon-*`), minute ticks on one meridian, and degree labels. Parts: `paralelo`, `meridiano`, `tick-minuto`.
- `apt-colores`: two airports side by side, blue with tower and magenta without (part ids `azul`, `magenta`).
- `apt-formas`: three shapes — runway outline with no circle (`pista-larga`), circle with runway inside (`pista-pavimentada`), empty circle (`sin-pavimento`).
- `apt-servicios`: a circle with 4 fuel ticks (`combustible`), a ★ on top of the symbol (`faro`), a circle with an R (`privado`), and a plain circle (`sin-servicios`).
- `caja-datos`: a data box in blue, `NORFOLK INTL (ORF)` / `CT – 120.8 ★  ATIS 127.15` / `26 L 90  122.95`, with each token a part: `nombre`, `ct`, `estrella-pt`, `atis`, `elev`, `luces`, `largo`, `unicom`. A Ⓒ CTAF variant line for a magenta box: `ctaf`.
- `obstaculos`: a single tower `1249 (349)`, a group, and a lighted one; parts `msl`, `agl`, `grupo`, `iluminado`, `simple`.

- [ ] **Step 1:** Implement `leyenda.js` and `pulse`, then add a temporary `?leyenda=<id>` debug hook in `clase.js` (Task 5) or a scratch HTML page to view each symbol.
- [ ] **Step 2: Browser check.** View each symbol at 1280×800, in light and dark mode. Pass = every part is tappable and its `says` appears, nothing is clipped, and the chart look is kept in dark mode.
- [ ] **Step 3: Commit** `feat(clase): legend close-up illustrations + chart pulse`.

### Task 4: Content — `data/clase-carta.json` for chapters 1–3, plus teaches for all 7

**Files:**
- Create: `data/clase-carta.json`
- Test: `tests/clase-data.test.mjs`

**Schema** (decided):
```
{ "chapters": [ { "id":"c1", "n":1, "icon":"🌐", "title":"La hoja", "live":true,
    "intro":"…≤40 words…", "practice_mission":"m1", "teaches":["q3530", …],
    "cards":[ { "id":"c1-1", "kind":"mira|tap|choice|number|place|drag", "title":"…", "prompt":"…",
        "surface":"carta" | {"simbolo":"caja-datos"} | {"figure":"Figure 20.jpg","hotspots":[{"id","x","y","r","says"}]},
        "focus":"<carta feature id>", "pulse":["<feature or part id>"],
        "truco":{"icon":"📌","text":"Paréntesis = Piso…"},
        // tap: targets[], hint, explain_ok · choice: options[], answer, hint, explain_ok
        // number: expected | compute+obstacle+clearance_ft, unit, tol, hint, explain_ok
        // place: target{lat,lon}, tol, start{lat,lon}, hint, explain_ok
        // drag: labels[{id,text}], slots{labelId: partId}, hint, explain_ok
} ] } ] }
```
Chapters 4–7 are present with `live:false`, `cards:[]`, title, icon and `teaches`.

**Teaches assignment** (decided): c1 = the lat/long questions of m1 (q3530, x623, q3535, q3536, q3543, q3567). c2 = airport questions (q3637, q3633, q3635, q3627). c3 = the remaining m1 questions (x579, q3638, q3639, q3640, q3631, q3632, q3634, q3636, q3642). c4 = the chart-read NAVEGACIÓN ids (q3643, q3552, q3559, q3553, q3560, q3539, q3533). c5 = the remaining m4 questions. c6 = m2 + m3 + m5. c7 = m6. Each VUELO EN RUTA id appears in exactly one chapter.

**Card outline** (the builder writes the copy; each chapter 10–14 cards, ending with 1–2 Figura cards):
- c1 La hoja: what a sectional is (carta, whole) → parallels vs meridians on `reticula` + truco LONGitud largas → tap a parallel → Peru S/W vs exam N/W (choice) → minute ticks + truco "un minuto, una milla" → count NM between two parallels (number) → latitude first, then longitude + truco escalera → place plane at a S/W position (place, carta) → longitude minutes are not NM (choice, q3530 idea) → "área 3" circled numbers on Figure 20 (tap) → read Currituck lat/long on Figure 20 (choice, x623 idea).
- c2 Aeropuertos: blue/magenta + truco A/M on `apt-colores` → tap airports without a tower on carta → shapes on `apt-formas` + truco → tap the unpaved one → services on `apt-servicios` (fuel ticks, beacon ★ on symbol, R) + truco → tap the one with fuel → the data box on `caja-datos` + truco «de arriba abajo: quién es → con quién hablas → cuánto mide» → drag labels onto the data box → ★ after CT = part-time (choice) → Ⓒ = CTAF (choice) → Huacho elevation from the chart (number, 338) → Figure 20 tap the no-tower airport and read Chesapeake elevation.
- c3 Altura, obstáculos y puntos: terrain legend (carta focus `legend`) + truco → band choice → MEF (carta, focus a MEF feature) + truco "techo del cuadrante, con colchón" → route MEF choice (highest crossed) → obstacles on `obstaculos` + truco Paréntesis = Piso → drag MSL/AGL onto the numbers → clear `ob4` by 500 (number, compute obstacle_clearance) → +1000 over a town + truco campo/ciudad → clear `ob3` by 1000 (number) → caution box (carta focus `caution1`) choice → checkpoint flag + truco → tap a flag on carta → Figure 20 tap the flag at Lake Drummond (q3632 idea).

Figure hotspots are authored in image pixels using `?pick` (see `figura-overlay.js`).

- [ ] **Step 1: Write failing data tests** in `tests/clase-data.test.mjs`:
  - ids are unique; each card kind is in the allowed set; `cardWords(card) <= 40`.
  - every `mira` card has a `truco` or a reason to have none (allow `truco:null` explicitly).
  - tap targets exist: carta feature ids (airport/obstacle/checkpoint/caution/legend/`mef:` ids built from the chart), `SIMBOLOS[id].parts`, or hotspot ids. `pulse` ids exist the same way.
  - drag `slots` values are parts of the card's simbolo, and every label has a slot.
  - number cards grade their own expected value as correct (`gradeCard`), and choice `answer` is in range.
  - **Coverage:** every `VUELO EN RUTA` id in `data/bank.json` appears in exactly one chapter's `teaches`; every teaches id exists in the bank; live chapters have `teaches.length ≥ 3`.
  - Mission 1 is unaffected: `data/misiones.json` m1 step targets still exist on the chart.
- [ ] **Step 2: Run** the test. Expected: FAIL (file missing).
- [ ] **Step 3: Author the JSON.** Write the copy in Spanish (casual), check every fact against the bank `reason` text for the matching teaches question, and keep prompts ≤ 40 words.
- [ ] **Step 4: Run** `node --test tests/*.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** `content(clase): chapters 1–3 cards, trucos, teaches for all chapters`.

### Task 5: The class player, taller entry and «Mis trucos»

**Files:**
- Create: `src/js/clase.js`
- Modify: `src/js/taller.js` (new top section), `src/js/misiones.js` (`misionesCard`: a «¿Te costó? Repasa los capítulos 1–3» button that opens the class when m1 is started), `src/css/app.css`

**Interfaces:**
- `export async function loadClase(ctx)` → fetches `data/clase-carta.json` into `ctx.data.clase`. It also ensures the Peru chart is loaded, via `loadMisiones(ctx)`, which caches `ctx.data.cartas`.
- `export async function claseView(root, ctx, chapterId, onExit, startAt = null)`. `startAt` is a card id, `'prueba'`, or null.
- `export function claseCardView(root, ctx, backToTaller)` → a taller card element: a 7-chip progress line, the next chapter highlighted, `▶ Empezar/Continuar …`, one button per chapter (not-live = «Próximamente»), and `🧠 Mis trucos (N)`.
- `export function trucosView(root, ctx, onExit)` → all unlocked trucos grouped by chapter, with locked ones shown as «🔒 …» count only, and a «🖨️ Imprimir» button (`window.print()`, plus `@media print` rules that hide app chrome).

Player behaviour, mirroring `misionView` (reuse `activeTimer`, `flashCelebrate`, `.mision-*` classes; export `activeTimer` from `misiones.js` instead of copying it):
- No briefing screen. The chapter `intro` shows on card 1's panel kicker line. The header is `📘 Cap. N · Title — tarjeta i de n`, with a dot bar of cards plus the prueba.
- **mira**: mount the surface, `focusFeature(card.focus)` (carta), then `pulse(card.pulse)`. The panel shows the prompt, then the truco card (`.mision-receta` style) with `🧠 Se guardó en «Mis trucos»`, then «Siguiente →». It logs `clase_card {tries:0, first_try_correct:null, revealed:false}`.
- **tap / choice / number / place**: same flow as the mission `runStep`. Grade with `gradeCard`, log `clase_attempt` on every submit, and on a miss call `explainFeature(answer.feature)` so he sees what he touched. Hotspot misses on a figure show `hotspot.says`. Two misses → reveal. Then log `clase_card`.
- **drag**: label chips sit under the prompt. Dragging uses pointer events; on drop, hit-test `api.partRect(partId)` for each slot. A correct drop snaps the chip into a `✓` state; a wrong drop bounces back, shows the hint plus the part's `says`, and logs `clase_attempt {answer:{label, part}, correct:false}`. The second wrong drop of the same label auto-places it (revealed). The card finishes when all labels are placed: `tries` = number of drops, `first_try_correct` = no wrong drops, `revealed` = any auto-placed.
- **prueba**: `quizPlayer(box, {type:'quiz', source:'ids', ids: ch.teaches, category:'VUELO EN RUTA', clase: ch.id, cap: 5, title: \`Prueba · ${ch.title}\`}, ctx)`, then `ctx.refresh()`.
- **fin**: log `clase_progress {completed:true}`. Show the chapter's trucos, a «Practícalo: Misión 1 →» button when `practice_mission` is live (opens `misionView`), and «Siguiente capítulo →» when the next chapter is live.
- **leaving early** («← Salir»): log `clase_progress {completed:false, cards_done, last_card}`.
- nav: `ctx.nav('clase', {clase, card, view})` on every screen.

- [ ] **Step 1: Implement** `clase.js` and the taller and misiones wiring.
- [ ] **Step 2: Browser check** with `preview_start` at 1280×800. Play c1 fully: wrong tap, reveal, a place card, the prueba, fin. Leave c2 mid-way and confirm «Continuar» resumes at the same card. Do one drag card. Open Mis trucos. Check dark mode. Check the console for errors, and check the localStorage log has the expected `clase_*`, nav and quiz `detail.clase` rows.
- [ ] **Step 3: Commit** `feat(clase): card player, taller section, Mis trucos`.

### Task 6: `/progreso` Chart class section

**Files:**
- Modify: `progreso/dash.js` (generalise `missionsSection` into `unitsSection(title, report, units, {prefix, itemLabel, questionsKey})`. Missions call it with `{prefix:'M', itemLabel:'step', questionsKey:'questions'}`; the class calls it with `{prefix:'Ch', itemLabel:'card', questionsKey:'teaches'}`. Load `data/clase-carta.json` next to `misiones.json`.)

- [ ] **Step 1: Implement.** Mira cells show `·`, not ✓/✗. `attemptText` for drag reads `dropped “<label text>” on <part>`.
- [ ] **Step 2: Browser check:** `/progreso` renders both sections from a local log containing class rows. Locally the dashboard needs the mentor header (README "Local development"). If Access blocks it, verify `claseReport` output in node instead, and say so in the report.
- [ ] **Step 3: Commit** `feat(progreso): Chart class section`.

### Task 7: Release — precache, SPEC, version

**Files:** `sw.js` (CORE += `src/js/clase.js`, `src/js/clase-logic.js`, `src/js/leyenda.js`, `data/clase-carta.json`), `data/config.json` (`content_version` bump), `SPEC.md` (new §5.11.2), `README.md` (one line in the taller description, if one exists).

- [ ] **Step 1:** Edit the files, run `node scripts/sync-sw-version.mjs`, then run `node --test tests/*.mjs`. Expected: all PASS, including `sw-version.test.mjs`.
- [ ] **Step 2: Commit** `chore(clase): precache, SPEC §5.11.2, content_version bump`.
