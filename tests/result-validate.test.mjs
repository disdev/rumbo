// Validación por fila de /api/result (spec 2026-07-06): los kinds de lecciones
// se aceptan y una fila mala nunca rechaza el lote entero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRow, partitionRows } from '../functions/api/_validate.mjs';

const row = (kind, extra = {}) => ({ id: `id-${kind}`, ts: 1751800000000, kind, ...extra });

test('acepta los kinds de lecciones y nav', () => {
  for (const k of ['lesson_progress', 'lesson_check', 'notebook', 'nav']) {
    assert.equal(validateRow(row(k)), null, `kind ${k} debería ser válido`);
  }
});

test('sigue aceptando los kinds originales', () => {
  for (const k of ['drill', 'quiz', 'redo', 'simulacro', 'recall', 'scenario', 'block', 'rapidfire', 'distractor_explain', 'feedback']) {
    assert.equal(validateRow(row(k)), null);
  }
});

test('rechaza kind desconocido, id inválido y ts inválido', () => {
  assert.match(validateRow(row('hackeo')), /kind/);
  assert.match(validateRow({ ...row('quiz'), id: '' }), /id/);
  assert.match(validateRow({ ...row('quiz'), id: 'x'.repeat(65) }), /id/);
  assert.match(validateRow({ ...row('quiz'), ts: 'ayer' }), /ts/);
  assert.match(validateRow(null), /object/);
});

test('partitionRows separa válidas de rechazadas sin tumbar el lote', () => {
  const rows = [row('quiz'), row('hackeo'), row('lesson_progress'), { id: 'sin-ts', kind: 'quiz' }];
  const { valid, rejected } = partitionRows(rows);
  assert.deepEqual(valid.map(r => r.id), ['id-quiz', 'id-lesson_progress']);
  assert.deepEqual(rejected.map(r => r.id), ['id-hackeo', 'sin-ts']);
  assert.ok(rejected.every(r => typeof r.error === 'string' && r.error.length));
});

test('partitionRows rechaza una fila sin id utilizable con id null', () => {
  const { valid, rejected } = partitionRows([{ kind: 'quiz', ts: 1 }, 42]);
  assert.equal(valid.length, 0);
  assert.equal(rejected.length, 2);
  assert.equal(rejected[0].id, null);
  assert.equal(rejected[1].id, null);
});
