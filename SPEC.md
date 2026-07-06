# DGAC Prep — Private Pilot Study Platform

Foundation spec. This document is the single source of truth for what to build. It captures every decision made during planning; when implementation questions arise, resolve them in the direction of the **Design Principles** below.

---

## 1. Purpose and users

A web app that runs an 8-week, PHAK-first study program for the DGAC (Peru) private pilot written knowledge exam, for a single student, with a progress dashboard for their mentor.

**Core philosophy — the app teaches the PHAK, the questions are the verification.** The curriculum is organized by PHAK (Pilot's Handbook of Aeronautical Knowledge, Spanish edition) chapters, not by question bank categories — and the teaching itself happens **in the app**: every assigned chapter ships as an authored lesson (§3.4, §5.8) with diagrams, interactive walkthroughs, comprehension checks, and cuaderno prompts. The book is the source the lessons are grounded in and the optional "para profundizar" reference, so studied time and understanding are trackable in-app. The 901-question official-style bank exists to verify that the teaching stuck, never as the syllabus. The DGAC's own balotario notice states questions are shuffled specifically to defeat memorization; the app's design must reinforce understanding over recall of question IDs.

**Two users, two surfaces:**
- **Student:** the study app. All student-facing content is in **Spanish**, except English that is itself under test (e.g., fraseología answer options).
- **Mentor:** a `/progreso` dashboard. May be in English. Read-only view of all activity; used to run a weekly Sunday check-in.

---

## 2. Design principles

1. **ADHD-first structure.** The target student profile includes ADHD tendencies. Every design choice reduces decisions, provides immediate feedback, makes progress visible, and keeps work in short timed blocks. The app supplies the executive function so his attention only has to do the actual work.
2. **Zero-decision session start.** One button ("Comenzar sesión") walks him through the day's blocks in order. He never chooses what to study; the plan chooses.
3. **Immediate feedback, per item.** Answer → submit → reveal correct answer with worked steps/explanation. Never batch feedback to the end of a set. (The explain-the-distractors step (§5.3) happens *before* reveal by design — it is retrieval practice, not delayed feedback.)
4. **Mastery gates, not calendar gates.** Content unlocks by demonstrated performance (defined in §6), not by date. The 8-week calendar is the pacing default, not the gate.
5. **Fresh problems defeat memorization.** Math problems are generated from parameterized templates with randomized values. Bank questions resurface with shuffled option order.
6. **Lean architecture.** One student. No accounts, no login UI, no frameworks beyond necessity. Static-first, offline-capable. But structure all content as **data, not code** (question banks, templates, curriculum as JSON) so a second student could be onboarded later without a rewrite.
7. **Honest measurement.** The app measures accuracy and activity; the mentor's live weekly spot-checks measure understanding. The app must never make it easy to fake progress (e.g., free-recall gate requires actual text entry; tier advancement uses unseen problems).

---

## 3. Content inputs

### 3.1 Question bank
- Source: `~/Workspace/flashcards/cards.json` (imported into repo at `data/bank.json`).
- **901 questions**, fields: `category`, `question`, `options` (array of 3), `answer` (index of correct option), `reason` (explanation; absent only on fraseología, where none is needed), `figures` (array of PNG filenames; present on 174 questions, 45 unique files, all present in the source `figures/` directory). **There is no per-question `pages` field** — chapter/page attribution comes from `chapters.json`'s category→chapter mapping and chapter page ranges, not from questions. Question IDs are embedded as `NNNN.-` prefixes in the question text; the import extracts them as stable `id`s.
- Categories and counts:

| Category | Count | Notes |
|---|---|---|
| FRASEOLOGIA AERONAUTICA | 246 | Spanish ATC phrase → choose correct English translation. No PHAK mapping. Daily drip track. |
| REGLAMENTACIÓN | 121 | RAP/DGAC rules. Not in PHAK. Question-based daily track. 1 with figure |
| PROCEDIMIENTOS Y OPERACIONES | 92 | 20 with figures |
| VUELO EN RUTA | 77 | 49 with figures — sectional chart reading |
| METEOROLOGÍA | 60 | Theory |
| INSTRUMENTOS DE VUELO | 59 | 18 with figures |
| PROCEDIMIENTOS DE COMUNICACIÓN | 51 | 11 with figures |
| PERFORMANCE | 47 | 36 with figures — the math core |
| AERODINÁMICA BÁSICA | 46 | 6 with figures |
| SISTEMAS DE AERONAVES | 46 | |
| SERVICIO METEOROLÓGICO | 41 | 22 with figures — METAR/TAF decoding |
| NAVEGACIÓN | 15 | 11 with figures |

- **Figures:** the referenced PNG images exist and will be placed at `data/figures/`. Render inline directly above the question text. Figures are **precache-mandatory offline assets** (§8): the service worker installs them with the app, so offline absence cannot silently bias selection away from the 186 figure questions. The skip-and-log rule covers only corrupt/missing-at-build assets — a figure question must never be shown without its image.
- **Exam format:** 3 options per question, one correct, order randomized at exam time. Mirror this: always shuffle option order on every presentation.

### 3.2 PHAK chapter map
- Questions carry no page references (§3.1), so attribution is authored top-down: `data/chapters.json` maps each chapter → page range in the Spanish PHAK extraction, and each bank category → its chapter(s) per the weekly spine (§4.1).
- **TODO (build task, mentor input pending):** the mentor supplies/corrects chapter page ranges and section boundaries. Once mapped, every non-fraseología, non-reglamentación question belongs to a chapter via its category, and the app can compute per-chapter coverage — including PHAK sections with **zero** questions, which are surfaced to the mentor as "the bank can't measure this; check it in teach-back." `chapters.json` also carries a **per-section key-point list** (the 5–8 concepts a good free recall should mention) — AI-drafted at build time from the PHAK text, mentor-reviewed before shipping. These ground the runtime recall feedback (§5.7).

### 3.3 Math problem templates
Generated, not stored. Six families, each a template with randomized parameters and three tiers. **The exam permits no calculator**, so every generated problem at every tier must be solvable with pencil-and-paper arithmetic — parameter generation rules must produce hand-workable numbers (this is a hard constraint on `math-templates.json` ranges, not a nice-to-have). The manual (mechanical) E6B is assumed to still be permitted since it is not a calculator — confirm (§10); Families 5–6 display a reminder: "resuelve primero mentalmente, luego verifica con el E6B."

| # | Family | Formula / rule |
|---|--------|----------------|
| 1 | Factor de carga | peso soportado = peso × factor G. 30°→1.2, 45°→1.5, 60°→2.0 |
| 2 | Ajustes de altímetro | 0.01" Hg ≈ 10 ft. Setting up → indication up |
| 3 | Base de nubes | AGL = (T − Td en °F) ÷ 4.4 × 1000; MSL variant adds field elevation |
| 4 | Altitud presión/densidad | PA = elevación + (29.92 − ajuste) × 1000; ISA = 15 − 2·(PA/1000) °C; DA = PA + 120 × (OAT − ISA) |
| 5 | Peso y balance | momento = peso × brazo; CG = Σmomento ÷ Σpeso; avgas = 6 lb/gal |
| 6 | Tiempo-velocidad-distancia-combustible | t = d ÷ GS; GS = TAS ± viento; combustible = t × consumo + reserva |

**Tier definitions:**
- **Nivel 1:** formula displayed on screen, clean/round numbers, single step.
- **Nivel 2:** exam-style Spanish wording, no formula shown, realistic numbers.
- **Nivel 3:** multi-step and/or figure-based (styled after the bank's Performance figure questions).

**Reveal content for generated problems:** the one-line worked calculation (e.g., "2,300 × 2.0 = 4,600 lb"), plus the formula on Nivel 2/3 reveals.

Parameter generation rules per tier live in `data/math-templates.json` (ranges, rounding, distractor logic if multiple-choice presentation is used; free-entry numeric answer with tolerance is also acceptable and preferred for math — accept within ±2% or exact for clean-number tiers). Each template also defines its rounding convention and expected units. The app offers no calculator affordances anywhere; the mental answer is committed before any E6B verification.

**Worked steps (`steps`):** each family additionally defines an ordered `steps` array — per step: a Spanish label ("Calcula el momento total actual"), the symbolic formula ("Momento = Peso × Brazo"), a compute expression over the generated parameters, and the unit. Because steps live on the template, **any** generated problem can render its complete worked solution with its own numbers. This powers resolución guiada (§5.2), `guided_math` lesson blocks (§3.4), and the redo-with-work-shown (§4.4). The one-line reveal above remains the reveal for scored attempts.

### 3.4 Lessons (in-app teaching content)
The teaching layer (§1 core philosophy): `data/lessons/chNN.json`, one per assigned chapter (2–17; chapter 1 is unassigned). Each lesson is an ordered list of **sections** (aligned with `chapters.json` sections) composed of typed blocks rendered by one generic player (§5.8):

- `text` — short paragraphs (≤ ~80 words per block — ADHD chunking), light markdown.
- `diagram` — hand-authored SVG (`data/lessons/diagrams/`), styled with the app's CSS variables, caption required.
- `figure` — reuses `data/figures/` images, bridging lessons to the bank questions that use them.
- `callout` — visually distinct box: `clave` (key point), `ojo` (common trap), `memoria` (mnemonic).
- `table` — comparison tables.
- `widget` — named interactive module from the registry (`src/js/widgets.js`, vanilla JS: `render(el, params, onEvent)`), used only where manipulation genuinely teaches (e.g., ángulo de ataque → sustentación slider, cuatro fuerzas, palanca → superficies de control, flaps, lectura de instrumentos). Widgets never carry scoring.
- `check` — **3–4 exam-difficulty questions per section** (mentor directive 2026-07-05: enough to truly test, with plausible distractors mirroring bank traps). Rendered on a **separate screen after the section's teaching** (§5.8) — never visible alongside the content that answers them, so answering requires remembering, not looking up. Instant right/wrong plus a one-line `why`. **Logged, never gating on correctness** (§6 gates stay deterministic; a wrong check never blocks advance — answering them all does advance).
- `notebook` — a cuaderno prompt card ("📓 En tu cuaderno: dibuja el fuselaje y etiqueta sus 4 partes") with a "Hecho ✓" button. The app decides *what* to write — the student's executive function never has to self-generate note-taking. Self-reported, logged, non-gating; the physical notebook is Sunday check-in audit material (§7). Guided math examples always end with one ("copia estos pasos en tu cuaderno como receta").
- `guided_math` — embeds a resolución-guiada worked example for a template family/tier (§5.2), followed by its práctica inmediata burst.

Each lesson may also carry a chapter-level `videos` list (`[{title, query}]`) — **optional YouTube supplements** (mentor directive 2026-07-05: the same material taught a slightly different way). Rendered as links in lesson **review mode only** (§5.8), never in the primary session flow (rabbit-hole containment, §2), built as YouTube search URLs from curated Spanish queries (search links can't go dead the way pinned video IDs can; the mentor may pin exact videos by editing the JSON). Online-only by nature; never gates anything.

**Authoring rules:** Spanish; AI-drafted at build time, grounded in the PHAK chapter structure, with every claim traceable to its chapter/pages (errors must be findable); **ships without pre-review** (mentor decision 2026-07-05) — fixes are prospective under `content_version` (§8). Authoring lessons also produces the per-section lists and key points `chapters.json` needs (§3.2, §10.2). Lessons are original teaching content, not reproduction of the book's text (§9). All 16 assigned chapters are authored up front, chapter 3 first as the template-setter, then spine order.

**Voice and depth (mentor directive 2026-07-05):** the lessons exist to make the PHAK **approachable to a teenager** — and they must be **extensive**, not thin summaries. Concretely:
- **Coverage:** every exam-testable concept in the chapter gets taught — depth comes from *many short sections*, never long ones (chunking rule above still binds). A chapter lesson is typically 6–12 sections.
- **Tone:** direct, warm, second-person Spanish ("tú"). Plain words first, the technical term immediately after, both kept in play ("el borde de ataque — la parte delantera del ala").
- **Analogies from his world:** cars, motos, bicycles, fútbol, video games, swimming — every abstract principle gets a concrete everyday anchor before the formal statement.
- **Why before what:** each section opens with the question it answers ("¿Por qué no se cae el avión?") so there's a reason to care before there's a definition to hold.
- **Exam relevance made explicit:** callouts flag what the DGAC bank actually asks about ("esto cae en el examen"), connecting effort to payoff.

---

## 4. Curriculum structure

### 4.1 Weekly spine (PHAK chapters)

| Week | Theme | PHAK chapters | Verification (bank categories) |
|---|---|---|---|
| 1 | El avión y por qué vuela | 3, 4, 5, 6 | Aerodinámica básica (46) |
| 2 | El panel y el motor | 7, 8 | Sistemas (46) + Instrumentos (59) |
| 3 | Los números del avión | 9, 10, 11 | Performance (47) — aligns with math ladder hitting Nivel 2 |
| 4 | El clima | 12, 13 | Meteorología (60) + Servicio meteorológico (41) |
| 5 | El entorno | 14, 15 | Procedimientos y operaciones (92); sectional chart track starts |
| 6 | Llegar a algún lado | 16 | Navegación (15) + Vuelo en ruta (77); first simulacro Saturday |
| 7 | El piloto | 17, 2 | Remaining questions; 2 simulacros; error deck assembly |
| 8 | Integración | none new | Error deck, weak families, oral scripts, final simulacro Thursday |

### 4.2 Three daily parallel tracks (every study day, regardless of week)
1. **Matemática (morning, first block):** current family/tier from the ladder. Two math blocks daily (day's family + weakest family).
2. **Reglamentación (afternoon):** 8–10 bank questions daily from the 121. Cycles through the full set ~3–4× over 8 weeks; selection is Leitner-weighted — weak items take priority over raw coverage. Question-based by design (RAP content isn't in PHAK).
3. **Fraseología (evening):** 20–30 rapid-fire cards daily from the 246. Dedicated rapid-fire mode (§5.4).

### 4.3 The chapter study loop
For each chapter assignment:
1. **Lección** — the app teaches the chapter itself (§5.8): a sectioned walkthrough with diagrams, widgets, comprehension checks, and cuaderno prompts. Each section may close with "Para profundizar: PHAK páginas X–Y" — the book is the optional deep-dive, not the assignment.
2. **Recuerdo libre (gate):** lesson and book closed, a text box, 5-minute timer: write everything remembered, own words. Minimum length threshold (e.g., 300 characters) to unlock the section's questions. Stored and visible to the mentor (§7) — he audits that these are genuine recall, not transcription. On submit, grounded AI feedback returns within seconds when online (§5.7); the unlock never waits for it.
3. **Preguntas** — that section's bank questions, immediate per-question feedback showing `reason` and the chapter's page range (`chapters.json`).
4. **Miss routing:** every miss triggers two *distinct* events, logged as separate result kinds: (a) a same-day **redo with work shown** in Sesión 2 (§4.4) — immediate correction; (b) a spaced **re-queue** of the question (shuffled options) on the next study day at least 2 days out (never Sunday) — a retention check. Each miss also creates a "volver a la sección" assignment — a tappable link into the relevant lesson section (§5.8), with the PHAK page range as secondary reference.

### 4.4 Daily session template (6 hours, 3 sessions, Mon–Sat)
The session runner walks these blocks in order with a visible timer (25 min work / 5 min break; breaks instruct leaving the room). Sesiones 1–2 (135 min) hold four 25/5 blocks plus slack; Sesión 3 (90 min) holds three. **Times are anchors, not limits (mentor directive 2026-07-05): the goal is covering the day's material, not covering it by a clock time.** Session start times are the external-cue schedule, and the 25/5 rhythm still paces the work, but nothing truncates: if he's still working at 6:00 pm, the app lets him keep going until the day's blocks are done. Running long is logged (planned vs. actual, visible on `/progreso`) — a pacing signal for the Sunday check-in, never a stop. Sunday is rest + mentor check-in only.

| Session | Blocks |
|---|---|
| **Sesión 1** 8:00–10:15 | math drill (day's family) · lección (§5.8) · free recall + section questions · second math (weakest family) · daily log auto-fills |
| **Sesión 2** 12:00–2:15 | remaining chapter questions + 10 spaced-review Qs · reglamentación block · vuelo de escritorio (written scenario) or chart reading (week ≥5) · redo of today's misses with work shown |
| **Sesión 3** 4:30–6:00 | fraseología rapid-fire · teach-back prompt (app shows the relevant lesson section as the concept; explain out loud to a human when one is available, otherwise record a 60–90 s audio explanation in the app — recordings are Sunday audit material on `/progreso`) · oral script review / tomorrow's read-ahead |

**Vuelo de escritorio:** one scenario per week (seed content exists in the v2 plan doc for weeks 1–7; store in `data/scenarios.json`). Student writes a ≤5-line answer in the app; visible to the mentor, with AI feedback on submit (§5.7).

### 4.5 Día mínimo (bad-day fallback)
The 6-hour template is the plan for a normal day, not the bar for a day to count. A **día mínimo** (~75 min) keeps the chain alive on a bad day: one math block (weakest family) · reglamentación block · fraseología rapid-fire — exactly the three tracks that gates never hold back (§6). It is never a morning choice — "Comenzar sesión" always starts the normal day, preserving the zero-decision start (§2). The mínimo is offered deterministically, only when no session has been started by a configured cutoff (default 15:00, in `config.json`): the start button becomes "Comenzar día mínimo". This keeps the fallback from becoming an avoidance on-ramp while still defeating the ADHD failure mode it exists for — the all-or-nothing spiral, where one missed day breaks the streak and the app becomes aversive. Honest measurement is preserved: every day is logged as **completo / mínimo / perdido**, streaks survive on a mínimo, and the dashboard shows the distinction (§7). Repeated mínimos are a Sunday check-in topic, not a hidden shame spiral.

### 4.6 Reanudación (multi-day disruption)
A mínimo handles a bad day; illness needs a different shape. After **3+ consecutive missed days**, the app enters reanudación: the next study day uses a defined light template — SRS catch-up capped at 20 questions, the three daily tracks, no new reading — and the remaining calendar shifts by the days missed (mastery gates make this safe by construction; the 8 weeks were pacing, not promises). Simulacro dates recompute from the shifted calendar; the dashboard flags the disruption, and the next check-in includes an exam-date reassessment.

---

## 5. App features

### 5.1 Session mode (primary surface)
- "Comenzar sesión de hoy" → sequential block runner. Current block full-screen, timer visible, next-up hidden until reached.
- **Plan de hoy (mentor directive 2026-07-05):** the home screen shows a collapsible read-only card listing today's sessions and blocks with live progress (✅ done · ▶️ current · ⬜ pending) and session start times — "here's what to do today," not "here's a long list." It is a *view*, not a chooser: the start button still walks the plan in order (zero-decision start, §2).
- **Mostrar plan (mentor directive 2026-07-05):** a "📅 Mostrar plan" home button opens the full 8-week hierarchy — weeks (theme, chapters with live ✅/📖/⬜ state, verification categories) → days of a week (high-level + special events: simulacros, vuelo de escritorio) → single-day detail (the session/block template). Future days show the day *template* with an explicit honesty note: fine details (weakest math family, due reviews, redos) are decided that morning from real progress; mastery gates outrank the calendar (§4.4). Read-only, same zero-decision rule.
- Skipping a block requires a reason (logged, shown to the mentor). No silent skips.
- Session/streak state survives refresh and offline periods (localStorage-first, §9).

### 5.2 Math ladder
- Per family × tier state machine. A tier attempt = 10 generated problems. **Advance at 9/10; never at 8.** Failed attempt → one same-day retry allowed after a break (fresh values); a second failure → same tier next day. ("Fix it now" is motivational fuel worth capturing; a forced overnight wait converts frustration into avoidance.)
- Tier N+1 is locked until N passed. Nivel preview (3 unscored problems one tier up) offered after a clean 10/10.
- **Resolución guiada (first exposure):** before the first scored attempt at any family/tier, the app runs a guided worked example from the template's `steps` (§3.3): steps revealed one at a time, and the student **types each intermediate value** ("Paso 1: Momento = Peso × Brazo → 1,200 × 40 = ___") with instant per-step right/wrong; a wrong step shows the correct value and continues. Unscored — teaching, not the ladder. The same guided rendering is used for the §4.4 same-day redo with work shown and for `guided_math` lesson blocks (§3.4). **Scored attempts stay answer-only** — the exam gives one line and no calculator; assessment matches exam conditions.
- **Práctica inmediata:** every guided example is immediately followed by 3–5 fresh-number problems with the *identical* solution path ("ahora tú: misma receta, números nuevos"). Unscored, instant feedback, with a "ver los pasos" fallback that re-renders the guided steps for *that* problem's numbers. Same-path repetition with fresh values is the muscle-memory mechanism — acquisition reps happen while the recipe is hot, before any scored attempt.
- **Mantenimiento (passed tiers never retire):** passed tiers enter a maintenance rotation at expanding intervals (1d, 3d, 7d, 14d — same rhythm as question SRS), always freshly generated, folded into the daily math blocks as a few extra problems. Never a gate; pure volume, so mastered families don't decay between passing and exam day.
- Tracker grid (6 families × 3 tiers) always visible on the home screen — the visible-progress ADHD anchor. Each family also shows its **lifetime rep count and current correct-streak** ("Peso y balance: 47 problemas · racha 12") — accumulated evidence of built muscle, the confidence anchor for a student weak in math.

### 5.3 Bank question player
- Shuffled options every time. Submit → instant reveal: correct answer highlighted, `reason` text, chapter/page reference (from `chapters.json`), figure (if any) shown above question.
- **Explain-the-distractors mode** (periodic, configurable ~every 5th concept question): before reveal, student must tag why each wrong option is wrong (free text, one line each). Not scored; stored for the mentor, with AI feedback on the explanations (§5.7).
- Spaced repetition at **concept level** (chapter/section), not question-ID level: a mastered section ("mastered" = chapter close-out criteria met, §6) resurfaces at expanding intervals (1d, 3d, 7d, 14d) using *different* questions from the same chapter where available. When unseen questions run out, reusing seen questions (shuffled options) is permitted. Sections with zero bank coverage are excluded from question-SRS and routed to the teach-back list (§3.2) — never scheduled with nothing to show.

### 5.4 Fraseología rapid-fire mode
- Card: Spanish ATC phrase → 3 English options, shuffled. Big touch targets, instant right/wrong flash, auto-advance. Streak counter and daily card count. Leitner-style boxes (wrong → box 1, right → promote) drive selection.
- **Always available from the home screen** (mentor directive 2026-07-05): a "Fraseología rápida" button runs a rapid-fire round on demand, any time, logged like the session block (it counts toward the fraseo streak). The evening session block remains scheduled; this is extra volume, never a substitute shown as such.

### 5.5 Simulacros (weeks 6–8, and on demand for the mentor)
- Full-length timed exam matching the **official exam blueprint: 50 questions, 90 minutes** (confirmed; in `config.json`) — a ~1.8 min/question pace, which the timer makes visible. Taken **without a calculator**, mirroring exam conditions. Per-category weighting is still unconfirmed (§10); until then, draw at the bank's category proportions. Options shuffled, no feedback until the end.
- Math questions inside simulacros use **generated variants** (fresh numbers), not stored bank text, wherever a template family applies — rendered as exam-format items: 3 options, template-defined distractors, wording styled after the bank's math questions. Fresh numbers, familiar shape.
- Results screen: total %, per-category %, per-chapter %; every miss auto-joins the error deck.
- Pass target displayed: **85%** (buffer over the official pass mark — confirm and set actual pass mark as config once confirmed with the flight school; `config.json`).

### 5.6 Error deck (mazo de errores)
- Auto-assembled: **simulacro misses join immediately** (a miss under exam conditions is strong evidence); daily-work items join on the **second** miss — any bank question missed twice, or math family/parameter-pattern missed twice. Entries carry their `reason`/worked steps.
- Week 7–8 sessions draw from it; an item leaves the deck after two consecutive correct answers on separate days.

### 5.7 AI feedback on free-text entries
The one feedback loop the static design can't close: free-text answers — free recall (§4.3), explain-the-distractors (§5.3), vuelo de escritorio (§4.4) — would otherwise sit unread until Sunday. On submit, a `POST /api/feedback` Function (§8) sends the entry plus its grounding material to the Claude API and returns short, structured Spanish feedback. For recall: "Cubriste: X, Y. Te faltó: Z — revisa páginas N–M."

Three rules keep this from breaking the design:
1. **AI never gates.** Every gate stays deterministic (submission + length, scores). Feedback is a supplement that arrives after the unlock; an API outage costs feedback, never study time.
2. **Offline-tolerant.** No connectivity → the entry queues, the gate opens anyway, feedback arrives on sync.
3. **Grounded, structured, no chat.** The model grades coverage against the mentor-reviewed key-point lists (§3.2) or scenario notes — it never generates free-form aviation teaching, and there is no conversational surface (a distraction rabbit hole for ADHD, and where real hallucination risk lives).

Side effect — an honesty check: gibberish, padding, or apparent transcription is flagged on `/progreso` **immediately** (the dashboard is live, not Sunday-only) rather than blocking the student. Feedback is stored as its own appended result row (`kind: 'feedback'`) referencing the entry's UUID — the log stays immutable (§8) — and is shown alongside its entry in the app and on the dashboard.

### 5.8 Lesson player (lecciones)
The teaching surface (§1, content model in §3.4). A full-screen player inside the session runner replaces the old reading block:

- **One section at a time**, progress dots across the top — small visible units, no wall-of-text, zero navigation decisions. Scrolling within a section is fine; jumping ahead is not offered during the first sequential pass.
- **Each section is two screens (mentor directive 2026-07-05):** first the teaching (text, diagrams, widgets, notebook prompts), then — content hidden — its checks ("sin mirar atrás"). A "volver a la explicación" escape is always available; returning re-asks the checks. This makes every check an act of recall, not of looking one paragraph up.
- **Completion is deterministic:** viewing every section (teaching + checks answered) completes the lesson and opens the free-recall gate (§4.3) exactly as before. Check correctness and notebook prompts never gate (§3.4).
- **Per-section telemetry:** section completion and time-on-section are logged (`kind: 'lesson_progress'`), check answers as `kind: 'lesson_check'`, notebook confirmations as `kind: 'notebook'` — all through the standard result log (§8), offline-queued like everything else.
- **Review mode:** any previously seen lesson/section is re-openable from the chapter list at any time (re-reading is never restricted); miss-routing "volver a la sección" links (§4.3) and teach-back prompts (§4.4) open the player directly to the target section.
- **Widgets** render inline from the registry; a widget failing to load degrades to its captioned static fallback image — a lesson must never be blocked by a widget bug.

### 5.9 Logros (gamification)
Badges and micro-celebrations, tuned for ADHD reward cadence (mentor directive 2026-07-05). Two layers:

- **Micro-celebrations (immediate, repeatable):** small in-flow flashes the moment they happen — 4 correct answers in a row inside any quiz block ("¡4 seguidas! 🔥"), a 10-streak in fraseología, a clean 10/10 drill. Purely visual, sub-second, never a modal that interrupts the next question.
- **Badges (one-time, collected):** a permanent shelf on the home screen. Earned badges are **derived from the result log** (pure replay, §8 — no new stored state; the "newly earned" moment is detected by comparing the derived set before/after an append). Catalog lives in `src/js/badges.js` as data + pure predicates. Starter set spans all tracks so early wins come fast: primera lección completada, primer capítulo cerrado, primer nivel de matemática superado, familia dominada (nivel 3), 4 familias en nivel 2, racha de 7 días, semana perfecta (6 completos), 100/500/1000 problemas de matemática resueltos, 25/100 apuntes de cuaderno, racha ×15 en fraseología, primer simulacro, simulacro ≥85%, mazo de errores vaciado.
- **Never a gate, never a shame surface:** badges only ever add; there is no "lost badge" state, and absence is silent. `/progreso` shows earned badges with dates (§7).

### 5.10 El hangar (optional enrichment)
For surplus time on days finished early (mentor directive 2026-07-05): a home-screen view (`data/hangar.json`, `src/js/hangar.js`) of **optional, fun, aviation-love-building activities** — Peru-specific flight-simulator flights with briefings tied to the week's material (coastal Lima→Pisco in week 1, the Cusco density-altitude challenge in week 3, Amazon weather-reading at Iquitos in week 4, the Pisco→Nazca navigation flight with the Nazca Lines overflight in week 6, a night flight in week 7, a self-planned "graduation flight" in week 8), paper/SkyVector route-planning exercises that use the math recipes for real, plus pointers to the lesson videos and PHAK deep-reading. Any simulator counts (MSFS, X-Plane, FlightGear, GeoFS). Activities unlock by program week so they accompany the material. **Never gates, never homework**: self-reported "La hice ✓" logs a `block/hangar` row (visible to the mentor), surfaced prominently on the día-completo screen. Repeats allowed and encouraged.

---

## 6. Gates (enforced by the app)

| Gate | Criterion | On failure |
|---|---|---|
| Math tier advance | 9/10, fresh problems | Repeat tier next day |
| Section questions unlock | Free-recall entry submitted (min length) | Blocked until done |
| Chapter close-out | Free recall for every section + ≥80% on chapter's questions | Miss-routing assignments; redo missed questions after 2 days |
| Enter Week 6 content | Nivel 2 passed in ≥4 of 6 families | Week 6 reading locked; the doubled math blocks occupy the freed reading/recall slots — same 6-hour envelope |
| "Listo para el examen" badge | ≥85% final simulacro + error deck empty **at the start of** that simulacro (misses from the final itself get reviewed but don't block the badge — the two-separate-days exit rule would otherwise make it unearnable) | Recommend one-week delay |

Calendar never overrides a gate; gates never hold back the daily tracks (fraseología/reglamentación/math always available).

---

## 7. Progress dashboard (`/progreso`, mentor only)

Behind Cloudflare Access (§8) — mentor-only policy, email OTP login. Shows:
- **Tracker grid** (families × tiers) computed from real results, with dates and scores.
- **Streaks** per daily track (math, reglamentación, fraseología) and overall study days. Broken track streaks flagged red — earliest warning signal.
- **Last sync** timestamp, shown prominently — a stale sync means the accountability loop is down (see §8 sync failure handling).
- **Last 7 days:** blocks completed vs. planned, per-day; each day marked completo / mínimo / perdido (§4.5); skipped blocks with reasons.
- **Chapter progress:** lesson completion/recalled/questioned/closed per chapter; per-chapter question %; list of PHAK sections with zero bank coverage (for teach-back targeting).
- **Lesson detail:** time per section, comprehension-check accuracy per section (where understanding breaks *during* teaching, before recall/questions confirm it), and notebook-prompt completion per chapter — the Sunday check-in audits the physical cuaderno against the logged prompts.
- **Math reps:** per-family lifetime rep volume, guided/práctica/maintenance breakdown, and maintenance-SRS adherence (§5.2).
- **Logros:** earned badges with dates (§5.9).
- **Free-recall entries** (full text, newest first) — Sunday audit material.
- **Vuelo de escritorio answers**, distractor-explanation entries, and teach-back audio recordings (§4.4).
- **Error deck contents** and simulacro history with per-category breakdowns.
- **Spot-check helper:** button that generates 3 fresh problems from the student's highest claimed tiers (for the live Sunday check), printable/screen-shareable, answers hidden behind a toggle.
- **Last seen + activity timeline (2026-07-06):** "Last seen: N min ago — <screen>" from the newest log row (near-live: the client flushes every 90 s), plus a chronological feed of the last 7 active days — rows clustered into sessions at 25 min of inactivity, entries rendered human-readable (lesson sections with minutes, collapsed check scores, quizzes, drills, recalls). Fed by `nav` rows (§8) plus the existing kinds; lesson sections *entered but never finished* are flagged. Pure helper `src/js/timeline.js` — dashboard-only, not precached in the student app.

Weekly Sunday check-in protocol (from the accountability guide) is embedded as a checklist on this page: registro/streaks → free-recall audit → live math spot-check → teach-back (mentor picks concept; the section list with coverage gaps helps) → 5-phrase fraseología lightning round → set next week → confirm the external start-time cues (phone alarms / calendar blocks) are still in place. The app deliberately sends no notifications (§9), so session *initiation* — the core ADHD deficit — relies on cues outside the app; keeping them alive is explicitly part of the weekly protocol. A missed Sunday is survivable — the app continues and audit material accumulates — but **two consecutive missed check-ins flag red** at the top of the dashboard.

---

## 8. Architecture

- **Hosting:** Cloudflare Pages (static SPA) + Pages Functions + **D1 (SQLite)** + **R2** (teach-back audio recordings only). Free tiers are far beyond one-student volume.
- **Frontend:** framework-light. Vanilla or a minimal reactive layer; no build complexity that isn't earning its keep. Mobile-friendly (the student may use a phone/tablet), touch-first for rapid-fire mode. Full-screen session mode to reduce tab-adjacent distraction; in-app session timer so leaving is visible.
- **Data flow:** localStorage holds the operational state for offline use, but the **D1 result log is the durable source of truth**: every piece of derived state — ladder position, Leitner boxes, SRS due dates, error deck, streaks — must be deterministically rebuildable from the result rows. localStorage is a cache with a "Restaurar progreso" recovery flow (rebuild from `GET /api/progress`), because mobile browsers can evict script-writable storage (iOS Safari does after 7 days of disuse) and a data-wipe is one tap away. Install as a home-screen PWA to blunt eviction and reinforce full-screen session mode. A sync layer pushes results to D1 when online and replays queued writes after connectivity gaps (Peru connectivity assumption: the app must be fully usable offline for an entire day, syncing later).
- **API (Pages Functions):**
  - `POST /api/result` — append result row(s) (idempotent via client-generated UUID). **Per-row validation (2026-07-06):** valid rows are inserted, invalid ones reported back as `rejected: [{id, error}]` — one bad row must never reject the batch (a whole-batch reject once bricked all syncing when the lesson kinds postdated the server's whitelist). The client marks accepted rows synced, parks rejected ones out of the queue (kept locally under `rumbo_rejected_v1` for diagnosis), and shows a persistent warning banner — never a silent 'ok'. The `kind` whitelist lives in `functions/api/_validate.mjs`, shared with the node test suite; every kind the client emits MUST be listed there.
  - `POST /api/audio` — upload a teach-back recording to R2; the returned key is stored in the corresponding result's `detail_json`.
  - `POST /api/feedback` — grade a free-text entry against its grounding material via the Claude API (Haiku-class model; API key lives in a Pages secret, server-side only). Returns structured feedback (§5.7), also stamped into the entry's result row.
  - `GET /api/log` — the raw result rows (student-accessible; powers "Restaurar progreso", since `/api/progress` is mentor-only).
  - `GET /api/progress` — everything the dashboard needs (aggregations done in SQL).
  - `GET /api/audio/<key>` — stream a stored recording for dashboard playback.
- **Auth: Cloudflare Access (Zero Trust free tier), individual-user email policies — no auth code or login UI in the app.** This is a security boundary, not user management: the study data, free-recall text, and audio are personal, and the write endpoint must not accept junk from the open internet. Two separate Access **applications** (not merely two policies — overlapping paths must not rely on implicit precedence): (1) app + `/api/*` — student's and mentor's emails; (2) `/progreso*` + `/api/progress` — mentor only, defined as its own more-specific application. Defense in depth: the progress Function additionally verifies the authenticated email is the mentor's before responding. Email OTP login; **session duration set to the maximum (1 month)**. Unauthenticated requests are blocked at the edge and never reach the Functions. Functions read `Cf-Access-Authenticated-User-Email` (optionally verifying `Cf-Access-Jwt-Assertion`) and stamp it on result rows for auditability. **Only rows stamped with `STUDENT_EMAIL` count as progress**: `GET /api/log` and `GET /api/progress` filter to the student's rows, so the mentor can log in and use the student app without polluting streaks, ladder, or dashboard.
- **Offline contract (service worker):** precache the app shell, all `data/*.json`, and **all figures** at install; versioned cache keyed to the content version; update-on-reload when online. The app shows an "offline-ready" indicator once precache completes. Cold start with zero network must work fully. Teach-back audio records via MediaRecorder into **IndexedDB** (not localStorage), 90-second cap, uploads through the same sync queue, deleted locally only after confirmed upload.
- **Navigation trace (2026-07-06):** `kind: 'nav'` rows record screen/section enters and leaves (`detail: {screen, section?, chapter?, action: 'enter'|'leave'}`) — home render, per-block, per-lesson-section, plus `visibilitychange`/`pagehide` leaves. Consecutive identical enters within 60 s are deduped. `nav` is deliberately **inert in derive()**: it never counts as study activity, so streaks/gates can't be gamed by merely opening the app; it exists only to feed the mentor timeline (§7).
- **Event-sourced state:** result rows are immutable and append-only; every scheduling rule (Leitner moves, SRS due dates, 2-day re-queues, error-deck entry/exit, streaks, gates) is a pure deterministic function of the log — rebuild = replay. Rows are facts about what was presented and are **never re-scored under corrected content**; content fixes apply prospectively, and `config.json`'s `content_version` is stamped into each row's `detail_json`.
- **Device policy:** single active device; "Restaurar progreso" is the explicit device-switch action (rebuild from `GET /api/log`). If two devices do sync offline logs anyway, the merge is a union of rows and replay stays deterministic — unsupported but lossless.
- **Sync must fail loudly, never silently.** An expired Access session answers a background `fetch` with a login redirect, not JSON. The sync layer treats any non-JSON/redirect response as "session expired": it keeps the offline queue fully intact and shows a persistent "Inicia sesión para sincronizar" banner; tapping it performs a full-page navigation so the Access login flow can complete (a background `fetch` cannot). The dashboard's last-sync timestamp (§7) is the mentor-side alarm for the same condition.
- **D1 schema (single core table + views):**

```sql
CREATE TABLE results (
  id TEXT PRIMARY KEY,            -- client UUID (idempotency)
  ts INTEGER NOT NULL,            -- unix ms
  user_email TEXT,                -- stamped server-side from Cf-Access-Authenticated-User-Email (audit)
  kind TEXT NOT NULL,             -- drill | quiz | redo | simulacro | recall | scenario | block | rapidfire | distractor_explain | feedback | lesson_progress | lesson_check | notebook | nav
  family TEXT,                    -- math family (drills)
  tier INTEGER,                   -- 1..3 (drills)
  chapter TEXT,                   -- PHAK chapter (quiz/recall)
  category TEXT,                  -- bank category (quiz/rapidfire)
  score INTEGER, total INTEGER,   -- scored kinds
  duration_sec INTEGER,
  detail_json TEXT                -- per-item detail: question ids/params, misses, free text
);
```

  Error deck, streaks, tracker, and spaced-repetition due dates are **derived** (in SQL or client-side), never separately stored — on either side. localStorage holds only a replayable cache of the same log.
- **Repo layout suggestion:**

```
/data            bank.json, figures/, math-templates.json, chapters.json, scenarios.json, config.json, lessons/ (chNN.json + diagrams/)
/src             app (session runner, players, lesson player, widgets, ladder, SRS, sync, audio)
/functions/api   result.ts, log.ts, progress.ts, audio.ts, audio/[key].ts, feedback.ts
/progreso        dashboard
/scripts         import-bank.mjs (re-import after content corrections)
/icons           PWA icons
index.html, sw.js, manifest.webmanifest, schema.sql, wrangler.toml
SPEC.md          this file · README.md — dev/deploy steps
```

---

## 9. Non-goals (v1)

- No in-app accounts, auth code, or multi-tenant anything. Authentication is delegated entirely to Cloudflare Access (email allowlist configured in the Cloudflare dashboard, enforced at the edge — §8).
- No content authoring UI — content is edited as JSON in the repo.
- No ungrounded or gating AI. Runtime AI is limited to `POST /api/feedback` on free-text entries (§5.7): it never gates progress and only grades against mentor-reviewed grounding content. All teaching content — lessons, question/math reveals — ships as static data in the repo (AI-drafted at build time, §3.4), never generated at runtime; no chat surface.
- No notifications/email; accountability is the Sunday check-in plus the dashboard. Session initiation relies on external cues (phone alarms / calendar blocks), kept alive as part of the weekly protocol (§7).
- No PHAK text reproduction in-app. Lessons (§3.4, §5.8) are original authored teaching content organized by PHAK chapters — summaries, walkthroughs, and diagrams in our own words — not hosting of the book's text. The book stays the optional deep-dive reference.

Structure everything so these can be added later — this app doubles as a validation prototype for a bilingual study-guide generator product, so keep the bank/template/curriculum formats generic.

---

## 10. Open items / config to confirm

1. **Official exam blueprint** — confirmed: **50 questions, 90 minutes, no calculator permitted** (in `config.json`). Still open: pass mark, per-category weighting, and whether the manual (mechanical) E6B counts as a calculator (§3.3 assumes it does not). Target display stays 85% regardless.
2. **`chapters.json`** — **critical path, week-0 deliverable**: the chapter loop (§4.3), recall-feedback grounding, and coverage math all block on it. Boundaries inferred from page clustering, mentor corrects; per-section key-point lists AI-drafted at build time, mentor-reviewed (§3.2). Lesson authoring (§3.4) produces the section lists and key points as a by-product. The three daily tracks are buildable and usable before it exists.
3. **Figure PNGs** — the mentor supplies the image set matching the `figures` filenames.
4. **RAP source excerpts** — optional later enrichment for reglamentación reveals where `reason` is missing.
5. **Some bank entries lack `reason`** — AI-draft explanations at build time, grounded in the referenced PHAK pages; the mentor reviews before they ship in `bank.json`. Until backfilled, reveal falls back to correct-answer-plus-pages; flag remaining gaps in a report.
