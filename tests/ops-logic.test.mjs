// Lógica de operaciones y navegación del taller (cap. 14 y 16): lo que los
// widgets enseñan tiene que ser verdad aeronáutica, no solo verse bonito.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hdg, angleDiff, bestRunway, windsockPoints, patternLegs, patternSideHeading, AIRFIELDS,
  windTriangle, toMagnetic, TAXI_MAP, TAXI_SCENARIOS, evaluateMove, neighbors,
} from '../src/js/ops-logic.js';

test('hdg usa 360 para el norte y normaliza', () => {
  assert.equal(hdg(0), 360);
  assert.equal(hdg(360), 360);
  assert.equal(hdg(-90), 270);
  assert.equal(hdg(450), 90);
  assert.equal(angleDiff(10, 350), 20);
  assert.equal(angleDiff(350, 10), -20);
});

test('se aterriza contra el viento; la manga apunta hacia donde va', () => {
  assert.equal(bestRunway(360, [36, 18]).best, 36);
  assert.equal(bestRunway(250, [9, 27]).best, 27);
  assert.equal(bestRunway(120, [13, 31]).best, 13);
  assert.equal(bestRunway(90, [36, 18]).ambiguous, true);
  assert.equal(windsockPoints(180), 360); // viento del sur: la manga apunta al norte
  assert.equal(windsockPoints(270), 90);
});

test('rumbos del circuito (lección 14-8: pista 36 izquierdo = 360/270/180/090)', () => {
  assert.deepEqual(patternLegs(36, 'izq'), { upwind: 360, crosswind: 270, downwind: 180, base: 90, final: 360 });
  assert.deepEqual(patternLegs(27, 'der'), { upwind: 270, crosswind: 360, downwind: 90, base: 180, final: 270 });
  assert.equal(patternLegs(18, 'izq').downwind, 360);
});

test('las L de cada aeródromo dejan el circuito lejos de su zona a evitar', () => {
  for (const af of AIRFIELDS) {
    for (const n of af.ends) {
      const side = patternSideHeading(n, af.sides[n]);
      if (af.avoid !== undefined) assert.ok(Math.abs(angleDiff(side, af.avoid)) > 90, `${af.id} pista ${n}: el circuito pasa sobre la zona a evitar`);
    }
  }
  // 36 izquierdo → circuito al oeste; 27 derecho → al norte
  assert.equal(patternSideHeading(36, 'izq'), 270);
  assert.equal(patternSideHeading(27, 'der'), 360);
});

test('triángulo de viento: frente, cola y cruzado (ejemplos del guion)', () => {
  const head = windTriangle({ tc: 90, tas: 110, windFrom: 90, windKt: 20 });
  assert.equal(Math.round(head.gs), 90);
  assert.equal(Math.round(head.wca), 0);
  const tail = windTriangle({ tc: 90, tas: 110, windFrom: 270, windKt: 20 });
  assert.equal(Math.round(tail.gs), 130);
  // curso 360, TAS 100, viento 270/20 → corrige ~12° a la izquierda: rumbo ~348
  const cross = windTriangle({ tc: 360, tas: 100, windFrom: 270, windKt: 20 });
  assert.equal(Math.round(cross.wca), -12);
  assert.equal(hdg(cross.th), 348);
  assert.equal(Math.round(cross.gs), 98);
  // sin corregir, el viento del oeste te deriva a la derecha
  const drift = windTriangle({ tc: 360, tas: 100, windFrom: 270, windKt: 20, correct: false });
  assert.ok(drift.drift > 10 && drift.drift < 12);
});

test('dos nortes: Este resta, Oeste suma', () => {
  assert.equal(toMagnetic(45, -2), 47);
  assert.equal(toMagnetic(90, 4), 86);
});

// BFS respetando las reglas: cada autorización se puede cumplir, y entrar a
// una pista no autorizada es incursión.
function solve(stage, start) {
  const seen = new Set([start]);
  const q = [start];
  while (q.length) {
    const cur = q.shift();
    for (const { id } of neighbors(cur)) {
      if (seen.has(id)) continue;
      const r = evaluateMove(stage, cur, id);
      if (r.type === 'arrive') return true;
      if (r.type === 'move') { seen.add(id); q.push(id); }
    }
  }
  return false;
}

test('rodaje: toda etapa de toda autorización tiene solución sin incursiones', () => {
  for (const sc of TAXI_SCENARIOS) {
    let start = sc.start;
    for (const st of sc.stages) {
      assert.ok(solve(st, start), `${sc.id}: etapa sin solución`);
      assert.ok(TAXI_MAP.nodes[st.target], `${sc.id}: target inexistente`);
      start = st.target;
    }
  }
});

test('rodaje: las trampas son incursiones y salirse de la ruta se frena', () => {
  const [cruce, hold, r09] = TAXI_SCENARIOS;
  assert.equal(evaluateMove(cruce.stages[0], 'HAw', 'XA').type, 'move'); // cruce autorizado
  assert.equal(evaluateMove(hold.stages[0], 'HAw', 'XA').type, 'incursion'); // mantenga posición
  assert.equal(evaluateMove(hold.stages[0], 'AC', 'HAw').type, 'arrive');
  assert.equal(evaluateMove(r09.stages[0], 'HB', 'RB').type, 'incursion'); // rodar a ≠ entrar
  assert.equal(evaluateMove(r09.stages[0], 'AC', 'HC').type, 'off-route'); // Charlie no está en la ruta
  assert.equal(evaluateMove(r09.stages[0], 'PLAT', 'HB').type, 'not-adjacent');
  // toda espera tiene su pista vecina (para dibujar las 4 líneas)
  for (const [id, n] of Object.entries(TAXI_MAP.nodes)) {
    if (n.hold) assert.ok(neighbors(id).some(nb => TAXI_MAP.nodes[nb.id].runway === n.hold), `${id} sin pista ${n.hold} vecina`);
  }
});
