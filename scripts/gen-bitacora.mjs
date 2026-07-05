// Genera la Bitácora de estudio (checklist estilo piloto) como HTML listo
// para imprimir en A4, leyendo chapters.json para no desincronizarse del
// programa. Convertir a PDF:
//   node scripts/gen-bitacora.mjs
//   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//     --headless=new --print-to-pdf=bitacora-rumbo.pdf --no-pdf-header-footer \
//     scripts/bitacora.html
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chapters = JSON.parse(readFileSync(join(root, 'data', 'chapters.json'), 'utf8'));

const chapterById = (id) => chapters.chapters.find(c => c.id === id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const CHECK = '<span class="cb"></span>';
const line = (w = 70) => `<span class="wline" style="width:${w}px"></span>`;

function chapterRows(id) {
  const ch = chapterById(id);
  const nSec = ch.sections?.length || '—';
  return `
  <table class="cklist">
    <tr class="ck-head"><td colspan="4">CAP. ${ch.id} — ${esc(ch.title).toUpperCase()} <span class="secs">(${nSec} secciones)</span></td></tr>
    <tr><td>${CHECK}</td><td>Lección completa en la app (todas las secciones + checks)</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
    <tr><td>${CHECK}</td><td><b>Cuaderno:</b> apuntes de TODAS las secciones (dibujos, tablas, recetas)</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
    <tr><td>${CHECK}</td><td>Recuerdo libre entregado (sin mirar nada)</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
    <tr><td>${CHECK}</td><td>Preguntas del capítulo ≥ 80 %</td><td>puntaje ${line(50)}</td><td>firma ${line(48)}</td></tr>
    <tr><td>${CHECK}</td><td>Explicado en voz alta (teach-back: persona o audio)</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
  </table>`;
}

function weekDaily(week) {
  const days = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const cells = days.map(d => `
    <tr>
      <td class="day">${d}</td>
      <td>${CHECK}</td><td>${CHECK}</td><td>${CHECK}</td>
      <td>${CHECK} ${CHECK} ${CHECK}</td>
      <td class="fill"></td>
    </tr>`).join('');
  return `
  <table class="daily">
    <tr class="ck-head"><td class="day"></td><td>MATE</td><td>REGLA</td><td>FRASEO</td><td>SESIONES 1·2·3</td><td>NOTAS (¿mínimo? ¿hasta qué hora?)</td></tr>
    ${cells}
  </table>`;
}

function weekSpecials(week) {
  const out = [];
  if (week.week <= 4) out.push(`<tr><td>${CHECK}</td><td>Vuelo de escritorio (miércoles) — respuesta entregada</td><td colspan="2">firma ${line(48)}</td></tr>`);
  if (week.week >= 5) out.push(`<tr><td>${CHECK}</td><td>Lectura de carta seccional (bloques de la semana)</td><td colspan="2">firma ${line(48)}</td></tr>`);
  if (week.week === 6) out.push(`<tr><td>${CHECK}</td><td><b>PRIMER SIMULACRO (sábado)</b> — registrado en la página de simulacros</td><td colspan="2">puntaje ${line(40)}</td></tr>`);
  if (week.week === 7) out.push(`<tr><td>${CHECK}</td><td><b>2 SIMULACROS (miércoles y sábado)</b> — registrados</td><td colspan="2">puntajes ${line(60)}</td></tr>`);
  if (week.week === 8) out.push(`<tr><td>${CHECK}</td><td><b>SIMULACRO FINAL (jueves)</b> — registrado + mazo de errores VACÍO antes de empezar</td><td colspan="2">puntaje ${line(40)}</td></tr>`);
  out.push(`<tr><td>${CHECK}</td><td>Hangar (opcional, no es tarea): actividad volada/planificada</td><td colspan="2">cuál ${line(90)}</td></tr>`);
  return `<table class="cklist">${out.join('')}</table>`;
}

function weekPage(week) {
  const chapterBlocks = week.chapters.length
    ? week.chapters.map(chapterRows).join('')
    : `<table class="cklist">
        <tr class="ck-head"><td colspan="4">SEMANA DE INTEGRACIÓN — SIN CAPÍTULOS NUEVOS</td></tr>
        <tr><td>${CHECK}</td><td>Mazo de errores trabajado a diario</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
        <tr><td>${CHECK}</td><td>Familias débiles de matemática repasadas</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
        <tr><td>${CHECK}</td><td>Guiones orales practicados en voz alta</td><td>fecha ${line(58)}</td><td>firma ${line(48)}</td></tr>
      </table>`;
  return `
  <section class="page">
    <div class="wk-head">
      <div class="wk-num">SEMANA ${week.week}</div>
      <div class="wk-theme">${esc(week.theme)}</div>
      <div class="wk-dates">del ${line(70)} al ${line(70)}</div>
    </div>

    <h3>① Capítulos de la semana <span class="hint">— en orden; avanzas cuando cierras el anterior</span></h3>
    ${chapterBlocks}

    <h3>② Los tres rieles diarios <span class="hint">— se marcan CADA día de estudio</span></h3>
    ${weekDaily(week)}

    <h3>③ De la semana</h3>
    ${weekSpecials(week)}

    <div class="sunday">
      <div class="sunday-title">☀️ DOMINGO — REVISIÓN CON EL MENTOR</div>
      <div class="sunday-row">Registro y rachas revisados ${CHECK} · Recuerdos auditados ${CHECK} · Matemática en vivo ${CHECK} · Teach-back ${CHECK} · 5 de fraseología ${CHECK} · Alarmas de la semana confirmadas ${CHECK}</div>
      <div class="sunday-row">Firma del piloto ${line(120)} &nbsp;&nbsp; Firma del mentor ${line(120)} &nbsp;&nbsp; fecha ${line(70)}</div>
    </div>
  </section>`;
}

const mathFamilies = [
  'Factor de carga', 'Ajustes de altímetro', 'Base de nubes',
  'Altitud de presión / densidad', 'Peso y balance', 'Tiempo–velocidad–distancia–combustible',
];
const mathPage = `
<section class="page">
  <div class="wk-head"><div class="wk-num">ESCALERA</div><div class="wk-theme">Matemática — 6 familias × 3 niveles</div>
  <div class="wk-dates">se sube con 9/10 · nunca con 8 · números frescos siempre</div></div>
  <table class="mathgrid">
    <tr class="ck-head"><td>FAMILIA</td><td>RECETA EN EL CUADERNO</td><td>NIVEL 1 (9/10)</td><td>NIVEL 2 (9/10)</td><td>NIVEL 3 (9/10)</td></tr>
    ${mathFamilies.map(f => `
    <tr>
      <td class="fam">${f}</td>
      <td>${CHECK} fecha ${line(46)}</td>
      <td>${CHECK} ${line(46)}</td>
      <td>${CHECK} ${line(46)}</td>
      <td>${CHECK} ${line(46)}</td>
    </tr>`).join('')}
  </table>
  <p class="hint">La receta se copia en el cuaderno la PRIMERA vez que ves cada familia (el ejemplo guiado te la muestra completa). Cada celda de nivel: fecha del 9/10.</p>

  <h3>Mantenimiento <span class="hint">— los niveles superados no se jubilan: vuelven a 1 · 3 · 7 · 14 días</span></h3>
  <table class="daily">
    <tr class="ck-head"><td>FECHA</td><td>FAMILIA</td><td>RESULTADO</td><td>FECHA</td><td>FAMILIA</td><td>RESULTADO</td></tr>
    ${Array.from({ length: 8 }, () => `<tr><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td></tr>`).join('')}
  </table>
</section>`;

const simPage = `
<section class="page">
  <div class="wk-head"><div class="wk-num">SIMULACROS</div><div class="wk-theme">50 preguntas · 90 minutos · sin calculadora</div>
  <div class="wk-dates">objetivo: ≥ 85 %</div></div>
  <table class="mathgrid">
    <tr class="ck-head"><td>#</td><td>FECHA</td><td>PUNTAJE</td><td>%</td><td>PEOR CATEGORÍA (va al cuaderno)</td><td>FIRMA MENTOR</td></tr>
    ${[1, 2, 3, 4].map(n => `
    <tr><td class="fam">${n}${n === 4 ? ' (FINAL)' : ''}</td><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td><td class="fill-sm"></td></tr>`).join('')}
  </table>

  <h3>Cierre del programa</h3>
  <table class="cklist">
    <tr><td>${CHECK}</td><td>Mazo de errores VACÍO antes del simulacro final</td><td colspan="2">fecha ${line(58)}</td></tr>
    <tr><td>${CHECK}</td><td>Simulacro final ≥ 85 %</td><td colspan="2">puntaje ${line(50)}</td></tr>
    <tr><td>${CHECK}</td><td>Guiones orales listos (me pueden preguntar cualquier tema en voz alta)</td><td colspan="2">firma mentor ${line(48)}</td></tr>
    <tr><td>${CHECK}</td><td>Cuaderno completo: recetas, dibujos y apuntes de los 16 capítulos</td><td colspan="2">firma mentor ${line(48)}</td></tr>
  </table>

  <div class="sunday final">
    <div class="sunday-title">🏅 LISTO PARA EL EXAMEN</div>
    <div class="sunday-row">Declaramos que este piloto estudiante completó el programa Rumbo con trabajo honesto y está listo para presentar el examen escrito DGAC.</div>
    <div class="sunday-row" style="margin-top:18px">Piloto estudiante ${line(150)} &nbsp;&nbsp; Mentor ${line(150)}</div>
    <div class="sunday-row">Fecha ${line(90)} &nbsp;&nbsp; Fecha del examen ${line(90)}</div>
  </div>
</section>`;

const cover = `
<section class="page cover">
  <div class="cover-kicker">RUMBO ✈ PROGRAMA DE 8 SEMANAS · EXAMEN ESCRITO DGAC · PILOTO PRIVADO</div>
  <h1>Bitácora de estudio</h1>
  <p class="cover-sub">Checklist del piloto estudiante — compañera del cuaderno</p>
  <table class="mathgrid cover-id">
    <tr><td class="fam">Piloto estudiante</td><td class="fill"></td></tr>
    <tr><td class="fam">Mentor</td><td class="fill"></td></tr>
    <tr><td class="fam">Inicio del programa</td><td class="fill"></td></tr>
    <tr><td class="fam">Fecha objetivo del examen</td><td class="fill"></td></tr>
  </table>
  <div class="cover-rules">
    <h3>Cómo se usa — como un piloto usa su checklist</h3>
    <p>Los pilotos no confían en la memoria: confían en la lista. Cada ítem se marca <b>cuando está hecho de verdad</b>, con fecha y tu firma (iniciales). El domingo, tu mentor revisa y firma la semana.</p>
    <p><b>Regla de honor:</b> marcar algo que no hiciste no engaña al mentor ni a la app — te engaña a ti, y el examen no se deja engañar. Un ítem sin marcar es información honesta: dice exactamente qué falta.</p>
    <p class="hint">La app lleva la cuenta digital (rachas, puntajes, repasos). Esta bitácora es tu constancia física: lo que un día vas a mirar y decir "todo esto lo hice yo".</p>
  </div>
</section>`;

const style = `
<style>
  @page { size: A4; margin: 14mm 13mm; }
  * { box-sizing: border-box; }
  body { font: 10.5px/1.45 "Iowan Old Style", Palatino, Georgia, serif; color: #3d3929; margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  h3 { font-size: 12px; margin: 12px 0 5px; letter-spacing: .02em; }
  .hint { font-weight: normal; font-style: italic; color: #82806f; font-size: 9.5px; }
  .cb { display: inline-block; width: 11px; height: 11px; border: 1.4px solid #3d3929; border-radius: 2.5px; vertical-align: -2px; }
  .wline { display: inline-block; border-bottom: 1px dotted #82806f; height: 11px; }
  table { width: 100%; border-collapse: collapse; }
  .cklist td, .daily td, .mathgrid td { border: .6px solid #c9c5b4; padding: 4.5px 6px; }
  .ck-head td { background: #f0eee6; font-family: -apple-system, "Segoe UI", sans-serif; font-size: 8.5px; font-weight: 700; letter-spacing: .06em; color: #6b5844; }
  .cklist { margin-bottom: 7px; }
  .cklist td:first-child { width: 20px; text-align: center; }
  .secs { font-weight: normal; color: #82806f; }
  .daily .day { width: 34px; font-family: -apple-system, sans-serif; font-size: 8.5px; font-weight: 700; color: #6b5844; }
  .daily td { text-align: center; }
  .daily .fill, .fill { min-width: 150px; }
  .fill-sm { height: 17px; }
  .wk-head { border-bottom: 2.5px solid #c96442; padding-bottom: 6px; margin-bottom: 10px; display: flex; align-items: baseline; gap: 12px; }
  .wk-num { font-family: -apple-system, sans-serif; font-weight: 800; font-size: 13px; color: #c96442; letter-spacing: .08em; }
  .wk-theme { font-size: 17px; font-weight: 600; flex: 1; }
  .wk-dates { color: #82806f; font-size: 10px; }
  .sunday { border: 1.4px solid #c96442; border-radius: 8px; padding: 9px 12px; margin-top: 12px; }
  .sunday-title { font-family: -apple-system, sans-serif; font-weight: 800; font-size: 10px; letter-spacing: .08em; color: #c96442; margin-bottom: 5px; }
  .sunday-row { margin: 5px 0; }
  .mathgrid .fam { font-weight: 600; }
  .cover { display: flex; flex-direction: column; justify-content: center; min-height: 250mm; }
  .cover-kicker { font-family: -apple-system, sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .14em; color: #c96442; }
  .cover h1 { font-size: 42px; margin: 8px 0 2px; }
  .cover-sub { font-size: 15px; font-style: italic; color: #82806f; margin: 0 0 22px; }
  .cover-id td { padding: 9px 10px; }
  .cover-id .fam { width: 180px; }
  .cover-rules { margin-top: 26px; background: #f0eee6; border-radius: 10px; padding: 6px 16px 10px; }
  .final { margin-top: 30px; }
</style>`;

const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Bitácora de estudio — Rumbo</title>${style}</head>
<body>${cover}${chapters.weeks.map(weekPage).join('')}${mathPage}${simPage}</body></html>`;

writeFileSync(join(root, 'scripts', 'bitacora.html'), html);
console.log(`✅ scripts/bitacora.html generado (${chapters.weeks.length} semanas + escalera + simulacros + portada).`);
