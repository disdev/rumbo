# La carta, paso a paso — guided chart-reading class (design)

Date: 2026-10-22 · Status: approved in conversation with the mentor (final) · Lives in: Rumbo student app, el taller (SPEC §5.11)

## Why

Piero did badly on **Misión 1 «Leer el mapa»** (`data/misiones.json`, `m1`). The missions are deliberately low on text: they assume he can already recognise the symbols and then make him *use* them. He can't recognise them yet, because nobody has walked him through the legend in a way he can see and touch. The chapter 15/16 lessons are mostly text.

The mentor wants the material **covered first in a visual, tactile way**: **every Vuelo en ruta concept and every map-legend key**, with examples and memory devices (mnemonics) so it sticks. The class teaches, and the missions then test what it taught.

Same time pressure as the missions spec (`2026-10-22-vuelo-en-ruta-misiones-design.md`): the mentor wants major progress by about **2026-11-05**, so the class has to be useful within days. That's why it is delivered in slices (see "Delivery order").

## What success looks like

- When Piero retakes Misión 1 after chapters 1–3, he gets far more steps right on the first try (from `mission_step.first_try_correct`, compared before and after).
- When he's given any symbol on Figure 20–26, he can say what it is. The measurable version is his first-attempt accuracy on each chapter's `teaches` bank questions, before vs after. The cut point is the chapter's first prueba (same method as the missions), and the prueba itself produces the after-attempts.
- He can recite the mnemonics. «Mis trucos» is the page he reviews before the exam.

## Goals

- Cover **all** Vuelo en ruta concepts and **every sectional-legend symbol the exam figures use**, in 7 chapters (below).
- **Direction A: guided class** (chosen by the mentor from three mockups, over a "sticker album" and a "build your chart" option). A big chart sits on the left. Each card zooms the chart onto one thing, explains it in a sentence, gives a mnemonic, and has him touch or drag on the chart to check.
- Every concept that can carry a **memory device** gets one: an acrostic, a letter match, a rhyme, a visual analogy or a rule of thumb. All of them are collected in **«Mis trucos»**.
- Every card is visual first: **≤ 40 words** of text and **≤ ~60 s**. The text-only screens of the lessons are what failed.
- Full mentor tracking, at the same level as the missions (see "Tracking").

## Non-goals

- Replacing the missions or the chapter 15/16 lessons. Chapters link *to* them.
- Gating. Like everything else in the taller (§5.11), the class is never a gate, never homework and never in the day plan. He moves through it in order, but every chapter stays open.
- **VOR receiver/CDI interpretation (Figure 28-type questions)** *(my call)*. That's an instrument skill in the NAVEGACIÓN category, not chart reading. Chapter 4 does cover the *chart* side of VORs: the symbols, the compass rose, reading a radial, and fixing a position from two radials (q3552/q3559-type).
- Phone polish. Laptop first, as with the missions.

## Anti-goals (failure even if it "works")

- A card that's mostly text, or a mnemonic that's longer than the fact it helps remember.
- A wrong touch that only says "Incorrecto". The feedback must say what he *did* touch.
- A mnemonic or fact that's wrong, or that conflicts with how the exam figures actually draw a symbol. Every fact traces back to PHAK ch. 15–16, the FAA sectional legend conventions used in Figures 20–26, or the bank's own `reason` text.
- Chart art that looks like placeholder boxes. The bar is the same as for the missions: it should look like a real chart someone cared about.

## Where it lives

A new top section in the taller, **«📘 La carta, paso a paso»**, placed **above** «🛩️ Vuelo en ruta — misiones». It shows a 7-chapter progress line with the next chapter highlighted, plus «Continuar» to resume the card he left off on. *(Name and placement are my guesses; the mentor didn't object.)*

Each chapter ends with a **«Practícalo»** link to the mission that exercises it (ch. 1–3 → Misión 1; ch. 6 → Misión 2/3/5; ch. 5 → Misión 4). Missions 3–6 are still «próximamente», so the link to those shows as disabled with their name. The Misión 1 card in the taller gets a small hint, «¿Te costó? Repasa los capítulos 1–3», pointing back at the class.

## Chapters (approved outline)

The order is chosen so each chapter builds on the one before. The bullet lists are the minimum content; the builder can split or reorder cards within a chapter.

1. **La hoja**: what a sectional is and why it's drawn this way; the graticule (latitude lines, longitude lines, the minute ticks); Peru is S/W and the exam figures are N/W; reading a position latitude first, then longitude; 1′ of latitude = 1 NM (and longitude is **not**); how the exam says "área 3"; the scale.
2. **Aeropuertos**: blue (tower) vs magenta (no tower); the symbol shapes (hard-surfaced 1 500–8 069 ft = circle with the runways drawn inside; over 8 069 ft = runway outline, no circle; not hard-surfaced = empty circle); ★ on top of the symbol = rotating beacon; fuel ticks; private (R) and other airport types shown in Figures 20–26; the **data box line by line**: name and identifier, CT frequency (★ after it = part-time tower), ATIS, Ⓒ CTAF, UNICOM, elevation, L / \*L lighting, runway length in hundreds of ft; part-time towers.
3. **Altura, obstáculos y puntos**: terrain tint bands and the legend; the MEF (big blue number = highest terrain or obstacle in the quadrangle **plus a 100–300 ft buffer, rounded up to the next 100 ft**; never describe it as just "the highest point"; on a route, use the highest MEF the route crosses); obstacles: single, group, lighted, MSL in bold vs AGL in parentheses; clearance arithmetic (+500 ft, or +1 000 ft over congested areas, using whatever figure the question states); caution boxes; visual checkpoint flags (moved here from ch. 4 so slice 1 covers everything Misión 1 tests: m1-8/m1-9, q3632, q3636).
4. **Radioayudas**: VOR, VORTAC and VOR-DME symbols and how to tell them apart; the compass rose (oriented to magnetic north); reading a radial; Victor airways; fixing a position from two radials.
5. **Espacio aéreo**: A/B/C/D/E/G as a **side view**; B solid blue, C solid magenta, D dashed blue, surface E dashed magenta; Class E floor shading (magenta fade = 700 ft AGL, blue fade = 1 200 ft AGL); `40/SFC`-style labels; Class C core/shelf/outer area and Class D dimensions (as the bank asks them); part-time towers; satellite airports; Special VFR; entry requirements by class (license, radio, transponder, contact); special-use areas P / R / W / A / MOA and who is responsible for avoiding collisions in each.
6. **Navegar**: true course from the chart (estimate by hand); variation: isogonic line, E subtract / W add (true → magnetic); deviation; wind: the wind triangle (Figure 68: which leg is which), WCA, true/magnetic heading, groundspeed, finding wind from heading/track/TAS/GS; distance–time–speed; fuel; time zones (Figure 27). Every concept gets its own visual teaching card here; links to the recetas (`rumbo`) and Misión 2/3/5 are extra practice, **not** a substitute (a pointer card doesn't count toward coverage).
7. **Ensayo en la Figura 20**: a short closing run of the chapter skills on Figure 20 (plus 21–26, and 59 / 69 / 75 for the one thing each of those questions asks about), using the existing exam-figure overlay.

**Coverage rule** *(my call)*: every one of the 77 VUELO EN RUTA questions, plus the NAVEGACIÓN questions that are read off a sectional (q3643, q3552, q3559, q3553, q3560, q3539, q3533's chart half), has to be taught by at least one card. Record this as data: a `teaches: [questionIds]` list per chapter. A test checks that every VUELO EN RUTA id appears in some chapter. If a question can't be covered, it gets flagged, not silently dropped.

## Card kinds (approved from the mockup)

Each chapter mixes these:

| Kind | What he does | Feedback |
|---|---|---|
| **Mira + Truco** | The chart zooms onto the symbol and it pulses. One sentence of meaning, then the mnemonic card. He taps «Siguiente». | The mnemonic is added to «Mis trucos». |
| **Toca** | "Toca el … que …" on the chart. | Right: a short confirmation. Wrong: **what he touched actually is** (e.g. "Ese es azul: Lima sí tiene torre"). After two misses it highlights the answer and explains. |
| **Arrastra** | Drag labels onto the parts of a multi-part symbol (data box, obstacle numbers, airspace label) or onto symbols. | Each correct drop snaps in place; a wrong drop bounces back with a one-line hint. |
| **Corte lateral** | Airspace side view: drag the plane horizontally and vertically. | A live readout of which class he's in, plus what he needs to enter it. Some cards ask "move the plane to where you don't need to call anyone". |
| **Figura** | Same skill on the exam figure (the `figura-overlay.js` hotspots). Toca/Arrastra variants. | Same as Toca. |
| **Mis trucos** | Not a card: a screen listing every unlocked mnemonic, grouped by chapter, printable (`@media print`). Reachable from the class menu at any time. | — |

**Prueba del capítulo** (mentor, 2026-10-22): every chapter ends with a short prueba of **3–5 real bank questions** drawn from its `teaches` list, choosing unseen and previously missed questions first. It runs through the existing `quizPlayer` with source `ids`, exactly as the mission pruebas do, so it logs ordinary `quiz` rows and misses flow into the error deck and SRS. A chapter counts as finished when its prueba is done, whatever the score. The prueba is never a gate. If a chapter teaches fewer than 3 questions, the prueba uses all of them.

Numeric answers (for example clearance altitude) can use a typed-number card like the missions' `number` step. Enter submits.

### Mnemonics

These are the starter set, written in Spanish in Piero's register (casual, short). The builder writes the rest, one per concept where a device actually helps, and checks every one against the fact:

- 🔵 **A**zul = **A**lguien te contesta (torre) · 🟣 **M**agenta = **M**udo (tú te anuncias)
- 📌 **P**aréntesis = **P**iso (AGL); the bold number counts from the sea (MSL)
- 🌐 **LONG**itud: líneas **largas**, de polo a polo · latitude lines lie down like the rungs of a ladder · "primero subes la escalera (latitud), luego caminas (longitud)"
- 📏 "Un minuto (de latitud), una milla"
- 🧭 De verdadero a magnético: Es**te** → **res**ta · Oeste → suma (the card must say the direction; it reverses going magnetic → true)
- ⛰️ Campo +500 · ciudad +1 000 (for the bank's "clear the obstacle by" questions; the card says the 1 000 ft is above the highest obstacle within 2 000 ft, and that the real 500 ft rule over sparse areas is from people and structures)
- ✂️ Clase **D** = línea **D**iscontinua (azul cortada) · Clase **C** = **C**írculo **C**ompleto magenta
- 📐 `40/12` se lee como fracción: **techo** arriba, **piso** abajo, en cientos de pies
- 🛰️ VOR-DME = el VOR **dentro de una caja** · VORTAC = el VOR **con tres orejas**
- 🌅 Hacia el Este el sol sale antes: **hacia el Este, la hora sube**

## The chart

Reuse the living chart (`src/js/carta.js`) and the Peru training chart (`data/misiones/carta-costa-central.json`) so the class and the missions look the same.

The chart currently has 4 airports, one Class C, 4 obstacles, 2 checkpoints and 1 caution box, which isn't enough to teach the whole legend. **Extend the chart data with invented, plausible features** *(my call)*, keeping the "no usar para navegación" label and noting in the chart's `note` which features are invented: a VOR-DME (and/or VORTAC) with its compass rose, a Victor airway, a Class D around a towered field, surface Class E and both E-floor shadings, a restricted area, a MOA (and an alert area if it fits), a private strip (R), an obstacle group, and more terrain bands so the tint legend has something to point at. Existing mission step answers must not change. **Any new airfield is fictional** (named and noted as invented), and every class-only feature carries a flag (e.g. `clase_only: true`) so mission views hide it. Otherwise a second towered field would break m1-1 «Toca el aeropuerto que tiene torre». Mission 1 and 2 coordinates, course, distance and MEF values stay as they are; run their tests.

`carta.js` needs a way to **zoom/pan to a feature and pulse it**. It already has `focusBox`, feature ids and tap handling, so the class adds a highlight. It also needs a **side-view (corte lateral) renderer** that the Corte lateral cards can drive. If a symbol only makes sense drawn larger than chart scale (e.g. the data box), a card can show a **close-up illustration** next to the chart instead.

Visual bar, layout and dark mode follow the missions spec: chart left / card right at ≥ 1024 px, stacked when narrower, and the chart keeps its paper look in dark mode.

## Content as data

Cards are data, not code (SPEC design principle 6). Suggested file: `data/clase-carta.json` with chapters → cards. Each card has a `kind`, its text, the feature it focuses on, its targets and feedback, and an optional `truco`. Each chapter also has `teaches` and `practice_mission`. Validate with a script or test like the existing lesson/mission tests.

## Tracking (same level as the missions)

The mentor wants to see everything:

- **Screens**: `nav` enter/leave rows with `screen: 'clase'` and `detail: {chapter, card, view}` (view = menu / card / trucos). These give when he opened each card and how long he stayed.
- **Every answer**, including wrong ones, on Toca / Arrastra / number / Figura cards: a new attempt row carrying `{chapter, card, try, answer, correct, ms_to_answer}`.
- **Card finished**: `{chapter, card, tries, first_try_correct, revealed, seconds}`.
- **Prueba**: ordinary `quiz` rows (see «Prueba del capítulo»).
- **Chapter finished or abandoned**: `{chapter, completed, seconds, cards_done}`.
- The builder chooses between new kinds (e.g. `clase_attempt`, `clase_card`, `clase_progress`) and reusing the `mission_*` kinds with a distinguishing field. Either way:
  - every new kind goes into `KINDS` in `functions/api/_validate.mjs`, with a test;
  - `derive.js` ignores these kinds for study state;
  - progress and resume are derived from the log, never stored separately.
- **`/progreso`**: a "Chart class" section next to "Vuelo en ruta missions", with a chapters × cards grid (time, tries, first try right or wrong, revealed). Tapping a card shows every answer. Each chapter shows its prueba score and before→after first-attempt accuracy on its `teaches` questions (cut = the chapter's first prueba). Timeline labels follow the pattern "📘 Clase · cap. 2 «Aeropuertos» · tarjeta 4 · 2 intentos · 40 s".

## Offline and release

New JS and data go into the SW precache. Follow the README content workflow: bump `content_version`, then run `node scripts/sync-sw-version.mjs`. Add a short **SPEC §5.11.2** describing the class.

## Delivery order

1. **Slice 1 (aim: 2–3 days):** chapters **1–3**, the map keys Misión 1 tests, plus the class shell, «Mis trucos», tracking and the `/progreso` section. Ship it so Piero can redo Misión 1 afterwards.
2. **Slice 2:** chapters 4–5, with the chart extensions for VOR/airspace and the corte lateral.
3. **Slice 3:** chapters 6–7.

Each slice deploys on its own with the normal content_version bump.

## Left to the builder

- The exact cards per chapter, as long as the chapter's bullet list and its `teaches` questions are covered, and the 40-word / 60-second budget holds.
- The remaining mnemonics (fact-checked).
- Positions and names of the invented chart features.
- The data schema, the tracking kind names, the animation details and the «Mis trucos» print layout.
