// Lógica pura de operaciones y navegación (cap. 14 y 16): sin DOM, para que
// los widgets del taller y el generador de matemática compartan UNA verdad y
// los tests de node la verifiquen. Convención: rumbos en grados verdaderos
// (salvo que se diga), variación con signo (+ Este, − Oeste).

/** Rumbo estilo aviación: 1–360 (el norte es 360, no 000). */
export const hdg = (h) => (((Math.round(h) % 360) + 360) % 360) || 360;
export const hdgStr = (h) => String(hdg(h)).padStart(3, '0');
export const rwyStr = (n) => String(n).padStart(2, '0');

/** Diferencia con signo a − b en (−180, 180]. */
export function angleDiff(a, b) {
  let d = ((a - b) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;

// ---------- viento → pista → patrón (14-8, 14-9) ----------

/**
 * ¿En qué cabecera aterrizas? La que tenga el viento más de frente.
 * @param windFrom de dónde VIENE el viento (°)
 * @param ends números de pista, p. ej. [36, 18]
 * @returns {{best, headwind: {[n]: number}, ambiguous}} ambiguous = viento
 *   casi cruzado (≤ 10° de 90°): ninguna da viento de frente apreciable.
 */
export function bestRunway(windFrom, ends) {
  const headwind = {};
  for (const n of ends) headwind[n] = Math.cos(rad(angleDiff(windFrom, n * 10)));
  const best = ends.reduce((a, b) => (headwind[b] > headwind[a] ? b : a));
  return { best, headwind, ambiguous: Math.abs(headwind[best]) < Math.sin(rad(10)) };
}

/** La manga apunta hacia donde VA el viento. */
export const windsockPoints = (windFrom) => hdg(windFrom + 180);

/** Rumbos de cada tramo para una pista y un lado de patrón ('izq' | 'der'). */
export function patternLegs(rwy, side) {
  const H = rwy * 10;
  const turn = side === 'der' ? 90 : -90; // izquierdo: cada viraje resta 90
  return {
    upwind: hdg(H),
    crosswind: hdg(H + turn),
    downwind: hdg(H + 180),
    base: hdg(H - turn),
    final: hdg(H),
  };
}

export const LEG_NAMES = {
  upwind: 'Viento en contra',
  crosswind: 'Viento cruzado',
  downwind: 'Viento a favor',
  base: 'Básico',
  final: 'Final',
};

/** Aeródromos del widget «Tú eres la torre» (círculo segmentado con sus L). */
export const AIRFIELDS = [
  {
    id: 'a', name: 'Aeródromo A', ends: [36, 18], sides: { 36: 'izq', 18: 'izq' },
    note: 'Patrón estándar: izquierdo en las dos cabeceras.',
  },
  {
    id: 'b', name: 'Aeródromo B', ends: [9, 27], sides: { 9: 'izq', 27: 'der' },
    note: 'Hay un pueblo al SUR: el circuito siempre se vuela por el norte.',
    avoid: 180,
  },
  {
    id: 'c', name: 'Aeródromo C', ends: [13, 31], sides: { 13: 'der', 31: 'izq' },
    note: 'Hay un cerro al NORESTE: el circuito siempre se vuela por el suroeste.',
    avoid: 45,
  },
];

/** Lado del patrón como vector-rumbo: hacia dónde queda el downwind. */
export const patternSideHeading = (rwy, side) => hdg(rwy * 10 + (side === 'der' ? 90 : -90));

// ---------- triángulo de viento y los dos nortes (16-4, 16-6) ----------

/**
 * @param tc curso verdadero · tas nudos · windFrom/windKt viento
 * @param correct true: la nariz corrige (WCA) y la derrota = curso;
 *                false: la nariz apunta al curso y el viento te deriva.
 * @returns {{wca, th, gs, track, drift, crossKt, headKt}} — wca/drift con signo
 *   (+ derecha). crossKt: componente cruzada (+ desde la derecha);
 *   headKt: componente de frente (+ de frente, − de cola).
 */
export function windTriangle({ tc, tas, windFrom, windKt, correct = true }) {
  const rel = rad(angleDiff(windFrom, tc));
  const crossKt = windKt * Math.sin(rel);
  const headKt = windKt * Math.cos(rel);
  if (correct) {
    const wca = deg(Math.asin(Math.max(-1, Math.min(1, crossKt / tas))));
    const gs = tas * Math.cos(rad(wca)) - headKt;
    return { wca, th: tc + wca, gs, track: tc, drift: 0, crossKt, headKt };
  }
  // sin corregir: aire = (tc, tas); viento sopla HACIA windFrom+180
  const ax = tas * Math.sin(rad(tc)), ay = tas * Math.cos(rad(tc));
  const to = rad(windFrom + 180);
  const gx = ax + windKt * Math.sin(to), gy = ay + windKt * Math.cos(to);
  const track = deg(Math.atan2(gx, gy));
  return { wca: 0, th: tc, gs: Math.hypot(gx, gy), track, drift: angleDiff(track, tc), crossKt, headKt };
}

/** Verdadero → magnético: Este resta, Oeste suma (varE con signo, + Este). */
export const toMagnetic = (trueHdg, varE) => trueHdg - varE;
export const varStr = (varE) => (varE === 0 ? '0°' : `${Math.abs(varE)}° ${varE > 0 ? 'E' : 'O'}`);

// ---------- rodaje (14-4, 14-5, 14-12) ----------

// Plano del aeródromo del juego (viewBox 0 0 360 320). Dos pistas que NO se
// cruzan entre sí: la 09-27 arriba y la 18-36 cortando la calle Alfa.
export const TAXI_MAP = {
  runways: [
    { id: '09-27', x1: 20, y1: 40, x2: 340, y2: 40, ends: ['09', '27'] },
    { id: '18-36', x1: 250, y1: 92, x2: 250, y2: 310, ends: ['18', '36'] },
  ],
  ramp: { x: 50, y: 222, w: 130, h: 70 },
  nodes: {
    PLAT: { x: 110, y: 246, label: 'Plataforma' },
    AE: { x: 110, y: 130 },
    AB: { x: 30, y: 130 },
    HB: { x: 30, y: 74, hold: '09-27' },
    RB: { x: 30, y: 40, runway: '09-27' },
    AC: { x: 160, y: 130 },
    HC: { x: 160, y: 74, hold: '09-27' },
    RC: { x: 160, y: 40, runway: '09-27' },
    HAw: { x: 222, y: 130, hold: '18-36' },
    XA: { x: 250, y: 130, runway: '18-36' },
    HAe: { x: 278, y: 130, hold: '18-36' },
    AD: { x: 330, y: 130 },
    HD: { x: 330, y: 74, hold: '09-27' },
    RD: { x: 330, y: 40, runway: '09-27' },
  },
  edges: [
    ['PLAT', 'AE', 'E'],
    ['AE', 'AB', 'A'], ['AE', 'AC', 'A'], ['AC', 'HAw', 'A'], ['HAw', 'XA', 'A'], ['XA', 'HAe', 'A'], ['HAe', 'AD', 'A'],
    ['AB', 'HB', 'B'], ['HB', 'RB', 'B'],
    ['AC', 'HC', 'C'], ['HC', 'RC', 'C'],
    ['AD', 'HD', 'D'], ['HD', 'RD', 'D'],
  ],
};

const RUNWAY_SAY = { '09-27': 'la pista 09-27', '18-36': 'la pista 18-36' };

/**
 * Autorizaciones del juego. Cada una tiene etapas; al llegar al target de una
 * etapa, llega la siguiente instrucción. cross = pistas que SÍ puedes cruzar.
 */
export const TAXI_SCENARIOS = [
  {
    id: 'r27-cruce', start: 'PLAT',
    stages: [{
      who: 'Superficie', say: 'Rumbo 1-2-3, rodar al punto de espera pista 27 vía Eco, Alfa, Delta. Cruce pista 18.',
      via: ['E', 'A', 'D'], cross: ['18-36'], target: 'HD',
      done: 'Te detuviste en el punto de espera de la 27 sin entrar. «Rodar a la pista» te lleva HASTA la pista, no adentro: para entrar necesitas «ruede a posición» o «autorizado a despegar».',
    }],
  },
  {
    id: 'r27-hold', start: 'PLAT',
    stages: [
      {
        who: 'Superficie', say: 'Rumbo 1-2-3, rodar al punto de espera pista 27 vía Eco, Alfa, Delta. Mantenga posición antes de pista 18.',
        via: ['E', 'A', 'D'], cross: [], target: 'HAw',
        done: 'Bien: te detuviste del lado de las líneas SÓLIDAS, frente al letrero rojo «18-36». Colacionas: «Mantengo posición antes de pista 18, Rumbo 1-2-3».',
      },
      {
        who: 'Superficie', say: 'Rumbo 1-2-3, cruce pista 18, continúe al punto de espera pista 27.',
        via: ['E', 'A', 'D'], cross: ['18-36'], target: 'HD',
        done: 'Cruce autorizado y cumplido. Cada pista que se interpone necesita SU PROPIA autorización de cruce.',
      },
    ],
  },
  {
    id: 'r09', start: 'PLAT',
    stages: [{
      who: 'Superficie', say: 'Rumbo 1-2-3, rodar al punto de espera pista 09 vía Eco, Alfa, Bravo.',
      via: ['E', 'A', 'B'], cross: [], target: 'HB',
      done: 'Listo en el punto de espera de la 09. Ojo con el atajo: Alfa hacia el este te lleva a la 18-36, que nadie te autorizó a cruzar.',
    }],
  },
  {
    id: 'r09-charlie', start: 'PLAT',
    stages: [{
      who: 'Superficie', say: 'Rumbo 1-2-3, rodar al punto de espera pista 09, intersección Charlie, vía Eco, Alfa, Charlie.',
      via: ['E', 'A', 'C'], cross: [], target: 'HC',
      done: 'Salida desde intersección: al pedir el despegue a la torre dices tu posición — «Rumbo 1-2-3, listo en intersección Charlie pista 09».',
    }],
  },
  {
    id: 'aterrizaje', start: 'RC',
    stages: [{
      who: 'Torre', say: 'Rumbo 1-2-3, aterrizó pista 27. Salga por Charlie y ruede a plataforma vía Charlie, Alfa, Eco.',
      via: ['C', 'A', 'E'], cross: [], target: 'PLAT',
      done: 'En plataforma. Al salir de la pista recuerda: solo estás libre de pista cuando cruzaste las CUATRO líneas amarillas completas.',
    }],
  },
];

export function edgeBetween(a, b, map = TAXI_MAP) {
  return map.edges.find(([x, y]) => (x === a && y === b) || (x === b && y === a)) || null;
}

export function neighbors(id, map = TAXI_MAP) {
  return map.edges.filter(([a, b]) => a === id || b === id).map(([a, b, tw]) => ({ id: a === id ? b : a, tw }));
}

/**
 * Evalúa un movimiento de rodaje contra la etapa vigente.
 * @returns {{type: 'not-adjacent'|'off-route'|'incursion'|'move'|'arrive', msg?}}
 */
export function evaluateMove(stage, from, to, map = TAXI_MAP) {
  const e = edgeBetween(from, to, map);
  if (!e) return { type: 'not-adjacent' };
  const tw = e[2];
  if (!stage.via.includes(tw)) {
    return { type: 'off-route', msg: `La calle ${tw} no está en tu autorización (vía ${stage.via.join(', ')}). Si dudas: detente y pide rodaje progresivo.` };
  }
  const node = map.nodes[to];
  if (node.runway && !stage.cross.includes(node.runway)) {
    const msg = to === 'XA'
      ? 'Entraste a la 18-36 sin autorización de cruce. Una autorización de rodaje NO incluye cruzar las pistas que se interponen: cada una necesita su «cruce pista…».'
      : `Entraste a ${RUNWAY_SAY[node.runway]}. «Rodar a la pista» NO incluye entrar a la pista: te detienes del lado de las líneas sólidas y esperas.`;
    return { type: 'incursion', msg };
  }
  if (to === stage.target) return { type: 'arrive', msg: stage.done };
  return { type: 'move' };
}
