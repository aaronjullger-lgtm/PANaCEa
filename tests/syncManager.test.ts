/**
 * Unit tests for SyncManager (lib/services/sync/syncManager.ts)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncManager } from '@/lib/services/sync/syncManager';
import type { OfflineReview, OfflineAnswer, OfflinePearlAction } from '@/lib/services/sync/syncManager';

// ----------------------------------------------------------------------------
// MOCKS
// ----------------------------------------------------------------------------

// Mock localStorage with proper typing
interface MockStorage extends Storage {
  length: number;
  key(index: number): string | null;
  [key: string]: any;
}

const createMockStorage = (): MockStorage => {
  let store: Record<string, string> = {};
  return {
    length: 0,
    key: (index: number) => null,
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

// Mock logger
vi.mock('@/src/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ----------------------------------------------------------------------------
// TEST SETUP
// ----------------------------------------------------------------------------

describe('SyncManager', () => {
  let syncManager: SyncManager;
  let mockLocalStorage: MockStorage;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup localStorage mock
    mockLocalStorage = createMockStorage();
    global.localStorage = mockLocalStorage;
    global.localStorage.clear();

    // Setup fetch mock
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock window event listeners
    if (typeof window !== 'undefined') {
      window.addEventListener = vi.fn();
      window.removeEventListener = vi.fn();
    }

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
    });

    // Create a fresh instance for each test
    syncManager = new SyncManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // QUEUE REVIEW
  // --------------------------------------------------------------------------

  describe('queueReview', () => {
    it('should add a review to localStorage', () => {
      const review: Omit<OfflineReview, 'id' | 'timestamp' | 'synced' | 'syncAttempts'> = {
        questionId: 'question-123',
        selectedAnswer: 1,
        timeSpentMs: 5000,
        timeToFirstClick: 2000,
        answerSwitches: 0,
        totalDwellTime: 10000,
        timezone: 'America/New_York',
        wakeTimeHHMM: '07:30',
        telemetry: { dwellTime: 10000 },
        sessionType: 'main',
      };

      const id = syncManager.queueReview(review);

      expect(id).toMatch(/^review-\d+-[a-z0-9]+$/);
      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id,
        questionId: 'question-123',
        selectedAnswer: 1,
        timeSpentMs: 5000,
        synced: false,
        syncAttempts: 0,
      });
    });

    it('should generate unique IDs for each review', () => {
      const review = {
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      };
      const id1 = syncManager.queueReview(review);
      const id2 = syncManager.queueReview(review);
      expect(id1).not.toBe(id2);
    });

    it('should trigger immediate sync if online', async () => {
      // Mock fetch to succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const review = {
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      };
      syncManager.queueReview(review);

      // Wait a tick for the async sync
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/drills/submit-reviews');
    });
  });

  // --------------------------------------------------------------------------
  // GET STATUS
  // --------------------------------------------------------------------------

  describe('getStatus', () => {
    it('should reflect pending reviews count', () => {
      // Initially zero pending
      let status = syncManager.getStatus();
      expect(status.pendingReviews).toBe(0);

      // Add a review
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      status = syncManager.getStatus();
      expect(status.pendingReviews).toBe(1);
    });

    it('should track online/offline state', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        writable: true,
      });
      let status = syncManager.getStatus();
      expect(status.isOnline).toBe(true);

      Object.defineProperty(navigator, 'onLine', {
        value: false,
        writable: true,
      });
      // Recreate instance after changing navigator.onLine
      syncManager = new SyncManager();
      status = syncManager.getStatus();
      expect(status.isOnline).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // SYNC ALL & SYNC REVIEWS
  // --------------------------------------------------------------------------

  describe('syncAll & syncReviews', () => {
    it('should sync pending reviews successfully', async () => {
      // Add a pending review
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      // Mock fetch to return success for batch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { questionId: 'q1', success: true },
          ],
        }),
      });

      const result = await syncManager.syncAll();
      expect(result.reviews).toBe(1);
      expect(result.answers).toBe(0);
      expect(result.pearls).toBe(0);

      // Verify review marked as synced
      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      // The synced review is filtered out because timestamp > cutoff? Actually cutoff is 24h, timestamp is recent, so it stays.
      // But the method filters out synced items where timestamp > cutoff (i.e., keep synced items that are older than 24h).
      // Since our review is recent, it will be kept in storage (for debugging). Let's check that synced = true.
      const pending = stored.filter((r: any) => !r.synced);
      expect(pending).toHaveLength(0);
    });

    it('should handle batch failure', async () => {
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      // Mock fetch to return HTTP error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await syncManager.syncAll();
      expect(result.reviews).toBe(0); // none synced
      // Verify syncAttempts increased
      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      expect(stored[0].syncAttempts).toBe(2);
      expect(stored[0].synced).toBe(false);
    });

    it('should emit sync events', async () => {
      // Mock fetch success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const eventListener = vi.fn();
      syncManager.on('sync-start', eventListener);
      syncManager.on('sync-complete', eventListener);

      await syncManager.syncAll();
      expect(eventListener).toHaveBeenCalledTimes(2);
      expect(eventListener.mock.calls[0][0].isSyncing).toBe(true);
      expect(eventListener.mock.calls[1][0].isSyncing).toBe(false);
    });

    it('should return zeros when already syncing', async () => {
      // Force isSyncing = true
      syncManager['isSyncing'] = true;
      const result = await syncManager.syncAll();
      expect(result).toEqual({ answers: 0, pearls: 0, reviews: 0 });
    });

    it('should return zeros when offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      // Recreate instance to pick up offline state
      syncManager = new SyncManager();
      const result = await syncManager.syncAll();
      expect(result).toEqual({ answers: 0, pearls: 0, reviews: 0 });
    });

    it('should handle sync error and emit sync-error', async () => {
      // Add a pending review
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      // Mock fetch to throw network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const eventListener = vi.fn();
      syncManager.on('sync-error', eventListener);

      await expect(syncManager.syncAll()).rejects.toThrow('Network failure');
      expect(eventListener).toHaveBeenCalledTimes(1);
      // Verify scheduleRetry was called (we can't directly test setTimeout)
      // but we can verify that isSyncing is false after error
      expect(syncManager.getStatus().isSyncing).toBe(false);
    });

    it('should sync answers and pearls', async () => {
      // Queue an answer
      const answerId = syncManager.queueAnswer({
        questionId: 'q1',
        selectedAnswer: 0,
        isCorrect: true,
        timeSpentMs: 2000,
        system: 'cardiovascular',
        conditionId: 'cond1',
      });
      // Queue a pearl action
      const pearlId = syncManager.queuePearlAction({
        pearlId: 'pearl1',
        action: 'mark_mastered',
      });

      // Mock fetch for answers endpoint
      mockFetch.mockImplementation((url) => {
        if (url === '/api/questions/attempt') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { attemptId: 'attempt-123' } }),
          });
        }
        // For pearl action endpoint
        if (url === '/api/user/pearls/pearl1/useful') {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          });
        }
        // For reviews (none)
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      });

      const result = await syncManager.syncAll();
      expect(result.answers).toBe(1);
      expect(result.pearls).toBe(1);
      expect(result.reviews).toBe(0);

      // Verify items are marked synced
      const storedAnswers = JSON.parse(localStorage.getItem('panceai_offline_answers') || '[]');
      const pendingAnswers = storedAnswers.filter((a: OfflineAnswer) => !a.synced);
      expect(pendingAnswers).toHaveLength(0);

      const storedPearls = JSON.parse(localStorage.getItem('panceai_offline_pearl_actions') || '[]');
      const pendingPearls = storedPearls.filter((p: OfflinePearlAction) => !p.synced);
      expect(pendingPearls).toHaveLength(0);
    });

    it('should schedule retry on error', async () => {
      // Add a pending review
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      // Mock fetch to fail
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Spy on setTimeout
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      try {
        await syncManager.syncAll();
      } catch (e) {
        // expected
      }

      // Verify setTimeout was called (scheduleRetry)
      expect(setTimeoutSpy).toHaveBeenCalled();
      const delay = setTimeoutSpy.mock.calls[0][1];
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(300000); // max 5 min

      vi.useRealTimers();
    });
  });
});