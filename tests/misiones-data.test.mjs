// Datos de las misiones (spec 2026-10-22): la carta de entrenamiento tiene que
// ser coherente consigo misma, porque las respuestas se califican contra ella.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distanceNM, trueCourse } from '../src/js/misiones-logic.js';

const load = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const chart = load('data/misiones/carta-costa-central.json');
const inside = (p, b) => p.lat <= b.north && p.lat >= b.south && p.lon >= b.west && p.lon <= b.east;

test('carta: rótulo de entrenamiento y fuentes citadas', () => {
  assert.equal(chart.label, 'Carta de entrenamiento — no usar para navegación');
  assert.ok(chart.variation.source?.length > 10);
  assert.equal(typeof chart.variation.deg, 'number');
  assert.ok(chart.coast_source?.length > 10);
  for (const a of chart.airports) assert.ok(a.source?.length > 5, `fuente de ${a.id}`);
});

test('carta: todo dentro de los límites y costa con ≥ 25 puntos', () => {
  for (const f of [...chart.airports, ...chart.obstacles, ...chart.checkpoints]) assert.ok(inside(f, chart.bounds), f.id);
  assert.ok(chart.coast.length >= 25);
  assert.ok(chart.obstacles.length >= 1 && chart.checkpoints.length >= 1);
});

const QUAD = 0.5;
function quadrants(b) {
  const out = [];
  for (let lat = b.north; lat > b.south + 1e-9; lat -= QUAD)
    for (let lon = b.west; lon < b.east - 1e-9; lon += QUAD) out.push({ lat_n: +lat.toFixed(4), lon_w: +lon.toFixed(4) });
  return out;
}
const inQuad = (p, q) => p.lat <= q.lat_n && p.lat > q.lat_n - QUAD && p.lon >= q.lon_w && p.lon < q.lon_w + QUAD;

test('carta: un MEF por cuadrante de 30′, sin huecos', () => {
  const want = quadrants(chart.bounds).map(q => `${q.lat_n}:${q.lon_w}`).sort();
  const got = chart.mef.map(m => `${m.lat_n}:${m.lon_w}`).sort();
  assert.equal(want.length, 12);
  assert.deepEqual(got, want);
});

test('carta: cada MEF es múltiplo de 100 y libra obstáculos y terreno del cuadrante', () => {
  for (const m of chart.mef) {
    assert.equal(m.ft % 100, 0, `MEF ${m.lat_n}:${m.lon_w}`);
    const obst = chart.obstacles.filter(o => inQuad(o, m)).map(o => o.msl);
    const terr = chart.terrain.filter(t => t.poly.some(([lat, lon]) => inQuad({ lat, lon }, m))).map(t => t.top_ft);
    const highest = Math.max(0, ...obst, ...terr);
    assert.ok(m.ft >= highest, `MEF ${m.ft} < ${highest} en ${m.lat_n}:${m.lon_w}`);
  }
});

test('carta: las rutas resuelven a dos aeropuertos y Lima → Huacho es NNO a 50–80 NM', () => {
  const ap = (id) => chart.airports.find(a => a.id === id);
  for (const r of chart.routes) assert.ok(ap(r.from) && ap(r.to), r.id);
  const r = chart.routes.find(x => x.id === 'lima-huacho');
  const d = distanceNM(ap(r.from), ap(r.to)), tc = trueCourse(ap(r.from), ap(r.to));
  assert.ok(d > 50 && d < 80, `distancia ${d}`);
  assert.ok(tc > 300 && tc <= 360, `curso ${tc}`);
});

// ---- misiones y mapeo de las 77 preguntas ----
import { existsSync } from 'node:fs';
import { expectedValue } from '../src/js/misiones-logic.js';
const M = load('data/misiones.json');
const bank = load('data/bank.json');
const ruta = bank.filter(q => q.category === 'VUELO EN RUTA').map(q => q.id).sort();
const live = M.missions.filter(m => m.live);

test('mapeo: exactamente las 77 preguntas de VUELO EN RUTA, cada una en una misión', () => {
  assert.equal(ruta.length, 77);
  assert.deepEqual(Object.keys(M.question_map).sort(), ruta);
  for (const m of M.missions) {
    const mapped = Object.entries(M.question_map).filter(([, v]) => v.mission === m.id).map(([k]) => k).sort();
    assert.deepEqual([...m.questions].sort(), mapped, m.id);
  }
  assert.deepEqual(M.missions.map(m => m.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
});

test('mapeo: m1 y m2 en vivo, con preguntas suficientes y método a mano para cada una', () => {
  assert.deepEqual(live.map(m => m.id), ['m1', 'm2']);
  assert.ok(M.missions[0].questions.length >= 5);
  assert.ok(M.missions[1].questions.length >= 4);
  for (const m of live) for (const id of m.questions) {
    const e = M.question_map[id];
    assert.ok(typeof e.method === 'string' && e.method.length > 10, `método de ${id}`);
    assert.equal(typeof e.by_hand_ok, 'boolean', `by_hand_ok de ${id}`);
  }
});

const REQ = { tap: ['targets'], choice: ['options', 'answer'], number: ['unit', 'tol'], place: ['target', 'tol'] };

test('pasos: ids secuenciales, campos por tipo y nada de plotter en la figura del examen', () => {
  for (const m of live) {
    m.steps.forEach((s, i) => {
      assert.equal(s.id, `${m.id}-${i + 1}`);
      for (const f of REQ[s.kind] || assert.fail(`tipo ${s.kind}`)) assert.ok(s[f] !== undefined, `${s.id}.${f}`);
      assert.ok(s.title && s.prompt && s.hint, `${s.id} título/prompt/pista`);
      assert.ok(s.prompt.split(/\s+/).length <= 40, `${s.id}: prompt de más de 40 palabras`);
      if (s.kind === 'choice') assert.ok(s.answer >= 0 && s.answer < s.options.length, s.id);
      if (s.kind === 'number') assert.ok(Number.isFinite(expectedValue(s, chart)), `${s.id}: valor esperado`);
      if (s.surface !== 'carta') {
        assert.ok(existsSync(new URL(`../data/figures/${s.surface.figure}`, import.meta.url)), `${s.id}: figura`);
        assert.ok(!s.tool && s.kind !== 'place', `${s.id}: sin plotter ni place en la figura del examen`);
        if (s.kind === 'tap') for (const t of s.targets) assert.ok(s.surface.hotspots.some(h => h.id === t), `${s.id}: hotspot ${t}`);
      }
      if (s.receta) assert.ok(m.recetas.some(r => r.id === s.receta), `${s.id}: receta ${s.receta}`);
      if (s.route) assert.ok(chart.routes.some(r => r.id === s.route), `${s.id}: ruta`);
    });
    assert.ok(m.steps.some(s => s.surface !== 'carta'), `${m.id}: falta el paso puente en la figura del examen`);
  }
});

test('m1 enseña lo que pregunta su prueba: tintes, combustible, cuadro de precaución, meridianos', () => {
  const m1 = M.missions[0];
  assert.ok(chart.cautions?.length >= 1, 'la carta necesita un cuadro de PRECAUCIÓN');
  assert.ok(m1.steps.some(s => s.focus === 'legend'), 'paso de tintes con la leyenda');
  assert.ok(m1.steps.some(s => s.focus === chart.cautions[0].id), 'paso del cuadro de precaución');
  assert.ok(m1.steps.some(s => /rayitas/.test(s.prompt) && /combustible/.test(JSON.stringify(s.options))), 'paso de combustible');
  assert.ok(/Greenwich/.test(m1.recetas.find(r => r.id === 'r-latlon').body), 'meridianos y Greenwich en la receta');
});

test('figura 20: frecuencia de Norfolk y posición de Chesapeake verificadas contra la imagen', () => {
  const m1 = M.missions[0];
  assert.ok(m1.steps.some(s => /120\.8/.test(s.prompt)));
  assert.ok(!JSON.stringify(M).includes('128.8'));
  for (const s of M.missions.flatMap(m => m.steps)) {
    const h = s.surface?.hotspots?.find(x => x.id === 'chesapeake');
    // px de la Figura 20 del suplemento FAA-CT-8080-2H (render 4×, 1899×2649; antes la copia ASA de 1002×1400)
    if (h) assert.deepEqual([h.x, h.y], [476, 1383], s.id);
  }
});
