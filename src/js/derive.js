// Estado derivado por replay puro del log de eventos (SPEC §8).
// derive(log, data, todayKey) es determinista: reconstruir = reproducir.
// Lo usan la app del estudiante y el dashboard del mentor por igual.

const LIMA_OFFSET_MS = 5 * 3600e3; // America/Lima: UTC−5, sin horario de verano

export function dayKey(ts) {
  return new Date(ts - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}
export function weekday(key) { // 0=domingo … 6=sábado
  return new Date(key + 'T00:00:00Z').getUTCDay();
}
export function addDays(key, n) {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
}

/** Próximo día de estudio (lun–sáb) a ≥n días de distancia. Nunca domingo (SPEC §4.3). */
export function nextStudyDay(fromKey, minDays, studyDays) {
  let k = addDays(fromKey, minDays);
  while (!studyDays.includes(weekday(k))) k = addDays(k, 1);
  return k;
}

export function derive(log, { config, chapters, bank }, todayKey) {
  const rows = [...log].sort((a, b) => a.ts - b.ts);
  const studyDays = config.schedule.study_days;
  const qMeta = new Map(bank.map(q => [q.id, q]));
  const catToChapter = new Map();
  for (const ch of chapters.chapters) for (const c of ch.categories) {
    if (!catToChapter.has(c)) catToChapter.set(c, []);
    catToChapter.get(c).push(ch.id);
  }

  // ---- acumuladores ----
  const ladder = {}; // family → {passedTier, attempts:[{date,tier,score,passed}], failedToday, retryUsedToday}
  const item = new Map(); // clave q:<id> | m:<fam>:<tier> → {box, misses, lastDays:[{day,correct}], inDeck, deckSince}
  const chapterState = new Map(); // id → {read, recallChars, recalled, latest:Map(qid→correct), closedDay, srsIdx, srsLast}
  for (const ch of chapters.chapters) chapterState.set(ch.id, { read: false, recalled: false, latest: new Map(), closedDay: null, srsIdx: 0, srsLast: null });
  const lessons = new Map(); // chapter → {sectionsSeen, completed, checks:{n,ok}, notebooks:Set, secondsBySection}
  const getLesson = (ch) => {
    if (!lessons.has(ch)) lessons.set(ch, { sectionsSeen: new Set(), completed: false, checks: { n: 0, ok: 0 }, notebooks: new Set(), secondsBySection: new Map() });
    return lessons.get(ch);
  };
  const mathSeen = new Set(); // 'fam:tier' — ya hubo CUALQUIER drill (guiada cuenta como primera exposición)
  const mathReps = {}; // family → {lifetime, streak}
  const famMaint = new Map(); // family → {lastDrillDay, maintCount}
  let notebooksTotal = 0;
  let rapidfireBest = 0;
  let everInDeck = false;
  const missQueue = []; // {qid, available (dayKey)}
  const redoByDay = new Map(); // day → [{qid|prob}]
  const activity = new Map(); // day → {math, regla, fraseo, sessionsEnded:Set, minimo, any}
  const simulacros = [];
  const feedbackByEntry = new Map();
  const skips = [];
  const recalls = [];
  const scenarios = [];
  const teachbacks = [];
  const distractorExplains = [];
  let listoAtFinal = null;

  const getItem = (key) => {
    if (!item.has(key)) item.set(key, { box: 1, misses: 0, lastDays: [], inDeck: false, simMiss: false });
    return item.get(key);
  };

  function deckCheck(st) {
    // entra: miss en simulacro (inmediato) o 2 misses en trabajo diario (SPEC §5.6)
    if (!st.inDeck && (st.simMiss || st.misses >= (config.error_deck.daily_miss_threshold))) { st.inDeck = true; everInDeck = true; }
    // sale: 2 correctas consecutivas en días distintos
    if (st.inDeck) {
      const n = config.error_deck.exit_consecutive_correct;
      const last = st.lastDays.slice(-n);
      if (last.length === n && last.every(x => x.correct) && new Set(last.map(x => x.day)).size === n) {
        st.inDeck = false; st.misses = 0; st.simMiss = false;
      }
    }
  }

  function recordAnswer(key, day, correct, { simulacro = false } = {}) {
    const st = getItem(key);
    if (correct) st.box = Math.min(5, st.box + 1);
    else {
      st.box = 1;
      if (simulacro) st.simMiss = true; else st.misses++;
    }
    const prev = st.lastDays[st.lastDays.length - 1];
    if (prev && prev.day === day) prev.correct = prev.correct && correct;
    else st.lastDays.push({ day, correct });
    if (st.lastDays.length > 10) st.lastDays.shift();
    deckCheck(st);
  }

  const deckSize = () => [...item.values()].filter(s => s.inDeck).length;

  // ---- replay ----
  for (const r of rows) {
    const day = dayKey(r.ts);
    const detail = r.detail || {};
    if (!activity.has(day)) activity.set(day, { math: false, regla: false, fraseo: false, sessionsEnded: new Set(), minimo: false, any: false });
    const act = activity.get(day);
    if (r.kind !== 'feedback') act.any = true;

    switch (r.kind) {
      case 'drill': {
        act.math = true;
        const fam = r.family;
        if (!ladder[fam]) ladder[fam] = { passedTier: 0, attempts: [] };
        const L = ladder[fam];
        const passed = r.score >= config.math.advance_score;
        // reps y racha por familia: todo problema resuelto cuenta (SPEC §5.2),
        // en cualquier modo — guiada no trae items (son pasos, no problemas)
        mathSeen.add(`${fam}:${r.tier}`);
        if (!mathReps[fam]) mathReps[fam] = { lifetime: 0, streak: 0 };
        for (const it of detail.items || []) {
          mathReps[fam].lifetime++;
          mathReps[fam].streak = it.correct ? mathReps[fam].streak + 1 : 0;
        }
        if (!famMaint.has(fam)) famMaint.set(fam, { lastDrillDay: day, maintCount: 0 });
        const fm = famMaint.get(fam);
        fm.lastDrillDay = day;
        if (detail.mode === 'maintenance') fm.maintCount++;
        if (detail.mode) break; // guiada/practica/maintenance jamás tocan el ladder (§5.2)
        if (!detail.preview && !detail.errordeck) {
          L.attempts.push({ day, tier: r.tier, score: r.score, passed });
          if (passed && r.tier === L.passedTier + 1) L.passedTier = r.tier;
          for (const it of detail.items || []) {
            if (!it.correct) recordAnswer(`m:${fam}:${r.tier}`, day, false);
          }
          if (r.score === r.total) recordAnswer(`m:${fam}:${r.tier}`, day, true);
        }
        if (detail.errordeck) {
          recordAnswer(`m:${fam}:${r.tier}`, day, r.score === r.total);
        }
        break;
      }
      case 'quiz': case 'redo': {
        if (r.category === chapters.track_categories.reglamentacion) act.regla = true;
        for (const it of detail.items || []) {
          const q = qMeta.get(it.qid);
          if (!q) continue;
          recordAnswer(`q:${it.qid}`, day, !!it.correct);
          const chs = catToChapter.get(q.category) || [];
          const chId = detail.chapter || chs[0];
          if (chId && chapterState.has(chId)) chapterState.get(chId).latest.set(it.qid, !!it.correct);
          if (r.kind === 'quiz' && !it.correct) {
            missQueue.push({ qid: it.qid, available: nextStudyDay(day, config.requeue_min_days, studyDays) });
            if (!redoByDay.has(day)) redoByDay.set(day, []);
            redoByDay.get(day).push(it.qid);
          }
        }
        if (detail.srs && detail.chapter && chapterState.has(detail.chapter)) {
          const cs = chapterState.get(detail.chapter);
          cs.srsIdx = Math.min(cs.srsIdx + 1, config.srs.intervals_days.length);
          cs.srsLast = day;
        }
        break;
      }
      case 'rapidfire': {
        act.fraseo = true;
        rapidfireBest = Math.max(rapidfireBest, detail.best_streak || 0);
        for (const it of detail.items || []) recordAnswer(`q:${it.qid}`, day, !!it.correct);
        break;
      }
      case 'recall': {
        recalls.push(r);
        const cs = chapterState.get(r.chapter);
        if (cs && (detail.chars || 0) >= config.recall.min_chars) cs.recalled = true;
        break;
      }
      case 'scenario': scenarios.push(r); break;
      case 'distractor_explain': distractorExplains.push(r); break;
      case 'block': {
        if (detail.type === 'lectura' && detail.chapter && chapterState.has(detail.chapter)) chapterState.get(detail.chapter).read = true;
        if (detail.type === 'session_end') { act.sessionsEnded.add(detail.session); if (detail.minimo) act.minimo = true; }
        if (detail.type === 'teachback') teachbacks.push(r);
        if (detail.skipped) skips.push(r);
        break;
      }
      case 'simulacro': {
        const before = deckSize();
        for (const it of detail.items || []) {
          if (it.qid) recordAnswer(`q:${it.qid}`, day, !!it.correct, { simulacro: true });
          if (it.family) recordAnswer(`m:${it.family}:${it.tier || 2}`, day, !!it.correct, { simulacro: true });
        }
        simulacros.push({ ts: r.ts, day, score: r.score, total: r.total, pct: Math.round(100 * r.score / r.total), byCategory: detail.by_category || {}, deckEmptyBefore: before === 0 });
        break;
      }
      case 'feedback': {
        if (detail.entry_id) feedbackByEntry.set(detail.entry_id, detail.feedback);
        break;
      }
      case 'lesson_progress': {
        if (!r.chapter) break;
        const Ls = getLesson(r.chapter);
        if (detail.section) {
          Ls.sectionsSeen.add(detail.section);
          Ls.secondsBySection.set(detail.section, (Ls.secondsBySection.get(detail.section) || 0) + (detail.seconds || 0));
        }
        if (detail.completed) {
          Ls.completed = true;
          const cs = chapterState.get(r.chapter);
          if (cs) cs.read = true; // la lección ES la lectura (§4.3)
        }
        break;
      }
      case 'lesson_check': {
        if (!r.chapter) break;
        const Ls = getLesson(r.chapter);
        Ls.checks.n++;
        if (detail.correct) Ls.checks.ok++;
        break;
      }
      case 'notebook': {
        notebooksTotal++;
        if (r.chapter) getLesson(r.chapter).notebooks.add(detail.prompt_id);
        break;
      }
    }

    // cierre de capítulo (evaluado tras cada fila que pueda afectarlo)
    if (['quiz', 'redo', 'recall', 'block', 'lesson_progress'].includes(r.kind)) {
      const chId = r.chapter || detail.chapter;
      const cs = chapterState.get(chId);
      if (cs && !cs.closedDay && cs.read && cs.recalled && cs.latest.size > 0) {
        const correct = [...cs.latest.values()].filter(Boolean).length;
        const pct = 100 * correct / cs.latest.size;
        // el pool de una categoría se reparte entre los capítulos que la comparten
        // (p. ej. Aerodinámica cubre los cap. 3–6): la cuota esperada es proporcional
        const chQs = bank.filter(q => (catToChapter.get(q.category) || []).includes(chId));
        const shared = Math.max(1, ...chQs.map(q => (catToChapter.get(q.category) || [chId]).length));
        const expected = chQs.length / shared;
        const coverage = expected ? cs.latest.size / expected : 1;
        if (pct >= config.gates.chapter_close_pct && coverage >= 0.9) cs.closedDay = day;
      }
    }
  }

  // ---- clasificación de días ----
  const dayLog = new Map(); // day → completo|minimo|parcial|perdido
  const firstDay = rows.length ? dayKey(rows[0].ts) : todayKey;
  for (let k = firstDay; k <= todayKey; k = addDays(k, 1)) {
    if (!studyDays.includes(weekday(k))) continue;
    const act = activity.get(k);
    if (!act || !act.any) { dayLog.set(k, 'perdido'); continue; }
    if (act.sessionsEnded.size >= 3) dayLog.set(k, 'completo');
    else if (act.minimo) dayLog.set(k, 'minimo');
    else dayLog.set(k, 'parcial');
  }

  // ---- rachas (por pista y global) ----
  function streak(pred) {
    let n = 0, k = todayKey;
    if (!studyDays.includes(weekday(k)) || !pred(k)) {
      // hoy aún puede estar en curso: la racha se mide hasta ayer si hoy no cuenta todavía
      k = addDays(k, -1);
    }
    for (; ; k = addDays(k, -1)) {
      if (!studyDays.includes(weekday(k))) continue;
      if (daysBetween(firstDay, k) < 0) break;
      if (pred(k)) n++; else break;
    }
    return n;
  }
  const streaks = {
    math: streak(k => activity.get(k)?.math),
    regla: streak(k => activity.get(k)?.regla),
    fraseo: streak(k => activity.get(k)?.fraseo),
    overall: streak(k => ['completo', 'minimo', 'parcial'].includes(dayLog.get(k))),
  };

  // ---- semana del programa (los días con actividad avanzan el calendario: §4.6) ----
  const activityDays = [...dayLog.values()].filter(v => v !== 'perdido').length;
  const week = Math.min(8, Math.floor(activityDays / 6) + 1);

  // ---- reanudación ----
  let missedRun = 0;
  for (let k = addDays(todayKey, -1); daysBetween(firstDay, k) >= 0; k = addDays(k, -1)) {
    if (!studyDays.includes(weekday(k))) continue;
    if (dayLog.get(k) === 'perdido') missedRun++; else break;
  }
  const reanudacion = missedRun >= config.reanudacion.missed_days_trigger && !activity.get(todayKey)?.any;

  // ---- puertas ----
  const familiesAtN2 = Object.values(ladder).filter(l => l.passedTier >= 2).length;
  const week6Unlocked = familiesAtN2 >= config.gates.week6_families_at_nivel2;
  const lastSim = simulacros[simulacros.length - 1] || null;
  const listo = !!(lastSim && lastSim.pct >= config.gates.listo_simulacro_pct && lastSim.deckEmptyBefore);

  // ---- mantenimiento de matemática (§5.2): niveles superados nunca se jubilan ----
  const mathMaintenanceDue = [];
  const mIntervals = config.math.maintenance_intervals_days || [1, 3, 7, 14];
  for (const [fam, L] of Object.entries(ladder)) {
    if (!L.passedTier) continue;
    const fm = famMaint.get(fam);
    if (!fm) continue;
    const idx = Math.min(fm.maintCount, mIntervals.length - 1);
    const due = addDays(fm.lastDrillDay, mIntervals[idx]);
    if (due <= todayKey) mathMaintenanceDue.push({ family: fam, tier: L.passedTier });
  }

  // ---- SRS de conceptos: capítulos cerrados con repaso vencido ----
  const srsDue = [];
  for (const [id, cs] of chapterState) {
    if (!cs.closedDay || cs.srsIdx >= config.srs.intervals_days.length) continue;
    const base = cs.srsLast || cs.closedDay;
    const due = addDays(base, config.srs.intervals_days[cs.srsIdx]);
    const chQs = bank.filter(q => (catToChapter.get(q.category) || []).includes(id));
    if (due <= todayKey && chQs.length > 0) srsDue.push({ chapter: id, due });
  }

  // ---- deck y colas listas para consumo ----
  const errorDeck = [...item.entries()].filter(([, s]) => s.inDeck).map(([key, s]) => {
    const [type, a, b] = key.split(':');
    return type === 'q' ? { type: 'q', qid: a, box: s.box } : { type: 'math', family: a, tier: Number(b) };
  });
  const dueRequeues = missQueue.filter(m => m.available <= todayKey);
  const answeredAfter = new Set(); // saca de la cola lo ya re-preguntado correcto tras su fecha
  const requeueDue = dueRequeues.filter(m => {
    const st = item.get(`q:${m.qid}`);
    const last = st?.lastDays[st.lastDays.length - 1];
    return !(last && last.day >= m.available && last.correct);
  }).filter(m => { const k = m.qid; if (answeredAfter.has(k)) return false; answeredAfter.add(k); return true; });

  return {
    todayKey, week, dayLog, streaks, reanudacion, missedRun,
    ladder, familiesAtN2, week6Unlocked, listo, lastSim, simulacros,
    lessons, mathSeen, mathReps, mathMaintenanceDue, notebooksTotal, rapidfireBest, everInDeck,
    chapterState, catToChapter, srsDue, errorDeck,
    requeueDue, redoToday: redoByDay.get(todayKey) || [],
    itemStats: item, feedbackByEntry,
    recalls, scenarios, teachbacks, distractorExplains, skips,
    activityToday: activity.get(todayKey) || { sessionsEnded: new Set() },
  };
}
