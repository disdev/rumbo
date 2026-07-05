// El hangar (SPEC §5.10): actividades opcionales para el tiempo que sobra —
// vuelos de simulador por el Perú, planificación de rutas, videos y lectura.
// Nunca son puertas ni tareas: son el lado divertido que construye piloto.
// Se desbloquean por semana para acompañar el material (y no adelantar caos).

import { el } from './players.js';

const TYPE_META = {
  sim: { icon: '🛩️', label: 'Simulador' },
  ruta: { icon: '🗺️', label: 'Planificación' },
  video: { icon: '🎬', label: 'Videos' },
  lectura: { icon: '📖', label: 'Lectura' },
};

let cache = null;
async function loadHangar() {
  if (!cache) {
    cache = fetch('data/hangar.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => { cache = null; return { actividades: [] }; });
  }
  return cache;
}

function doneSet(ctx) {
  return new Set((ctx.state.hangarDone || new Map()).keys());
}

export async function hangarView(root, ctx, onExit) {
  const data = await loadHangar();
  const week = ctx.state.week;

  function list() {
    const done = doneSet(ctx);
    const avail = data.actividades.filter(a => a.week_min <= week);
    const locked = data.actividades.filter(a => a.week_min > week);
    const row = (a, isLocked) => {
      const meta = TYPE_META[a.type] || TYPE_META.sim;
      return el('button', {
        class: `option plan-week${isLocked ? ' past' : ''}`,
        onclick: () => { if (!isLocked) detail(a); },
      },
        el('span', { class: 'plan-week-title' }, `${done.has(a.id) ? '✅ ' : ''}${meta.icon} ${a.title}${isLocked ? ` 🔒 (semana ${a.week_min})` : ''}`),
        el('span', { class: 'plan-week-sub' }, `${meta.label} · ${a.duration}`));
    };
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, '🛩️ El hangar'),
      el('p', { class: 'note' }, '¿Terminaste temprano? Esto no es tarea — es lo divertido: volar el Perú en simulador, planificar rutas de verdad, ver videos. Cualquier simulador sirve: MSFS, X-Plane, FlightGear (gratis) o GeoFS (en el navegador, gratis).'),
      ...avail.map(a => row(a, false)),
      ...(locked.length ? [el('h4', { class: 'section-title' }, 'Se desbloquean con el plan'), ...locked.map(a => row(a, true))] : []),
      el('button', { class: 'ghost', onclick: onExit }, 'Volver')));
  }

  function detail(a) {
    const meta = TYPE_META[a.type] || TYPE_META.sim;
    const done = doneSet(ctx).has(a.id);
    root.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'lesson-kicker' }, `${meta.icon} ${meta.label} · ${a.duration} · desde semana ${a.week_min}`),
      el('h3', {}, a.title),
      el('p', {}, a.desc),
      el('h4', { class: 'section-title' }, 'Briefing'),
      el('ul', { class: 'checklist' }, ...a.briefing.map(b => el('li', {}, b))),
      done
        ? el('p', { class: 'note center' }, '✅ Ya la hiciste — repetirla también vale.')
        : '',
      el('button', {
        class: 'primary', onclick: () => {
          ctx.append({ kind: 'block', detail: { type: 'hangar', activity_id: a.id, activity_type: a.type } });
          ctx.refresh();
          list();
        },
      }, done ? 'La hice otra vez ✓' : 'La hice ✓'),
      el('button', { class: 'ghost', onclick: list }, '← Todas las actividades')));
  }

  list();
}
