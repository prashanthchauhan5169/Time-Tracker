// Track Your Time — Service Worker
// Bump CACHE_VERSION whenever you change index.html/manifest.json/icons.
// Forgetting this is the #1 reason PWAs get stuck showing a stale, cached
// version of the app to returning users — so it's called out here deliberately.
const CACHE_VERSION = 'tyt-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache each shell file independently: a single 404 (e.g. a background
      // image that hasn't been uploaded yet) must not abort caching of the
      // rest of the app shell, which cache.addAll()'s all-or-nothing
      // behavior would otherwise cause.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] Skipped caching (not found yet):', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Cross-origin requests (Tailwind CDN, Chart.js CDN, Google Fonts, etc.):
  // best-effort network-first with a cache fallback. Note that the Tailwind
  // CDN build (cdn.tailwindcss.com) compiles CSS at runtime from a <script>,
  // so even a perfectly cached copy of it will not restyle the page the same
  // way a real offline-first setup would — see the note left in index.html.
  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // App-shell files: cache-first for instant offline loads.
      // Everything else: network-first, falling back to cache if offline.
      if (isSameOrigin && cached) {
        return cached;
      }
      return networkFetch.then((res) => res || cached);
    })
  );
});
