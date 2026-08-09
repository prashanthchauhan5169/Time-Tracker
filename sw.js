// Service Worker for Track Your Time
// FIX: the previous version registered a fetch handler that intercepted every
// request but never cached anything. That meant: (a) the app had zero real
// offline support despite being an installable PWA, and (b) any failed
// request while offline — including the request for index.html itself — was
// replaced by a bare, unstyled "Offline" text response instead of the app's
// own cached UI. That's worse than not having a service worker at all.
// This version pre-caches the app shell on install and serves it from cache
// when the network is unavailable, so an installed/offline user still gets
// a working app instead of a broken page.

const CACHE_VERSION = 'tyt-v1';
const CORE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Third-party libraries the app depends on. Cached opportunistically so the
// app can still render (styled, with charts) when offline after first visit.
const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            // Cache each asset individually (not cache.addAll) so a single
            // failure (e.g. offline install, or a CDN hiccup) doesn't abort
            // caching of everything else.
            const allAssets = CORE_ASSETS.concat(CDN_ASSETS);
            return Promise.allSettled(
                allAssets.map((url) =>
                    fetch(url, { cache: 'no-cache' }).then((res) => {
                        if (res && res.ok) return cache.put(url, res);
                    }).catch(() => {})
                )
            );
        })
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
    const request = event.request;

    // Only handle simple GET requests; let everything else (POST, etc.) pass
    // straight through untouched.
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    const isKnownCDN = CDN_ASSETS.some((cdnUrl) => request.url.startsWith(cdnUrl));

    if (!isSameOrigin && !isKnownCDN) {
        // Unrelated cross-origin request (e.g. a future analytics/API call) -
        // don't intercept it at all.
        return;
    }

    if (request.mode === 'navigate' || (isSameOrigin && (url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json')))) {
        // App shell files: network-first so users get the latest version when
        // online, falling back to the cached copy when offline.
        event.respondWith(
            fetch(request).then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                }
                return res;
            }).catch(() =>
                caches.match(request).then((cached) => cached || caches.match('./index.html'))
            )
        );
        return;
    }

    // Everything else (icons, CDN libraries): cache-first for speed, with a
    // network fallback that refreshes the cache for next time.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
                }
                return res;
            });
        })
    );
});
