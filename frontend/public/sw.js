const CACHE_NAME = 'obra-inventario-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/login',
  '/tickets',
  '/tickets/scan',
  '/favicon.ico'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching initial shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event (Cache-first for assets, Network-first for pages, falling back to cache if offline)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // We only cache GET requests
  if (request.method !== 'GET') return;
  
  // Ignore API requests
  if (request.url.includes('/api/')) return;
  
  // Ignore chrome extensions or external URLs
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch new version in background to update cache (stale-while-revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        // Cache next assets dynamically (js, css, images)
        if (
          networkResponse.status === 200 &&
          (request.url.includes('_next/static') || 
           request.url.match(/\.(js|css|png|jpg|jpeg|svg|woff2|ico)$/))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Offline fallback for pages
        if (request.mode === 'navigate') {
          return caches.match('/tickets/scan') || caches.match('/login') || caches.match('/');
        }
        throw err;
      });
    })
  );
});
