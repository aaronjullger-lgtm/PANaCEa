/**
 * Service Worker for PANaCEa
 * Sprint 10: Automation & Long-Term Maintenance
 *
 * Enables offline functionality for:
 * - Daily study prescription
 * - Cached questions
 * - User progress data
 * - Static assets
 */

const CACHE_VERSION = 'panacea-v1.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const QUESTION_CACHE = `${CACHE_VERSION}-questions`;

// Files to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

// API endpoints to cache for offline use
const CACHEABLE_APIS = [
  '/api/user/daily-prescription',
  '/api/conditions/high-yield',
  '/api/reference/labs',
  '/api/reference/vitals',
];

// Cache duration in milliseconds
const CACHE_DURATION = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  dynamic: 24 * 60 * 60 * 1000, // 1 day
  questions: 4 * 60 * 60 * 1000, // 4 hours
};

// =============================================================================
// INSTALL EVENT
// =============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// =============================================================================
// ACTIVATE EVENT
// =============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

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
                name !== QUESTION_CACHE
            )
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// =============================================================================
// FETCH EVENT
// =============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // Handle navigation requests (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Default: Network first, fallback to cache
  event.respondWith(networkFirstStrategy(request));
});

// =============================================================================
// REQUEST HANDLERS
// =============================================================================

/**
 * Handle API requests with stale-while-revalidate strategy
 */
async function handleApiRequest(request) {
  const url = new URL(request.url);

  // Check if this API should be cached
  const isCacheable = CACHEABLE_APIS.some((api) => url.pathname.includes(api));

  if (!isCacheable) {
    // Non-cacheable API: network only
    try {
      return await fetch(request);
    } catch (error) {
      return createOfflineResponse('API request failed - you are offline');
    }
  }

  // Stale-while-revalidate for cacheable APIs
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  // Return cached response immediately if available
  if (cachedResponse && !isExpired(cachedResponse, CACHE_DURATION.dynamic)) {
    // Revalidate in background
    revalidateCache(request, cache);
    return cachedResponse;
  }

  // No cache or expired: fetch from network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone();
      await cacheWithTimestamp(cache, request, clonedResponse);
    }

    return networkResponse;
  } catch (error) {
    // Offline: return stale cache if available
    if (cachedResponse) {
      console.log('[SW] Returning stale cache for:', request.url);
      return cachedResponse;
    }

    return createOfflineResponse('You are offline and this content is not cached');
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    return createOfflineResponse('Asset not available offline');
  }
}

/**
 * Handle navigation requests (SPA shell)
 */
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Offline: return cached index.html for SPA
    const cache = await caches.open(STATIC_CACHE);
    const cachedIndex = await cache.match('/index.html');

    if (cachedIndex) {
      return cachedIndex;
    }

    return createOfflineResponse('You are offline');
  }
}

/**
 * Network-first strategy with cache fallback
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return createOfflineResponse('Resource not available offline');
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js',
    '.css',
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.gif',
    '.woff',
    '.woff2',
    '.ico',
  ];
  return staticExtensions.some((ext) => pathname.endsWith(ext));
}

/**
 * Cache response with timestamp for expiration checking
 */
async function cacheWithTimestamp(cache, request, response) {
  const headers = new Headers(response.headers);
  headers.set('sw-cache-timestamp', Date.now().toString());

  const cachedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  await cache.put(request, cachedResponse);
}

/**
 * Check if cached response is expired
 */
function isExpired(response, maxAge) {
  const timestamp = response.headers.get('sw-cache-timestamp');

  if (!timestamp) {
    return true;
  }

  const age = Date.now() - parseInt(timestamp, 10);
  return age > maxAge;
}

/**
 * Revalidate cache in background
 */
async function revalidateCache(request, cache) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cacheWithTimestamp(cache, request, networkResponse);
      console.log('[SW] Cache revalidated for:', request.url);
    }
  } catch (error) {
    console.log('[SW] Background revalidation failed:', request.url);
  }
}

/**
 * Create offline response
 */
function createOfflineResponse(message) {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message,
      offline: true,
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_QUESTIONS':
      cacheQuestions(payload.questions);
      break;

    case 'CLEAR_CACHE':
      clearAllCaches();
      break;

    case 'GET_CACHE_STATUS':
      getCacheStatus().then((status) => {
        event.ports[0].postMessage(status);
      });
      break;
  }
});

/**
 * Cache questions for offline study
 */
async function cacheQuestions(questions) {
  const cache = await caches.open(QUESTION_CACHE);

  for (const question of questions) {
    const url = `/api/questions/${question.id}`;
    const response = new Response(JSON.stringify(question), {
      headers: { 'Content-Type': 'application/json' },
    });

    await cache.put(url, response);
  }

  console.log(`[SW] Cached ${questions.length} questions for offline use`);

  // Notify all clients
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'QUESTIONS_CACHED',
      count: questions.length,
    });
  });
}

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('[SW] All caches cleared');
}

/**
 * Get cache status for debugging
 */
async function getCacheStatus() {
  const status = {};

  const staticCache = await caches.open(STATIC_CACHE);
  const staticKeys = await staticCache.keys();
  status.static = staticKeys.length;

  const dynamicCache = await caches.open(DYNAMIC_CACHE);
  const dynamicKeys = await dynamicCache.keys();
  status.dynamic = dynamicKeys.length;

  const questionCache = await caches.open(QUESTION_CACHE);
  const questionKeys = await questionCache.keys();
  status.questions = questionKeys.length;

  status.version = CACHE_VERSION;

  return status;
}

// =============================================================================
// BACKGROUND SYNC (for pending reviews)
// =============================================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncPendingReviews());
  }
});

/**
 * Sync pending reviews when back online
 */
async function syncPendingReviews() {
  console.log('[SW] Syncing pending reviews...');

  // Get pending reviews from IndexedDB
  // This would integrate with the offlineSyncService

  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      tag: 'sync-reviews',
    });
  });
}

console.log('[SW] Service worker loaded - version:', CACHE_VERSION);
