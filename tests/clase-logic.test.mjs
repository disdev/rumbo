// La carta, paso a paso (spec 2026-10-22): progreso, reporte y trucos derivados del log.
import test from 'node:test';
import assert from 'node:assert/strict';
import { claseProgress, claseReport, gradeCard, unlockedTrucos, cardWords } from '../src/js/clase-logic.js';

const chapters = [
  { id: 'c1', title: 'La hoja', teaches: ['q1'], cards: [
    { id: 'c1-1', kind: 'mira', title: 'Mira', prompt: 'Mira esto', truco: { icon: '📌', text: 'Paréntesis = Piso' } },
    { id: 'c1-2', kind: 'tap', title: 'Toca', prompt: 'Toca', targets: ['SPJC'] },
    { id: 'c1-3', kind: 'drag', title: 'Arrastra', prompt: 'Arrastra', labels: [{ id: 'elev', text: 'Elevación' }], slots: { elev: 'p-elev' } },
  ] },
  { id: 'c2', title: 'Aeropuertos', teaches: [], cards: [
    { id: 'c2-1', kind: 'choice', title: 'Elige', prompt: 'Elige', options: ['a', 'b'], answer: 1 },
  ] },
];

let ts = 1000;
const row = (kind, detail) => ({ id: `r${ts}`, ts: ts++, kind, detail });
const card = (c, k, extra = {}) => row('clase_card', { clase: c, card: k, tries: 0, first_try_correct: null, revealed: false, seconds: 5, ...extra });
const attempt = (c, k, correct) => row('clase_attempt', { clase: c, card: k, answer: { feature: 'X' }, correct });

test('claseProgress: sin filas empieza en la primera tarjeta', () => {
  const p = claseProgress([], chapters);
  assert.equal(p.c1.started, false);
  assert.equal(p.c1.next, 'c1-1');
});

test('claseProgress: sigue donde quedó, luego prueba, luego completo', () => {
  const rows = [card('c1', 'c1-1'), card('c1', 'c1-2')];
  assert.equal(claseProgress(rows, chapters).c1.next, 'c1-3');
  rows.push(card('c1', 'c1-3'));
  assert.equal(claseProgress(rows, chapters).c1.next, 'prueba');
  rows.push(row('clase_progress', { clase: 'c1', completed: true, seconds: 60, cards_done: 3 }));
  const p = claseProgress(rows, chapters).c1;
  assert.equal(p.completed, true);
  assert.equal(p.next, null);
});

test('claseReport: una tarjeta «mira» sin respuestas no es ✗ ni atasco', () => {
  const rows = [card('c1', 'c1-1'), attempt('c1', 'c1-2', false), attempt('c1', 'c1-2', true), card('c1', 'c1-2', { tries: 2 })];
  const r = claseReport(rows, chapters);
  const [mira, tap] = r.units[0].items;
  assert.equal(mira.status, 'done');
  assert.equal(mira.first_try_correct, null);
  assert.equal(tap.tries, 2);
  assert.equal(tap.first_try_correct, false);
  assert.ok(!r.stuck.some(s => s.item === 'c1-1'));
  assert.ok(r.stuck.some(s => s.item === 'c1-2'));
});

test('claseReport: precisión antes → después con la primera prueba del capítulo como corte', () => {
  const rows = [
    row('quiz', { items: [{ qid: 'q1', correct: false }] }),
    { ...row('quiz', { clase: 'c1', items: [{ qid: 'q1', correct: true }] }), score: 1, total: 1 },
  ];
  const r = claseReport(rows, chapters).units[0];
  assert.deepEqual(r.accuracy.before, { n: 1, ok: 0 });
  assert.deepEqual(r.accuracy.after, { n: 1, ok: 1 });
  assert.deepEqual(r.prueba, { score: 1, total: 1 });
});

test('gradeCard: arrastrar a la parte correcta', () => {
  const c = chapters[0].cards[2];
  assert.equal(gradeCard(c, { label: 'elev', part: 'p-elev' }).correct, true);
  assert.equal(gradeCard(c, { label: 'elev', part: 'p-largo' }).correct, false);
});

test('gradeCard: delega tap y choice en la calificación de misiones', () => {
  assert.equal(gradeCard(chapters[0].cards[1], { feature: 'SPJC' }).correct, true);
  assert.equal(gradeCard(chapters[1].cards[0], { option: 0 }).correct, false);
});

test('unlockedTrucos: uno por tarjeta con truco terminada, aunque la repita', () => {
  const rows = [card('c1', 'c1-1'), card('c1', 'c1-1'), card('c1', 'c1-2')];
  const t = unlockedTrucos(rows, chapters);
  assert.equal(t.length, 1);
  assert.equal(t[0].card.id, 'c1-1');
  assert.equal(t[0].truco.text, 'Paréntesis = Piso');
});

test('cardWords cuenta palabras del prompt', () => {
  assert.equal(cardWords({ prompt: 'Toca el aeropuerto  sin torre.' }), 5);
});

test('claseReport: tarjeta de arrastrar — manda su propia fila (varias soltadas no son «intentos»)', () => {
  const drop = (part, correct) => row('clase_attempt', { clase: 'c1', card: 'c1-3', answer: { label: 'elev', part }, correct });
  const rows = [drop('p-elev', true), drop('p-largo', false), drop('p-luces', true),
    card('c1', 'c1-3', { multi: true, tries: 2, first_try_correct: false, drops: 3 })];
  const it = claseReport(rows, chapters).units[0].items[2];
  assert.equal(it.tries, 2);
  assert.equal(it.first_try_correct, false);
  assert.equal(it.attempts.length, 3); // el detalle sigue mostrando cada soltada
});
