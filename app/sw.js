const CACHE_NAME = 'pc-training-v35';
const PRECACHE_URLS = [
  './index.html',
  './shim.js?v=26',
  './icon.svg',
  './manifest.json'
];

// Install: precache core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-First for HTML/JS, cache CDN libs & fonts for offline, network for APIs
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cache CDN libraries and Google Fonts for seamless offline access
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Other cross-origin requests (e.g. LLM APIs): always go directly to network
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin: Try network first so changes show immediately on reload
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // Fall back to cache when offline
  );
});
