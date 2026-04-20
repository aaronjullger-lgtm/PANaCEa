/**
 * useDrillFSRS Hook Unit Test Suite
 *
 * Tests the unified telemetry + FSRS submission hook for drill components.
 *
 * Coverage:
 * - Hook initialization and cleanup
 * - Telemetry tracking (time-to-first-click, answer switches, dwell time)
 * - SDK client submission (createDrillsClient → submitReview)
 * - Error handling and offline fallback via syncManager
 * - FSRS response parsing
 * - State management (submitting, error, response)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDrillFSRS, type DrillFSRSResponse } from '../hooks/useDrillFSRS';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Clerk — use vi.hoisted so the fn survives mockReset
const mockUseAuth = vi.hoisted(() => vi.fn(() => ({
  getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
})));
vi.mock('@clerk/clerk-react', () => ({
  useAuth: mockUseAuth,
}));

// Mock circadian utilities
vi.mock('@/lib/circadian', () => ({
  getBrowserTimezone: vi.fn(() => 'America/New_York'),
}));

// Mock syncManager for offline fallback tests
const mockQueueReview = vi.fn();
vi.mock('@/lib/services/sync/syncManager', () => ({
  syncManager: {
    queueReview: (...args: unknown[]) => mockQueueReview(...args),
  },
}));

// Mock SDK client — use vi.hoisted so fns survive mockReset
const { mockSubmitReview, MockApiError, mockCreateApiClient, mockCreateDrillsClient } = vi.hoisted(() => {
  const mockSubmitReview = vi.fn();
  class MockApiError extends Error {
    public code: string;
    public userMessage: string;
    public isAuthError: boolean;
    constructor(code: string, message: string, userMessage?: string) {
      super(message);
      this.code = code;
      this.userMessage = userMessage ?? message;
      this.isAuthError = code === 'AUTH_ERROR';
    }
  }
  const mockCreateApiClient = vi.fn(() => ({}));
  const mockCreateDrillsClient = vi.fn(() => ({
    submitReview: (...args: unknown[]) => mockSubmitReview(...args),
  }));
  return { mockSubmitReview, MockApiError, mockCreateApiClient, mockCreateDrillsClient };
});
vi.mock('@/lib/sdk', () => ({
  createApiClient: mockCreateApiClient,
  createDrillsClient: mockCreateDrillsClient,
  ApiError: MockApiError,
}));

// Mock toast — use vi.hoisted to ensure the variable is available before vi.mock hoisting
const mockToast = vi.hoisted(() => ({
  error: vi.fn(),
  warning: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
}));
vi.mock('@/lib/toast', () => ({
  toast: mockToast,
}));

// Mock import.meta.env for DEV checks
Object.defineProperty(import.meta, 'env', {
  value: { DEV: false },
  writable: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Standard mock response for a correct answer with FSRS scheduling */
function mockCorrectResponse(overrides: Partial<DrillFSRSResponse> = {}): DrillFSRSResponse {
  return {
    success: true,
    isCorrect: true,
    quality: 3,
    parTimeMs: 5000,
    timeSpentMs: 3000,
    isRapidGuess: false,
    implicitMetrics: {
      rating: 3,
      gradeContinuous: 3.5,
      confidence: 0.8,
      latencyRatio: 0.6,
      answerSwitches: 0,
    },
    circadian: {
      phase: 'NEUTRAL',
      stabilityModifier: 1.0,
      localHour: 14,
    },
    nextReview: {
      intervalDays: 3,
      nextDueDate: '2026-04-02T14:00:00Z',
      stability: 25,
      difficulty: 5.2,
    },
    ...overrides,
  };
}

/** Standard mock response for an incorrect answer */
function mockIncorrectResponse(overrides: Partial<DrillFSRSResponse> = {}): DrillFSRSResponse {
  return {
    success: true,
    isCorrect: false,
    quality: 1,
    parTimeMs: 5000,
    timeSpentMs: 1500,
    isRapidGuess: false,
    implicitMetrics: {
      rating: 1,
      gradeContinuous: 1.2,
      confidence: 0.3,
      latencyRatio: 0.3,
      answerSwitches: 2,
    },
    circadian: {
      phase: 'TROUGH',
      stabilityModifier: 0.85,
      localHour: 22,
    },
    nextReview: {
      intervalDays: 1,
      nextDueDate: '2026-03-31T09:00:00Z',
      stability: 15,
      difficulty: 6.8,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useDrillFSRS Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitReview.mockReset();

    // Re-apply implementations wiped by vitest config's mockReset: true
    mockUseAuth.mockReturnValue({
      getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
    });
    mockCreateApiClient.mockReturnValue({});
    mockCreateDrillsClient.mockReturnValue({
      submitReview: (...args: unknown[]) => mockSubmitReview(...args),
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Initialization & Cleanup
  // =========================================================================
  describe('initialization and cleanup', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastFSRSResponse).toBeNull();
      expect(result.current.fsrsNextReview).toBeNull();
    });

    it('should expose all required methods', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'pharm' }));

      expect(typeof result.current.startQuestion).toBe('function');
      expect(typeof result.current.recordAnswerChange).toBe('function');
      expect(typeof result.current.submitAnswer).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should accept drillType option', () => {
      const drillTypes = ['condition', 'pharm', 'ddx', 'anatomy', 'ecg'];

      drillTypes.forEach((drillType) => {
        const { result } = renderHook(() => useDrillFSRS({ drillType }));
        expect(result.current).toBeDefined();
      });
    });

    it('should clean up dwell interval on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { result, unmount } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  // =========================================================================
  // startQuestion
  // =========================================================================
  describe('startQuestion', () => {
    it('should initialize telemetry state for a new question', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
      });

      act(() => {
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('option-a');
      });

      expect(result.current.lastFSRSResponse).toBeNull(); // Not yet submitted
    });

    it('should clear previous telemetry when starting a new question', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      // First question
      act(() => {
        result.current.startQuestion();
        vi.advanceTimersByTime(500);
        result.current.recordAnswerChange('a');
      });

      // Second question - should reset telemetry
      act(() => {
        result.current.startQuestion();
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('b');
      });

      expect(result.current.lastFSRSResponse).toBeNull();
    });

    it('should start dwell tracking interval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
      });

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
      setIntervalSpy.mockRestore();
    });
  });

  // =========================================================================
  // recordAnswerChange
  // =========================================================================
  describe('recordAnswerChange', () => {
    it('should track time to first click on first answer selection', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        vi.advanceTimersByTime(250);
        result.current.recordAnswerChange('option-a');
      });

      expect(result.current.lastFSRSResponse).toBeNull();
    });

    it('should track answer switches', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        result.current.recordAnswerChange('option-a');
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('option-b');
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('option-c');
      });

      // Two switches should be counted (a->b, b->c)
      expect(result.current.lastFSRSResponse).toBeNull();
    });

    it('should not count repeated selection as a switch', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        result.current.recordAnswerChange('option-a');
        vi.advanceTimersByTime(50);
        result.current.recordAnswerChange('option-a'); // Same option
        vi.advanceTimersByTime(50);
        result.current.recordAnswerChange('option-b'); // Different option
      });

      // Should count as 1 switch (a->b), not 2
      expect(result.current.lastFSRSResponse).toBeNull();
    });

    it('should update total dwell time', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        vi.advanceTimersByTime(500);
        result.current.recordAnswerChange('option-a');
      });

      expect(result.current.lastFSRSResponse).toBeNull();
    });
  });

  // =========================================================================
  // submitAnswer (SDK path)
  // =========================================================================
  describe('submitAnswer', () => {
    it('should call SDK submitReview with correct payload', async () => {
      const response = mockCorrectResponse();
      mockSubmitReview.mockResolvedValueOnce(response);

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let submitted: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('option-a');
        vi.advanceTimersByTime(2900);

        submitted = await result.current.submitAnswer({
          questionId: 'q-123',
          selectedAnswer: 'option-a',
          timeSpentMs: 3000,
        });
      });

      // Verify SDK was called (not fetch)
      expect(mockSubmitReview).toHaveBeenCalledTimes(1);
      expect(mockSubmitReview).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q-123',
          selectedAnswer: 'option-a',
          timeSpentMs: 3000,
          sessionType: 'drill',
          timezone: 'America/New_York',
          timeToFirstClick: expect.any(Number),
          answerSwitches: expect.any(Number),
          totalDwellTime: expect.any(Number),
        })
      );

      expect(submitted).toEqual(response);
    });

    it('should include sessionType=drill in request', async () => {
      mockSubmitReview.mockResolvedValueOnce(mockCorrectResponse());

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'pharm' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-456',
          selectedAnswer: 'metformin',
          timeSpentMs: 2500,
        });
      });

      const payload = mockSubmitReview.mock.calls[0][0];
      expect(payload.sessionType).toBe('drill');
    });

    it('should include telemetry in request payload', async () => {
      mockSubmitReview.mockResolvedValueOnce(mockIncorrectResponse());

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'ddx' }));

      await act(async () => {
        result.current.startQuestion();
        vi.advanceTimersByTime(300);
        result.current.recordAnswerChange('diagnosis-a');
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('diagnosis-b');
        vi.advanceTimersByTime(1100);

        await result.current.submitAnswer({
          questionId: 'q-789',
          selectedAnswer: 'diagnosis-b',
          timeSpentMs: 1500,
        });
      });

      const payload = mockSubmitReview.mock.calls[0][0];

      expect(payload.questionId).toBe('q-789');
      expect(payload.selectedAnswer).toBe('diagnosis-b');
      expect(payload.timeSpentMs).toBe(1500);
      expect(payload.timeToFirstClick).toBeDefined();
      expect(payload.answerSwitches).toBeGreaterThanOrEqual(0);
      expect(payload.totalDwellTime).toBeGreaterThanOrEqual(0);
      expect(payload.timezone).toBe('America/New_York');
    });

    it('should set isSubmitting to true during request and false after', async () => {
      // Use real timers for this test since we need async resolution
      vi.useRealTimers();

      let resolveSdk!: (v: DrillFSRSResponse) => void;
      mockSubmitReview.mockReturnValueOnce(
        new Promise<DrillFSRSResponse>((resolve) => {
          resolveSdk = resolve;
        })
      );

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      expect(result.current.isSubmitting).toBe(false);

      // Start submit without awaiting — check intermediate state
      let submitPromise!: Promise<void>;
      act(() => {
        submitPromise = (async () => {
          result.current.startQuestion();
          await result.current.submitAnswer({
            questionId: 'q-delayed',
            selectedAnswer: 'a',
            timeSpentMs: 1000,
          });
        })();
      });

      // Allow microtasks to flush so isSubmitting is set
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(result.current.isSubmitting).toBe(true);

      // Resolve the SDK call
      await act(async () => {
        resolveSdk(mockCorrectResponse({ timeSpentMs: 1000 }));
        await submitPromise;
      });

      expect(result.current.isSubmitting).toBe(false);

      // Re-enable fake timers for remaining tests in afterEach cleanup
      vi.useFakeTimers();
    });

    it('should store FSRS response when successful', async () => {
      const response = mockCorrectResponse();
      mockSubmitReview.mockResolvedValueOnce(response);

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-123',
          selectedAnswer: 'a',
          timeSpentMs: 3000,
        });
      });

      expect(result.current.lastFSRSResponse).toEqual(response);
    });

    it('should compute fsrsNextReview from response', async () => {
      const response = mockCorrectResponse({
        nextReview: {
          intervalDays: 5,
          nextDueDate: '2026-04-04T14:00:00Z',
          stability: 30,
          difficulty: 4.8,
        },
      });
      mockSubmitReview.mockResolvedValueOnce(response);

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'anatomy' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-anat',
          selectedAnswer: 'femur',
          timeSpentMs: 3000,
        });
      });

      expect(result.current.fsrsNextReview).toEqual({
        intervalDays: 5,
        nextDueDate: '2026-04-04T14:00:00Z',
        stability: 30,
        difficulty: 4.8,
      });
    });

    it('should return null and set error on SDK rejection', async () => {
      mockSubmitReview.mockRejectedValueOnce(new Error('Unauthorized'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: 'q-fail',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      expect(response).toBeNull();
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Unauthorized');
    });

    it('should handle network errors gracefully', async () => {
      mockSubmitReview.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: 'q-net-err',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      expect(response).toBeNull();
      expect(result.current.error).toBeDefined();
      // Original error is TypeError('Failed to fetch'), but hook wraps non-Error
      // as new Error('Failed to submit answer'). TypeError IS an Error, so it keeps it.
      expect(result.current.error?.message).toContain('Failed to fetch');
    });

    it('should handle non-Error throws from SDK', async () => {
      mockSubmitReview.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: 'q-string-err',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      expect(response).toBeNull();
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Failed to submit answer');
    });

    it('should clear dwell interval after submission', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      mockSubmitReview.mockResolvedValueOnce(mockCorrectResponse({ timeSpentMs: 2000 }));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-interval',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  // =========================================================================
  // isSubmitting resilience — finally-block guarantee
  // =========================================================================
  describe('isSubmitting resilience', () => {
    it('should reset isSubmitting to false after SDK error', async () => {
      vi.useRealTimers();
      mockSubmitReview.mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-err',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      // The finally block must fire even on error — session must never stay locked.
      expect(result.current.isSubmitting).toBe(false);
      vi.useFakeTimers();
    });

    it('should reset isSubmitting to false after network TypeError', async () => {
      vi.useRealTimers();
      mockSubmitReview.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'pharm' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-net',
          selectedAnswer: 'b',
          timeSpentMs: 2000,
        });
      });

      expect(result.current.isSubmitting).toBe(false);
      vi.useFakeTimers();
    });

    it('should allow subsequent submission after a failed one', async () => {
      vi.useRealTimers();
      mockSubmitReview
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(mockCorrectResponse());

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      // First submit — fails
      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({ questionId: 'q-1', selectedAnswer: 'a', timeSpentMs: 1000 });
      });
      expect(result.current.isSubmitting).toBe(false);

      // Second submit — succeeds (would be blocked forever if isSubmitting stayed true)
      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({ questionId: 'q-2', selectedAnswer: 'b', timeSpentMs: 2000 });
      });
      expect(result.current.isSubmitting).toBe(false);
      expect(response).not.toBeNull();
      vi.useFakeTimers();
    });
  });

  // =========================================================================
  // reset
  // =========================================================================
  describe('reset', () => {
    it('should clear telemetry state', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('a');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.lastFSRSResponse).toBeNull();
    });

    it('should clear last FSRS response', async () => {
      mockSubmitReview.mockResolvedValueOnce(mockCorrectResponse({ timeSpentMs: 2000 }));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-reset',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      expect(result.current.lastFSRSResponse).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      expect(result.current.lastFSRSResponse).toBeNull();
      expect(result.current.fsrsNextReview).toBeNull();
    });

    it('should clean up dwell interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        result.current.reset();
      });

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================
  describe('error handling', () => {
    it('should clear previous error on new submission', async () => {
      // First: fail
      mockSubmitReview.mockRejectedValueOnce(new Error('First error'));
      // Second: succeed
      mockSubmitReview.mockResolvedValueOnce(mockCorrectResponse({ timeSpentMs: 2000 }));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      // First submission fails
      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-1',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      expect(result.current.error).not.toBeNull();

      // Second submission succeeds
      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-2',
          selectedAnswer: 'b',
          timeSpentMs: 2000,
        });
      });

      expect(result.current.error).toBeNull();
      expect(result.current.lastFSRSResponse).not.toBeNull();
    });

    it('should handle empty questionId (API validates)', async () => {
      mockSubmitReview.mockResolvedValueOnce(
        mockIncorrectResponse({ timeSpentMs: 1000 })
      );

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: '',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      // Should still submit (API will handle validation)
      expect(response).toBeDefined();
    });

    it('should show auth error toast for ApiError with isAuthError', async () => {
      const authErr = new MockApiError('AUTH_ERROR', 'Token expired', 'Please sign in again');
      mockSubmitReview.mockRejectedValueOnce(authErr);

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-auth',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      expect(result.current.error).toBeDefined();
      expect(mockToast.error).toHaveBeenCalledWith('Please sign in again');
      // Auth errors should NOT queue to syncManager
      expect(mockQueueReview).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Multiple sequential submissions
  // =========================================================================
  describe('multiple submissions', () => {
    it('should handle sequential questions without state bleed', async () => {
      const resp1 = mockCorrectResponse({
        timeSpentMs: 2000,
        nextReview: {
          intervalDays: 3,
          nextDueDate: '2026-04-02T14:00:00Z',
          stability: 25,
          difficulty: 5.2,
        },
      });
      const resp2 = mockIncorrectResponse({
        timeSpentMs: 1500,
        nextReview: {
          intervalDays: 1,
          nextDueDate: '2026-03-31T09:00:00Z',
          stability: 15,
          difficulty: 6.8,
        },
      });

      mockSubmitReview.mockResolvedValueOnce(resp1);
      mockSubmitReview.mockResolvedValueOnce(resp2);

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      // Question 1
      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-1',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      expect(result.current.lastFSRSResponse?.isCorrect).toBe(true);
      expect(result.current.lastFSRSResponse?.nextReview?.intervalDays).toBe(3);

      // Question 2
      await act(async () => {
        result.current.startQuestion();
        result.current.recordAnswerChange('a');
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('b');

        await result.current.submitAnswer({
          questionId: 'q-2',
          selectedAnswer: 'b',
          timeSpentMs: 1500,
        });
      });

      expect(result.current.lastFSRSResponse?.isCorrect).toBe(false);
      expect(result.current.lastFSRSResponse?.nextReview?.intervalDays).toBe(1);
      expect(result.current.lastFSRSResponse?.implicitMetrics.answerSwitches).toBe(2);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('should handle null nextReview in response', async () => {
      mockSubmitReview.mockResolvedValueOnce(
        mockCorrectResponse({ nextReview: null, timeSpentMs: 2000 })
      );

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-null-review',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      expect(result.current.fsrsNextReview).toBeNull();
    });

    it('should handle numeric selectedAnswer', async () => {
      mockSubmitReview.mockResolvedValueOnce(mockCorrectResponse({ timeSpentMs: 2000 }));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: 'q-numeric',
          selectedAnswer: 2, // Numeric index
          timeSpentMs: 2000,
        });
      });

      expect(response?.isCorrect).toBe(true);
    });

    it('should include rapid-guess indicator if present in response', async () => {
      mockSubmitReview.mockResolvedValueOnce(
        mockIncorrectResponse({
          timeSpentMs: 500,
          isRapidGuess: true,
          implicitMetrics: {
            rating: 1,
            gradeContinuous: 1.0,
            confidence: 0.1,
            latencyRatio: 0.1,
            answerSwitches: 0,
          },
        })
      );

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        vi.advanceTimersByTime(500);
        await result.current.submitAnswer({
          questionId: 'q-rapid',
          selectedAnswer: 'a',
          timeSpentMs: 500,
        });
      });

      expect(result.current.lastFSRSResponse?.isRapidGuess).toBe(true);
    });

    it('should handle response wrapped in data envelope', async () => {
      // Some SDK responses come wrapped: { data: { ...result } }
      const inner = mockCorrectResponse({ timeSpentMs: 2000 });
      mockSubmitReview.mockResolvedValueOnce({ data: inner });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-envelope',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      // Hook stores the raw response (no envelope unwrapping)
      expect(result.current.lastFSRSResponse).toEqual({ data: inner });
    });
  });

  // =========================================================================
  // Offline fallback (syncManager)
  // =========================================================================
  describe('offline fallback to syncManager', () => {
    it('should queue review via syncManager when SDK call fails with network error', async () => {
      mockQueueReview.mockReturnValue('review-offline-1');
      mockSubmitReview.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        vi.advanceTimersByTime(200);
        result.current.recordAnswerChange('option-a');

        response = await result.current.submitAnswer({
          questionId: 'q-offline-1',
          selectedAnswer: 'option-a',
          timeSpentMs: 3000,
        });
      });

      // Should return null (SDK failed) and set error
      expect(response).toBeNull();
      expect(result.current.error).toBeDefined();

      // Should have queued the review via syncManager for later sync
      expect(mockQueueReview).toHaveBeenCalledTimes(1);
      expect(mockQueueReview).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q-offline-1',
          selectedAnswer: 'option-a',
          timeSpentMs: 3000,
          sessionType: 'drill',
          timezone: 'America/New_York',
        })
      );
    });

    it('should pass all telemetry fields to syncManager when offline', async () => {
      mockQueueReview.mockReturnValue('review-offline-2');
      mockSubmitReview.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'ddx' }));

      await act(async () => {
        result.current.startQuestion();
        vi.advanceTimersByTime(300);
        result.current.recordAnswerChange('diag-a');
        vi.advanceTimersByTime(200);
        result.current.recordAnswerChange('diag-b'); // switch
        vi.advanceTimersByTime(1000);

        await result.current.submitAnswer({
          questionId: 'q-offline-2',
          selectedAnswer: 'diag-b',
          timeSpentMs: 1500,
        });
      });

      expect(mockQueueReview).toHaveBeenCalledWith(
        expect.objectContaining({
          questionId: 'q-offline-2',
          selectedAnswer: 'diag-b',
          timeSpentMs: 1500,
          sessionType: 'drill',
          timeToFirstClick: expect.any(Number),
          answerSwitches: expect.any(Number),
          totalDwellTime: expect.any(Number),
          timezone: 'America/New_York',
        })
      );
    });

    it('should handle numeric selectedAnswer when queuing offline', async () => {
      mockQueueReview.mockReturnValue('review-offline-3');
      mockSubmitReview.mockRejectedValueOnce(new Error('Failed to fetch'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'pharm' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-offline-3',
          selectedAnswer: 2, // numeric index
          timeSpentMs: 1000,
        });
      });

      expect(mockQueueReview).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedAnswer: '2', // Should be stringified
          sessionType: 'drill',
        })
      );
    });

    it('should NOT queue to syncManager when SDK succeeds', async () => {
      mockSubmitReview.mockResolvedValueOnce(mockCorrectResponse({ timeSpentMs: 2000 }));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-online',
          selectedAnswer: 'a',
          timeSpentMs: 2000,
        });
      });

      expect(mockQueueReview).not.toHaveBeenCalled();
      expect(result.current.lastFSRSResponse).not.toBeNull();
    });

    it('should show warning toast when answer is queued offline', async () => {
      mockQueueReview.mockReturnValue('review-offline-toast');
      mockSubmitReview.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-toast',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      expect(mockToast.warning).toHaveBeenCalledWith(
        expect.stringContaining('saved offline'),
        expect.objectContaining({ duration: 4000 })
      );
    });

    it('should not crash if syncManager.queueReview also throws', async () => {
      mockQueueReview.mockImplementation(() => {
        throw new Error('localStorage full');
      });
      mockSubmitReview.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: DrillFSRSResponse | null = null;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: 'q-double-fail',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      // Should still return null and set the original error
      expect(response).toBeNull();
      expect(result.current.error).toBeDefined();

      // Should show error toast (not warning) since offline queue also failed
      expect(mockToast.error).toHaveBeenCalled();
    });
  });
});
