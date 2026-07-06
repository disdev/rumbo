// Validación compartida de filas de resultados (spec 2026-07-06).
// Prefijo "_" = Pages no lo enruta; lo importan result.ts y los tests de node.
// Regla dura: una fila inválida se reporta y se descarta POR FILA — jamás
// tumba el lote (el bug que dejó la sincronización muerta desde la primera
// lección: kinds nuevos no listados aquí rechazaban la cola completa).

export const KINDS = new Set([
  "drill",
  "quiz",
  "redo",
  "simulacro",
  "recall",
  "scenario",
  "block",
  "rapidfire",
  "distractor_explain",
  "feedback",
  "lesson_progress",
  "lesson_check",
  "notebook",
  "nav",
]);

/** @returns {string|null} mensaje de error, o null si la fila es válida */
export function validateRow(row) {
  if (typeof row !== "object" || row === null) return "result must be an object";
  if (typeof row.id !== "string" || row.id.length === 0 || row.id.length > 64) {
    return "id must be a string of at most 64 chars";
  }
  if (typeof row.ts !== "number" || !isFinite(row.ts)) return "ts must be a number";
  if (typeof row.kind !== "string" || !KINDS.has(row.kind)) {
    return "kind must be one of: " + Array.from(KINDS).join(", ");
  }
  return null;
}

/** Separa filas válidas de rechazadas. @returns {{valid: object[], rejected: {id: string|null, error: string}[]}} */
export function partitionRows(rows) {
  const valid = [];
  const rejected = [];
  for (const row of rows) {
    const error = validateRow(row);
    if (error) {
      const id = typeof row?.id === "string" && row.id.length > 0 && row.id.length <= 64 ? row.id : null;
      rejected.push({ id, error });
    } else {
      valid.push(row);
    }
  }
  return { valid, rejected };
}
