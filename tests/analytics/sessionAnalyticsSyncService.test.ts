// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/domain/panceDistributionService', () => ({
  getSessionSummary: vi.fn(() => ({
    distributionScore: 84,
    systemBreakdown: {
      Cardiovascular: 3,
      Pulmonary: 2,
    },
  })),
  calculateDistributionDrift: vi.fn(() => 0),
}));

vi.mock('../../services/analytics/answerPatternService', () => ({
  analyzePatterns: vi.fn(() => ({
    avgStreakLength: 2.5,
    totalChanges: 1,
    changedToCorrect: 1,
    changedToWrong: 0,
    firstInstinctAccuracy: 70,
    recentIncorrectTopics: ['Cardiovascular'],
  })),
}));

vi.mock('../../services/analytics/behavioralConfidenceService', () => ({
  calculateBehavioralCalibration: vi.fn(() => ({
    high: { accuracy: 90 },
    low: { accuracy: 55 },
    calibrationScore: 0.72,
  })),
  getBehavioralInsights: vi.fn(() => ({
    early10Accuracy: 80,
    late10Accuracy: 70,
    staminaFade: 10,
    rushQuestions: [{ isCorrect: true }, { isCorrect: false }],
    deliberateQuestions: [{ isCorrect: true }],
  })),
}));

vi.mock('../../services/analytics/sessionMomentumService', () => ({
  getMomentumInsights: vi.fn(() => ({
    peakMomentum: 0.9,
    avgMomentum: 0.65,
    currentLevel: 'steady',
  })),
}));

vi.mock('../../services/analytics/performancePredictionService', () => ({
  getPrediction: vi.fn(() => ({
    predictedScore: 512,
    confidence: 'medium',
    passLikelihood: 78,
  })),
  getConfidenceInterval: vi.fn(() => ({ low: 500, high: 524 })),
}));

vi.mock('../../lib/simple-logger', () => ({
  logger: {
    scope: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { collectSessionAnalytics } from '../../services/analytics/sessionAnalyticsSyncService';

describe('collectSessionAnalytics', () => {
  const fixedNow = new Date('2026-04-16T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves a provided sessionId when syncing a generated session', () => {
    const payload = collectSessionAnalytics({
      sessionId: 'session-generated-123',
      sessionStartTime: fixedNow - 120000,
      totalQuestions: 10,
      correctAnswers: 8,
      bestStreak: 4,
      finalStreak: 2,
      mode: 'adaptive',
      focus: 'growth',
      difficulty: 'same',
    });

    expect(payload.sessionId).toBe('session-generated-123');
    expect(payload.totalTimeMs).toBe(120000);
    expect(payload.systemsCovered).toEqual(['Cardiovascular', 'Pulmonary']);
    expect(payload.mode).toBe('adaptive');
  });

  it('generates a fallback sessionId only when none is provided', () => {
    const payload = collectSessionAnalytics({
      sessionStartTime: fixedNow - 30000,
      totalQuestions: 4,
      correctAnswers: 3,
      bestStreak: 2,
      finalStreak: 1,
      mode: 'review',
      focus: 'review',
      difficulty: 'same',
    });

    expect(payload.sessionId).toMatch(/^session_/);
    expect(payload.correctAnswers).toBe(3);
    expect(payload.accuracy).toBe(75);
  });
});
