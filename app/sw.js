const CACHE_NAME = 'pc-training-v5';
const PRECACHE_URLS = [
  './index.html',
  './shim.js?v=2'
];

// Install: precache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first for same-origin, network-only for cross-origin
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cross-origin requests (CDN libs, APIs): always go to network
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin: cache-first, falling back to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        // Cache valid responses for future use
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
