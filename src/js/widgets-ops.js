// Widgets de operaciones y navegación (cap. 14 y 16) — SPEC §3.4, §5.11.
// Se usan dentro de las lecciones y en el taller. Como todo widget: nunca
// puntúan ni registran filas; la racha que muestran es solo un festejo
// visual en el momento (§5.9 micro-celebraciones).

import { el, flashCelebrate } from './players.js';
import { svg, txt, slider, arrowDefs, dir } from './widget-kit.js';
import {
  hdg, hdgStr, rwyStr, angleDiff, bestRunway, windsockPoints, patternLegs, patternSideHeading,
  AIRFIELDS, LEG_NAMES, windTriangle, toMagnetic, varStr,
  TAXI_MAP, TAXI_SCENARIOS, evaluateMove, neighbors, edgeBetween,
} from './ops-logic.js';

const pt = (c, v, k) => ({ x: c.x + v.x * k, y: c.y + v.y * k });
const line = (a, b, attrs) => svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...attrs });
const COMPASS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
const compassName = (h) => COMPASS[Math.round(hdg(h) / 45) % 8];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sideWord = (s) => (s === 'der' ? 'derecho' : 'izquierdo');

function streakCounter(container) {
  let n = 0;
  return (ok) => {
    n = ok ? n + 1 : 0;
    if (ok && n > 0 && n % 4 === 0) flashCelebrate(container, `¡${n} seguidas! 🔥`);
  };
}

// =====================================================================
// 🗼 Tú eres la torre: viento → pista → lado del patrón → rumbos
// =====================================================================
export function torre(container, params = {}) {
  let af = AIRFIELDS.find(a => a.id === params.airfield) || AIRFIELDS[0];
  let wind = params.wind ?? 330;
  const windKt = 10;
  let stage = 'rwy', rwy = null;
  const streak = streakCounter(container);

  const C = { x: 250, y: 185 };
  const INSET = { x: 60, y: 62 }, R = 26;
  const root = svg('svg', { viewBox: '0 0 400 340', role: 'img', 'aria-label': 'Aeródromo con círculo segmentado, manga, tetraedro y pista' });
  const { defs, url } = arrowDefs({ ok: 'var(--ok)', bad: 'var(--bad)', ac: 'var(--accent)', mu: 'var(--muted)' });
  const layer = svg('g', {});
  root.append(defs, layer);

  const afRow = el('div', { class: 'widget-btnrow' });
  const note = el('p', { class: 'note center' });
  const windLine = el('p', { class: 'center', style: 'font-weight:700' });
  const windSlider = slider(10, 360, wind, 10, (v) => { wind = v; reset(); });
  const question = el('p', { class: 'check-q' });
  const answers = el('div', {});
  const feedback = el('p', { class: 'reason' });
  const feedback2 = el('p', { class: 'reason' });
  const legsBox = el('div', {});
  const nextBtn = el('button', { class: 'ghost', onclick: randomChallenge }, '🎲 Nuevo reto');

  function drawAirfield() {
    layer.replaceChildren();
    // --- círculo segmentado (inserto) ---
    layer.append(svg('circle', { cx: INSET.x, cy: INSET.y, r: R, fill: 'none', stroke: 'var(--text)', 'stroke-width': 4, 'stroke-dasharray': '8 6' }));
    for (const n of af.ends) {
      const a = dir(n * 10 + 180); // la L va en el extremo de aproximación
      const s = dir(patternSideHeading(n, af.sides[n]));
      const p1 = pt(INSET, a, R + 6), p2 = pt(INSET, a, R + 26);
      layer.append(
        line(p1, p2, { stroke: 'var(--text)', 'stroke-width': 4, 'stroke-linecap': 'square' }),
        line(p2, pt(p2, s, 12), { stroke: 'var(--text)', 'stroke-width': 4, 'stroke-linecap': 'square' }));
    }
    // manga al centro: apunta hacia donde VA el viento
    const d = dir(windsockPoints(wind)), q = { x: -d.y, y: d.x };
    const tip = pt(INSET, d, 24);
    layer.append(
      svg('polygon', { points: [pt(INSET, q, 5), pt(tip, q, 2), pt(tip, q, -2), pt(INSET, q, -5)].map(p => `${p.x},${p.y}`).join(' '), fill: 'var(--accent)' }),
      svg('circle', { cx: INSET.x, cy: INSET.y, r: 2.5, fill: 'var(--text)' }),
      txt(INSET.x, INSET.y + R + 46, 'círculo segmentado', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }));
    // tetraedro: la punta apunta HACIA el viento (hacia donde aterrizas)
    const T = { x: 60, y: 160 }, w = dir(wind), wq = { x: -w.y, y: w.x };
    const back = pt(T, w, -10);
    layer.append(
      svg('polygon', { points: [pt(T, w, 14), pt(back, wq, 8), pt(back, wq, -8)].map(p => `${p.x},${p.y}`).join(' '), fill: 'var(--warn)', stroke: 'var(--text)', 'stroke-width': 1 }),
      txt(60, 190, 'tetraedro', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }));

    // --- pista ---
    const u = dir(af.ends[0] * 10), uq = { x: -u.y, y: u.x };
    const e1 = pt(C, u, 56), e2 = pt(C, u, -56);
    layer.append(
      svg('polygon', { points: [pt(e1, uq, 8), pt(e2, uq, 8), pt(e2, uq, -8), pt(e1, uq, -8)].map(p => `${p.x},${p.y}`).join(' '), fill: 'var(--panel-2)', stroke: 'var(--text)', 'stroke-width': 1.5 }),
      line(pt(C, u, 34), pt(C, u, -34), { stroke: 'var(--text)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }));
    for (const n of af.ends) {
      // el número de una pista va pintado en su extremo de aproximación
      const p = pt(C, dir(n * 10 + 180), 45);
      layer.append(txt(p.x, p.y + 5, rwyStr(n), { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15, fill: n === rwy ? 'var(--accent)' : 'var(--text)' }));
    }
    if (af.avoid !== undefined) {
      const p = pt(C, dir(af.avoid), 122);
      layer.append(txt(p.x, p.y, af.avoid === 180 ? '🏘️ pueblo' : '⛰️ cerro', { 'text-anchor': 'middle', 'font-size': 13 }));
    }
    // viento (flecha arriba a la derecha) y norte
    const WC = { x: 360, y: 44 }, wd = dir(windsockPoints(wind));
    layer.append(
      line(pt(WC, wd, -20), pt(WC, wd, 18), { stroke: 'var(--bad)', 'stroke-width': 3, 'marker-end': url('bad') }),
      txt(360, 82, 'viento', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--bad)' }),
      line({ x: 382, y: 330 }, { x: 382, y: 306 }, { stroke: 'var(--muted)', 'stroke-width': 2, 'marker-end': url('mu') }),
      txt(382, 300, 'N', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }));
    if (stage === 'done') drawPattern();
  }

  function drawPattern() {
    const side = af.sides[rwy];
    const u = dir(rwy * 10), p = dir(patternSideHeading(rwy, side));
    const L = 86, D = 60;
    const P1 = pt(C, u, L), P2 = pt(P1, p, D), P4 = pt(C, u, -L), P3 = pt(P4, p, D);
    const legs = patternLegs(rwy, side);
    const seg = (a, b, key, labelAt) => {
      layer.append(line(a, b, { stroke: 'var(--ok)', 'stroke-width': 2.5, 'marker-end': url('ok') }));
      layer.append(txt(labelAt.x, labelAt.y + 4, `${hdgStr(legs[key])}°`, { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: 'var(--ok)' }));
    };
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    seg(pt(C, u, 20), P1, 'upwind', pt(pt(P1, u, 4), p, -24));
    seg(P1, P2, 'crosswind', pt(mid(P1, P2), u, 18));
    seg(P2, P3, 'downwind', pt(mid(P2, P3), p, 18));
    seg(P3, P4, 'base', pt(mid(P3, P4), u, -18));
    seg(P4, pt(C, u, -58), 'final', pt(pt(P4, u, -4), p, -24));
    // entrada a 45° al punto medio del tramo a favor del viento
    const dm = mid(P2, P3);
    const entry = { x: (u.x + p.x) / Math.SQRT2, y: (u.y + p.y) / Math.SQRT2 };
    layer.append(
      line(pt(dm, entry, 44), pt(dm, entry, 6), { stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'marker-end': url('ac') }));
    const lbl = pt(dm, entry, 52);
    layer.append(txt(lbl.x, lbl.y, 'entrada 45°', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--accent)' }));
  }

  function renderControls() {
    afRow.replaceChildren(...AIRFIELDS.map(a => el('button', {
      class: `widget-btn${a === af ? ' active' : ''}`, onclick: () => { af = a; reset(); },
    }, a.name)));
    note.textContent = af.note;
    windLine.textContent = `Viento: ${hdgStr(wind)}° a ${windKt} kt (viene del ${compassName(wind)})`;
  }

  function reset() {
    stage = 'rwy'; rwy = null;
    feedback.textContent = ''; feedback2.textContent = ''; legsBox.replaceChildren();
    feedback.hidden = true; feedback2.hidden = true;
    askRunway();
  }

  function askRunway() {
    renderControls();
    question.textContent = '1) Mira la manga. ¿En qué pista aterrizas?';
    answers.replaceChildren(...af.ends.map(n => el('button', { class: 'option', onclick: () => chooseRunway(n) }, `Pista ${rwyStr(n)}`)));
    drawAirfield();
  }

  function chooseRunway(n) {
    const r = bestRunway(wind, af.ends);
    const ok = r.ambiguous || n === r.best;
    streak(ok);
    rwy = r.ambiguous ? n : r.best;
    const sock = hdgStr(windsockPoints(wind));
    if (r.ambiguous) {
      feedback.textContent = `Viento casi cruzado puro: ninguna cabecera te da viento de frente, las dos valen. En la vida real decide el tráfico que ya está en el circuito (o el ATC). Seguimos con la ${rwyStr(rwy)}.`;
    } else if (ok) {
      feedback.textContent = `✅ Pista ${rwyStr(rwy)} (rumbo ${hdgStr(rwy * 10)}°): de frente al viento de ${hdgStr(wind)}°. La manga apunta a ${sock}° — hacia donde VA el viento — y tú aterrizas al revés de la manga.`;
    } else {
      feedback.textContent = `❌ En la ${rwyStr(n)} tendrías viento de cola. El viento VIENE de ${hdgStr(wind)}° (la manga apunta a ${sock}°, hacia donde va). Aterrizas contra el viento: pista ${rwyStr(rwy)}, rumbo ${hdgStr(rwy * 10)}°. Seguimos con esa.`;
    }
    feedback.hidden = false;
    stage = 'side';
    question.textContent = `2) Pista ${rwyStr(rwy)}: mira su L en el círculo segmentado. ¿Patrón izquierdo o derecho?`;
    answers.replaceChildren(
      el('button', { class: 'option', onclick: () => chooseSide('izq') }, 'Patrón izquierdo (virajes a la izquierda)'),
      el('button', { class: 'option', onclick: () => chooseSide('der') }, 'Patrón derecho (virajes a la derecha)'));
    drawAirfield();
  }

  function chooseSide(s) {
    const right = af.sides[rwy];
    const ok = s === right;
    streak(ok);
    feedback2.hidden = false;
    feedback2.textContent = (ok ? '✅ ' : '❌ ') +
      `La L de la ${rwyStr(rwy)} está en su extremo de aproximación: el palo largo es la final y el corto es el básico, que viene desde la ${right === 'der' ? 'derecha' : 'izquierda'}. Patrón ${sideWord(right)}.` +
      (af.avoid !== undefined ? ' Así el circuito nunca pasa sobre el ' + (af.avoid === 180 ? 'pueblo.' : 'cerro.') : '');
    stage = 'done';
    question.textContent = '3) Tu circuito, con el rumbo de cada tramo:';
    answers.replaceChildren();
    const legs = patternLegs(rwy, right);
    legsBox.replaceChildren(el('div', { class: 'table-scroll' }, el('table', { class: 'lesson-table' },
      el('tr', {}, el('th', {}, 'Tramo'), el('th', {}, 'Rumbo')),
      ...Object.keys(LEG_NAMES).map(k => el('tr', {}, el('td', {}, LEG_NAMES[k]), el('td', {}, `${hdgStr(legs[k])}°`))))),
      el('p', { class: 'note' }, `A 1,000 ft sobre el terreno (AGL). Entras a 45° al punto medio del tramo a favor del viento.`));
    drawAirfield();
  }

  function randomChallenge() {
    af = pick(AIRFIELDS);
    const end = pick(af.ends);
    wind = hdg(end * 10 + pick([-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50]));
    windSlider.value = wind;
    reset();
  }

  container.append(afRow, note, root, windLine, windSlider,
    el('p', { class: 'note center' }, 'Mueve el viento o pide un reto nuevo.'),
    question, answers, feedback, feedback2, legsBox, nextBtn);
  reset();
}

// =====================================================================
// 🚕 Rodaje: sigue la autorización sin incursiones en pista
// =====================================================================
export function rodaje(container, params = {}) {
  const M = TAXI_MAP;
  let sc = Math.max(0, TAXI_SCENARIOS.findIndex(s => s.id === params.scenario));
  let stageIdx = 0, pos = null, trail = [], lastTw = null, locked = false, incursions = 0;

  const root = svg('svg', { viewBox: '0 0 360 320', role: 'img', 'aria-label': 'Plano de un aeródromo con pistas 09-27 y 18-36, calles de rodaje y plataforma' });
  const base = svg('g', {}), dyn = svg('g', {});
  root.append(base, dyn);

  const header = el('div', { class: 'widget-btnrow' });
  const clearance = el('div', { class: 'callout callout-clave' });
  const signs = el('div', { class: 'sign-bar' });
  const status = el('p', { class: 'reason' });
  const actions = el('div', {});

  const N = (id) => M.nodes[id];
  const runwayNeighbor = (id) => neighbors(id).map(n => n.id).find(n => N(n).runway);

  function drawBase() {
    base.append(svg('rect', { x: M.ramp.x, y: M.ramp.y, width: M.ramp.w, height: M.ramp.h, rx: 6, fill: 'var(--panel-2)' }),
      txt(M.ramp.x + M.ramp.w / 2, M.ramp.y + M.ramp.h - 10, 'Plataforma', { 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }));
    for (const [a, b] of M.edges) {
      base.append(line(N(a), N(b), { stroke: 'var(--panel-2)', 'stroke-width': 12, 'stroke-linecap': 'round' }));
    }
    for (const [a, b] of M.edges) base.append(line(N(a), N(b), { stroke: 'var(--warn)', 'stroke-width': 1.5 }));
    for (const r of M.runways) {
      const horiz = r.y1 === r.y2;
      base.append(
        svg('rect', horiz
          ? { x: r.x1, y: r.y1 - 9, width: r.x2 - r.x1, height: 18, fill: 'var(--text)', 'fill-opacity': 0.78 }
          : { x: r.x1 - 9, y: r.y1, width: 18, height: r.y2 - r.y1, fill: 'var(--text)', 'fill-opacity': 0.78 }),
        line({ x: r.x1 + (horiz ? 14 : 0), y: r.y1 + (horiz ? 0 : 14) }, { x: r.x2 - (horiz ? 14 : 0), y: r.y2 - (horiz ? 0 : 14) },
          { stroke: 'var(--bg)', 'stroke-width': 1.5, 'stroke-dasharray': '8 6' }));
      if (horiz) {
        base.append(txt(r.x1 + 16, r.y1 - 15, r.ends[0], { 'font-weight': 700 }), txt(r.x2 - 16, r.y1 - 15, r.ends[1], { 'font-weight': 700, 'text-anchor': 'end' }));
      } else {
        base.append(txt(r.x1 - 14, r.y1 + 14, r.ends[0], { 'font-weight': 700, 'text-anchor': 'end' }), txt(r.x1 - 14, r.y2 - 4, r.ends[1], { 'font-weight': 700, 'text-anchor': 'end' }));
      }
    }
    // marcas de espera: 2 sólidas del lado de la calle, 2 discontinuas del lado de la pista
    for (const [id, n] of Object.entries(M.nodes)) {
      if (!n.hold) continue;
      const rn = N(runwayNeighbor(id));
      const len = Math.hypot(rn.x - n.x, rn.y - n.y);
      const v = { x: (rn.x - n.x) / len, y: (rn.y - n.y) / len }, q = { x: -v.y, y: v.x };
      for (const [t, dashed] of [[-5, false], [-2, false], [2, true], [5, true]]) {
        const c = pt(n, v, t);
        base.append(line(pt(c, q, -8), pt(c, q, 8), { stroke: 'var(--warn)', 'stroke-width': 1.6, ...(dashed ? { 'stroke-dasharray': '2 2' } : {}) }));
      }
      let sgn = pt(n, q, 22);
      if (sgn.x + 17 > 360) sgn = pt(n, q, -22);
      base.append(svg('rect', { x: sgn.x - 17, y: sgn.y - 7, width: 34, height: 14, rx: 2, fill: 'var(--bad)' }),
        txt(sgn.x, sgn.y + 4, n.hold, { 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#fff' }));
    }
    // letreros de ubicación (negro con letra amarilla) a lo largo de cada calle
    for (const [tw, x, y] of [['E', 124, 186], ['A', 70, 146], ['A', 190, 146], ['A', 306, 146], ['B', 14, 104], ['C', 146, 104], ['D', 346, 104]]) {
      base.append(svg('rect', { x: x - 7, y: y - 8, width: 14, height: 15, rx: 2, fill: '#1c1b18', stroke: '#e8c547', 'stroke-width': 1 }),
        txt(x, y + 4, tw, { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#e8c547' }));
    }
  }

  function stage() { return TAXI_SCENARIOS[sc].stages[stageIdx]; }

  function drawDyn() {
    dyn.replaceChildren();
    if (trail.length > 1) dyn.append(svg('polyline', { points: trail.map(id => `${N(id).x},${N(id).y}`).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-opacity': 0.45 }));
    const adj = locked ? [] : neighbors(pos).map(n => n.id);
    for (const [id, n] of Object.entries(M.nodes)) {
      if (id === pos) continue;
      const isAdj = adj.includes(id);
      const g = svg('g', { style: isAdj ? 'cursor:pointer' : '' },
        svg('circle', { cx: n.x, cy: n.y, r: isAdj ? 7 : 4, fill: isAdj ? 'var(--accent)' : 'var(--muted)', 'fill-opacity': isAdj ? 0.85 : 0.5 }),
        svg('circle', { cx: n.x, cy: n.y, r: 18, fill: 'none', 'pointer-events': 'all' }));
      if (isAdj) g.addEventListener('click', () => move(id));
      dyn.append(g);
    }
    const p = N(pos);
    dyn.append(svg('circle', { cx: p.x, cy: p.y, r: 10, fill: locked && p.runway ? 'var(--bad)' : 'var(--accent)' }),
      txt(p.x, p.y + 4, '✈', { 'text-anchor': 'middle', 'font-size': 12, fill: '#fff' }));
  }

  function arrowTo(from, to) {
    const a = hdg(Math.atan2(N(to).x - N(from).x, -(N(to).y - N(from).y)) * 180 / Math.PI);
    return ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][Math.round(a / 45) % 8];
  }

  function renderSigns() {
    const nodes = [el('span', { class: 'note' }, 'Letreros aquí: ')];
    if (lastTw) nodes.push(el('span', { class: 'sign sign-loc', title: 'Ubicación: dónde estás' }, lastTw));
    else if (pos === 'PLAT') nodes.push(el('span', { class: 'sign sign-loc' }, 'PLAT'));
    const n = N(pos);
    if (n.hold) nodes.push(el('span', { class: 'sign sign-mand', title: 'Mandatorio: no pases sin autorización' }, n.hold));
    if (n.runway) nodes.push(el('span', { class: 'sign sign-loc' }, n.runway));
    const seen = new Set([lastTw]);
    for (const nb of neighbors(pos)) {
      if (seen.has(nb.tw)) continue;
      seen.add(nb.tw);
      nodes.push(el('span', { class: 'sign sign-dir', title: 'Dirección: hacia dónde va cada calle' }, `${arrowTo(pos, nb.id)} ${nb.tw}`));
    }
    signs.replaceChildren(...nodes);
  }

  function renderClearance() {
    const s = stage();
    clearance.replaceChildren(el('div', { class: 'callout-title' }, `📻 ${s.who}`), el('p', {}, `«${s.say}»`));
    header.replaceChildren(
      el('button', { class: 'widget-btn', onclick: () => go(sc - 1) }, '◀'),
      el('span', { class: 'widget-btn', style: 'flex:3;text-align:center' }, `Autorización ${sc + 1} de ${TAXI_SCENARIOS.length}`),
      el('button', { class: 'widget-btn', onclick: () => go(sc + 1) }, '▶'));
  }

  function render() { renderClearance(); renderSigns(); drawDyn(); stopBtn(); }

  function go(i) {
    sc = (i + TAXI_SCENARIOS.length) % TAXI_SCENARIOS.length;
    stageIdx = 0; incursions = 0;
    start();
  }

  function start() {
    pos = TAXI_SCENARIOS[sc].start; trail = [pos]; locked = false;
    lastTw = null;
    say('Toca los puntos resaltados para rodar, un tramo a la vez. Cuando llegues a donde termina tu autorización, toca «Me detengo aquí».');
    render();
  }

  function say(text, kind = '') {
    status.textContent = text;
    status.className = `reason${kind ? ` ${kind}` : ''}`;
  }

  function stopBtn() {
    actions.replaceChildren(locked ? '' : el('button', { class: 'primary', onclick: stop }, '✋ Me detengo aquí'));
  }

  function move(to) {
    if (locked) return;
    const r = evaluateMove(stage(), pos, to);
    if (r.type === 'not-adjacent') return;
    if (r.type === 'off-route') { say(`⚠️ ${r.msg}`, 'warn'); return; }
    lastTw = edgeBetween(pos, to)[2];
    pos = to; trail.push(to);
    if (r.type === 'incursion') {
      incursions++;
      locked = true;
      say(`🚨 ¡INCURSIÓN EN PISTA! ${r.msg}`, 'bad');
      container.classList.add('incursion-flash');
      setTimeout(() => container.classList.remove('incursion-flash'), 600);
      render();
      actions.replaceChildren(el('button', { class: 'primary', onclick: () => { stageIdx = 0; start(); } }, 'Intentar otra vez'));
      return;
    }
    // llegar al target NO termina solo: detenerse es la decisión del piloto
    say(N(to).hold
      ? `Llegaste a un punto de espera de la ${N(to).hold}. ¿Te detienes aquí o tu autorización te deja seguir?`
      : 'Sigue. ¿Por qué calle continúa tu autorización?');
    render();
  }

  function stop() {
    const st = stage();
    if (pos !== st.target) {
      if (N(pos).runway) say('⚠️ Nunca te detengas sobre una pista: sigue hasta cruzar por completo las cuatro líneas amarillas.', 'warn');
      else say('⚠️ Aquí no termina tu autorización. Vuelve a leerla: ¿dónde dice que te detengas?', 'warn');
      return;
    }
    locked = true;
    say(`✅ ${st.done}`, 'ok');
    render();
    const more = stageIdx + 1 < TAXI_SCENARIOS[sc].stages.length;
    actions.replaceChildren(more
      ? el('button', { class: 'primary', onclick: () => { stageIdx++; locked = false; say('Nueva instrucción. Léela entera antes de moverte.'); render(); } }, 'Siguiente instrucción 📻')
      : el('button', { class: 'primary', onclick: () => go(sc + 1) }, 'Otra autorización ▶'));
    if (!more && incursions === 0) flashCelebrate(container, '🛬 ¡Rodaje limpio!');
  }

  drawBase();
  container.append(header, clearance, root, signs, status, actions);
  start();
}

// =====================================================================
// 🧭 Navegador: triángulo de viento + los dos nortes
// =====================================================================
export function navegador(container, params = {}) {
  const s = {
    tc: params.tc ?? 360, tas: params.tas ?? 100, windFrom: params.windFrom ?? 270,
    windKt: params.windKt ?? 20, varE: params.varE ?? -3, correct: params.correct ?? true,
  };
  const K = 1.55, O = { x: 180, y: 258 };
  const root = svg('svg', { viewBox: '0 0 360 270', role: 'img', 'aria-label': 'Triángulo de viento: rumbo, viento y derrota' });
  const { defs, url } = arrowDefs({ tx: 'var(--text)', wa: 'var(--warn)', ok: 'var(--ok)', bad: 'var(--bad)', ac: 'var(--accent)', mu: 'var(--muted)' });
  const layer = svg('g', {});
  root.append(defs, layer);
  const modeRow = el('div', { class: 'widget-btnrow' });
  const chain = el('ol', { class: 'nav-chain' });
  const extra = el('p', { class: 'reason' });

  const rel = (h) => dir(h - s.tc); // vista girada: el curso siempre apunta arriba

  function draw() {
    const t = windTriangle({ tc: s.tc, tas: s.tas, windFrom: s.windFrom, windKt: s.windKt, correct: s.correct });
    const A = pt(O, rel(t.th), s.tas * K);
    const G = pt(A, rel(s.windFrom + 180), s.windKt * K);
    layer.replaceChildren(
      line(O, { x: O.x, y: 14 }, { stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }),
      txt(O.x + 6, 24, `curso ${hdgStr(s.tc)}°`, { fill: 'var(--accent)', 'font-size': 12, 'font-weight': 700 }));
    if (!s.correct && Math.abs(t.drift) >= 1) {
      layer.append(line(O, pt(O, rel(t.track), 236), { stroke: 'var(--bad)', 'stroke-width': 1.5, 'stroke-dasharray': '3 4' }));
      const lp = pt(O, rel(t.track), 200);
      layer.append(txt(lp.x + (t.drift > 0 ? 6 : -6), lp.y, `derrota real ${hdgStr(t.track)}°`, { fill: 'var(--bad)', 'font-size': 11, 'text-anchor': t.drift > 0 ? 'start' : 'end' }));
    }
    layer.append(
      line(O, A, { stroke: 'var(--text)', 'stroke-width': 3, 'marker-end': url('tx') }),
      s.windKt ? line(A, G, { stroke: 'var(--warn)', 'stroke-width': 3, 'marker-end': url('wa') }) : '',
      line(O, G, { stroke: 'var(--ok)', 'stroke-width': 3, 'marker-end': url('ok') }));
    const am = pt(O, rel(t.th), s.tas * K * 0.55);
    const toLeft = angleDiff(t.th, s.tc) <= 0;
    layer.append(
      txt(am.x + (toLeft ? -8 : 8), am.y, 'nariz (rumbo) + TAS', { 'font-size': 11, 'text-anchor': toLeft ? 'end' : 'start' }),
      txt(G.x + (G.x >= A.x ? 8 : -8), (A.y + G.y) / 2, s.windKt ? 'viento' : '', { 'font-size': 11, fill: 'var(--warn)', 'text-anchor': G.x >= A.x ? 'start' : 'end' }),
      txt(O.x + 8, O.y - 6, `suelo: GS ${Math.round(t.gs)} kt`, { 'font-size': 11, fill: 'var(--ok)' }));
    // avión en el origen, apuntando a su rumbo
    const plane = svg('g', { transform: `translate(${O.x},${O.y}) rotate(${t.th - s.tc})` },
      svg('path', { d: 'M0,-14 L3,-4 L13,2 L13,5 L3,2 L2,9 L6,12 L6,14 L0,12 L-6,14 L-6,12 L-2,9 L-3,2 L-13,5 L-13,2 L-3,-4 Z', fill: 'var(--accent)' }));
    layer.append(plane);
    // los dos nortes (inserto)
    const NC = { x: 46, y: 70 };
    layer.append(
      svg('circle', { cx: NC.x, cy: NC.y, r: 34, fill: 'none', stroke: 'var(--border)' }),
      line(NC, pt(NC, rel(0), 30), { stroke: 'var(--text)', 'stroke-width': 2, 'marker-end': url('tx') }),
      line(NC, pt(NC, rel(s.varE), 30), { stroke: 'var(--accent)', 'stroke-width': 2, 'marker-end': url('ac') }));
    const lv = pt(NC, rel(0), 44), lm = pt(NC, rel(s.varE), 44);
    layer.append(
      txt(lv.x, lv.y + 4, 'Nv', { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700 }),
      txt(lm.x, lm.y + 4, s.varE ? 'Nm' : '', { 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: 'var(--accent)' }));

    // la cadena, paso a paso
    const wcaR = Math.round(t.wca);
    const thR = hdg(s.tc + wcaR);
    const mh = hdg(toMagnetic(thR, s.varE));
    const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
    const li = (label, value, why = '') => el('li', {}, `${label}: `, el('strong', {}, value), why ? el('span', { class: 'note' }, ` — ${why}`) : '');
    chain.replaceChildren(
      li('Curso verdadero (lo que trazas en la carta)', `${hdgStr(s.tc)}°`),
      li('Corrección por viento (WCA)', `${sign(wcaR)}°`,
        !s.correct ? 'apagada: la nariz apunta al curso' : wcaR > 0 ? 'viento desde la derecha → nariz a la derecha (suma)' : wcaR < 0 ? 'viento desde la izquierda → nariz a la izquierda (resta)' : 'sin viento cruzado, no hay corrección'),
      li('Rumbo verdadero (adonde apunta la nariz)', `${hdgStr(thR)}°`),
      li(`Variación ${varStr(s.varE)}`, `${sign(-s.varE)}°`, s.varE > 0 ? 'Este resta' : s.varE < 0 ? 'Oeste suma' : 'sin variación'),
      li('Rumbo magnético (lo que sigues en la brújula)', `${hdgStr(mh)}°`),
      el('li', { class: 'note' }, 'Luego la desviación de la tarjeta del avión → rumbo de brújula.'));
    const hw = Math.round(t.headKt), xw = Math.round(Math.abs(t.crossKt));
    extra.textContent = s.correct
      ? `Velocidad sobre el suelo: ${Math.round(t.gs)} kt (TAS ${s.tas}; viento ${hw >= 0 ? 'de frente' : 'de cola'} ${Math.abs(hw)} kt, cruzado ${xw} kt).`
      : Math.abs(t.drift) < 1
        ? 'Sin viento cruzado no hay deriva: la nariz y la derrota coinciden.'
        : `Sin corregir, la nariz apunta a ${hdgStr(s.tc)}° pero vas por ${hdgStr(t.track)}°: derivas ${Math.abs(Math.round(t.drift))}° a la ${t.drift > 0 ? 'derecha' : 'izquierda'}. En 1 hora quedarías ~${xw} NM fuera de ruta.`;
    modeRow.replaceChildren(
      el('button', { class: `widget-btn${s.correct ? ' active' : ''}`, onclick: () => { s.correct = true; draw(); } }, 'Corrijo el viento'),
      el('button', { class: `widget-btn${!s.correct ? ' active' : ''}`, onclick: () => { s.correct = false; draw(); } }, 'Sin corregir'));
  }

  const ctl = (label, key, min, max, step, fmt) => {
    const out = el('strong', {}, fmt(s[key]));
    const sl = slider(min, max, s[key], step, (v) => { s[key] = v; out.textContent = fmt(v); draw(); });
    return el('label', { class: 'widget-ctl' }, el('span', {}, `${label}: `, out), sl);
  };
  container.append(root, modeRow,
    ctl('Curso verdadero', 'tc', 5, 360, 5, v => `${hdgStr(v)}°`),
    ctl('Velocidad verdadera (TAS)', 'tas', 80, 140, 5, v => `${v} kt`),
    ctl('Viento desde', 'windFrom', 10, 360, 10, v => `${hdgStr(v)}°`),
    ctl('Velocidad del viento', 'windKt', 0, 30, 5, v => `${v} kt`),
    ctl('Variación', 'varE', -10, 10, 1, varStr),
    chain, extra);
  draw();
}
