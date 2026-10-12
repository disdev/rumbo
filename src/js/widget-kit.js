// Piezas compartidas por los widgets (SPEC §3.4): SVG con los tokens de color
// de la app, sliders y marcadores de flecha con id único por instancia (un
// mismo widget puede vivir en la lección y en el taller sin chocar ids).

import { el } from './players.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs = {}, ...children) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...children);
  return n;
}
export const txt = (x, y, s, extra = {}) => svg('text', { x, y, fill: 'var(--text)', 'font-size': 13, 'font-family': 'inherit', ...extra }, s);

export function slider(min, max, value, step, oninput) {
  const s = el('input', { type: 'range', class: 'widget-slider' });
  s.min = min; s.max = max; s.value = value; s.step = step;
  s.addEventListener('input', () => oninput(Number(s.value)));
  return s;
}

let seq = 0;
export const uid = (base) => `${base}-${++seq}`;

/** <defs> con una flecha por color: devuelve {defs, url(color)}. */
export function arrowDefs(colors) {
  const ids = {};
  const defs = svg('defs', {}, ...Object.entries(colors).map(([name, color]) => {
    ids[name] = uid(`arr-${name}`);
    return svg('marker', { id: ids[name], viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' },
      svg('path', { d: 'M0,0 L10,5 L0,10 Z', fill: color }));
  }));
  return { defs, url: (name) => `url(#${ids[name]})` };
}

/** Vector unitario en pantalla (norte arriba, y hacia abajo) para un rumbo. */
export function dir(h) {
  const r = h * Math.PI / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}
