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
