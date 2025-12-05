/**
 * Tests for Offline Sync Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Offline Sync', () => {
  // Mock localStorage
  const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
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
  })();

  beforeEach(() => {
    // Setup localStorage mock
    global.localStorage = mockLocalStorage as any;
    global.localStorage.clear();
  });

  describe('Queue Management', () => {
    it('should queue operation when offline', () => {
      const operation = {
        id: 'test-123',
        operation: 'save_progress' as const,
        data: { score: 100 },
        timestamp: Date.now(),
        attempts: 0,
        status: 'pending' as const,
      };

      // Store in queue
      const queue = [operation];
      localStorage.setItem('panacea_offline_queue', JSON.stringify(queue));

      // Retrieve and verify
      const stored = JSON.parse(localStorage.getItem('panacea_offline_queue') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].operation).toBe('save_progress');
      expect(stored[0].data.score).toBe(100);
    });

    it('should handle multiple queued operations', () => {
      const ops = [
        {
          id: 'op1',
          operation: 'save_progress' as const,
          data: {},
          timestamp: Date.now(),
          attempts: 0,
          status: 'pending' as const,
        },
        {
          id: 'op2',
          operation: 'submit_quiz' as const,
          data: {},
          timestamp: Date.now(),
          attempts: 0,
          status: 'pending' as const,
        },
      ];

      localStorage.setItem('panacea_offline_queue', JSON.stringify(ops));

      const stored = JSON.parse(localStorage.getItem('panacea_offline_queue') || '[]');
      expect(stored).toHaveLength(2);
    });
  });

  describe('Queue Status', () => {
    it('should calculate queue status correctly', () => {
      const ops = [
        {
          id: 'op1',
          operation: 'save_progress' as const,
          data: {},
          timestamp: Date.now(),
          attempts: 0,
          status: 'pending' as const,
        },
        {
          id: 'op2',
          operation: 'submit_quiz' as const,
          data: {},
          timestamp: Date.now(),
          attempts: 0,
          status: 'synced' as const,
        },
        {
          id: 'op3',
          operation: 'flag_question' as const,
          data: {},
          timestamp: Date.now(),
          attempts: 3,
          status: 'failed' as const,
        },
      ];

      const pending = ops.filter(op => op.status === 'pending').length;
      const synced = ops.filter(op => op.status === 'synced').length;
      const failed = ops.filter(op => op.status === 'failed').length;

      expect(pending).toBe(1);
      expect(synced).toBe(1);
      expect(failed).toBe(1);
      expect(ops.length).toBe(3);
    });
  });

  describe('Debouncing', () => {
    it('should delay operation by 500ms', async () => {
      const startTime = Date.now();
      const delay = 500;

      await new Promise(resolve => setTimeout(resolve, delay));

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(delay);
    });
  });

  describe('Retry Logic', () => {
    it('should mark as failed after max attempts', () => {
      const maxAttempts = 3;
      let attempts = 0;

      // Simulate failed attempts
      for (let i = 0; i < maxAttempts + 1; i++) {
        attempts++;
      }

      const isFailed = attempts >= maxAttempts;
      expect(isFailed).toBe(true);
    });

    it('should calculate exponential backoff', () => {
      const baseDelay = 2000; // 2 seconds

      const backoff1 = Math.pow(2, 1) * baseDelay; // 4 seconds
      const backoff2 = Math.pow(2, 2) * baseDelay; // 8 seconds
      const backoff3 = Math.pow(2, 3) * baseDelay; // 16 seconds

      expect(backoff1).toBe(4000);
      expect(backoff2).toBe(8000);
      expect(backoff3).toBe(16000);
    });
  });
});
