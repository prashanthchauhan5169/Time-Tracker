// A basic Service Worker to satisfy Android PWA installation requirements
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] Activated');
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Allows the app to pass the Android offline check
    e.respondWith(fetch(e.request).catch(() => new Response('Offline')));
});