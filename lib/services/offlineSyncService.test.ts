/**
 * Unit tests for lib/services/offlineSyncService.ts
 *
 * Tests the offline-first sync service: queueing, batching, conflict
 * resolution strategies, retry logic, and auto-sync lifecycle.
 *
 * Key constants from source:
 *   BATCH_SIZE = 50, MAX_RETRIES = 3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock dependencies ───────────────────────────────────────────────

vi.mock('../../lib/storage/storageRegistry', () => ({
  StorageKeys: {
    PENDING_SYNC_OPS: 'panacea_pending_sync_ops',
    LAST_SYNC_TIME: 'panacea_last_sync_time',
    OFFLINE_MODE: 'panacea_offline_mode',
  },
}));

vi.mock('../../lib/logger', () => ({
  syncLogger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../lib/utils/apiEnvelope', () => ({
  unwrapApiEnvelope: vi.fn((data: any) => data),
}));

// ── Import after mocks ──────────────────────────────────────────────

import {
  queueSyncOperation,
  isOnline,
  isOfflineMode,
  setOfflineMode,
  syncPendingOperations,
  getSyncStatus,
  clearPendingOperations,
  setupAutoSync,
  exportPendingOperations,
  importPendingOperations,
} from './offlineSyncService';

// ── Helpers ─────────────────────────────────────────────────────────

function clearAllStorage(): void {
  localStorage.removeItem('panacea_pending_sync_ops');
  localStorage.removeItem('panacea_last_sync_time');
  localStorage.removeItem('panacea_offline_mode');
}

function getStoredOps(): Array<{ id: string; type: string; operation: string; data: any; timestamp: number; retries: number }> {
  const raw = localStorage.getItem('panacea_pending_sync_ops');
  return raw ? JSON.parse(raw) : [];
}

// ── Tests ───────────────────────────────────────────────────────────

describe('offlineSyncService', () => {
  beforeEach(() => {
    clearAllStorage();
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAllStorage();
  });

  // ── Queue operations ──

  describe('queueSyncOperation', () => {
    it('queues a performance create operation', () => {
      queueSyncOperation('performance', 'create', { score: 95 });
      const ops = getStoredOps();
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('performance');
      expect(ops[0].operation).toBe('create');
      expect(ops[0].data).toEqual({ score: 95 });
      expect(ops[0].retries).toBe(0);
    });

    it('appends to existing pending operations', () => {
      queueSyncOperation('srs', 'update', { cardId: '1' });
      queueSyncOperation('achievement', 'create', { name: 'First Review' });
      expect(getStoredOps()).toHaveLength(2);
    });

    it('generates unique IDs', () => {
      queueSyncOperation('performance', 'create', { a: 1 });
      queueSyncOperation('performance', 'create', { a: 2 });
      const ops = getStoredOps();
      expect(ops[0].id).not.toBe(ops[1].id);
    });

    it('captures timestamp', () => {
      const before = Date.now();
      queueSyncOperation('srs', 'update', {});
      const ops = getStoredOps();
      expect(ops[0].timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  // ── Online/offline state ──

  describe('isOnline / isOfflineMode / setOfflineMode', () => {
    it('isOnline reflects navigator.onLine', () => {
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
      expect(isOnline()).toBe(true);

      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      expect(isOnline()).toBe(false);
    });

    it('isOfflineMode defaults to false', () => {
      expect(isOfflineMode()).toBe(false);
    });

    it('setOfflineMode persists to localStorage', () => {
      setOfflineMode(true);
      expect(isOfflineMode()).toBe(true);

      setOfflineMode(false);
      expect(isOfflineMode()).toBe(false);
    });
  });

  // ── Sync status ──

  describe('getSyncStatus', () => {
    it('returns pending count, last sync time, and offline state', () => {
      queueSyncOperation('performance', 'create', {});
      queueSyncOperation('srs', 'update', {});
      localStorage.setItem('panacea_last_sync_time', '1700000000000');

      const status = getSyncStatus();
      expect(status.pendingCount).toBe(2);
      expect(status.lastSyncTime).toBe(1700000000000);
      expect(status.isOffline).toBe(false);
    });

    it('returns null lastSyncTime when never synced', () => {
      const status = getSyncStatus();
      expect(status.lastSyncTime).toBeNull();
    });
  });

  // ── Clear pending operations ──

  describe('clearPendingOperations', () => {
    it('removes all pending operations', () => {
      queueSyncOperation('performance', 'create', {});
      queueSyncOperation('srs', 'update', {});
      expect(getStoredOps()).toHaveLength(2);

      clearPendingOperations();
      expect(getStoredOps()).toHaveLength(0);
    });
  });

  // ── Export / import ──

  describe('exportPendingOperations / importPendingOperations', () => {
    it('exports pending operations as JSON string', () => {
      queueSyncOperation('srs', 'update', { cardId: '42' });
      const exported = exportPendingOperations();
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].data.cardId).toBe('42');
    });

    it('imports operations from JSON string', () => {
      const data = JSON.stringify([
        { id: 'import-1', type: 'streak', operation: 'create', data: { day: 1 }, timestamp: 1000, retries: 0 },
      ]);
      importPendingOperations(data);
      expect(getStoredOps()).toHaveLength(1);
      expect(getStoredOps()[0].id).toBe('import-1');
    });

    it('handles invalid JSON gracefully', () => {
      expect(() => importPendingOperations('not-json')).not.toThrow();
      expect(getStoredOps()).toHaveLength(0);
    });
  });

  // ── Sync pending operations ──

  describe('syncPendingOperations', () => {
    it('returns success=false when offline', async () => {
      vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
      const result = await syncPendingOperations();
      expect(result.success).toBe(false);
      expect(result.synced).toBe(0);
    });

    it('returns empty result when no pending ops', async () => {
      const result = await syncPendingOperations();
      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
    });

    it('syncs pending operations and clears them', async () => {
      queueSyncOperation('performance', 'create', { score: 90 });
      const result = await syncPendingOperations('test-token');
      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(getStoredOps()).toHaveLength(0);
    });

    it('sets Authorization header when token provided', async () => {
      const fetchSpy = vi.mocked(globalThis.fetch);
      queueSyncOperation('performance', 'create', { score: 90 });
      await syncPendingOperations('my-token');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/performance',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('does not set Authorization header when no token', async () => {
      const fetchSpy = vi.mocked(globalThis.fetch);
      queueSyncOperation('performance', 'create', { score: 90 });
      await syncPendingOperations();
      const callHeaders = (fetchSpy.mock.calls[0] as any)?.[1]?.headers;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    it('retries failed operations up to MAX_RETRIES (3)', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
      queueSyncOperation('srs', 'update', { cardId: '1' });

      // First sync attempt — op should remain with retries=1
      const result1 = await syncPendingOperations();
      expect(result1.synced).toBe(0);
      expect(result1.failed).toBe(0);
      expect(getStoredOps()).toHaveLength(1);
      expect(getStoredOps()[0].retries).toBe(1);

      // Second attempt — retries=2
      await syncPendingOperations();
      expect(getStoredOps()[0].retries).toBe(2);

      // Third attempt — retries=3, now marked as failed
      const result3 = await syncPendingOperations();
      expect(result3.failed).toBe(1);
      expect(getStoredOps()).toHaveLength(0);
    });

    it('marks 401 responses as permanently failed', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false, status: 401 } as Response);
      queueSyncOperation('performance', 'create', {});

      const result = await syncPendingOperations();
      expect(result.failed).toBe(1);
      expect(getStoredOps()).toHaveLength(0);
    });
  });

  // ── Conflict resolution strategies ──

  describe('syncPendingOperations — conflict resolution', () => {
    function makeConflictResponse(serverData: any) {
      return {
        ok: false,
        status: 409,
        json: () => Promise.resolve(serverData),
      } as unknown as Response;
    }

    it('client-wins: keeps client data on conflict', async () => {
      const clientData = { id: '1', score: 99, updatedAt: '2024-01-01' };
      const serverData = { id: '1', score: 50, updatedAt: '2024-01-02' };

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(makeConflictResponse(serverData))
        .mockResolvedValueOnce({ ok: true } as Response);

      queueSyncOperation('performance', 'update', clientData);
      const result = await syncPendingOperations(undefined, { strategy: 'client-wins' });
      expect(result.synced).toBe(1);
      // Second call should send client data
      const secondCall = vi.mocked(globalThis.fetch).mock.calls[1] as any;
      expect(JSON.parse(secondCall[1].body)).toEqual(clientData);
    });

    it('server-wins: discards client data', async () => {
      const clientData = { id: '1', score: 99 };
      const serverData = { id: '1', score: 50, updatedAt: '2024-01-02' };

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeConflictResponse(serverData));

      queueSyncOperation('performance', 'update', clientData);
      const result = await syncPendingOperations(undefined, { strategy: 'server-wins' });
      expect(result.synced).toBe(0);
      // Should not retry (returned false)
    });

    it('newest-wins: keeps newer timestamp', async () => {
      const clientData = { id: '1', score: 99, updatedAt: '2024-01-03' };
      const serverData = { id: '1', score: 50, updatedAt: '2024-01-01' };

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(makeConflictResponse(serverData))
        .mockResolvedValueOnce({ ok: true } as Response);

      queueSyncOperation('performance', 'update', clientData);
      const result = await syncPendingOperations(undefined, { strategy: 'newest-wins' });
      expect(result.synced).toBe(1);
    });

    it('newest-wins: discards when server is newer', async () => {
      const clientData = { id: '1', score: 99, updatedAt: '2024-01-01' };
      // Server timestamp far in the future so server is always newer
      const serverData = { id: '1', score: 50, updatedAt: '2099-12-31T23:59:59Z' };

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeConflictResponse(serverData));

      queueSyncOperation('performance', 'update', clientData);
      const result = await syncPendingOperations(undefined, { strategy: 'newest-wins' });
      expect(result.synced).toBe(0);
    });

    it('merge: combines server and client data, client wins on overlap', async () => {
      const clientData = { id: '1', score: 99, newField: 'yes' };
      const serverData = { id: '1', score: 50, serverField: 'yes', updatedAt: '2024-01-01' };

      vi.mocked(globalThis.fetch)
        .mockResolvedValueOnce(makeConflictResponse(serverData))
        .mockResolvedValueOnce({ ok: true } as Response);

      queueSyncOperation('performance', 'update', clientData);
      const result = await syncPendingOperations(undefined, { strategy: 'merge' });
      expect(result.synced).toBe(1);
      const secondCall = vi.mocked(globalThis.fetch).mock.calls[1] as any;
      const merged = JSON.parse(secondCall[1].body);
      expect(merged.score).toBe(99); // client wins overlap
      expect(merged.serverField).toBe('yes'); // server non-conflicting kept
      expect(merged.newField).toBe('yes'); // client non-conflicting kept
    });
  });

  // ── Endpoint mapping ──

  describe('syncPendingOperations — endpoint routing', () => {
    it('routes performance ops to /api/performance', async () => {
      queueSyncOperation('performance', 'create', {});
      await syncPendingOperations();
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        '/api/performance',
        expect.anything()
      );
    });

    it('routes srs ops to /api/srs', async () => {
      queueSyncOperation('srs', 'create', {});
      await syncPendingOperations();
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        '/api/srs',
        expect.anything()
      );
    });

    it('routes savedQuestion ops to /api/saved-questions', async () => {
      queueSyncOperation('savedQuestion', 'create', {});
      await syncPendingOperations();
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        '/api/saved-questions',
        expect.anything()
      );
    });

    it('routes achievement ops to /api/achievements', async () => {
      queueSyncOperation('achievement', 'create', {});
      await syncPendingOperations();
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        '/api/achievements',
        expect.anything()
      );
    });

    it('routes streak ops to /api/streaks', async () => {
      queueSyncOperation('streak', 'create', {});
      await syncPendingOperations();
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        '/api/streaks',
        expect.anything()
      );
    });
  });

  // ── HTTP method mapping ──

  describe('syncPendingOperations — HTTP methods', () => {
    it('sends POST for create operations', async () => {
      queueSyncOperation('performance', 'create', {});
      await syncPendingOperations();
      const call = vi.mocked(globalThis.fetch).mock.calls[0] as any;
      expect(call[1].method).toBe('POST');
    });

    it('sends PUT for update operations', async () => {
      queueSyncOperation('srs', 'update', {});
      await syncPendingOperations();
      const call = vi.mocked(globalThis.fetch).mock.calls[0] as any;
      expect(call[1].method).toBe('PUT');
    });

    it('sends DELETE for delete operations', async () => {
      queueSyncOperation('streak', 'delete', {});
      await syncPendingOperations();
      const call = vi.mocked(globalThis.fetch).mock.calls[0] as any;
      expect(call[1].method).toBe('DELETE');
    });
  });

  // ── Auto-sync lifecycle ──

  describe('setupAutoSync', () => {
    it('returns a cleanup function', () => {
      const cleanup = setupAutoSync();
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('cleanup removes event listeners', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const cleanup = setupAutoSync();
      const onlineAdded = addSpy.mock.calls.some(([event]) => event === 'online');
      const offlineAdded = addSpy.mock.calls.some(([event]) => event === 'offline');
      expect(onlineAdded).toBe(true);
      expect(offlineAdded).toBe(true);

      cleanup();
      const onlineRemoved = removeSpy.mock.calls.some(([event]) => event === 'online');
      const offlineRemoved = removeSpy.mock.calls.some(([event]) => event === 'offline');
      expect(onlineRemoved).toBe(true);
      expect(offlineRemoved).toBe(true);
    });
  });
});
