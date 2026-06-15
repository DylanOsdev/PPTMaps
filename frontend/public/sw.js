const CACHE = 'pptmaps-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // No interceptar POST ni ningún método que no sea GET
  if (request.method !== 'GET') return;

  // Navegación (HTML): network-first, cae al app-shell cacheado si no hay red.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 })),
      ),
    );
    return;
  }

  // Estáticos del mismo origen: cache-first con relleno en segundo plano.
  const url = new URL(request.url);
  // Nunca cachear rutas dinámicas: API, WebSocket, health, docs.
  if (/^\/(api|ws|health|docs|redoc)\b/.test(url.pathname)) return;
  // No interceptar media (video/audio): deben servirse directo para streaming/seek.
  if (/\.(mp4|webm|ogg|mov|m4v|mp3|wav)$/i.test(url.pathname)) return;
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return resp;
        }).catch(() => cached || new Response('', { status: 503 })),
      ),
    );
  }
});
