// Línea de tiempo de actividad para el dashboard del mentor (spec 2026-07-06).
// Puro y sin DOM: agrupa filas del log en días → sesiones (cortadas por huecos
// de inactividad) → entradas legibles. Solo lo usa /progreso — no va en el
// precache del app del estudiante.

import { dayKey } from './derive.js';

const SCREEN_LABELS = {
  inicio: 'Pantalla de inicio',
  leccion: 'Lección',
  'leccion-checks': 'Checks de lección',
  bloque: 'Bloque',
  hangar: 'Hangar',
  plan: 'Plan de 8 semanas',
  repaso: 'Repaso de lecciones',
};

function navLabel(r) {
  const d = r.detail || {};
  const base = SCREEN_LABELS[d.screen] || d.screen || '?';
  const where = [d.type, r.chapter && `cap. ${r.chapter}`, d.section && `§${d.section}`].filter(Boolean).join(' ');
  return where ? `${base} ${where}` : base;
}

/** Una fila del log → {icon, label} legible, o null si no se muestra. */
function entryFor(r) {
  const d = r.detail || {};
  switch (r.kind) {
    case 'nav':
      if (d.action !== 'enter') return null; // los leave cierran presencia, no son entradas
      return { icon: '👁️', label: navLabel(r) };
    case 'lesson_progress': {
      const min = Math.max(1, Math.round((d.seconds || 0) / 60));
      const bits = [`Lección cap. ${r.chapter} §${d.section}`, `${min} min`];
      if (d.completed) bits.push('lección completa ✅');
      if (d.review) bits.push('repaso');
      return { icon: '📖', label: bits.join(' · ') };
    }
    case 'lesson_check': // se colapsan aparte (collapseChecks)
      return { icon: '🧠', label: `Checks §${d.section}`, _check: { section: d.section, correct: !!d.correct } };
    case 'notebook':
      return { icon: '📓', label: `Cuaderno ${d.section ? `§${d.section}` : d.prompt_id || ''}` };
    case 'drill':
      return { icon: '🧮', label: `Drill ${r.family} t${r.tier ?? '?'} · ${r.score}/${r.total}${d.mode ? ` (${d.mode})` : ''}` };
    case 'quiz':
    case 'redo':
      return { icon: '❓', label: `${r.kind === 'redo' ? 'Redo' : 'Quiz'} ${r.category || `cap. ${r.chapter}` || ''} · ${r.score}/${r.total}` };
    case 'rapidfire':
      return { icon: '🎧', label: `Fraseología · ${r.score}/${r.total}` };
    case 'recall':
      return { icon: '✍️', label: `Recall cap. ${r.chapter} · ${d.chars || 0} caracteres` };
    case 'scenario':
      return { icon: '🛩️', label: `Escenario ${d.scenario_id || ''}` };
    case 'simulacro':
      return { icon: '🎯', label: `Simulacro · ${r.score}/${r.total}` };
    case 'block': {
      if (d.type === 'session_end') return { icon: '🏁', label: `Fin de sesión ${d.session ?? ''}` };
      if (d.type === 'checkin') return { icon: '🤝', label: 'Check-in dominical' };
      if (d.reason) return { icon: '⏭️', label: `Saltó ${d.type} — «${d.reason}»` };
      return { icon: '✅', label: `Bloque ${d.type || ''}${d.chapter ? ` cap. ${d.chapter}` : ''}` };
    }
    default:
      return null; // feedback y kinds futuros: invisibles
  }
}

/** Colapsa lesson_checks consecutivos de la misma sección en «ok/n». */
function collapseChecks(entries) {
  const out = [];
  for (const e of entries) {
    const prev = out[out.length - 1];
    if (e._check && prev?._check && prev._check.section === e._check.section) {
      prev._check.n++;
      prev._check.ok += e._check.correct ? 1 : 0;
    } else if (e._check) {
      out.push({ ...e, _check: { section: e._check.section, n: 1, ok: e._check.correct ? 1 : 0 } });
    } else {
      out.push(e);
    }
  }
  for (const e of out) {
    if (e._check) {
      e.label = `Checks §${e._check.section} · ${e._check.ok}/${e._check.n}`;
      delete e._check;
    }
  }
  return out;
}

/** Marca entradas de sección de lección abiertas sin lesson_progress posterior. */
function flagAbandoned(sessionRows, entries) {
  const finished = new Set(sessionRows.filter(r => r.kind === 'lesson_progress').map(r => r.detail?.section));
  for (const e of entries) {
    if (e._navSection && !finished.has(e._navSection)) e.abandoned = true;
    delete e._navSection;
  }
}

/**
 * @param {object[]} rows filas del log (detail ya parseado)
 * @returns [{day, sessions: [{start, end, minutes, entries: [{ts, icon, label, abandoned?}]}]}] — reciente primero
 */
export function buildTimeline(rows, { gapMinutes = 25 } = {}) {
  const sorted = [...rows].sort((a, b) => a.ts - b.ts);
  // sesiones: corta donde el hueco supera gapMinutes
  const sessions = [];
  for (const r of sorted) {
    const cur = sessions[sessions.length - 1];
    if (!cur || r.ts - cur.rows[cur.rows.length - 1].ts > gapMinutes * 60_000) {
      sessions.push({ rows: [r] });
    } else {
      cur.rows.push(r);
    }
  }
  const byDay = new Map();
  for (const s of sessions) {
    const raw = [];
    for (const r of s.rows) {
      const e = entryFor(r);
      if (!e) continue;
      e.ts = r.ts;
      if (r.kind === 'nav' && r.detail?.screen === 'leccion' && r.detail?.section) e._navSection = r.detail.section;
      raw.push(e);
    }
    const entries = collapseChecks(raw);
    flagAbandoned(s.rows, entries);
    if (!entries.length) continue;
    const start = s.rows[0].ts, end = s.rows[s.rows.length - 1].ts;
    const day = dayKey(start);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push({ start, end, minutes: Math.round((end - start) / 60_000), entries });
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, ss]) => ({ day, sessions: ss.sort((a, b) => a.start - b.start) }));
}

/** Última señal de vida: {ts, label} de la fila más reciente, o null. */
export function lastSeen(rows) {
  if (!rows.length) return null;
  const last = rows.reduce((a, b) => (b.ts > a.ts ? b : a));
  if (last.kind === 'nav' && last.detail?.action === 'leave') {
    return { ts: last.ts, label: `salió de la app (${navLabel(last)})` };
  }
  const e = entryFor(last);
  return { ts: last.ts, label: e ? e.label : last.kind };
}
