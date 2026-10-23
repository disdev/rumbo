// La carta viva (spec 2026-10-22 «Vuelo en ruta»): una carta de entrenamiento con
// el idioma visual de la seccional del examen — aeropuertos azul/magenta, MEF,
// obstáculos, banderas, Clase C, graticula con minutos — dibujada desde datos.
// Las herramientas (avión arrastrable, plotter, tira de papel, corte lateral)
// solo existen aquí, en la carta de Perú: el día del examen no hay plotter.
// Los colores de la carta son fijos (papel): en modo oscuro va enmarcada, no invertida.

import { el } from './players.js';
import { svg, uid } from './widget-kit.js';
import { project, chartAspect, distanceNM, trueCourse } from './misiones-logic.js';

const W = 1000; // unidades SVG a lo ancho de la carta completa
const INK = '#2b2a26', MAG = '#a3307c', BLUE = '#2a5aa0', SEA = '#cfe3ea', PENCIL = '#c96442';
const TERRAIN = { 1000: '#dde9c9', 2000: '#ece6bf', 5000: '#e4d09f', 10000: '#d2ad7c' };
const TONES = { ok: '#3f7d3a', bad: '#b8442f', hint: '#d08a1e', me: PENCIL };
const fmtFt = (n) => n.toLocaleString('es-PE').replace(/,/g, ' ');

function explainText(f, kind, chart) {
  switch (kind) {
    case 'airport':
      return f.tower
        ? `Azul = aeropuerto con torre de control. ${f.name}: elevación ${f.elev_ft} ft MSL, pista de ${fmtFt(f.rwy_len_ft)} ft, torre ${f.ct_freq}.`
        : `Magenta = aeropuerto sin torre. ${f.name}: elevación ${f.elev_ft} ft MSL.`;
    case 'obstacle':
      return `${f.group ? 'Grupo de obstáculos' : 'Obstáculo'}: la cima está a ${fmtFt(f.msl)} ft MSL (número en negrita) y mide ${f.agl} ft sobre el suelo (entre paréntesis).${f.lighted ? ' Tiene luces.' : ''}`;
    case 'checkpoint':
      return `Bandera magenta = punto de notificación visual VFR: «${f.name}». Desde aquí reportas tu posición.`;
    case 'airspace':
      return `Clase C de ${f.name}: el núcleo va del suelo a ${fmtFt(f.rings[0].ceiling)} ft MSL; el anillo de afuera, de ${fmtFt(f.rings[1].floor)} a ${fmtFt(f.rings[1].ceiling)} ft MSL. Para entrar, contacto por radio con el ATC.`;
    case 'caution':
      return `Cuadro de PRECAUCIÓN: avisa un peligro que desde el aire no ves. La altura está en ft MSL (sobre el nivel del mar), salvo que diga AGL.`;
    case 'legend':
      return 'Leyenda de tintes: cada color es una banda de elevación del terreno, en pies MSL. Verde = lo más bajo; mientras más tostado, más alto.';
    case 'mef':
      return `MEF ${Math.floor(f.ft / 1000)}${f.ft % 1000 / 100}: lo más alto de este cuadrante (terreno u obstáculo), redondeado hacia arriba = ${fmtFt(f.ft)} ft MSL.`;
    default:
      return chart.label;
  }
}

/**
 * @param container elemento donde va la carta (se adapta a su ancho y alto)
 * @param opts {layers?, explain?, route?, focus?: 'route'|'all'}
 */
export function renderCarta(container, chart, opts = {}) {
  const H = Math.round(W * chartAspect(chart.bounds));
  const P = project(chart.bounds, { w: W, h: H });
  const xy = (p) => P.toXY(p);
  const apById = Object.fromEntries(chart.airports.map(a => [a.id, a]));
  const nmUnits = (() => { // unidades SVG por NM (en dirección norte-sur)
    const a = xy({ lat: chart.bounds.north, lon: chart.bounds.west }), b = xy({ lat: chart.bounds.north - 1 / 60, lon: chart.bounds.west });
    return b.y - a.y;
  })();
  const layers = { aeropuertos: true, espacio: true, terreno: true, obstaculos: true, ...(opts.layers || {}) };
  let tapFn = null;
  const cleanups = [];

  const root = svg('svg', { class: 'carta-svg', role: 'img', 'aria-label': `${chart.title} — ${chart.label}` });
  const G = (cls) => svg('g', { class: cls });
  const gBase = G('c-base'), gTerrain = G('c-terrain'), gGrid = G('c-grid'), gMef = G('c-mef'), gAir = G('c-air'),
    gObst = G('c-obst'), gApt = G('c-apt'), gCp = G('c-cp'), gRoute = G('c-route'), gMarks = G('c-marks'), gTools = G('c-tools');
  root.append(gBase, gTerrain, gGrid, gMef, gAir, gRoute, gObst, gCp, gApt, gMarks, gTools);

  // ---- mar, tierra y relieve ----
  const clipId = uid('carta-clip');
  root.prepend(svg('defs', {}, svg('clipPath', { id: clipId }, svg('rect', { x: 0, y: 0, width: W, height: H }))));
  gBase.setAttribute('clip-path', `url(#${clipId})`);
  gTerrain.setAttribute('clip-path', `url(#${clipId})`);
  gBase.append(svg('rect', { x: -2000, y: -2000, width: W + 4000, height: H + 4000, fill: SEA }));
  const ptsStr = (arr) => arr.map(([lat, lon]) => { const p = xy({ lat, lon }); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
  const pad = 1;
  const land = [...chart.coast, [chart.bounds.south - pad, chart.coast[chart.coast.length - 1][1]], [chart.bounds.south - pad, chart.bounds.east + pad],
    [chart.bounds.north + pad, chart.bounds.east + pad], [chart.bounds.north + pad, chart.coast[0][1]]];
  gBase.append(svg('polygon', { points: ptsStr(land), fill: TERRAIN[1000] }));
  for (const t of chart.terrain) gTerrain.append(svg('polygon', { points: ptsStr(t.poly), fill: TERRAIN[t.top_ft] || TERRAIN[10000] }));
  // costa: línea de tinta sobre la tierra
  gBase.append(svg('polyline', { points: ptsStr(chart.coast), fill: 'none', stroke: '#3c6f86', 'stroke-width': 1.6 }));
  gBase.append(svg('text', { x: 40, y: H * 0.72, fill: '#3c6f86', 'font-size': 22, 'font-style': 'italic', 'letter-spacing': 3 }, 'OCÉANO PACÍFICO'));

  // ---- graticula: líneas cada 30′ y marcas de minuto en cada meridiano/paralelo ----
  const b = chart.bounds;
  for (let lat = b.north; lat >= b.south - 1e-9; lat -= 0.5) {
    const a = xy({ lat, lon: b.west }), c = xy({ lat, lon: b.east });
    gGrid.append(svg('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, stroke: INK, 'stroke-width': 0.8, 'stroke-opacity': 0.55 }));
    const deg = Math.floor(-lat + 1e-9), min = Math.round((-lat - deg) * 60);
    gGrid.append(svg('text', { x: 6, y: a.y - 5, fill: INK, 'font-size': 13, 'font-weight': 600 }, `${deg}°${String(min).padStart(2, '0')}′S`));
  }
  for (let lon = b.west; lon <= b.east + 1e-9; lon += 0.5) {
    const a = xy({ lat: b.north, lon }), c = xy({ lat: b.south, lon });
    gGrid.append(svg('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, stroke: INK, 'stroke-width': 0.8, 'stroke-opacity': 0.55 }));
    const deg = Math.floor(-lon + 1e-9), min = Math.round((-lon - deg) * 60);
    gGrid.append(svg('text', { x: a.x + 5, y: 18, fill: INK, 'font-size': 13, 'font-weight': 600 }, `${deg}°${String(min).padStart(2, '0')}′W`));
    // minutos de latitud a lo largo del meridiano: la regla para medir NM (1′ = 1 NM)
    for (let m = 1; m < (b.north - b.south) * 60; m++) {
      if (m % 30 === 0) continue;
      const p = xy({ lat: b.north - m / 60, lon });
      const len = m % 10 === 0 ? 9 : m % 5 === 0 ? 6 : 3.5;
      gGrid.append(svg('line', { x1: p.x - len, y1: p.y, x2: p.x + len, y2: p.y, stroke: INK, 'stroke-width': 0.7, 'stroke-opacity': 0.7 }));
    }
  }
  for (let lat = b.north; lat >= b.south - 1e-9; lat -= 0.5) {
    for (let m = 1; m < (b.east - b.west) * 60; m++) {
      if (m % 30 === 0) continue;
      const p = xy({ lat, lon: b.west + m / 60 });
      const len = m % 10 === 0 ? 7 : m % 5 === 0 ? 5 : 3;
      gGrid.append(svg('line', { x1: p.x, y1: p.y - len, x2: p.x, y2: p.y + len, stroke: INK, 'stroke-width': 0.6, 'stroke-opacity': 0.55 }));
    }
  }

  // ---- features tocables ----
  const features = new Map(); // id → {node, kind, data, at: {x,y}}
  function feature(g, id, kind, data, at, ...children) {
    const node = svg('g', { class: 'c-feat', 'data-id': id, tabindex: 0 }, ...children);
    node.addEventListener('click', (e) => { e.stopPropagation(); onFeature(id, e); });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFeature(id, null); } });
    g.append(node);
    features.set(id, { node, kind, data, at });
    return node;
  }

  for (const m of chart.mef) {
    if (!m.ft) continue;
    const c = xy({ lat: m.lat_n - 0.25, lon: m.lon_w + 0.25 });
    const id = `mef:${m.lat_n}:${m.lon_w}`;
    feature(gMef, id, 'mef', m, c,
      svg('rect', { x: c.x - 34, y: c.y - 40, width: 68, height: 56, fill: 'transparent' }),
      svg('text', { x: c.x - 6, y: c.y + 10, 'text-anchor': 'end', fill: BLUE, 'fill-opacity': 0.85, 'font-size': 52, 'font-weight': 800, 'font-family': 'Georgia, serif' }, String(Math.floor(m.ft / 1000))),
      svg('text', { x: c.x - 4, y: c.y - 14, fill: BLUE, 'fill-opacity': 0.85, 'font-size': 28, 'font-weight': 800, 'font-family': 'Georgia, serif' }, String(m.ft % 1000 / 100)));
  }

  for (const a of chart.airspace) {
    const c = xy(apById[a.center]);
    const [inner, outer] = a.rings;
    const kids = [
      svg('circle', { cx: c.x, cy: c.y, r: outer.radius_nm * nmUnits, fill: MAG, 'fill-opacity': 0.04, stroke: MAG, 'stroke-width': 3.2, 'stroke-opacity': 0.75 }),
      svg('circle', { cx: c.x, cy: c.y, r: inner.radius_nm * nmUnits, fill: MAG, 'fill-opacity': 0.05, stroke: MAG, 'stroke-width': 3.2, 'stroke-opacity': 0.85 }),
    ];
    const label = (x, y, top, bottom) => [
      svg('text', { x, y, 'text-anchor': 'middle', fill: MAG, 'font-size': 15, 'font-weight': 800 }, String(top)),
      svg('line', { x1: x - 13, y1: y + 4, x2: x + 13, y2: y + 4, stroke: MAG, 'stroke-width': 1.6 }),
      svg('text', { x, y: y + 19, 'text-anchor': 'middle', fill: MAG, 'font-size': 15, 'font-weight': 800 }, String(bottom)),
    ];
    // núcleo abajo-izquierda, anillo abajo-derecha: lejos de la ruta y de la caja de datos
    const at = (r, deg) => [c.x + r * Math.cos(deg * Math.PI / 180), c.y + r * Math.sin(deg * Math.PI / 180)];
    kids.push(...label(...at(inner.radius_nm * nmUnits * 0.62, 125), inner.ceiling / 100, inner.floor),
      ...label(...at((inner.radius_nm + outer.radius_nm) / 2 * nmUnits, 50), outer.ceiling / 100, outer.floor / 100));
    feature(gAir, a.id, 'airspace', a, c, ...kids);
  }

  for (const o of chart.obstacles) {
    const c = xy(o);
    const tower = (dx) => svg('path', { d: `M${c.x + dx - 6},${c.y} L${c.x + dx},${c.y - 17} L${c.x + dx + 6},${c.y}`, fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    const kids = [svg('circle', { cx: c.x, cy: c.y, r: 16, fill: 'transparent' }), tower(o.group ? -5 : 0)];
    if (o.group) kids.push(tower(6));
    kids.push(svg('circle', { cx: c.x + (o.group ? -5 : 0), cy: c.y - 1, r: 1.8, fill: INK }));
    if (o.lighted) kids.push(svg('path', { d: `M${c.x - 6},${c.y - 23} l3,4 M${c.x},${c.y - 25} l0,5 M${c.x + 6},${c.y - 23} l-3,4`, stroke: INK, 'stroke-width': 1.4 }));
    kids.push(svg('text', { x: c.x + 12, y: c.y - 6, fill: INK, 'font-size': 14, 'font-weight': 800 }, String(o.msl)),
      svg('text', { x: c.x + 12, y: c.y + 9, fill: INK, 'font-size': 12 }, `(${o.agl})`));
    feature(gObst, o.id, 'obstacle', o, c, ...kids);
  }

  for (const p of chart.checkpoints) {
    const c = xy(p);
    feature(gCp, p.id, 'checkpoint', p, c,
      svg('rect', { x: c.x - 14, y: c.y - 30, width: 40, height: 34, fill: 'transparent' }),
      svg('line', { x1: c.x, y1: c.y, x2: c.x, y2: c.y - 24, stroke: MAG, 'stroke-width': 2.4 }),
      svg('path', { d: `M${c.x},${c.y - 24} L${c.x + 15},${c.y - 19} L${c.x},${c.y - 13} Z`, fill: MAG }),
      svg('text', { x: c.x + 4, y: c.y + 15, fill: MAG, 'font-size': 13, 'font-weight': 700, 'text-anchor': 'middle' }, p.name.toUpperCase()));
  }

  for (const cz of chart.cautions || []) {
    const c = xy(cz), w = 116, h = 16 * cz.lines.length + 8;
    feature(gCp, cz.id, 'caution', cz, { x: c.x + w / 2, y: c.y + h / 2 },
      svg('rect', { x: c.x, y: c.y, width: w, height: h, fill: '#fffaf6', 'fill-opacity': 0.9, stroke: MAG, 'stroke-width': 1.6 }),
      ...cz.lines.map((t, i) => svg('text', { x: c.x + w / 2, y: c.y + 18 + i * 16, 'text-anchor': 'middle', fill: MAG, 'font-size': 12.5, 'font-weight': i === 0 ? 800 : 700 }, t)));
  }
  { // leyenda de tintes (en el mar, abajo a la izquierda)
    const c = xy({ lat: chart.bounds.south + 0.33, lon: chart.bounds.west + 0.04 });
    const tops = [1000, ...chart.terrain.map(t => t.top_ft)];
    const rows = tops.map((top, i) => [TERRAIN[top] || TERRAIN[10000], `${i ? fmtFt(tops[i - 1]) : '0'} – ${fmtFt(top)} ft`]);
    feature(gCp, 'legend', 'legend', {}, { x: c.x + 95, y: c.y + 20 + rows.length * 13 },
      svg('rect', { x: c.x, y: c.y, width: 190, height: 34 + rows.length * 26, rx: 6, fill: '#fffdf4', stroke: '#8f8668' }),
      svg('text', { x: c.x + 10, y: c.y + 20, fill: INK, 'font-size': 11.5, 'font-weight': 800, 'letter-spacing': 0.6 }, 'TERRENO (ft MSL)'),
      ...rows.flatMap(([col, label], i) => [
        svg('rect', { x: c.x + 10, y: c.y + 30 + i * 26, width: 34, height: 18, fill: col, stroke: '#8f8668', 'stroke-width': 0.8 }),
        svg('text', { x: c.x + 52, y: c.y + 44 + i * 26, fill: INK, 'font-size': 13, 'font-weight': 600 }, label)]));
  }

  for (const a of chart.airports) {
    const c = xy(a), col = a.tower ? BLUE : MAG;
    const kids = [svg('circle', { cx: c.x, cy: c.y, r: 22, fill: 'transparent' }),
      svg('circle', { cx: c.x, cy: c.y, r: 10, fill: '#fff', 'fill-opacity': 0.5, stroke: col, 'stroke-width': 3.4 }),
      svg('rect', { x: c.x - 2.3, y: c.y - 13, width: 4.6, height: 26, fill: col, transform: `rotate(154 ${c.x} ${c.y})` })];
    if (a.fuel) for (let k = 0; k < 4; k++) {
      const t = k * Math.PI / 2 + Math.PI / 4;
      kids.push(svg('line', { x1: c.x + 11.5 * Math.cos(t), y1: c.y + 11.5 * Math.sin(t), x2: c.x + 17 * Math.cos(t), y2: c.y + 17 * Math.sin(t), stroke: col, 'stroke-width': 3 }));
    }
    // caja de datos: a la izquierda (mar) o derecha; `label.dy` la sube/baja si choca con algo
    const left = a.label?.side === 'left' || (!a.label && a.lon < -77.4);
    const tx = left ? c.x - 22 : c.x + 22, anchor = left ? 'end' : 'start';
    const dy = a.label?.dy ?? 0;
    const lines = [a.name.toUpperCase()];
    if (a.ct_freq) lines.push(`CT – ${a.ct_freq}`);
    lines.push(`${a.elev_ft}${a.lighted ? ' L' : ''}${a.rwy_len_ft ? ` ${Math.round(a.rwy_len_ft / 100)}` : ''}`);
    lines.forEach((t, i) => kids.push(svg('text', { x: tx, y: c.y - 6 + dy + i * 15, 'text-anchor': anchor, fill: col, 'font-size': i ? 13 : 13.5, 'font-weight': i ? 700 : 800 }, t)));
    feature(gApt, a.id, 'airport', a, c, ...kids);
  }

  // rótulo de entrenamiento
  root.append(svg('g', { class: 'c-label' },
    svg('rect', { x: W - 330, y: H - 42, width: 318, height: 30, rx: 4, fill: '#fffaf0', stroke: '#b8442f', 'stroke-width': 1.5 }),
    svg('text', { x: W - 171, y: H - 22, 'text-anchor': 'middle', fill: '#b8442f', 'font-size': 13, 'font-weight': 700 }, chart.label)));

  // ---- capas ----
  function applyLayers() {
    gApt.style.display = layers.aeropuertos ? '' : 'none';
    gCp.style.display = layers.aeropuertos ? '' : 'none';
    gAir.style.display = layers.espacio ? '' : 'none';
    gTerrain.style.display = layers.terreno ? '' : 'none';
    gMef.style.display = layers.terreno ? '' : 'none';
    gObst.style.display = layers.obstaculos ? '' : 'none';
  }
  applyLayers();

  // ---- marco, zoom y popover ----
  const pop = el('div', { class: 'carta-pop hidden', role: 'status' });
  const zoomBar = el('div', { class: 'carta-zoom' },
    el('button', { class: 'carta-zbtn', title: 'Acercar', 'aria-label': 'Acercar', onclick: () => zoomBy(0.7) }, '+'),
    el('button', { class: 'carta-zbtn', title: 'Alejar', 'aria-label': 'Alejar', onclick: () => zoomBy(1 / 0.7) }, '−'),
    el('button', { class: 'carta-zbtn', title: 'Ver toda la carta', 'aria-label': 'Ver toda la carta', onclick: () => focusBox({ x: 0, y: 0, w: W, h: H }) }, '⤢'));
  const toolBar = el('div', { class: 'carta-toolbar' });
  const frame = el('div', { class: 'carta-frame' }, root, zoomBar, toolBar, pop);
  container.replaceChildren(frame);

  let view = { x: 0, y: 0, w: W, h: H };
  function fit(box) {
    const cw = frame.clientWidth || 600, ch = frame.clientHeight || 600;
    const ar = ch / cw;
    let { x, y, w, h } = box;
    if (h / w < ar) { const nh = w * ar; y -= (nh - h) / 2; h = nh; } else { const nw = h / ar; x -= (nw - w) / 2; w = nw; }
    // si cabe, que no se salga de la carta (sin franjas vacías)
    if (w <= W) x = Math.min(Math.max(x, 0), W - w);
    if (h <= H) y = Math.min(Math.max(y, 0), H - h);
    return { x, y, w, h };
  }
  function focusBox(box) {
    view = fit(box);
    root.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    hidePop();
  }
  function zoomBy(k) {
    const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
    focusBox({ x: cx - view.w * k / 2, y: cy - view.h * k / 2, w: view.w * k, h: view.h * k });
  }
  function routeBox(routeId, marginNm = 9) {
    const r = chart.routes.find(x => x.id === routeId);
    const a = xy(apById[r.from]), c = xy(apById[r.to]), m = marginNm * nmUnits;
    return { x: Math.min(a.x, c.x) - m, y: Math.min(a.y, c.y) - m, w: Math.abs(a.x - c.x) + 2 * m, h: Math.abs(a.y - c.y) + 2 * m };
  }
  const initial = () => (opts.route && opts.focus !== 'all' ? routeBox(opts.route) : { x: 0, y: 0, w: W, h: H });
  requestAnimationFrame(() => focusBox(initial()));
  const ro = new ResizeObserver(() => focusBox({ ...view }));
  ro.observe(frame);
  cleanups.push(() => ro.disconnect());

  function showPop(text, evt) {
    pop.textContent = text;
    pop.classList.remove('hidden');
    const r = frame.getBoundingClientRect();
    const x = evt ? evt.clientX - r.left : r.width / 2, y = evt ? evt.clientY - r.top : r.height / 2;
    pop.style.left = `${Math.min(Math.max(8, x - 140), r.width - 288)}px`;
    pop.style.top = `${y > r.height / 2 ? y - pop.offsetHeight - 16 : y + 16}px`;
  }
  function hidePop() { pop.classList.add('hidden'); }
  function onFeature(id, evt) {
    const f = features.get(id);
    if (opts.explain) showPop(explainText(f.data, f.kind, chart), evt);
    tapFn?.(id);
  }
  root.addEventListener('click', () => { hidePop(); tapFn?.(null); });

  // ---- puntero → coordenadas de la carta ----
  function svgPoint(evt) {
    const pt = root.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(root.getScreenCTM().inverse());
  }
  /** Arrastre con captura del puntero: termina aunque se suelte fuera del SVG. */
  function draggable(node, { onMove, onEnd } = {}) {
    node.style.cursor = 'grab';
    node.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      node.setPointerCapture(e.pointerId);
      node.style.cursor = 'grabbing';
      const move = (ev) => onMove?.(svgPoint(ev), ev);
      const up = (ev) => {
        node.releasePointerCapture(ev.pointerId);
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', up);
        node.style.cursor = 'grab';
        onEnd?.();
      };
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', up);
    });
  }
  const toolButton = (label, fn) => el('button', { class: 'carta-toolbtn', onclick: fn }, label);
  let toolCleanup = null; // listeners de la herramienta activa (p. ej. ← → del plotter)
  function clearTools() { toolCleanup?.(); toolCleanup = null; gTools.replaceChildren(); toolBar.replaceChildren(); }

  const planeShape = () => svg('path', {
    d: 'M0,-15 L3,-4 L15,3 L15,6 L3,3 L2,11 L6,14 L6,16 L0,14 L-6,16 L-6,14 L-2,11 L-3,3 L-15,6 L-15,3 L-3,-4 Z',
    fill: PENCIL, stroke: '#fff', 'stroke-width': 1.2,
  });

  const api = {
    width: W, height: H, nmUnits, xy,
    setLayers(partial) { Object.assign(layers, partial); applyLayers(); },
    onTap(fn) { tapFn = fn; },
    focusRoute(routeId, marginNm) { focusBox(routeBox(routeId, marginNm)); },
    focusAll() { focusBox({ x: 0, y: 0, w: W, h: H }); },
    focusFeature(id, nm = 14) {
      const f = features.get(id);
      if (!f) return;
      const m = nm * nmUnits;
      // aeropuertos: correr el encuadre hacia su caja de datos para que se lea entera
      const dx = f.kind === 'airport' ? (f.data.label?.side === 'left' || (!f.data.label && f.data.lon < -77.4) ? -0.4 : 0.4) * m : 0;
      focusBox({ x: f.at.x - m + dx, y: f.at.y - m, w: 2 * m, h: 2 * m });
    },
    /** Celebración: el avión vuela la ruta de punta a punta. */
    flyRoute(routeId, ms = 2600) {
      const r = chart.routes.find(x => x.id === routeId);
      const a = xy(apById[r.from]), c = xy(apById[r.to]);
      const ang = Math.atan2(c.x - a.x, a.y - c.y) * 180 / Math.PI;
      const g = svg('g', {}, planeShape());
      gTools.append(g);
      const t0 = performance.now();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const frameFn = (now) => {
        const k = reduce ? 1 : Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        g.setAttribute('transform', `translate(${a.x + (c.x - a.x) * e} ${a.y + (c.y - a.y) * e}) rotate(${ang}) scale(1.4)`);
        if (k < 1) requestAnimationFrame(frameFn);
      };
      requestAnimationFrame(frameFn);
    },
    explainFeature(id) { const f = features.get(id); if (f) showPop(explainText(f.data, f.kind, chart), null); },
    highlight(ids, tone = 'hint') {
      for (const id of ids) {
        const f = features.get(id);
        if (!f) continue;
        gMarks.append(svg('circle', { class: 'c-pulse', cx: f.at.x, cy: f.at.y, r: 30, fill: 'none', stroke: TONES[tone], 'stroke-width': 4 }));
      }
    },
    pulse(ids) { api.highlight(ids, 'hint'); }, // clase: «mira esto» (el anillo ya late, .c-pulse)
    clearMarks() { gMarks.replaceChildren(); hidePop(); },
    drawRoute(routeId) {
      const r = chart.routes.find(x => x.id === routeId);
      const a = xy(apById[r.from]), c = xy(apById[r.to]);
      gRoute.replaceChildren(svg('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, stroke: PENCIL, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-dasharray': '12 9' }));
    },
    /** Línea desde un punto con un curso y largo: «tu» curso vs el de verdad. */
    drawLine(from, courseDeg, nm, tone = 'me') {
      const a = xy(from), t = courseDeg * Math.PI / 180, len = nm * nmUnits;
      const c = { x: a.x + Math.sin(t) * len, y: a.y - Math.cos(t) * len };
      gMarks.append(svg('line', { x1: a.x, y1: a.y, x2: c.x, y2: c.y, stroke: TONES[tone] || tone, 'stroke-width': 3.5, 'stroke-linecap': 'round' }),
        svg('circle', { cx: c.x, cy: c.y, r: 5, fill: TONES[tone] || tone }));
    },
    showRing(at, nm, tone = 'ok') {
      const c = xy(at);
      gMarks.append(svg('circle', { cx: c.x, cy: c.y, r: Math.max(nm * nmUnits, 6), fill: TONES[tone], 'fill-opacity': 0.12, stroke: TONES[tone], 'stroke-width': 2.5, 'stroke-dasharray': '6 5' }));
    },
    showPoint(at, tone = 'me') {
      const c = xy(at);
      gMarks.append(svg('g', { transform: `translate(${c.x} ${c.y})`, opacity: 0.9 }, planeShape()));
      if (tone !== 'me') gMarks.lastChild.firstChild.setAttribute('fill', TONES[tone]);
    },
    /** Avión arrastrable. Devuelve {value() → {lat,lon}, destroy()}. */
    placePlane(initialLatLon, { readout: withReadout = true } = {}) {
      clearTools();
      const pos = { ...initialLatLon };
      const g = svg('g', { class: 'c-plane' }, svg('circle', { r: 26, fill: PENCIL, 'fill-opacity': 0.14, stroke: PENCIL, 'stroke-opacity': 0.5 }), planeShape());
      const put = () => { const c = xy(pos); g.setAttribute('transform', `translate(${c.x} ${c.y})`); };
      put();
      gTools.append(g);
      const readout = el('span', { class: 'carta-readout' });
      const show = () => {
        const dm = (v) => { const a = Math.abs(v), d = Math.floor(a), m = Math.round((a - d) * 60); return m === 60 ? `${d + 1}°00′` : `${d}°${String(m).padStart(2, '0')}′`; };
        readout.textContent = `${dm(pos.lat)}S · ${dm(pos.lon)}W`;
      };
      show();
      if (withReadout) toolBar.append(readout);
      else toolBar.append(el('span', { class: 'carta-readout' }, 'Arrastra el avión ✈'));
      draggable(g, { onMove: (p) => { Object.assign(pos, P.toLatLon(p)); put(); show(); } });
      return { value: () => ({ lat: pos.lat, lon: pos.lon }), destroy: clearTools };
    },
    /** Plotter de práctica: una regla que gira sobre una rosa de rumbos verdaderos
     *  en el centro de la ruta. Se usa una sola vez para VER el curso. */
    plotter(routeId) {
      clearTools();
      const r = chart.routes.find(x => x.id === routeId);
      const A = apById[r.from], B = apById[r.to];
      const a = xy(A), c = xy(B), mid = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 };
      const R = Math.min(140, Math.hypot(c.x - a.x, c.y - a.y) * 0.32);
      let angle = 45;
      const rose = svg('g', { transform: `translate(${mid.x} ${mid.y})` },
        svg('circle', { r: R, fill: '#fff', 'fill-opacity': 0.82, stroke: INK, 'stroke-opacity': 0.5 }));
      for (let d = 0; d < 360; d += 1) {
        const len = d % 10 === 0 ? 14 : d % 5 === 0 ? 9 : 5, t = d * Math.PI / 180;
        rose.append(svg('line', { x1: Math.sin(t) * R, y1: -Math.cos(t) * R, x2: Math.sin(t) * (R - len), y2: -Math.cos(t) * (R - len), stroke: INK, 'stroke-width': d % 10 === 0 ? 1.4 : 0.7 }));
        if (d % 30 === 0) rose.append(svg('text', { x: Math.sin(t) * (R - 28), y: -Math.cos(t) * (R - 28) + 5, 'text-anchor': 'middle', fill: INK, 'font-size': 14, 'font-weight': 700 }, String(d === 0 ? 360 : d)));
      }
      const L = Math.hypot(c.x - a.x, c.y - a.y) * 0.55;
      const ruler = svg('g', {},
        svg('rect', { x: -9, y: -L, width: 18, height: 2 * L, rx: 4, fill: '#ffffff', 'fill-opacity': 0.72, stroke: INK, 'stroke-opacity': 0.55 }),
        svg('path', { d: `M0,${-R - 2} l-9,16 l18,0 z`, fill: PENCIL }),
        svg('line', { x1: 0, y1: -L, x2: 0, y2: L, stroke: PENCIL, 'stroke-width': 1.4 }),
        svg('circle', { r: 6, fill: '#fff', stroke: INK }));
      const rot = svg('g', { transform: `translate(${mid.x} ${mid.y}) rotate(${angle})`, class: 'c-plotter' }, ruler);
      gTools.append(rose, rot);
      const setAngle = (v) => { angle = ((v % 360) + 360) % 360; rot.setAttribute('transform', `translate(${mid.x} ${mid.y}) rotate(${angle})`); };
      draggable(rot, { onMove: (p) => setAngle(Math.atan2(p.x - mid.x, mid.y - p.y) * 180 / Math.PI) });
      const wheel = (e) => { e.preventDefault(); setAngle(angle + (e.deltaY > 0 ? 1 : -1)); };
      rot.addEventListener('wheel', wheel, { passive: false });
      const key = (e) => {
        if (e.target.closest?.('input, textarea')) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setAngle(angle + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
      };
      document.addEventListener('keydown', key);
      toolCleanup = () => document.removeEventListener('keydown', key);
      toolBar.append(el('span', { class: 'carta-readout' }, 'Gira la regla (arrastra, rueda o ← →) hasta que la flecha vaya de ', A.name, ' hacia ', B.name, '. Lee el número de la rosa.'));
      return { angle: () => angle, destroy: clearTools };
    },
    /** Tira de papel: marcas en los dos extremos de la ruta; se lleva al meridiano y se cuentan minutos (1′ = 1 NM). */
    paperStrip(routeId) {
      clearTools();
      const r = chart.routes.find(x => x.id === routeId);
      const a = xy(apById[r.from]), c = xy(apById[r.to]);
      const len = Math.hypot(c.x - a.x, c.y - a.y);
      const routeAngle = Math.atan2(c.x - a.x, a.y - c.y) * 180 / Math.PI;
      const pos = { x: a.x, y: a.y };
      let vertical = false;
      const strip = svg('g', { class: 'c-strip' },
        svg('rect', { x: -14, y: -len - 30, width: 28, height: len + 60, fill: '#fffdf4', 'fill-opacity': 0.55, stroke: '#8f8668', rx: 2 }),
        svg('line', { x1: -14, y1: 0, x2: 14, y2: 0, stroke: INK, 'stroke-width': 2.4 }),
        svg('line', { x1: -14, y1: -len, x2: 14, y2: -len, stroke: INK, 'stroke-width': 2.4 }),
        svg('text', { x: 18, y: 4, fill: INK, 'font-size': 12, 'font-style': 'italic' }, 'A'),
        svg('text', { x: 18, y: -len + 4, fill: INK, 'font-size': 12, 'font-style': 'italic' }, 'B'));
      const put = () => strip.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${vertical ? 0 : routeAngle})`);
      put();
      gTools.append(strip);
      let grab = null;
      draggable(strip, {
        onMove: (p) => {
          if (!grab) grab = { dx: p.x - pos.x, dy: p.y - pos.y };
          pos.x = p.x - grab.dx; pos.y = p.y - grab.dy; put();
        },
        onEnd: () => { grab = null; },
      });
      toolBar.append(toolButton(vertical ? '↻ Alinéala con la ruta' : '↻ Ponla vertical', function () {
        vertical = !vertical; put();
        this.textContent = vertical ? '↻ Alinéala con la ruta' : '↻ Ponla vertical';
      }), el('span', { class: 'carta-readout' }, 'Lleva la tira a un meridiano y cuenta las rayitas de minuto entre A y B.'));
      return { nm: () => len / nmUnits, destroy: clearTools };
    },
    clearTools,
    /** Corte lateral de un espacio aéreo, con el avión a cierta altitud. */
    sideView(airspaceId, planeAltFt = null) {
      const a = chart.airspace.find(x => x.id === airspaceId);
      const [inner, outer] = a.rings;
      const top = outer.ceiling + 1500, Wd = 560, Hd = 200, sx = Wd / (2 * outer.radius_nm + 6), sy = (Hd - 40) / top;
      const X = (nm) => Wd / 2 + nm * sx, Y = (ft) => Hd - 24 - ft * sy;
      const box = svg('svg', { viewBox: `0 0 ${Wd} ${Hd}`, class: 'carta-side' },
        svg('rect', { x: 0, y: 0, width: Wd, height: Hd, fill: '#f6f3e8' }),
        svg('rect', { x: 0, y: Y(0), width: Wd, height: 24, fill: '#c9b78a' }),
        svg('rect', { x: X(-outer.radius_nm), y: Y(outer.ceiling), width: 2 * outer.radius_nm * sx, height: Y(outer.floor) - Y(outer.ceiling), fill: MAG, 'fill-opacity': 0.18, stroke: MAG }),
        svg('rect', { x: X(-inner.radius_nm), y: Y(inner.ceiling), width: 2 * inner.radius_nm * sx, height: Y(0) - Y(inner.ceiling), fill: MAG, 'fill-opacity': 0.28, stroke: MAG }),
        svg('text', { x: X(outer.radius_nm) + 6, y: Y(outer.ceiling) + 4, fill: INK, 'font-size': 12 }, `${fmtFt(outer.ceiling)} ft`),
        svg('text', { x: X(outer.radius_nm) + 6, y: Y(outer.floor) + 4, fill: INK, 'font-size': 12 }, `${fmtFt(outer.floor)} ft`),
        svg('text', { x: 10, y: 18, fill: '#6b6a5e', 'font-size': 11, 'letter-spacing': 1.4 }, `CORTE LATERAL · CLASE ${a.class} · ${a.name.toUpperCase()}`));
      if (planeAltFt != null) box.append(svg('g', { transform: `translate(${X(-outer.radius_nm - 2)} ${Y(planeAltFt)}) rotate(90)` }, planeShape()));
      return box;
    },
    destroy() { clearTools(); cleanups.forEach(f => f()); container.replaceChildren(); },
    routeCourse(routeId) { const r = chart.routes.find(x => x.id === routeId); return trueCourse(apById[r.from], apById[r.to]); },
    routeDistance(routeId) { const r = chart.routes.find(x => x.id === routeId); return distanceNM(apById[r.from], apById[r.to]); },
  };
  if (opts.route) api.drawRoute(opts.route);
  return api;
}
