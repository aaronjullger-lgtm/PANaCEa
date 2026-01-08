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
    service = new OfflineSyncService();
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
      expect(queue[0].url).toBe(url);
      expect(queue[0].options).toEqual(options);
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

    it('should re-queue requests that fail', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValue(new Error('Network error'));

      await service.queueRequest('/api/test', { method: 'POST' });

      await service.processQueue();

      // Request should be back in queue
      expect(service.getQueue().length).toBe(1);
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
});
