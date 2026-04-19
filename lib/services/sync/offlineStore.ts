/**
 * IndexedDB Offline Store
 *
 * Replaces localStorage for offline queue storage. IndexedDB provides:
 * - Asynchronous I/O (no main-thread blocking)
 * - Much larger storage limits (~50MB+ vs 5-10MB)
 * - Structured data without JSON serialization overhead
 * - Transaction safety for atomic operations
 *
 * Uses the `idb-keyval` library (already in deps) for simple key-value
 * operations, plus raw IndexedDB for the structured stores.
 *
 * Falls back to localStorage if IndexedDB is unavailable.
 *
 * @see lib/services/sync/syncManager.ts — consumer
 */

import type { OfflineAnswer, OfflinePearlAction, OfflineReview } from './syncManager';

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

const DB_NAME = 'panacea_offline';
const DB_VERSION = 1;

const STORES = {
  ANSWERS: 'answers',
  PEARL_ACTIONS: 'pearl_actions',
  REVIEWS: 'reviews',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores with 'id' as key path
      if (!db.objectStoreNames.contains(STORES.ANSWERS)) {
        const store = db.createObjectStore(STORES.ANSWERS, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PEARL_ACTIONS)) {
        const store = db.createObjectStore(STORES.PEARL_ACTIONS, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.REVIEWS)) {
        const store = db.createObjectStore(STORES.REVIEWS, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ============================================================================
// GENERIC CRUD OPERATIONS
// ============================================================================

async function addRecord<T extends { id: string }>(
  storeName: StoreName,
  record: T
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function getUnsynced<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index('synced');
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function markSynced(
  storeName: StoreName,
  id: string
): Promise<void> {
  const db = await getDB();
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

async function updateSyncError(
  storeName: StoreName,
  id: string,
  error: string
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.syncAttempts = (record.syncAttempts || 0) + 1;
        record.lastSyncError = error;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function removeSynced(storeName: StoreName): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index('synced');
    const request = index.openCursor(IDBKeyRange.only(true));
    let deletedCount = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(tx.error);
  });
}

async function clearStore(storeName: StoreName): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// FEATURE DETECTION
// ============================================================================

let _isAvailable: boolean | null = null;

export async function isIndexedDBAvailable(): Promise<boolean> {
  if (_isAvailable !== null) return _isAvailable;

  try {
    await getDB();
    _isAvailable = true;
  } catch (err) {
    console.debug('[offlineStore] IndexedDB unavailable', err);
    _isAvailable = false;
  }
  return _isAvailable;
}

// ============================================================================
// PUBLIC API — Typed wrappers per store
// ============================================================================

export const offlineStore = {
  answers: {
    add: (record: OfflineAnswer) => addRecord(STORES.ANSWERS, record),
    getAll: () => getAll<OfflineAnswer>(STORES.ANSWERS),
    getUnsynced: () => getUnsynced<OfflineAnswer>(STORES.ANSWERS),
    markSynced: (id: string) => markSynced(STORES.ANSWERS, id),
    updateSyncError: (id: string, error: string) => updateSyncError(STORES.ANSWERS, id, error),
    removeSynced: () => removeSynced(STORES.ANSWERS),
    clear: () => clearStore(STORES.ANSWERS),
  },

  pearlActions: {
    add: (record: OfflinePearlAction) => addRecord(STORES.PEARL_ACTIONS, record),
    getAll: () => getAll<OfflinePearlAction>(STORES.PEARL_ACTIONS),
    getUnsynced: () => getUnsynced<OfflinePearlAction>(STORES.PEARL_ACTIONS),
    markSynced: (id: string) => markSynced(STORES.PEARL_ACTIONS, id),
    updateSyncError: (id: string, error: string) => updateSyncError(STORES.PEARL_ACTIONS, id, error),
    removeSynced: () => removeSynced(STORES.PEARL_ACTIONS),
    clear: () => clearStore(STORES.PEARL_ACTIONS),
  },

  reviews: {
    add: (record: OfflineReview) => addRecord(STORES.REVIEWS, record),
    getAll: () => getAll<OfflineReview>(STORES.REVIEWS),
    getUnsynced: () => getUnsynced<OfflineReview>(STORES.REVIEWS),
    markSynced: (id: string) => markSynced(STORES.REVIEWS, id),
    updateSyncError: (id: string, error: string) => updateSyncError(STORES.REVIEWS, id, error),
    removeSynced: () => removeSynced(STORES.REVIEWS),
    clear: () => clearStore(STORES.REVIEWS),
  },

  /** Clean up all synced records across all stores */
  async cleanupSynced(): Promise<number> {
    const a = await removeSynced(STORES.ANSWERS);
    const p = await removeSynced(STORES.PEARL_ACTIONS);
    const r = await removeSynced(STORES.REVIEWS);
    return a + p + r;
  },

  /** Get total count of unsynced records across all stores */
  async getPendingCount(): Promise<number> {
    const [answers, pearls, reviews] = await Promise.all([
      getUnsynced(STORES.ANSWERS),
      getUnsynced(STORES.PEARL_ACTIONS),
      getUnsynced(STORES.REVIEWS),
    ]);
    return answers.length + pearls.length + reviews.length;
  },
};

export default offlineStore;
