// derive(): nuevas reglas de lecciones, modos de drill y mantenimiento (SPEC §3.4, §5.2, §5.8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { derive, dayKey } from '../src/js/derive.js';

const config = JSON.parse(readFileSync(new URL('../data/config.json', import.meta.url)));
const chapters = JSON.parse(readFileSync(new URL('../data/chapters.json', import.meta.url)));
const bank = [];
const data = { config, chapters, bank };

const DAY = 864e5;
const T0 = Date.UTC(2026, 6, 6, 14, 0, 0); // lunes 2026-07-06 09:00 Lima
let n = 0;
const row = (daysAgo, kind, extra = {}) => ({ id: `r${n++}`, ts: T0 - daysAgo * DAY, kind, ...extra });
const today = dayKey(T0);

test('lesson_progress con completed marca el capítulo como leído; lectura vieja sigue valiendo', () => {
  const st = derive([
    row(0, 'lesson_progress', { chapter: '3', detail: { section: '3-1', seconds: 120 } }),
    row(0, 'lesson_progress', { chapter: '3', detail: { section: '3-2', seconds: 90, completed: true } }),
    row(0, 'block', { detail: { type: 'lectura', chapter: '4' } }),
  ], data, today);
  assert.equal(st.chapterState.get('3').read, true);
  assert.equal(st.chapterState.get('4').read, true);
  assert.equal(st.chapterState.get('5').read, false);
  assert.equal(st.lessons.get('3').completed, true);
  assert.equal(st.lessons.get('3').sectionsSeen.size, 2);
});

test('lesson_check y notebook se acumulan por capítulo', () => {
  const st = derive([
    row(0, 'lesson_check', { chapter: '3', detail: { check_id: '3-1-c1', correct: true } }),
    row(0, 'lesson_check', { chapter: '3', detail: { check_id: '3-1-c2', correct: false } }),
    row(0, 'notebook', { chapter: '3', detail: { prompt_id: '3-1-n1' } }),
  ], data, today);
  assert.deepEqual(st.lessons.get('3').checks, { n: 2, ok: 1 });
  assert.equal(st.lessons.get('3').notebooks.size, 1);
});

test('drills en modo guiada/practica/maintenance no tocan el ladder pero sí cuentan reps', () => {
  const st = derive([
    row(2, 'drill', { family: 'carga', tier: 1, score: 2, total: 2, detail: { mode: 'guiada' } }),
    row(2, 'drill', { family: 'carga', tier: 1, score: 4, total: 4, detail: { mode: 'practica', items: [{ correct: true }, { correct: true }, { correct: true }, { correct: true }] } }),
    row(1, 'drill', { family: 'carga', tier: 1, score: 9, total: 10, detail: { items: [{ correct: false }, ...Array(9).fill({ correct: true })] } }),
    row(0, 'drill', { family: 'carga', tier: 1, score: 3, total: 3, detail: { mode: 'maintenance', items: [{ correct: true }, { correct: true }, { correct: true }] } }),
  ], data, today);
  assert.equal(st.ladder.carga.passedTier, 1);
  assert.equal(st.ladder.carga.attempts.length, 1); // solo el puntuado
  assert.equal(st.mathSeen.has('carga:1'), true);
  assert.equal(st.mathReps.carga.lifetime, 17); // 4 práctica + 10 intento + 3 mantenimiento (guiada = pasos, no problemas)
  assert.equal(st.mathReps.carga.streak, 12); // 9 del intento (tras el fallo) + 3 mantenimiento... o según orden
});

test('mantenimiento vence según la escalera de intervalos', () => {
  // pasó nivel 1 hace 3 días, sin drills desde entonces → vencido (intervalo 1d)
  const st = derive([
    row(3, 'drill', { family: 'nubes', tier: 1, score: 10, total: 10, detail: { items: Array(10).fill({ correct: true }) } }),
  ], data, today);
  assert.ok(st.mathMaintenanceDue.some(d => d.family === 'nubes' && d.tier === 1));
  // un mantenimiento hoy lo saca de la lista
  const st2 = derive([
    row(3, 'drill', { family: 'nubes', tier: 1, score: 10, total: 10, detail: { items: Array(10).fill({ correct: true }) } }),
    row(0, 'drill', { family: 'nubes', tier: 1, score: 3, total: 3, detail: { mode: 'maintenance', items: Array(3).fill({ correct: true }) } }),
  ], data, today);
  assert.ok(!st2.mathMaintenanceDue.some(d => d.family === 'nubes'));
});

test('nav es inerte: no cuenta como actividad ni rompe derive (spec 2026-07-06)', () => {
  const st = derive([
    row(0, 'nav', { detail: { screen: 'inicio', action: 'enter' } }),
    row(0, 'nav', { chapter: '3', detail: { screen: 'leccion', section: '3-1', action: 'enter' } }),
    row(0, 'nav', { detail: { screen: 'leccion', action: 'leave' } }),
  ], data, today);
  assert.ok(!st.activityToday.any); // abrir la app no es estudiar
  assert.equal(st.dayLog.get(today), 'perdido');
  assert.equal(st.streaks.overall, 0);
});
