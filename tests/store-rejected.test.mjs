// store.js: las filas rechazadas por el servidor salen de la cola (spec
// 2026-07-06) — una fila envenenada jamás vuelve a frenar la sincronización.
import test from 'node:test';
import assert from 'node:assert/strict';

// shim mínimo de localStorage para node
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
globalThis.crypto ??= (await import('node:crypto')).webcrypto;

const { initStore, append, pendingRows, markSynced, parkRejected, rejectedRows, queueSize } = await import('../src/js/store.js');

test('parkRejected saca las filas de la cola y las guarda para diagnóstico', () => {
  mem.clear();
  initStore();
  const a = append({ kind: 'quiz', score: 1, total: 1 }, 'v1');
  const b = append({ kind: 'lesson_progress', chapter: '3' }, 'v1');
  const c = append({ kind: 'drill', family: 'carga' }, 'v1');
  assert.equal(queueSize(), 3);

  markSynced([a.id, c.id]);
  parkRejected([{ id: b.id, error: 'kind must be one of: …' }]);

  assert.equal(queueSize(), 0);
  assert.equal(pendingRows().length, 0);
  const parked = rejectedRows();
  assert.equal(parked.length, 1);
  assert.equal(parked[0].id, b.id);
  assert.match(parked[0].error, /kind/);
});

test('parkRejected ignora ids null y no duplica', () => {
  mem.clear();
  initStore();
  const a = append({ kind: 'quiz' }, 'v1');
  parkRejected([{ id: null, error: 'x' }, { id: a.id, error: 'y' }, { id: a.id, error: 'y' }]);
  assert.equal(rejectedRows().length, 1);
  assert.equal(queueSize(), 0);
});
