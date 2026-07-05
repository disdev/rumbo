// Los pasos de resolución guiada deben existir para toda familia×nivel y
// cerrar en la respuesta del problema (SPEC §3.3 worked steps).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateProblem, checkAnswer, mulberry32, FAMILY_IDS } from '../src/js/mathgen.js';

const templates = JSON.parse(readFileSync(new URL('../data/math-templates.json', import.meta.url)));

test('cada familia×nivel genera steps completos que cierran en la respuesta', () => {
  for (const fam of FAMILY_IDS) {
    for (const tier of [1, 2, 3]) {
      const rng = mulberry32(fam.length * 100 + tier);
      for (let i = 0; i < 25; i++) {
        const p = generateProblem(templates, fam, tier, { rng });
        assert.ok(Array.isArray(p.steps) && p.steps.length >= 1, `${fam} n${tier}: sin steps`);
        for (const s of p.steps) {
          assert.ok(s.label && s.formula !== undefined, `${fam} n${tier}: step sin label/formula`);
          assert.ok(Number.isFinite(s.value), `${fam} n${tier}: step "${s.label}" valor no finito`);
          assert.ok(!/\{\w+\}/.test(s.label), `${fam} n${tier}: label sin sustituir: ${s.label}`);
        }
        assert.equal(p.steps[p.steps.length - 1].value, p.answer,
          `${fam} n${tier}: el último paso (${p.steps[p.steps.length - 1].value}) ≠ respuesta (${p.answer})`);
      }
    }
  }
});

test('checkAnswer acepta el valor de cada paso como entrada exacta', () => {
  const rng = mulberry32(7);
  const p = generateProblem(templates, 'peso_balance', 2, { rng });
  for (const s of p.steps) {
    assert.ok(checkAnswer({ answer: s.value, tolerancePct: 2 }, String(s.value), 2));
  }
});
