// Lógica pura de «La carta, paso a paso» (spec 2026-10-22 carta-paso-a-paso):
// calificar cada tarjeta, el progreso por capítulo, los trucos desbloqueados y
// el reporte del mentor — todo derivado del log, con la misma forma que las
// misiones (unidad = capítulo, ítem = tarjeta). Sin DOM.

import { gradeAnswer, unitProgress, unitReport } from './misiones-logic.js';

export const CLASE_SPEC = {
  unit: 'clase', item: 'card', items: 'cards', questions: 'teaches',
  kinds: { attempt: 'clase_attempt', item: 'clase_card', progress: 'clase_progress' },
};

export const claseProgress = (rows, chapters) => unitProgress(rows, chapters, CLASE_SPEC);
export const claseReport = (rows, chapters) => unitReport(rows, chapters, CLASE_SPEC);

/** @returns {{correct: boolean, off_by: number|null}} — arrastrar: una etiqueta a una parte. */
export function gradeCard(card, answer, chart) {
  if (card.kind === 'drag') return { correct: card.slots?.[answer.label] === answer.part, off_by: null };
  return gradeAnswer(card, answer, chart);
}

/** Trucos que ya vio: uno por tarjeta con truco terminada al menos una vez, en orden. */
export function unlockedTrucos(rows, chapters) {
  const done = new Set(rows.filter(r => r.kind === CLASE_SPEC.kinds.item).map(r => r.detail?.card));
  return chapters.flatMap(chapter => (chapter.cards || [])
    .filter(card => card.truco && done.has(card.id))
    .map(card => ({ chapter, card, truco: card.truco })));
}

export const cardWords = (card) => String(card.prompt || '').trim().split(/\s+/).filter(Boolean).length;
