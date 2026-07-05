// Resolución guiada (SPEC §5.2): un problema generado, paso a paso — el
// estudiante ESCRIBE cada valor intermedio y recibe verificación inmediata.
// Nunca puntúa, nunca bloquea: enseña. También la práctica inmediata: misma
// receta, números nuevos, justo después del ejemplo.

import { generateProblem, checkAnswer } from './mathgen.js';
import { uuid } from './store.js';
import { el, fmtTime } from './players.js';

/**
 * Camina un problema paso a paso con entradas del estudiante.
 * Resuelve con {stepsCorrect, stepsTotal} al terminar. No registra filas:
 * el que llama decide cómo loguear (drill mode guiada / bloque de lección).
 */
export function guidedExample(root, prob, ctx, { title = 'Ejemplo guiado' } = {}) {
  return new Promise(resolve => {
    let idx = 0, correct = 0;
    const done = [];
    const card = el('div', { class: 'card guided' });

    function renderStep() {
      const s = prob.steps[idx];
      const input = el('input', { class: 'math-input', inputmode: 'decimal', autocomplete: 'off', placeholder: s.unit ? `Valor (${s.unit})` : 'Valor' });
      const note = el('p', { class: 'note' });
      const btn = el('button', { class: 'primary', onclick: submit }, 'Comprobar paso');

      function submit() {
        if (!input.value.trim()) return;
        const ok = checkAnswer({ answer: s.value, tolerancePct: s.tolerancePct }, input.value, s.tolerancePct);
        if (ok) correct++;
        input.disabled = true; btn.remove();
        done.push({ label: s.label, value: s.value, unit: s.unit, ok });
        const reveal = el('div', { class: `reveal ${ok ? 'ok' : 'bad'}` },
          el('p', { class: 'reason' }, ok ? '✅ Ese es.' : `❌ El valor es ${fmtNum(s.value)}${s.unit ? ' ' + s.unit : ''} — mira la fórmula y sigue, no pasa nada.`),
          el('button', { class: 'primary', onclick: next }, idx + 1 < prob.steps.length ? 'Siguiente paso' : 'Ver la receta completa'));
        card.append(reveal);
        reveal.querySelector('button').focus();
      }

      function next() {
        idx++;
        if (idx < prob.steps.length) renderStep();
        else renderSummary();
      }

      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      card.replaceChildren(
        el('div', { class: 'progress-line' }, `${title} · paso ${idx + 1} de ${prob.steps.length}`),
        el('p', { class: 'question' }, prob.text),
        doneList(),
        el('p', { class: 'guided-step-label' }, `Paso ${idx + 1}: ${s.label}`),
        el('p', { class: 'formula' }, s.formula),
        input, note, btn);
      input.focus();
    }

    function doneList() {
      if (!done.length) return '';
      return el('div', { class: 'guided-done' },
        ...done.map(d => el('p', { class: 'worked' }, `${d.ok ? '✅' : '✏️'} ${d.label}: ${fmtNum(d.value)}${d.unit ? ' ' + d.unit : ''}`)));
    }

    function renderSummary() {
      card.replaceChildren(
        el('h3', {}, correct === prob.steps.length ? '💪 Receta completa, todo tuyo' : 'La receta completa'),
        el('p', { class: 'question' }, prob.text),
        ...prob.steps.map((s, i) => el('p', { class: 'worked' }, `${i + 1}. ${s.label} → ${fmtNum(s.value)}${s.unit ? ' ' + s.unit : ''}`)),
        el('p', { class: 'note' }, `Aciertos: ${correct} de ${prob.steps.length} pasos. La receta no cambia — solo los números.`),
        el('button', { class: 'primary', onclick: () => resolve({ stepsCorrect: correct, stepsTotal: prob.steps.length }) }, 'Continuar'));
    }

    root.replaceChildren(card);
    renderStep();
  });
}

/**
 * Práctica inmediata (SPEC §5.2): n problemas frescos, misma receta.
 * Sin puntaje que importe; "ver los pasos" re-renderiza la guía con LOS
 * NÚMEROS DE ESE PROBLEMA. Registra una fila drill mode:'practica'.
 */
export async function practicaBurst(root, { family, tier }, ctx, { title = 'Ahora tú: misma receta, números nuevos' } = {}) {
  const { config, templates } = ctx.data;
  const n = config.math.practica_size ?? 4;
  const items = [];
  for (let i = 0; i < n; i++) {
    const prob = generateProblem(templates, family, tier);
    const r = await practicaProblem(root, prob, ctx, { index: i + 1, total: n, title });
    items.push({ params: prob.params, answer: prob.answer, given: r.given, correct: r.correct, sawSteps: r.sawSteps });
  }
  const score = items.filter(i => i.correct).length;
  ctx.append({ kind: 'drill', family, tier, score, total: n, detail: { mode: 'practica', items } });
  return { score, total: n };
}

function practicaProblem(root, prob, ctx, { index, total, title }) {
  return new Promise(resolve => {
    let sawSteps = false;
    const input = el('input', { class: 'math-input', inputmode: 'decimal', placeholder: `Respuesta (${prob.unit})`, autocomplete: 'off' });
    const btn = el('button', { class: 'primary', onclick: submit }, 'Comprobar');
    const stepsBtn = el('button', {
      class: 'ghost', onclick: async () => {
        sawSteps = true;
        await guidedExample(root, prob, ctx, { title: 'Los pasos de ESTE problema' });
        resolve({ given: null, correct: false, sawSteps: true });
      },
    }, 'Ver los pasos 👀');

    function submit() {
      if (!input.value.trim()) return;
      const correct = checkAnswer(prob, input.value, ctx.data.config.math.tolerance_pct);
      input.disabled = true; btn.disabled = true;
      card.append(el('div', { class: `reveal ${correct ? 'ok' : 'bad'}` },
        el('p', { class: 'reason' }, correct ? '✅ Correcto.' : `❌ Respuesta: ${fmtNum(prob.answer)} ${prob.unit}`),
        el('p', { class: 'worked' }, prob.worked),
        el('button', { class: 'primary', onclick: () => resolve({ given: input.value, correct, sawSteps }) }, 'Siguiente')));
      card.querySelector('.reveal button').focus();
    }

    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    const card = el('div', { class: 'card' },
      el('div', { class: 'progress-line' }, `${title} · ${index} / ${total}`),
      el('p', { class: 'question' }, prob.text),
      input, btn, stepsBtn);
    root.replaceChildren(card);
    input.focus();
  });
}

/** Bloque completo de primera exposición: ejemplo guiado + práctica + cuaderno. */
export async function firstExposure(root, { family, tier }, ctx) {
  const prob = generateProblem(ctx.data.templates, family, tier);
  const g = await guidedExample(root, prob, ctx, { title: `Nueva receta: nivel ${tier}` });
  ctx.append({ kind: 'drill', family, tier, score: g.stepsCorrect, total: g.stepsTotal, detail: { mode: 'guiada', steps_correct: g.stepsCorrect, steps_total: g.stepsTotal } });
  await notebookPrompt(root, ctx, {
    id: `math-${family}-${tier}`,
    prompt: `Copia en tu cuaderno la receta de ${familyName(ctx, family)} nivel ${tier}, paso por paso, con el ejemplo resuelto (aquí abajo la tienes completa). Es tu tarjeta de receta — la vas a usar.`,
    context: 'math',
    recipe: prob,
  });
  await practicaBurst(root, { family, tier }, ctx);
}

export function notebookPrompt(root, ctx, { id, prompt, context = null, recipe = null }) {
  return new Promise(resolve => {
    // Si el prompt pide copiar una receta, la receta COMPLETA está en pantalla
    // mientras copia — nunca "cópiala" sin mostrarla.
    const recipeBox = recipe
      ? el('div', { class: 'recipe-box' },
        el('p', { class: 'note' }, recipe.text),
        ...recipe.steps.map((s, i) => el('p', { class: 'worked' },
          `${i + 1}. ${s.label} — ${s.formula} → ${fmtNum(s.value)}${s.unit ? ' ' + s.unit : ''}`)))
      : '';
    root.replaceChildren(el('div', { class: 'card notebook-card' },
      el('h3', {}, '📓 En tu cuaderno'),
      el('p', { class: 'question' }, prompt),
      recipeBox,
      el('button', {
        class: 'primary', onclick: () => {
          ctx.append({ kind: 'notebook', detail: { prompt_id: id, ...(context ? { context } : {}) } });
          resolve();
        },
      }, 'Hecho ✓')));
  });
}

function familyName(ctx, family) {
  return ctx.data.templates.families.find(f => f.id === family)?.name || family;
}

function fmtNum(n) {
  return Number.isInteger(n) ? n.toLocaleString('es-PE') : n.toLocaleString('es-PE', { maximumFractionDigits: 2 });
}
