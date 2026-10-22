# Vuelo en ruta — misiones interactivas (design)

Date: 2026-10-22 · Status: draft for mentor approval · Lives in: Rumbo student app, el taller (SPEC §5.11)

## Why

Piero says about Vuelo en ruta: "I don't understand it, I can't remember the formulas, I get the questions wrong, I don't know how to read the maps, I don't know how to calculate the routes."

"Vuelo en ruta" is a category in the DGAC question bank, not a PHAK chapter. Its 77 questions mix three skills:

- reading sectional charts (49 of the questions use figures)
- navigation math: course, wind, heading, groundspeed, distance/time/fuel, time zones
- airspace: Classes B/C/D/E, restricted areas, MOAs, alert areas and prohibited areas

The app teaches these skills in the chapter 15 and 16 lessons. Those lessons are mostly text blocks plus checks, and the bank category is mapped only to chapter 16. Piero has only ever seen this material on a screen. He has flown a couple of times but has no cockpit or cross-country experience, and he has never held a paper chart or a plotter.

Our working theory (the mentor's agreement plus our read): the formulas don't stick because they arrive as rules to memorize, not as something he can picture. The fix is to teach through **planning and flying real routes by hand**. Each concept appears at the moment the flight needs it, and each formula comes out of something he has just done.

The time pressure: there is no exam date yet, but the mentor wants major progress over the next **two weeks** (through about 2026-11-05), and other skills are competing for that time. The module therefore has to become useful within days, not at the end.

## What success looks like

Piero can open one of the exam's own chart questions, for example "Refiérase a la Figura 20…", and work it out himself (find the airport, measure the course, read the airspace) instead of guessing. The measurable signal (my call) is his accuracy on the **first attempt at each VUELO EN RUTA question after finishing the mission that teaches it**, compared with his accuracy on those same questions before the mission. Both come from existing `quiz` rows plus the `mission_step` completion timestamp, so nothing is held back and no new state is needed.

## Goals

- Teach **all** Vuelo en ruta exam content from zero, through hands-on missions.
- Every step is something he does with his hands (drag, rotate, tap, set, pick), takes no more than about 60 seconds, and gives instant feedback.
- Mistakes are shown **on the map**, not in a paragraph. For example, if he forgets the wind, the plane drifts off the line. If he picks the wrong airspace ceiling, the side view shows the plane inside the shelf.
- Formulas appear only *after* he has done the thing by hand. They become a small "receta" card he unlocks and can look at again.
- Visuals have to be **incredible**. This is the mentor's explicit bar. It should look like a real aeronautical chart that someone cared about, not a wireframe.
- Easy to use: open it and the next step is obvious. No menus to work through and no decisions about what to study.

## Non-goals

- Replacing the chapter 15 and 16 lessons. They stay as they are. Missions link into them in review mode, the same way taller tools do now.
- Adding missions to the daily plan, the gates, or the 8-week calendar. Like everything else in the taller (§5.11), missions are never a gate and never homework.
- Teaching IFR, the VOR beyond what the bank asks, or real CORPAC chart products.
- A mentor dashboard view in the first release. Rows are logged from day one, and a dashboard line can follow.

## Anti-goals (failure even if it "works")

- Any screen that is mostly text. As a rule of thumb, no more than about 40 words of instruction per step screen.
- A formula shown before he has used the idea it describes.
- Any single step longer than about a minute, or a mission longer than about 15 minutes.
- Feedback that only says "Incorrecto" without showing *why* visually.
- Chart art that looks like placeholder boxes and circles.
- Factual errors in aviation content. Every rule and number must trace back to PHAK chapters 15–16 or to the bank's own `reason` text.

## Exam-day tools: none (mentor, 2026-10-22)

On exam day Piero works **entirely by hand**: no calculator, no plotter, and (we assume) no E6B. He has the printed figure, a pencil and presumably scratch paper (SPEC §3.3 already assumes pencil and paper). This decides how every skill is taught:

- In-app tools such as a rotating plotter or a live wind triangle are **for understanding only**. Each one is used once so he can *see* the idea, and then that step is taught again as a **by-hand method** he can use in the exam room.
- Every skill must end with a by-hand method, and the exam answers have 3 options, so **estimating and eliminating** is a first-class skill, not a fallback:
  - **Course**: which quadrant is the line heading toward → rough degrees measured against the nearest meridian → throw out the reciprocal (±180°) → apply variation in the right direction (E subtract / W add).
  - **Distance**: mark the route on the edge of the scratch paper and lay it against the latitude scale on a meridian (1′ = 1 NM).
  - **Wind**: mental rules of thumb, i.e. crosswind/headwind components by the angle between wind and course, WCA ≈ crosswind × 60 ÷ TAS, and GS ≈ TAS − headwind.
  - **Time/fuel**: hand arithmetic, as in the existing math families.
- **Builder requirement**: for every one of the 77 mapped questions, record which by-hand method solves it and confirm it really separates the right answer from the other two. A question that can't be solved by hand gets flagged, not hidden.
- Small related fix (separate from missions): SPEC §3.3/§10 still assume the E6B might be allowed, and families 5–6 show an "verifica con el E6B" reminder. Record the mentor's answer in SPEC §10 and remove that reminder.

## The shape (decided with the mentor)

Three ideas are combined. The mentor liked all three mockups, and the mission mockup was clicked most.

1. **The mission is the backbone.** Each mission is one flight, broken into about 6 steps in order, with a step progress bar at the top (see mockup A).
2. **The living chart is where everything happens.** One shared, beautiful chart component. He can tap any symbol to get a one-line explanation, toggle layers (airports, airspace, terrain, obstacles), and flip airspace into a **side view** (corte lateral). See mockup B.
3. **60-second challenges are the steps.** Each step is one hands-on puzzle, such as dragging the plane to a lat/long, rotating the plotter, setting the wind, or tapping the MEF. It comes with instant feedback and a lightweight streak flash (visual only, like existing widgets). See mockup C.

The mockups are in `.superpowers/brainstorm/*/content/direction.html`. They show direction, not final polish.

### Missions and coverage

**Peru first, exam charts last** (mentor decision). The early missions fly over a chart of the Peruvian coast drawn in sectional style, which is more motivating. The last mission replays the same skills on the exam's actual US figures, so on exam day Figure 20 is somewhere he has already flown.

**Bridge step (my call, offered to the mentor and not yet confirmed):** 49 of the 77 questions need a US figure, including almost all of the chart-reading ones. So each mission 1–5 ends its Peru flight with one short **"ahora en la carta del examen"** step that does the same thing on the matching exam figure, then its prueba. Question → mission assignment means *"the mission that teaches the skill"*, so each mission's prueba includes its figure questions. **Mission 6** is one complete flight from start to finish on the exam figures, plus a mixed prueba drawn from all 77. If a mission owns more than 8 questions, each run draws 5–8 of them, choosing ones he hasn't seen and ones he has missed first.

| # | Mission | Teaches (bank topics covered) |
|---|---|---|
| 1 | **Leer el mapa** — Lima → Huacho | Airport colors (blue = tower, magenta = no tower), fuel ticks, the airport data box, terrain tints, the MEF (highest in each quadrant; for the route, the highest MEF of the quadrants it crosses), obstacles (MSL in bold, AGL in parentheses, +500 / +1 000 ft clearance), visual-checkpoint flags, latitude/longitude (Peru is S/W) |
| 2 | **Medir** — same route | True course (see it once with an in-app plotter, then estimate it by hand), distance in NM by the paper-edge method, 1′ of latitude = 1 NM, true → magnetic (variation E/W), deviation |
| 3 | **El viento** | The wind triangle, WCA, true/magnetic heading, groundspeed, distance-time-speed (for example "2½ min at 98 kt"), and finding the wind from heading/track/TAS/GS (q3529-type questions). Reuses or extends the existing `navegador` widget |
| 4 | **Espacio aéreo** — passing Lima | Classes A–G as a vertical slice, B/C/D/E dimensions and floors/ceilings, reading `40/SFC`-type labels, segmented and solid circles, entry requirements (license, radio, transponder, ATC contact), part-time towers, satellite airports, restricted / MOA / alert / prohibited areas and who is responsible for collision avoidance |
| 5 | **Tiempo y combustible** | ETE, ETA, fuel burn + reserve, the required-airspeed questions (x638-type), time zones (Figure 27-type questions) |
| 6 | **Examen real** | A complete start-to-finish flight on the exam figures used by this category: 20, 21, 22, 23, 24, 25, 26, 27 (plus the single-use 59, 68, 69, 75 where they fit), by hand only, against the clock (about 1.8 min per question, matching the real exam's 50 questions in 90 min) |

**Every one of the 77 VUELO EN RUTA questions must be assigned to exactly one mission.** The builder produces that mapping (question id → mission) as data, and a test enforces it, so coverage can't silently drop.

### Inside a mission

- **Mission briefing** (one screen): the route on the chart, a short line of the "why" ("Mañana vuelas a Huacho. Primero: ¿qué hay en el camino?"), and one button.
- **Steps**: each is chart + task + answer control. A wrong answer shows the consequence on the chart, gives a one-line hint, and allows a retry. After two misses he gets a guided reveal. He always reaches the end, because steps are never gates.
- **Receta unlock**: when a step introduces a formula, a card slides in afterwards, for example "Lo que acabas de hacer: RV = curso ± WCA". It is collected in a per-mission "recetas" list. The builder can reuse the existing `rumbo` math family as the receta for mission 2/3 where it fits.
- **Cuaderno moment** (optional, one per mission at most): a notebook prompt, consistent with SPEC §3.4.
- **Prueba final**: 5–8 **real bank questions** assigned to that mission, run through the existing `quizPlayer` so they log normal `quiz` rows. That way misses flow into the existing error deck and SRS automatically. Figures render as they do today.
- **Mission complete**: a celebration plus a link to the next mission.

### The Peru chart (my call — not discussed in detail)

Peru doesn't publish FAA-style sectionals, so we **author our own** SVG chart of the central Peruvian coast in sectional style:

- **Real**: the coastline, the Lima (SPJC) and Huacho airport positions, the lat/long graticule, and the rough terrain bands.
- **Simplified and invented where needed**: airspace shapes and labels, obstacles, checkpoints and MEF figures. They teach the *same symbols* the exam figures use. Invented elements must be plausible, and the briefing never claims they are real procedure. A small "Carta de entrenamiento — no usar para navegación" label goes on the chart.
- **Accurate where the questions are scored**: lat/long readings, distances, course, and the magnetic variation used must be self-consistent and computed from the real coordinates. The builder should take the variation for the Lima area from a current reference (NOAA WMM) at build time and record its source.
- More than one route is fine (for example Lima → Huacho, Lima → Pisco) if a mission needs a heading or airspace situation the first route doesn't provide.

### The exam figures (mission 6)

The figures are raster JPGs (for example Figure 20 is 1002×1400). Interactions sit as an **overlay in image coordinates**: tap hotspots on symbols, draw the route line, mark distance along a paper edge, and markers for lat/long. Hotspot coordinates are authored as data per figure. No new images are needed. Because there's no plotter in the exam, the overlay **does not** offer a plotter here. He estimates, and the overlay then shows the true value so he can check how close he got.

## Where it lives and how it's built

- **Entry point**: a new top section in the taller, "🛩️ Vuelo en ruta — misiones", with a progress line (the next mission is highlighted). A one-tap "Continuar" resumes the current step.
- **Code**: vanilla ES modules, no build step, like the rest of the app. Suggested split, which the builder can adjust:
  - `src/js/misiones.js`: the mission player
  - `src/js/carta.js`: the living chart component, reusable by lessons and the taller
  - pure logic (geometry, wind triangle, scoring of a placement) in an `-logic.js` module with `node:test` tests, like `ops-logic.js`
  - content as data: `data/misiones.json` (missions, steps, question mapping, recetas) and chart data/SVG under `data/misiones/`
- **Logging**: each completed step appends a row (proposed `kind: 'mission_step'`, `detail: {mission, step, tries, first_try_correct}`). Row kinds that `derive.js` doesn't know about must stay harmless. **The new kind must also be added to `KINDS` in `functions/api/_validate.mjs`**, or the server rejects those rows. The prueba final uses normal `quiz` rows (needs a new `quizPlayer` source for an explicit id list). Those rows behave exactly like today's Practicar → Quiz por tema rows: they feed the error deck, SRS and chapter credit the same way. That behavior is accepted, not new. This is a deliberate exception to "widgets never log": a mission is a study activity, not a toy.
- **Progress** is derived from the log (mission/step completed), never stored separately, consistent with the app's replay architecture.
- **Offline**: every new JS and data file goes into the SW precache (`sw.js` `CORE` or the lesson-assets list). Follow the README content workflow: bump `content_version` → `node scripts/sync-sw-version.mjs`.
- **SPEC.md**: add a §5.11 subsection describing missions.
- **No change to the category→chapter mapping** in `chapters.json` (my call). `derive.js` credits chapterless quiz rows to the *first* chapter listed for the category and recomputes the whole log on every load. Adding chapter 15 would therefore rewrite Piero's past chapter 15/16 progress. Instead, mission 4 links into the chapter 15 airspace sections (review mode), and the SPEC notes that Vuelo en ruta's airspace questions are taught in chapter 15.

## Visual bar

- Use the app's own tokens (terracota accent, warm paper, serif titles) for the UI. Use **real sectional conventions** for the chart: blue/magenta airports, solid magenta Class C, segmented blue Class D, terrain tints, bold MEF numbers, obstacle symbols. The chart should be immediately recognizable as the same "language" as Figure 20.
- Mobile first (Piero's phone), touch targets ≥44px, smooth drag/rotate (pointer events, no lag), small motion on feedback (drift animation, the plane flying the route at mission end).
- Works in light and dark. The chart keeps its paper look in dark mode (a framed "paper" surface) rather than inverting.
- Test on a real phone-sized viewport before calling a mission done.

## Delivery order (two-week window)

1. **First slice (aim: within ~3–4 days):** the chart component + mission player + missions 1 and 2 + their bank-question mapping + prueba final. Ship it so Piero can start.
2. Missions 3 and 4.
3. Missions 5 and 6.
4. Optional: a mentor dashboard line showing missions done and first-try accuracy per mission.

Each slice is deployed on its own with the normal content_version bump.

## Left to the builder

- The exact step list per mission, as long as every mapped question's skill is taught before its prueba.
- Whether mission 3 extends `navegador` or uses a new map-based wind step.
- Animation details, celebration style, the receta card layout.
- The data schema details for missions/steps/hotspots, as long as content stays data, not code (SPEC design principle 6).
