// Arranque y pantalla de inicio. Un botón, cero decisiones (SPEC §2).

import { initStore, getLog, append as rawAppend } from './store.js';
import { derive, dayKey, weekday } from './derive.js';
import { planDay } from './planner.js';
import { initSync, flush, relogin, requestFeedback, restoreProgress } from './sync.js';
import { runSession, loadCursor } from './session.js';
import { el, fmtTime, flashCelebrate } from './players.js';
import { FAMILY_IDS } from './mathgen.js';
import { lessonList } from './lessons.js';
import { earnedBadges } from './badges.js';

const app = document.getElementById('app');
const banner = document.getElementById('sync-banner');

let data = null; // {config, chapters, bank, templates, scenarios}
let state = null;

const FAMILY_LABELS = {
  carga: 'Factor de carga', altimetro: 'Altímetro', nubes: 'Base de nubes',
  altitudes: 'PA / DA', peso_balance: 'Peso y balance', tvd: 'Tiempo-vel-dist',
};

function todayKey() { return dayKey(Date.now()); }
function limaHHMM() { return new Date(Date.now() - 5 * 3600e3).toISOString().slice(11, 16); }

function refresh() {
  state = derive(getLog(), data, todayKey());
  return state;
}

function append(ev) {
  // Logro nuevo = diferencia del set derivado antes/después del append (§5.9):
  // la celebración llega EN el momento, no recién al volver al inicio.
  const before = state ? new Set(earnedBadges(state).map(b => b.id)) : new Set();
  const row = rawAppend(ev, data.config.content_version);
  flush();
  refresh();
  for (const b of earnedBadges(state)) {
    if (!before.has(b.id)) flashCelebrate(app, `🎉 ¡Logro! ${b.emoji} ${b.title}`);
  }
  return row;
}

const ctx = {
  get state() { return state; },
  get data() { return data; },
  get todayKey() { return todayKey(); },
  append, refresh, requestFeedback,
};

async function boot() {
  const [config, chapters, bank, templates, scenarios] = await Promise.all(
    ['config', 'chapters', 'bank', 'math-templates', 'scenarios'].map(f =>
      fetch(`data/${f}.json`).then(r => r.json())));
  data = { config, chapters, bank, templates, scenarios };
  initStore();
  refresh();
  initSync(renderBanner);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data === 'precache-done') document.getElementById('offline-dot')?.classList.add('ready');
    });
  }
  renderHome();
}

function renderBanner(status) {
  if (status.state === 'expired') {
    banner.replaceChildren(
      el('span', {}, '🔐 La sesión expiró — tus resultados están guardados aquí, pero el mentor no los ve.'),
      el('button', { onclick: relogin }, 'Iniciar sesión para sincronizar'));
    banner.className = 'banner expired';
  } else if (status.state === 'offline' && status.pending > 0) {
    banner.replaceChildren(el('span', {}, `📴 Sin conexión — ${status.pending} resultado(s) en cola. Se subirán solos.`));
    banner.className = 'banner offline';
  } else {
    banner.replaceChildren();
    banner.className = 'banner hidden';
  }
}

function trackerGrid() {
  // La cuadrícula 6×3 siempre visible: el ancla de progreso (SPEC §5.2)
  const grid = el('div', { class: 'tracker' });
  for (const f of FAMILY_IDS) {
    const passed = state.ladder[f]?.passedTier ?? 0;
    const reps = state.mathReps[f];
    grid.append(el('div', { class: 'tracker-row' },
      el('span', { class: 'tracker-label' }, FAMILY_LABELS[f],
        // reps visibles (§5.2): la evidencia del músculo acumulado
        reps ? el('span', { class: 'tracker-reps' }, `${reps.lifetime} problema${reps.lifetime === 1 ? '' : 's'}${reps.streak >= 3 ? ` · racha ${reps.streak}🔥` : ''}`) : ''),
      ...[1, 2, 3].map(t => el('span', { class: `cell ${t <= passed ? 'done' : t === passed + 1 ? 'next' : ''}` }, String(t)))));
  }
  return grid;
}

const BADGES_SEEN_KEY = 'rumbo_badges_seen_v1';

function badgeShelf() {
  // Logros (§5.9): derivados del log; "nuevo" = no estaba en lo último visto
  const earned = earnedBadges(state);
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(BADGES_SEEN_KEY)) || []; } catch {}
  const fresh = earned.filter(b => !seen.includes(b.id));
  localStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(earned.map(b => b.id)));

  const nodes = [];
  for (const b of fresh) {
    nodes.push(el('div', { class: 'badge-new' }, `🎉 ¡Nuevo logro! ${b.emoji} ${b.title} — ${b.desc}`));
  }
  if (earned.length) {
    nodes.push(el('h4', { class: 'section-title' }, `Logros · ${earned.length}`));
    nodes.push(el('div', { class: 'badge-shelf' },
      ...earned.map(b => el('span', { class: 'badge-chip', title: `${b.title}: ${b.desc}` }, `${b.emoji} ${b.title}`))));
  }
  return nodes;
}

function streakChips() {
  const s = state.streaks;
  const chip = (label, n) => el('span', { class: `chip ${n === 0 ? 'cold' : ''}` }, `${label} ${n}${n > 0 ? '🔥' : ''}`);
  return el('div', { class: 'chips' },
    chip('Días', s.overall), chip('Mate', s.math), chip('Regla', s.regla), chip('Fraseo', s.fraseo));
}

function renderHome() {
  refresh();
  const wd = weekday(todayKey());
  const cursor = loadCursor(todayKey());
  const plan = planDay(state, data, limaHHMM(), cursor.dayType || null);
  const wk = data.chapters.weeks.find(w => w.week === state.week);
  const dayType = state.dayLog.get(todayKey());
  const sessionsDone = state.activityToday.sessionsEnded?.size || 0;

  const nodes = [
    el('header', { class: 'home-header' },
      el('h1', {}, 'Rumbo ✈️'),
      el('div', { class: 'week-line' }, `Semana ${state.week} · ${wk?.theme || 'Integración'}`),
      streakChips()),
  ];

  if (state.listo) nodes.push(el('div', { class: 'badge-listo' }, '🏅 LISTO PARA EL EXAMEN'));

  if (plan.dayType === 'domingo') {
    nodes.push(el('div', { class: 'card center' },
      el('h3', {}, '☀️ Domingo'),
      el('p', {}, 'Día de descanso y revisión con tu mentor. Nada de estudiar — el descanso también es parte del plan.')));
  } else if (dayType === 'completo' || sessionsDone >= plan.sessions.length) {
    nodes.push(el('div', { class: 'card center' }, el('h3', {}, '✅ Día completo'), el('p', {}, 'Ya está. Nos vemos mañana a las 8:00.')));
  } else {
    const label = plan.dayType === 'minimo' ? 'Comenzar día mínimo'
      : plan.dayType === 'reanudacion' ? 'Reanudar — día ligero'
      : sessionsDone > 0 || state.activityToday.any ? 'Continuar sesión de hoy' : 'Comenzar sesión de hoy';
    if (plan.dayType === 'reanudacion') nodes.push(el('p', { class: 'note center' }, `Pasaron ${state.missedRun} días sin sesión — no pasa nada, la vida pasa. Hoy es un día ligero para retomar el ritmo.`));
    nodes.push(el('button', { class: 'start-btn', onclick: () => start(plan) }, label));
  }

  nodes.push(...badgeShelf());
  nodes.push(el('h4', { class: 'section-title' }, 'Escalera de matemática'), trackerGrid());
  nodes.push(el('button', { class: 'ghost', onclick: () => lessonList(app, ctx, renderHome) }, '📚 Repasar lecciones'));

  if (state.errorDeck.length) nodes.push(el('p', { class: 'note center' }, `Mazo de errores: ${state.errorDeck.length} pendiente(s)`));
  nodes.push(el('footer', { class: 'home-footer' },
    el('span', { id: 'offline-dot', class: 'offline-dot', title: 'listo sin conexión' }, '●'),
    el('a', { href: '#', onclick: (e) => { e.preventDefault(); doRestore(); } }, 'Restaurar progreso')));

  app.replaceChildren(el('div', { class: 'home' }, ...nodes));
}

function start(plan) {
  runSession(app, plan, ctx, renderHome);
}

async function doRestore() {
  if (!confirm('¿Reconstruir el progreso local desde el servidor? Úsalo al cambiar de dispositivo.')) return;
  app.replaceChildren(el('div', { class: 'card center' }, el('p', {}, 'Restaurando…')));
  try {
    await restoreProgress();
    refresh();
    renderHome();
  } catch {
    alert('No se pudo restaurar (¿sin conexión o sesión vencida?). Intenta de nuevo con internet.');
    renderHome();
  }
}

boot();
