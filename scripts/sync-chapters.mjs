// Sincroniza artefactos derivados de las lecciones (SPEC §3.4):
// 1) chapters.json: sections [{id,title,key_points}] desde cada chNN.json
//    (alimentan la retroalimentación del recuerdo libre, §5.7)
// 2) data/lessons/index.json: lista de lecciones + diagramas para el precache del SW (§8)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lessonsDir = join(root, 'data', 'lessons');

const lessonFiles = readdirSync(lessonsDir).filter(f => /^ch\d{2}\.json$/.test(f)).sort();
const chaptersPath = join(root, 'data', 'chapters.json');
const chapters = JSON.parse(readFileSync(chaptersPath, 'utf8'));

for (const f of lessonFiles) {
  const lesson = JSON.parse(readFileSync(join(lessonsDir, f), 'utf8'));
  const ch = chapters.chapters.find(c => c.id === lesson.chapter);
  if (!ch) { console.error(`⚠️ lección ${f} sin capítulo ${lesson.chapter} en chapters.json`); continue; }
  ch.sections = lesson.sections.map(s => ({ id: s.id, title: s.title, key_points: s.key_points }));
}
writeFileSync(chaptersPath, JSON.stringify(chapters, null, 2) + '\n');

const diagrams = readdirSync(join(lessonsDir, 'diagrams')).filter(f => f.endsWith('.svg')).sort();
writeFileSync(join(lessonsDir, 'index.json'), JSON.stringify({ lessons: lessonFiles, diagrams }, null, 2) + '\n');

console.log(`✅ ${lessonFiles.length} lecciones → chapters.json sections; index.json con ${diagrams.length} diagramas.`);
