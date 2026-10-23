// La carta, paso a paso (spec 2026-10-22 carta-paso-a-paso): la clase guiada
// que enseña a leer la carta ANTES de las misiones. Cada tarjeta enfoca una
// cosa (en la carta de Perú, en un símbolo de la leyenda dibujado en grande o
// en la figura del examen), la explica en una frase, deja un truco para
// recordarla y le pide tocarla, arrastrarla o responder. Un error dice QUÉ tocó.
// Nunca bloquea: tras dos fallos se muestra la respuesta. Cada capítulo cierra
// con una prueba corta de preguntas reales. Todo queda en el log para el mentor:
// nav (pantalla y tiempo), clase_attempt (cada respuesta), clase_card (cada
// tarjeta terminada), clase_progress (capítulo terminado o abandonado).

import { el, quizPlayer, flashCelebrate } from './players.js';
import { getLog } from './store.js';
import { renderCarta } from './carta.js';
import { renderFigura } from './figura-overlay.js';
import { renderSimbolo } from './leyenda.js';
import { loadMisiones, misionView, activeTimer } from './misiones.js';
import { expectedValue, parseNumber } from './misiones-logic.js';
import { claseProgress, gradeCard, unlockedTrucos } from './clase-logic.js';

/** Carga perezosa de la clase (y de la carta de Perú, vía las misiones). */
export async function loadClase(ctx) {
  await loadMisiones(ctx);
  if (!ctx.data.clase) ctx.data.clase = await fetch('data/clase-carta.json').then(r => r.json());
  return ctx.data.clase;
}

const progressOf = (ctx) => claseProgress(getLog(), ctx.data.clase.chapters);

/** Capítulo que toca: el primero en vivo sin terminar (o null). */
export function currentChapter(ctx) {
  const prog = progressOf(ctx);
  return ctx.data.clase.chapters.find(c => c.live && !prog[c.id].completed) || null;
}

const fmtNum = (v, unit) => {
  if (unit === 'deg') return `${String(Math.round(((v % 360) + 360) % 360) || 360).padStart(3, '0')}°`;
  const n = Math.round(v).toLocaleString('es-PE').replace(/,/g, ' ');
  return unit === 'nm' ? `${n} NM` : unit === 'ft' ? `${n} ft` : n;
};
const UNIT_LABEL = { deg: '°', ft: 'ft', nm: 'NM' };

function trucoBox(truco, fresh) {
  return el('div', { class: 'mision-receta clase-truco' },
    el('p', { class: 'lesson-kicker' }, fresh ? '🧠 Truco nuevo — se guardó en «Mis trucos»' : '🧠 Truco'),
    el('h4', {}, `${truco.icon} ${truco.text}`));
}

/**
 * Juega un capítulo. startAt: id de tarjeta, 'prueba' o null (= desde el principio).
 * onExit() vuelve al taller.
 */
export async function claseView(root, ctx, chapterId, onExit, startAt = null) {
  await loadClase(ctx);
  const C = ctx.data.clase.chapters.find(c => c.id === chapterId);
  const chartId = ctx.data.misiones.missions.find(m => m.live)?.chart;
  const chart = ctx.data.cartas[chartId];
  const runTimer = activeTimer();
  let currentCard = null, cardsDone = 0, lastDone = null, finished = false;
  document.body.classList.add('misiones-wide');

  let cardCleanup = null;
  let surfaceApi = null;
  function teardown() {
    cardCleanup?.(); cardCleanup = null;
    surfaceApi?.destroy?.(); surfaceApi = null;
    document.body.classList.remove('misiones-wide');
    runTimer.stop();
  }
  function leave() { teardown(); onExit(); }
  function exitChapter() {
    if (!finished) {
      ctx.append({ kind: 'clase_progress', detail: {
        clase: C.id, title: C.title, completed: false, seconds: runTimer.seconds(), cards_done: cardsDone,
        last_card: currentCard || lastDone,
      } });
    }
    leave();
  }

  const surfaceBox = el('div', { class: 'mision-surface' });
  const panel = el('div', { class: 'mision-panel card' });
  const grid = el('div', { class: 'mision-grid' }, surfaceBox, panel);
  const exitBtn = () => el('button', { class: 'ghost mision-exit', onclick: exitChapter }, '← Salir del capítulo');

  function bar(activeIdx) {
    return el('div', { class: 'mision-steps', 'aria-label': `Tarjeta ${activeIdx + 1} de ${C.cards.length}` },
      ...C.cards.map((s, i) => el('i', { class: i < activeIdx ? 'done' : i === activeIdx ? 'on' : '' })),
      el('i', { class: `prueba ${activeIdx >= C.cards.length ? 'on' : ''}`, title: 'Prueba del capítulo' }));
  }
  function header(kicker, title, activeIdx) {
    return [el('p', { class: 'lesson-kicker' }, `📘 Cap. ${C.n} · ${C.title} — ${kicker}`), el('h3', { class: 'mision-title' }, title), bar(activeIdx)];
  }

  /** Monta la superficie de la tarjeta: carta, símbolo de la leyenda o figura del examen. */
  function mountSurface(card) {
    surfaceApi?.destroy?.();
    const s = card.surface;
    if (s === 'carta') {
      // sin ruta ni foco se ve la carta entera; con foco, se acerca a esa cosa
      surfaceApi = renderCarta(surfaceBox, chart, { route: card.route, explain: card.kind !== 'tap' });
      surfaceApi.kind = 'carta';
      const api = surfaceApi;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (card.focus) api.focusFeature(card.focus, 16);
        if (card.pulse) api.pulse(card.pulse);
      }));
    } else if (s?.simbolo) {
      surfaceApi = renderSimbolo(surfaceBox, s.simbolo);
      if (card.pulse) requestAnimationFrame(() => surfaceApi?.pulse(card.pulse));
    } else {
      surfaceApi = renderFigura(surfaceBox, s);
      surfaceApi.kind = 'figura';
      if (card.pulse) surfaceApi.highlight(card.pulse, 'hint');
    }
    return surfaceApi;
  }
  /** «Esto que tocaste es…»: popover en carta/símbolo, línea en el panel para la figura. */
  function whatIs(api, card, id) {
    if (api.kind === 'figura') return card.surface.hotspots?.find(h => h.id === id)?.says || null;
    api.explainFeature(id);
    return null;
  }

  function logCard(card, { tries, firstTry, revealed, seconds, extra = {} }) {
    ctx.append({ kind: 'clase_card', detail: {
      clase: C.id, card: card.id, title: card.title, tries, first_try_correct: firstTry, revealed, seconds, ...extra,
    } });
    cardsDone++; lastDone = card.id; currentCard = null;
  }

  // ---- una tarjeta ----
  function runCard(card, idx) {
    return new Promise(resolve => {
      currentCard = card.id;
      ctx.nav('clase', { clase: C.id, card: card.id, view: 'card' });
      root.replaceChildren(grid);
      window.scrollTo(0, 0);
      const api = mountSurface(card);
      const timer = activeTimer();
      let tries = 0, hintShown = false, firstTry = null, shownAt = Date.now(), tool = null, done = false;
      cardCleanup = () => { tool?.destroy?.(); timer.stop(); };

      const feedback = el('div', { class: 'mision-feedback', 'aria-live': 'polite' });
      const controls = el('div', { class: 'mision-controls' });
      panel.replaceChildren(...header(`tarjeta ${idx + 1} de ${C.cards.length}`, card.title, idx),
        idx === 0 && C.intro ? el('p', { class: 'note' }, C.intro) : '',
        el('p', { class: 'mision-prompt' }, card.prompt), controls, feedback, exitBtn());

      const next = (label = 'Siguiente →') => {
        const b = el('button', { class: 'primary', onclick: () => { cardCleanup?.(); cardCleanup = null; resolve(); } }, label);
        return b;
      };

      // ---- mira: solo mirar (y tocar para curiosear) ----
      if (card.kind === 'mira') {
        if (api.kind !== 'carta') api.onTap((id) => { if (id) whatIs(api, card, id); });
        const go = el('button', { class: 'primary', onclick: () => {
          logCard(card, { tries: 0, firstTry: null, revealed: false, seconds: timer.seconds() });
          cardCleanup?.(); cardCleanup = null;
          resolve();
        } }, 'Siguiente →');
        controls.append(
          card.truco ? trucoBox(card.truco, true) : '',
          el('p', { class: 'note' }, api.kind === 'figura' ? '' : '👆 Toca lo que quieras en el dibujo: te dice qué es.'),
          go);
        go.focus();
        return;
      }

      function submit(answer) {
        if (done) return;
        tries++;
        const { correct, off_by } = gradeCard(card, answer, chart);
        if (firstTry == null) firstTry = correct;
        ctx.append({ kind: 'clase_attempt', detail: {
          clase: C.id, card: card.id, try: tries, answer, correct, off_by: off_by == null ? null : Math.round(off_by * 10) / 10,
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
        if (card.kind === 'number') {
          const off1 = Math.round(Math.abs(off));
          lines.push(`Pusiste ${fmtNum(answer.value, card.unit)}: ${off > 0 ? 'te pasaste' : 'te faltó'} por ${card.unit === 'deg' ? `${off1}°` : fmtNum(off1, card.unit)}.`);
        } else if (card.kind === 'place') {
          api.showPoint(answer, 'bad');
          lines.push(`Lo soltaste a ${off.toFixed(1)} NM del punto (el avión rojo).`);
        } else if (card.kind === 'tap' && answer.feature) {
          api.highlight([answer.feature], 'bad');
          const says = whatIs(api, card, answer.feature);
          if (says) lines.push(`Tocaste: ${says}`);
        } else if (card.kind === 'choice') {
          lines.push(`«${card.options[answer.option]}» no es.`);
        }
        if (tries < 2) lines.push(`💡 ${card.hint}`);
        feedback.replaceChildren(el('div', { class: 'reveal bad' }, ...lines.map(t => el('p', {}, t))));
      }

      function finish(revealed, answer) {
        done = true;
        tool?.destroy?.(); tool = null;
        if (card.kind !== 'tap' || !revealed) api.clearMarks();
        if (card.kind === 'tap') api.highlight(card.targets, 'ok');
        if (card.kind === 'place') { api.showRing(card.target, card.tol, 'ok'); api.showPoint(answer, revealed ? 'me' : 'ok'); }
        controls.querySelectorAll('button, input').forEach(n => { n.disabled = true; });
        if (card.kind === 'choice') controls.querySelectorAll('.option').forEach(b => { if (Number(b.dataset.orig) === card.answer) b.classList.add('correct'); });
        logCard(card, { tries, firstTry: !!firstTry, revealed, seconds: timer.seconds() });
        const answerText = card.kind === 'number' ? `La respuesta: ${fmtNum(expectedValue(card, chart), card.unit)}.`
          : card.kind === 'choice' ? `La respuesta: ${card.options[card.answer]}.` : '';
        const go = next('Seguir →');
        feedback.replaceChildren(el('div', { class: `reveal ${revealed ? 'bad' : 'ok'}` },
          el('p', { class: 'reason' }, revealed ? `Esta vez te la mostramos. ${answerText}` : '✅ ¡Correcto!'),
          el('p', {}, card.explain_ok)),
          card.truco ? trucoBox(card.truco, true) : '', go);
        if (!revealed) flashCelebrate(panel, '📘 ¡Bien!');
        go.focus();
      }

      // ---- controles según el tipo ----
      if (card.kind === 'tap') {
        controls.append(el('p', { class: 'note' }, api.kind === 'figura' ? '👆 Toca en la figura.' : '👆 Toca en el dibujo.'));
        if (api.kind === 'figura' && card.outline) api.outline(card.surface.hotspots.map(h => h.id));
        api.onTap((id) => {
          if (id) return submit({ feature: id });
          if (api.kind === 'figura' && !done) feedback.replaceChildren(el('p', { class: 'note' }, card.outline ? 'Toca justo dentro de uno de los círculos marcados.' : 'Ahí no hay nada que tocar. Prueba otra vez.'));
        });
      } else if (card.kind === 'choice') {
        api.onTap?.((id) => { if (id && api.kind === 'simbolo') whatIs(api, card, id); });
        const order = card.options.map((t, i) => ({ t, i })).sort(() => Math.random() - 0.5);
        for (const o of order) {
          controls.append(el('button', { class: 'option', 'data-orig': o.i, onclick: function () {
            if (done) return;
            submit({ option: o.i });
            if (!done) { this.disabled = true; this.classList.add('wrong'); }
          } }, o.t));
        }
      } else if (card.kind === 'number') {
        api.onTap?.((id) => { if (id && api.kind === 'simbolo') whatIs(api, card, id); });
        const input = el('input', { class: 'math-input mision-input', inputmode: 'decimal', autocomplete: 'off', 'aria-label': `Respuesta en ${UNIT_LABEL[card.unit] || ''}` });
        const go = el('button', { class: 'primary', onclick: send }, 'Comprobar');
        function send() {
          const v = parseNumber(input.value);
          if (!Number.isFinite(v)) { input.focus(); return; }
          submit({ value: v });
          if (!done) { input.select(); input.focus(); }
        }
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
        controls.append(el('div', { class: 'mision-numrow' }, input, el('span', { class: 'mision-unit' }, UNIT_LABEL[card.unit] || '')), go);
        setTimeout(() => input.focus(), 50);
      } else if (card.kind === 'place') {
        api.onTap?.(() => {});
        tool = api.placePlane(card.start, { readout: card.readout !== false });
        const go = el('button', { class: 'primary', onclick: () => submit(tool.value()) }, 'Aquí está ✓');
        controls.append(el('p', { class: 'note' }, '✈ Arrastra el avión en la carta y luego confirma.'), go);
      } else if (card.kind === 'drag') {
        dragCard();
      }

      // ---- arrastrar etiquetas a las partes del símbolo ----
      // También sin arrastrar: toca una etiqueta y luego la parte (trackpad, teclado).
      function dragCard() {
        const placed = new Set(), wrongBy = {};
        let drops = 0, wrong = 0, anyRevealed = false, selected = null;
        const tray = el('div', { class: 'clase-tray' });
        controls.append(el('p', { class: 'note' }, '✋ Arrastra cada etiqueta a su parte del dibujo (o tócala y luego toca la parte).'), tray);

        function settle(label, chip, part, revealed) {
          placed.add(label.id);
          chip.classList.remove('sel');
          chip.classList.add(revealed ? 'revealed' : 'placed');
          chip.disabled = true;
          chip.textContent = `${revealed ? '↺' : '✓'} ${label.text}`;
          api.highlight([part], revealed ? 'hint' : 'ok');
          if (placed.size === card.labels.length) {
            done = true;
            // intentos = soltadas equivocadas + 1 (poner cada etiqueta no cuenta como intento)
            logCard(card, { tries: wrong + 1, firstTry: wrong === 0, revealed: anyRevealed, seconds: timer.seconds(), extra: { multi: true, drops } });
            const go = next('Seguir →');
            feedback.replaceChildren(el('div', { class: `reveal ${anyRevealed ? 'bad' : 'ok'}` },
              el('p', { class: 'reason' }, anyRevealed ? 'Listo — algunas te las pusimos nosotros.' : '✅ ¡Todas en su lugar!'),
              el('p', {}, card.explain_ok)), card.truco ? trucoBox(card.truco, true) : '', go);
            if (!anyRevealed) flashCelebrate(panel, '📘 ¡Bien!');
            go.focus();
          }
        }
        function drop(label, chip, part) {
          if (placed.has(label.id) || done) return;
          drops++;
          const { correct } = gradeCard(card, { label: label.id, part });
          ctx.append({ kind: 'clase_attempt', detail: {
            clase: C.id, card: card.id, try: drops, answer: { label: label.id, part }, correct, off_by: null,
            ms_to_answer: Date.now() - shownAt, hint_shown: hintShown,
          } });
          shownAt = Date.now();
          if (correct) { feedback.replaceChildren(); api.hidePop?.(); return settle(label, chip, part, false); }
          wrong++;
          wrongBy[label.id] = (wrongBy[label.id] || 0) + 1;
          whatIs(api, card, part);
          if (wrongBy[label.id] >= 2) {
            anyRevealed = true;
            feedback.replaceChildren(el('div', { class: 'reveal bad' }, el('p', {}, `«${label.text}» va aquí — te la pusimos.`)));
            return settle(label, chip, card.slots[label.id], true);
          }
          hintShown = true;
          feedback.replaceChildren(el('div', { class: 'reveal bad' }, el('p', {}, `«${label.text}» no va ahí.`), el('p', {}, `💡 ${card.hint}`)));
          chip.classList.add('bounce');
          setTimeout(() => chip.classList.remove('bounce'), 400);
        }
        const partAt = (x, y) => Object.keys(api.parts).find(pid => {
          const r = api.partRect(pid);
          return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });

        const order = [...card.labels].sort(() => Math.random() - 0.5);
        for (const label of order) {
          const chip = el('button', { class: 'clase-chip', type: 'button' }, label.text);
          chip.addEventListener('click', () => {
            if (placed.has(label.id)) return;
            tray.querySelectorAll('.clase-chip.sel').forEach(c => c.classList.remove('sel'));
            selected = selected?.label === label ? null : { label, chip };
            if (selected) chip.classList.add('sel');
          });
          chip.addEventListener('pointerdown', (e) => {
            if (placed.has(label.id) || done) return;
            const start = { x: e.clientX, y: e.clientY };
            let ghost = null;
            const move = (ev) => {
              if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
              if (!ghost) { ghost = el('div', { class: 'clase-chip ghost-chip' }, label.text); document.body.append(ghost); }
              ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`;
            };
            const up = (ev) => {
              window.removeEventListener('pointermove', move);
              window.removeEventListener('pointerup', up);
              if (!ghost) return; // fue un clic: lo maneja 'click'
              ghost.remove();
              const part = partAt(ev.clientX, ev.clientY);
              if (part) drop(label, chip, part);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
          });
          tray.append(chip);
        }
        api.onTap((pid) => {
          if (!pid) return;
          if (selected) { const s = selected; selected = null; drop(s.label, s.chip, pid); }
          else whatIs(api, card, pid);
        });
      }
    });
  }

  // ---- prueba del capítulo y cierre ----
  async function prueba() {
    ctx.nav('clase', { clase: C.id, card: null, view: 'prueba' });
    currentCard = 'prueba';
    document.body.classList.remove('misiones-wide');
    const box = el('div', {});
    root.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'lesson-kicker' }, `📘 Cap. ${C.n} · ${C.title} — prueba`),
      el('p', { class: 'note' }, 'Preguntas reales del examen sobre lo que acabas de ver. Lo que falles vuelve solo en tus repasos.')), box);
    await quizPlayer(box, { type: 'quiz', source: 'ids', ids: C.teaches, category: 'VUELO EN RUTA', clase: C.id, cap: 5, title: `Prueba · ${C.title}` }, ctx);
    ctx.refresh();
    document.body.classList.add('misiones-wide');
  }

  function fin() {
    finished = true;
    currentCard = null;
    ctx.append({ kind: 'clase_progress', detail: {
      clase: C.id, title: C.title, completed: true, seconds: runTimer.seconds(), cards_done: cardsDone, last_card: lastDone,
    } });
    ctx.nav('clase', { clase: C.id, card: null, view: 'fin' });
    root.replaceChildren(grid);
    window.scrollTo(0, 0);
    surfaceApi?.destroy?.();
    surfaceApi = renderCarta(surfaceBox, chart, { explain: true });
    const trucos = C.cards.filter(c => c.truco);
    const mission = ctx.data.misiones.missions.find(m => m.id === C.practice_mission);
    const nextC = ctx.data.clase.chapters.find(c => c.n === C.n + 1);
    panel.replaceChildren(...header('¡completo!', `🏁 ¡Capítulo ${C.n} completo!`, C.cards.length + 1),
      el('p', { class: 'mision-prompt' }, `Terminaste «${C.title}».`),
      trucos.length ? el('div', { class: 'mision-receta' }, el('p', { class: 'lesson-kicker' }, 'Tus trucos de este capítulo'),
        ...trucos.map(c => el('p', {}, `${c.truco.icon} ${c.truco.text}`))) : '',
      mission?.live ? el('button', { class: 'primary', onclick: () => { teardown(); misionView(root, ctx, mission.id, onExit); } }, `🛩️ Practícalo: Misión ${mission.n} · ${mission.title} →`) : '',
      nextC?.live
        ? el('button', { class: mission?.live ? 'ghost' : 'primary', onclick: () => { teardown(); claseView(root, ctx, nextC.id, onExit); } }, `📘 Siguiente: Cap. ${nextC.n} · ${nextC.title} →`)
        : el('p', { class: 'note' }, nextC ? `El capítulo ${nextC.n} (${nextC.title}) llega pronto.` : '¡Terminaste la clase!'),
      el('button', { class: 'ghost', onclick: leave }, '← Volver al taller'));
    flashCelebrate(panel, '🏁 ¡Capítulo completo!');
  }

  // ---- recorrido ----
  const startIdx = startAt === 'prueba' ? C.cards.length : Math.max(0, C.cards.findIndex(c => c.id === startAt));
  for (let i = startIdx; i < C.cards.length; i++) await runCard(C.cards[i], i);
  await prueba();
  fin();
}

/** Todos los trucos desbloqueados, por capítulo; imprimible para repasar antes del examen. */
export async function trucosView(root, ctx, onExit) {
  await loadClase(ctx);
  ctx.nav('clase', { clase: null, card: null, view: 'trucos' });
  const chapters = ctx.data.clase.chapters.filter(c => c.live);
  const got = unlockedTrucos(getLog(), chapters);
  const total = chapters.reduce((n, c) => n + c.cards.filter(k => k.truco).length, 0);
  root.replaceChildren(el('div', { class: 'card clase-trucos' },
    el('p', { class: 'lesson-kicker' }, '📘 La carta, paso a paso'),
    el('h3', {}, `🧠 Mis trucos (${got.length} de ${total})`),
    el('p', { class: 'note no-print' }, 'Cada truco aparece cuando terminas su tarjeta. Imprímelos y repásalos la noche antes del examen.'),
    ...chapters.map(ch => {
      const mine = got.filter(t => t.chapter.id === ch.id);
      const locked = ch.cards.filter(k => k.truco).length - mine.length;
      return el('section', { class: 'clase-trucos-ch' },
        el('h4', {}, `${ch.icon} Cap. ${ch.n} · ${ch.title}`),
        ...mine.map(t => el('p', { class: 'clase-truco-line' }, el('span', { class: 'ic' }, t.truco.icon), ' ', t.truco.text)),
        locked ? el('p', { class: 'note' }, `🔒 ${locked} por desbloquear`) : '');
    }),
    el('div', { class: 'widget-btnrow no-print' },
      el('button', { class: 'widget-btn', onclick: () => window.print() }, '🖨️ Imprimir'),
      el('button', { class: 'widget-btn', onclick: onExit }, '← Volver'))));
  window.scrollTo(0, 0);
}

/** Tarjeta del taller: progreso de los 7 capítulos, «Continuar» a un clic y «Mis trucos». */
export function claseCardView(root, ctx, backToTaller) {
  const box = el('div', { class: 'mision-card' }, el('p', { class: 'note' }, 'Cargando la clase…'));
  loadClase(ctx).then(() => {
    const prog = progressOf(ctx);
    const all = ctx.data.clase.chapters;
    const cur = currentChapter(ctx);
    const play = (c, at) => claseView(root, ctx, c.id, backToTaller, at);
    const nodes = [el('div', { class: 'mision-chips' }, ...all.map(c => el('span', {
      class: `mision-chip ${!c.live ? 'soon' : prog[c.id].completed ? 'done' : c === cur ? 'cur' : ''}`,
      title: `Cap. ${c.n} · ${c.title}${c.live ? '' : ' (próximamente)'}`,
    }, prog[c.id].completed ? '✓' : String(c.n))))];
    if (cur) {
      const p = prog[cur.id];
      const idx = cur.cards.findIndex(k => k.id === p.next);
      const label = !p.started ? `Empezar: Cap. ${cur.n} · ${cur.title}`
        : p.next === 'prueba' ? `Continuar: Cap. ${cur.n} · prueba` : `Continuar: Cap. ${cur.n} · tarjeta ${idx + 1} de ${cur.cards.length}`;
      nodes.push(el('button', { class: 'primary', onclick: () => play(cur, p.started ? p.next : null) }, `▶ ${label}`));
    } else {
      nodes.push(el('p', { class: 'note' }, '¡Terminaste todos los capítulos disponibles! Puedes repetir cualquiera.'));
    }
    for (const c of all) {
      const done = prog[c.id].completed;
      nodes.push(el('button', { class: 'option', ...(c.live ? {} : { disabled: '' }), onclick: () => c.live && play(c, null) },
        el('span', { class: 'plan-week-title' }, `${c.icon} Cap. ${c.n} · ${c.title}`),
        el('span', { class: 'plan-week-sub' }, !c.live ? 'Próximamente' : done ? '✓ Completo — tócalo para repetirlo' : prog[c.id].started ? 'En curso' : `${c.cards.length} tarjetas + prueba corta`)));
    }
    const n = unlockedTrucos(getLog(), all).length;
    nodes.push(el('button', { class: 'ghost', onclick: () => trucosView(root, ctx, backToTaller) }, `🧠 Mis trucos (${n})`));
    box.replaceChildren(...nodes);
  }).catch(() => {
    box.replaceChildren(el('p', { class: 'note' }, 'La clase no cargó. Conéctate un momento a internet y vuelve a abrir el taller.'));
  });
  return box;
}
