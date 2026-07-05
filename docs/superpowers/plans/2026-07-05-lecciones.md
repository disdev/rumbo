# Lecciones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app the primary teacher — in-app lessons for all 16 assigned PHAK chapters with diagrams/widgets/checks/notebook prompts, step-by-step guided math with repetition, no hard timeline stops, full tracking on /progreso.

**Architecture:** Structured JSON lessons (`data/lessons/chNN.json`) rendered by one generic player; widget registry in vanilla JS; math template families gain step definitions whose values are computed by each family's existing generator; all telemetry flows through the existing append-only result log (new kinds `lesson_progress`, `lesson_check`, `notebook`); derive() stays a pure replay.

**Tech Stack:** Vanilla ES modules, no build step, Cloudflare Pages + D1, node:test for pure-logic tests, `node scripts/validate-lessons.mjs` for content integrity.

## Global Constraints

- All student-facing text in Spanish (SPEC §1); tone per SPEC §3.4 "Voice and depth": teen-approachable, extensive coverage, analogies, why-before-what, "esto cae en el examen" callouts.
- Text blocks ≤ ~80 words (chunking); 6–12 sections per chapter.
- Checks/notebook/guided/práctica/maintenance are NEVER gates (SPEC §6 unchanged); lesson completion (all sections viewed) is the only new deterministic completion.
- Every scheduling/derived value must remain a pure function of the result log (SPEC §8); result rows immutable, new kinds only.
- No calculator affordances; scored math attempts stay answer-only.
- Offline: everything new precached; no runtime network dependency.
- No hard timeline limits (mentor 2026-07-05): nothing truncates a running day.

---

### Task 1: Remove the hard stop (SPEC §4.4 change)

**Files:**
- Modify: `src/js/session.js:39-46` (remove truncation)
- Modify: `data/config.json` (drop `schedule.hard_stop`)

**Interfaces:**
- Produces: session runner that never truncates; `session_end` rows unchanged (overrun derivable from row `ts`).

- [x] Remove the `limaHHMM() >= config.schedule.hard_stop` block in `runSession`; replace with a soft note in the block header when past 18:00 ("Pasadas las 6 — el objetivo es cubrir el material de hoy, no el reloj. Si necesitas parar, para."), rendered once per block, never blocking.
- [x] Remove `hard_stop` from `data/config.json`.
- [x] Commit.

### Task 2: Math template steps + generator step values

**Files:**
- Modify: `data/math-templates.json` (per family: `steps` metadata — labels + symbolic formulas, per tier where paths differ)
- Modify: `src/js/mathgen.js` (each GEN returns `steps: [{label, formula, value, unit}]`; expose via `generateProblem`)
- Test: `tests/mathgen.test.mjs`

**Interfaces:**
- Produces: `generateProblem(templates, familyId, tier)` → adds `steps: [{label: string, formula: string, value: number, unit: string}]`, where `steps[steps.length-1].value === prob.answer`.

- [x] Write failing test: for every family × tier × 25 seeded generations, `prob.steps` is non-empty, every step value is finite, and the last step's value equals `prob.answer`.
- [x] Add `steps` label/formula metadata to `math-templates.json` per family/tier path.
- [x] Extend each GEN generator to emit ordered intermediate values matching the JSON step metadata (content in JSON, computation in the generator — same split the file already uses).
- [x] Run tests; commit.

### Task 3: Guided math (resolución guiada) + práctica inmediata + failed-attempt walkthrough

**Files:**
- Create: `src/js/guided.js` — `guidedExample(root, prob, ctx)` (typed per-step inputs, per-step right/wrong, wrong shows value and continues) and `practicaBurst(root, {family, tier, n}, ctx)`
- Modify: `src/js/players.js` (drillPlayer: first-exposure guided example + práctica before first scored attempt; failed attempt offers guided re-walk of up to 2 missed problems with their actual numbers)
- Modify: `data/config.json` (`math.practica_size: 4`)

**Interfaces:**
- Consumes: `prob.steps` from Task 2.
- Produces: drill rows with `detail.mode: 'guiada' | 'practica'` (unscored — derive must exclude from ladder attempts); notebook prompt at the end of every guided example ("copia estos pasos en tu cuaderno como receta", logged `kind: 'notebook'`, `detail.context: 'math'`).

- [x] Build `guided.js`; wire into `drillPlayer` (first exposure = no prior non-preview attempts for family×tier in `state.ladder`); wire failed-attempt walkthrough; add config; commit.

### Task 4: derive() — new kinds, rep counters, maintenance SRS, lesson state

**Files:**
- Modify: `src/js/derive.js`
- Test: `tests/derive.test.mjs`

**Interfaces:**
- Produces on state: `lessons: Map(chapterId → {sectionsSeen:Set, completed:bool, checks:{n,ok}, notebooks:Set, secondsBySection:Map})`; `mathReps: {family → {lifetime, streak}}`; `mathMaintenanceDue: [{family, tier}]`; `chapterState.read` now ALSO set by `lesson_progress` rows with `detail.completed` (old `lectura` rows keep working).
- Rules: `drill` rows with `detail.mode` in (guiada, practica, maintenance) and `detail.preview`/`detail.errordeck` never touch `ladder.attempts`/`passedTier`; every drill item (all modes) increments `mathReps` lifetime and streak; maintenance due = family passedTier ≥ 1 and last drill row of that family older than interval ladder 1/3/7/14 (then every 14).

- [x] Write failing tests: lesson_progress completion sets read; guided rows don't advance ladder; reps count across modes; maintenance due schedule.
- [x] Implement; run tests; commit.

### Task 5: Lesson player + widgets + home entry

**Files:**
- Create: `src/js/lessons.js` — `leccionPlayer(root, block, ctx)` (sequential first pass), `lessonReview(root, chapterId, sectionId, ctx, onExit)` (free navigation), block renderers for all §3.4 block types, on-demand `fetch('data/lessons/ch'+id+'.json')`
- Create: `src/js/widgets.js` — registry `{name → render(el, params)}`: `angulo-ataque`, `cuatro-fuerzas`, `superficies-control`, `flaps`, `instrumento`; failure → captioned note fallback (never blocks)
- Modify: `src/js/session.js` (PLAYERS: `leccion: leccionPlayer`)
- Modify: `src/js/planner.js` (replace `lectura` block with `{type:'leccion', chapter, title:'Lección: cap. N — título'}`)
- Modify: `src/js/main.js` (home: "Repasar lecciones" chapter list; tracker grid shows `mathReps` counts/streaks)
- Modify: `src/css/app.css` (lesson layout, progress dots, callouts, checks, notebook cards, widgets)

**Interfaces:**
- Consumes: `guidedExample`/`practicaBurst` (guided_math blocks), `state.lessons`, `state.mathReps`.
- Produces rows: `lesson_progress` (chapter, detail: {section, seconds, completed?}), `lesson_check` (chapter, detail: {check_id, section, chosen, correct}), `notebook` (chapter, detail: {prompt_id, section}).
- Miss routing: quiz reveal "volver a la sección" (from `chapters.json` section list when populated) opens `lessonReview`.

- [x] Build player + widgets + wiring + styles; manual smoke via local server; commit.

### Task 6: Content pipeline — 16 chapter lessons + diagrams + chapters.json sync

**Files:**
- Create: `data/lessons/ch02.json` … `ch17.json` (16 files) + `data/lessons/diagrams/*.svg`
- Create: `data/lessons/index.json` (chapter ids + diagram file list, for SW precache)
- Create: `scripts/validate-lessons.mjs` (schema, check answers valid indexes, widget names exist in registry list, diagram/figure files exist, text-block word caps, ≥1 check + ≥1 notebook per section, section count 6–12)
- Create: `scripts/sync-chapters.mjs` (populate `chapters.json` sections `{id,title,key_points}` from lesson files)
- Modify: `data/chapters.json` (via sync script)

**Interfaces:**
- Consumes: lesson JSON schema from Task 5; SPEC §3.4 voice/depth rules.
- Produces: every assigned chapter's lesson passes `node scripts/validate-lessons.mjs`.

Authoring (parallel agents, one per chapter): each agent receives the schema, the voice directive, its PHAK chapter outline, the bank categories mapped to that chapter (with sample questions to target "esto cae en el examen" callouts), the widget list, and produces the lesson JSON + SVG diagrams. Chapter 3 first (template-setter), then all others in parallel batches.

- [x] Author ch03; validate; refine schema/validator as needed; commit.
- [x] Author remaining 15 chapters in parallel; validate all; run sync-chapters; commit.

### Task 6b: Logros (badges + micro-celebrations, SPEC §5.9)

**Files:**
- Create: `src/js/badges.js` — catalog `[{id, emoji, title, desc, earned(state)}]` + `earnedBadges(state)` pure function
- Modify: `src/js/players.js` (in-quiz 4-in-a-row / fraseo 15-streak / 10-10 drill micro-flash)
- Modify: `src/js/main.js` (badge shelf on home; post-append newly-earned toast)
- Modify: `progreso/dash.js` (earned badges + dates)
- Test: `tests/badges.test.mjs`

- [x] Implement catalog per SPEC §5.9 starter set (predicates over derived state); tests for 3 representative badges; wire UI; commit.

### Task 7: Offline precache + dashboard

**Files:**
- Modify: `sw.js` (CORE += `src/js/lessons.js`, `src/js/widgets.js`, `src/js/guided.js`, `data/lessons/index.json`; install step fetches index.json and precaches all lesson JSON + diagrams)
- Modify: `progreso/dash.js` (lesson completion per chapter, per-section time + check accuracy, notebook completion, math reps + maintenance adherence, planned-vs-actual session overrun)

- [x] Implement both; commit.

### Task 8: Dual-lens review + fixes

- [x] Review all lesson content through a private-pilot-instructor lens (technical accuracy: aerodynamics, systems, weather, performance numbers, DGAC/Peru specifics); apply fixes.
- [x] Review app flow + content through an ADHD-educator lens (chunking, engagement, reward cadence, friction points, notebook prompt quality); apply fixes.
- [x] Re-validate; commit.

### Task 9: Version bump + deploy + verify

- [x] Bump `config.json` `content_version`; update SPEC §8 repo layout if drifted; README note.
- [x] `npx wrangler pages deploy . --project-name rumbo-atk`(per README) and verify live app + a lesson end-to-end.
- [x] Commit; update memory.
