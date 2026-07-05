// Arma la secuencia de bloques del día (SPEC §4.4): cero decisiones.
// El plan elige; el estudiante solo empieza. Cada bloque es un descriptor
// que los players de ui.js saben ejecutar.

import { FAMILY_IDS } from './mathgen.js';
import { weekday, addDays } from './derive.js';

function dayFamily(state) {
  // rotación por días de actividad, estable entre recargas
  const n = [...state.dayLog.values()].filter(v => v !== 'perdido').length;
  return FAMILY_IDS[n % FAMILY_IDS.length];
}

function weakestFamily(state, exclude) {
  let worst = null, worstTier = 99;
  for (const f of FAMILY_IDS) {
    if (f === exclude) continue;
    const t = state.ladder[f]?.passedTier ?? 0;
    if (t < worstTier) { worstTier = t; worst = f; }
  }
  return worst || FAMILY_IDS[0];
}

function currentTier(state, family) {
  return Math.min(3, (state.ladder[family]?.passedTier ?? 0) + 1);
}

/** Capítulo de trabajo de hoy: el primero no leído de la semana; si todos leídos, el primero no cerrado. */
function currentChapter(state, chapters) {
  const wk = chapters.weeks.find(w => w.week === state.week);
  if (!wk || !wk.chapters.length) return null;
  for (const id of wk.chapters) if (!state.chapterState.get(id)?.read) return id;
  for (const id of wk.chapters) if (!state.chapterState.get(id)?.closedDay) return id;
  return wk.chapters[wk.chapters.length - 1];
}

function simulacroToday(state) {
  const wd = weekday(state.todayKey);
  if (state.week === 6 && wd === 6) return 'primero';
  if (state.week === 7 && (wd === 3 || wd === 6)) return 'practica';
  if (state.week === 8 && wd === 4) return 'final';
  return null;
}

/**
 * @returns {{dayType, sessions: [{name, blocks: [block]}]}}
 * block: {type, title, ...params} — types: drill, lectura, recall, quiz, redo,
 * scenario, chart, rapidfire, teachback, oral, simulacro, descanso_info
 */
export function planDay(state, { config, chapters, scenarios }, nowLimaHHMM, forcedType = null) {
  const wd = weekday(state.todayKey);
  if (!config.schedule.study_days.includes(wd)) {
    return { dayType: 'domingo', sessions: [] };
  }

  const famA = dayFamily(state);
  const famB = weakestFamily(state, famA);
  const drill = (f) => ({ type: 'drill', family: f, tier: currentTier(state, f), title: `Matemática: ${f}` });

  // ---- reanudación (§4.6): plantilla ligera ----
  if (state.reanudacion) {
    return {
      dayType: 'reanudacion',
      sessions: [{
        name: 'Reanudación',
        blocks: [
          drill(famB),
          { type: 'quiz', source: 'srs_catchup', cap: config.reanudacion.srs_catchup_cap, title: 'Repaso acumulado (máx. 20)' },
          { type: 'quiz', source: 'regla', title: 'Reglamentación' },
          { type: 'rapidfire', title: 'Fraseología' },
        ],
      }],
    };
  }

  // ---- día mínimo (§4.5): solo tras el corte sin sesión iniciada ----
  // (forcedType conserva el tipo elegido si se recarga a mitad de sesión)
  const started = state.activityToday.any;
  if (forcedType === 'minimo' || (forcedType !== 'normal' && !started && nowLimaHHMM >= config.schedule.minimo_cutoff)) {
    return {
      dayType: 'minimo',
      sessions: [{
        name: 'Día mínimo',
        blocks: [drill(famB), { type: 'quiz', source: 'regla', title: 'Reglamentación' }, { type: 'rapidfire', title: 'Fraseología' }],
      }],
    };
  }

  // ---- día normal ----
  const chapterId = currentChapter(state, chapters);
  const ch = chapterId ? chapters.chapters.find(c => c.id === chapterId) : null;
  const readingLocked = state.week >= 6 && !state.week6Unlocked; // §6: se duplican los bloques de matemática
  const sim = simulacroToday(state);
  const scen = scenarios.scenarios.find(s => s.week === state.week);
  const week8 = state.week >= 8;

  const s1 = [drill(famA)];
  if (week8 || !ch) {
    s1.push({ type: 'quiz', source: 'errordeck', title: 'Mazo de errores' });
    // ítems de matemática del mazo: 3 problemas frescos de esa familia/nivel (§5.6)
    for (const e of state.errorDeck.filter(x => x.type === 'math').slice(0, 2)) {
      s1.push({ type: 'drill', family: e.family, tier: e.tier, errordeck: true, title: `Mazo: ${e.family} nivel ${e.tier}` });
    }
    s1.push({ type: 'quiz', source: 'srs', title: 'Repaso espaciado' });
  } else if (readingLocked) {
    s1.push(drill(famB), drill(famA)); // ocupan los huecos de lectura/recuerdo (§6)
  } else {
    s1.push({ type: 'leccion', chapter: chapterId, title: `Lección: cap. ${chapterId} — ${ch.title}` });
    s1.push({ type: 'recall', chapter: chapterId, title: 'Recuerdo libre (lección cerrada)' });
    s1.push({ type: 'quiz', source: 'chapter', chapter: chapterId, part: 1, title: 'Preguntas de la sección' });
  }
  s1.push(drill(famB));
  // Mantenimiento (§5.2): niveles superados vuelven con números frescos — nunca se jubilan
  for (const m of (state.mathMaintenanceDue || []).filter(m => m.family !== famA && m.family !== famB).slice(0, 2)) {
    s1.push({ type: 'drill', family: m.family, tier: m.tier, mode: 'maintenance', title: `Mantenimiento: ${m.family} nivel ${m.tier}` });
  }

  const s2 = [];
  if (sim) {
    s2.push({ type: 'simulacro', which: sim, title: sim === 'final' ? 'SIMULACRO FINAL' : 'Simulacro' });
  } else {
    if (ch && !week8 && !readingLocked) s2.push({ type: 'quiz', source: 'chapter', chapter: chapterId, part: 2, title: 'Más preguntas del capítulo' });
    s2.push({ type: 'quiz', source: 'srs', title: 'Repaso espaciado (10)' });
    s2.push({ type: 'quiz', source: 'regla', title: 'Reglamentación' });
    if (state.week >= 5) s2.push({ type: 'chart', source: 'chart', title: 'Lectura de carta seccional' });
    else if (scen && weekday(state.todayKey) === 3) s2.push({ type: 'scenario', id: scen.id, title: `Vuelo de escritorio: ${scen.title}` });
    s2.push({ type: 'redo', title: 'Rehacer los errores de hoy (con procedimiento)' });
  }

  const s3 = [
    { type: 'rapidfire', title: 'Fraseología: ráfaga' },
    { type: 'teachback', chapter: chapterId, title: 'Explícalo en voz alta' },
    { type: 'oral', chapter: chapterId, title: 'Guion oral / lectura de mañana' },
  ];

  return {
    dayType: 'normal',
    sessions: [
      { name: 'Sesión 1', blocks: s1 },
      { name: 'Sesión 2', blocks: s2 },
      { name: 'Sesión 3', blocks: s3 },
    ],
  };
}

/** Selección de preguntas para cada tipo de bloque quiz. Determinista dado (state, bank, día). */
export function selectQuestions(block, state, { bank, chapters, config }, rng = Math.random) {
  const seen = state.itemStats;
  const shuffled = (arr) => [...arr].sort(() => rng() - 0.5);
  const latestCorrect = (qid) => {
    const st = seen.get(`q:${qid}`);
    return st ? st.lastDays[st.lastDays.length - 1]?.correct : undefined;
  };

  switch (block.source) {
    case 'chapter': {
      const cats = chapters.chapters.find(c => c.id === block.chapter)?.categories || [];
      const pool = bank.filter(q => cats.includes(q.category));
      const unseen = pool.filter(q => !seen.has(`q:${q.id}`));
      const wrong = pool.filter(q => latestCorrect(q.id) === false);
      return shuffled([...unseen, ...wrong]).slice(0, 12);
    }
    case 'regla': {
      const pool = bank.filter(q => q.category === chapters.track_categories.reglamentacion);
      // Leitner: caja baja primero; dentro de caja, lo menos visto
      const scored = pool.map(q => ({ q, box: seen.get(`q:${q.id}`)?.box ?? 0 }));
      scored.sort((a, b) => a.box - b.box || rng() - 0.5);
      return scored.slice(0, config.tracks.reglamentacion_daily).map(s => s.q);
    }
    case 'srs': case 'srs_catchup': {
      const out = [];
      const due = block.source === 'srs_catchup' ? state.srsDue : state.srsDue.slice(0, 2);
      for (const d of due) {
        const cats = chapters.chapters.find(c => c.id === d.chapter)?.categories || [];
        const pool = bank.filter(q => cats.includes(q.category));
        const fresh = pool.filter(q => !seen.has(`q:${q.id}`));
        out.push(...shuffled(fresh.length ? fresh : pool).slice(0, 5).map(q => ({ ...q, _srsChapter: d.chapter })));
      }
      // re-preguntas espaciadas vencidas (§4.3b) entran aquí también
      for (const m of state.requeueDue) {
        const q = bank.find(b => b.id === m.qid);
        if (q) out.push(q);
      }
      const cap = block.cap || config.srs.review_questions_daily + state.requeueDue.length;
      return out.slice(0, cap);
    }
    case 'chart': {
      const pool = bank.filter(q => q.category === 'VUELO EN RUTA' && q.figures?.length);
      const unseen = pool.filter(q => !seen.has(`q:${q.id}`));
      const wrong = pool.filter(q => latestCorrect(q.id) === false);
      return shuffled([...unseen, ...wrong, ...pool]).filter((q, i, a) => a.indexOf(q) === i).slice(0, 8);
    }
    case 'errordeck': {
      const qids = state.errorDeck.filter(e => e.type === 'q').map(e => e.qid);
      return shuffled(qids.map(id => bank.find(q => q.id === id)).filter(Boolean)).slice(0, 15);
    }
    default: return [];
  }
}

/** Composición del simulacro (§5.5): 50 preguntas a proporción del banco (o pesos oficiales si existen). */
export function buildSimulacro(state, { bank, config, templates }, rng = Math.random) {
  const n = config.exam.questions;
  const weights = config.exam.category_weights; // null hasta confirmar con la escuela
  const byCat = new Map();
  for (const q of bank) {
    if (!byCat.has(q.category)) byCat.set(q.category, []);
    byCat.get(q.category).push(q);
  }
  const cats = [...byCat.keys()];
  const alloc = new Map();
  let allocated = 0;
  for (const c of cats) {
    const share = weights ? (weights[c] ?? 0) : byCat.get(c).length / bank.length;
    const k = Math.floor(n * share);
    alloc.set(c, k); allocated += k;
  }
  // reparte el resto a las categorías más grandes
  const rest = [...cats].sort((a, b) => byCat.get(b).length - byCat.get(a).length);
  for (let i = 0; allocated < n; i++, allocated++) alloc.set(rest[i % rest.length], alloc.get(rest[i % rest.length]) + 1);

  const items = [];
  for (const [cat, k] of alloc) {
    const pool = [...byCat.get(cat)].sort(() => rng() - 0.5);
    items.push(...pool.slice(0, k));
  }
  return items.sort(() => rng() - 0.5).slice(0, n);
}
