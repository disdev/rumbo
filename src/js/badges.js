// Logros (SPEC §5.9): derivados puros del estado — sin almacenamiento nuevo.
// "Nuevo logro" = diferencia entre el set derivado antes y después de un append.
// Nunca puertas, nunca se pierden, la ausencia es silenciosa.

function totalReps(state) {
  return Object.values(state.mathReps || {}).reduce((a, r) => a + r.lifetime, 0);
}
function consecutiveCompletos(state) {
  let best = 0, run = 0;
  for (const v of state.dayLog.values()) {
    run = v === 'completo' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export const BADGES = [
  { id: 'primera-leccion', emoji: '📖', title: 'Primera lección', desc: 'Completaste tu primera lección', earned: s => [...s.lessons.values()].some(l => l.completed) },
  { id: 'primer-nivel', emoji: '🪜', title: 'Primer escalón', desc: 'Superaste tu primer nivel de matemática', earned: s => Object.values(s.ladder).some(l => l.passedTier >= 1) },
  { id: 'cuaderno-25', emoji: '📓', title: 'Cuaderno en marcha', desc: '25 apuntes en tu cuaderno', earned: s => s.notebooksTotal >= 25 },
  { id: 'racha-7', emoji: '🔥', title: 'Semana de fuego', desc: '7 días seguidos estudiando', earned: s => s.streaks.overall >= 7 },
  { id: 'capitulo-cerrado', emoji: '📕', title: 'Capítulo cerrado', desc: 'Primer capítulo con todo: lección, recuerdo y ≥80%', earned: s => [...s.chapterState.values()].some(c => c.closedDay) },
  { id: 'reps-100', emoji: '💪', title: '100 problemas', desc: '100 problemas de matemática resueltos', earned: s => totalReps(s) >= 100 },
  { id: 'fraseo-15', emoji: '🎧', title: 'Racha ×15', desc: '15 seguidas en fraseología', earned: s => s.rapidfireBest >= 15 },
  { id: 'semana-perfecta', emoji: '🌟', title: 'Semana perfecta', desc: '6 días completos seguidos', earned: s => consecutiveCompletos(s) >= 6 },
  { id: 'familia-dominada', emoji: '👑', title: 'Familia dominada', desc: 'Nivel 3 en una familia de matemática', earned: s => Object.values(s.ladder).some(l => l.passedTier >= 3) },
  { id: 'cuatro-n2', emoji: '🗝️', title: 'Llave de la semana 6', desc: '4 familias en nivel 2', earned: s => s.familiesAtN2 >= 4 },
  { id: 'reps-500', emoji: '🏋️', title: '500 problemas', desc: '500 problemas resueltos — músculo de verdad', earned: s => totalReps(s) >= 500 },
  { id: 'cuaderno-100', emoji: '📚', title: 'Cuaderno de piloto', desc: '100 apuntes — tu propio libro de estudio', earned: s => s.notebooksTotal >= 100 },
  { id: 'primer-simulacro', emoji: '🎓', title: 'Primer simulacro', desc: 'Enfrentaste el examen completo', earned: s => s.simulacros.length >= 1 },
  { id: 'simulacro-85', emoji: '🏅', title: 'Nivel de examen', desc: '≥85% en un simulacro', earned: s => s.simulacros.some(x => x.pct >= 85) },
  { id: 'mazo-vacio', emoji: '🧹', title: 'Mazo vacío', desc: 'Vaciaste el mazo de errores', earned: s => s.everInDeck && s.errorDeck.length === 0 },
  { id: 'reps-1000', emoji: '🚀', title: '1000 problemas', desc: 'Mil problemas. Ya nadie te cuenta cuentos.', earned: s => totalReps(s) >= 1000 },
];

export function earnedBadges(state) {
  return BADGES.filter(b => { try { return b.earned(state); } catch { return false; } });
}
