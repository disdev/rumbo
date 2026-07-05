// Service worker (SPEC §8, contrato offline): precachea shell + data + TODAS
// las figuras al instalar; versión de caché atada a content_version; arranque
// en frío sin red debe funcionar completo. /api/* jamás se cachea.

const CORE = [
  './', 'index.html', 'manifest.webmanifest',
  'src/css/app.css',
  'src/js/main.js', 'src/js/store.js', 'src/js/derive.js', 'src/js/planner.js',
  'src/js/mathgen.js', 'src/js/players.js', 'src/js/session.js', 'src/js/sync.js', 'src/js/audio.js',
  'src/js/lessons.js', 'src/js/widgets.js', 'src/js/guided.js', 'src/js/badges.js', 'src/js/plan-view.js', 'src/js/hangar.js',
  'data/hangar.json',
  'data/config.json', 'data/chapters.json', 'data/bank.json', 'data/math-templates.json', 'data/scenarios.json',
  'data/lessons/index.json',
  'icons/icon-192.png', 'icons/icon-512.png',
];

async function cacheName() {
  const res = await fetch('data/config.json', { cache: 'no-cache' });
  const cfg = await res.json();
  return `rumbo-${cfg.content_version}`;
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const name = await cacheName();
    const cache = await caches.open(name);
    await cache.addAll(CORE);
    // Figuras: obligatorias offline (§3.1) — la lista sale del propio banco
    const bank = await (await cache.match('data/bank.json')).json();
    const figs = [...new Set(bank.flatMap(q => q.figures || []))]
      .map(f => `data/figures/${encodeURIComponent(f)}`);
    // Lecciones y diagramas (§3.4, §5.8): la app enseña también sin red
    const lessonIndex = await (await cache.match('data/lessons/index.json')).json();
    const lessonAssets = [
      ...lessonIndex.lessons.map(f => `data/lessons/${f}`),
      ...lessonIndex.diagrams.map(f => `data/lessons/diagrams/${encodeURIComponent(f)}`),
    ];
    // en tandas para no saturar conexiones lentas
    const assets = [...figs, ...lessonAssets];
    for (let i = 0; i < assets.length; i += 5) {
      await Promise.all(assets.slice(i, i + 5).map(u => cache.add(u).catch(() => null)));
    }
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage('precache-done'));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = await cacheName().catch(() => null);
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('rumbo-') && n !== keep).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // red siempre; sync maneja el fallo

  if (e.request.mode === 'navigate') {
    // red primero (para que Access pueda pedir login al volver online), caché de respaldo
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request);
        return fresh;
      } catch {
        const cache = await caches.match('index.html');
        return cache || Response.error();
      }
    })());
    return;
  }

  // resto: caché primero, red de respaldo (y se guarda si llega)
  e.respondWith((async () => {
    const hit = await caches.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(e.request);
      if (fresh.ok && e.request.method === 'GET') {
        const cache = await caches.open(await cacheName());
        cache.put(e.request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return Response.error();
    }
  })());
});
