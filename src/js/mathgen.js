// Generador de problemas de matemática (SPEC §3.3, §5.2).
// Los enunciados/rangos viven en data/math-templates.json; el cálculo y los
// distractores viven aquí, indexados por family.id. Todo debe salir con
// números trabajables a mano: el examen no permite calculadora.

import { hdg, hdgStr, rwyStr, patternLegs, bestRunway } from './ops-logic.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const fmt = (n) => Number.isInteger(n) ? n.toLocaleString('es-PE') : n.toLocaleString('es-PE', { maximumFractionDigits: 1 });

function fill(wording, vars) {
  return wording.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

// Dos distractores distintos entre sí y de la respuesta (dos trampas de signo
// pueden coincidir en el mismo número): rellena con ±10° si hace falta.
function twoDistinct(answer, cands) {
  const out = [];
  for (const c of [...cands, answer + 10, answer - 10, answer + 20]) {
    if (c !== answer && !out.includes(c) && c >= 1 && c <= 360) out.push(c);
    if (out.length === 2) break;
  }
  return out;
}

// Cada generador devuelve { vars, answer, unit, worked, distract: [n1, n2] }.
// distract: errores plausibles (factor vecino, signo invertido, olvidar un paso).
const GEN = {
  carga(rng, t, tier) {
    const angles = Object.keys(t._factors);
    const angle = pick(rng, angles);
    const f = t._factors[angle];
    const wrongF = t._factors[pick(rng, angles.filter(a => a !== angle))];
    if (tier <= 2) {
      const w = pick(rng, t.weights);
      return {
        vars: { w: fmt(w), angle },
        answer: w * f, unit: 'lb',
        worked: `${fmt(w)} × ${f} = ${fmt(w * f)} lb`,
        distract: [w * wrongF, w],
        stepVals: [f, w * f],
      };
    }
    const ew = pick(rng, t.empty_weights), gal = pick(rng, t.fuel_gal), occ = pick(rng, t.occupants_lb);
    const angle3 = pick(rng, angles), f3 = t._factors[angle3];
    const gross = ew + gal * 6 + occ;
    return {
      vars: { ew: fmt(ew), gal, occ: fmt(occ), angle: angle3 },
      answer: gross * f3, unit: 'lb',
      worked: `${fmt(ew)} + ${gal}×6 + ${fmt(occ)} = ${fmt(gross)} lb; ${fmt(gross)} × ${f3} = ${fmt(gross * f3)} lb`,
      distract: [gross * t._factors[pick(rng, angles.filter(a => a !== angle3))], (ew + occ) * f3],
      stepVals: [gal * 6, gross, f3, gross * f3],
    };
  },

  altimetro(rng, t, tier) {
    if (tier === 1) {
      const from = pick(rng, t.from), d = pick(rng, t.deltas);
      const to = Math.round((from + d) * 100) / 100;
      const ft = Math.round(d * 1000);
      return {
        vars: { from: from.toFixed(2), to: to.toFixed(2) },
        answer: ft, unit: 'ft (con signo: + sube, − baja)',
        worked: `(${to.toFixed(2)} − ${from.toFixed(2)}) × 1000 = ${ft > 0 ? '+' : ''}${ft} ft`,
        distract: [-ft, ft * 10],
        stepVals: [Math.round((to - from) * 100) / 100, ft],
      };
    }
    if (tier === 2) {
      const from = pick(rng, t.settings);
      const to = pick(rng, t.settings.filter(s => s !== from));
      const ft = Math.round((to - from) * 1000);
      return {
        vars: { from: from.toFixed(2), to: to.toFixed(2) },
        answer: ft, unit: 'ft (con signo)',
        worked: `(${to.toFixed(2)} − ${from.toFixed(2)}) × 1000 = ${ft > 0 ? '+' : ''}${ft} ft`,
        distract: [-ft, Math.round(ft / 10)],
        stepVals: [Math.round((to - from) * 100) / 100, ft],
      };
    }
    const elev = pick(rng, t.elevations), set = pick(rng, t.settings);
    const pa = Math.round(elev + (29.92 - set) * 1000);
    return {
      vars: { elev: fmt(elev), set: set.toFixed(2) },
      answer: pa, unit: 'ft',
      worked: `${fmt(elev)} + (29.92 − ${set.toFixed(2)}) × 1000 = ${fmt(pa)} ft`,
      distract: [Math.round(elev - (29.92 - set) * 1000), elev],
      stepVals: [Math.round((29.92 - set) * 100) / 100, Math.round((29.92 - set) * 1000), pa],
    };
  },

  nubes(rng, t, tier) {
    const spreads = Object.entries(t._spreads); // [spreadF, aglFt]
    const [spread, agl] = pick(rng, spreads);
    const temp = pick(rng, t.temps_f);
    const td = Math.round((temp - Number(spread)) * 10) / 10;
    if (tier <= 2) {
      return {
        vars: { t: temp, td: fmt(td) },
        answer: agl, unit: 'ft AGL',
        worked: `(${temp} − ${fmt(td)}) ÷ 4.4 × 1000 = ${fmt(agl)} ft AGL`,
        distract: [agl + 1000, Math.round((temp - td) * 100)],
        stepVals: [Number(spread), agl],
      };
    }
    const elev = pick(rng, t.elevations);
    return {
      vars: { t: temp, td: fmt(td), elev: fmt(elev) },
      answer: agl + elev, unit: 'ft MSL',
      worked: `(${temp} − ${fmt(td)}) ÷ 4.4 × 1000 = ${fmt(agl)} ft AGL; ${fmt(agl)} + ${fmt(elev)} = ${fmt(agl + elev)} ft MSL`,
      distract: [agl, agl + elev + 1000],
      stepVals: [Number(spread), agl, agl + elev],
    };
  },

  altitudes(rng, t, tier) {
    if (tier === 1) {
      const elev = pick(rng, t.elevations), set = pick(rng, t.settings);
      const pa = Math.round(elev + (29.92 - set) * 1000);
      return {
        vars: { elev: fmt(elev), set: set.toFixed(2) },
        answer: pa, unit: 'ft',
        worked: `${fmt(elev)} + (29.92 − ${set.toFixed(2)}) × 1000 = ${fmt(pa)} ft`,
        distract: [Math.round(elev - (29.92 - set) * 1000), elev + 1000],
        stepVals: [Math.round((29.92 - set) * 100) / 100, Math.round((29.92 - set) * 1000), pa],
      };
    }
    if (tier === 2) {
      const pa = pick(rng, t.pas), off = pick(rng, t.oat_offsets);
      const isa = 15 - 2 * (pa / 1000);
      const oat = isa + off;
      const da = pa + 120 * off;
      return {
        vars: { pa: fmt(pa), oat: fmt(oat) },
        answer: da, unit: 'ft',
        worked: `ISA = 15 − 2×${pa / 1000} = ${fmt(isa)} °C; DA = ${fmt(pa)} + 120 × (${fmt(oat)} − ${fmt(isa)}) = ${fmt(da)} ft`,
        distract: [pa - 120 * off, pa],
        stepVals: [isa, off, da],
      };
    }
    const elev = pick(rng, t.elevations), set = pick(rng, t.settings), off = pick(rng, t.oat_offsets);
    const pa = Math.round(elev + (29.92 - set) * 1000);
    const isa = 15 - 2 * (pa / 1000);
    const oat = Math.round(isa + off);
    const da = Math.round(pa + 120 * (oat - isa));
    return {
      vars: { elev: fmt(elev), set: set.toFixed(2), oat: fmt(oat) },
      answer: da, unit: 'ft',
      worked: `PA = ${fmt(elev)} + (29.92 − ${set.toFixed(2)}) × 1000 = ${fmt(pa)} ft; ISA = 15 − 2×${pa / 1000} = ${fmt(isa)} °C; DA = ${fmt(pa)} + 120 × (${fmt(oat)} − ${fmt(isa)}) = ${fmt(da)} ft`,
      distract: [pa, Math.round(pa - 120 * (oat - isa))],
      stepVals: [Math.round((29.92 - set) * 100) / 100, pa, isa, Math.round((oat - isa) * 10) / 10, da],
    };
  },

  peso_balance(rng, t, tier) {
    if (tier === 1) {
      const w = pick(rng, t.weights), arm = pick(rng, t.arms);
      return {
        vars: { w: fmt(w), arm },
        answer: w * arm, unit: 'lb-in',
        worked: `${fmt(w)} × ${arm} = ${fmt(w * arm)} lb-in`,
        distract: [w * (arm + 2), Math.round(w * arm / 10)],
        stepVals: [w * arm],
      };
    }
    if (tier === 2) {
      const e = pick(rng, t.empty), pax = pick(rng, t.front_pax), gal = pick(rng, t.fuel_gal);
      const fw = gal * 6;
      const totW = e.w + pax + fw;
      const totM = e.w * e.arm + pax * t.front_arm + fw * t.fuel_arm;
      const cg = Math.round((totM / totW) * 10) / 10;
      return {
        vars: { ew: fmt(e.w), ea: e.arm, pax: fmt(pax), pa: t.front_arm, gal, fa: t.fuel_arm },
        answer: cg, unit: 'in',
        worked: `M = ${fmt(e.w)}×${e.arm} + ${fmt(pax)}×${t.front_arm} + ${fw}×${t.fuel_arm} = ${fmt(totM)}; W = ${fmt(totW)}; CG = ${fmt(totM)} ÷ ${fmt(totW)} ≈ ${fmt(cg)} in`,
        distract: [Math.round((totM / (totW - fw)) * 10) / 10, e.arm],
        stepVals: [fw, totM, totW, cg],
      };
    }
    const b = pick(rng, t.base), gal = pick(rng, t.burn_gal);
    const fw = gal * 6;
    const newW = b.w - fw;
    const newM = b.w * b.arm - fw * t.fuel_arm;
    const cg = Math.round((newM / newW) * 10) / 10;
    return {
      vars: { w: fmt(b.w), arm: b.arm, gal, fa: t.fuel_arm },
      answer: cg, unit: 'in',
      worked: `M = ${fmt(b.w)}×${b.arm} − ${fw}×${t.fuel_arm} = ${fmt(newM)}; W = ${fmt(b.w)} − ${fw} = ${fmt(newW)}; CG = ${fmt(newM)} ÷ ${fmt(newW)} ≈ ${fmt(cg)} in`,
      distract: [b.arm, Math.round(((b.w * b.arm + fw * t.fuel_arm) / (b.w + fw)) * 10) / 10],
      stepVals: [fw, newM, newW, cg],
    };
  },

  tvd(rng, t, tier) {
    if (tier === 1) {
      const gs = pick(rng, t.gs), h = pick(rng, t.hours);
      const d = gs * h, min = h * 60;
      return {
        vars: { gs, d: fmt(d) },
        answer: min, unit: 'min',
        worked: `${fmt(d)} ÷ ${gs} = ${fmt(h)} h = ${fmt(min)} min`,
        distract: [min + 30, Math.round(d / 60 * 60 + 15)],
        stepVals: [h, min],
      };
    }
    if (tier === 2) {
      const tas = pick(rng, t.tas), wind = pick(rng, t.winds), h = pick(rng, t.hours);
      const gs = tas + wind, d = gs * h, min = h * 60;
      return {
        vars: { tas, wind: Math.abs(wind), winddir: wind < 0 ? 'de frente' : 'de cola', d: fmt(d) },
        answer: min, unit: 'min',
        worked: `GS = ${tas} ${wind < 0 ? '−' : '+'} ${Math.abs(wind)} = ${gs} kt; ${fmt(d)} ÷ ${gs} = ${fmt(h)} h = ${fmt(min)} min`,
        distract: [Math.round(d / (tas - wind) * 60), Math.round(d / tas * 60)],
        stepVals: [gs, h, min],
      };
    }
    const tas = pick(rng, t.tas), wind = pick(rng, t.winds), h = pick(rng, t.hours);
    const burn = pick(rng, t.burns), resmin = pick(rng, t.reserves_min);
    const gs = tas + wind, d = gs * h;
    const fuel = h * burn + (resmin / 60) * burn;
    return {
      vars: { tas, wind: Math.abs(wind), winddir: wind < 0 ? 'de frente' : 'de cola', d: fmt(d), burn, resmin },
      answer: Math.round(fuel * 10) / 10, unit: 'gal',
      worked: `GS = ${gs} kt; t = ${fmt(d)} ÷ ${gs} = ${fmt(h)} h; combustible = ${fmt(h)}×${burn} + ${resmin / 60}×${burn} = ${fmt(Math.round(fuel * 10) / 10)} gal`,
      distract: [Math.round(h * burn * 10) / 10, Math.round((h + 1) * burn * 10) / 10],
      stepVals: [gs, h, Math.round(h * burn * 10) / 10, Math.round((resmin / 60) * burn * 10) / 10, Math.round(fuel * 10) / 10],
    };
  },

  // Rumbo magnético (cap. 16): curso → WCA → variación → desviación.
  // Rangos elegidos para no cruzar el norte (las respuestas quedan en 010–350).
  rumbo(rng, t, tier) {
    const th0 = pick(rng, t.headings), v = pick(rng, t.vars), east = rng() < 0.5;
    const dirWord = east ? 'Este' : 'Oeste';
    const corr = east ? -v : v; // Este resta, Oeste suma
    if (tier === 1) {
      const mh = th0 + corr;
      return {
        vars: { th: hdgStr(th0), var: v, dir: dirWord },
        answer: mh, unit: '°',
        worked: `${hdgStr(th0)} ${east ? '−' : '+'} ${v} = ${hdgStr(mh)}° (${east ? 'Este resta' : 'Oeste suma'})`,
        distract: twoDistinct(mh, [th0 - corr, th0]),
        stepVals: [corr, mh],
      };
    }
    const wca = pick(rng, t.wcas), right = rng() < 0.5;
    const th = th0 + (right ? wca : -wca);
    const mh = th + corr;
    const base = {
      tc: hdgStr(th0), wca, side: right ? 'derecha' : 'izquierda', var: v, dir: dirWord,
    };
    if (tier === 2) {
      return {
        vars: base,
        answer: mh, unit: '°',
        worked: `RV = ${hdgStr(th0)} ${right ? '+' : '−'} ${wca} = ${hdgStr(th)}°; RM = ${hdgStr(th)} ${east ? '−' : '+'} ${v} = ${hdgStr(mh)}°`,
        distract: twoDistinct(mh, [th - corr, th0 + (right ? -wca : wca) + corr]),
        stepVals: [th, corr, mh],
      };
    }
    const dev = pick(rng, t.devs);
    const ch = mh + dev;
    return {
      vars: { ...base, dev: dev > 0 ? `+${dev}` : `−${-dev}` },
      answer: ch, unit: '°',
      worked: `RV = ${hdgStr(th0)} ${right ? '+' : '−'} ${wca} = ${hdgStr(th)}°; RM = ${hdgStr(th)} ${east ? '−' : '+'} ${v} = ${hdgStr(mh)}°; RB = ${hdgStr(mh)} ${dev > 0 ? '+' : '−'} ${Math.abs(dev)} = ${hdgStr(ch)}°`,
      distract: twoDistinct(ch, [th - corr + dev, mh - dev]),
      stepVals: [th, mh, ch],
    };
  },

  // Rumbos del circuito de tránsito (cap. 14): pista → tramos.
  circuito(rng, t, tier) {
    if (tier <= 2) {
      const rwy = pick(rng, t.runways);
      const side = tier === 1 ? 'izq' : (rng() < 0.5 ? 'izq' : 'der');
      const legs = patternLegs(rwy, side), other = patternLegs(rwy, side === 'izq' ? 'der' : 'izq');
      if (tier === 1) {
        return {
          vars: { rwy: rwyStr(rwy) },
          answer: legs.downwind, unit: '°',
          worked: `Pista ${rwyStr(rwy)} → aterrizas a ${hdgStr(legs.final)}°; a favor del viento = ${hdgStr(legs.final)} ± 180 = ${hdgStr(legs.downwind)}°`,
          distract: [legs.final, legs.base],
          stepVals: [legs.final, legs.downwind],
        };
      }
      return {
        vars: { rwy: rwyStr(rwy), side: side === 'der' ? 'derecho' : 'izquierdo', turn: side === 'der' ? 'derecha' : 'izquierda' },
        answer: legs.base, unit: '°',
        worked: `Aterrizaje ${hdgStr(legs.final)}°; a favor del viento ${hdgStr(legs.downwind)}°; básico (patrón ${side === 'der' ? 'derecho: aterrizaje − 90' : 'izquierdo: aterrizaje + 90'}) = ${hdgStr(legs.base)}°`,
        distract: [other.base, legs.downwind],
        stepVals: [legs.final, legs.downwind, legs.base],
      };
    }
    const [a, b] = pick(rng, t.pairs);
    const end = rng() < 0.5 ? a : b;
    const wind = hdg(end * 10 + pick(rng, t.wind_offsets));
    const rwy = bestRunway(wind, [a, b]).best;
    const side = rng() < 0.5 ? 'izq' : 'der';
    const legs = patternLegs(rwy, side), other = patternLegs(rwy, side === 'izq' ? 'der' : 'izq');
    return {
      vars: { wind: hdgStr(wind), ws: pick(rng, t.wind_kt), a: rwyStr(a), b: rwyStr(b), side: side === 'der' ? 'derecho' : 'izquierdo' },
      answer: legs.crosswind, unit: '°',
      worked: `Viento de ${hdgStr(wind)}° → pista ${rwyStr(rwy)} (despegas a ${hdgStr(legs.upwind)}°); cruzado (${side === 'der' ? 'derecho: + 90' : 'izquierdo: − 90'}) = ${hdgStr(legs.crosswind)}°`,
      distract: [other.crosswind, legs.upwind],
      stepVals: [rwy, legs.upwind, legs.crosswind],
    };
  },
};

// Normaliza atajos de acceso a constantes de la familia.
function tierSpec(fam, tier) {
  const t = { ...fam.tiers[String(tier)] };
  if (fam.factors) t._factors = fam.factors;
  if (fam.spreads_f) t._spreads = fam.spreads_f;
  return t;
}

/**
 * Genera un problema.
 * @returns {{familyId, tier, text, formula, answer, unit, worked, tolerancePct, options?}}
 * options (3, mezcladas, con índice correcto) solo si mc=true (simulacros, §5.5).
 */
export function generateProblem(templates, familyId, tier, { rng = Math.random, mc = false } = {}) {
  const fam = templates.families.find(f => f.id === familyId);
  if (!fam) throw new Error(`familia desconocida: ${familyId}`);
  const spec = tierSpec(fam, tier);
  const g = GEN[familyId](rng, spec, tier);
  // Pasos de resolución guiada (SPEC §3.3): etiquetas/fórmulas en el JSON,
  // valores del generador — cada problema generado sabe mostrar su solución.
  const stepMeta = fam.steps?.[String(tier)] || [];
  const stepVals = g.stepVals || [];
  if (stepMeta.length !== stepVals.length) throw new Error(`steps desalineados: ${familyId} n${tier} (${stepMeta.length} meta, ${stepVals.length} valores)`);
  const steps = stepMeta.map((m, i) => ({
    label: fill(m.label, g.vars), formula: fill(m.formula, g.vars),
    value: stepVals[i], unit: m.unit || '',
    tolerancePct: Number.isInteger(stepVals[i]) && Math.abs(stepVals[i]) < 10000 ? 0 : 2,
  }));

  const prob = {
    familyId, tier,
    text: fill(spec.wording, g.vars),
    formula: fam.formula,           // se muestra en N1; en N2/3 solo al revelar (SPEC §3.3)
    answer: g.answer,
    unit: g.unit,
    worked: g.worked,
    steps,
    tolerancePct: Number.isInteger(g.answer) && Math.abs(g.answer) < 10000 ? 0 : 2,
    params: g.vars,
  };
  if (mc) {
    const opts = [g.answer, ...g.distract.filter(d => d !== g.answer).slice(0, 2)];
    while (opts.length < 3) opts.push(Math.round(g.answer * (1 + (opts.length === 1 ? 0.1 : -0.1))));
    const shuffled = opts.map((v, i) => ({ v, i })).sort(() => rng() - 0.5);
    prob.options = shuffled.map(o => `${fmt(o.v)} ${g.unit.split(' ')[0]}`.trim());
    prob.correctIndex = shuffled.findIndex(o => o.i === 0);
  }
  return prob;
}

/** Verifica una respuesta de entrada libre contra la tolerancia (SPEC §3.3). */
export function checkAnswer(prob, input, tolerancePct = 2) {
  let s = String(input).replace(/\s/g, '');
  // Coma: separador de miles ("3,450") o decimal ("40,5"). Con punto presente,
  // o seguida de 3 dígitos exactos, es de miles; si no, es decimal.
  if (s.includes('.')) s = s.replace(/,/g, '');
  else if (/,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const val = parseFloat(s);
  if (Number.isNaN(val)) return false;
  if (prob.tolerancePct === 0) return Math.abs(val - prob.answer) < 0.001;
  const tol = Math.abs(prob.answer) * (tolerancePct / 100);
  return Math.abs(val - prob.answer) <= Math.max(tol, 0.05);
}

export const FAMILY_IDS = ['carga', 'altimetro', 'nubes', 'altitudes', 'peso_balance', 'tvd'];

// Familias del taller (§5.11): mismas recetas guiadas y práctica, pero FUERA
// de la escalera — no tocan la cuadrícula, las puertas ni el planificador.
export const TALLER_FAMILY_IDS = ['rumbo', 'circuito'];
