import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearPendingOperations,
  queueSyncOperation,
  syncPendingOperations,
} from '@/lib/services/offlineSyncService';
import { StorageKeys } from '@/lib/storage/storageRegistry';

vi.mock('@/lib/logger', () => ({
  syncLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
}

describe('offlineSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.localStorage = createMockStorage();
    global.fetch = vi.fn();
    Object.defineProperty(global.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    clearPendingOperations();
  });

  it('unwraps conflict response envelopes before applying newest-wins resolution', async () => {
    const clientTime = Date.now();
    vi.setSystemTime(clientTime);
    queueSyncOperation('performance', 'update', {
      questionId: 'q-1',
      updatedAt: new Date(clientTime).toISOString(),
    });
    vi.useRealTimers();

    const serverUpdatedAt = new Date(clientTime + 60_000).toISOString();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            updatedAt: serverUpdatedAt,
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await syncPendingOperations('token', { strategy: 'newest-wins' });

    expect(result).toMatchObject({ success: true, synced: 0, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const pending = JSON.parse(localStorage.getItem(StorageKeys.PENDING_SYNC_OPS) ?? '[]');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      type: 'performance',
      retries: 1,
    });
  });
});
