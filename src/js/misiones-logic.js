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

/** Número escrito a mano: coma de miles como en el banco («1,749»), coma decimal («60,5»), espacios. */
export function parseNumber(input) {
  let s = String(input).replace(/\s/g, '');
  if (s.includes('.')) s = s.replace(/,/g, '');
  else if (/,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  return s === '' ? NaN : Number(s);
}

/** Curso verdadero a dibujar en la carta para una respuesta en grados, o null si el
 *  paso no es un curso. La carta es de norte verdadero: un curso magnético se
 *  convierte (+ variación con signo) para no pintar una derrota distinta. */
export function trueTrackOf(step, value, chart) {
  if (step.unit !== 'deg') return null;
  if (step.compute === 'true_course') return hdg(value);
  if (step.compute === 'magnetic_course') return hdg(value + chart.variation.deg);
  return null;
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

// Misiones y capítulos de la clase (spec carta-paso-a-paso) comparten la misma
// forma: una unidad con ítems en orden, filas attempt/ítem/progreso y una prueba.
export const MISSION_SPEC = {
  unit: 'mission', item: 'step', items: 'steps', questions: 'questions',
  kinds: { attempt: 'mission_attempt', item: 'mission_step', progress: 'mission_progress' },
};

const ofUnit = (r, spec, id) => r.detail?.[spec.unit] === id;

/** Dónde va cada unidad, derivado del log (nunca guardado aparte). */
export function unitProgress(rows, units, spec) {
  const out = {};
  for (const u of units) {
    const mine = rows.filter(r => ofUnit(r, spec, u.id) && (r.kind === spec.kinds.item || r.kind === spec.kinds.progress));
    const done = new Set(mine.filter(r => r.kind === spec.kinds.item).map(r => r.detail[spec.item]));
    const completed = mine.some(r => r.kind === spec.kinds.progress && r.detail.completed);
    const pending = (u[spec.items] || []).find(s => !done.has(s.id));
    out[u.id] = {
      started: mine.length > 0,
      completed,
      done,
      next: completed ? null : pending ? pending.id : 'prueba',
      lastTs: mine.length ? Math.max(...mine.map(r => r.ts)) : null,
    };
  }
  return out;
}

export const missionProgress = (rows, missions) => unitProgress(rows, missions, MISSION_SPEC);

/** Primer intento por pregunta antes y después de un corte (ts). */
export function unitAccuracy(rows, qids, cutTs) {
  const qs = new Set(qids || []);
  const before = new Map(), after = new Map();
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  for (const r of sorted) {
    if (!['quiz', 'redo', 'simulacro'].includes(r.kind)) continue;
    const side = cutTs != null && r.ts >= cutTs ? after : before;
    for (const it of r.detail?.items || []) {
      if (it.qid && qs.has(it.qid) && !side.has(it.qid)) side.set(it.qid, !!it.correct);
    }
  }
  const tally = (m) => ({ n: m.size, ok: [...m.values()].filter(Boolean).length });
  return { before: tally(before), after: tally(after) };
}

/** Primer intento por pregunta antes y después de terminar la misión. */
export const missionAccuracy = (rows, mission, completedTs) => unitAccuracy(rows, mission.questions, completedTs);

/** Todo lo que /progreso muestra de unas unidades: estado, tiempos, cada respuesta. */
export function unitReport(rows, units, spec) {
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  const K = spec.kinds;
  const reports = units.map(m => {
    const mine = sorted.filter(r => ofUnit(r, spec, m.id));
    const progressRows = mine.filter(r => r.kind === K.progress);
    const firstDone = progressRows.find(r => r.detail.completed);
    const pruebas = mine.filter(r => r.kind === 'quiz');
    const prueba = pruebas[pruebas.length - 1];
    // corte antes/después: la primera prueba de la unidad (ya es «después de enseñar»);
    // la fila quiz se escribe al terminar la prueba, así que sus respuestas caen del lado «después»
    const cut = pruebas.length ? pruebas[0].ts : firstDone ? firstDone.ts : null;
    const itemSeconds = mine.filter(r => r.kind === K.item).reduce((s, r) => s + (r.detail.seconds || 0), 0);
    const items = (m[spec.items] || []).map(s => {
      const itemRows = mine.filter(r => r.detail[spec.item] === s.id);
      const completions = itemRows.filter(r => r.kind === K.item);
      const attempts = itemRows.filter(r => r.kind === K.attempt);
      const opened = itemRows.some(r => r.kind === 'nav' || r.kind === K.attempt);
      // la primera vez que lo terminó manda (aunque haya reanudado a medias): las
      // repeticiones suman respuestas al detalle, no «intentos» ni «atascado»
      const first = completions[0];
      const untilFirst = first ? attempts.filter(r => r.ts <= first.ts) : attempts;
      return {
        id: s.id,
        title: s.title,
        status: completions.length ? 'done' : opened ? 'opened' : 'not_started',
        seconds: completions.reduce((sum, r) => sum + (r.detail.seconds || 0), 0),
        tries: untilFirst.length,
        // sin respuestas (una tarjeta «mira») no hay primer intento que juzgar
        first_try_correct: first ? (attempts.length ? !!attempts[0].detail.correct : null) : null,
        revealed: first ? !!first.detail.revealed : false,
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
      seconds: progressRows.length ? progressRows.reduce((s, r) => s + (r.detail.seconds || 0), 0) : itemSeconds,
      prueba: prueba ? { score: prueba.score, total: prueba.total } : null,
      accuracy: unitAccuracy(rows, m[spec.questions], cut),
      items,
    };
  });
  const stuck = reports.flatMap(m => m.items.map(s => ({ unit: m.id, item: s.id, title: s.title, tries: s.tries, revealed: s.revealed })))
    .filter(s => s.tries > 1 || s.revealed)
    .map((s, i) => ({ s, i, score: s.tries + (s.revealed ? 2 : 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, 5)
    .map(x => x.s);
  return { units: reports, stuck };
}

/** El reporte de misiones con sus nombres de siempre (missions/steps, mission/step). */
export function missionReport(rows, missions) {
  const { units, stuck } = unitReport(rows, missions, MISSION_SPEC);
  return {
    missions: units.map(({ items, ...u }) => ({ ...u, steps: items })),
    stuck: stuck.map(({ unit, item, ...s }) => ({ mission: unit, step: item, ...s })),
  };
}
