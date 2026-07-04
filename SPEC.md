# DGAC Prep — Piero's Private Pilot Study Platform

Foundation spec. This document is the single source of truth for what to build. It captures every decision made during planning; when implementation questions arise, resolve them in the direction of the **Design Principles** below.

---

## 1. Purpose and users

A web app that runs an 8-week, PHAK-first study program for the DGAC (Peru) private pilot written knowledge exam, for a single student (Piero), with a progress dashboard for his mentor (Dustin).

**Core philosophy — the book is the plan, the questions are the verification.** The curriculum is organized by PHAK (Pilot's Handbook of Aeronautical Knowledge, Spanish edition) chapters, not by question bank categories. The 901-question official-style bank exists to verify that reading stuck, never as the syllabus. The DGAC's own balotario notice states questions are shuffled specifically to defeat memorization; the app's design must reinforce understanding over recall of question IDs.

**Two users, two surfaces:**
- **Piero (student):** the study app. All student-facing content is in **Spanish**.
- **Dustin (mentor):** a `/progreso` dashboard. May be in English. Read-only view of all activity; used to run a weekly Sunday check-in.

---

## 2. Design principles

1. **ADHD-first structure.** Piero has ADHD tendencies. Every design choice reduces decisions, provides immediate feedback, makes progress visible, and keeps work in short timed blocks. The app supplies the executive function so his attention only has to do the actual work.
2. **Zero-decision session start.** One button ("Comenzar sesión") walks him through the day's blocks in order. He never chooses what to study; the plan chooses.
3. **Immediate feedback, per item.** Answer → submit → reveal correct answer with worked steps/explanation. Never batch feedback to the end of a set.
4. **Mastery gates, not calendar gates.** Content unlocks by demonstrated performance (defined in §7), not by date. The 8-week calendar is the pacing default, not the gate.
5. **Fresh problems defeat memorization.** Math problems are generated from parameterized templates with randomized values. Bank questions resurface with shuffled option order.
6. **Lean architecture.** One student. No accounts, no login UI, no frameworks beyond necessity. Static-first, offline-capable. But structure all content as **data, not code** (question banks, templates, curriculum as JSON) so a second student could be onboarded later without a rewrite.
7. **Honest measurement.** The app measures accuracy and activity; Dustin's live weekly spot-checks measure understanding. The app must never make it easy to fake progress (e.g., free-recall gate requires actual text entry; tier advancement uses unseen problems).

---

## 3. Content inputs

### 3.1 Question bank
- Source: `cards.json` (already exists; import into repo at `data/bank.json`).
- **901 questions**, fields: `category`, `question`, `options` (array of 3), `answer` (index of correct option), `reason` (explanation; present on most but not all), `pages` (array of PHAK page refs in Dustin's Spanish extraction), `figures` (array of PNG filenames; present on 186 questions).
- Categories and counts:

| Category | Count | Notes |
|---|---|---|
| FRASEOLOGIA AERONAUTICA | 246 | Spanish ATC phrase → choose correct English translation. No PHAK mapping. Daily drip track. |
| REGLAMENTACIÓN | 121 | RAP/DGAC rules. Not in PHAK. Question-based daily track. |
| PROCEDIMIENTOS Y OPERACIONES | 92 | 26 with figures |
| VUELO EN RUTA | 77 | 49 with figures — sectional chart reading |
| METEOROLOGÍA | 60 | Theory |
| INSTRUMENTOS DE VUELO | 59 | 20 with figures |
| PROCEDIMIENTOS DE COMUNICACIÓN | 51 | 12 with figures |
| PERFORMANCE | 47 | 36 with figures — the math core |
| AERODINÁMICA BÁSICA | 46 | 7 with figures |
| SISTEMAS DE AERONAVES | 46 | |
| SERVICIO METEOROLÓGICO | 41 | 22 with figures — METAR/TAF decoding |
| NAVEGACIÓN | 15 | 11 with figures |

- **Figures:** the referenced PNG images exist and will be placed at `data/figures/`. Render inline directly above the question text. Figure questions must never be shown if the image fails to load — skip and log instead.
- **Exam format:** 3 options per question, one correct, order randomized at exam time. Mirror this: always shuffle option order on every presentation.

### 3.2 PHAK chapter map
- Each bank question's `pages` array references Dustin's Spanish PHAK extraction pagination.
- **TODO (build task, Dustin input pending):** a `data/chapters.json` mapping chapter → page range. Initial version may be inferred by clustering the `pages` values per category (categories map roughly to chapters); Dustin corrects boundaries. Once mapped, every non-fraseología, non-reglamentación question belongs to a chapter, and the app can compute per-chapter coverage — including PHAK sections with **zero** questions, which are surfaced to Dustin as "the bank can't measure this; check it in teach-back."

### 3.3 Math problem templates
Generated, not stored. Six families, each a template with randomized parameters and three tiers. E6B **is permitted** on the exam; Families 5–6 display a reminder: "resuelve primero mentalmente, luego verifica con el E6B."

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

Parameter generation rules per tier live in `data/math-templates.json` (ranges, rounding, distractor logic if multiple-choice presentation is used; free-entry numeric answer with tolerance is also acceptable and preferred for math — accept within ±2% or exact for clean-number tiers).

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
2. **Reglamentación (afternoon):** 10–15 bank questions daily from the 121. Cycles through the full set ~3× over 8 weeks. Question-based by design (RAP content isn't in PHAK).
3. **Fraseología (evening):** 20–30 rapid-fire cards daily from the 246. Dedicated rapid-fire mode (§5.4).

### 4.3 The chapter study loop
For each PHAK reading assignment:
1. **Leer** — app displays the assigned page range (reading happens in the physical/PDF book; app just assigns and confirms).
2. **Recuerdo libre (gate):** book closed, a text box, 5-minute timer: write everything remembered, own words. Minimum length threshold (e.g., 300 characters) to unlock the section's questions. Stored and visible to Dustin (§8) — he audits that these are genuine recall, not transcription.
3. **Preguntas** — that section's bank questions, immediate per-question feedback showing `reason` and `pages`.
4. **Miss routing:** every miss creates a "volver a las páginas X–Y" assignment and re-queues the question (with shuffled options) 2 days later.

### 4.4 Daily session template (6 hours, 3 sessions, Mon–Sat)
The session runner walks these blocks in order with a visible timer (25 min work / 5 min break; breaks instruct leaving the room). Hard stop messaging at 6:00 pm; Sunday is rest + Dustin check-in only.

| Session | Blocks |
|---|---|
| **Sesión 1** 8:00–10:15 | math drill (day's family) · PHAK reading · free recall + section questions · second math (weakest family) · daily log auto-fills |
| **Sesión 2** 12:00–2:15 | remaining chapter questions + 10 spaced-review Qs · reglamentación block · vuelo de escritorio (written scenario) or chart reading (week ≥5) · redo of today's misses with work shown |
| **Sesión 3** 4:30–6:00 | fraseología rapid-fire · teach-back prompt (app shows the concept; the explaining happens out loud to a human — app just confirms done) · oral script review / tomorrow's read-ahead |

**Vuelo de escritorio:** one scenario per week (seed content exists in the v2 plan doc for weeks 1–7; store in `data/scenarios.json`). Student writes a ≤5-line answer in the app; visible to Dustin.

---

## 5. App features

### 5.1 Session mode (primary surface)
- "Comenzar sesión de hoy" → sequential block runner. Current block full-screen, timer visible, next-up hidden until reached.
- Skipping a block requires a reason (logged, shown to Dustin). No silent skips.
- Session/streak state survives refresh and offline periods (localStorage-first, §9).

### 5.2 Math ladder
- Per family × tier state machine. A tier attempt = 10 generated problems. **Advance at 9/10; never at 8.** Failed attempt → same tier next day with fresh values.
- Tier N+1 is locked until N passed. Nivel preview (3 unscored problems one tier up) offered after a clean 10/10.
- Tracker grid (6 families × 3 tiers) always visible on the home screen — the visible-progress ADHD anchor.

### 5.3 Bank question player
- Shuffled options every time. Submit → instant reveal: correct answer highlighted, `reason` text, `pages` reference, figure (if any) shown above question.
- **Explain-the-distractors mode** (periodic, configurable ~every 5th concept question): before reveal, student must tag why each wrong option is wrong (free text, one line each). Not scored; stored for Dustin.
- Spaced repetition at **concept level** (chapter/section), not question-ID level: a mastered section resurfaces at expanding intervals (1d, 3d, 7d, 14d) using *different* questions from the same page range where available.

### 5.4 Fraseología rapid-fire mode
- Card: Spanish ATC phrase → 3 English options, shuffled. Big touch targets, instant right/wrong flash, auto-advance. Streak counter and daily card count. Leitner-style boxes (wrong → box 1, right → promote) drive selection.

### 5.5 Simulacros (weeks 6–8, and on demand for Dustin)
- Full-length timed exam drawn at the **bank's category proportions**, options shuffled, no feedback until the end.
- Math questions inside simulacros use **generated variants** (fresh numbers), not stored bank text, wherever a template family applies.
- Results screen: total %, per-category %, per-chapter %; every miss auto-joins the error deck.
- Pass target displayed: **85%** (buffer over the official pass mark — confirm and set actual pass mark as config once Piero gets it from the flight school; `config.json`).

### 5.6 Error deck (mazo de errores)
- Auto-assembled: any bank question missed twice, or math family/parameter-pattern missed twice, enters the deck with its `reason`/worked steps.
- Week 7–8 sessions draw from it; an item leaves the deck after two consecutive correct answers on separate days.

---

## 6. Gates (enforced by the app)

| Gate | Criterion | On failure |
|---|---|---|
| Math tier advance | 9/10, fresh problems | Repeat tier next day |
| Section questions unlock | Free-recall entry submitted (min length) | Blocked until done |
| Chapter close-out | Free recall for every section + ≥80% on chapter's questions | Miss-routing assignments; redo missed questions after 2 days |
| Enter Week 6 content | Nivel 2 passed in ≥4 of 6 families | Week 6 reading locked; math blocks double |
| "Listo para el examen" badge | ≥85% final simulacro + error deck empty | Recommend one-week delay |

Calendar never overrides a gate; gates never hold back the daily tracks (fraseología/reglamentación/math always available).

---

## 7. Progress dashboard (`/progreso`, Dustin only)

Access via shared secret (query param or entered once, stored). Shows:
- **Tracker grid** (families × tiers) computed from real results, with dates and scores.
- **Streaks** per daily track (math, reglamentación, fraseología) and overall study days. Broken track streaks flagged red — earliest warning signal.
- **Last 7 days:** blocks completed vs. planned, per-day; skipped blocks with reasons.
- **Chapter progress:** read/recalled/questioned/closed per chapter; per-chapter question %; list of PHAK sections with zero bank coverage (for teach-back targeting).
- **Free-recall entries** (full text, newest first) — Sunday audit material.
- **Vuelo de escritorio answers** and distractor-explanation entries.
- **Error deck contents** and simulacro history with per-category breakdowns.
- **Spot-check helper:** button that generates 3 fresh problems from the student's highest claimed tiers (for the live Sunday check), printable/screen-shareable, answers hidden behind a toggle.

Weekly Sunday check-in protocol (from the accountability guide) is embedded as a checklist on this page: registro/streaks → free-recall audit → live math spot-check → teach-back (Dustin picks concept; the section list with coverage gaps helps) → 5-phrase fraseología lightning round → set next week.

---

## 8. Architecture

- **Hosting:** Cloudflare Pages (static SPA) + Pages Functions + **D1 (SQLite)**. Free tier is far beyond one-student volume.
- **Frontend:** framework-light. Vanilla or a minimal reactive layer; no build complexity that isn't earning its keep. Mobile-friendly (Piero may use a phone/tablet), touch-first for rapid-fire mode. Full-screen session mode to reduce tab-adjacent distraction; in-app session timer so leaving is visible.
- **Data flow:** **localStorage is the source of truth** for in-progress state; a sync layer pushes results to D1 when online and replays queued writes after connectivity gaps (Peru connectivity assumption: the app must be fully usable offline for an entire day, syncing later).
- **API (Pages Functions):**
  - `POST /api/result` — append a result row (idempotent via client-generated UUID).
  - `GET /api/progress` — everything the dashboard needs (aggregations done in SQL).
  - Shared-secret header check on both. No accounts, no PII beyond scores and free-text study entries.
- **D1 schema (single core table + views):**

```sql
CREATE TABLE results (
  id TEXT PRIMARY KEY,            -- client UUID (idempotency)
  ts INTEGER NOT NULL,            -- unix ms
  kind TEXT NOT NULL,             -- drill | quiz | simulacro | recall | scenario | block | rapidfire | distractor_explain
  family TEXT,                    -- math family (drills)
  tier INTEGER,                   -- 1..3 (drills)
  chapter TEXT,                   -- PHAK chapter (quiz/recall)
  category TEXT,                  -- bank category (quiz/rapidfire)
  score INTEGER, total INTEGER,   -- scored kinds
  duration_sec INTEGER,
  detail_json TEXT                -- per-item detail: question ids/params, misses, free text
);
```

  Error deck, streaks, tracker, and spaced-repetition due dates are **derived** (in SQL or client-side), not separately stored server-side; localStorage keeps the operational SRS state.
- **Repo layout suggestion:**

```
/data            bank.json, figures/, math-templates.json, chapters.json, scenarios.json, config.json
/src             app (session runner, players, ladder, SRS, sync)
/functions/api   result.ts, progress.ts
/progreso        dashboard
SPEC.md          this file
```

---

## 9. Non-goals (v1)

- No user accounts, auth flows, or multi-tenant anything. One shared secret for the dashboard.
- No content authoring UI — content is edited as JSON in the repo.
- No AI/API calls at runtime; all reveal content ships in the data files.
- No notifications/email; accountability is the Sunday check-in plus the dashboard.
- No PHAK text hosting in-app (reading happens in the book/PDF; the app assigns and gates).

Structure everything so these can be added later — this app doubles as a validation prototype for a bilingual study-guide generator product, so keep the bank/template/curriculum formats generic.

---

## 10. Open items / config to confirm

1. **Official pass mark** — Piero confirming with flight school; store in `config.json` (target display stays 85% regardless).
2. **`chapters.json` boundaries** — infer from page clustering, Dustin corrects.
3. **Figure PNGs** — Dustin supplies the image set matching the `figures` filenames.
4. **RAP source excerpts** — optional later enrichment for reglamentación reveals where `reason` is missing.
5. **Some bank entries lack `reason`** — reveal falls back to correct-answer-plus-pages; flag these in a report so explanations can be backfilled over time.
