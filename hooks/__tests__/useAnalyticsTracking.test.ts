import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies before importing
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    scope: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
  },
}));

vi.mock('@/services/analytics', () => ({
  recordBehavioralConfidence: vi.fn(),
  recordMomentumResult: vi.fn(),
  recordAnswerPattern: vi.fn(),
  updatePerformancePrediction: vi.fn(),
  recordPauseResult: vi.fn(),
  recordCircadianPerformance: vi.fn(),
  resetPrediction: vi.fn(),
}));

vi.mock('@/services/domain', () => ({
  recordQuestion: vi.fn(),
  getSessionSummary: vi.fn(() => ({ systems: {} })),
  resetSessionDistribution: vi.fn(),
}));

import { useAnalyticsTracking } from '../useAnalyticsTracking';
import {
  recordBehavioralConfidence,
  recordMomentumResult,
  recordAnswerPattern,
  updatePerformancePrediction,
  recordPauseResult,
  recordCircadianPerformance,
} from '@/services/analytics';
import { recordQuestion } from '@/services/domain';

const mockPayload = {
  isCorrect: true,
  timeToAnswer: 5000,
  parTime: 8000,
  behaviorSignals: {
    timeSpentMs: 5000,
    parTimeMs: 8000,
    answerChangeCount: 0,
    eliminatedCount: 0,
    quickInitialSelection: false,
  },
  questionNumber: 1,
  questionId: 'q-1',
  selectedAnswerIndex: 0,
  eliminatedCount: 0,
  answerChangeCount: 0,
  firstAnswer: 0,
  question: {
    id: 'q-1',
    system: 'Cardiology',
    correctAnswerIndex: 0,
    topic: 'MI',
    difficulty: 'medium',
  } as any,
};

describe('useAnalyticsTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls all analytics functions on trackAnswer', () => {
    const { result } = renderHook(() => useAnalyticsTracking());

    act(() => {
      result.current.trackAnswer(mockPayload);
    });

    expect(recordBehavioralConfidence).toHaveBeenCalledWith(mockPayload.behaviorSignals, true);
    expect(recordMomentumResult).toHaveBeenCalledWith(true, 5000, 8000);
    expect(recordAnswerPattern).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 'q-1', wasCorrect: true })
    );
    expect(updatePerformancePrediction).toHaveBeenCalledWith(
      expect.objectContaining({ correct: true, system: 'Cardiology' })
    );
    expect(recordPauseResult).toHaveBeenCalledWith({
      correct: true,
      timeSpentMs: 5000,
      parTimeMs: 8000,
    });
    expect(recordQuestion).toHaveBeenCalledWith('Cardiology', undefined);
    expect(recordCircadianPerformance).toHaveBeenCalledWith(
      expect.objectContaining({ isCorrect: true, topic: 'MI' })
    );
  });

  it('gracefully handles errors in individual recorders', () => {
    recordBehavioralConfidence.mockImplementation(() => {
      throw new Error('boom');
    });

    const { result } = renderHook(() => useAnalyticsTracking());

    // Should not throw — errors caught internally
    expect(() => {
      act(() => result.current.trackAnswer(mockPayload));
    }).not.toThrow();

    // Other recorders should still be called
    expect(recordMomentumResult).toHaveBeenCalled();
    expect(recordCircadianPerformance).toHaveBeenCalled();
  });

  it('handles incorrect answer', () => {
    const { result } = renderHook(() => useAnalyticsTracking());

    act(() => {
      result.current.trackAnswer({ ...mockPayload, isCorrect: false });
    });

    expect(recordBehavioralConfidence).toHaveBeenCalledWith(
      mockPayload.behaviorSignals,
      false
    );
    expect(recordMomentumResult).toHaveBeenCalledWith(false, 5000, 8000);
  });

  it('skips recordQuestion when system is null', () => {
    const { result } = renderHook(() => useAnalyticsTracking());

    act(() => {
      result.current.trackAnswer({
        ...mockPayload,
        question: { ...mockPayload.question, system: null },
      });
    });

    expect(recordQuestion).not.toHaveBeenCalled();
  });

  it('handles missing question id gracefully', () => {
    const { result } = renderHook(() => useAnalyticsTracking());

    act(() => {
      result.current.trackAnswer({
        ...mockPayload,
        questionId: 'temp-5',
        question: { ...mockPayload.question, id: undefined },
      });
    });

    expect(recordAnswerPattern).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 'temp-5' })
    );
  });
});
