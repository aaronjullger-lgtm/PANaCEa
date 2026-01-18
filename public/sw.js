/**
 * Service Worker for PANaCEa
 *
 * Provides offline capability and caching for better performance.
 * Implements cache-first strategy for static assets and network-first for API calls.
 */

const CACHE_VERSION = 'panacea-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// Assets to cache on install
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

// Cache size limits
const MAX_DYNAMIC_CACHE_SIZE = 50;
const MAX_API_CACHE_SIZE = 20;

// Paths that should bypass the Service Worker entirely
// These routes may involve authentication redirects that the browser must handle natively
const EXCLUDED_PATHS = ['/admin', '/api', '/sign-in', '/sign-up', '/sso-callback'];

/**
 * Limit cache size to prevent storage issues
 */
const limitCacheSize = (cacheName, size) => {
  caches.open(cacheName).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > size) {
        cache.delete(keys[0]).then(() => limitCacheSize(cacheName, size));
      }
    });
  });
};

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('panacea-') &&
                name !== STATIC_CACHE &&
                name !== DYNAMIC_CACHE &&
                name !== API_CACHE
            )
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle requests with appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // IMPORTANT: Skip excluded paths to let browser handle authentication redirects natively
  // This prevents "redirected response was used for a request whose redirect mode is not 'follow'" errors
  const isExcludedPath = EXCLUDED_PATHS.some((path) => url.pathname.startsWith(path));
  if (isExcludedPath) {
    return; // Let browser handle this request (including any redirects)
  }

  // Static assets - cache first, network fallback
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          console.log('[Service Worker] Serving from static cache:', request.url);
          return cached;
        }

        // Not in cache, fetch from network
        return fetch(request).then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();

          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        });
      })
    );
    return;
  }

  // HTML pages - network first, cache fallback
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const responseClone = response.clone();

          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
            limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
          });

          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cached) => {
            if (cached) {
              console.log('[Service Worker] Serving from dynamic cache:', request.url);
              return cached;
            }

            // Serve offline page
            return caches.match('/');
          });
        })
    );
    return;
  }

  // Default: network only for everything else
  event.respondWith(fetch(request));
});

/**
 * Message event - handle commands from the app
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      })
    );
  }
});

/**
 * Background sync - retry failed requests when online
 */
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);

  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Implement your sync logic here
      Promise.resolve()
    );
  }
});

console.log('[Service Worker] Loaded successfully');
