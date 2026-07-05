// Players de bloque (SPEC §5). Cada player recibe (root, block, ctx) y
// resuelve su promesa al completar el bloque. ctx: {state, data, append,
// refresh, requestFeedback, todayKey}. Todo texto visible: español (§1).

import { generateProblem, checkAnswer } from './mathgen.js';
import { selectQuestions } from './planner.js';
import { uuid } from './store.js';
import { startRecording, saveRecording } from './audio.js';
import { guidedExample, firstExposure } from './guided.js';
import { lessonReview } from './lessons.js';

/** Micro-celebración (§5.9): flash breve, jamás un modal que interrumpa. */
export function flashCelebrate(root, text) {
  const f = el('div', { class: 'celebrate-flash' }, text);
  root.append(f);
  setTimeout(() => f.remove(), 1100);
}

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) n.append(c?.nodeType ? c : document.createTextNode(c ?? ''));
  return n;
}

const shuffle = (arr) => [...arr].map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);

function chapterRef(q, ctx) {
  const chs = ctx.state.catToChapter.get(q.category) || [];
  if (!chs.length) return '';
  const ch = ctx.data.chapters.chapters.find(c => c.id === chs[0]);
  return ch ? `PHAK cap. ${ch.id} — ${ch.title}${ch.pages ? ` (págs. ${ch.pages})` : ''}` : '';
}

// ---------- Preguntas del banco (§5.3) ----------

export async function quizPlayer(root, block, ctx) {
  let questions;
  if (block.type === 'redo') {
    questions = ctx.state.redoToday.map(qid => ctx.data.bank.find(q => q.id === qid)).filter(Boolean);
    if (!questions.length) {
      root.replaceChildren(el('div', { class: 'card center' }, el('p', {}, '¡Sin errores que rehacer hoy! 🎉'), el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar')));
      return waitDone(root);
    }
  } else {
    questions = selectQuestions(block, ctx.state, ctx.data);
  }
  if (!questions.length) {
    root.replaceChildren(el('div', { class: 'card center' }, el('p', {}, 'No hay preguntas pendientes en este bloque.'), el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar')));
    return waitDone(root);
  }

  const items = [];
  let conceptCount = 0, hotStreak = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.figures?.length) {
      const ok = await preloadFigure(q.figures[0]);
      if (!ok) { ctx.append({ kind: 'block', detail: { type: 'figure_skip', qid: q.id, fig: q.figures[0] } }); continue; }
    }
    conceptCount++;
    const explainMode = block.source !== 'regla' && conceptCount % ctx.data.config.distractor_explain_every === 0;
    const r = await askQuestion(root, q, ctx, { index: items.length + 1, total: questions.length, explainMode });
    items.push({ qid: q.id, correct: r.correct, chosen: r.chosen });
    hotStreak = r.correct ? hotStreak + 1 : 0;
    if (hotStreak > 0 && hotStreak % 4 === 0) flashCelebrate(root, `¡${hotStreak} seguidas! 🔥`);
  }

  const score = items.filter(i => i.correct).length;
  // SRS: un evento por capítulo repasado para avanzar su intervalo (§5.3)
  if (block.source === 'srs' || block.source === 'srs_catchup') {
    const byCh = new Map();
    for (const it of items) {
      const q = questions.find(x => x.id === it.qid);
      const ch = q?._srsChapter;
      if (!byCh.has(ch)) byCh.set(ch, []);
      byCh.get(ch).push(it);
    }
    for (const [ch, chItems] of byCh) {
      ctx.append({
        kind: 'quiz', chapter: ch || null,
        score: chItems.filter(i => i.correct).length, total: chItems.length,
        detail: { items: chItems, ...(ch ? { srs: true, chapter: ch } : {}) },
      });
    }
  } else {
    ctx.append({
      kind: block.type === 'redo' ? 'redo' : 'quiz',
      chapter: block.chapter || null,
      category: block.source === 'regla' ? ctx.data.chapters.track_categories.reglamentacion : (block.source === 'chart' ? 'VUELO EN RUTA' : null),
      score, total: items.length,
      detail: { items, ...(block.chapter ? { chapter: block.chapter } : {}) },
    });
  }
  const missed = items.some(i => !i.correct);
  showScore(root, score, items.length, missed && block.chapter ? { reviewChapter: block.chapter, ctx } : {});
  return waitDone(root);
}

function preloadFigure(name) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `data/figures/${encodeURIComponent(name)}`;
  });
}

function askQuestion(root, q, ctx, { index, total, explainMode, noFeedback = false }) {
  return new Promise(resolve => {
    const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })));
    const explainInputs = [];
    const optButtons = opts.map((o, i) =>
      el('button', { class: 'option', onclick: () => submit(i) }, o.text));

    function submit(chosenIdx) {
      if (explainMode && explainInputs.some(inp => inp.value.trim().length < 3)) {
        note.textContent = 'Antes de responder, escribe por qué descartas cada opción incorrecta — una línea corta basta, no tiene que ser perfecta.';
        return;
      }
      const chosen = opts[chosenIdx];
      optButtons.forEach((b, i) => {
        b.disabled = true;
        if (opts[i].correct) b.classList.add('correct');
        else if (i === chosenIdx) b.classList.add('wrong');
      });
      if (explainMode) {
        const entryId = uuid();
        const explanations = explainInputs.map(inp => ({ option: inp.dataset.option, why: inp.value.trim() }));
        ctx.append({ id: entryId, kind: 'distractor_explain', category: q.category, detail: { qid: q.id, explanations } });
        ctx.requestFeedback({
          id: uuid(), entry_id: entryId, entry_kind: 'distractor_explain',
          text: explanations.map(e => `«${e.option}»: ${e.why}`).join('\n'),
          grounding: { question: q.question, options: q.options, ...(q.reason ? { key_points: [q.reason] } : {}) },
        });
      }
      if (!noFeedback) {
        const reveal = el('div', { class: 'reveal' },
          q.reason ? el('p', { class: 'reason' }, q.reason) : el('p', { class: 'reason' }, `Respuesta correcta: ${q.options[q.answer]}`),
          el('p', { class: 'pageref' }, chapterRef(q, ctx)),
          el('button', { class: 'primary', onclick: () => resolve({ correct: chosen.correct, chosen: chosenIdx }) }, 'Siguiente'));
        card.append(reveal);
        reveal.querySelector('button').focus();
      } else {
        resolve({ correct: chosen.correct, chosen: chosenIdx });
      }
    }

    const note = el('p', { class: 'note' });
    const card = el('div', { class: 'card' },
      el('div', { class: 'progress-line' }, `${index} / ${total}`),
      q.figures?.length ? el('img', { class: 'figure', src: `data/figures/${encodeURIComponent(q.figures[0])}`, alt: 'figura' }) : '',
      el('p', { class: 'question' }, q.question),
      explainMode ? el('div', { class: 'explain-box' },
        el('p', { class: 'note' }, 'Antes de responder: ¿por qué está mal cada una de las que descartas?'),
        ...opts.filter(o => !o.correct).map(o => {
          const inp = el('input', { class: 'explain-input', placeholder: `¿Por qué no: “${o.text.slice(0, 60)}”?` });
          inp.dataset.option = o.text;
          explainInputs.push(inp);
          return inp;
        })) : '',
      ...optButtons,
      note);
    root.replaceChildren(card);
  });
}

function showScore(root, score, total, { reviewChapter = null, ctx = null } = {}) {
  const nodes = [
    el('h2', {}, `${score} / ${total}`),
    el('p', {}, score / total >= 0.8 ? '¡Buen trabajo! 💪' : 'Lo que fallaste no se pierde: la app te lo vuelve a traer sola hasta que sea tuyo. Equivocarse aquí es parte del plan.'),
  ];
  // Miss routing (§4.3): volver a la sección de la lección es un tap, no tarea
  if (reviewChapter && ctx) {
    nodes.push(el('button', {
      class: 'ghost', onclick: () => lessonReview(root, reviewChapter, ctx, () => showScore(root, score, total, { reviewChapter, ctx })),
    }, '📚 Volver a la lección de este capítulo'));
  }
  nodes.push(el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar'));
  root.replaceChildren(el('div', { class: 'card center' }, ...nodes));
}

function waitDone(root) {
  return new Promise(res => root.addEventListener('blockdone', res, { once: true }));
}

// ---------- Matemática (§5.2) ----------

export async function drillPlayer(root, block, ctx) {
  const errordeck = !!block.errordeck;
  const maintenance = block.mode === 'maintenance';
  const { config, templates } = ctx.data;
  const fam = block.family, tier = block.tier;

  // Mantenimiento (§5.2): pocos problemas, números frescos, nunca puntúa el ladder.
  if (maintenance) {
    const items = [];
    for (let i = 0; i < (config.math.maintenance_size ?? 3); i++) {
      const prob = generateProblem(templates, fam, tier);
      const r = await askMath(root, prob, ctx, { index: i + 1, total: config.math.maintenance_size ?? 3, tier });
      items.push({ params: prob.params, answer: prob.answer, given: r.given, correct: r.correct });
    }
    ctx.append({ kind: 'drill', family: fam, tier, score: items.filter(i => i.correct).length, total: items.length, detail: { mode: 'maintenance', items } });
    root.replaceChildren(el('div', { class: 'card center' },
      el('p', {}, `🔧 Receta engrasada: ${items.filter(i => i.correct).length}/${items.length}. El músculo se mantiene usándolo.`),
      el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar')));
    return waitDone(root);
  }

  // Primera exposición (§5.2): receta guiada + práctica antes del primer intento puntuado.
  if (!errordeck && !ctx.state.mathSeen?.has(`${fam}:${tier}`)) {
    await firstExposure(root, { family: fam, tier }, ctx);
    ctx.refresh();
  }

  const attemptsToday = (ctx.state.ladder[fam]?.attempts || []).filter(a => a.day === ctx.todayKey && a.tier === tier).length;
  if (!errordeck && attemptsToday >= 2) {
    root.replaceChildren(el('div', { class: 'card center' },
      el('p', {}, `Ya hiciste los 2 intentos de hoy en el nivel ${tier}. Dormir también entrena: mañana, mismo nivel, números nuevos.`),
      el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar')));
    return waitDone(root);
  }

  const n = errordeck ? 3 : config.math.attempt_size;
  const items = [];
  for (let i = 0; i < n; i++) {
    const prob = generateProblem(templates, fam, tier);
    const r = await askMath(root, prob, ctx, { index: i + 1, total: n, tier });
    items.push({ params: prob.params, answer: prob.answer, given: r.given, correct: r.correct });
  }
  const score = items.filter(i => i.correct).length;
  const passed = score >= config.math.advance_score;
  ctx.append({ kind: 'drill', family: fam, tier, score, total: n, detail: { items, ...(errordeck ? { errordeck: true } : {}) } });

  if (errordeck) { showScore(root, score, n); return waitDone(root); }

  const perfect = score === n;
  if (perfect) flashCelebrate(root, '¡10 de 10! 💪🎉');
  else if (passed) flashCelebrate(root, `¡Nivel ${tier} superado! 🪜🎉`);
  const canRetry = !passed && attemptsToday === 0;
  const nodes = [el('h2', {}, `${score} / ${n}`)];
  if (passed && tier < 3) nodes.push(el('p', {}, `✅ ¡Nivel ${tier} superado! Mañana te espera el nivel ${tier + 1}.`));
  else if (passed) nodes.push(el('p', {}, '👑 ¡Nivel 3 dominado! Esta familia ya es tuya.'));
  else nodes.push(el('p', {}, `Se pasa de nivel con ${config.math.advance_score}/${n}, y hoy no tocó — no pasa nada: cada intento suma reps. ${canRetry ? 'Puedes reintentar HOY una vez, después de un descanso de 5 minutos.' : 'Mañana, mismo nivel, números nuevos — la receta ya la tienes.'}`));
  if (perfect && tier < 3) nodes.push(el('button', { class: 'ghost', onclick: () => previewNext() }, `Probar 3 del nivel ${tier + 1} (no cuenta)`));
  if (!passed) nodes.push(el('button', { class: 'ghost', onclick: () => reviewRecipe() }, 'Repasar la receta paso a paso 🧭'));
  if (canRetry) nodes.push(el('button', { class: 'ghost', onclick: () => retry() }, 'Reintentar tras el descanso'));
  nodes.push(el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar'));
  root.replaceChildren(el('div', { class: 'card center' }, ...nodes));

  async function previewNext() {
    for (let i = 0; i < config.math.preview_size; i++) {
      const prob = generateProblem(templates, fam, tier + 1);
      await askMath(root, prob, ctx, { index: i + 1, total: config.math.preview_size, tier: tier + 1, preview: true });
    }
    ctx.append({ kind: 'drill', family: fam, tier: tier + 1, score: 0, total: config.math.preview_size, detail: { preview: true } });
    root.dispatchEvent(new Event('blockdone'));
  }
  async function retry() {
    await breakScreen(root, 5 * 60, 'Descanso de 5 minutos antes del reintento. Sal de la habitación — tu cerebro sigue ordenando la receta mientras caminas.');
    ctx.refresh();
    await drillPlayer(root, block, ctx);
    root.dispatchEvent(new Event('blockdone'));
  }
  // Tras un intento fallido: re-camina la receta guiada con números frescos
  // (el §4.4 "rehacer con procedimiento" para matemática). No puntúa.
  async function reviewRecipe() {
    for (let i = 0; i < 2; i++) {
      const prob = generateProblem(templates, fam, tier);
      const g = await guidedExample(root, prob, ctx, { title: `Repaso de la receta (${i + 1}/2)` });
      ctx.append({ kind: 'drill', family: fam, tier, score: g.stepsCorrect, total: g.stepsTotal, detail: { mode: 'guiada', redo: true } });
    }
    await drillPlayer(root, { ...block, _afterReview: true }, ctx);
    root.dispatchEvent(new Event('blockdone'));
  }
  return waitDone(root);
}

function askMath(root, prob, ctx, { index, total, tier, preview = false }) {
  return new Promise(resolve => {
    const input = el('input', { class: 'math-input', inputmode: 'decimal', placeholder: `Respuesta (${prob.unit})`, autocomplete: 'off' });
    const e6b = ['peso_balance', 'tvd'].includes(prob.familyId) ? el('p', { class: 'note' }, 'Resuelve primero mentalmente, luego verifica con el E6B.') : '';

    function submit() {
      if (!input.value.trim()) return;
      const correct = checkAnswer(prob, input.value, ctx.data.config.math.tolerance_pct);
      input.disabled = true; btn.disabled = true;
      card.append(el('div', { class: `reveal ${correct ? 'ok' : 'bad'}` },
        el('p', { class: 'reason' }, correct ? '✅ Correcto.' : `❌ Respuesta: ${prob.answer} ${prob.unit}`),
        el('p', { class: 'worked' }, prob.worked),
        tier > 1 ? el('p', { class: 'formula' }, prob.formula) : '',
        el('button', { class: 'primary', onclick: () => resolve({ given: input.value, correct }) }, 'Siguiente')));
      card.querySelector('.reveal button').focus();
    }

    const btn = el('button', { class: 'primary', onclick: submit }, 'Comprobar');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    const card = el('div', { class: 'card' },
      el('div', { class: 'progress-line' }, `${preview ? 'Vista previa ' : ''}${index} / ${total} · nivel ${tier}`),
      tier === 1 ? el('p', { class: 'formula' }, prob.formula) : '',
      el('p', { class: 'question' }, prob.text),
      e6b, input, btn);
    root.replaceChildren(card);
    input.focus();
  });
}

// ---------- Recuerdo libre (§4.3) ----------

export async function recallPlayer(root, block, ctx) {
  const { config, chapters } = ctx.data;
  const ch = chapters.chapters.find(c => c.id === block.chapter);
  return new Promise(resolve => {
    let seconds = config.recall.timer_minutes * 60;
    const timerEl = el('div', { class: 'timer' }, fmtTime(seconds));
    const ta = el('textarea', { class: 'recall-ta', rows: '10', placeholder: 'Libro cerrado. Escribe todo lo que recuerdes, con tus propias palabras…' });
    const counter = el('p', { class: 'note' }, `0 / ${config.recall.min_chars} caracteres`);
    const btn = el('button', { class: 'primary', disabled: 'true', onclick: submit }, 'Entregar');
    ta.addEventListener('input', () => {
      counter.textContent = `${ta.value.length} / ${config.recall.min_chars} caracteres`;
      if (ta.value.length >= config.recall.min_chars) btn.removeAttribute('disabled');
      else btn.setAttribute('disabled', 'true');
    });
    const iv = setInterval(() => {
      seconds--; timerEl.textContent = fmtTime(Math.max(0, seconds));
      if (seconds <= 0) { clearInterval(iv); timerEl.classList.add('done'); }
    }, 1000);

    async function submit() {
      clearInterval(iv);
      const entryId = uuid();
      ctx.append({ id: entryId, kind: 'recall', chapter: block.chapter, detail: { text: ta.value, chars: ta.value.length, section: block.section || null } });
      root.replaceChildren(el('div', { class: 'card center' }, el('p', {}, 'Entregado. Pidiendo retroalimentación…')));
      const keyPoints = (ch?.sections || []).flatMap(s => s.key_points || []);
      const fb = await ctx.requestFeedback({
        id: uuid(), entry_id: entryId, entry_kind: 'recall',
        text: ta.value, grounding: { chapter: block.chapter, key_points: keyPoints },
      });
      const nodes = [el('h3', {}, 'Recuerdo entregado ✅'), el('p', { class: 'note' }, 'Las preguntas de la sección quedan desbloqueadas.')];
      if (fb) {
        if (fb.covered?.length) nodes.push(el('p', {}, `Cubriste: ${fb.covered.join(' · ')}`));
        if (fb.missing?.length) nodes.push(el('p', { class: 'missing' }, `Te faltó: ${fb.missing.join(' · ')}${ch?.pages ? ` — revisa págs. ${ch.pages}` : ''}`));
        if (fb.comment) nodes.push(el('p', { class: 'reason' }, fb.comment));
      } else {
        nodes.push(el('p', { class: 'note' }, 'La retroalimentación llegará cuando haya conexión — el avance no espera por ella.'));
      }
      nodes.push(el('button', { class: 'primary', onclick: () => resolve() }, 'Continuar'));
      root.replaceChildren(el('div', { class: 'card' }, ...nodes));
    }

    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, `Recuerdo libre — cap. ${block.chapter}: ${ch?.title || ''}`),
      timerEl, ta, counter, btn));
    ta.focus();
  });
}

// ---------- Fraseología: ráfaga (§5.4) ----------

export async function rapidfirePlayer(root, block, ctx) {
  const { bank, chapters, config } = ctx.data;
  const pool = bank.filter(q => q.category === chapters.track_categories.fraseologia);
  const boxOf = (q) => ctx.state.itemStats.get(`q:${q.id}`)?.box ?? 0;
  const cards = pool.map(q => ({ q, box: boxOf(q), r: Math.random() }))
    .sort((a, b) => a.box - b.box || a.r - b.r)
    .slice(0, config.tracks.fraseologia_daily).map(c => c.q);

  const items = [];
  let streak = 0, best = 0;
  for (let i = 0; i < cards.length; i++) {
    const q = cards[i];
    const r = await rapidCard(root, q, { index: i + 1, total: cards.length, streak });
    streak = r.correct ? streak + 1 : 0;
    best = Math.max(best, streak);
    if (streak === 15) flashCelebrate(root, '¡RACHA ×15! 🎧🔥');
    items.push({ qid: q.id, correct: r.correct });
  }
  ctx.append({ kind: 'rapidfire', category: chapters.track_categories.fraseologia, score: items.filter(i => i.correct).length, total: items.length, detail: { items, best_streak: best } });
  showScore(root, items.filter(i => i.correct).length, items.length);
  return waitDone(root);
}

function rapidCard(root, q, { index, total, streak }) {
  return new Promise(resolve => {
    const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })));
    const buttons = opts.map((o, i) => el('button', { class: 'option big', onclick: () => pick(i) }, o.text));
    function pick(i) {
      buttons.forEach((b, j) => { b.disabled = true; if (opts[j].correct) b.classList.add('correct'); else if (j === i) b.classList.add('wrong'); });
      card.classList.add(opts[i].correct ? 'flash-ok' : 'flash-bad');
      setTimeout(() => resolve({ correct: opts[i].correct }), opts[i].correct ? 450 : 1600);
    }
    const card = el('div', { class: 'card rapid' },
      el('div', { class: 'progress-line' }, `${index}/${total}${streak >= 2 ? ` · racha ${streak} 🔥` : ''}`),
      el('p', { class: 'question' }, q.question),
      ...buttons);
    root.replaceChildren(card);
  });
}

// ---------- Vuelo de escritorio (§4.4) ----------

export async function scenarioPlayer(root, block, ctx) {
  const scen = ctx.data.scenarios.scenarios.find(s => s.id === block.id);
  return new Promise(resolve => {
    const ta = el('textarea', { class: 'recall-ta', rows: '6', placeholder: 'Máximo 5 líneas.' });
    async function submit() {
      if (ta.value.trim().length < 30) return;
      const entryId = uuid();
      ctx.append({ id: entryId, kind: 'scenario', detail: { scenario_id: scen.id, text: ta.value } });
      ctx.requestFeedback({ id: uuid(), entry_id: entryId, entry_kind: 'scenario', text: ta.value, grounding: { scenario_prompt: scen.prompt } });
      resolve();
    }
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, scen.title), el('p', { class: 'question' }, scen.prompt), ta,
      el('button', { class: 'primary', onclick: submit }, 'Entregar')));
  });
}

// ---------- Teach-back (§4.4) ----------

export async function teachbackPlayer(root, block, ctx) {
  const ch = ctx.data.chapters.chapters.find(c => c.id === block.chapter);
  return new Promise(resolve => {
    function done(mode, audioId) {
      ctx.append({ kind: 'block', chapter: block.chapter || null, detail: { type: 'teachback', chapter: block.chapter, mode, ...(audioId ? { audio_id: audioId } : {}), done: true } });
      resolve();
    }
    async function record() {
      const status = el('p', { class: 'timer' }, '0 / 90 s');
      const stopBtn = el('button', { class: 'primary' }, 'Detener y guardar');
      root.replaceChildren(el('div', { class: 'card center' }, el('p', {}, '🎙️ Grabando… explica como si enseñaras.'), status, stopBtn));
      try {
        const rec = await startRecording((s, max) => status.textContent = `${s} / ${max} s`);
        stopBtn.addEventListener('click', () => rec.stop());
        const blob = await rec.done;
        const audioId = uuid();
        await saveRecording(audioId, blob);
        done('audio', audioId);
      } catch (e) {
        root.replaceChildren(el('div', { class: 'card center' },
          el('p', {}, 'No se pudo acceder al micrófono. Explícalo en voz alta igualmente.'),
          el('button', { class: 'primary', onclick: () => done('voz_sin_audio') }, 'Lo expliqué en voz alta')));
      }
    }
    function render() {
      root.replaceChildren(el('div', { class: 'card' },
        el('h3', {}, 'Explícalo en voz alta'),
        el('p', { class: 'question' }, `Concepto de hoy: ${ch ? `cap. ${ch.id} — ${ch.title}` : 'el capítulo actual'}. Explícaselo a alguien como si fueras el instructor.`),
        ch ? el('button', { class: 'ghost', onclick: () => lessonReview(root, ch.id, ctx, render) }, '📚 Repasar la lección primero') : '',
        el('button', { class: 'primary', onclick: () => done('persona') }, 'Lo expliqué a una persona ✅'),
        el('button', { class: 'ghost', onclick: record }, 'No hay nadie — grabar audio (máx. 90 s)')));
    }
    render();
  });
}

// ---------- Simulacro (§5.5) ----------

export async function simulacroPlayer(root, block, ctx) {
  const { config, templates } = ctx.data;
  const { buildSimulacro } = await import('./planner.js');
  await new Promise(res => root.replaceChildren(el('div', { class: 'card center' },
    el('h2', {}, block.which === 'final' ? 'SIMULACRO FINAL' : 'Simulacro'),
    el('p', {}, `${config.exam.questions} preguntas · ${config.exam.minutes} minutos · SIN calculadora (como el examen). Sin retroalimentación hasta el final.`),
    el('p', { class: 'note' }, `Ritmo: ~${(config.exam.minutes / config.exam.questions).toFixed(1)} min por pregunta.`),
    el('button', { class: 'primary', onclick: res }, 'Empezar'))));

  let qs = buildSimulacro(ctx.state, ctx.data);
  // Matemática con variantes generadas donde aplique (§5.5)
  const genItems = new Map();
  let replaced = 0;
  qs = qs.map(q => {
    if (q.category === 'PERFORMANCE' && replaced < 3 && !q.figures?.length) {
      replaced++;
      const fams = ['carga', 'altitudes', 'peso_balance', 'tvd'];
      const prob = generateProblem(templates, fams[replaced % fams.length], 2, { mc: true });
      const fake = { id: `gen-${replaced}`, category: 'PERFORMANCE', question: prob.text, options: prob.options, answer: prob.correctIndex, reason: prob.worked };
      genItems.set(fake.id, prob);
      return fake;
    }
    return q;
  });

  const deadline = Date.now() + config.exam.minutes * 60_000;
  const items = [];
  for (let i = 0; i < qs.length; i++) {
    if (Date.now() >= deadline) break;
    const q = qs[i];
    if (q.figures?.length && !(await preloadFigure(q.figures[0]))) continue;
    const r = await askSimQuestion(root, q, { index: i + 1, total: qs.length, deadline });
    const gen = genItems.get(q.id);
    items.push(gen
      ? { family: gen.familyId, tier: gen.tier, correct: r.correct, category: 'PERFORMANCE' }
      : { qid: q.id, correct: r.correct, category: q.category });
  }

  const score = items.filter(i => i.correct).length;
  const byCat = {};
  for (const it of items) {
    byCat[it.category] = byCat[it.category] || { n: 0, ok: 0 };
    byCat[it.category].n++; if (it.correct) byCat[it.category].ok++;
  }
  ctx.append({ kind: 'simulacro', score, total: items.length, detail: { items, by_category: byCat, which: block.which } });

  const pct = Math.round(100 * score / items.length);
  root.replaceChildren(el('div', { class: 'card' },
    el('h2', { class: 'center' }, `${pct}%`),
    el('p', { class: 'center' }, pct >= config.gates.listo_simulacro_pct ? `≥ ${config.gates.listo_simulacro_pct}% — objetivo alcanzado 🏅` : `Objetivo: ${config.gates.listo_simulacro_pct}%. Cada error ya entró al mazo — esa es tu lista exacta de qué estudiar, no una condena.`),
    el('table', { class: 'cat-table' }, ...Object.entries(byCat).map(([c, v]) =>
      el('tr', {}, el('td', {}, c), el('td', {}, `${v.ok}/${v.n}`), el('td', {}, `${Math.round(100 * v.ok / v.n)}%`)))),
    el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('blockdone')) }, 'Continuar')));
  return waitDone(root);
}

function askSimQuestion(root, q, { index, total, deadline }) {
  return new Promise(resolve => {
    const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })));
    const timerEl = el('div', { class: 'timer small' });
    const iv = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      timerEl.textContent = fmtTime(Math.floor(left / 1000));
      if (left <= 0) { clearInterval(iv); resolve({ correct: false, timeout: true }); }
    }, 500);
    root.replaceChildren(el('div', { class: 'card' },
      el('div', { class: 'progress-line' }, `${index} / ${total}`, timerEl),
      q.figures?.length ? el('img', { class: 'figure', src: `data/figures/${encodeURIComponent(q.figures[0])}`, alt: 'figura' }) : '',
      el('p', { class: 'question' }, q.question),
      ...opts.map((o, i) => el('button', { class: 'option', onclick: () => { clearInterval(iv); resolve({ correct: o.correct, chosen: i }); } }, o.text))));
  });
}

// ---------- Bloques simples ----------

export async function lecturaPlayer(root, block, ctx) {
  const ch = ctx.data.chapters.chapters.find(c => c.id === block.chapter);
  return new Promise(resolve => {
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, `📖 Lectura: cap. ${ch.id} — ${ch.title}`),
      el('p', { class: 'question' }, ch.pages ? `Páginas ${ch.pages} del PHAK (edición en español).` : 'Rango de páginas pendiente — lee el capítulo completo en el PHAK.'),
      el('p', { class: 'note' }, 'La lectura es en el libro físico o PDF. La app solo asigna y confirma. Al terminar, cierras el libro: sigue el recuerdo libre.'),
      el('button', { class: 'primary', onclick: () => { ctx.append({ kind: 'block', chapter: ch.id, detail: { type: 'lectura', chapter: ch.id, done: true } }); resolve(); } }, 'Ya leí — libro cerrado')));
  });
}

export async function oralPlayer(root, block, ctx) {
  const state = ctx.state;
  const next = ctx.data.chapters.chapters.find(c => c.id === block.chapter);
  return new Promise(resolve => {
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, '🗣️ Cierre del día'),
      el('ul', { class: 'checklist' },
        el('li', {}, 'Repasa en voz alta el guion oral: ¿qué me preguntaría un examinador sobre lo de hoy?'),
        el('li', {}, next ? `Lectura de mañana: cap. ${next.id} — ${next.title}. Hojéala 2 minutos (solo títulos).` : 'Mañana: repaso e integración.'),
        el('li', {}, 'Deja el libro y el cuaderno listos para las 8:00.')),
      el('button', { class: 'primary', onclick: () => { ctx.append({ kind: 'block', detail: { type: 'oral', done: true } }); resolve(); } }, 'Listo')));
  });
}

export function breakScreen(root, seconds, msg) {
  return new Promise(resolve => {
    let s = seconds;
    const t = el('div', { class: 'timer' }, fmtTime(s));
    const btn = el('button', { class: 'ghost', onclick: () => { clearInterval(iv); resolve(); } }, 'Continuar');
    const iv = setInterval(() => {
      s--; t.textContent = fmtTime(Math.max(0, s));
      if (s <= 0) { clearInterval(iv); resolve(); }
    }, 1000);
    root.replaceChildren(el('div', { class: 'card center break' },
      el('h3', {}, '☕ Descanso'), el('p', {}, msg || 'Levántate y sal de la habitación. En serio.'), t, btn));
  });
}

export function fmtTime(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
