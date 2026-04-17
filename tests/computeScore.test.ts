/**
 * Tests for lib/scoring/computeScore.ts
 *
 * Verifies score computation, FSRS rating derivation, and telemetry assembly.
 * Mocks heavy dependencies (behavioral tracking, par time calculation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the module
vi.mock('@/lib/utils/fsrsImplicitRating', () => ({
  deriveFsrsRatingFromBehavior: vi.fn(),
}));
vi.mock('@/lib/utils/questionComplexity', () => ({
  calculateParTime: vi.fn(() => 15000),
}));
vi.mock('@/components/quiz/Tracker', () => ({
  behavioralPayloadToTelemetryData: vi.fn(),
  enrichTelemetryWithSessionPosition: vi.fn(),
}));

import { computeScore } from '@/lib/scoring/computeScore';
import { deriveFsrsRatingFromBehavior } from '@/lib/utils/fsrsImplicitRating';
import { behavioralPayloadToTelemetryData, enrichTelemetryWithSessionPosition } from '@/components/quiz/Tracker';

const mockDeriveRating = vi.mocked(deriveFsrsRatingFromBehavior);
const mockBehavioralToTelemetry = vi.mocked(behavioralPayloadToTelemetryData);
const mockEnrichPosition = vi.mocked(enrichTelemetryWithSessionPosition);

const makeQuestion = (overrides?: Record<string, unknown>) => ({
  id: 'q-123',
  correctAnswerIndex: 2,
  options: ['A', 'B', 'C', 'D'],
  questionFormat: 'MCQ',
  ...overrides,
});

const makeMicroMetrics = (overrides?: Record<string, unknown>) => ({
  oscillations: 0,
  vignetteRegressions: 0,
  selectionDriftMs: null,
  tremorScore: 0,
  cursorEntropy: 0,
  inputMethod: 'mouse' as const,
  ...overrides,
});

describe('computeScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeriveRating.mockReturnValue(3); // Good rating
    mockBehavioralToTelemetry.mockReturnValue({
      timeToFirstClick: 2000,
      answerSwitches: 0,
      totalDwellTime: 8000,
    });
    mockEnrichPosition.mockReturnValue({
      timeToFirstClick: 2000,
      answerSwitches: 0,
      totalDwellTime: 8000,
      questionPosition: 5,
    });
  });

  it('returns correct isCorrect for matching answer index', () => {
    const result = computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: Date.now() - 8000,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.isCorrect).toBe(true);
  });

  it('returns incorrect for wrong answer index', () => {
    const result = computeScore({
      selectedAnswerIndex: 0,
      questionStartTime: Date.now() - 8000,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.isCorrect).toBe(false);
  });

  it('uses temp ID when question has no id', () => {
    const result = computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: Date.now() - 5000,
      question: makeQuestion({ id: undefined }),
      questionNumber: 7,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.questionId).toBe('temp-7');
  });

  it('derives FSRS rating from behavioral payload when provided', () => {
    const payload = {
      time_to_first_interaction_ms: 2000,
      duration_ms: 8000,
      answer_change_count: 1,
    };

    computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: Date.now() - 8000,
      question: makeQuestion(),
      questionNumber: 3,
      behavioralPayload: payload,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(mockDeriveRating).toHaveBeenCalledWith(
      expect.objectContaining({
        timeToFirstClickMs: 2000,
        totalDwellTimeMs: 8000,
        answerSwitches: 1,
        parTimeMs: 15000,
        cursorEntropy: 0,
        hoverOscillations: 0,
        vignetteRegressions: 0,
        selectionDriftMs: null,
        tremorScore: 0,
      }),
    );
  });

  it('derives FSRS rating with nulls when no behavioral payload', () => {
    computeScore({
      selectedAnswerIndex: 0,
      questionStartTime: Date.now() - 3000,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(mockDeriveRating).toHaveBeenCalledWith(
      expect.objectContaining({
        timeToFirstClickMs: null,
        totalDwellTimeMs: expect.any(Number),
        answerSwitches: 0,
      }),
    );
  });

  it('builds telemetry when behavioral payload is provided', () => {
    const payload = {
      time_to_first_interaction_ms: 1500,
      duration_ms: 5000,
      answer_change_count: 0,
    };

    const result = computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: Date.now() - 5000,
      question: makeQuestion(),
      questionNumber: 4,
      behavioralPayload: payload,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(mockBehavioralToTelemetry).toHaveBeenCalledWith(
      payload,
      0,
      false,
      expect.any(Object),
      undefined,
    );
    expect(mockEnrichPosition).toHaveBeenCalled();
    expect(result.telemetryWithPosition).toBeDefined();
  });

  it('returns undefined telemetry when no behavioral payload', () => {
    const result = computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: Date.now() - 5000,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.telemetryWithPosition).toBeUndefined();
  });

  it('returns positive timeToAnswer', () => {
    const startTime = Date.now() - 5000;
    const result = computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: startTime,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.timeToAnswer).toBeGreaterThanOrEqual(4900);
    expect(result.timeToAnswer).toBeLessThanOrEqual(10000);
  });

  it('returns parTime from calculateParTime', () => {
    const result = computeScore({
      selectedAnswerIndex: 2,
      questionStartTime: Date.now() - 5000,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.parTime).toBe(15000);
  });

  it('returns fsrsRating from deriveFsrsRatingFromBehavior', () => {
    mockDeriveRating.mockReturnValue(1); // Again rating

    const result = computeScore({
      selectedAnswerIndex: 0,
      questionStartTime: Date.now() - 2000,
      question: makeQuestion(),
      questionNumber: 1,
      behavioralPayload: null,
      microMetrics: makeMicroMetrics(),
      eliminationTimestamps: [],
    });

    expect(result.fsrsRating).toBe(1);
  });
});
