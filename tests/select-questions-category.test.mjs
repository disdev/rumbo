// selectQuestions({source: 'category'}): quiz de práctica a demanda (SPEC §5.3/§5.5
// — botón "Practicar" en el home) filtra el banco por categoría exacta y respeta el tope.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions } from '../src/js/planner.js';

const bank = [
  { id: 'n1', category: 'NAVEGACIÓN', question: '¿?', options: ['a', 'b', 'c'], answer: 0 },
  { id: 'n2', category: 'NAVEGACIÓN', question: '¿?', options: ['a', 'b', 'c'], answer: 0 },
  { id: 'n3', category: 'NAVEGACIÓN', question: '¿?', options: ['a', 'b', 'c'], answer: 0 },
  { id: 'm1', category: 'METEOROLOGÍA', question: '¿?', options: ['a', 'b', 'c'], answer: 0 },
];
const state = { itemStats: new Map() };

test('source: category devuelve solo preguntas de esa categoría', () => {
  const qs = selectQuestions({ type: 'quiz', source: 'category', category: 'NAVEGACIÓN' }, state, { bank });
  assert.equal(qs.length, 3);
  assert.ok(qs.every(q => q.category === 'NAVEGACIÓN'));
});

test('source: category respeta el tope (cap)', () => {
  const qs = selectQuestions({ type: 'quiz', source: 'category', category: 'NAVEGACIÓN', cap: 2 }, state, { bank });
  assert.equal(qs.length, 2);
});

test('source: ids — solo esos ids, no vistos primero, luego fallados, tope cap', () => {
  const bank = ['a', 'b', 'c', 'd'].map(id => ({ id, category: 'VUELO EN RUTA', options: ['x', 'y', 'z'], answer: 0 }));
  const itemStats = new Map([
    ['q:a', { lastDays: [{ correct: true }] }],
    ['q:b', { lastDays: [{ correct: false }] }],
  ]);
  const qs = selectQuestions({ type: 'quiz', source: 'ids', ids: ['a', 'b', 'c'], cap: 2 }, { itemStats }, { bank }, () => 0.5);
  assert.deepEqual(qs.map(q => q.id), ['c', 'b']);
  const all = selectQuestions({ type: 'quiz', source: 'ids', ids: ['a', 'b', 'c'] }, { itemStats }, { bank }, () => 0.5);
  assert.deepEqual(all.map(q => q.id), ['c', 'b', 'a']);
});

test('source: ids — ids inexistentes se ignoran y el tope por defecto es 8', () => {
  const bank = Array.from({ length: 12 }, (_, i) => ({ id: `v${i}`, category: 'VUELO EN RUTA', options: ['x', 'y', 'z'], answer: 0 }));
  const state = { itemStats: new Map() };
  assert.deepEqual(selectQuestions({ type: 'quiz', source: 'ids', ids: ['zz', 'v1'] }, state, { bank }).map(q => q.id), ['v1']);
  assert.equal(selectQuestions({ type: 'quiz', source: 'ids', ids: bank.map(q => q.id) }, state, { bank }).length, 8);
});
