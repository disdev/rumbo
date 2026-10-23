// La leyenda de cerca (spec 2026-10-22 «La carta, paso a paso»): cada símbolo de
// la seccional dibujado en grande, sobre papel, con sus partes tocables. Cada
// parte sabe decir qué es (`says`): si Piero toca la equivocada, aprende qué
// tocó. Misma API mínima que la carta y la figura (onTap, highlight, pulse,
// explainFeature, clearMarks, destroy) más partRect() para arrastrar etiquetas.
// Colores fijos de papel, como la carta: en modo oscuro va enmarcada, no invertida.

import { el } from './players.js';
import { svg } from './widget-kit.js';

const INK = '#2b2a26', MAG = '#a3307c', BLUE = '#2a5aa0', PAPER = '#f6f1e1', MUTED = '#6b6a5e';
const TONES = { ok: '#3f7d3a', bad: '#b8442f', hint: '#d08a1e', me: '#c96442' };
const HIT = 'rgba(0,0,0,0)'; // trazo invisible pero tocable

const t = (x, y, s, a = {}) => svg('text', { x, y, fill: INK, 'font-size': 15, ...a }, s);
const caption = (x, y, s) => t(x, y, s, { 'text-anchor': 'middle', fill: MUTED, 'font-size': 14, 'font-style': 'italic' });

/** Aeropuerto con pista pavimentada (círculo + pista), con o sin rayitas de combustible. */
function airport(x, y, col, { fuel = false, runway = true, r = 32, inner = null } = {}) {
  const kids = [svg('circle', { cx: x, cy: y, r: r + 12, fill: HIT }),
    svg('circle', { cx: x, cy: y, r, fill: '#fff', 'fill-opacity': 0.6, stroke: col, 'stroke-width': 6 })];
  if (runway) kids.push(svg('rect', { x: x - 4, y: y - r + 5, width: 8, height: 2 * r - 10, rx: 1, fill: col, transform: `rotate(154 ${x} ${y})` }));
  if (inner) kids.push(t(x, y + 10, inner, { 'text-anchor': 'middle', fill: col, 'font-size': 30, 'font-weight': 800 }));
  if (fuel) for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2; // los cuatro puntos cardinales, como en la seccional
    kids.push(svg('line', { x1: x + (r + 3) * Math.cos(a), y1: y + (r + 3) * Math.sin(a), x2: x + (r + 11) * Math.cos(a), y2: y + (r + 11) * Math.sin(a), stroke: col, 'stroke-width': 7 }));
  }
  return kids;
}

/** Torre de obstáculo (la «V» invertida con punto), opcionalmente con rayos de luz. */
function tower(x, y, { lighted = false, s = 2.4 } = {}) {
  const kids = [svg('path', { d: `M${x - 9 * s},${y} L${x},${y - 26 * s} L${x + 9 * s},${y}`, fill: 'none', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' }),
    svg('circle', { cx: x, cy: y - 2, r: 3, fill: INK })];
  if (lighted) kids.push(svg('path', { d: `M${x - 10 * s},${y - 34 * s} l5,6 M${x},${y - 37 * s} l0,8 M${x + 10 * s},${y - 34 * s} l-5,6`, stroke: INK, 'stroke-width': 2.4 }));
  return kids;
}

export const SIMBOLOS = {
  reticula: {
    title: 'La cuadrícula de la carta: paralelos y meridianos',
    parts: {
      paralelo: { says: 'Esa es una línea de LATITUD (un paralelo): va de lado a lado, acostada. Dice cuánto al norte o al sur estás.' },
      meridiano: { says: 'Esa es una línea de LONGITUD (un meridiano): larga, de polo a polo. Dice cuánto al este u oeste estás.' },
      'tick-minuto': { says: 'Rayitas sobre un meridiano: cada una es 1′ de latitud = 1 milla náutica. Es la regla de la carta.' },
      'rotulo-lat': { says: 'Rótulo de latitud: grados y minutos, con S porque estamos al sur del ecuador.' },
      'rotulo-lon': { says: 'Rótulo de longitud: grados y minutos, con W porque estamos al oeste de Greenwich.' },
    },
    draw(H) {
      const X0 = 90, X1 = 510, Y0 = 50, Y1 = 350; // 1° × 1°: 78°W–77°W, 11°S–12°S
      const ys = [Y0, (Y0 + Y1) / 2, Y1], xs = [X0, (X0 + X1) / 2, X1];
      H.part('paralelo', ...ys.flatMap(y => [svg('line', { x1: X0 - 30, y1: y, x2: X1 + 30, y2: y, stroke: HIT, 'stroke-width': 22 }),
        svg('line', { x1: X0 - 30, y1: y, x2: X1 + 30, y2: y, stroke: INK, 'stroke-width': 2 })]));
      H.part('meridiano', ...xs.flatMap(x => [svg('line', { x1: x, y1: Y0 - 25, x2: x, y2: Y1 + 25, stroke: HIT, 'stroke-width': 22 }),
        svg('line', { x1: x, y1: Y0 - 25, x2: x, y2: Y1 + 25, stroke: INK, 'stroke-width': 2 })]));
      const mx = xs[1], per = (Y1 - Y0) / 60, ticks = [svg('rect', { x: mx - 16, y: Y0, width: 32, height: Y1 - Y0, fill: HIT })];
      for (let m = 1; m < 60; m++) {
        if (m === 30) continue;
        const len = m % 10 === 0 ? 13 : m % 5 === 0 ? 9 : 5;
        ticks.push(svg('line', { x1: mx - len, y1: Y0 + m * per, x2: mx + len, y2: Y0 + m * per, stroke: INK, 'stroke-width': 1.6 }));
      }
      H.part('tick-minuto', ...ticks);
      H.part('rotulo-lat', ...['11°00′S', '11°30′S', '12°00′S'].map((s, i) => t(X0 - 26, ys[i] - 7, s, { 'text-anchor': 'end', 'font-weight': 700 })));
      H.part('rotulo-lon', ...['78°00′W', '77°30′W', '77°00′W'].map((s, i) => t(xs[i] + 6, Y0 - 30, s, { 'font-weight': 700 })));
      H.add(t(X1 + 34, Y0 + 5, 'N ↑', { 'font-weight': 800, fill: MUTED }),
        caption(300, 392, 'Sur y oeste: la latitud crece hacia abajo y la longitud hacia la izquierda.'));
    },
  },

  'apt-colores': {
    title: 'Aeropuertos: azul o magenta',
    parts: {
      azul: { says: 'Azul = aeropuerto CON torre de control. Fíjate: su caja de datos trae «CT» con la frecuencia de la torre.' },
      magenta: { says: 'Magenta = aeropuerto SIN torre. Nadie te contesta: tú te anuncias en la frecuencia CTAF (la Ⓒ).' },
    },
    draw(H) {
      H.part('azul', ...airport(170, 170, BLUE, { fuel: true }),
        t(170, 246, 'PUERTO AZUL', { fill: BLUE, 'font-weight': 800, 'text-anchor': 'middle' }),
        t(170, 268, 'CT – 118.3', { fill: BLUE, 'font-weight': 700, 'text-anchor': 'middle' }));
      H.part('magenta', ...airport(430, 170, MAG),
        t(430, 246, 'HUARAL', { fill: MAG, 'font-weight': 800, 'text-anchor': 'middle' }),
        t(430, 268, '122.9 Ⓒ', { fill: MAG, 'font-weight': 700, 'text-anchor': 'middle' }));
      H.add(caption(300, 340, 'Mismo símbolo, distinto color: el color solo te dice si hay torre.'));
    },
  },

  'apt-formas': {
    title: 'La forma del símbolo: qué pista tiene',
    parts: {
      'pista-larga': { says: 'Pista pavimentada de MÁS de 8 069 ft: se dibujan las pistas tal cual, sin círculo.' },
      'pista-pavimentada': { says: 'Círculo con la pista adentro: pista pavimentada de 1 500 a 8 069 ft.' },
      'sin-pavimento': { says: 'Círculo vacío, sin pista dibujada: la pista NO está pavimentada (tierra, grava, pasto).' },
    },
    draw(H) {
      const rw = (x, y, len, ang) => svg('rect', { x: x - 7, y: y - len / 2, width: 14, height: len, fill: '#fff', stroke: BLUE, 'stroke-width': 3.5, transform: `rotate(${ang} ${x} ${y})` });
      H.part('pista-larga', svg('rect', { x: 50, y: 110, width: 120, height: 130, fill: HIT }), rw(110, 170, 110, 20), rw(110, 175, 80, 110));
      H.part('pista-pavimentada', ...airport(300, 172, BLUE));
      H.part('sin-pavimento', ...airport(490, 172, MAG, { runway: false }));
      H.add(caption(110, 280, 'más de 8 069 ft'), caption(300, 280, 'pavimentada'), caption(300, 300, '1 500 – 8 069 ft'), caption(490, 280, 'sin pavimentar'),
        caption(300, 360, 'El color (azul/magenta) sigue diciendo si hay torre; la forma dice cómo es la pista.'));
    },
  },

  'apt-servicios': {
    title: 'Lo que el símbolo te cuenta además',
    parts: {
      combustible: { says: 'Rayitas alrededor del círculo = hay combustible y servicios.' },
      faro: { says: 'Estrella ENCIMA del símbolo = faro rotativo del aeropuerto (de la puesta a la salida del sol).' },
      privado: { says: 'Círculo con una R = aeropuerto PRIVADO: no es de uso público, necesitas permiso.' },
      'sin-servicios': { says: 'Círculo con pista y sin rayitas: pavimentado, pero sin combustible.' },
    },
    draw(H) {
      H.part('combustible', ...airport(90, 170, MAG, { fuel: true }));
      const star = (x, y) => svg('path', { d: `M${x},${y - 13} L${x + 4},${y - 4} L${x + 13},${y - 4} L${x + 6},${y + 2} L${x + 8},${y + 11} L${x},${y + 6} L${x - 8},${y + 11} L${x - 6},${y + 2} L${x - 13},${y - 4} L${x - 4},${y - 4} Z`, fill: MAG });
      H.part('faro', ...airport(230, 170, MAG), star(230, 118));
      H.part('privado', ...airport(370, 170, MAG, { runway: false, inner: 'R' }));
      H.part('sin-servicios', ...airport(510, 170, MAG));
      H.add(caption(90, 250, 'combustible'), caption(230, 250, 'faro'), caption(370, 250, 'privado'), caption(510, 250, 'sin servicios'),
        caption(300, 330, 'Ojo: la ★ ENCIMA del símbolo es el faro.'), caption(300, 352, 'En la caja de datos, junto a una frecuencia, significa otra cosa.'));
    },
  },

  'caja-datos': {
    title: 'La caja de datos, línea por línea',
    parts: {
      nombre: { says: 'Primera línea: el nombre del aeropuerto y su identificador (entre paréntesis).' },
      ct: { says: '«CT – 118.3» = Control Tower: la frecuencia de la torre.' },
      'estrella-pt': { says: 'La ★ DESPUÉS de una frecuencia = el servicio es a tiempo parcial (la torre no está todo el día).' },
      atis: { says: 'ATIS = la grabación con el tiempo y la pista en uso. Se escucha antes de llamar.' },
      elev: { says: 'El primer número de la última línea: la ELEVACIÓN del aeropuerto, en pies sobre el nivel del mar.' },
      luces: { says: 'L = luces de pista de la puesta a la salida del sol. *L = luces con limitaciones (mira el suplemento).' },
      largo: { says: 'El largo de la pista más larga, en CIENTOS de pies: 72 = 7 200 ft.' },
      unicom: { says: 'La última frecuencia es UNICOM: radio del operador del aeropuerto (combustible, servicios).' },
      ctaf: { says: 'Ⓒ = CTAF: la frecuencia donde te anuncias cuando no hay torre (o cuando la torre está cerrada).' },
    },
    draw(H) {
      const B = { fill: BLUE, 'font-weight': 800, 'font-size': 26 }, M = { ...B, fill: MAG };
      H.part('nombre', t(60, 90, 'PUERTO AZUL (SPZA)', B));
      H.part('ct', t(60, 140, 'CT – 118.3', B));
      H.part('estrella-pt', t(212, 140, '★', { ...B, 'font-size': 30 }), svg('rect', { x: 206, y: 112, width: 36, height: 36, fill: HIT }));
      H.part('atis', t(268, 140, 'ATIS 127.6', B));
      H.part('elev', t(60, 190, '113', B), svg('rect', { x: 54, y: 162, width: 58, height: 36, fill: HIT }));
      H.part('luces', t(130, 190, 'L', B), svg('rect', { x: 122, y: 162, width: 36, height: 36, fill: HIT }));
      H.part('largo', t(170, 190, '72', B), svg('rect', { x: 164, y: 162, width: 44, height: 36, fill: HIT }));
      H.part('unicom', t(232, 190, '122.95', B));
      H.add(svg('line', { x1: 40, y1: 222, x2: 560, y2: 222, stroke: MUTED, 'stroke-dasharray': '5 6' }));
      H.add(t(60, 266, 'HUARAL', M), t(60, 306, '120 L 45 122.9', M));
      H.part('ctaf', t(268, 306, 'Ⓒ', { ...M, 'font-size': 30 }), svg('rect', { x: 262, y: 278, width: 40, height: 36, fill: HIT }));
      H.add(caption(300, 370, 'Aeropuertos de ejemplo — no son datos reales.'));
    },
  },

  obstaculos: {
    title: 'Obstáculos: la torre y sus dos números',
    parts: {
      simple: { says: 'Una sola torre (antena): la «V» invertida con un punto en la base.' },
      msl: { says: 'El número en NEGRITA: la punta del obstáculo medida desde el NIVEL DEL MAR (MSL). Es el que usas para librarlo.' },
      agl: { says: 'El número entre PARÉNTESIS: cuánto mide desde el SUELO (AGL). Paréntesis = Piso.' },
      grupo: { says: 'Dos «V» juntas = GRUPO de obstáculos. El número es la punta del más alto.' },
      iluminado: { says: 'Rayitas encima = obstáculo ILUMINADO de noche.' },
    },
    draw(H) {
      H.part('simple', svg('rect', { x: 50, y: 100, width: 70, height: 110, fill: HIT }), ...tower(85, 200));
      H.part('msl', t(118, 150, '1249', { 'font-size': 36, 'font-weight': 800 }));
      H.part('agl', t(120, 192, '(349)', { 'font-size': 28 }));
      H.part('grupo', svg('rect', { x: 268, y: 100, width: 100, height: 110, fill: HIT }), ...tower(295, 200), ...tower(340, 200));
      H.add(t(372, 150, '449', { 'font-size': 32, 'font-weight': 800 }), t(372, 188, '(399)', { 'font-size': 26 }));
      H.part('iluminado', svg('rect', { x: 480, y: 70, width: 80, height: 140, fill: HIT }), ...tower(520, 200, { lighted: true }));
      H.add(caption(140, 260, 'una torre'), caption(335, 260, 'grupo'), caption(520, 260, 'iluminada'),
        caption(300, 320, 'Negrita = desde el mar (MSL) · (paréntesis) = desde el piso (AGL)'));
    },
  },
};

/** Dibuja un símbolo en grande. @returns api como la de la carta (kind 'simbolo'). */
export function renderSimbolo(container, id) {
  const def = SIMBOLOS[id];
  if (!def) throw new Error(`símbolo desconocido: ${id}`);
  const root = svg('svg', { class: 'carta-svg leyenda-svg', viewBox: '0 0 600 400', preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': def.title });
  root.append(svg('rect', { x: 0, y: 0, width: 600, height: 400, fill: PAPER }));
  const parts = new Map();
  const gMarks = svg('g', { class: 'c-marks' });
  let tapFn = null;
  const pop = el('div', { class: 'carta-pop hidden', role: 'status' });

  const H = {
    add: (...kids) => root.append(...kids),
    part(pid, ...kids) {
      const g = svg('g', { class: 'c-feat leyenda-part', 'data-id': pid, tabindex: 0, 'aria-label': def.parts[pid]?.says || pid }, ...kids);
      g.addEventListener('click', (e) => { e.stopPropagation(); tapFn?.(pid); });
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapFn?.(pid); } });
      root.append(g);
      parts.set(pid, g);
      return g;
    },
  };
  def.draw(H);
  root.append(gMarks);
  root.addEventListener('click', () => { pop.classList.add('hidden'); tapFn?.(null); });

  const frame = el('div', { class: 'carta-frame leyenda-frame' }, root, pop);
  container.replaceChildren(frame);

  function ring(pid, tone) {
    const g = parts.get(pid);
    if (!g) return;
    const b = g.getBBox(), pad = 8;
    gMarks.append(svg('rect', { class: 'c-pulse', x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad, rx: 10,
      fill: 'none', stroke: TONES[tone] || tone, 'stroke-width': 4 }));
  }

  const api = {
    kind: 'simbolo',
    parts: def.parts,
    onTap(fn) { tapFn = fn; },
    highlight(ids, tone = 'hint') { for (const pid of ids || []) ring(pid, tone); },
    pulse(ids) { api.highlight(ids, 'hint'); },
    clearMarks() { gMarks.replaceChildren(); pop.classList.add('hidden'); },
    explainFeature(pid) {
      const says = def.parts[pid]?.says;
      if (!says) return;
      pop.textContent = says;
      pop.classList.remove('hidden');
      const fr = frame.getBoundingClientRect(), pr = parts.get(pid)?.getBoundingClientRect();
      const x = pr ? pr.left + pr.width / 2 - fr.left : fr.width / 2, y = pr ? pr.bottom - fr.top : fr.height / 2;
      pop.style.left = `${Math.min(Math.max(8, x - 140), fr.width - 288)}px`;
      pop.style.top = `${Math.min(y + 12, fr.height - pop.offsetHeight - 8)}px`;
    },
    /** Rectángulo en pantalla de una parte, para soltar etiquetas encima. */
    partRect(pid) { return parts.get(pid)?.getBoundingClientRect() || null; },
    destroy() { container.replaceChildren(); },
  };
  return api;
}
