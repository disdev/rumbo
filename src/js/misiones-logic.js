// Lógica pura de las misiones de Vuelo en ruta (spec 2026-10-22): geometría de
// la carta de entrenamiento, calificación de cada respuesta y todo lo que el
// mentor ve, derivado del log. Sin DOM — la usan el app, /progreso y los tests.
// Convención: latitud Sur y longitud Oeste negativas; rumbos 1–360 (hdg).

import { hdg, angleDiff, toMagnetic } from './ops-logic.js';

const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;

function legNM(a, b) {
  const dN = (b.lat - a.lat) * 60;
  const dE = (b.lon - a.lon) * 60 * Math.cos(rad((a.lat + b.lat) / 2));
  return { dN, dE };
}

/** Distancia en NM (aproximación plana local: 1′ de latitud = 1 NM). */
export function distanceNM(a, b) {
  const { dN, dE } = legNM(a, b);
  return Math.hypot(dN, dE);
}

/** Curso verdadero de a hacia b, 1–360. */
export function trueCourse(a, b) {
  const { dN, dE } = legNM(a, b);
  return hdg(deg(Math.atan2(dE, dN)));
}

/** Alto/ancho de la carta: la longitud se encoge con cos(latitud media). */
export function chartAspect(b) {
  const mid = (b.north + b.south) / 2;
  return (b.north - b.south) / ((b.east - b.west) * Math.cos(rad(mid)));
}

/** Equirectangular con x escalada por cos(lat media): los ángulos en pantalla son los reales. */
export function project(b, { w, h }) {
  return {
    toXY: ({ lat, lon }) => ({ x: (lon - b.west) / (b.east - b.west) * w, y: (b.north - lat) / (b.north - b.south) * h }),
    toLatLon: ({ x, y }) => ({ lat: b.north - y / h * (b.north - b.south), lon: b.west + x / w * (b.east - b.west) }),
  };
}

function routeEnds(chart, routeId) {
  const route = chart.routes?.find(r => r.id === routeId);
  const ap = (id) => chart.airports?.find(a => a.id === id);
  const from = route && ap(route.from), to = route && ap(route.to);
  if (!from || !to) throw new Error(`ruta desconocida: ${routeId}`);
  return { from, to };
}

/** Valor correcto de un paso numérico: literal (`expected`) o calculado de la carta (`compute`). */
export function expectedValue(step, chart) {
  if (typeof step.expected === 'number') return step.expected;
  switch (step.compute) {
    case 'true_course': { const { from, to } = routeEnds(chart, step.route); return trueCourse(from, to); }
    case 'distance_nm': { const { from, to } = routeEnds(chart, step.route); return distanceNM(from, to); }
    case 'magnetic_course': {
      const { from, to } = routeEnds(chart, step.route);
      return hdg(toMagnetic(trueCourse(from, to), chart.variation.deg));
    }
    case 'obstacle_clearance': {
      const ob = chart.obstacles?.find(o => o.id === step.obstacle);
      if (!ob) throw new Error(`obstáculo desconocido: ${step.obstacle}`);
      return ob.msl + step.clearance_ft;
    }
    default: throw new Error(`paso sin expected ni compute válido: ${step.id}`);
  }
}

/** @returns {{correct: boolean, off_by: number|null}} off_by en la unidad del paso. */
export function gradeAnswer(step, answer, chart) {
  switch (step.kind) {
    case 'tap': return { correct: step.targets.includes(answer.feature), off_by: null };
    case 'choice': return { correct: answer.option === step.answer, off_by: null };
    case 'place': {
      const off = distanceNM(answer, step.target);
      return { correct: off <= step.tol, off_by: off };
    }
    case 'number': {
      const exp = expectedValue(step, chart);
      const off = step.unit === 'deg' ? angleDiff(answer.value, exp) : answer.value - exp;
      return { correct: Math.abs(off) <= step.tol, off_by: off };
    }
    default: throw new Error(`tipo de paso desconocido: ${step.kind}`);
  }
}

const isMission = (r, id) => r.detail?.mission === id;

/** Dónde va cada misión, derivado del log (nunca guardado aparte). */
export function missionProgress(rows, missions) {
  const out = {};
  for (const m of missions) {
    const mine = rows.filter(r => isMission(r, m.id) && (r.kind === 'mission_step' || r.kind === 'mission_progress'));
    const done = new Set(mine.filter(r => r.kind === 'mission_step').map(r => r.detail.step));
    const completed = mine.some(r => r.kind === 'mission_progress' && r.detail.completed);
    const pending = (m.steps || []).find(s => !done.has(s.id));
    out[m.id] = {
      started: mine.length > 0,
      completed,
      done,
      next: completed ? null : pending ? pending.id : 'prueba',
      lastTs: mine.length ? Math.max(...mine.map(r => r.ts)) : null,
    };
  }
  return out;
}

/** Primer intento por pregunta antes y después de terminar la misión. */
export function missionAccuracy(rows, mission, completedTs) {
  const qs = new Set(mission.questions || []);
  const before = new Map(), after = new Map();
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  for (const r of sorted) {
    if (!['quiz', 'redo', 'simulacro'].includes(r.kind)) continue;
    const side = completedTs != null && r.ts >= completedTs ? after : before;
    for (const it of r.detail?.items || []) {
      if (it.qid && qs.has(it.qid) && !side.has(it.qid)) side.set(it.qid, !!it.correct);
    }
  }
  const tally = (m) => ({ n: m.size, ok: [...m.values()].filter(Boolean).length });
  return { before: tally(before), after: tally(after) };
}

/** Todo lo que /progreso muestra de las misiones: estado, tiempos, cada respuesta. */
export function missionReport(rows, missions) {
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  const reports = missions.map(m => {
    const mine = sorted.filter(r => isMission(r, m.id));
    const progressRows = mine.filter(r => r.kind === 'mission_progress');
    const firstDone = progressRows.find(r => r.detail.completed);
    const pruebas = mine.filter(r => r.kind === 'quiz');
    const prueba = pruebas[pruebas.length - 1];
    // corte antes/después: la primera prueba de la misión (ya es «después de enseñar»);
    // la fila quiz se escribe al terminar la prueba, así que sus respuestas caen del lado «después»
    const cut = pruebas.length ? pruebas[0].ts : firstDone ? firstDone.ts : null;
    const stepSeconds = mine.filter(r => r.kind === 'mission_step').reduce((s, r) => s + (r.detail.seconds || 0), 0);
    const steps = (m.steps || []).map(s => {
      const stepRows = mine.filter(r => r.detail.step === s.id);
      const completions = stepRows.filter(r => r.kind === 'mission_step');
      const attempts = stepRows.filter(r => r.kind === 'mission_attempt');
      const opened = stepRows.some(r => r.kind === 'nav' || r.kind === 'mission_attempt');
      return {
        id: s.id,
        title: s.title,
        status: completions.length ? 'done' : opened ? 'opened' : 'not_started',
        seconds: completions.reduce((sum, r) => sum + (r.detail.seconds || 0), 0),
        tries: attempts.length,
        first_try_correct: completions.length ? !!completions[0].detail.first_try_correct : null,
        revealed: completions.some(r => r.detail.revealed),
        attempts: attempts.map(r => ({
          ts: r.ts, answer: r.detail.answer, correct: !!r.detail.correct, off_by: r.detail.off_by ?? null,
          ms_to_answer: r.detail.ms_to_answer ?? null, hint_shown: !!r.detail.hint_shown,
        })),
      };
    });
    return {
      id: m.id,
      title: m.title,
      status: firstDone ? 'done' : mine.length ? 'in_progress' : 'not_started',
      seconds: progressRows.length ? progressRows.reduce((s, r) => s + (r.detail.seconds || 0), 0) : stepSeconds,
      prueba: prueba ? { score: prueba.score, total: prueba.total } : null,
      accuracy: missionAccuracy(rows, m, cut),
      steps,
    };
  });
  const stuck = reports.flatMap(m => m.steps.map(s => ({ mission: m.id, step: s.id, title: s.title, tries: s.tries, revealed: s.revealed })))
    .filter(s => s.tries > 1 || s.revealed)
    .map((s, i) => ({ s, i, score: s.tries + (s.revealed ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 5)
    .map(x => x.s);
  return { missions: reports, stuck };
}
