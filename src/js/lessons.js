// Player de lecciones (SPEC §5.8, contenido §3.4): la app enseña.
// Una sección por pantalla, puntos de progreso, "Continuar" — unidades chicas,
// cero decisiones. Los checks nunca bloquean por corrección; el cuaderno es
// auto-reporte. Todo queda en el log (lesson_progress / lesson_check / notebook).

import { el, flashCelebrate, breakScreen } from './players.js';
import { WIDGETS } from './widgets.js';
import { guidedExample, practicaBurst, notebookPrompt } from './guided.js';
import { generateProblem } from './mathgen.js';

const cache = new Map();
export async function loadLesson(chapterId) {
  const id = String(chapterId).padStart(2, '0');
  if (!cache.has(id)) {
    cache.set(id, fetch(`data/lessons/ch${id}.json`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => { cache.delete(id); return null; }));
  }
  return cache.get(id);
}

// ---------- mini-markdown: **b**, *i*, `c`, listas "- " ----------
export function md(text) {
  const wrap = el('div', { class: 'md' });
  const lines = String(text).split('\n');
  let ul = null;
  for (const line of lines) {
    if (line.trim().startsWith('- ')) {
      if (!ul) { ul = el('ul', {}); wrap.append(ul); }
      ul.append(el('li', {}, ...inline(line.trim().slice(2))));
    } else if (line.trim()) {
      ul = null;
      wrap.append(el('p', {}, ...inline(line)));
    }
  }
  return wrap;
}
function inline(s) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[2]) out.push(el('strong', {}, m[2]));
    else if (m[3]) out.push(el('em', {}, m[3]));
    else out.push(el('code', {}, m[4]));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const CALLOUT_META = {
  clave: { icon: '🔑', title: 'Idea clave' },
  ojo: { icon: '⚠️', title: '¡Ojo! Trampa común' },
  memoria: { icon: '🧠', title: 'Para memorizar' },
  examen: { icon: '🎯', title: 'Esto cae en el examen' },
};

// ---------- render de bloques ----------
async function renderBlock(b, ctx, sec, chapter, checksState) {
  switch (b.type) {
    case 'text': return md(b.md);
    case 'callout': {
      const meta = CALLOUT_META[b.style] || CALLOUT_META.clave;
      return el('div', { class: `callout callout-${b.style}` },
        el('div', { class: 'callout-title' }, `${meta.icon} ${meta.title}`), md(b.md));
    }
    case 'diagram': {
      const wrap = el('figure', { class: 'lesson-diagram' });
      try {
        const svgText = await fetch(`data/lessons/diagrams/${encodeURIComponent(b.src)}`).then(r => { if (!r.ok) throw 0; return r.text(); });
        const holder = el('div', { class: 'diagram-svg' });
        holder.innerHTML = svgText;
        wrap.append(holder);
      } catch { /* sin red y sin caché: igual mostramos el caption */ }
      wrap.append(el('figcaption', { class: 'note' }, b.caption || ''));
      return wrap;
    }
    case 'figure':
      return el('figure', { class: 'lesson-diagram' },
        el('img', { class: 'figure', src: `data/figures/${encodeURIComponent(b.src)}`, alt: b.caption || 'figura' }),
        el('figcaption', { class: 'note' }, b.caption || ''));
    case 'table': {
      const t = el('table', { class: 'lesson-table' },
        el('tr', {}, ...b.headers.map(h => el('th', {}, h))),
        ...b.rows.map(r => el('tr', {}, ...r.map(c => el('td', {}, String(c))))));
      return el('div', { class: 'table-scroll' }, t);
    }
    case 'widget': {
      const box = el('div', { class: 'widget-box' });
      try {
        WIDGETS[b.name](box, b.params || {});
        box.append(el('p', { class: 'note center' }, b.caption || ''));
      } catch {
        // §5.8: un widget roto degrada, jamás bloquea
        box.replaceChildren(el('p', { class: 'note' }, b.caption || 'Demostración no disponible.'));
      }
      return box;
    }
    case 'notebook': {
      const btn = el('button', { class: 'primary notebook-btn' }, 'Hecho ✓');
      const box = el('div', { class: 'callout notebook-card' },
        el('div', { class: 'callout-title' }, '📓 En tu cuaderno'),
        el('p', {}, b.prompt), btn);
      btn.addEventListener('click', () => {
        ctx.append({ kind: 'notebook', chapter, detail: { prompt_id: b.id, section: sec.id } });
        btn.disabled = true;
        btn.textContent = 'Anotado en tu cuaderno ✓';
        box.classList.add('done');
      }, { once: true });
      return box;
    }
    case 'check': {
      checksState.total++;
      const buttons = b.options.map((opt, i) => el('button', { class: 'option', onclick: () => pick(i) }, opt));
      const why = el('p', { class: 'reason', hidden: 'true' }, '');
      const box = el('div', { class: 'check-box' },
        el('p', { class: 'check-q' }, `✔️ ${b.q}`), ...buttons, why);
      function pick(i) {
        const correct = i === b.answer;
        buttons.forEach((btn, j) => {
          btn.disabled = true;
          if (j === b.answer) btn.classList.add('correct');
          else if (j === i) btn.classList.add('wrong');
        });
        why.hidden = false;
        why.textContent = (correct ? '✅ ' : '❌ ') + b.why;
        ctx.append({ kind: 'lesson_check', chapter, detail: { check_id: b.id, section: sec.id, chosen: i, correct } });
        checksState.answered++;
        checksState.onChange();
      }
      return box;
    }
    case 'guided_math': {
      const btn = el('button', { class: 'primary' }, '🧭 Ejemplo guiado paso a paso');
      const box = el('div', { class: 'callout guided-launch' },
        el('div', { class: 'callout-title' }, '🔢 Matemática con receta'),
        el('p', {}, 'Un ejemplo resuelto contigo, paso por paso, y luego practicas con números nuevos.'), btn);
      btn.addEventListener('click', () => box.dispatchEvent(new CustomEvent('guidedmath', { bubbles: true, detail: b })));
      return box;
    }
    default: return el('p', { class: 'note' }, '');
  }
}

// ---------- primera pasada secuencial (bloque de sesión) ----------
export async function leccionPlayer(root, block, ctx) {
  const lesson = await loadLesson(block.chapter);
  if (!lesson) {
    // sin lección autorada aún: degrada al viejo bloque de lectura (§4.3 v1)
    const ch = ctx.data.chapters.chapters.find(c => c.id === block.chapter);
    return new Promise(resolve => {
      root.replaceChildren(el('div', { class: 'card' },
        el('h3', {}, `📖 Cap. ${block.chapter} — ${ch?.title || ''}`),
        el('p', { class: 'question' }, ch?.pages ? `Lee las páginas ${ch.pages} del PHAK.` : 'Lee el capítulo en el PHAK.'),
        el('button', { class: 'primary', onclick: () => { ctx.append({ kind: 'block', chapter: block.chapter, detail: { type: 'lectura', chapter: block.chapter, done: true } }); resolve(); } }, 'Ya leí — libro cerrado')));
    });
  }

  const seen = ctx.state.lessons.get(String(lesson.chapter))?.sectionsSeen || new Set();
  let idx = lesson.sections.findIndex(s => !seen.has(s.id));
  if (idx === -1) idx = 0; // todo visto: repaso rápido desde el inicio

  const mid = Math.ceil(lesson.sections.length / 2);
  let breakOffered = false;
  while (idx < lesson.sections.length) {
    const isLast = idx === lesson.sections.length - 1;
    await runSection(root, lesson, idx, ctx, { mode: 'primera', isLast });
    idx++;
    // una lección entera es larga: celebra la mitad y ofrece el descanso normal
    if (idx === mid && !isLast) flashCelebrate(root, '¡Mitad de la lección! 🧗');
    if (idx >= mid && !breakOffered && idx < lesson.sections.length) {
      breakOffered = true;
      await breakScreen(root, 5 * 60, 'Media lección hecha. Cinco minutos de aire y vuelves por el resto.');
    }
  }
}

function dots(lesson, idx) {
  return el('div', { class: 'lesson-dots' },
    ...lesson.sections.map((s, i) => el('span', { class: `dot ${i < idx ? 'done' : i === idx ? 'now' : ''}` })));
}

function runSection(root, lesson, idx, ctx, { mode, isLast }) {
  return new Promise((resolve) => {
    const sec = lesson.sections[idx];
    const chapter = String(lesson.chapter);
    const startTs = Date.now();
    // Dos pantallas por sección (§5.8): primero la enseñanza, después los
    // checks con el material FUERA de la vista — recordar, no mirar arriba.
    const teachBlocks = sec.blocks.filter(b => b.type !== 'check');
    const checkBlocks = sec.blocks.filter(b => b.type === 'check');
    const pages = sec.phak_pages || null;

    const header = () => [
      dots(lesson, idx),
      el('p', { class: 'lesson-kicker' }, `Cap. ${lesson.chapter} · ${lesson.title}`),
      el('h2', { class: 'lesson-title' }, sec.title),
    ];

    function finish() {
      const seconds = Math.round((Date.now() - startTs) / 1000);
      ctx.append({
        kind: 'lesson_progress', chapter, duration_sec: seconds,
        detail: { section: sec.id, seconds, ...(isLast && mode === 'primera' ? { completed: true } : {}), ...(mode === 'repaso' ? { review: true } : {}) },
      });
      ctx.refresh();
      resolve();
    }

    const doneLabel = isLast && mode === 'primera' ? 'Terminé la lección ✅' : 'Continuar →';

    async function showTeach() {
      const body = el('div', { class: 'lesson-body' });
      const silent = { total: 0, answered: 0, onChange: () => {} };
      for (const b of teachBlocks) body.append(await renderBlock(b, ctx, sec, chapter, silent));
      const nextBtn = el('button', { class: 'primary', onclick: () => (checkBlocks.length ? showChecks() : finish()) },
        checkBlocks.length ? 'Listo — pruébame 🧠' : doneLabel);
      const card = el('div', { class: 'card lesson-card' }, ...header(), body,
        pages ? el('p', { class: 'pageref' }, `Para profundizar: PHAK páginas ${pages}`) : '',
        nextBtn);
      // guided_math burbujea desde su bloque: corre a pantalla completa y vuelve
      card.addEventListener('guidedmath', async (e) => {
        const { family, tier } = e.detail;
        const prob = generateProblem(ctx.data.templates, family, tier);
        const g = await guidedExample(root, prob, ctx, { title: 'Ejemplo guiado' });
        ctx.append({ kind: 'drill', family, tier, score: g.stepsCorrect, total: g.stepsTotal, detail: { mode: 'guiada', lesson: sec.id } });
        await notebookPrompt(root, ctx, { id: `${sec.id}-receta`, prompt: 'Copia esta receta en tu cuaderno, paso por paso, con el ejemplo resuelto.', context: 'math', recipe: prob });
        await practicaBurst(root, { family, tier }, ctx);
        showTeach();
      }, { once: true });
      root.replaceChildren(card);
      window.scrollTo(0, 0);
    }

    async function showChecks() {
      const checksState = { total: 0, answered: 0, onChange: updateGate };
      const body = el('div', { class: 'lesson-body' });
      for (const b of checkBlocks) body.append(await renderBlock(b, ctx, sec, chapter, checksState));
      const contBtn = el('button', { class: 'primary', onclick: finish }, doneLabel);
      const gateNote = el('p', { class: 'note center' }, '');
      function updateGate() {
        const ready = checksState.answered >= checksState.total;
        contBtn.disabled = !ready;
        gateNote.textContent = ready ? '' : `Responde ${checksState.total - checksState.answered} pregunta(s) para seguir — equivocarse está perfecto, es parte de aprender.`;
      }
      const card = el('div', { class: 'card lesson-card' }, ...header(),
        el('p', { class: 'check-intro' }, '🧠 Sin mirar atrás: ¿qué se te quedó?'),
        body, gateNote, contBtn,
        el('button', { class: 'ghost', onclick: showTeach }, '← Volver a la explicación'));
      updateGate();
      root.replaceChildren(card);
      window.scrollTo(0, 0);
    }

    showTeach();
  });
}

// ---------- repaso libre (lista de capítulos → secciones) ----------
export async function lessonReview(root, chapterId, ctx, onExit, targetSection = null) {
  const lesson = await loadLesson(chapterId);
  if (!lesson) { onExit(); return; }

  async function showSection(i) {
    await runSection(root, lesson, i, ctx, { mode: 'repaso', isLast: true });
    menu();
  }

  function menu() {
    const seen = ctx.state.lessons.get(String(lesson.chapter))?.sectionsSeen || new Set();
    // Videos sugeridos (§3.4): suplemento opcional, solo en repaso, enlaces de
    // búsqueda (no se rompen); requieren internet y jamás bloquean nada.
    const videos = (lesson.videos || []).map(v => el('a', {
      class: 'option video-link', target: '_blank', rel: 'noopener',
      href: `https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}`,
    }, `🎬 ${v.title}`));
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, `Cap. ${lesson.chapter} — ${lesson.title}`),
      el('p', { class: 'note' }, lesson.resumen || ''),
      ...lesson.sections.map((s, i) => el('button', { class: 'option', onclick: () => showSection(i) },
        `${seen.has(s.id) ? '✅' : '⬜'} ${s.title}`)),
      ...(videos.length ? [el('h4', { class: 'section-title' }, 'Videos sugeridos (el mismo tema, contado distinto)'), ...videos,
        el('p', { class: 'note' }, 'Se abren en YouTube — necesitan internet. Son un extra, no una tarea.')] : []),
      el('button', { class: 'ghost', onclick: onExit }, 'Volver')));
  }

  if (targetSection) {
    const i = lesson.sections.findIndex(s => s.id === targetSection);
    if (i >= 0) { await showSection(i); return; }
  }
  menu();
}

/** Lista de capítulos para el repaso desde el inicio. */
export function lessonList(root, ctx, onExit) {
  const { chapters } = ctx.data;
  const assigned = chapters.chapters.filter(c => c.week);
  const items = assigned.sort((a, b) => (a.week - b.week) || (Number(a.id) - Number(b.id))).map(ch => {
    const L = ctx.state.lessons.get(ch.id);
    const done = L?.completed;
    return el('button', { class: 'option', onclick: () => lessonReview(root, ch.id, ctx, () => lessonList(root, ctx, onExit)) },
      `${done ? '✅' : L?.sectionsSeen.size ? '📖' : '⬜'} Semana ${ch.week} · Cap. ${ch.id} — ${ch.title}`);
  });
  root.replaceChildren(el('div', { class: 'card' },
    el('h3', {}, '📚 Lecciones'),
    el('p', { class: 'note' }, 'Repasa cualquier lección cuando quieras. La primera pasada completa se hace en la sesión.'),
    ...items,
    el('button', { class: 'ghost', onclick: onExit }, 'Volver')));
}
