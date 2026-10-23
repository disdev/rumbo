// Datos de «La carta, paso a paso» (spec 2026-10-22): cada tarjeta apunta a algo
// que existe, se califica contra su propia respuesta, cabe en 40 palabras, y
// todas las preguntas de VUELO EN RUTA las enseña exactamente un capítulo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradeCard, cardWords } from '../src/js/clase-logic.js';
import { expectedValue } from '../src/js/misiones-logic.js';
import { SIMBOLOS } from '../src/js/leyenda.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const { chapters } = load('data/clase-carta.json');
const chart = load('data/misiones/carta-costa-central.json');
const bank = load('data/bank.json');
const misiones = load('data/misiones.json');
const KINDS = new Set(['mira', 'tap', 'choice', 'number', 'place', 'drag']);

const chartIds = new Set([
  ...chart.airports.map(a => a.id), ...chart.obstacles.map(o => o.id), ...chart.checkpoints.map(c => c.id),
  ...(chart.cautions || []).map(c => c.id), ...chart.airspace.map(a => a.id), 'legend',
  ...chart.mef.filter(m => m.ft).map(m => `mef:${m.lat_n}:${m.lon_w}`),
]);
/** Ids tocables de la superficie de una tarjeta. */
function surfaceIds(card) {
  if (card.surface === 'carta') return chartIds;
  if (card.surface?.simbolo) return new Set(Object.keys(SIMBOLOS[card.surface.simbolo]?.parts || {}));
  return new Set((card.surface?.hotspots || []).map(h => h.id));
}
const cards = chapters.flatMap(ch => ch.cards.map(card => ({ ch, card })));

test('clase: ids únicos, tipos válidos y prompts de ≤ 40 palabras', () => {
  const ids = new Set();
  for (const ch of chapters) {
    assert.ok(!ids.has(ch.id), ch.id); ids.add(ch.id);
    for (const card of ch.cards) {
      assert.ok(!ids.has(card.id), card.id); ids.add(card.id);
      assert.ok(card.id.startsWith(`${ch.id}-`), card.id);
      assert.ok(KINDS.has(card.kind), `${card.id}: ${card.kind}`);
      assert.ok(card.title && card.prompt, card.id);
      assert.ok(cardWords(card) <= 40, `${card.id}: ${cardWords(card)} palabras`);
      if (card.kind === 'mira') assert.ok('truco' in card, `${card.id}: «mira» declara su truco (o null)`);
      if (card.truco) assert.ok(card.truco.icon && card.truco.text, card.id);
    }
  }
});

test('clase: superficies y objetivos existen', () => {
  for (const { card } of cards) {
    if (card.surface?.simbolo) assert.ok(SIMBOLOS[card.surface.simbolo], `${card.id}: símbolo ${card.surface.simbolo}`);
    if (card.surface?.figure) assert.ok(readFileSync(new URL(`../data/figures/${card.surface.figure}`, import.meta.url)).length, card.id);
    const ids = surfaceIds(card);
    for (const id of [...(card.targets || []), ...(card.pulse || []), ...(card.focus ? [card.focus] : [])]) {
      assert.ok(ids.has(id), `${card.id}: «${id}» no existe en su superficie`);
    }
    if (card.route) assert.ok(chart.routes.some(r => r.id === card.route), card.id);
  }
});

test('clase: cada tarjeta con respuesta se califica bien contra sí misma', () => {
  for (const { card } of cards) {
    switch (card.kind) {
      case 'tap': assert.ok(card.targets.length && gradeCard(card, { feature: card.targets[0] }, chart).correct, card.id); break;
      case 'choice': assert.ok(card.answer >= 0 && card.answer < card.options.length && gradeCard(card, { option: card.answer }, chart).correct, card.id); break;
      case 'number': assert.ok(gradeCard(card, { value: expectedValue(card, chart) }, chart).correct, card.id); assert.ok(['ft', 'nm', 'deg'].includes(card.unit), card.id); break;
      case 'place': assert.ok(gradeCard(card, card.target, chart).correct && card.start, card.id); break;
      case 'drag': {
        const parts = surfaceIds(card);
        assert.ok(card.labels.length >= 2, card.id);
        for (const l of card.labels) {
          assert.ok(parts.has(card.slots[l.id]), `${card.id}: ${l.id} → ${card.slots[l.id]}`);
          assert.ok(gradeCard(card, { label: l.id, part: card.slots[l.id] }).correct, card.id);
        }
        break;
      }
      default:
    }
    if (card.kind !== 'mira') assert.ok(card.hint && card.explain_ok, `${card.id}: hint y explain_ok`);
  }
});

test('clase: VUELO EN RUTA completo — cada pregunta en exactamente un capítulo', () => {
  const seen = new Map();
  const byId = new Map(bank.map(q => [q.id, q]));
  for (const ch of chapters) {
    for (const qid of ch.teaches) {
      assert.ok(byId.has(qid), `${ch.id}: ${qid} no está en el banco`);
      assert.ok(!seen.has(qid), `${qid} en ${seen.get(qid)} y ${ch.id}`);
      seen.set(qid, ch.id);
    }
    if (ch.live) assert.ok(ch.teaches.length >= 3, `${ch.id}: prueba de al menos 3`);
  }
  const missing = bank.filter(q => q.category === 'VUELO EN RUTA' && !seen.has(q.id)).map(q => q.id);
  assert.deepEqual(missing, []);
});

test('clase: los 7 capítulos, en orden; los vivos con tarjetas y misión para practicar', () => {
  assert.deepEqual(chapters.map(c => c.n), [1, 2, 3, 4, 5, 6, 7]);
  for (const ch of chapters.filter(c => c.live)) {
    assert.ok(ch.cards.length >= 8, ch.id);
    assert.ok(misiones.missions.some(m => m.id === ch.practice_mission), ch.id);
  }
});

test('clase: la Misión 1 no se rompe (sus objetivos siguen en la carta)', () => {
  for (const s of misiones.missions[0].steps.filter(s => s.surface === 'carta')) {
    for (const id of s.targets || []) assert.ok(chartIds.has(id), `${s.id}: ${id}`);
  }
});
