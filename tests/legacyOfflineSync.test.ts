import { beforeEach, describe, expect, it } from 'vitest';

import { flushPendingToLocalStorage, type SyncOperation } from '@/lib/services/sync/offlineSync';
import { StorageKeys } from '@/lib/storage/storageRegistry';

describe('legacy offline sync beforeunload flush', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refreshes an existing pending progress operation with the latest local snapshot', () => {
    const staleOperation: SyncOperation = {
      id: 'save_progress_beforeunload_existing',
      operation: 'save_progress',
      data: {
        performanceRecords: [{ questionId: 'stale-question' }],
        savedQuestions: [],
      },
      timestamp: 1,
      attempts: 3,
      status: 'pending',
    };

    localStorage.setItem(StorageKeys.OFFLINE_QUEUE, JSON.stringify([staleOperation]));
    localStorage.setItem(
      StorageKeys.PERFORMANCE_DATA,
      JSON.stringify([{ questionId: 'fresh-question', topic: 'Cardiology', isCorrect: true }])
    );
    localStorage.setItem(
      StorageKeys.MISSED_QUESTIONS,
      JSON.stringify([{ questionId: 'missed-question', prompt: 'Missed item' }])
    );
    localStorage.setItem(
      StorageKeys.FLAGGED_QUESTIONS,
      JSON.stringify([{ questionId: 'flagged-question', prompt: 'Flagged item' }])
    );

    flushPendingToLocalStorage();

    const queue = JSON.parse(localStorage.getItem(StorageKeys.OFFLINE_QUEUE) ?? '[]');
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: 'save_progress_beforeunload_existing',
      operation: 'save_progress',
      attempts: 0,
      status: 'pending',
    });
    expect(queue[0].data.performanceRecords).toEqual([
      { questionId: 'fresh-question', topic: 'Cardiology', isCorrect: true },
    ]);
    expect(queue[0].data.savedQuestions).toEqual([
      { questionId: 'missed-question', prompt: 'Missed item', type: 'missed' },
      { questionId: 'flagged-question', prompt: 'Flagged item', type: 'flagged' },
    ]);
  });
});
