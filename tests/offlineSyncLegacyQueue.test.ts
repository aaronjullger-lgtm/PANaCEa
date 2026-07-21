import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discardDeadLetterQueue,
  getDeadLetterQueue,
  getQueueStatus,
  retryDeadLetterQueue,
  type SyncOperation,
} from '@/lib/services/sync/offlineSync';
import { StorageKeys } from '@/lib/storage/storageRegistry';

describe('legacy offline sync dead-letter queue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    );
  });

  it('retries dead-lettered operations through the legacy processor', async () => {
    const deadLettered: SyncOperation = {
      id: 'save_progress_failed',
      operation: 'save_progress',
      data: { performanceRecords: [{ questionId: 'q1', isCorrect: true }], savedQuestions: [] },
      timestamp: 123,
      attempts: 5,
      status: 'failed',
    };
    localStorage.setItem(StorageKeys.DEAD_LETTER_QUEUE, JSON.stringify([deadLettered]));

    const retried = await retryDeadLetterQueue('fresh-token');

    expect(retried).toBe(1);
    expect(getDeadLetterQueue()).toHaveLength(0);
    expect(getQueueStatus().pending).toBe(0);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
        body: JSON.stringify(deadLettered.data),
      })
    );
  });

  it('discards dead-lettered operations only after caller confirmation', () => {
    const deadLettered: SyncOperation = {
      id: 'flag_question_failed',
      operation: 'flag_question',
      data: { questionId: 'q1' },
      timestamp: 123,
      attempts: 5,
      status: 'failed',
    };
    localStorage.setItem(StorageKeys.DEAD_LETTER_QUEUE, JSON.stringify([deadLettered]));

    expect(discardDeadLetterQueue()).toBe(1);
    expect(getDeadLetterQueue()).toHaveLength(0);
  });
});
