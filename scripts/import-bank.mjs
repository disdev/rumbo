// Imports the source question bank into data/bank.json.
// Re-run whenever the source is corrected; bump content_version in data/config.json after.
// Usage: node scripts/import-bank.mjs [path-to-cards.json]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const src = process.argv[2] ?? `${process.env.HOME}/Workspace/flashcards/cards.json`;
const cards = JSON.parse(readFileSync(src, 'utf8'));

// Figures may have been recompressed to .jpg; remap references to whichever file exists.
const figFiles = new Set(readdirSync(new URL('../data/figures', import.meta.url)));
function mapFig(name) {
  if (figFiles.has(name)) return name;
  const jpg = name.replace(/\.png$/i, '.jpg');
  if (figFiles.has(jpg)) return jpg;
  throw new Error(`figure not found: ${name}`);
}

const seen = new Set();
let extracted = 0, synthetic = 0;

const bank = cards.map((q, i) => {
  const m = q.question.match(/^\s*(\d{2,5})\s*\.\-?\s*/);
  let id;
  if (m && !seen.has(`q${m[1]}`)) {
    id = `q${m[1]}`;
    extracted++;
  } else {
    id = `x${i}`; // no prefix, or duplicate prefix: positional id (stable as long as import order is stable)
    synthetic++;
  }
  seen.add(id);
  return {
    id,
    category: q.category,
    question: m ? q.question.slice(m[0].length).trim() : q.question.trim(),
    options: q.options,
    answer: q.answer,
    ...(q.reason ? { reason: q.reason } : {}),
    ...(q.figures?.length ? { figures: q.figures.map(mapFig) } : {}),
  };
});

if (bank.length !== 901) throw new Error(`expected 901 questions, got ${bank.length}`);
for (const q of bank) {
  if (q.options.length !== 3) throw new Error(`${q.id}: ${q.options.length} options`);
  if (q.answer < 0 || q.answer > 2) throw new Error(`${q.id}: bad answer index`);
}

writeFileSync(new URL('../data/bank.json', import.meta.url), JSON.stringify(bank, null, 1));
console.log(`bank.json written: ${bank.length} questions (${extracted} ids extracted, ${synthetic} positional)`);
