// planDay(): el mazo de errores entra en días normales cuando tiene ítems
// (directiva del mentor 2026-07-14) — antes solo semana 8 / sin capítulo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derive, dayKey } from '../src/js/derive.js';
import { planDay } from '../src/js/planner.js';

const config = JSON.parse(readFileSync(new URL('../data/config.json', import.meta.url)));
const chapters = JSON.parse(readFileSync(new URL('../data/chapters.json', import.meta.url)));
const scenarios = JSON.parse(readFileSync(new URL('../data/scenarios.json', import.meta.url)));
const bank = [{ id: 'q3031', category: 'REGLAMENTACIÓN', question: '¿?', options: ['a', 'b', 'c'], answer: 0 }];
const data = { config, chapters, bank };

const T0 = Date.UTC(2026, 6, 6, 14, 0, 0); // lunes 2026-07-06 09:00 Lima
let n = 0;
const row = (kind, extra = {}) => ({ id: `p${n++}`, ts: T0, kind, ...extra });
const today = dayKey(T0);

const quizMiss = (qid) => row('quiz', { detail: { items: [{ qid, correct: false }] } });
const allBlocks = (plan) => plan.sessions.flatMap(s => s.blocks);

test('día normal con mazo no vacío incluye el bloque errordeck', () => {
  const st = derive([quizMiss('q3031'), quizMiss('q3031')], data, today); // 2 misses → al mazo
  assert.ok(st.errorDeck.some(e => e.type === 'q'), 'precondición: el ítem entró al mazo');
  const plan = planDay(st, { config, chapters, scenarios }, '09:00', 'normal');
  assert.equal(plan.dayType, 'normal');
  assert.equal(allBlocks(plan).filter(b => b.source === 'errordeck').length, 1);
});

test('día normal con mazo vacío no agrega el bloque', () => {
  const st = derive([quizMiss('q3031')], data, today); // 1 miss: aún no entra
  assert.equal(st.errorDeck.length, 0);
  const plan = planDay(st, { config, chapters, scenarios }, '09:00', 'normal');
  assert.equal(allBlocks(plan).some(b => b.source === 'errordeck'), false);
});

test('semana 8 no duplica el bloque errordeck', () => {
  const st = derive([quizMiss('q3031'), quizMiss('q3031')], data, today);
  const plan = planDay({ ...st, week: 8 }, { config, chapters, scenarios }, '09:00', 'normal');
  assert.equal(allBlocks(plan).filter(b => b.source === 'errordeck').length, 1);
});
