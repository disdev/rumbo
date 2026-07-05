# Lecciones — In-App Teaching Design

**Date:** 2026-07-05
**Status:** Approved by mentor (Dustin), pending implementation plan
**Amends:** SPEC.md §1, §3, §4.3, §4.4, §5, §7, §8, §9

## Problem

The app currently verifies learning (recall gates, bank questions) but does not teach — SPEC §4.3's "Leer" step assigns book pages and the actual instruction happens off-app in the PHAK PDF/physical book. That leaves the teaching phase untracked and unstructured, which is exactly where an ADHD learner needs the most scaffolding. The mentor wants walkthroughs and summarization to happen *in* the app so progress through the material itself can be tracked and tested.

## Decisions made (with mentor, 2026-07-05)

1. **App is the primary teacher.** The "Leer" block becomes an in-app lesson (Lección). The PHAK book becomes an optional "para profundizar" reference; lessons cite its page ranges. Free recall and bank questions still gate exactly as before.
2. **All 16 assigned PHAK chapters authored up front** (chapters 2–17 per the weekly spine), before Piero advances through them. Chapter 3 (Estructura de la aeronave) is authored first and sets the template.
3. **Mixed visuals:** labeled static SVG diagrams as the baseline; interactive widgets only where manipulation genuinely teaches (angle-of-attack slider, four-forces balance, stick→control-surface response, flaps, instrument dials).
4. **Embedded comprehension checks:** 1–2 quick tap-answer checks per section, instant feedback, **logged but never gating** — gates stay deterministic per SPEC §5.7/§6.
5. **Ship without pre-review.** Lessons are authored (AI-drafted, Spanish, grounded in PHAK chapter structure) and shipped; errors are fixed as found. Every claim stays traceable to a chapter/page so errors are findable.
6. **Architecture: structured JSON + widget registry.** One generic lesson player renders any chapter from `data/lessons/chNN.json`; widgets are named JS modules; diagrams are standalone SVG files.
7. **Cuaderno (notebook) prompts:** lessons explicitly direct written work into his physical notebook; the app decides *what* to write (ADHD: remove self-generation burden). Self-reported "Hecho ✓", logged, non-gating; notebook is Sunday audit material.
8. **Resolución guiada (step-by-step math):** math templates gain per-family `steps` definitions so any generated problem can render its worked solution step by step, with the student typing each intermediate value. Used for first exposure, lesson examples, and post-miss redos. Scored ladder attempts stay answer-only (exam conditions).
9. **Repetición de recetas:** immediate 3–5 problem practice burst after every guided example (same path, fresh numbers); passed tiers enter a maintenance SRS rotation (1d/3d/7d/14d) so mastered families never decay; per-family lifetime rep counter + streak shown on the tracker grid.

## Design

### Lesson player (new SPEC §5.8; §4.3 step 1 becomes "Lección")

- Full-screen player in the session runner, replacing the reading block. One section on screen at a time, progress dots, "Continuar" to advance. No wall-of-text; no navigation decisions.
- Section completion and time-on-section logged. Lesson completion triggers the existing free-recall gate unchanged (book/app content closed, 5-min timer, min length).
- Each section may end with "Para profundizar: PHAK páginas X–Y" (from `chapters.json` when pages are populated).
- Miss routing's "volver a las páginas X–Y" becomes "volver a la sección N de la lección" — a tappable link into the lesson player (book pages shown as secondary reference).
- Teach-back prompts (§4.4 Sesión 3) link to the relevant lesson section as the concept display.
- Re-reading is always allowed (review mode from the chapter list); only the first sequential pass is the session block.

### Content model

`data/lessons/chNN.json`, one per assigned chapter:

```json
{
  "chapter": "3",
  "title": "Estructura de la aeronave",
  "sections": [
    {
      "id": "3-1",
      "title": "El fuselaje",
      "phak_pages": null,
      "blocks": [
        { "type": "text", "md": "..." },
        { "type": "diagram", "src": "ch03-fuselaje.svg", "caption": "..." },
        { "type": "callout", "style": "clave|ojo|memoria", "md": "..." },
        { "type": "figure", "src": "Figure 21.jpg", "caption": "..." },
        { "type": "table", "headers": [], "rows": [] },
        { "type": "widget", "name": "angulo-ataque", "params": {} },
        { "type": "check", "id": "3-1-c1", "q": "...", "options": ["..."], "answer": 0, "why": "..." },
        { "type": "notebook", "id": "3-1-n1", "prompt": "Dibuja el fuselaje y etiqueta sus 4 partes." },
        { "type": "guided_math", "family": "peso_balance", "tier": 1 }
      ]
    }
  ]
}
```

Block types:
- `text` — short paragraphs; light markdown (bold, lists). Keep each text block under ~80 words (ADHD chunking).
- `diagram` — hand-authored SVG from `data/lessons/diagrams/`, styled with the app's CSS variables; caption required.
- `figure` — reuses existing `data/figures/` images (bridges lessons to the bank questions that use them).
- `callout` — visually distinct box: `clave` (key point), `ojo` (warning/common trap), `memoria` (mnemonic).
- `table` — comparison tables.
- `widget` — named interactive module from the registry, optional params.
- `check` — 1–2 per section, tap-answer, instant right/wrong + one-line `why`. Logged, never gating.
- `notebook` — cuaderno prompt card with "Hecho ✓" button. Logged, non-gating.
- `guided_math` — embeds a resolución-guiada worked example for a template family (see below), followed by its práctica inmediata burst.

Authoring conventions: Spanish; every section's content traceable to its PHAK chapter; sections align with `chapters.json` `sections` (authoring lessons populates those section lists and key_points as a by-product — unblocks SPEC §10.2 recall grounding).

**Voice and depth (mentor directive, 2026-07-05):** lessons must be **extensive** — full coverage of every exam-testable concept in the chapter, achieved through many short sections (6–12 per chapter), never long ones. The goal is making the PHAK approachable to a teenager: warm second-person Spanish, plain word before technical term, everyday analogies (cars, motos, fútbol, video games) before formal statements, each section opening with the question it answers, and explicit "esto cae en el examen" callouts connecting effort to payoff.

### Widget registry

`src/js/widgets.js` — vanilla JS modules keyed by name: `render(el, params, onEvent)`. Initial candidates (built only where they earn it):
- `angulo-ataque` — slider: AoA vs lift curve, stall region
- `cuatro-fuerzas` — lift/weight/thrust/drag balance
- `superficies-control` — move stick/pedals → surfaces deflect → aircraft responds
- `flaps` — flap setting → wing shape/lift/drag
- `instrumento` — readable dial (altimeter/ASI) practice

Widget interactions may log lightweight events into the section's `lesson_progress` detail, but widgets carry no scoring.

### Resolución guiada (step-by-step math)

Each family in `data/math-templates.json` gains:

```json
"steps": [
  { "label": "Calcula el momento total actual", "formula": "Momento = Peso × Brazo",
    "compute": "w0 * arm0", "unit": "lb-in" },
  { "label": "Suma el peso añadido", "formula": "...", "compute": "...", "unit": "..." }
]
```

- `compute` expressions are evaluated against the generated problem's parameters, so **any** generated problem can render its own worked solution with its actual numbers.
- Guided mode: steps revealed one at a time; the student **types each intermediate value** (same ±2%/exact tolerance rules as answers), instant per-step right/wrong; a wrong step shows the correct value and continues. Unscored.
- Used in: (a) first exposure to any family/tier before the first scored attempt; (b) `guided_math` lesson blocks (e.g., Peso y balance in chapter 10); (c) the §4.4 same-day redo with work shown, which now renders as guided steps.
- Scored tier attempts remain answer-only — the exam gives one line and no calculator; assessment matches exam conditions.
- Guided examples end with a notebook prompt: "copia estos pasos en tu cuaderno como receta."

### Repetición de recetas

- **Práctica inmediata:** after every guided example, 3–5 fresh-number problems with the identical solution path. Unscored, instant feedback, "ver los pasos" fallback re-renders guided steps for that problem's numbers.
- **Maintenance SRS:** passed tiers resurface at expanding intervals (1d, 3d, 7d, 14d), fresh numbers, folded into the daily math blocks (a few problems, not a full attempt). Never a gate; pure volume.
- **Visible reps:** tracker grid shows per-family lifetime solved count and current streak (e.g., "47 problemas · racha 12") — accumulated-evidence confidence anchor.

### Tracking

New result kinds through the existing immutable log (`POST /api/result`, localStorage-first, offline queue):
- `lesson_progress` — chapter, section id, seconds, widget events in `detail_json`
- `lesson_check` — check id, chosen option, correct/wrong
- `notebook` — prompt id, "hecho" timestamp
- Guided/práctica math logs as `drill` rows flagged `mode: "guiada" | "practica" | "maintenance"` in `detail_json` (scored attempts unchanged)

`/progreso` additions: per-chapter lesson completion % and time-per-section; check accuracy per section (where understanding breaks *during* teaching); notebook prompt completion per chapter (audit against the physical notebook on Sundays); per-family rep volume.

### Offline

Lessons JSON, diagrams SVG, and widgets are static assets — added to the service-worker precache manifest; cache version bump. Fully offline-capable like everything else.

### SPEC.md deltas (applied with this design)

- §1 core philosophy: "the book is the plan" → the app teaches (PHAK-structured lessons); PHAK is the source and reference; questions remain the verification.
- §3.4 (new): Lessons content input — format, authoring rules, ship-without-review policy.
- §3.3: `steps` arrays required per family.
- §4.3: step 1 "Leer" → "Lección"; miss routing points to lesson sections.
- §4.4: session table wording; teach-back links to lesson sections.
- §5.2: guided mode, práctica inmediata, maintenance SRS, rep counters.
- §5.8 (new): Lesson player.
- §7: dashboard additions.
- §8: new result kinds; repo layout adds `data/lessons/`, `src/js/widgets.js`.
- §9: non-goal "No PHAK text hosting" clarified — still no hosting of the book's text; lessons are original authored teaching content, not PHAK reproduction. Runtime-AI rules unchanged (AI still never teaches at runtime; lessons are static authored content).

### Content plan

Author order: ch 3 (template-setter) → 4, 5, 6 (week 1) → remaining chapters in spine order (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 2). All 16 before Piero reaches them; all up front per decision 2. Chapter 1 is unassigned (week null) — no lesson.

### Risks / trade-offs accepted

- Largest content build in the app; ch 3–6 must land before his week-1 reading blocks are next used.
- No pre-review: a wrong number could be studied before it's caught. Mitigation: traceability to PHAK pages, mentor spot-checks via /progreso, prospective content fixes (§8 content_version).
- Widget scope creep: registry keeps widgets optional per lesson; static diagrams are always an acceptable fallback.
