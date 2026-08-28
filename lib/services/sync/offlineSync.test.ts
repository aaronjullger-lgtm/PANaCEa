import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDeadLetterQueue,
  processQueue,
  type SyncOperation,
} from './offlineSync';
import { StorageKeys } from '../../storage/storageRegistry';

function setOnline(isOnline: boolean): void {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    configurable: true,
    value: isOnline,
  });
}

function seedQueue(operations: SyncOperation[]): void {
  localStorage.setItem(StorageKeys.OFFLINE_QUEUE, JSON.stringify(operations));
}

function readQueue(): SyncOperation[] {
  return JSON.parse(localStorage.getItem(StorageKeys.OFFLINE_QUEUE) ?? '[]') as SyncOperation[];
}

function buildOperation(overrides: Partial<SyncOperation> = {}): SyncOperation {
  return {
    id: 'queued-progress-1',
    operation: 'save_progress',
    data: { performanceRecords: [], savedQuestions: [] },
    timestamp: 1_720_000_000_000,
    attempts: 0,
    status: 'pending',
    ...overrides,
  };
}

describe('legacy offline sync queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setOnline(true);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('leaves protected queued writes pending when no auth token is available', async () => {
    const fetchMock = vi.mocked(fetch);
    seedQueue([buildOperation()]);

    await processQueue();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readQueue()).toEqual([buildOperation()]);
    expect(getDeadLetterQueue()).toEqual([]);
  });

  it('does not spend retry attempts or dead-letter protected writes on auth failures', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);
    seedQueue([buildOperation({ attempts: 4 })]);

    await processQueue('expired-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readQueue()).toEqual([buildOperation({ attempts: 4 })]);
    expect(getDeadLetterQueue()).toEqual([]);
  });

  it('still dead-letters non-auth failures after the retry budget is exhausted', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);
    const operation = buildOperation({ attempts: 4 });
    seedQueue([operation]);

    await processQueue('valid-token');

    expect(readQueue()).toEqual([]);
    expect(getDeadLetterQueue()).toEqual([
      {
        ...operation,
        attempts: 5,
        status: 'failed',
      },
    ]);
  });
});
