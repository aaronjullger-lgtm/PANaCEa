import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OfflineSyncService } from './offlineSyncService';

// Mock browser APIs
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
  },
  writable: true,
});

global.fetch = vi.fn();

describe('OfflineSyncService', () => {
  let service: OfflineSyncService;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    // Reset navigator.onLine — some tests mutate it (e.g. "should not process queue when offline")
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      writable: true,
    });
    service = new OfflineSyncService(mockLocalStorage as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('queueRequest', () => {
    it('should queue a request in localStorage', async () => {
      const url = '/api/test';
      const options = {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      };

      await service.queueRequest(url, options);

      const queue = service.getQueue();
      expect(queue.length).toBe(1);
      const first = queue[0];
      expect(first).toBeDefined();
      expect(first!.url).toBe(url);
      expect(first!.options).toEqual(options);
    });

    it('should persist queue to localStorage', async () => {
      await service.queueRequest('/api/test', { method: 'POST' });

      const stored = mockLocalStorage.getItem('offline-sync-queue');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.length).toBe(1);
    });
  });

  describe('processQueue', () => {
    it('should process all queued requests when online', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValue({ ok: true });

      await service.queueRequest('/api/test1', { method: 'POST' });
      await service.queueRequest('/api/test2', { method: 'POST' });

      expect(service.getQueue().length).toBe(2);

      await service.processQueue();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(service.getQueue().length).toBe(0);
    });

    it('should re-queue requests that fail (before max attempts)', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValue(new Error('Network error'));

      await service.queueRequest('/api/test', { method: 'POST' });

      await service.processQueue();

      // Request should be back in queue with incremented attempts
      expect(service.getQueue().length).toBe(1);
      expect(service.getQueue()[0]!.attempts).toBe(1);
    });

    it('should dead-letter requests after MAX_ATTEMPTS failures', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValue(new Error('Network error'));

      await service.queueRequest('/api/test', { method: 'POST' });

      // Process 5 times — should dead-letter on the 5th failure
      for (let i = 0; i < 5; i++) {
        await service.processQueue();
      }

      expect(service.getQueue().length).toBe(0);
      expect(service.getDeadLetter().length).toBe(1);
      expect(service.getDeadLetter()[0]!.attempts).toBe(5);
      expect(service.getDeadLetter()[0]!.deadLettered).toBe(true);
    });

    it('should not dead-letter if a request eventually succeeds', async () => {
      const mockFetch = global.fetch as any;
      // Fail 4 times, then succeed
      mockFetch
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockRejectedValueOnce(new Error('Fail 4'))
        .mockResolvedValueOnce({ ok: true });

      await service.queueRequest('/api/test', { method: 'POST' });

      for (let i = 0; i < 5; i++) {
        await service.processQueue();
      }

      expect(service.getQueue().length).toBe(0);
      expect(service.getDeadLetter().length).toBe(0);
    });

    it('should not process queue when offline', async () => {
      Object.defineProperty(global.navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValue({ ok: true });

      await service.queueRequest('/api/test', { method: 'POST' });
      await service.processQueue();

      // Should not have called fetch
      expect(mockFetch).not.toHaveBeenCalled();
      expect(service.getQueue().length).toBe(1);
    });
  });

  describe('getQueue', () => {
    it('should return the current queue', async () => {
      await service.queueRequest('/api/test1', { method: 'POST' });
      await service.queueRequest('/api/test2', { method: 'POST' });

      const queue = service.getQueue();
      expect(queue.length).toBe(2);
    });
  });

  describe('dead-letter management', () => {
    it('should return empty dead-letter queue initially', () => {
      expect(service.getDeadLetter()).toEqual([]);
    });

    it('should remove a single dead-lettered item', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValue(new Error('Network error'));

      await service.queueRequest('/api/a', { method: 'POST' });
      await service.queueRequest('/api/b', { method: 'POST' });

      // Dead-letter both
      for (let i = 0; i < 5; i++) await service.processQueue();

      const allDead = service.getDeadLetter();
      expect(allDead.length).toBe(2);

      service.removeDeadLetter(allDead[0]!.id);
      expect(service.getDeadLetter().length).toBe(1);
      expect(service.getDeadLetter()[0]!.url).toBe('/api/b');
    });

    it('should clear all dead-lettered items', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValue(new Error('Network error'));

      await service.queueRequest('/api/a', { method: 'POST' });
      for (let i = 0; i < 5; i++) await service.processQueue();

      expect(service.getDeadLetter().length).toBe(1);

      service.clearDeadLetter();
      expect(service.getDeadLetter().length).toBe(0);
    });
  });
});
