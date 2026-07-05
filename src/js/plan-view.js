// Vista del plan completo (SPEC §5.1): 8 semanas → días → detalle del día.
// Es una VISTA, no un selector: mirar el mapa no cambia la ruta — el botón
// de inicio sigue caminando el plan en orden (cero decisiones, §2).
// Ojo honesto: los días futuros son la PLANTILLA del día; los detalles finos
// (familia más débil, repasos vencidos, errores a rehacer) se deciden ese
// mismo día según el progreso real. Las puertas de dominio mandan sobre el
// calendario (§4.4): las 8 semanas son ritmo, no promesa.

import { el } from './players.js';

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const CATS_BY_WEEK = {
  1: 'Aerodinámica básica', 2: 'Sistemas + Instrumentos', 3: 'Performance',
  4: 'Meteorología + Servicios met.', 5: 'Procedimientos y operaciones',
  6: 'Navegación + Vuelo en ruta', 7: 'Preguntas restantes',
  8: 'Mazo de errores + familias débiles',
};

function specials(week, dia /* 1=lunes … 6=sábado */) {
  const out = [];
  if (week === 6 && dia === 6) out.push('🎓 Primer simulacro completo');
  if (week === 7 && (dia === 3 || dia === 6)) out.push('🎓 Simulacro de práctica');
  if (week === 8 && dia === 4) out.push('🏁 SIMULACRO FINAL');
  if (dia === 3 && week < 5) out.push('✍️ Vuelo de escritorio');
  return out;
}

/** Bloques-plantilla de un día (para días que no son hoy). */
function dayTemplate(week, dia) {
  const week8 = week >= 8;
  const chart = week >= 5;
  const sim = specials(week, dia).some(s => s.includes('imulacro') || s.includes('FINAL'));
  const s1 = [
    '🔢 Matemática: familia del día',
    week8 ? '🃏 Mazo de errores + repaso acumulado' : '📖 Lección del capítulo en curso',
    ...(week8 ? [] : ['🧠 Recuerdo libre (lección cerrada)', '❓ Preguntas de la sección']),
    '🔢 Matemática: tu familia más débil',
    '🔧 Mantenimiento de recetas (si toca)',
  ];
  const s2 = sim
    ? ['🎓 Simulacro: 50 preguntas · 90 min · sin calculadora']
    : [
      ...(week8 ? [] : ['❓ Más preguntas del capítulo']),
      '🔁 Repaso espaciado (10)',
      '⚖️ Reglamentación (8–10 preguntas)',
      chart ? '🗺️ Lectura de carta seccional' : (dia === 3 ? '✍️ Vuelo de escritorio' : null),
      '♻️ Rehacer los errores de hoy (con procedimiento)',
    ].filter(Boolean);
  const s3 = [
    '🎧 Fraseología: ráfaga (20–30)',
    '🗣️ Explícalo en voz alta (teach-back)',
    '🌙 Cierre: guion oral + lectura de mañana',
  ];
  return [
    { name: 'Sesión 1 · 8:00', blocks: s1 },
    { name: 'Sesión 2 · 12:00', blocks: s2 },
    { name: 'Sesión 3 · 4:30', blocks: s3 },
  ];
}

export function planView(root, ctx, onExit) {
  const { chapters } = ctx.data;
  const state = ctx.state;

  function chapterLabel(id) {
    const c = chapters.chapters.find(x => x.id === id);
    return c ? `cap. ${c.id} — ${c.title}` : `cap. ${id}`;
  }
  function chapterState(id) {
    const cs = state.chapterState.get(id);
    if (cs?.closedDay) return '✅';
    if (state.lessons.get(id)?.completed || cs?.read) return '📖';
    return '⬜';
  }

  // ---- nivel 1: las 8 semanas ----
  function showWeeks() {
    const rows = chapters.weeks.map(w => {
      const now = w.week === state.week;
      const past = w.week < state.week;
      const chapterMarks = w.chapters.length
        ? w.chapters.map(id => `${chapterState(id)} ${id}`).join('  ')
        : 'sin capítulos nuevos';
      return el('button', { class: `option plan-week${now ? ' now' : ''}${past ? ' past' : ''}`, onclick: () => showWeek(w) },
        el('span', { class: 'plan-week-title' }, `${now ? '▶️ ' : ''}Semana ${w.week} — ${w.theme}`),
        el('span', { class: 'plan-week-sub' }, `Capítulos: ${chapterMarks}`),
        el('span', { class: 'plan-week-sub' }, `Verificación: ${CATS_BY_WEEK[w.week]}`));
    });
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, '📅 El plan de 8 semanas'),
      el('p', { class: 'note' }, 'El mapa completo. El calendario es el ritmo por defecto: si un capítulo te toma más días, el plan se corre — las puertas de dominio mandan, no la fecha.'),
      ...rows,
      el('button', { class: 'ghost', onclick: onExit }, 'Volver')));
  }

  // ---- nivel 2: los días de una semana ----
  function showWeek(w) {
    const dayRows = DIAS.map((nombre, i) => {
      const dia = i + 1;
      const extra = specials(w.week, dia);
      const base = w.week >= 8
        ? 'Mazo de errores · repaso · tracks diarios'
        : 'Lección + recuerdo + preguntas · repasos · tracks diarios';
      return el('button', { class: 'option plan-day-row', onclick: () => showDay(w, dia, nombre) },
        el('span', { class: 'plan-week-title' }, `${nombre[0].toUpperCase() + nombre.slice(1)}`),
        el('span', { class: 'plan-week-sub' }, extra.length ? `${base} · ${extra.join(' · ')}` : base));
    });
    const chaptersList = w.chapters.length
      ? el('div', {},
        el('p', { class: 'note' }, 'Capítulos de la semana (en orden — avanzas al siguiente cuando cierras el anterior):'),
        ...w.chapters.map(id => el('p', { class: 'plan-item' }, `${chapterState(id)} ${chapterLabel(id)}`)))
      : el('p', { class: 'note' }, 'Semana de integración: nada nuevo — mazo de errores, familias débiles, guiones orales y el simulacro final.');
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, `Semana ${w.week} — ${w.theme}`),
      chaptersList,
      el('h4', { class: 'section-title' }, 'Los días (lun–sáb · domingo descansas)'),
      ...dayRows,
      el('button', { class: 'ghost', onclick: showWeeks }, '← Todas las semanas')));
  }

  // ---- nivel 3: el detalle de un día ----
  function showDay(w, dia, nombre) {
    const sessions = dayTemplate(w.week, dia);
    const nodes = [el('h3', {}, `Semana ${w.week} · ${nombre}`)];
    const extra = specials(w.week, dia);
    if (extra.length) nodes.push(el('p', { class: 'check-intro' }, extra.join(' · ')));
    for (const s of sessions) {
      nodes.push(el('p', { class: 'plan-session' }, s.name));
      for (const b of s.blocks) nodes.push(el('p', { class: 'plan-item' }, b));
    }
    nodes.push(el('p', { class: 'note' },
      'Esto es la plantilla del día. Los detalles finos — qué familia de matemática te toca, qué repasos vencieron, qué errores rehaces — los decide la app ese mismo día según tu progreso real. Por eso el inicio es un solo botón.'));
    nodes.push(el('button', { class: 'ghost', onclick: () => showWeek(w) }, `← Semana ${w.week}`));
    root.replaceChildren(el('div', { class: 'card' }, ...nodes));
  }

  showWeeks();
}
