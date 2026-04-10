import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/utils/fsrsImplicitRating', () => ({
  deriveFsrsRatingFromBehavior: vi.fn((params) =>
    params.isCorrect ? 3 : 1
  ),
}));

vi.mock('@/lib/utils/questionComplexity', () => ({
  calculateParTime: vi.fn(() => 30000),
}));

vi.mock('@/lib/implicit-metrics', () => ({
  behavioralPayloadToTelemetryData: vi.fn(() => ({ mock: 'telemetry' })),
  enrichTelemetryWithSessionPosition: vi.fn((t) => ({ ...t, position: true })),
}));

import { computeScore } from '../computeScore';
import { deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { behavioralPayloadToTelemetryData } from '@/lib/implicit-metrics';

const baseParams = {
  selectedAnswerIndex: 0,
  questionStartTime: Date.now() - 5000,
  question: {
    id: 'q-1',
    correctAnswerIndex: 0,
    options: ['A', 'B', 'C', 'D'],
  } as any,
  questionNumber: 1,
  behavioralPayload: {
    time_to_first_interaction_ms: 1500,
    duration_ms: 5000,
    answer_change_count: 1,
  },
  microMetrics: {
    oscillations: 2,
    vignetteRegressions: 0,
    selectionDriftMs: 100,
    tremorScore: 0.3,
    cursorEntropy: 0.5,
    inputMethod: 'mouse',
  },
  eliminationTimestamps: [Date.now() - 2000, Date.now() - 1000],
};

describe('computeScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes correct answer', () => {
    const result = computeScore(baseParams);
    expect(result.isCorrect).toBe(true);
    expect(result.questionId).toBe('q-1');
    expect(result.parTime).toBe(30000);
  });

  it('computes incorrect answer', () => {
    const result = computeScore({ ...baseParams, selectedAnswerIndex: 2 });
    expect(result.isCorrect).toBe(false);
  });

  it('derives FSRS rating with behavioral payload', () => {
    computeScore(baseParams);
    expect(deriveFsrsRatingFromBehavior).toHaveBeenCalledWith(
      expect.objectContaining({
        isCorrect: true,
        answerSwitches: 1,
        cursorEntropy: 0.5,
      })
    );
  });

  it('derives FSRS rating without behavioral payload', () => {
    computeScore({ ...baseParams, behavioralPayload: null });
    expect(deriveFsrsRatingFromBehavior).toHaveBeenCalledWith(
      expect.objectContaining({
        isCorrect: true,
        timeToFirstClickMs: null,
        answerSwitches: 0,
      })
    );
  });

  it('computes elimination velocity from timestamps', () => {
    computeScore(baseParams);
    expect(behavioralPayloadToTelemetryData).toHaveBeenCalled();
  });

  it('handles missing question id with temp id', () => {
    const result = computeScore({
      ...baseParams,
      question: { ...baseParams.question, id: undefined },
      questionNumber: 5,
    });
    expect(result.questionId).toBe('temp-5');
  });

  it('enriches telemetry with session position', () => {
    const result = computeScore(baseParams);
    expect(result.telemetryWithPosition).toEqual(
      expect.objectContaining({ position: true })
    );
  });

  it('returns undefined telemetry when no behavioral payload', () => {
    const result = computeScore({ ...baseParams, behavioralPayload: null });
    expect(result.telemetryWithPosition).toBeUndefined();
  });
});
