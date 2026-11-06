const CACHE_NAME = 'pc-training-v8';
const PRECACHE_URLS = [
  './index.html',
  './shim.js?v=4',
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

// Fetch: Network-First for HTML and JS, falling back to cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cross-origin requests (CDN libs, APIs): always go to network
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin: Try network first so changes show on the very first refresh
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
