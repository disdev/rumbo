// Misiones de Vuelo en ruta (spec 2026-10-22): un vuelo real, paso a paso, sobre
// la carta viva. Cada paso es algo que haces con las manos (tocar, arrastrar,
// girar, escribir) y el error se ve EN la carta. Pensado para laptop: la carta a
// la izquierda, el paso a la derecha. Nunca bloquea: tras dos fallos se muestra
// la respuesta y se sigue. Todo queda en el log para el mentor:
// nav (qué pantalla y cuánto tiempo), mission_attempt (cada respuesta),
// mission_step (cada paso terminado), mission_progress (misión terminada o abandonada).

import { el, quizPlayer, flashCelebrate } from './players.js';
import { getLog } from './store.js';
import { renderCarta } from './carta.js';
import { renderFigura } from './figura-overlay.js';
import { gradeAnswer, expectedValue, missionProgress, parseNumber, trueTrackOf } from './misiones-logic.js';
import { lessonReview } from './lessons.js';

/** Carga perezosa: si falla (sin red y sin caché) el resto de la app sigue igual. */
export async function loadMisiones(ctx) {
  if (ctx.data.misiones && ctx.data.cartas) return ctx.data.misiones;
  const misiones = await fetch('data/misiones.json').then(r => r.json());
  const cartas = {};
  for (const id of new Set(misiones.missions.filter(m => m.live).map(m => m.chart))) {
    cartas[id] = await fetch(`data/misiones/carta-${id}.json`).then(r => r.json());
  }
  ctx.data.misiones = misiones;
  ctx.data.cartas = cartas;
  return misiones;
}

export const progressOf = (ctx) => missionProgress(getLog(), ctx.data.misiones.missions);

/** Misión que toca ahora: la primera en vivo sin terminar (o null si ya están todas). */
export function currentMission(ctx) {
  const prog = progressOf(ctx);
  return ctx.data.misiones.missions.find(m => m.live && !prog[m.id].completed) || null;
}

/** Cronómetro de tiempo VISIBLE: se pausa si la app pasa a segundo plano. */
export function activeTimer() {
  let total = 0, since = document.hidden ? null : Date.now();
  const onVis = () => {
    if (document.hidden && since != null) { total += Date.now() - since; since = null; }
    else if (!document.hidden && since == null) since = Date.now();
  };
  document.addEventListener('visibilitychange', onVis);
  return {
    seconds: () => Math.round((total + (since != null ? Date.now() - since : 0)) / 1000),
    stop: () => document.removeEventListener('visibilitychange', onVis),
  };
}

const fmtNum = (v, unit) => {
  if (unit === 'deg') return `${String(Math.round(((v % 360) + 360) % 360) || 360).padStart(3, '0')}°`;
  const n = Math.round(v).toLocaleString('es-PE').replace(/,/g, ' ');
  return unit === 'nm' ? `${n} NM` : unit === 'ft' ? `${n} ft` : n;
};
const UNIT_LABEL = { deg: '°', ft: 'ft', nm: 'NM' };

/**
 * Juega una misión. startAt: id de paso, 'prueba' o null (= desde el principio).
 * onExit() vuelve al taller.
 */
export async function misionView(root, ctx, missionId, onExit, startAt = null) {
  await loadMisiones(ctx);
  const M = ctx.data.misiones.missions.find(m => m.id === missionId);
  const chart = ctx.data.cartas[M.chart];
  const runTimer = activeTimer();
  let currentStep = null, stepsDone = 0, lastDone = null, finished = false;
  document.body.classList.add('misiones-wide');

  let stepCleanup = null; // herramienta + cronómetro del paso en curso
  function teardown() {
    stepCleanup?.(); stepCleanup = null;
    surfaceApi?.destroy?.(); surfaceApi = null;
    document.body.classList.remove('misiones-wide');
    runTimer.stop();
  }
  function leave() {
    teardown();
    onExit();
  }
  function exitMission() {
    if (!finished) {
      ctx.append({ kind: 'mission_progress', detail: {
        mission: M.id, title: M.title, completed: false, seconds: runTimer.seconds(), steps_done: stepsDone,
        last_step: currentStep || lastDone,
      } });
    }
    leave();
  }

  // ---- armazón: superficie (carta/figura) a la izquierda, panel del paso a la derecha ----
  const surfaceBox = el('div', { class: 'mision-surface' });
  const panel = el('div', { class: 'mision-panel card' });
  const grid = el('div', { class: 'mision-grid' }, surfaceBox, panel);
  const exitBtn = () => el('button', { class: 'ghost mision-exit', onclick: exitMission }, '← Salir de la misión');
  let surfaceApi = null;

  function bar(activeIdx) {
    return el('div', { class: 'mision-steps', 'aria-label': `Paso ${activeIdx + 1} de ${M.steps.length}` },
      ...M.steps.map((s, i) => el('i', { class: i < activeIdx ? 'done' : i === activeIdx ? 'on' : '' })),
      el('i', { class: `prueba ${activeIdx >= M.steps.length ? 'on' : ''}`, title: 'Prueba final' }));
  }
  function header(kicker, title, activeIdx) {
    return [el('p', { class: 'lesson-kicker' }, `${M.icon || '🛩️'} Misión ${M.n} · ${M.title} — ${kicker}`), el('h3', { class: 'mision-title' }, title), bar(activeIdx)];
  }
  function mountSurface(surface, step = {}) {
    surfaceApi?.destroy?.();
    if (surface === 'carta') {
      surfaceApi = renderCarta(surfaceBox, chart, { route: step.route || M.route, explain: step.kind !== 'tap' });
      surfaceApi.kind = 'carta';
      if (step.focus) requestAnimationFrame(() => requestAnimationFrame(() => surfaceApi.focusFeature(step.focus)));
    } else {
      surfaceApi = renderFigura(surfaceBox, surface);
      surfaceApi.kind = 'figura';
    }
    return surfaceApi;
  }

  // ---- briefing ----
  function briefing() {
    return new Promise(resolve => {
      ctx.nav('mision', { mission: M.id, step: null, view: 'briefing' });
      root.replaceChildren(grid);
      const api = mountSurface('carta', { route: M.route });
      api.onTap(() => {});
      const go = el('button', { class: 'primary', onclick: resolve }, '¡Vamos! →');
      panel.replaceChildren(...header('briefing', M.title, 0),
        el('p', { class: 'mision-prompt' }, M.briefing),
        el('p', { class: 'note' }, `${M.steps.length} pasos cortos y al final ${Math.min(8, M.questions.length)} preguntas reales del examen.`),
        go,
        ...(M.lessons || []).map(([ch, sec, label]) => el('button', {
          class: 'ghost', onclick: () => { document.body.classList.remove('misiones-wide'); lessonReview(root, ch, ctx, () => { document.body.classList.add('misiones-wide'); briefing().then(resolve); }, sec); },
        }, `📖 Repasar ${sec} · ${label}`)),
        exitBtn());
      go.focus();
    });
  }

  // ---- un paso ----
  function runStep(step, idx) {
    return new Promise(resolve => {
      currentStep = step.id;
      ctx.nav('mision', { mission: M.id, step: step.id, view: 'step' });
      root.replaceChildren(grid);
      const api = mountSurface(step.surface, step);
      const timer = activeTimer();
      let tries = 0, hintShown = false, firstTry = null, shownAt = Date.now(), tool = null, done = false;
      stepCleanup = () => { tool?.destroy?.(); timer.stop(); };

      const feedback = el('div', { class: 'mision-feedback', 'aria-live': 'polite' });
      const controls = el('div', { class: 'mision-controls' });
      panel.replaceChildren(...header(`paso ${idx + 1} de ${M.steps.length}`, step.title, idx),
        el('p', { class: 'mision-prompt' }, step.prompt), controls, feedback, exitBtn());

      if (api.kind === 'carta') {
        if (step.tool === 'plotter') tool = api.plotter(step.route);
        else if (step.tool === 'paper_strip') tool = api.paperStrip(step.route);
        else if (step.kind === 'place') {
          const from = chart.airports.find(a => a.id === chart.routes.find(r => r.id === step.route).from);
          tool = api.placePlane({ lat: from.lat + 0.08, lon: from.lon - 0.05 }, { readout: step.readout !== false });
        }
      }

      function submit(answer) {
        if (done) return;
        tries++;
        const { correct, off_by } = gradeAnswer(step, answer, chart);
        if (firstTry == null) firstTry = correct;
        ctx.append({ kind: 'mission_attempt', detail: {
          mission: M.id, step: step.id, try: tries, answer, correct, off_by: off_by == null ? null : Math.round(off_by * 10) / 10,
          ms_to_answer: Date.now() - shownAt, hint_shown: hintShown,
        } });
        shownAt = Date.now();
        if (correct) return finish(false, answer);
        showMiss(answer, off_by);
        if (tries >= 2) return finish(true, answer);
        hintShown = true;
      }

      function showMiss(answer, off) {
        api.clearMarks();
        const lines = [];
        if (step.kind === 'number') {
          const off1 = Math.round(Math.abs(off));
          lines.push(step.unit === 'deg' && off1 >= 170
            ? `Pusiste ${fmtNum(answer.value, step.unit)}: es el curso AL REVÉS (±180°). Vas en la dirección contraria.`
            : `Pusiste ${fmtNum(answer.value, step.unit)}: ${off > 0 ? 'te pasaste' : 'te faltó'} por ${step.unit === 'deg' ? `${off1}°` : fmtNum(off1, step.unit)}.`);
          const track = api.kind === 'carta' && step.route ? trueTrackOf(step, answer.value, chart) : null;
          if (track != null) {
            const r = chart.routes.find(x => x.id === step.route), from = chart.airports.find(a => a.id === r.from);
            api.drawLine(from, track, api.routeDistance(step.route) * 0.85, 'me');
            lines.push(step.compute === 'magnetic_course'
              ? 'La línea naranja es la derrota que saldría con TU respuesta: si fuera el magnético correcto, caería sobre la ruta.'
              : 'La línea naranja es TU curso: mira hacia dónde te lleva.');
          }
        } else if (step.kind === 'place') {
          api.showPoint(answer, 'bad');
          const dm = (v) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return m === 60 ? `${d + 1}°00′` : `${d}°${String(m).padStart(2, '0')}′`; };
          lines.push(`Lo soltaste en ${dm(answer.lat)}S · ${dm(answer.lon)}W (el avión rojo): a ${off.toFixed(1)} NM del punto.`);
        } else if (step.kind === 'tap' && answer.feature) {
          api.highlight([answer.feature], 'bad');
          if (api.kind === 'carta') api.explainFeature(answer.feature);
        }
        if (tries < 2) lines.push(`💡 ${step.hint}`);
        feedback.replaceChildren(el('div', { class: 'reveal bad' }, ...lines.map(t => el('p', {}, t))));
      }

      function finish(revealed, answer) {
        done = true;
        stepCleanup?.(); stepCleanup = null;
        if (!revealed || step.kind !== 'number') api.clearMarks(); // fuera las marcas del error; queda la respuesta
        // mostrar la respuesta correcta en la superficie
        if (step.kind === 'tap') api.highlight(step.targets, 'ok');
        if (step.kind === 'place') { api.showRing(step.target, step.tol, 'ok'); if (!revealed) api.showPoint(answer, 'ok'); else api.showPoint(answer, 'me'); }
        const okTrack = step.kind === 'number' && api.kind === 'carta' && step.route ? trueTrackOf(step, expectedValue(step, chart), chart) : null;
        if (okTrack != null) {
          const r = chart.routes.find(x => x.id === step.route), from = chart.airports.find(a => a.id === r.from);
          api.drawLine(from, okTrack, api.routeDistance(step.route), 'ok');
        }
        if (api.kind === 'figura' && step.surface.hotspots?.length > 1 && step.kind === 'choice') {
          const [h1, h2] = step.surface.hotspots;
          api.drawLine(h1, h2, 'ok');
        }
        controls.querySelectorAll('button, input').forEach(n => { n.disabled = true; });
        if (step.kind === 'choice') controls.querySelectorAll('.option').forEach(b => { if (Number(b.dataset.orig) === step.answer) b.classList.add('correct'); });
        const seconds = timer.seconds();
        ctx.append({ kind: 'mission_step', detail: {
          mission: M.id, step: step.id, title: step.title, tries, first_try_correct: !!firstTry, revealed, seconds,
        } });
        stepsDone++; lastDone = step.id; currentStep = null;
        const answerText = step.kind === 'number' ? `La respuesta: ${fmtNum(expectedValue(step, chart), step.unit)}.`
          : step.kind === 'choice' ? `La respuesta: ${step.options[step.answer]}.` : '';
        const next = el('button', { class: 'primary', onclick: () => afterStep() }, 'Seguir →');
        feedback.replaceChildren(el('div', { class: `reveal ${revealed ? 'bad' : 'ok'}` },
          el('p', { class: 'reason' }, revealed ? `Esta vez te la mostramos. ${answerText}` : '✅ ¡Correcto!'),
          el('p', {}, step.explain_ok)), next);
        if (!revealed) flashCelebrate(panel, '✈️ ¡Bien!');
        next.focus();
      }

      function afterStep() {
        const receta = step.receta && M.recetas.find(r => r.id === step.receta);
        if (!receta) return resolve();
        ctx.nav('mision', { mission: M.id, step: step.id, view: 'receta' });
        const ok = el('button', { class: 'primary', onclick: resolve }, 'Guardada → seguir');
        panel.replaceChildren(...header('receta nueva', '🧾 Receta desbloqueada', idx + 1),
          el('div', { class: 'mision-receta' }, el('p', { class: 'lesson-kicker' }, 'Lo que acabas de hacer, en una línea'), el('h4', {}, receta.title), el('p', {}, receta.body)),
          el('p', { class: 'note' }, 'La encuentras siempre en el taller, en «Mis recetas».'), ok, exitBtn());
        ok.focus();
      }

      // ---- controles según el tipo de paso ----
      if (step.kind === 'tap') {
        controls.append(el('p', { class: 'note' }, api.kind === 'carta' ? '👆 Toca en la carta.' : '👆 Toca uno de los círculos de la figura.'));
        if (api.kind === 'figura') api.outline?.(step.surface.hotspots.map(h => h.id));
        api.onTap((id) => {
          if (id) return submit({ feature: id });
          if (api.kind === 'figura' && !done) feedback.replaceChildren(el('p', { class: 'note' }, 'Toca justo dentro de uno de los círculos marcados.'));
        });
      } else if (step.kind === 'choice') {
        api.onTap?.(() => {});
        const order = step.options.map((t, i) => ({ t, i })).sort(() => Math.random() - 0.5);
        for (const o of order) {
          controls.append(el('button', { class: 'option', 'data-orig': o.i, onclick: function () {
            if (done) return;
            submit({ option: o.i });
            if (!done) { this.disabled = true; this.classList.add('wrong'); }
          } }, o.t));
        }
      } else if (step.kind === 'number') {
        api.onTap?.(() => {});
        const input = el('input', { class: 'math-input mision-input', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `Respuesta en ${UNIT_LABEL[step.unit] || ''}`, placeholder: step.unit === 'deg' ? 'p. ej. 090' : '' });
        const go = el('button', { class: 'primary', onclick: send }, 'Comprobar');
        function send() {
          const v = parseNumber(input.value);
          if (!Number.isFinite(v)) { input.focus(); return; }
          submit({ value: v });
          if (!done) { input.select(); input.focus(); }
        }
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
        controls.append(el('div', { class: 'mision-numrow' }, input, el('span', { class: 'mision-unit' }, UNIT_LABEL[step.unit] || '')), go);
        setTimeout(() => input.focus(), 50);
      } else if (step.kind === 'place') {
        api.onTap?.(() => {});
        const go = el('button', { class: 'primary', onclick: () => submit(tool.value()) }, 'Aquí está ✓');
        controls.append(el('p', { class: 'note' }, '✈ Arrastra el avión en la carta y luego confirma.'), go);
      }
    });
  }

  // ---- prueba final y cierre ----
  async function prueba() {
    ctx.nav('mision', { mission: M.id, step: null, view: 'prueba' });
    currentStep = 'prueba';
    document.body.classList.remove('misiones-wide');
    const box = el('div', {});
    root.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'lesson-kicker' }, `${M.icon || '🛩️'} Misión ${M.n} · ${M.title} — prueba final`),
      el('p', { class: 'note' }, 'Preguntas reales del examen sobre lo que acabas de practicar. Lo que falles vuelve solo en tus repasos.')), box);
    await quizPlayer(box, { type: 'quiz', source: 'ids', ids: M.questions, category: 'VUELO EN RUTA', mission: M.id, cap: 8, title: `Prueba · ${M.title}` }, ctx);
    ctx.refresh();
    document.body.classList.add('misiones-wide');
  }

  function fin() {
    finished = true;
    currentStep = null;
    ctx.append({ kind: 'mission_progress', detail: {
      mission: M.id, title: M.title, completed: true, seconds: runTimer.seconds(), steps_done: stepsDone, last_step: lastDone,
    } });
    ctx.nav('mision', { mission: M.id, step: null, view: 'fin' });
    root.replaceChildren(grid);
    const api = mountSurface('carta', { route: M.route });
    setTimeout(() => api.flyRoute(M.route), 300);
    const nextM = ctx.data.misiones.missions.find(m => m.n === M.n + 1);
    panel.replaceChildren(...header('¡completa!', `🏁 ¡Misión ${M.n} completa!`, M.steps.length + 1),
      el('p', { class: 'mision-prompt' }, `Volaste «${M.title}» de punta a punta.`),
      el('div', { class: 'mision-receta' }, el('p', { class: 'lesson-kicker' }, 'Tus recetas de esta misión'),
        ...M.recetas.map(r => el('p', {}, el('b', {}, `${r.title}: `), r.body))),
      nextM?.live
        ? el('button', { class: 'primary', onclick: () => { teardown(); misionView(root, ctx, nextM.id, onExit); } }, `Siguiente: Misión ${nextM.n} · ${nextM.title} →`)
        : el('p', { class: 'note' }, nextM ? `La Misión ${nextM.n} (${nextM.title}) llega pronto.` : '¡Todas las misiones listas!'),
      el('button', { class: 'ghost', onclick: leave }, '← Volver al taller'));
    flashCelebrate(panel, '🏁 ¡Misión completa!');
  }

  // ---- recorrido ----
  const startIdx = startAt === 'prueba' ? M.steps.length : Math.max(0, M.steps.findIndex(s => s.id === startAt));
  if (startIdx === 0) await briefing();
  for (let i = startIdx; i < M.steps.length; i++) await runStep(M.steps[i], i);
  await prueba();
  fin();
}

/** Recetas que ya desbloqueó (un paso con receta terminado al menos una vez). */
export function unlockedRecetas(ctx) {
  const done = new Set(getLog().filter(r => r.kind === 'mission_step').map(r => r.detail?.step));
  return ctx.data.misiones.missions.flatMap(m => m.steps.filter(s => s.receta && done.has(s.id))
    .map(s => ({ mission: m, receta: m.recetas.find(r => r.id === s.receta) })));
}

/** Tarjeta del taller: progreso de las 6 misiones y «Continuar» a un clic. */
/** opts.onRepaso: abre la clase de la carta («¿Te costó? Repasa…») cuando ya empezó la Misión 1. */
export function misionesCard(root, ctx, backToTaller, opts = {}) {
  const box = el('div', { class: 'mision-card' }, el('p', { class: 'note' }, 'Cargando misiones…'));
  loadMisiones(ctx).then(() => {
    const prog = progressOf(ctx);
    const all = ctx.data.misiones.missions;
    const cur = currentMission(ctx);
    const play = (m, at) => misionView(root, ctx, m.id, backToTaller, at);
    const chips = el('div', { class: 'mision-chips' }, ...all.map(m => el('span', {
      class: `mision-chip ${!m.live ? 'soon' : prog[m.id].completed ? 'done' : m === cur ? 'cur' : ''}`,
      title: `Misión ${m.n} · ${m.title}${m.live ? '' : ' (próximamente)'}`,
    }, prog[m.id].completed ? '✓' : String(m.n))));
    const nodes = [chips];
    if (opts.onRepaso && prog.m1?.started) {
      nodes.push(el('button', { class: 'ghost', onclick: opts.onRepaso }, '📘 ¿Te costó la Misión 1? Repasa los capítulos 1–3 de «La carta, paso a paso»'));
    }
    if (cur) {
      const p = prog[cur.id];
      const stepIdx = cur.steps.findIndex(s => s.id === p.next);
      const label = !p.started ? `Empezar: Misión ${cur.n} · ${cur.title}`
        : p.next === 'prueba' ? `Continuar: Misión ${cur.n} · prueba final` : `Continuar: Misión ${cur.n} · paso ${stepIdx + 1} de ${cur.steps.length}`;
      nodes.push(el('button', { class: 'primary', onclick: () => play(cur, p.started ? p.next : null) }, `▶ ${label}`));
    } else {
      nodes.push(el('p', { class: 'note' }, '¡Terminaste todas las misiones disponibles! Puedes repetir cualquiera.'));
    }
    for (const m of all) {
      const done = prog[m.id].completed;
      nodes.push(el('button', { class: 'option', ...(m.live ? {} : { disabled: '' }), onclick: () => m.live && play(m, null) },
        el('span', { class: 'plan-week-title' }, `${m.icon || '🛩️'} Misión ${m.n} · ${m.title}`),
        el('span', { class: 'plan-week-sub' }, !m.live ? 'Próximamente' : done ? '✓ Completa — tócala para repetirla' : prog[m.id].started ? 'En curso' : `${m.steps.length} pasos + prueba con preguntas del examen`)));
    }
    const recs = unlockedRecetas(ctx);
    if (recs.length) {
      nodes.push(el('details', { class: 'mision-recetas' }, el('summary', {}, `🧾 Mis recetas (${recs.length})`),
        ...recs.map(({ mission, receta }) => el('p', {}, el('b', {}, `${receta.title} `), el('span', { class: 'note' }, `(Misión ${mission.n}) `), receta.body))));
    }
    box.replaceChildren(...nodes);
  }).catch(() => {
    box.replaceChildren(el('p', { class: 'note' }, 'Las misiones no cargaron. Conéctate un momento a internet y vuelve a abrir el taller.'));
  });
  return box;
}
