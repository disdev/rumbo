// El taller (SPEC §5.11): juegos interactivos y recetas de matemática para los
// temas que más cuestan entender leyendo — viento/pista/patrón, el diagrama
// del aeropuerto y la navegación. Abierto en cualquier momento desde el home,
// fuera del plan del día. Los juegos no puntúan ni registran (son widgets,
// §3.4); las recetas registran drills guiada/practica como cualquier otra
// matemática, pero sus familias viven fuera de la escalera (§5.2).

import { el } from './players.js';
import { WIDGETS } from './widgets.js';
import { generateProblem } from './mathgen.js';
import { guidedExample, practicaBurst } from './guided.js';
import { lessonReview } from './lessons.js';
import { hangarView } from './hangar.js';
import { misionesCard } from './misiones.js';
import { claseCardView, claseView, currentChapter } from './clase.js';

const TOOLS = [
  {
    id: 'torre', icon: '🗼', title: 'Tú eres la torre',
    sub: 'Lee la manga y el círculo segmentado: elige pista y patrón',
    how: 'Mira la manga (apunta hacia donde VA el viento) y elige la pista para aterrizar contra el viento. Luego lee la L de esa pista en el círculo segmentado para saber si el patrón es izquierdo o derecho. Al final ves tu circuito con el rumbo de cada tramo.',
    lessons: [['14', '14-9', 'Manga, tetraedro y círculo segmentado'], ['14', '14-8', 'El patrón de tráfico']],
  },
  {
    id: 'rodaje', icon: '🚕', title: 'Rodaje sin incursiones',
    sub: 'Sigue la autorización en el plano del aeropuerto',
    how: 'Lee la autorización completa ANTES de moverte: ¿por qué calles vas y dónde termina? Toca los puntos resaltados para rodar y, cuando llegues a donde termina tu autorización, toca «Me detengo aquí». Si entras a una pista sin autorización, es incursión. Fíjate en los letreros: rojo = mandatorio, negro con amarillo = dónde estás, amarillo con negro = hacia dónde va cada calle.',
    lessons: [['14', '14-4', 'Calles de rodaje y líneas de espera'], ['14', '14-5', 'Letreros'], ['14', '14-12', 'Incursiones en pista']],
  },
  {
    id: 'navegador', icon: '🧭', title: 'Navegador',
    sub: 'Triángulo de viento y los dos nortes',
    how: 'Mueve el viento y mira cómo la nariz apunta a un lado para que el avión vaya derecho por el curso. Apaga la corrección para ver cuánto te deriva. Abajo, la cadena completa: curso → WCA → rumbo verdadero → variación → rumbo magnético.',
    lessons: [['16', '16-6', 'Curso, rumbo y derrota'], ['16', '16-4', 'La variación magnética']],
  },
];

const RECIPES = [
  { family: 'rumbo', icon: '🧮', sub: 'Curso → viento → variación → desviación', levels: ['Solo variación', '+ corrección por viento', '+ desviación: rumbo de brújula'] },
  { family: 'circuito', icon: '🧮', sub: 'Pista → rumbo de cada tramo del patrón', levels: ['Tramo a favor del viento', 'Tramo básico, izquierdo o derecho', 'Viento → pista → tramo cruzado'] },
];

export function tallerView(root, ctx, onExit) {
  const fam = (id) => ctx.data.templates.families.find(f => f.id === id);

  function menu() {
    ctx.nav?.('taller');
    root.replaceChildren(el('div', { class: 'card' },
      el('h3', {}, '🧪 El taller'),
      el('p', { class: 'note' }, 'Para jugar con el patrón, el aeropuerto y la navegación hasta que se sientan fáciles. Cuando quieras, las veces que quieras — fuera del plan de hoy.'),
      el('h4', { class: 'section-title' }, '📘 La carta, paso a paso'),
      el('p', { class: 'note' }, 'Aprende a leer la carta símbolo por símbolo, con trucos para recordarlos. Empieza aquí antes de las misiones.'),
      claseCardView(root, ctx, menu),
      el('h4', { class: 'section-title' }, '🛩️ Vuelo en ruta — misiones'),
      misionesCard(root, ctx, menu, {
        // Misión 1 cuesta → la clase de los capítulos 1–3 (spec carta-paso-a-paso)
        onRepaso: () => {
          const cur = currentChapter(ctx);
          claseView(root, ctx, cur && cur.n <= 3 ? cur.id : 'c1', menu);
        },
      }),
      el('h4', { class: 'section-title' }, 'Juegos'),
      ...TOOLS.map(t => el('button', { class: 'option', onclick: () => tool(t) },
        el('span', { class: 'plan-week-title' }, `${t.icon} ${t.title}`),
        el('span', { class: 'plan-week-sub' }, t.sub))),
      el('h4', { class: 'section-title' }, 'Recetas de matemática'),
      ...RECIPES.map(r => {
        const reps = ctx.state.mathReps?.[r.family]?.lifetime || 0;
        return el('button', { class: 'option', onclick: () => recipe(r) },
          el('span', { class: 'plan-week-title' }, `${r.icon} ${fam(r.family)?.name || r.family}`),
          el('span', { class: 'plan-week-sub' }, `${r.sub}${reps ? ` · llevas ${reps}` : ''}`));
      }),
      el('h4', { class: 'section-title' }, 'En el simulador'),
      el('button', { class: 'option', onclick: () => hangarView(root, ctx, menu) },
        el('span', { class: 'plan-week-title' }, '🛩️ Misiones: circuito con manga y rodaje con diagrama'),
        el('span', { class: 'plan-week-sub' }, 'Están en el hangar, junto a los demás vuelos')),
      el('button', { class: 'ghost', onclick: onExit }, 'Volver')));
    window.scrollTo(0, 0);
  }

  function tool(t) {
    ctx.nav?.('taller', { type: t.id });
    const box = el('div', { class: 'widget-box' });
    try {
      WIDGETS[t.id](box, {});
    } catch {
      box.replaceChildren(el('p', { class: 'note' }, 'Este juego no cargó. Prueba recargando la app.'));
    }
    root.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'lesson-kicker' }, '🧪 Taller'),
      el('h3', {}, `${t.icon} ${t.title}`),
      el('p', { class: 'note' }, t.how),
      box,
      el('h4', { class: 'section-title' }, 'Repasar la lección'),
      ...t.lessons.map(([ch, sec, label]) => el('button', {
        class: 'ghost', onclick: () => lessonReview(root, ch, ctx, () => tool(t), sec),
      }, `📖 ${sec} · ${label}`)),
      el('button', { class: 'ghost', onclick: menu }, '← Volver al taller')));
    window.scrollTo(0, 0);
  }

  function recipe(r, last = null) {
    ctx.nav?.('taller', { type: `receta-${r.family}` });
    const f = fam(r.family);
    root.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'lesson-kicker' }, '🧪 Taller · receta'),
      el('h3', {}, `${r.icon} ${f.name}`),
      el('p', { class: 'formula' }, f.formula),
      last ? el('p', { class: 'reason' }, last) : '',
      ...r.levels.map((label, i) => {
        const tier = i + 1;
        return el('div', { class: 'recipe-level' },
          el('p', { class: 'plan-week-title' }, `Nivel ${tier}: ${label}`),
          el('div', { class: 'widget-btnrow' },
            el('button', { class: 'widget-btn', onclick: () => guided(r, tier) }, '🧭 Ejemplo guiado'),
            el('button', { class: 'widget-btn', onclick: () => practice(r, tier) }, '✏️ Practicar 4')));
      }),
      el('p', { class: 'note' }, 'Hazlo a mano, sin calculadora, como en el examen. Si un paso no sale, «Ver los pasos» te lo muestra con esos mismos números.'),
      el('button', { class: 'ghost', onclick: menu }, '← Volver al taller')));
    window.scrollTo(0, 0);
  }

  async function guided(r, tier) {
    const prob = generateProblem(ctx.data.templates, r.family, tier);
    const g = await guidedExample(root, prob, ctx, { title: `Receta nivel ${tier}` });
    ctx.append({ kind: 'drill', family: r.family, tier, score: g.stepsCorrect, total: g.stepsTotal, detail: { mode: 'guiada', taller: true } });
    recipe(r, `Ejemplo guiado: ${g.stepsCorrect} de ${g.stepsTotal} pasos bien. Ahora prueba «Practicar 4» con el mismo nivel.`);
  }

  async function practice(r, tier) {
    const res = await practicaBurst(root, { family: r.family, tier }, ctx);
    recipe(r, `Nivel ${tier}: ${res.score} de ${res.total} ${res.score === res.total ? '— ¡perfecto! 💪' : '— la receta no cambia, solo los números.'}`);
  }

  menu();
}
