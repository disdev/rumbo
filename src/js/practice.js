// Practicar a demanda (SPEC §5.3/§5.5): simulacro completo o quiz por categoría,
// disponible en cualquier momento desde el home — como fraseología rápida, pero
// para el banco y el examen completo. No inventa estado nuevo: cada pregunta
// pasa por quizPlayer/simulacroPlayer y queda en el log inmutable de siempre.

import { el, quizPlayer, simulacroPlayer } from './players.js';

const CATEGORY_ICONS = {
  'AERODINÁMICA BÁSICA': '🛫',
  'INSTRUMENTOS DE VUELO': '🧭',
  'METEOROLOGÍA': '⛅',
  'NAVEGACIÓN': '🗺️',
  'PERFORMANCE': '📊',
  'PROCEDIMIENTOS DE COMUNICACIÓN': '📻',
  'PROCEDIMIENTOS Y OPERACIONES': '📋',
  'REGLAMENTACIÓN': '📜',
  'SERVICIO METEOROLÓGICO': '🌦️',
  'SISTEMAS DE AERONAVES': '⚙️',
  'VUELO EN RUTA': '🛩️',
  'FRASEOLOGIA AERONAUTICA': '🎧',
};

const LENGTHS = [10, 20, 30];

function categories(bank) {
  return [...new Set(bank.map(q => q.category))].sort();
}

export async function practiceView(root, ctx, onExit) {
  function menu() {
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, '🎯 Practicar'),
      el('p', { class: 'note' }, 'Fuera del plan de hoy — para reforzar cuando quieras, sin esperar al simulacro programado.'),
      el('button', { class: 'option', onclick: runSimulacro }, el('span', { class: 'plan-week-title' }, '📝 Simulacro completo'), el('span', { class: 'plan-week-sub' }, `${ctx.data.config.exam.questions} preguntas · ${ctx.data.config.exam.minutes} min · sin calculadora`)),
      el('button', { class: 'option', onclick: pickCategory }, el('span', { class: 'plan-week-title' }, '📚 Quiz por tema'), el('span', { class: 'plan-week-sub' }, 'Elige categoría y cantidad — con retroalimentación al toque')),
      el('button', { class: 'ghost', onclick: onExit }, 'Volver')));
  }

  function pickCategory() {
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, '📚 Quiz por tema'),
      ...categories(ctx.data.bank).map(cat => el('button', {
        class: 'option', onclick: () => pickLength(cat),
      }, `${CATEGORY_ICONS[cat] || '📄'} ${cat}`)),
      el('button', { class: 'ghost', onclick: menu }, '← Volver')));
  }

  function pickLength(category) {
    root.replaceChildren(el('div', { class: 'card center' },
      el('h3', {}, category),
      el('p', { class: 'note' }, '¿Cuántas preguntas?'),
      ...LENGTHS.map(n => el('button', { class: 'option', onclick: () => runQuiz(category, n) }, `${n} preguntas`)),
      el('button', { class: 'ghost', onclick: pickCategory }, '← Volver')));
  }

  async function runQuiz(category, cap) {
    await quizPlayer(root, { type: 'quiz', source: 'category', category, cap }, ctx);
    ctx.refresh();
    menu();
  }

  async function runSimulacro() {
    await simulacroPlayer(root, { type: 'simulacro', which: 'practica' }, ctx);
    ctx.refresh();
    onExit();
  }

  menu();
}
