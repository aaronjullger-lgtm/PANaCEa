/**
 * Service Worker for PANaCEa
 *
 * Provides offline capability and caching for better performance.
 * Implements cache-first strategy for static assets and network-first for API calls.
 */

const CACHE_VERSION = 'panacea-v2';
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
 * Background Sync — retry offline submissions when connectivity returns.
 *
 * Reads unsynced records from IndexedDB (panacea_offline) and POSTs them
 * to the appropriate API endpoints. Marks records as synced on success.
 * Works even if the app tab is closed (service worker stays alive).
 *
 * Tags:
 * - 'sync-answers': Question attempt submissions
 * - 'sync-reviews': Drill review submissions (FSRS)
 * - 'sync-data': Legacy catch-all (syncs everything)
 */
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);

  if (event.tag === 'sync-answers' || event.tag === 'sync-data') {
    event.waitUntil(syncOfflineAnswers());
  }
  if (event.tag === 'sync-reviews' || event.tag === 'sync-data') {
    event.waitUntil(syncOfflineReviews());
  }
});

/**
 * Open the IndexedDB offline store from within the service worker.
 */
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('panacea_offline', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Don't create stores here — they're created by the main thread
  });
}

/**
 * Get all unsynced records from a store.
 */
function getUnsyncedRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index('synced');
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    } catch (err) {
      // Store may not exist yet
      resolve([]);
    }
  });
}

/**
 * Mark a record as synced in IndexedDB.
 */
function markRecordSynced(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.synced = true;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Sync offline answers (question attempts) to the API.
 */
async function syncOfflineAnswers() {
  try {
    const db = await openOfflineDB();
    const answers = await getUnsyncedRecords(db, 'answers');
    if (answers.length === 0) return;

    console.log(`[Service Worker] Syncing ${answers.length} offline answers`);

    for (const answer of answers) {
      try {
        const response = await fetch('/api/questions/attempt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: answer.questionId,
            selectedAnswer: answer.selectedAnswer,
            isCorrect: answer.isCorrect,
            timeSpentMs: answer.timeSpentMs,
            system: answer.system,
            conditionId: answer.conditionId,
            confidence: answer.confidence,
            rating: answer.rating,
            sessionId: answer.sessionId,
            telemetry: answer.telemetryJson,
          }),
        });

        if (response.ok || response.status === 409) {
          // 409 = duplicate, treat as success
          await markRecordSynced(db, 'answers', answer.id);
          console.log(`[Service Worker] Synced answer ${answer.id}`);
        } else {
          console.warn(`[Service Worker] Answer sync failed: HTTP ${response.status}`);
        }
      } catch (err) {
        console.warn(`[Service Worker] Answer sync error for ${answer.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Service Worker] syncOfflineAnswers failed:', err);
  }
}

/**
 * Sync offline drill reviews to the FSRS API.
 */
async function syncOfflineReviews() {
  try {
    const db = await openOfflineDB();
    const reviews = await getUnsyncedRecords(db, 'reviews');
    if (reviews.length === 0) return;

    console.log(`[Service Worker] Syncing ${reviews.length} offline reviews`);

    for (const review of reviews) {
      try {
        const response = await fetch('/api/drills/submit-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: review.questionId,
            selectedAnswer: review.selectedAnswer,
            timeSpentMs: review.timeSpentMs,
            timeToFirstClick: review.timeToFirstClick,
            answerSwitches: review.answerSwitches,
            totalDwellTime: review.totalDwellTime,
            timezone: review.timezone,
            sessionType: review.sessionType || 'drill',
            telemetry: review.telemetry,
          }),
        });

        if (response.ok || response.status === 409) {
          await markRecordSynced(db, 'reviews', review.id);
          console.log(`[Service Worker] Synced review ${review.id}`);
        } else {
          console.warn(`[Service Worker] Review sync failed: HTTP ${response.status}`);
        }
      } catch (err) {
        console.warn(`[Service Worker] Review sync error for ${review.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[Service Worker] syncOfflineReviews failed:', err);
  }
}

/**
 * Push notification handler.
 * Displays notifications from the push server.
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');

  let data = { title: 'PANaCEa', body: 'Time to review!', url: '/' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (err) {
    console.warn('[Service Worker] Failed to parse push data:', err);
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Start Reviewing' },
      { action: 'dismiss', title: 'Later' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'PANaCEa', options)
  );
});

/**
 * Notification click handler — opens the app to the review page.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new tab
      return self.clients.openWindow(targetUrl);
    })
  );
});

console.log('[Service Worker] Loaded successfully');
