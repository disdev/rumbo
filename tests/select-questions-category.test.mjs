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
