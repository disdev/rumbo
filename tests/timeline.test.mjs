// Línea de tiempo del mentor (spec 2026-07-06): agrupa el log crudo en
// días → sesiones (por huecos) → entradas legibles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, lastSeen } from '../src/js/timeline.js';

const T0 = Date.UTC(2026, 6, 6, 21, 0, 0); // lunes 2026-07-06 16:00 Lima
const MIN = 60_000;
let n = 0;
const row = (minAgo, kind, extra = {}) => ({ id: `t${n++}`, ts: T0 - minAgo * MIN, kind, ...extra });

test('agrupa por día y corta sesiones en huecos > gapMinutes', () => {
  const rows = [
    row(200, 'quiz', { category: 'METEOROLOGÍA', score: 8, total: 10 }), // sesión 1
    row(190, 'drill', { family: 'carga', tier: 1, score: 9, total: 10 }),
    row(30, 'quiz', { category: 'PERFORMANCE', score: 7, total: 10 }),   // hueco 160 min → sesión 2
    row(25, 'block', { detail: { type: 'session_end', session: 1 } }),
    row(60 * 24 * 2, 'quiz', { category: 'NAVEGACIÓN', score: 5, total: 10 }), // hace 2 días
  ];
  const days = buildTimeline(rows, { gapMinutes: 25 });
  assert.equal(days.length, 2);
  assert.equal(days[0].day, '2026-07-06'); // más reciente primero
  assert.equal(days[0].sessions.length, 2);
  assert.equal(days[0].sessions[0].entries.length, 2);
  assert.equal(days[1].day, '2026-07-04');
});

test('colapsa lesson_checks consecutivos de la misma sección en una entrada ok/n', () => {
  const rows = [
    row(10, 'lesson_check', { chapter: '3', detail: { section: '3-1', check_id: 'c1', correct: true } }),
    row(9, 'lesson_check', { chapter: '3', detail: { section: '3-1', check_id: 'c2', correct: false } }),
    row(8, 'lesson_check', { chapter: '3', detail: { section: '3-1', check_id: 'c3', correct: true } }),
    row(7, 'lesson_check', { chapter: '3', detail: { section: '3-2', check_id: 'c4', correct: true } }),
  ];
  const [day] = buildTimeline(rows, { gapMinutes: 25 });
  const entries = day.sessions[0].entries;
  assert.equal(entries.length, 2);
  assert.match(entries[0].label, /3-1/);
  assert.match(entries[0].label, /2\/3/);
  assert.match(entries[1].label, /3-2/);
  assert.match(entries[1].label, /1\/1/);
});

test('marca secciones abiertas pero nunca terminadas (abandono)', () => {
  const rows = [
    row(20, 'nav', { chapter: '3', detail: { screen: 'leccion', section: '3-1', action: 'enter' } }),
    row(15, 'lesson_progress', { chapter: '3', detail: { section: '3-1', seconds: 300 } }),
    row(10, 'nav', { chapter: '3', detail: { screen: 'leccion', section: '3-2', action: 'enter' } }),
    // nunca llega el lesson_progress de 3-2
  ];
  const [day] = buildTimeline(rows, { gapMinutes: 25 });
  const entries = day.sessions[0].entries;
  const abandoned = entries.filter(e => e.abandoned);
  assert.equal(abandoned.length, 1);
  assert.match(abandoned[0].label, /3-2/);
  assert.ok(!entries.some(e => e.abandoned && /3-1/.test(e.label)));
});

test('lastSeen devuelve ts y etiqueta de la última fila (nav da la pantalla)', () => {
  const rows = [
    row(60, 'quiz', { category: 'PERFORMANCE', score: 7, total: 10 }),
    row(3, 'nav', { detail: { screen: 'leccion', section: '4-2', action: 'enter' } }),
  ];
  const seen = lastSeen(rows);
  assert.equal(seen.ts, T0 - 3 * MIN);
  assert.match(seen.label, /4-2/);
  assert.equal(lastSeen([]), null);
});

test('nav leave al final marca que salió de la app', () => {
  const rows = [
    row(5, 'nav', { detail: { screen: 'inicio', action: 'enter' } }),
    row(2, 'nav', { detail: { screen: 'inicio', action: 'leave' } }),
  ];
  const seen = lastSeen(rows);
  assert.match(seen.label, /salió|cerró/i);
});
