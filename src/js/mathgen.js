// Generador de problemas de matemática (SPEC §3.3, §5.2).
// Los enunciados/rangos viven en data/math-templates.json; el cálculo y los
// distractores viven aquí, indexados por family.id. Todo debe salir con
// números trabajables a mano: el examen no permite calculadora.

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
      };
    }
    const elev = pick(rng, t.elevations), set = pick(rng, t.settings);
    const pa = Math.round(elev + (29.92 - set) * 1000);
    return {
      vars: { elev: fmt(elev), set: set.toFixed(2) },
      answer: pa, unit: 'ft',
      worked: `${fmt(elev)} + (29.92 − ${set.toFixed(2)}) × 1000 = ${fmt(pa)} ft`,
      distract: [Math.round(elev - (29.92 - set) * 1000), elev],
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
      };
    }
    const elev = pick(rng, t.elevations);
    return {
      vars: { t: temp, td: fmt(td), elev: fmt(elev) },
      answer: agl + elev, unit: 'ft MSL',
      worked: `(${temp} − ${fmt(td)}) ÷ 4.4 × 1000 = ${fmt(agl)} ft AGL; ${fmt(agl)} + ${fmt(elev)} = ${fmt(agl + elev)} ft MSL`,
      distract: [agl, agl + elev + 1000],
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
  const prob = {
    familyId, tier,
    text: fill(spec.wording, g.vars),
    formula: fam.formula,           // se muestra en N1; en N2/3 solo al revelar (SPEC §3.3)
    answer: g.answer,
    unit: g.unit,
    worked: g.worked,
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
