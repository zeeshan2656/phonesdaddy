/**
 * PhonesDaddy - Service Worker
 * Version: 1.0.0
 * 
 * Provides:
 * - Offline navigation fallback (/offline.html)
 * - Stale-while-revalidate for CSS, JS, and Fonts
 * - Cache-first for images with LRU trimming
 * - Network-first with cache fallback for pages
 * - Complete exclusion of admin routes & mutations
 */

const VERSION = 'v1.0.2';
const STATIC_CACHE = `pd-static-${VERSION}`;
const RUNTIME_CACHE = `pd-runtime-${VERSION}`;
const IMAGE_CACHE = `pd-images-${VERSION}`;

const MAX_IMAGE_CACHE_ENTRIES = 120;

// Core static assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/images/logo.svg',
  '/images/placeholder.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-maskable-192x192.png',
  '/icon-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-32x32.png'
];

// Helper: Trim cache to max entries
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch (err) {
    // Ignore cache trim errors
  }
}

// 1. Install Event: Pre-cache core shell & immediately activate
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        // Cache assets individually so one failure does not break the entire install
        for (const url of PRECACHE_URLS) {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (e) {
            console.warn(`[SW] Precache item missed: ${url}`, e);
          }
        }
      })
  );
});

// 2. Activate Event: Clean up outdated caches & claim clients immediately
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('pd-') && !currentCaches.includes(cacheName)) {
              console.log(`[SW] Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strictly skip non-GET requests (POST, PUT, DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // Strictly skip ALL Admin panel routes, Admin assets (/css/admin.css, /js/admin.js), and Auth APIs
  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api/admin') ||
    url.pathname.startsWith('/api/auth') ||
    url.pathname.includes('admin')
  ) {
    return;
  }

  // Strictly skip browser extensions and foreign schemes
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // A. Navigation / HTML Requests (User visits a page)
  const isHtml = request.mode === 'navigate' || 
                 (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isHtml) {
    event.respondWith(
      (async () => {
        try {
          // Network first with timeout fallback
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const networkResponse = await fetch(request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Network failed or timed out: check runtime cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If home requested, try pre-cached root
          if (url.pathname === '/') {
            const rootCache = await caches.match('/');
            if (rootCache) return rootCache;
          }

          // Return custom offline fallback page
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) {
            return offlinePage;
          }

          return new Response('You are currently offline. Please check your network connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }
      })()
    );
    return;
  }

  // B. Images (Uploads, Webfiles, Product photos, SVGs)
  const isImage = request.destination === 'image' || 
                  /\.(png|jpe?g|webp|svg|gif|avif|ico)(\?.*)?$/i.test(url.pathname) ||
                  url.pathname.startsWith('/uploads') ||
                  url.pathname.startsWith('/webfiles');

  if (isImage) {
    event.respondWith(
      (async () => {
        // Cache-first for images
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            const cache = await caches.open(IMAGE_CACHE);
            cache.put(request, res.clone());
            trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_ENTRIES);
          }
          return res;
        } catch (err) {
          // Fallback to placeholder image when offline
          const placeholder = await caches.match('/images/placeholder.svg');
          if (placeholder) return placeholder;
          return new Response('', { status: 404 });
        }
      })()
    );
    return;
  }

  // C. Static Assets (CSS, JS, Fonts)
  const isStatic = request.destination === 'style' ||
                   request.destination === 'script' ||
                   request.destination === 'font' ||
                   /\.(css|js|woff2?|ttf|otf)(\?.*)?$/i.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      (async () => {
        try {
          const cached = await caches.match(request);
          const networkPromise = fetch(request).then(async (networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const cache = await caches.open(STATIC_CACHE);
              await cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => null);

          // Stale-While-Revalidate: serve cached version immediately if available
          if (cached) {
            return cached;
          }

          const networkResponse = await networkPromise;
          if (networkResponse) {
            return networkResponse;
          }

          // Return safe 404 response rather than null/undefined
          return new Response('/* Resource unavailable offline */', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
          });
        } catch (err) {
          return new Response('/* Resource fetch failed */', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' }
          });
        }
      })()
    );
    return;
  }

  // D. Read-only Public APIs (e.g. /api/phones/search, /api/brands, /api/settings/public)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, res.clone());
          }
          return res;
        } catch (err) {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ success: false, offline: true, message: 'Offline mode active' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })()
    );
    return;
  }

  // Default: Network with safe cache fallback (never return undefined)
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request);
      return cached || new Response('Not found', { status: 404 });
    })
  );
});

// 4. Message Event (Client-driven updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
