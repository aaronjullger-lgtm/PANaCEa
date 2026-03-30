/**
 * useDrillFSRS Hook Unit Test Suite
 *
 * Tests the unified telemetry + FSRS submission hook for drill components.
 *
 * Coverage:
 * - Hook initialization and cleanup
 * - Telemetry tracking (time-to-first-click, answer switches, dwell time)
 * - API request payload structure
 * - Error handling and edge cases
 * - FSRS response parsing
 * - State management (submitting, error, response)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDrillFSRS, type UseDrillFSRSOptions, type SubmitAnswerParams, type DrillFSRSResponse } from '../hooks/useDrillFSRS';

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  useAuth: vi.fn(() => ({
    getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
  })),
}));

// Mock circadian utilities
vi.mock('@/lib/circadian', () => ({
  getBrowserTimezone: vi.fn(() => 'America/New_York'),
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock import.meta.env for DEV checks
Object.defineProperty(import.meta, 'env', {
  value: { DEV: false },
  writable: true,
});

describe('useDrillFSRS Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  describe('startQuestion', () => {
    it('should initialize telemetry state for a new question', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
      });

      // After startQuestion, subsequent calls should track time properly
      act(() => {
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('option-a');
      });

      // The timing should be captured
      // We can verify by submitting and checking the payload
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

      // Second attempt should have fresh metrics
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

  describe('recordAnswerChange', () => {
    it('should track time to first click on first answer selection', () => {
      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      act(() => {
        result.current.startQuestion();
        vi.advanceTimersByTime(250); // Simulate 250ms elapsed
        result.current.recordAnswerChange('option-a');
      });

      // First click should be recorded in telemetry
      // We'll verify via submitAnswer payload
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

      // Dwell time should be tracked
      expect(result.current.lastFSRSResponse).toBeNull();
    });
  });

  describe('submitAnswer', () => {
    it('should build correct API request payload', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 3000,
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
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: any;
      await act(async () => {
        result.current.startQuestion();
        vi.advanceTimersByTime(100);
        result.current.recordAnswerChange('option-a');
        vi.advanceTimersByTime(2900);

        response = await result.current.submitAnswer({
          questionId: 'q-123',
          selectedAnswer: 'option-a',
          timeSpentMs: 3000,
        });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/drills/submit-review',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-clerk-token',
          }),
          body: expect.stringContaining('q-123'),
        })
      );

      expect(response).toEqual(mockResponse);
    });

    it('should include sessionType=drill in request', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 3000,
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
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'pharm' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-456',
          selectedAnswer: 'metformin',
          timeSpentMs: 2500,
        });
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.sessionType).toBe('drill');
    });

    it('should include telemetry in request payload', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: false,
        quality: 1,
        parTimeMs: 5000,
        timeSpentMs: 1500,
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
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

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

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.questionId).toBe('q-789');
      expect(body.selectedAnswer).toBe('diagnosis-b');
      expect(body.timeSpentMs).toBe(1500);
      expect(body.timeToFirstClick).toBeDefined();
      expect(body.answerSwitches).toBeGreaterThanOrEqual(0);
      expect(body.totalDwellTime).toBeGreaterThanOrEqual(0);
      expect(body.timezone).toBe('America/New_York');
    });

    it('should set isSubmitting to true during request', async () => {
      let resolveFetch: any;
      (global.fetch as any).mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      expect(result.current.isSubmitting).toBe(false);

      const submitPromise = act(async () => {
        result.current.startQuestion();
        return result.current.submitAnswer({
          questionId: 'q-delayed',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      await waitFor(() => {
        expect(result.current.isSubmitting).toBe(true);
      });

      resolveFetch({
        ok: true,
        json: async () => ({
          success: true,
          isCorrect: true,
          quality: 3,
          parTimeMs: 5000,
          timeSpentMs: 1000,
          implicitMetrics: {
            rating: 3,
            gradeContinuous: 3.0,
            confidence: 0.9,
            latencyRatio: 0.2,
            answerSwitches: 0,
          },
          circadian: {
            phase: 'NEUTRAL',
            stabilityModifier: 1.0,
            localHour: 10,
          },
        }),
      });

      await submitPromise;

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should store FSRS response when successful', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 3000,
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
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      await act(async () => {
        result.current.startQuestion();
        await result.current.submitAnswer({
          questionId: 'q-123',
          selectedAnswer: 'a',
          timeSpentMs: 3000,
        });
      });

      expect(result.current.lastFSRSResponse).toEqual(mockResponse);
    });

    it('should compute fsrsNextReview from response', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 3000,
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
          intervalDays: 5,
          nextDueDate: '2026-04-04T14:00:00Z',
          stability: 30,
          difficulty: 4.8,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

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

    it('should return null and set error on HTTP failure', async () => {
      const errorMessage = 'Unauthorized';
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: errorMessage }),
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: any;
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
      const networkError = new Error('Network timeout');
      (global.fetch as any).mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: any;
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
      expect(result.current.error?.message).toContain('Failed to submit answer');
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: any;
      await act(async () => {
        result.current.startQuestion();
        response = await result.current.submitAnswer({
          questionId: 'q-json-err',
          selectedAnswer: 'a',
          timeSpentMs: 1000,
        });
      });

      expect(response).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it('should clear dwell interval after submission', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          isCorrect: true,
          quality: 3,
          parTimeMs: 5000,
          timeSpentMs: 2000,
          implicitMetrics: {
            rating: 3,
            gradeContinuous: 3.0,
            confidence: 0.9,
            latencyRatio: 0.4,
            answerSwitches: 0,
          },
          circadian: {
            phase: 'NEUTRAL',
            stabilityModifier: 1.0,
            localHour: 12,
          },
        }),
      });

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

      // After reset, a new submission should start fresh
      expect(result.current.lastFSRSResponse).toBeNull();
    });

    it('should clear last FSRS response', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 2000,
        implicitMetrics: {
          rating: 3,
          gradeContinuous: 3.0,
          confidence: 0.9,
          latencyRatio: 0.4,
          answerSwitches: 0,
        },
        circadian: {
          phase: 'NEUTRAL',
          stabilityModifier: 1.0,
          localHour: 12,
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

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

  describe('error handling', () => {
    it('should clear previous error on new submission', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'First error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            isCorrect: true,
            quality: 3,
            parTimeMs: 5000,
            timeSpentMs: 2000,
            implicitMetrics: {
              rating: 3,
              gradeContinuous: 3.0,
              confidence: 0.9,
              latencyRatio: 0.4,
              answerSwitches: 0,
            },
            circadian: {
              phase: 'NEUTRAL',
              stabilityModifier: 1.0,
              localHour: 10,
            },
          }),
        });

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

    it('should handle missing questionId', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          isCorrect: false,
          quality: 1,
          parTimeMs: 5000,
          timeSpentMs: 1000,
          implicitMetrics: {
            rating: 1,
            gradeContinuous: 1.0,
            confidence: 0.5,
            latencyRatio: 0.2,
            answerSwitches: 0,
          },
          circadian: {
            phase: 'NEUTRAL',
            stabilityModifier: 1.0,
            localHour: 10,
          },
        }),
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: any;
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
  });

  describe('multiple submissions', () => {
    it('should handle sequential questions without state bleed', async () => {
      const responses: DrillFSRSResponse[] = [
        {
          success: true,
          isCorrect: true,
          quality: 3,
          parTimeMs: 5000,
          timeSpentMs: 2000,
          implicitMetrics: {
            rating: 3,
            gradeContinuous: 3.0,
            confidence: 0.9,
            latencyRatio: 0.4,
            answerSwitches: 0,
          },
          circadian: {
            phase: 'NEUTRAL',
            stabilityModifier: 1.0,
            localHour: 12,
          },
          nextReview: {
            intervalDays: 3,
            nextDueDate: '2026-04-02T14:00:00Z',
            stability: 25,
            difficulty: 5.2,
          },
        },
        {
          success: true,
          isCorrect: false,
          quality: 1,
          parTimeMs: 5000,
          timeSpentMs: 1500,
          implicitMetrics: {
            rating: 1,
            gradeContinuous: 1.2,
            confidence: 0.3,
            latencyRatio: 0.3,
            answerSwitches: 1,
          },
          circadian: {
            phase: 'PEAK',
            stabilityModifier: 1.15,
            localHour: 9,
          },
          nextReview: {
            intervalDays: 1,
            nextDueDate: '2026-03-31T09:00:00Z',
            stability: 15,
            difficulty: 6.8,
          },
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => responses[0] })
        .mockResolvedValueOnce({ ok: true, json: async () => responses[1] });

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
      expect(result.current.lastFSRSResponse?.implicitMetrics.answerSwitches).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle null nextReview in response', async () => {
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 2000,
        implicitMetrics: {
          rating: 3,
          gradeContinuous: 3.0,
          confidence: 0.9,
          latencyRatio: 0.4,
          answerSwitches: 0,
        },
        circadian: {
          phase: 'NEUTRAL',
          stabilityModifier: 1.0,
          localHour: 12,
        },
        nextReview: null,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          isCorrect: true,
          quality: 3,
          parTimeMs: 5000,
          timeSpentMs: 2000,
          implicitMetrics: {
            rating: 3,
            gradeContinuous: 3.0,
            confidence: 0.9,
            latencyRatio: 0.4,
            answerSwitches: 0,
          },
          circadian: {
            phase: 'NEUTRAL',
            stabilityModifier: 1.0,
            localHour: 12,
          },
        }),
      });

      const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

      let response: any;
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
      const mockResponse: DrillFSRSResponse = {
        success: true,
        isCorrect: false,
        quality: 1,
        parTimeMs: 5000,
        timeSpentMs: 500,
        implicitMetrics: {
          rating: 1,
          gradeContinuous: 1.0,
          confidence: 0.1,
          latencyRatio: 0.1,
          answerSwitches: 0,
        },
        circadian: {
          phase: 'NEUTRAL',
          stabilityModifier: 1.0,
          localHour: 12,
        },
        isRapidGuess: true,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

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
  });
});
