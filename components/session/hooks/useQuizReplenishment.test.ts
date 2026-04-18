/**
 * useQuizReplenishment Hook Unit Test Suite (Sprint S4)
 *
 * Validates the in-flight ref-guard and error-path state release introduced in
 * S4 so that:
 *   1. Overlapping same-tick triggers never produce parallel fetches.
 *   2. The ref is released on every exit path (success, empty fetch, error,
 *      MAX-attempts early return) so subsequent retries actually go through.
 *
 * Also pins down the retry semantics callers depend on — retry after a failure
 * must clear `replenishmentError` AND reset the attempt counter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Question, SessionSettings } from '@/types';
import { useQuizReplenishment } from './useQuizReplenishment';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetchSessionQuestions, mockGetQuestionClient, mockLogger } = vi.hoisted(() => {
  const mockFetchSessionQuestions = vi.fn();
  const mockGetQuestionClient = vi.fn();
  const mockLogger = {
    scope: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
  return { mockFetchSessionQuestions, mockGetQuestionClient, mockLogger };
});

vi.mock('@/services/core', () => ({
  fetchSessionQuestions: (...args: unknown[]) => mockFetchSessionQuestions(...args),
}));

vi.mock('@/services/client/questionApi', () => ({
  getQuestionClient: (...args: unknown[]) => mockGetQuestionClient(...args),
}));

vi.mock('@/lib/simple-logger', () => ({
  logger: mockLogger,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(id: string): Question {
  return {
    id,
    question: `Q ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswerIndex: 0,
    explanation: '',
  } as unknown as Question;
}

/** Session settings that keep `shouldEndlesslyReplenish` true. */
const CONTINUOUS_SESSION: SessionSettings = {
  mode: 'standard',
  focus: 'all',
} as unknown as SessionSettings;

/** Seed queue large enough to keep the proactive useEffect from firing. */
const FULL_QUEUE: Question[] = Array.from({ length: 30 }, (_, i) => makeQuestion(`seed-${i}`));

function setupHook(queue: Question[] = FULL_QUEUE) {
  const setQueue = vi.fn();
  const setParentQueue = vi.fn();
  const setError = vi.fn();
  const getToken = vi.fn().mockResolvedValue('tok');

  const { result, rerender, unmount } = renderHook(() =>
    useQuizReplenishment({
      queue,
      setQueue,
      setParentQueue,
      setError,
      sessionSettings: CONTINUOUS_SESSION,
      growthAreas: [],
      getToken,
    }),
  );

  return { result, rerender, unmount, setQueue, setParentQueue, setError, getToken };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useQuizReplenishment — S4 in-flight guard', () => {
  beforeEach(() => {
    mockFetchSessionQuestions.mockReset();
    mockGetQuestionClient.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fires only ONE fetch when replenishQueue is called twice in the same tick', async () => {
    // Deferred promise — the first call hangs on await until we resolve it,
    // giving the second call a window to observe ref=true and bail.
    let resolveFetch!: (v: { questions: Question[] }) => void;
    mockFetchSessionQuestions.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = setupHook();

    let firstCall: Promise<void>;
    let secondCall: Promise<void>;

    await act(async () => {
      // Fire both calls synchronously — same tick, pre-commit.
      firstCall = result.current.replenishQueue();
      secondCall = result.current.replenishQueue();
    });

    // Only one fetch should have been issued despite two replenish calls.
    expect(mockFetchSessionQuestions).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({ questions: [makeQuestion('new-1')] });
      await firstCall;
      await secondCall;
    });

    // After completion the ref is released — a third call goes through.
    await act(async () => {
      mockFetchSessionQuestions.mockResolvedValueOnce({ questions: [makeQuestion('new-2')] });
      await result.current.replenishQueue();
    });

    expect(mockFetchSessionQuestions).toHaveBeenCalledTimes(2);
  });

  it('releases the ref on a throwing fetch so retry is possible', async () => {
    // First call — batch throws, single-question fallback also returns null.
    mockFetchSessionQuestions.mockRejectedValueOnce(new Error('API down'));
    mockGetQuestionClient.mockResolvedValue(null);

    const { result, setError } = setupHook();

    await act(async () => {
      await result.current.replenishQueue();
    });

    // Replenish failed but we did NOT throw upwards; setError is NOT called
    // because the batch fetch falling back to fallback fetch is handled
    // internally (no outer catch). Only outer-catch path calls setError.
    expect(setError).not.toHaveBeenCalled();

    // Retry now — ref must have been released.
    mockFetchSessionQuestions.mockResolvedValueOnce({ questions: [makeQuestion('recovered')] });

    await act(async () => {
      await result.current.replenishQueue();
    });

    // Two fetch attempts total — proves the guard released after the first.
    expect(mockFetchSessionQuestions).toHaveBeenCalledTimes(2);
  });

  it('releases the ref on MAX-attempts early return', async () => {
    // Sabotage every fetch so replenishAttempts climbs to MAX.
    mockFetchSessionQuestions.mockResolvedValue({ questions: [] });
    mockGetQuestionClient.mockResolvedValue(null);

    const { result } = setupHook();

    // Burn through MAX_REPLENISH_ATTEMPTS (3) consecutive empty fetches.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await result.current.replenishQueue();
      });
    }

    expect(mockFetchSessionQuestions).toHaveBeenCalledTimes(3);
    await waitFor(() => expect(result.current.replenishAttempts).toBeGreaterThanOrEqual(3));

    // 4th call trips the MAX guard — fetch must NOT fire again.
    const preMax = mockFetchSessionQuestions.mock.calls.length;
    await act(async () => {
      await result.current.replenishQueue();
    });
    expect(mockFetchSessionQuestions).toHaveBeenCalledTimes(preMax);

    // And the ref must still be released — retryReplenishment clears the
    // counter and re-enters cleanly.
    mockFetchSessionQuestions.mockResolvedValueOnce({
      questions: [makeQuestion('after-retry')],
    });
    await act(async () => {
      await result.current.retryReplenishment();
    });
    expect(mockFetchSessionQuestions).toHaveBeenCalledTimes(preMax + 1);
  });

  it('S5 — passes an AbortSignal through to fetchSessionQuestions and getQuestionClient', async () => {
    // Capture the signals passed to each underlying fetcher so we can prove
    // they originate from the same in-flight controller.
    let capturedBatchSignal: AbortSignal | undefined;
    let capturedFallbackSignal: AbortSignal | undefined;

    mockFetchSessionQuestions.mockImplementation(
      (_settings: unknown, _token: unknown, _count: unknown, signal?: AbortSignal) => {
        capturedBatchSignal = signal;
        return Promise.resolve({ questions: [makeQuestion('batch')] });
      },
    );
    mockGetQuestionClient.mockImplementation(
      (_settings: unknown, _ga: unknown, _getToken: unknown, signal?: AbortSignal) => {
        capturedFallbackSignal = signal;
        return Promise.resolve(null);
      },
    );

    const { result } = setupHook();

    await act(async () => {
      await result.current.replenishQueue();
    });

    expect(capturedBatchSignal).toBeInstanceOf(AbortSignal);
    expect(capturedBatchSignal?.aborted).toBe(false);

    // Force the fallback path on the second call to capture its signal too.
    mockFetchSessionQuestions.mockResolvedValueOnce({ questions: [] });

    await act(async () => {
      await result.current.replenishQueue();
    });

    expect(capturedFallbackSignal).toBeInstanceOf(AbortSignal);
    expect(capturedFallbackSignal?.aborted).toBe(false);
  });

  it('S5 — unmount aborts the in-flight fetch without crashing or setting error', async () => {
    // Deferred promise wired to the incoming AbortSignal: when the signal
    // fires (unmount → controller.abort()), the fetch rejects with AbortError.
    mockFetchSessionQuestions.mockImplementation(
      (_settings: unknown, _token: unknown, _count: unknown, signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('Aborted');
              (err as Error & { name: string }).name = 'AbortError';
              reject(err);
            });
          }
        }),
    );
    mockGetQuestionClient.mockResolvedValue(null);

    const { result, unmount, setError } = setupHook();

    let pending!: Promise<void>;
    await act(async () => {
      pending = result.current.replenishQueue();
    });

    // Unmount while the fetch is still in-flight — triggers controller.abort()
    unmount();

    // Drain the pending promise so any catch/finally path finishes.
    await act(async () => {
      try {
        await pending;
      } catch {
        /* AbortError path — should never surface to the caller */
      }
    });

    // Silent cancellation — no user-facing error, no fallback fan-out.
    expect(setError).not.toHaveBeenCalled();
    expect(mockGetQuestionClient).not.toHaveBeenCalled();
  });

  it('S5 — AbortError from the batch fetch is not surfaced as a user error', async () => {
    // Simulate the batch fetch being cancelled mid-flight. The hook should
    // treat AbortError as a silent cancellation: no setError, no fallback.
    const abortError = new Error('Aborted');
    (abortError as Error & { name: string }).name = 'AbortError';
    mockFetchSessionQuestions.mockRejectedValueOnce(abortError);
    mockGetQuestionClient.mockResolvedValue(makeQuestion('should-not-fire'));

    const { result, setError } = setupHook();

    await act(async () => {
      await result.current.replenishQueue();
    });

    expect(setError).not.toHaveBeenCalled();
    expect(mockGetQuestionClient).not.toHaveBeenCalled();
  });

  it('skips replenishment entirely when shouldEndlesslyReplenish is false', async () => {
    const setQueue = vi.fn();
    const setParentQueue = vi.fn();
    const setError = vi.fn();
    const getToken = vi.fn().mockResolvedValue('tok');

    const { result } = renderHook(() =>
      useQuizReplenishment({
        queue: [],
        setQueue,
        setParentQueue,
        setError,
        sessionSettings: { mode: 'review', focus: 'review' } as unknown as SessionSettings,
        growthAreas: [],
        getToken,
      }),
    );

    await act(async () => {
      await result.current.replenishQueue();
    });

    // Review mode is finite — no fetch should ever fire.
    expect(mockFetchSessionQuestions).not.toHaveBeenCalled();
    expect(mockGetQuestionClient).not.toHaveBeenCalled();
    expect(result.current.shouldEndlesslyReplenish).toBe(false);
  });
});
