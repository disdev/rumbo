// Valida data/lessons/*.json contra el esquema de docs/lesson-authoring.md.
// Uso: node scripts/validate-lessons.mjs [chNN.json ...]  (sin args: todos)
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = join(root, 'data', 'lessons');
const diagramsDir = join(lessonsDir, 'diagrams');

const WIDGETS = ['angulo-ataque', 'cuatro-fuerzas', 'superficies-control', 'flaps', 'instrumento'];
const FAMILIES = ['carga', 'altimetro', 'nubes', 'altitudes', 'peso_balance', 'tvd'];
const CALLOUTS = ['clave', 'ojo', 'memoria', 'examen'];
const BLOCK_TYPES = ['text', 'diagram', 'callout', 'table', 'widget', 'check', 'notebook', 'guided_math', 'figure'];

const words = (md) => md.trim().split(/\s+/).length;
const errors = [];
const warns = [];
const err = (f, m) => errors.push(`${f}: ${m}`);
const warn = (f, m) => warns.push(`${f}: ${m}`);

function validate(file) {
  const path = join(lessonsDir, file);
  let doc;
  try { doc = JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { return err(file, `JSON inválido: ${e.message}`); }

  if (!/^ch\d{2}\.json$/.test(file)) return err(file, 'nombre debe ser chNN.json');
  const chNum = String(Number(file.slice(2, 4)));
  if (doc.chapter !== chNum) err(file, `chapter "${doc.chapter}" ≠ ${chNum}`);
  if (!doc.title) err(file, 'falta title');
  if (!doc.resumen) err(file, 'falta resumen');
  if (!Array.isArray(doc.sections)) return err(file, 'falta sections[]');
  if (doc.sections.length < 6 || doc.sections.length > 12)
    err(file, `${doc.sections.length} secciones (regla: 6–12)`);

  const ids = new Set();
  doc.sections.forEach((s, si) => {
    const sid = `${file}#${s.id || si}`;
    if (s.id !== `${chNum}-${si + 1}`) err(sid, `id "${s.id}" debe ser "${chNum}-${si + 1}"`);
    if (ids.has(s.id)) err(sid, 'id duplicado'); ids.add(s.id);
    if (!s.title) err(sid, 'falta title');
    if (!Array.isArray(s.key_points) || s.key_points.length < 3 || s.key_points.length > 8)
      err(sid, `key_points: ${s.key_points?.length ?? 0} (regla: 3–8)`);
    if (!Array.isArray(s.blocks) || !s.blocks.length) return err(sid, 'sin blocks');

    let checks = 0, notebooks = 0, lastTeachIdx = -1, firstCheckIdx = Infinity;
    const seenBlockIds = new Set();
    s.blocks.forEach((b, bi) => {
      const bid = `${sid}[${bi}]`;
      if (!BLOCK_TYPES.includes(b.type)) return err(bid, `type desconocido: ${b.type}`);
      switch (b.type) {
        case 'text':
          if (!b.md) err(bid, 'text sin md');
          else if (words(b.md) > 90) err(bid, `text de ${words(b.md)} palabras (máx 90)`);
          lastTeachIdx = bi;
          break;
        case 'diagram':
          if (!b.caption) err(bid, 'diagram sin caption');
          if (!b.src || !existsSync(join(diagramsDir, b.src))) err(bid, `diagram no existe: ${b.src}`);
          lastTeachIdx = bi;
          break;
        case 'figure':
          if (!b.src || !existsSync(join(root, 'data', 'figures', b.src))) err(bid, `figure no existe: ${b.src}`);
          lastTeachIdx = bi;
          break;
        case 'callout':
          if (!CALLOUTS.includes(b.style)) err(bid, `callout style: ${b.style}`);
          if (!b.md) err(bid, 'callout sin md');
          lastTeachIdx = bi;
          break;
        case 'table':
          if (!Array.isArray(b.headers) || b.headers.length > 4) err(bid, 'table headers (máx 4)');
          if (!Array.isArray(b.rows) || b.rows.length > 8 || !b.rows.length) err(bid, 'table rows (1–8)');
          else if (b.rows.some(r => r.length !== b.headers.length)) err(bid, 'filas ≠ columnas');
          lastTeachIdx = bi;
          break;
        case 'widget':
          if (!WIDGETS.includes(b.name)) err(bid, `widget desconocido: ${b.name}`);
          if (!b.caption) err(bid, 'widget sin caption');
          lastTeachIdx = bi;
          break;
        case 'check': {
          checks++;
          firstCheckIdx = Math.min(firstCheckIdx, bi);
          if (seenBlockIds.has(b.id)) err(bid, 'check id duplicado'); seenBlockIds.add(b.id);
          if (!new RegExp(`^${s.id}-c\\d+$`).test(b.id || '')) err(bid, `check id "${b.id}" debe ser ${s.id}-cN`);
          if (!b.q) err(bid, 'check sin q');
          if (!Array.isArray(b.options) || b.options.length !== 3) err(bid, 'check necesita 3 options');
          if (!(b.answer >= 0 && b.answer <= 2)) err(bid, `check answer fuera de rango: ${b.answer}`);
          if (!b.why) err(bid, 'check sin why');
          break;
        }
        case 'notebook':
          notebooks++;
          if (seenBlockIds.has(b.id)) err(bid, 'notebook id duplicado'); seenBlockIds.add(b.id);
          if (!new RegExp(`^${s.id}-n\\d+$`).test(b.id || '')) err(bid, `notebook id "${b.id}" debe ser ${s.id}-nN`);
          if (!b.prompt || b.prompt.length < 20) err(bid, 'notebook prompt vago o vacío (sé concreto)');
          break;
        case 'guided_math':
          if (!FAMILIES.includes(b.family)) err(bid, `familia: ${b.family}`);
          if (!(b.tier >= 1 && b.tier <= 3)) err(bid, `tier: ${b.tier}`);
          break;
      }
    });
    if (checks < 2) err(sid, `${checks} check(s) — mínimo 2, objetivo 3–4 (dificultad de examen)`);
    if (checks === 2) warn(sid, '2 checks (objetivo: 3–4)');
    if (checks > 5) err(sid, `${checks} checks (máx 5)`);
    if (!notebooks) err(sid, 'sin notebook (mín 1)');
    if (notebooks > 3) warn(sid, `${notebooks} notebooks (máx 3)`);
    if (firstCheckIdx < lastTeachIdx) warn(sid, 'hay contenido de enseñanza después del primer check (orden: enseñar → cuaderno → checks)');
  });

  if (doc.videos !== undefined) {
    if (!Array.isArray(doc.videos) || doc.videos.length > 5) err(file, 'videos: lista de máx 5');
    else for (const v of doc.videos) {
      if (!v.title || !v.query) err(file, `video sin title/query: ${JSON.stringify(v)}`);
    }
  }
}

function validateSvg(file) {
  const svg = readFileSync(join(diagramsDir, file), 'utf8');
  if (!/viewBox=/.test(svg)) err(`diagrams/${file}`, 'sin viewBox');
  if (/<svg[^>]*\s(width|height)=/.test(svg)) err(`diagrams/${file}`, 'no usar width/height en <svg>');
  if (/<script/i.test(svg)) err(`diagrams/${file}`, 'script prohibido');
  if (/(href|src)=["']https?:/i.test(svg)) err(`diagrams/${file}`, 'referencias externas prohibidas');
  if (/#[0-9a-fA-F]{3,8}\b/.test(svg)) warn(`diagrams/${file}`, 'color fijo (usa var(--text) etc. para tema)');
  if (svg.length > 16000) warn(`diagrams/${file}`, `${svg.length} bytes (objetivo < 8 KB)`);
}

const args = process.argv.slice(2);
const files = args.length ? args.map(a => a.split('/').pop()) : (existsSync(lessonsDir) ? readdirSync(lessonsDir).filter(f => f.endsWith('.json') && f.startsWith('ch')) : []);
if (!files.length) { console.error('No hay lecciones que validar.'); process.exit(1); }
for (const f of files) validate(f);
if (!args.length && existsSync(diagramsDir)) for (const f of readdirSync(diagramsDir).filter(f => f.endsWith('.svg'))) validateSvg(f);
else if (args.length) for (const f of files) {
  try { const doc = JSON.parse(readFileSync(join(lessonsDir, f), 'utf8'));
    for (const s of doc.sections || []) for (const b of s.blocks || []) if (b.type === 'diagram' && b.src && existsSync(join(diagramsDir, b.src))) validateSvg(b.src);
  } catch {}
}

for (const w of warns) console.log(`⚠️  ${w}`);
if (errors.length) { for (const e of errors) console.error(`❌ ${e}`); process.exit(1); }
console.log(`✅ ${files.length} lección(es) válida(s), ${warns.length} aviso(s).`);
