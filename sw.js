/* Bunkulator service worker — offline support + installability.
   Cache-first for the app shell so the calculator opens instantly and
   keeps working with no connection (it's a self-contained static app). */
const CACHE = 'bunkulator-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/bunku-mascot.js',
  '/bunku-mascot-wave.webp',
  '/bunku-mascot-carrot.webp',
  '/og-image.png',
  '/icon-192.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Cache what we can; a single missing asset must not fail the install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let fonts/analytics hit the network.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, fall back to cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Static assets: cache-first, populate cache on first network hit.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
