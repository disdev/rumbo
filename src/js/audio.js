// Grabación de teach-back (SPEC §4.4, §8): MediaRecorder → IndexedDB,
// tope 90 s, sube por la cola de sync y se borra local solo tras confirmación.

const DB_NAME = 'rumbo_audio';
const STORE = 'recordings';
const MAX_SEC = 90;

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
  });
}

/**
 * Graba hasta maxSec segundos. Devuelve {start, stop, promise}.
 * promise resuelve con el blob al parar (o al llegar al tope).
 */
export async function startRecording(onTick) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed++;
    onTick?.(elapsed, MAX_SEC);
    if (elapsed >= MAX_SEC) stop();
  }, 1000);
  const done = new Promise((resolve) => {
    rec.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach(t => t.stop());
      resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
    };
  });
  function stop() { if (rec.state !== 'inactive') rec.stop(); }
  rec.start();
  return { stop, done };
}

/** Guarda la grabación localmente; se subirá en el próximo flush. */
export async function saveRecording(id, blob) {
  const db = await idb();
  await tx(db, 'readwrite', s => s.put({ id, blob, ts: Date.now() }));
}

export async function uploadPendingAudio() {
  if (!('indexedDB' in self)) return;
  const db = await idb();
  const all = await tx(db, 'readonly', s => s.getAll());
  for (const rec of all || []) {
    try {
      const res = await fetch(`/api/audio?id=${rec.id}`, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': rec.blob.type || 'audio/webm' },
        body: rec.blob,
      });
      if (res.ok && (res.headers.get('Content-Type') || '').includes('json')) {
        await tx(db, 'readwrite', s => s.delete(rec.id)); // borrar solo tras confirmación (§8)
      } else if (res.type === 'opaqueredirect') {
        break; // sesión vencida: el banner de sync ya lo está gritando
      }
    } catch { break; }
  }
}
