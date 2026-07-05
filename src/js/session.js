// Corredor de sesión (SPEC §5.1): bloques en orden, temporizador visible,
// lo próximo oculto hasta llegar. Saltar exige motivo (queda en el log y lo ve
// el mentor). El cursor sobrevive recargas (estado de UI, no de verdad — la
// verdad es el log).

import { el, breakScreen, fmtTime, quizPlayer, drillPlayer, recallPlayer, rapidfirePlayer, scenarioPlayer, teachbackPlayer, simulacroPlayer, lecturaPlayer, oralPlayer } from './players.js';

const CURSOR_KEY = 'rumbo_cursor_v1';

const PLAYERS = {
  quiz: quizPlayer, redo: quizPlayer, chart: quizPlayer,
  drill: drillPlayer, lectura: lecturaPlayer, recall: recallPlayer,
  rapidfire: rapidfirePlayer, scenario: scenarioPlayer,
  teachback: teachbackPlayer, oral: oralPlayer, simulacro: simulacroPlayer,
};

export function loadCursor(todayKey) {
  try {
    const c = JSON.parse(localStorage.getItem(CURSOR_KEY));
    return c?.date === todayKey ? c : { date: todayKey, s: 0, b: 0 };
  } catch { return { date: todayKey, s: 0, b: 0 }; }
}
function saveCursor(c) { localStorage.setItem(CURSOR_KEY, JSON.stringify(c)); }

function limaHHMM() {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(11, 16);
}

export async function runSession(root, plan, ctx, onExit) {
  const cursor = loadCursor(ctx.todayKey);
  const { config } = ctx.data;
  const minimo = plan.dayType === 'minimo';
  saveCursor({ ...cursor, dayType: plan.dayType }); // el tipo del día sobrevive recargas

  for (let s = cursor.s; s < plan.sessions.length; s++) {
    const session = plan.sessions[s];
    for (let b = (s === cursor.s ? cursor.b : 0); b < session.blocks.length; b++) {
      saveCursor({ date: ctx.todayKey, s, b });
      const block = session.blocks[b];
      const done = await runBlock(root, block, ctx, { session: session.name, minimo });
      if (!done.skipped) ctx.append({ kind: 'block', detail: { type: block.type, chapter: block.chapter || null, done: true, session: s + 1 } });
      ctx.refresh();
      const last = b === session.blocks.length - 1;
      if (!last) await breakScreen(root, config.schedule.break_minutes * 60);
    }
    ctx.append({ kind: 'block', detail: { type: 'session_end', session: s + 1, minimo } });
    ctx.refresh();
    saveCursor({ date: ctx.todayKey, s: s + 1, b: 0 });

    if (s < plan.sessions.length - 1) {
      const next = config.schedule.sessions[s + 1];
      root.replaceChildren(el('div', { class: 'card center' },
        el('h3', {}, `✅ ${session.name} completa`),
        el('p', {}, `La ${plan.sessions[s + 1].name} empieza a las ${next?.start || 'la próxima hora'}. Sal, come, muévete.`),
        el('button', { class: 'primary', onclick: () => root.dispatchEvent(new Event('nextsession')) }, `Empezar ${plan.sessions[s + 1].name}`),
        el('button', { class: 'ghost', onclick: onExit }, 'Volver al inicio')));
      await new Promise(res => root.addEventListener('nextsession', res, { once: true }));
    }
  }
  saveCursor({ date: ctx.todayKey, s: plan.sessions.length, b: 0 });
  root.replaceChildren(el('div', { class: 'card center' },
    el('h2', {}, '🎉 Día completo'),
    el('p', {}, plan.dayType === 'minimo' ? 'Día mínimo cumplido — la cadena sigue viva. Mañana, el plan completo.' : 'Todo el plan de hoy, hecho. Eso es lo que suma.'),
    el('button', { class: 'primary', onclick: onExit }, 'Volver al inicio')));
}

async function runBlock(root, block, ctx, { session, minimo }) {
  const { config } = ctx.data;
  const wrap = el('div', { class: 'session-wrap' });
  const blockRoot = el('div', { class: 'block-root' });
  let seconds = config.schedule.block_minutes * 60;
  const timerEl = el('span', { class: 'block-timer' }, fmtTime(seconds));
  const iv = setInterval(() => {
    seconds--;
    timerEl.textContent = seconds >= 0 ? fmtTime(seconds) : `+${fmtTime(-seconds)}`;
    if (seconds === 0) timerEl.classList.add('over');
  }, 1000);

  const skipBtn = el('button', { class: 'skip', onclick: askSkip }, 'Saltar');
  let skipResolve;
  const skipped = new Promise(res => { skipResolve = res; });

  function askSkip() {
    const reason = prompt('Saltar exige un motivo (lo verá el mentor):');
    if (reason && reason.trim().length >= 3) {
      ctx.append({ kind: 'block', detail: { type: block.type, chapter: block.chapter || null, skipped: true, reason: reason.trim(), session } });
      skipResolve({ skipped: true });
    }
  }

  // Sin límite duro (§4.4): pasada la hora de cierre planificada, una nota
  // suave — el objetivo es cubrir el material, no el reloj.
  const plannedEnd = config.schedule.sessions[config.schedule.sessions.length - 1]?.end || '18:00';
  const lateNote = limaHHMM() >= plannedEnd
    ? el('p', { class: 'note center' }, '🌙 Ya pasó la hora del plan — termina el material a tu ritmo. Si necesitas parar, para: mañana sigue.')
    : '';

  wrap.append(
    el('header', { class: 'block-header' },
      el('span', { class: 'block-title' }, `${session}${minimo ? ' · mínimo' : ''} — ${block.title}`),
      timerEl, skipBtn),
    lateNote,
    blockRoot);
  root.replaceChildren(wrap);

  const player = PLAYERS[block.type];
  const played = player ? player(blockRoot, block, ctx).then(() => ({ skipped: false })) : Promise.resolve({ skipped: false });
  const result = await Promise.race([played, skipped]);
  clearInterval(iv);
  return result;
}
