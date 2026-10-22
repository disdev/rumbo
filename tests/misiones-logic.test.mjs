// Lógica pura de las misiones de Vuelo en ruta (spec 2026-10-22): geometría
// de la carta, calificación de respuestas y lo que el mentor ve derivado del log.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceNM, trueCourse, project, chartAspect, expectedValue, gradeAnswer,
  missionProgress, missionAccuracy, missionReport,
} from '../src/js/misiones-logic.js';

const LIMA = { lat: -12.0219, lon: -77.1143 };
const NORTE = { lat: -11.0219, lon: -77.1143 };
const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b} (±${eps})`);

test('1° de latitud = 60 NM y curso 360 hacia el norte', () => {
  near(distanceNM(LIMA, NORTE), 60, 0.01);
  assert.equal(trueCourse(LIMA, NORTE), 360);
  assert.equal(trueCourse(NORTE, LIMA), 180);
});

test('al oeste en el hemisferio sur el curso es 270; la longitud se encoge con cos(lat)', () => {
  const oeste = { lat: LIMA.lat, lon: LIMA.lon - 0.5 };
  assert.equal(trueCourse(LIMA, oeste), 270);
  near(distanceNM(LIMA, oeste), 30 * Math.cos(12.0219 * Math.PI / 180), 0.01);
});

test('project ida y vuelta conserva lat/lon y el ángulo en pantalla coincide con trueCourse', () => {
  const bounds = { north: -10.5, south: -12.5, west: -78.0, east: -76.5 };
  const w = 600, h = Math.round(w * chartAspect(bounds));
  const P = project(bounds, { w, h });
  const p = { lat: -11.3, lon: -77.4 };
  const back = P.toLatLon(P.toXY(p));
  near(back.lat, p.lat, 1e-9); near(back.lon, p.lon, 1e-9);
  assert.deepEqual(P.toXY({ lat: bounds.north, lon: bounds.west }), { x: 0, y: 0 });
  const a = P.toXY(LIMA), b = P.toXY({ lat: -11.1, lon: -77.6 });
  const screen = (Math.atan2(b.x - a.x, a.y - b.y) * 180 / Math.PI + 360) % 360;
  near(screen, trueCourse(LIMA, { lat: -11.1, lon: -77.6 }), 1);
});

test('gradeAnswer: 2° vs 358° esperado es off_by +4 y correcto con tol 5; el recíproco falla', () => {
  const step = { kind: 'number', unit: 'deg', expected: 358, tol: 5 };
  assert.deepEqual(gradeAnswer(step, { value: 2 }, {}), { correct: true, off_by: 4 });
  assert.equal(gradeAnswer(step, { value: 360 }, {}).off_by, 2);
  assert.equal(gradeAnswer(step, { value: 178 }, {}).correct, false);
});

test('gradeAnswer: números no angulares con signo y tolerancia', () => {
  const step = { kind: 'number', unit: 'ft', expected: 1749, tol: 0 };
  assert.deepEqual(gradeAnswer(step, { value: 1749 }, {}), { correct: true, off_by: 0 });
  assert.deepEqual(gradeAnswer(step, { value: 1649 }, {}), { correct: false, off_by: -100 });
});

test('gradeAnswer: place mide NM al objetivo', () => {
  const step = { kind: 'place', target: LIMA, tol: 3 };
  const r = gradeAnswer(step, { lat: LIMA.lat + 0.1, lon: LIMA.lon }, {});
  near(r.off_by, 6, 0.01);
  assert.equal(r.correct, false);
  assert.equal(gradeAnswer(step, { lat: LIMA.lat + 0.02, lon: LIMA.lon }, {}).correct, true);
});

test('gradeAnswer: tap y choice', () => {
  assert.deepEqual(gradeAnswer({ kind: 'tap', targets: ['SPJC'] }, { feature: 'SPJC' }, {}), { correct: true, off_by: null });
  assert.equal(gradeAnswer({ kind: 'tap', targets: ['SPJC'] }, { feature: 'ob1' }, {}).correct, false);
  assert.equal(gradeAnswer({ kind: 'choice', answer: 2 }, { option: 2 }, {}).correct, true);
  assert.equal(gradeAnswer({ kind: 'choice', answer: 2 }, { option: 0 }, {}).correct, false);
});

const CHART = {
  variation: { deg: -2 },
  airports: [{ id: 'SPJC', ...LIMA }, { id: 'N', ...NORTE }],
  obstacles: [{ id: 'ob1', msl: 1249, agl: 349 }],
  routes: [{ id: 'r', from: 'SPJC', to: 'N' }],
};

test('expectedValue: curso, distancia, magnético (Oeste suma) y obstáculo', () => {
  assert.equal(expectedValue({ compute: 'true_course', route: 'r' }, CHART), 360);
  near(expectedValue({ compute: 'distance_nm', route: 'r' }, CHART), 60, 0.01);
  assert.equal(expectedValue({ compute: 'magnetic_course', route: 'r' }, CHART), 2);
  assert.equal(expectedValue({ compute: 'obstacle_clearance', obstacle: 'ob1', clearance_ft: 500 }, CHART), 1749);
  assert.equal(expectedValue({ expected: 42 }, CHART), 42);
  assert.equal(gradeAnswer({ kind: 'number', unit: 'deg', compute: 'magnetic_course', route: 'r', tol: 1 }, { value: 2 }, CHART).correct, true);
});

const MISSIONS = [
  { id: 'm1', title: 'Leer el mapa', steps: [{ id: 'm1-1', title: 'A' }, { id: 'm1-2', title: 'B' }, { id: 'm1-3', title: 'C' }], questions: ['q1', 'q2', 'q3'] },
  { id: 'm2', title: 'Medir', steps: [{ id: 'm2-1', title: 'D' }], questions: ['q4'] },
];
let n = 0;
const r = (ts, kind, detail, extra = {}) => ({ id: `r${n++}`, ts, kind, detail, ...extra });
const stepRow = (ts, step, extra = {}) => r(ts, 'mission_step', { mission: step.split('-')[0], step, tries: 1, first_try_correct: true, revealed: false, seconds: 30, ...extra });

test('missionProgress: paso a medias → next es ese paso; todos hechos sin prueba → "prueba"', () => {
  const p = missionProgress([stepRow(1, 'm1-1')], MISSIONS);
  assert.equal(p.m1.started, true);
  assert.equal(p.m1.next, 'm1-2');
  assert.equal(p.m2.started, false);
  assert.equal(p.m2.next, 'm2-1');
  const q = missionProgress([stepRow(1, 'm1-1'), stepRow(2, 'm1-3'), stepRow(3, 'm1-2')], MISSIONS);
  assert.equal(q.m1.next, 'prueba');
  assert.equal(q.m1.completed, false);
  assert.equal(q.m1.lastTs, 3);
});

test('missionProgress: completed se mantiene si luego repite la misión', () => {
  const rows = [stepRow(1, 'm1-1'), stepRow(2, 'm1-2'), stepRow(3, 'm1-3'),
    r(4, 'mission_progress', { mission: 'm1', completed: true }),
    r(5, 'mission_progress', { mission: 'm1', completed: false, last_step: 'm1-1' })];
  const p = missionProgress(rows, MISSIONS);
  assert.equal(p.m1.completed, true);
  assert.equal(p.m1.next, null);
});

test('missionAccuracy: solo el primer intento por qid a cada lado de completedTs', () => {
  const quiz = (ts, items) => r(ts, 'quiz', { items });
  const rows = [
    quiz(1, [{ qid: 'q1', correct: false }, { qid: 'q2', correct: true }, { qid: 'zz', correct: false }]),
    quiz(2, [{ qid: 'q1', correct: true }]), // segundo intento antes: no cuenta
    r(3, 'simulacro', { items: [{ qid: 'q3', correct: false }] }),
    quiz(10, [{ qid: 'q1', correct: true }, { qid: 'q3', correct: true }]),
    r(11, 'redo', { items: [{ qid: 'q1', correct: false }] }), // segundo después: no cuenta
  ];
  assert.deepEqual(missionAccuracy(rows, MISSIONS[0], 10), { before: { n: 3, ok: 1 }, after: { n: 2, ok: 2 } });
});

test('missionReport: tries cuenta todos los intentos; first_try_correct del primer mission_step; stuck ordena por tries+2·revealed', () => {
  const att = (ts, step, correct) => r(ts, 'mission_attempt', { mission: step.split('-')[0], step, try: 1, answer: { value: ts }, correct, off_by: 3, ms_to_answer: 900, hint_shown: false });
  const rows = [
    r(0, 'nav', { screen: 'mision', mission: 'm1', step: 'm1-3', view: 'step', action: 'enter' }),
    att(1, 'm1-1', false), att(2, 'm1-1', false), att(3, 'm1-1', true),
    stepRow(4, 'm1-1', { tries: 3, first_try_correct: false, revealed: false, seconds: 50 }),
    att(5, 'm1-2', false), att(6, 'm1-2', false),
    stepRow(7, 'm1-2', { tries: 2, first_try_correct: false, revealed: true, seconds: 70 }),
    att(8, 'm1-1', true),
    stepRow(9, 'm1-1', { tries: 1, first_try_correct: true, seconds: 10 }), // repetición
    r(10, 'quiz', { mission: 'm1', items: [] }, { score: 4, total: 6 }),
    r(11, 'mission_progress', { mission: 'm1', completed: true, seconds: 400 }),
  ];
  const rep = missionReport(rows, MISSIONS);
  const m1 = rep.missions[0];
  assert.equal(m1.status, 'done');
  assert.deepEqual(m1.prueba, { score: 4, total: 6 });
  const [s1, s2, s3] = m1.steps;
  assert.equal(s1.tries, 4);
  assert.equal(s1.first_try_correct, false);
  assert.equal(s1.seconds, 60);
  assert.equal(s1.attempts.length, 4);
  assert.deepEqual(Object.keys(s1.attempts[0]).sort(), ['answer', 'correct', 'hint_shown', 'ms_to_answer', 'off_by', 'ts']);
  assert.equal(s2.revealed, true);
  assert.equal(s3.status, 'opened');
  assert.equal(rep.missions[1].status, 'not_started');
  assert.deepEqual(rep.stuck.map(s => s.step), ['m1-1', 'm1-2']); // 4+0 vs 2+2: empate → orden de misión
  assert.equal(rep.stuck[0].title, 'A');
});

test('missionReport: la prueba de la misión ya cuenta como «después» (corte = la prueba, no la fila de completada)', () => {
  const rows = [
    r(1, 'quiz', { items: [{ qid: 'q1', correct: false }] }),
    stepRow(2, 'm1-1'), stepRow(3, 'm1-2'), stepRow(4, 'm1-3'),
    r(5, 'quiz', { mission: 'm1', items: [{ qid: 'q1', correct: true }, { qid: 'q2', correct: true }] }, { score: 2, total: 2 }),
    r(6, 'mission_progress', { mission: 'm1', completed: true, seconds: 100 }),
  ];
  const m1 = missionReport(rows, MISSIONS).missions[0];
  assert.deepEqual(m1.accuracy, { before: { n: 1, ok: 0 }, after: { n: 2, ok: 2 } });
});
