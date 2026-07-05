# Lesson Authoring Guide (SPEC §3.4)

One file per assigned chapter: `data/lessons/chNN.json` (two digits: ch02…ch17). Diagrams: `data/lessons/diagrams/*.svg`. Validate with `node scripts/validate-lessons.mjs [file]`.

## Schema

```json
{
  "chapter": "3",
  "title": "Estructura de la aeronave",
  "resumen": "Qué es cada parte del avión y qué hace — el mapa del aparato completo.",
  "sections": [
    {
      "id": "3-1",
      "title": "El fuselaje: el cuerpo del avión",
      "key_points": ["5–8 conceptos que un buen recuerdo libre debería mencionar"],
      "blocks": []
    }
  ]
}
```

Section `id` = `<chapter>-<n>`, 1-based, sequential. 6–12 sections per chapter. `key_points` feed the AI recall feedback (SPEC §3.2) — write them as short claim sentences in Spanish.

## Block types

| type | shape | rules |
|---|---|---|
| `text` | `{type, md}` | ≤ 90 words. Markdown: `**bold**`, `*italic*`, `- ` lists only. |
| `diagram` | `{type, src, caption}` | `src` is a filename in `data/lessons/diagrams/`. Caption required. |
| `callout` | `{type, style, md}` | `style`: `clave` (key point) · `ojo` (trap/warning) · `memoria` (mnemonic) · `examen` ("esto cae en el examen" — say what the bank asks). |
| `table` | `{type, headers, rows}` | ≤ 4 columns, ≤ 8 rows. |
| `widget` | `{type, name, params?, caption}` | `name` ∈ registry (below). Caption describes what to try. |
| `check` | `{type, id, q, options, answer, why}` | `id` = `<section>-c<n>`. Exactly 3 options, `answer` = correct index, `why` = one-line explanation. 1–2 per section, at the END of the section. |
| `notebook` | `{type, id, prompt}` | `id` = `<section>-n<n>`. Concrete instruction: WHAT to draw/write/copy — never "toma apuntes". |
| `guided_math` | `{type, family, tier}` | family ∈ carga·altimetro·nubes·altitudes·peso_balance·tvd, tier 1–3. Only in the chapters mapped below. |

Every section: ≥1 `check` and ≥1 `notebook` (max 3 notebooks). Order within a section: teach (text/diagram/callout/widget/table) → notebook → check(s).

## Widget registry (`src/js/widgets.js`)

- `angulo-ataque` — slider AoA 0–20°: lift curve + stall. (ch4/ch5)
- `cuatro-fuerzas` — drag the throttle/attitude, see lift·weight·thrust·drag balance. (ch4)
- `superficies-control` — move stick/pedals → surfaces deflect → axis rotation. (ch6)
- `flaps` — flap lever 0–30° → wing profile, lift & drag arrows. (ch3/ch5)
- `instrumento` — readable altimeter/ASI dial with adjustable value. (ch8)

Use a widget only where listed; elsewhere use diagrams.

## Guided math mapping

ch5→`carga`(1) · ch8→`altimetro`(1) · ch10→`peso_balance`(1 y 2) · ch11→`altitudes`(1) · ch12→`nubes`(1) · ch16→`tvd`(1). Place near the section teaching that concept.

## Voice and depth (SPEC §3.4 — binding)

Extensive coverage of every exam-testable concept — depth via MANY SHORT sections. Warm second-person Spanish ("tú"). Plain word first, technical term immediately after, keep both. Analogies from a Peruvian teen's world (carros, motos, bici, fútbol, videojuegos, la playa) BEFORE the formal statement. Each section opens with the question it answers ("¿Por qué…?"). `examen` callouts connect to what the DGAC bank actually asks — read `data/bank.json`, filter by the chapter's categories, and target real question topics. No English except terms under test. Numbers/limits must be PHAK-correct — every claim traceable.

## SVG diagram conventions

Inline-injected (page CSS variables apply). viewBox required (e.g. `0 0 400 260`), no width/height attrs, no external refs, no `<script>`. Use ONLY these colors: stroke/text `var(--text)`, accents `var(--accent)`, good/lift `var(--ok)`, bad/drag/warning `var(--bad)`, secondary `var(--muted)`, fills `var(--panel-2)`. Text: `font-family="inherit"`, `font-size` 12–16. Label in Spanish with short words + leader lines. Keep files < 8 KB, hand-drawn simple shapes over realism.
