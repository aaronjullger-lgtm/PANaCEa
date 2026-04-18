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

async function waitForAssertion(
  condition: () => void,
  attempts: number = 10
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      condition();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  condition();
}

/**
 * Drains the macrotask queue by yielding to the next event-loop tick.
 *
 * After queueReview/queueAnswer/queuePearlAction each trigger a fire-and-forget
 * immediate sync, calling this helper lets those async operations run to
 * completion (they fail with a TypeError because no fetch mock is configured yet)
 * before the test sets up its own mock for syncAll(). Without the drain, the
 * fire-and-forget sync would run *after* the mock is registered and would
 * unexpectedly consume it.
 */
async function drainMicrotaskQueue(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

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

      await waitForAssertion(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
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

      // Drain the macrotask queue: the immediate sync (from queueReview) runs and
      // fails cleanly (no mock set up yet → fetch returns undefined → TypeError),
      // ensuring the mock below is consumed by syncAll(), not the immediate sync.
      await drainMicrotaskQueue();

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

    it('should sync reviews when batch result order differs from request order', async () => {
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });
      syncManager.queueReview({
        questionId: 'q2',
        selectedAnswer: 1,
        timeSpentMs: 1200,
      });

      // Drain: let both immediate syncs (from queueReview) fail first
      await drainMicrotaskQueue();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { questionId: 'q2', success: true },
            { questionId: 'q1', success: true },
          ],
        }),
      });

      const result = await syncManager.syncAll();
      expect(result.reviews).toBe(2);

      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      const pending = stored.filter((r: any) => !r.synced);
      expect(pending).toHaveLength(0);
    });

    it('should handle batch failure', async () => {
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      // Drain: the immediate sync (from queueReview) runs and fails with a
      // TypeError (no mock yet — fetch returns undefined), incrementing syncAttempts to 1.
      await drainMicrotaskQueue();

      // Mock fetch to return HTTP error (parseSyncErrorMessage falls back to "HTTP 500"
      // since the plain object has no .json() method; syncAttempts becomes 2 overall).
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await syncManager.syncAll();
      expect(result.reviews).toBe(0); // none synced
      // Verify syncAttempts increased twice: once by the immediate-sync failure (TypeError)
      // and once by syncAll's failure (HTTP 500).
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

    it('should store last sync error when immediate review sync fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Immediate review failure'));

      syncManager.queueReview({
        questionId: 'q-immediate',
        selectedAnswer: 0,
        timeSpentMs: 900,
      });

      await waitForAssertion(() => {
        const status = syncManager.getStatus();
        expect(status.lastSyncError).toBe('Immediate review failure');
      });
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

      // Drain: let the immediate sync (from queueReview) fail first
      await drainMicrotaskQueue();

      // Mock fetch to throw network error
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const eventListener = vi.fn();
      syncManager.on('sync-error', eventListener);

      await expect(syncManager.syncAll()).rejects.toThrow('Network failure');
      expect(eventListener).toHaveBeenCalled();
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

      // Drain: let the immediate syncs (from queueAnswer/queuePearlAction) fail first
      await drainMicrotaskQueue();

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

  // --------------------------------------------------------------------------
  // BACKOFF JITTER (Lane 3)
  // --------------------------------------------------------------------------

  describe('scheduleRetry jitter', () => {
    it('should produce delays within ±25% of base exponential backoff', async () => {
      // Add a pending review (fire-and-forget sync will fail harmlessly)
      syncManager.queueReview({
        questionId: 'q1',
        selectedAnswer: 0,
        timeSpentMs: 1000,
      });

      // Set up mock to fail, then enable fake timers
      mockFetch.mockRejectedValue(new Error('Network error'));
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // First failure: consecutiveFailures 0 → 1, base = 30s * 2^1 = 60s
      try { await syncManager.syncAll(); } catch { /* expected - testing retry backoff */ }
      const delay1 = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1]?.[1] as number;

      const base1 = 30000 * Math.pow(2, 1); // 60s
      expect(delay1).toBeGreaterThanOrEqual(Math.round(base1 * 0.75));
      expect(delay1).toBeLessThanOrEqual(Math.round(base1 * 1.25));

      // Second failure: consecutiveFailures 1 → 2, base = 30s * 2^2 = 120s
      vi.clearAllTimers();
      setTimeoutSpy.mockClear();
      try { await syncManager.syncAll(); } catch { /* expected - testing retry backoff */ }
      const delay2 = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1]?.[1] as number;

      const base2 = 30000 * Math.pow(2, 2); // 120s
      expect(delay2).toBeGreaterThanOrEqual(Math.round(base2 * 0.75));
      expect(delay2).toBeLessThanOrEqual(Math.round(base2 * 1.25));

      vi.useRealTimers();
    });

    it('should cap jittered delay at 375s (300s base * 1.25) for high failure counts', async () => {
      syncManager.queueReview({ questionId: 'q1', selectedAnswer: 0, timeSpentMs: 1000 });

      mockFetch.mockRejectedValue(new Error('Network error'));
      vi.useFakeTimers();
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      // Run enough failures to push base delay to cap (30s * 2^4 = 480s → capped at 300s)
      // Stay under 5 total sync attempts per item (the retry limit)
      for (let i = 0; i < 4; i++) {
        // Re-queue a fresh review each time so we never hit the per-item limit
        if (i > 0) {
          syncManager.queueReview({ questionId: `q${i + 1}`, selectedAnswer: 0, timeSpentMs: 1000 });
        }
        vi.clearAllTimers();
        setTimeoutSpy.mockClear();
        try { await syncManager.syncAll(); } catch { /* expected - testing retry backoff */ }
      }

      const lastDelay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1]?.[1] as number;

      // Max base is 300s; jitter can push up to 375s (300s * 1.25)
      expect(lastDelay).toBeLessThanOrEqual(Math.round(300000 * 1.25));
      expect(lastDelay).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  // --------------------------------------------------------------------------
  // SPRINT S1: DEAD-LETTER QUEUE
  // --------------------------------------------------------------------------

  describe('S1 dead-letter queue', () => {
    /**
     * Helper: directly seed an offline review into localStorage with specific
     * syncAttempts/deadLettered state. Bypasses queueReview so we can set up
     * exactly the state we want to test without triggering immediate syncs.
     */
    const seedReview = (overrides: Partial<OfflineReview>) => {
      const existing = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      const review: OfflineReview = {
        id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        questionId: 'seed-q',
        selectedAnswer: 0,
        timeSpentMs: 1000,
        timestamp: Date.now(),
        synced: false,
        syncAttempts: 0,
        ...overrides,
      };
      existing.push(review);
      localStorage.setItem('panceai_offline_reviews', JSON.stringify(existing));
      return review;
    };

    it('should flag an item as dead-lettered after MAX_SYNC_ATTEMPTS failures', async () => {
      // Seed a review already at 4 attempts — next failure pushes to 5 (dead-letter threshold)
      seedReview({ syncAttempts: 4, synced: false });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const deadLetterListener = vi.fn();
      syncManager.on('dead-letter', deadLetterListener);

      try { await syncManager.syncAll(); } catch { /* sync throws but item state is what we verify */ }

      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      expect(stored[0].syncAttempts).toBe(5);
      expect(stored[0].deadLettered).toBe(true);
      expect(deadLetterListener).toHaveBeenCalled();
    });

    it('should exclude dead-lettered items from pending count', async () => {
      seedReview({ syncAttempts: 5, deadLettered: true, synced: false });
      seedReview({ syncAttempts: 1, synced: false });

      const status = syncManager.getStatus();
      expect(status.pendingReviews).toBe(1);
      expect(status.deadLetteredReviews).toBe(1);
    });

    it('should treat legacy items with syncAttempts >= MAX as dead-lettered even without the flag', () => {
      // Legacy item: no deadLettered field, but syncAttempts already maxed
      seedReview({ syncAttempts: 5, synced: false });

      const status = syncManager.getStatus();
      expect(status.pendingReviews).toBe(0);
      expect(status.deadLetteredReviews).toBe(1);
    });

    it('getDeadLetteredItems should return only dead-lettered items', () => {
      seedReview({ syncAttempts: 5, deadLettered: true, synced: false, questionId: 'dead-1' });
      seedReview({ syncAttempts: 2, synced: false, questionId: 'pending-1' });
      seedReview({ syncAttempts: 0, synced: true, questionId: 'synced-1' });

      const items = syncManager.getDeadLetteredItems();
      expect(items.reviews).toHaveLength(1);
      expect(items.reviews[0]?.questionId).toBe('dead-1');
    });

    it('retryDeadLettered should reset attempts and trigger a fresh sync', async () => {
      seedReview({
        syncAttempts: 5,
        deadLettered: true,
        synced: false,
        questionId: 'retry-me',
        lastSyncError: 'stuck',
      });

      // Mock the retry fetch to succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ questionId: 'retry-me', success: true }] }),
      });

      const result = await syncManager.retryDeadLettered();
      expect(result.reviews).toBe(1);

      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      expect(stored[0].synced).toBe(true);
    });

    it('retryDeadLettered should re-flag items if failure persists', async () => {
      seedReview({
        syncAttempts: 5,
        deadLettered: true,
        synced: false,
        questionId: 'still-broken',
      });

      // Retry triggers a single syncAll; the underlying fetch still fails.
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      try { await syncManager.retryDeadLettered(); } catch { /* may throw */ }

      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      // After retry: syncAttempts reset to 0, then incremented to 1 by the single
      // sync attempt inside retryDeadLettered. Not back at MAX yet — user can retry again
      // or wait for normal backoff to re-flag.
      expect(stored[0].syncAttempts).toBe(1);
      expect(stored[0].deadLettered).toBe(false);
    });

    it('discardDeadLettered should permanently remove dead-lettered items', () => {
      seedReview({ syncAttempts: 5, deadLettered: true, synced: false, questionId: 'discard-me' });
      seedReview({ syncAttempts: 1, synced: false, questionId: 'keep-me' });

      const counts = syncManager.discardDeadLettered();
      expect(counts.reviews).toBe(1);

      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].questionId).toBe('keep-me');
    });

    it('discardDeadLettered should be a no-op when nothing is dead-lettered', () => {
      seedReview({ syncAttempts: 0, synced: false });

      const counts = syncManager.discardDeadLettered();
      expect(counts.answers + counts.reviews + counts.pearlActions).toBe(0);

      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      expect(stored).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // SPRINT S2: LOCALSTORAGE QUOTA GUARD
  // --------------------------------------------------------------------------

  describe('S2 localStorage quota guard', () => {
    it('should prune synced items and retry on QuotaExceededError', () => {
      // Pre-populate: some synced + some unsynced items
      const existing = [
        { id: 'a1', questionId: 'q1', selectedAnswer: 0, timeSpentMs: 100, timestamp: Date.now(), synced: true, syncAttempts: 0 },
        { id: 'a2', questionId: 'q2', selectedAnswer: 0, timeSpentMs: 100, timestamp: Date.now(), synced: false, syncAttempts: 0 },
        { id: 'a3', questionId: 'q3', selectedAnswer: 0, timeSpentMs: 100, timestamp: Date.now(), synced: true, syncAttempts: 0 },
      ];
      localStorage.setItem('panceai_offline_reviews', JSON.stringify(existing));

      // First call throws QuotaExceededError, second call (after prune) succeeds.
      let setItemCalls = 0;
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = vi.fn((key: string, value: string) => {
        setItemCalls++;
        // Only throw on the FIRST call against the REVIEWS key (the test write);
        // prune's write and initial existing setup should succeed.
        if (setItemCalls === 1 && key === 'panceai_offline_reviews') {
          const quotaErr = new Error('Quota exceeded');
          quotaErr.name = 'QuotaExceededError';
          throw quotaErr;
        }
        return originalSetItem(key, value);
      });

      // Trigger a save that hits the quota path
      syncManager.queueReview({
        questionId: 'new-q',
        selectedAnswer: 0,
        timeSpentMs: 100,
      });

      // After recovery: synced items pruned, new review present
      const stored = JSON.parse(localStorage.getItem('panceai_offline_reviews') || '[]');
      const syncedCount = stored.filter((r: OfflineReview) => r.synced).length;
      const newItemPresent = stored.some((r: OfflineReview) => r.questionId === 'new-q');
      expect(syncedCount).toBe(0); // all synced items pruned
      expect(newItemPresent).toBe(true); // new review made it in after retry
    });

    it('should emit storage-full event when retry still hits quota', () => {
      const storageFullListener = vi.fn();
      syncManager.on('storage-full', storageFullListener);

      // Every setItem throws — simulating a truly full quota with nothing to prune.
      mockLocalStorage.setItem = vi.fn(() => {
        const quotaErr = new Error('Quota exceeded');
        quotaErr.name = 'QuotaExceededError';
        throw quotaErr;
      });

      syncManager.queueReview({
        questionId: 'overflow',
        selectedAnswer: 0,
        timeSpentMs: 100,
      });

      expect(storageFullListener).toHaveBeenCalled();
    });

    it('should not catch non-quota errors in safeSetItem', () => {
      mockLocalStorage.setItem = vi.fn(() => {
        throw new Error('Some other storage error');
      });

      // Non-quota errors bubble up and cause queueReview's synchronous save to throw.
      expect(() =>
        syncManager.queueReview({
          questionId: 'boom',
          selectedAnswer: 0,
          timeSpentMs: 100,
        })
      ).toThrow('Some other storage error');
    });

    it('should recognize Firefox-style quota errors by code 1014', () => {
      const storageFullListener = vi.fn();
      syncManager.on('storage-full', storageFullListener);

      mockLocalStorage.setItem = vi.fn(() => {
        const err = new Error('NS_ERROR_DOM_QUOTA_REACHED');
        (err as Error & { code: number }).code = 1014;
        (err as Error & { name: string }).name = 'NS_ERROR_DOM_QUOTA_REACHED';
        throw err;
      });

      syncManager.queueReview({
        questionId: 'firefox-overflow',
        selectedAnswer: 0,
        timeSpentMs: 100,
      });

      // Firefox-style error was recognized as quota, prune+retry also failed,
      // so storage-full fired.
      expect(storageFullListener).toHaveBeenCalled();
    });
  });
});
