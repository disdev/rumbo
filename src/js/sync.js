// Capa de sincronización (SPEC §8). La cola nunca se descarta; una sesión de
// Access vencida responde con redirect (no JSON) a un fetch de fondo — eso se
// detecta y se muestra el banner persistente; el re-login es una navegación
// completa (un fetch no puede completar el flujo de login).

import { pendingRows, markSynced, parkRejected, rejectedRows, toApiRow, restoreFrom, queueSize } from './store.js';

const FEEDBACK_QUEUE_KEY = 'rumbo_feedback_queue_v1';
let onStatus = () => {};
let flushing = false;

export function initSync(statusCb) {
  onStatus = statusCb;
  window.addEventListener('online', () => flush());
  setInterval(() => flush(), 90_000);
  flush();
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, { ...opts, redirect: 'manual', headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  // Access vencido: redirect (opaqueredirect) o HTML de login
  if (res.type === 'opaqueredirect' || res.status === 302 || res.status === 401) throw new SessionExpired();
  const ct = res.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) throw new SessionExpired();
  return res;
}

class SessionExpired extends Error { constructor() { super('access_session_expired'); this.expired = true; } }
class SyncRejected extends Error { constructor() { super('sync_rejected'); this.rejected = true; } }

export async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const rows = pendingRows();
    if (rows.length) {
      const res = await apiFetch('/api/result', { method: 'POST', body: JSON.stringify(rows.map(toApiRow)) });
      // Contrato por fila (spec 2026-07-06): el servidor inserta lo válido y
      // reporta lo rechazado — lo rechazado se estaciona para que UNA fila
      // mala nunca vuelva a frenar toda la cola (el bug de las lecciones).
      const data = await res.json().catch(() => null);
      const rejected = Array.isArray(data?.rejected) ? data.rejected : [];
      if (rejected.length) parkRejected(rejected);
      if (res.ok) {
        const bad = new Set(rejected.map(r => r.id));
        markSynced(rows.map(r => r.id).filter(id => !bad.has(id)));
      } else {
        // non-ok SIN detalle por fila (error interno o servidor viejo):
        // nada se marca; el banner avisa — jamás reportar 'ok' en silencio.
        throw new SyncRejected();
      }
    }
    await flushFeedback();
    const { uploadPendingAudio } = await import('./audio.js');
    await uploadPendingAudio();
    const parked = rejectedRows().length;
    onStatus({ state: parked ? 'rejected' : 'ok', pending: queueSize(), rejected: parked, lastSync: Date.now() });
  } catch (e) {
    onStatus(e.expired ? { state: 'expired', pending: queueSize() }
      : e.rejected ? { state: 'rejected', pending: queueSize(), rejected: rejectedRows().length }
      : { state: 'offline', pending: queueSize() });
  } finally {
    flushing = false;
  }
}

/** Re-login: navegación completa para que Access pueda redirigir. */
export function relogin() {
  location.href = '/?t=' + Date.now();
}

// ---- retroalimentación IA (§5.7): nunca bloquea, se encola offline ----

function fbQueue() {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_QUEUE_KEY)) ?? []; } catch { return []; }
}
function saveFbQueue(q) { localStorage.setItem(FEEDBACK_QUEUE_KEY, JSON.stringify(q)); }

/**
 * Pide retroalimentación para una entrada de texto libre. Devuelve el feedback
 * si llegó al instante, o null si quedó en cola (offline / sesión vencida).
 */
export async function requestFeedback(payload) {
  try {
    const res = await apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.ok) return data.feedback;
  } catch { /* cae a la cola */ }
  const q = fbQueue();
  if (!q.some(p => p.id === payload.id)) { q.push(payload); saveFbQueue(q); }
  return null;
}

async function flushFeedback() {
  const q = fbQueue();
  const remaining = [];
  for (const payload of q) {
    try {
      const res = await apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); if (body.error !== 'feedback_unconfigured') remaining.push(payload); }
    } catch (e) {
      remaining.push(payload);
      if (e.expired) break;
    }
  }
  saveFbQueue(remaining);
}

/** Restaurar progreso (§8): reconstruye el log local desde D1. */
export async function restoreProgress() {
  const res = await apiFetch('/api/log');
  const data = await res.json();
  return restoreFrom(data.results || []);
}
