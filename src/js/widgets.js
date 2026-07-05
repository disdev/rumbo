// Registro de widgets interactivos de lección (SPEC §3.4, §5.8).
// Cada widget: render(container, params) — vanilla, sin red, sin puntaje.
// Si un widget falla, el player degrada a su caption (§5.8): nunca bloquea.

import { el } from './players.js';

const SVGNS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...children);
  return n;
}
const txt = (x, y, s, extra = {}) => svg('text', { x, y, fill: 'var(--text)', 'font-size': 13, 'font-family': 'inherit', ...extra }, s);

function slider(min, max, value, step, oninput) {
  const s = el('input', { type: 'range', class: 'widget-slider' });
  s.min = min; s.max = max; s.value = value; s.step = step;
  s.addEventListener('input', () => oninput(Number(s.value)));
  return s;
}

// ---------- ángulo de ataque → sustentación ----------
function anguloAtaque(container) {
  const CRIT = 17;
  const root = svg('svg', { viewBox: '0 0 400 220' });
  const wing = svg('g', {});
  wing.append(svg('path', { d: 'M -60 0 Q -40 -14 10 -6 Q 50 2 60 6 Q 10 14 -60 0 Z', fill: 'var(--panel-2)', stroke: 'var(--text)', 'stroke-width': 1.5 }));
  const wingWrap = svg('g', { transform: 'translate(200,120)' }, wing);
  const lift = svg('line', { x1: 200, y1: 100, x2: 200, y2: 60, stroke: 'var(--ok)', 'stroke-width': 5, 'marker-end': 'url(#arrowok)' });
  const relWind = svg('line', { x1: 60, y1: 120, x2: 130, y2: 120, stroke: 'var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arrowac)' });
  const label = txt(200, 24, 'Ángulo de ataque: 4°', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });
  const stallTxt = txt(200, 46, '', { 'text-anchor': 'middle', fill: 'var(--bad)', 'font-weight': 700 });
  const defs = svg('defs', {},
    svg('marker', { id: 'arrowok', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: 'var(--ok)' })),
    svg('marker', { id: 'arrowac', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: 'var(--accent)' })));
  root.append(defs, relWind, txt(60, 106, 'viento relativo', { fill: 'var(--accent)' }), wingWrap, lift, label, stallTxt);

  function update(aoa) {
    wingWrap.setAttribute('transform', `translate(200,120) rotate(${-aoa})`);
    const liftLen = aoa <= CRIT ? 10 + aoa * 5 : Math.max(12, 10 + CRIT * 5 - (aoa - CRIT) * 22);
    lift.setAttribute('y2', 100 - liftLen);
    lift.setAttribute('stroke', aoa > CRIT ? 'var(--bad)' : 'var(--ok)');
    label.textContent = `Ángulo de ataque: ${aoa}°`;
    stallTxt.textContent = aoa > CRIT ? '¡PÉRDIDA! El flujo se separó del ala' : '';
  }
  update(4);
  container.append(root, slider(0, 22, 4, 1, update),
    el('p', { class: 'note center' }, `Mueve el ángulo. Fíjate qué pasa después de ${CRIT}° — así de brusca es la pérdida.`));
}

// ---------- cuatro fuerzas ----------
function cuatroFuerzas(container) {
  const root = svg('svg', { viewBox: '0 0 400 240' });
  const defs = svg('defs', {}, ...[['ok', 'var(--ok)'], ['bad', 'var(--bad)'], ['ac', 'var(--accent)'], ['wa', 'var(--warn)']].map(([id, color]) =>
    svg('marker', { id: `arr-${id}`, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: color }))));
  const plane = svg('g', { transform: 'translate(200,120)' },
    svg('path', { d: 'M -46 4 L -14 0 L 10 -4 L 34 -2 L 42 2 L 10 6 Z', fill: 'var(--panel-2)', stroke: 'var(--text)', 'stroke-width': 1.5 }),
    svg('path', { d: 'M -6 -2 L -18 -16 L -10 -16 L 4 -4 Z', fill: 'var(--panel-2)', stroke: 'var(--text)' }));
  const mk = (color, marker) => svg('line', { stroke: color, 'stroke-width': 5, 'marker-end': `url(#arr-${marker})` });
  const L = mk('var(--ok)', 'ok'), W = mk('var(--warn)', 'wa'), T = mk('var(--accent)', 'ac'), D = mk('var(--bad)', 'bad');
  const caption = txt(200, 232, '', { 'text-anchor': 'middle', 'font-size': 14 });
  root.append(defs, plane, L, W, T, D,
    txt(200, 30, 'SUSTENTACIÓN', { 'text-anchor': 'middle', fill: 'var(--ok)', 'font-weight': 700, 'font-size': 12 }),
    txt(200, 218, 'PESO', { 'text-anchor': 'middle', fill: 'var(--warn)', 'font-weight': 700, 'font-size': 12 }),
    txt(374, 124, 'EMPUJE', { 'text-anchor': 'end', fill: 'var(--accent)', 'font-weight': 700, 'font-size': 12 }),
    txt(26, 124, 'RESISTENCIA', { fill: 'var(--bad)', 'font-weight': 700, 'font-size': 12 }),
    caption);

  const MODES = {
    nivelado: { l: 62, w: 62, t: 58, d: 58, msg: 'Vuelo recto y nivelado: L = P y E = R. Nada gana — equilibrio.' },
    ascenso: { l: 62, w: 62, t: 78, d: 58, msg: 'Ascenso estable: el empuje extra hace el trabajo de subir. ¡L sigue ≈ P!' },
    descenso: { l: 58, w: 62, t: 40, d: 56, msg: 'Descenso: menos empuje; una parte del peso “tira” hacia adelante.' },
  };
  function update(mode) {
    const m = MODES[mode];
    L.setAttribute('x1', 200); L.setAttribute('y1', 108); L.setAttribute('x2', 200); L.setAttribute('y2', 108 - m.l);
    W.setAttribute('x1', 200); W.setAttribute('y1', 132); W.setAttribute('x2', 200); W.setAttribute('y2', 132 + m.w);
    T.setAttribute('x1', 246); T.setAttribute('y1', 120); T.setAttribute('x2', 246 + m.t, 1); T.setAttribute('x2', 246 + m.t); T.setAttribute('y2', 120);
    D.setAttribute('x1', 154); D.setAttribute('y1', 120); D.setAttribute('x2', 154 - m.d); D.setAttribute('y2', 120);
    caption.textContent = m.msg;
    btns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  }
  const btns = Object.keys(MODES).map(mode =>
    el('button', { class: 'widget-btn', onclick: () => update(mode) }, mode === 'nivelado' ? 'Nivelado' : mode === 'ascenso' ? 'Ascenso' : 'Descenso'));
  btns.forEach(b => b.dataset.mode = ['nivelado', 'ascenso', 'descenso'][btns.indexOf(b)]);
  update('nivelado');
  container.append(root, el('div', { class: 'widget-btnrow' }, ...btns));
}

// ---------- superficies de control ----------
function superficiesControl(container) {
  const root = svg('svg', { viewBox: '0 0 400 260' });
  // avión visto desde atrás (alabeo) + desde arriba (guiñada) simplificado en una vista 3/4 esquemática
  const body = svg('g', { transform: 'translate(200,130)' });
  const fuselage = svg('ellipse', { cx: 0, cy: 0, rx: 16, ry: 40, fill: 'var(--panel-2)', stroke: 'var(--text)', 'stroke-width': 1.5 });
  const wingL = svg('path', { d: 'M -16 -6 L -150 8 L -150 20 L -16 14 Z', fill: 'var(--panel-2)', stroke: 'var(--text)' });
  const wingR = svg('path', { d: 'M 16 -6 L 150 8 L 150 20 L 16 14 Z', fill: 'var(--panel-2)', stroke: 'var(--text)' });
  const ailL = svg('rect', { x: -148, y: 8, width: 56, height: 10, fill: 'var(--accent)', transform: 'rotate(0)' });
  const ailR = svg('rect', { x: 92, y: 8, width: 56, height: 10, fill: 'var(--accent)' });
  const tail = svg('path', { d: 'M -40 -34 L 40 -34 L 28 -46 L -28 -46 Z', fill: 'var(--panel-2)', stroke: 'var(--text)', transform: 'translate(0,-2)' });
  const elev = svg('rect', { x: -36, y: -38, width: 72, height: 6, fill: 'var(--ok)' });
  const fin = svg('path', { d: 'M -3 -34 L 3 -34 L 3 -64 L -3 -60 Z', fill: 'var(--panel-2)', stroke: 'var(--text)' });
  const rud = svg('rect', { x: -2.6, y: -62, width: 5.2, height: 26, fill: 'var(--warn)' });
  body.append(wingL, wingR, ailL, ailR, fuselage, tail, elev, fin, rud);
  const label = txt(200, 24, 'Toca un mando y mira qué se mueve', { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 });
  const axis = txt(200, 250, '', { 'text-anchor': 'middle', fill: 'var(--muted)' });
  root.append(body, label, axis);

  function reset() {
    body.setAttribute('transform', 'translate(200,130)');
    ailL.setAttribute('transform', ''); ailR.setAttribute('transform', '');
    elev.setAttribute('transform', ''); rud.setAttribute('transform', '');
  }
  const ACTIONS = {
    izq: () => { ailL.setAttribute('transform', 'translate(0,-6)'); ailR.setAttribute('transform', 'translate(0,6)'); body.setAttribute('transform', 'translate(200,130) rotate(-12)'); label.textContent = 'Palanca a la IZQUIERDA'; axis.textContent = 'Alerones opuestos → ALABEO (eje longitudinal)'; },
    der: () => { ailL.setAttribute('transform', 'translate(0,6)'); ailR.setAttribute('transform', 'translate(0,-6)'); body.setAttribute('transform', 'translate(200,130) rotate(12)'); label.textContent = 'Palanca a la DERECHA'; axis.textContent = 'Alerones opuestos → ALABEO (eje longitudinal)'; },
    atras: () => { elev.setAttribute('transform', 'translate(0,-7)'); body.setAttribute('transform', 'translate(200,136) scale(1,0.94)'); label.textContent = 'Palanca ATRÁS'; axis.textContent = 'Elevador arriba → nariz ARRIBA — CABECEO (eje lateral)'; },
    adelante: () => { elev.setAttribute('transform', 'translate(0,7)'); body.setAttribute('transform', 'translate(200,124) scale(1,1.05)'); label.textContent = 'Palanca ADELANTE'; axis.textContent = 'Elevador abajo → nariz ABAJO — CABECEO (eje lateral)'; },
    pedalIzq: () => { rud.setAttribute('transform', 'rotate(-16 0 -36)'); body.setAttribute('transform', 'translate(200,130) skewX(-6)'); label.textContent = 'Pedal IZQUIERDO'; axis.textContent = 'Timón a la izquierda → GUIÑADA (eje vertical)'; },
    pedalDer: () => { rud.setAttribute('transform', 'rotate(16 0 -36)'); body.setAttribute('transform', 'translate(200,130) skewX(6)'); label.textContent = 'Pedal DERECHO'; axis.textContent = 'Timón a la derecha → GUIÑADA (eje vertical)'; },
  };
  const btn = (key, lbl) => el('button', { class: 'widget-btn', onclick: () => { reset(); ACTIONS[key](); } }, lbl);
  container.append(root,
    el('div', { class: 'widget-btnrow' }, btn('izq', '🕹️ ← palanca'), btn('der', 'palanca → 🕹️')),
    el('div', { class: 'widget-btnrow' }, btn('adelante', '🕹️ palanca adelante'), btn('atras', '🕹️ palanca atrás')),
    el('div', { class: 'widget-btnrow' }, btn('pedalIzq', '🦶 pedal izq.'), btn('pedalDer', '🦶 pedal der.')));
}

// ---------- flaps ----------
function flaps(container) {
  const root = svg('svg', { viewBox: '0 0 400 220' });
  const wing = svg('path', { d: 'M 60 110 Q 100 82 190 92 Q 260 100 280 108 Q 190 126 60 110 Z', fill: 'var(--panel-2)', stroke: 'var(--text)', 'stroke-width': 1.5 });
  const flap = svg('g', {}, svg('path', { d: 'M 280 104 L 336 106 L 336 114 L 280 112 Z', fill: 'var(--accent)', stroke: 'var(--text)' }));
  const lift = svg('line', { x1: 180, y1: 80, x2: 180, y2: 46, stroke: 'var(--ok)', 'stroke-width': 5, 'marker-end': 'url(#fl-ok)' });
  const drag = svg('line', { x1: 300, y1: 140, x2: 330, y2: 140, stroke: 'var(--bad)', 'stroke-width': 4, 'marker-end': 'url(#fl-bad)' });
  const label = txt(200, 26, 'Flaps: 0°', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 });
  const note = txt(200, 208, 'Más sustentación Y más resistencia: bajas más inclinado sin acelerar.', { 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--muted)' });
  root.append(
    svg('defs', {},
      svg('marker', { id: 'fl-ok', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: 'var(--ok)' })),
      svg('marker', { id: 'fl-bad', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: 'var(--bad)' }))),
    wing, flap, lift, drag,
    txt(150, 60, 'sustentación', { fill: 'var(--ok)' }), txt(296, 128, 'resistencia', { fill: 'var(--bad)', 'font-size': 12 }),
    label, note);
  function update(deg) {
    flap.setAttribute('transform', `rotate(${deg * 1.4} 280 108)`);
    lift.setAttribute('y2', 46 - deg * 0.9);
    drag.setAttribute('x2', 330 + deg * 1.6);
    label.textContent = `Flaps: ${deg}°`;
    btns.forEach(b => b.classList.toggle('active', Number(b.dataset.deg) === deg));
  }
  const btns = [0, 10, 20, 30].map(d => {
    const b = el('button', { class: 'widget-btn', onclick: () => update(d) }, `${d}°`);
    b.dataset.deg = d;
    return b;
  });
  update(0);
  container.append(root, el('div', { class: 'widget-btnrow' }, ...btns));
}

// ---------- instrumento (altímetro / velocímetro) ----------
function instrumento(container, params = {}) {
  const tipo = params.tipo || 'altimetro';
  const root = svg('svg', { viewBox: '0 0 240 240' });
  const face = svg('g', { transform: 'translate(120,120)' });
  face.append(svg('circle', { r: 100, fill: 'var(--panel-2)', stroke: 'var(--text)', 'stroke-width': 2 }));

  if (tipo === 'altimetro') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 2 * Math.PI - Math.PI / 2;
      face.append(txt(Math.cos(a) * 78, Math.sin(a) * 78 + 5, String(i), { 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 16 }));
    }
    const h100 = svg('line', { x1: 0, y1: 0, x2: 0, y2: -70, stroke: 'var(--text)', 'stroke-width': 3 });
    const h1000 = svg('line', { x1: 0, y1: 0, x2: 0, y2: -46, stroke: 'var(--accent)', 'stroke-width': 6 });
    face.append(h1000, h100, svg('circle', { r: 6, fill: 'var(--text)' }));
    const read = el('p', { class: 'center', style: 'font-weight:700;font-size:18px' }, '');
    function update(alt) {
      const cientos = (alt % 1000) / 1000, miles = (alt % 10000) / 10000;
      h100.setAttribute('transform', `rotate(${cientos * 360})`);
      h1000.setAttribute('transform', `rotate(${miles * 360})`);
      read.textContent = `¿Qué marca? ${alt.toLocaleString('es-PE')} ft`;
    }
    update(3500);
    container.append(root, slider(0, 9900, 3500, 100, update), read,
      el('p', { class: 'note center' }, 'Aguja gorda = miles · aguja fina = cientos. Mueve y practica leerlo.'));
  } else {
    // velocímetro con arcos
    const arcs = [
      { from: 40, to: 85, color: 'var(--text)', label: 'blanco: flaps' },
      { from: 48, to: 129, color: 'var(--ok)', label: 'verde: normal' },
      { from: 129, to: 163, color: 'var(--warn)', label: 'amarillo: solo aire calmo' },
    ];
    const maxV = 180;
    const angOf = (v) => (v / maxV) * 300 - 240;
    for (const a of arcs) {
      const r = a.color === 'var(--text)' ? 60 : 70;
      const p1 = angOf(a.from) * Math.PI / 180, p2 = angOf(a.to) * Math.PI / 180;
      face.append(svg('path', {
        d: `M ${Math.cos(p1) * r} ${Math.sin(p1) * r} A ${r} ${r} 0 ${(a.to - a.from) / maxV * 300 > 180 ? 1 : 0} 1 ${Math.cos(p2) * r} ${Math.sin(p2) * r}`,
        fill: 'none', stroke: a.color, 'stroke-width': 7,
      }));
    }
    const vne = angOf(163) * Math.PI / 180;
    face.append(svg('line', { x1: Math.cos(vne) * 62, y1: Math.sin(vne) * 62, x2: Math.cos(vne) * 80, y2: Math.sin(vne) * 80, stroke: 'var(--bad)', 'stroke-width': 5 }));
    for (let v = 40; v <= maxV; v += 20) {
      const a = angOf(v) * Math.PI / 180;
      face.append(txt(Math.cos(a) * 88, Math.sin(a) * 88 + 4, String(v), { 'text-anchor': 'middle', 'font-size': 11 }));
    }
    const needle = svg('line', { x1: 0, y1: 0, x2: 0, y2: -74, stroke: 'var(--text)', 'stroke-width': 4 });
    face.append(needle, svg('circle', { r: 6, fill: 'var(--text)' }));
    const read = el('p', { class: 'center', style: 'font-weight:700;font-size:18px' }, '');
    function update(v) {
      needle.setAttribute('transform', `rotate(${angOf(v) + 90})`);
      read.textContent = `${v} nudos — ${v < 48 ? 'zona de pérdida' : v <= 129 ? 'arco verde (normal)' : v <= 163 ? 'arco amarillo (¡solo aire calmo!)' : '¡PASASTE Vne!'}`;
    }
    update(100);
    container.append(root, slider(40, 180, 100, 1, update), read,
      el('p', { class: 'note center' }, 'La línea roja es Vne: nunca jamás. Mueve la aguja y di en qué arco estás.'));
  }
}

export const WIDGETS = {
  'angulo-ataque': anguloAtaque,
  'cuatro-fuerzas': cuatroFuerzas,
  'superficies-control': superficiesControl,
  'flaps': flaps,
  'instrumento': instrumento,
};
