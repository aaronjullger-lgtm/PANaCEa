/**
 * TanStack Query client with IndexedDB persistence for PWA offline support.
 * Due queue and other SRS data are persisted so they are available when offline.
 */

import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del, createStore } from 'idb-keyval';

const IDB_DB_NAME = 'panacea-query-cache';
const IDB_STORE_NAME = 'query-cache';

const idbStore = createStore(IDB_DB_NAME, IDB_STORE_NAME);

const idbStorage = {
  getItem: async (key: string): Promise<string | undefined | null> => {
    const value = await get(key, idbStore);
    return value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await set(key, value, idbStore);
  },
  removeItem: async (key: string): Promise<void> => {
    await del(key, idbStore);
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - due queue can be slightly stale when offline
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000,
});
