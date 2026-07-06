// Registro de eventos, append-only (SPEC §8: estado event-sourced).
// localStorage es solo un caché replayable del mismo log; D1 es la verdad durable.
// Toda regla de programación se deriva del log en derive.js — nunca se guarda aparte.

const LOG_KEY = 'rumbo_log_v1';
const QUEUE_KEY = 'rumbo_queue_v1';

let log = [];
let queue = []; // ids pendientes de sincronizar
let listeners = [];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

export function initStore() {
  log = load(LOG_KEY, []);
  queue = load(QUEUE_KEY, []);
  return log;
}

function persist() {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('persist falló', e); // cuota llena: el log sigue en memoria; sync lo salvará
  }
}

export function uuid() {
  return crypto.randomUUID();
}

/**
 * Añade un evento al log. Inmutable una vez escrito.
 * @param {object} ev {kind, family?, tier?, chapter?, category?, score?, total?, duration_sec?, detail?}
 * @returns el evento completo (con id/ts)
 */
export function append(ev, contentVersion) {
  const row = {
    id: ev.id || uuid(), // id propio cuando otra fila (feedback) debe referenciarlo
    ts: Date.now(),
    ...ev,
    detail: { ...(ev.detail || {}), content_version: contentVersion },
  };
  log.push(row);
  queue.push(row.id);
  persist();
  listeners.forEach(fn => fn(row));
  return row;
}

export function getLog() { return log; }

export function onAppend(fn) { listeners.push(fn); }

/** Filas aún no confirmadas por el servidor, en orden. */
export function pendingRows() {
  const ids = new Set(queue);
  return log.filter(r => ids.has(r.id));
}

/** El servidor confirmó estas filas: salen de la cola. */
export function markSynced(ids) {
  const done = new Set(ids);
  queue = queue.filter(id => !done.has(id));
  persist();
}

export function queueSize() { return queue.length; }

const REJECTED_KEY = 'rumbo_rejected_v1';

/**
 * El servidor rechazó estas filas (spec 2026-07-06): salen de la cola para no
 * frenar la sincronización de las demás, y quedan guardadas para diagnóstico.
 * @param {{id: string|null, error: string}[]} entries
 */
export function parkRejected(entries) {
  const parked = load(REJECTED_KEY, []);
  const known = new Set(parked.map(p => p.id));
  const ids = new Set();
  for (const e of entries) {
    if (!e?.id) continue;
    ids.add(e.id);
    if (!known.has(e.id)) { parked.push({ id: e.id, error: e.error, ts: Date.now() }); known.add(e.id); }
  }
  if (!ids.size) return;
  queue = queue.filter(id => !ids.has(id));
  persist();
  try { localStorage.setItem(REJECTED_KEY, JSON.stringify(parked)); } catch { /* diagnóstico, no crítico */ }
}

/** Filas rechazadas acumuladas (diagnóstico para el banner y el mentor). */
export function rejectedRows() {
  return load(REJECTED_KEY, []);
}

/**
 * Restaurar progreso (SPEC §8): reemplaza el log local con las filas del
 * servidor (unión por id — nunca pierde filas locales no sincronizadas).
 */
export function restoreFrom(serverRows) {
  const byId = new Map();
  for (const r of serverRows) {
    byId.set(r.id, {
      ...r,
      detail: typeof r.detail_json === 'string' ? safeParse(r.detail_json) : (r.detail || {}),
    });
  }
  for (const r of log) if (!byId.has(r.id)) byId.set(r.id, r); // locales sin sincronizar
  log = [...byId.values()].sort((a, b) => a.ts - b.ts);
  queue = log.filter(r => !serverRows.some(s => s.id === r.id)).map(r => r.id);
  persist();
  return log;
}

function safeParse(s) {
  try { return JSON.parse(s) ?? {}; } catch { return {}; }
}

/** Serializa una fila local al formato del API (detail → detail_json string). */
export function toApiRow(row) {
  const { detail, ...rest } = row;
  return { ...rest, detail_json: JSON.stringify(detail || {}) };
}
