const CACHE_NAME = 'yt2obsidian-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first: PWA install 要件を満たすための最小実装
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
