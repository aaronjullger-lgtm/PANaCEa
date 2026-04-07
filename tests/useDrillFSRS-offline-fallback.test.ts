/**
 * Regression tests for useDrillFSRS offline fallback (Lane 3 reliability)
 *
 * Verifies that when the API call fails (e.g., user is offline), the drill
 * answer is NOT silently lost — it's queued via syncManager.queueReview()
 * and will be synced when connectivity returns.
 *
 * Previously: all 13 drill types would silently drop answers when offline.
 * After fix: answers are persisted to localStorage + IndexedDB via syncManager.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

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

// Mock syncManager for offline fallback verification
const mockQueueReview = vi.fn();
vi.mock('@/lib/services/sync/syncManager', () => ({
  syncManager: {
    queueReview: (...args: any[]) => mockQueueReview(...args),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

// Suppress DEV console.debug
Object.defineProperty(import.meta, 'env', {
  value: { DEV: false },
  writable: true,
});

// Import AFTER mocks are set up
import { useDrillFSRS } from '../hooks/useDrillFSRS';

describe('useDrillFSRS — offline fallback (Lane 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();
  });

  it('should queue review via syncManager when API call fails with network error', async () => {
    mockQueueReview.mockReturnValue('review-offline-1');
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

    let response: any;
    await act(async () => {
      result.current.startQuestion();
      response = await result.current.submitAnswer({
        questionId: 'q-offline-1',
        selectedAnswer: 'option-a',
        timeSpentMs: 3000,
      });
    });

    // Should return null (API failed) and set error
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

  it('should pass telemetry fields to syncManager when offline', async () => {
    mockQueueReview.mockReturnValue('review-offline-2');
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDrillFSRS({ drillType: 'ddx' }));

    await act(async () => {
      result.current.startQuestion();
      result.current.recordAnswerChange('diag-a');
      result.current.recordAnswerChange('diag-b'); // switch

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
        timezone: 'America/New_York',
      })
    );
  });

  it('should stringify numeric selectedAnswer when queuing offline', async () => {
    mockQueueReview.mockReturnValue('review-offline-3');
    (global.fetch as any).mockRejectedValueOnce(new Error('Failed to fetch'));

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
        selectedAnswer: '2', // Converted via String()
        sessionType: 'drill',
      })
    );
  });

  it('should NOT queue to syncManager when API succeeds', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        isCorrect: true,
        quality: 3,
        parTimeMs: 5000,
        timeSpentMs: 2000,
        implicitMetrics: { rating: 3, gradeContinuous: 3.0, confidence: 0.9, latencyRatio: 0.4, answerSwitches: 0 },
        circadian: { phase: 'NEUTRAL', stabilityModifier: 1.0, localHour: 12 },
      }),
    });

    const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

    await act(async () => {
      result.current.startQuestion();
      await result.current.submitAnswer({
        questionId: 'q-online',
        selectedAnswer: 'a',
        timeSpentMs: 2000,
      });
    });

    // Should NOT have queued to syncManager since API succeeded
    expect(mockQueueReview).not.toHaveBeenCalled();
    expect(result.current.lastFSRSResponse).not.toBeNull();
  });

  it('should not crash if syncManager.queueReview also throws', async () => {
    mockQueueReview.mockImplementation(() => {
      throw new Error('localStorage full');
    });
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDrillFSRS({ drillType: 'condition' }));

    let response: any;
    await act(async () => {
      result.current.startQuestion();
      response = await result.current.submitAnswer({
        questionId: 'q-double-fail',
        selectedAnswer: 'a',
        timeSpentMs: 1000,
      });
    });

    // Should still return null and set the original error (not crash)
    expect(response).toBeNull();
    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toBeTruthy();
  });
});
