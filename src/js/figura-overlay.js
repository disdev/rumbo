// Figuras del examen con capa interactiva (spec 2026-10-22, paso puente «ahora en
// la carta del examen»): puntos tocables en coordenadas de la imagen original,
// líneas y resaltados. A propósito NO hay plotter: el día del examen no hay.
// Con ?pick en la URL, tocar la imagen muestra sus coordenadas (para autorar hotspots).

import { el } from './players.js';
import { svg } from './widget-kit.js';

const TONES = { ok: '#3f7d3a', bad: '#b8442f', hint: '#d08a1e', me: '#c96442' };

/** @param surface {figure: 'Figure 20.jpg', hotspots: [{id, x, y, r}]} */
export function renderFigura(container, surface) {
  const picking = new URLSearchParams(location.search).has('pick');
  const img = el('img', { class: 'figura-img', alt: `Figura del examen: ${surface.figure}`, src: `data/figures/${encodeURIComponent(surface.figure)}`, draggable: 'false' });
  const layer = svg('svg', { class: 'figura-layer', preserveAspectRatio: 'none' });
  const gHot = svg('g', {}), gMarks = svg('g', {});
  layer.append(gHot, gMarks);
  const pickOut = el('div', { class: 'carta-readout figura-pick hidden' });
  const zoomBtn = el('button', { class: 'carta-zbtn figura-zoom', title: 'Ampliar figura', 'aria-label': 'Ampliar figura' }, '⤢');
  const stage = el('div', { class: 'figura-stage' }, img, layer);
  const frame = el('div', { class: 'figura-frame' }, stage);
  container.replaceChildren(el('div', { class: 'figura-wrap' }, frame, zoomBtn, pickOut));
  let tapFn = null;
  const spots = new Map();

  // trazos en px de la imagen: escalan con su tamaño para verse igual en una figura más nítida
  const k = () => (img.naturalWidth || 1000) / 1000;
  const whenLoaded = (fn) => { if (img.complete && img.naturalWidth) fn(); else img.addEventListener('load', fn, { once: true }); };

  function size() {
    const w = img.naturalWidth || 1000, h = img.naturalHeight || 1400;
    layer.setAttribute('viewBox', `0 0 ${w} ${h}`);
    return { w, h };
  }
  /** Desplaza el marco para que los puntos de la tarjeta queden a la vista. */
  function reveal(list) {
    if (!list.length) return;
    const ys = list.map(h => h.y), xs = list.map(h => h.x);
    const s = stage.clientWidth / (img.naturalWidth || 1);
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2 * s, cx = (Math.min(...xs) + Math.max(...xs)) / 2 * s;
    frame.scrollTop = Math.max(0, cy - frame.clientHeight / 2);
    frame.scrollLeft = Math.max(0, cx - frame.clientWidth / 2);
  }
  img.addEventListener('load', () => {
    size();
    requestAnimationFrame(() => reveal(surface.hotspots || []));
    for (const hs of surface.hotspots || []) {
      const r = hs.r || 18;
      const node = svg('circle', { class: 'figura-hot', cx: hs.x, cy: hs.y, r, fill: 'transparent', tabindex: 0, 'data-id': hs.id });
      node.addEventListener('click', (e) => { e.stopPropagation(); tapFn?.(hs.id); });
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapFn?.(hs.id); } });
      gHot.append(node);
      spots.set(hs.id, hs);
    }
  });

  function imgPoint(evt) {
    const pt = layer.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(layer.getScreenCTM().inverse());
  }
  layer.addEventListener('click', (e) => {
    const p = imgPoint(e);
    // tolerancia: un clic a ≤ 22 px de pantalla de un hotspot cuenta como ese hotspot
    const scale = layer.getScreenCTM().a || 1;
    let best = null, bestD = Infinity;
    for (const hs of spots.values()) {
      const d = Math.hypot(hs.x - p.x, hs.y - p.y);
      if (d <= Math.max(hs.r || 18, 22 / scale) && d < bestD) { best = hs; bestD = d; }
    }
    if (picking) {
      pickOut.textContent = `{ "x": ${Math.round(p.x)}, "y": ${Math.round(p.y)} }`;
      pickOut.classList.remove('hidden');
      console.log('[pick]', Math.round(p.x), Math.round(p.y));
    }
    tapFn?.(best ? best.id : null);
  });

  zoomBtn.addEventListener('click', () => {
    frame.classList.toggle('zoomed');
    requestAnimationFrame(() => reveal(surface.hotspots || []));
    zoomBtn.textContent = frame.classList.contains('zoomed') ? '↙' : '⤢';
  });

  return {
    onTap(fn) { tapFn = fn; },
    highlight(ids, tone = 'hint') {
      whenLoaded(() => {
        for (const id of ids) {
          const hs = spots.get(id) || (surface.hotspots || []).find(h => h.id === id);
          if (!hs) continue;
          gMarks.append(svg('circle', { class: 'c-pulse', cx: hs.x, cy: hs.y, r: (hs.r || 18) + 10 * k(), fill: 'none', stroke: TONES[tone], 'stroke-width': 5 * k() }));
        }
      });
    },
    drawLine(a, b, tone = 'me') {
      whenLoaded(() => gMarks.append(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: TONES[tone] || tone, 'stroke-width': 5 * k(), 'stroke-linecap': 'round' })));
    },
    /** Círculos neutros: «estos son los candidatos» (no delatan la respuesta). */
    outline(ids) {
      whenLoaded(() => {
        for (const id of ids) {
          const hs = (surface.hotspots || []).find(h => h.id === id);
          if (hs) gHot.prepend(svg('circle', { cx: hs.x, cy: hs.y, r: (hs.r || 18) + 8 * k(), fill: 'none', stroke: '#c96442', 'stroke-width': 6 * k(), 'stroke-dasharray': `${12 * k()} ${8 * k()}`, 'pointer-events': 'none' }));
        }
      });
    },
    clearMarks() { gMarks.replaceChildren(); },
    destroy() { container.replaceChildren(); },
  };
}
