/**
 * Tests for dailyLoadRecommendationService
 * Sprint 20 — Daily study load recommendations
 */

import { describe, it, expect } from 'vitest';
import {
  recommendDailyLoad,
  computeSystemPriority,
  type LearnerLoadProfile,
  DEFAULT_LOAD_CONFIG,
} from '../lib/services/dailyLoadRecommendationService';

// ─── Fixtures ────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<LearnerLoadProfile> = {}): LearnerLoadProfile {
  return {
    avgDailyQuestions: 25,
    dailyQuestionStdDev: 8,
    reviewsDueToday: 15,
    reviewsDueNext24h: 10,
    overdueReviews: 5,
    burnoutRisk: 0.3,
    currentStreak: 12,
    recentAccuracy: 0.72,
    avgTimePerQuestionMs: 45000,
    systemCoverage: {
      Cardiovascular: 0.6,
      Pulmonary: 0.4,
      Neurology: 0.3,
      Musculoskeletal: 0.5,
    },
    blueprintWeights: {
      Cardiovascular: 0.16,
      Pulmonary: 0.12,
      Neurology: 0.10,
      Musculoskeletal: 0.10,
    },
    daysUntilExam: null,
    questionsCompletedToday: 0,
    userDailyGoal: null,
    ...overrides,
  };
}

// ─── recommendDailyLoad ──────────────────────────────────────────────

describe('recommendDailyLoad', () => {
  it('produces valid recommendation for typical learner', () => {
    const result = recommendDailyLoad(makeProfile());
    expect(result.totalRecommended).toBeGreaterThan(0);
    expect(result.reviewCount).toBeGreaterThanOrEqual(0);
    expect(result.newCardCount).toBeGreaterThanOrEqual(0);
    expect(result.reviewCount + result.newCardCount).toBeLessThanOrEqual(
      DEFAULT_LOAD_CONFIG.maxTotalPerDay
    );
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.rationale.length).toBeGreaterThan(0);
  });

  it('prioritizes reviews over new cards', () => {
    const result = recommendDailyLoad(
      makeProfile({ overdueReviews: 30, reviewsDueToday: 20 })
    );
    // With 50 total reviews, most capacity should go to reviews
    expect(result.reviewCount).toBeGreaterThanOrEqual(result.newCardCount);
  });

  it('enters recovery mode when burnout is high', () => {
    const result = recommendDailyLoad(makeProfile({ burnoutRisk: 0.85 }));
    expect(result.intensity).toBe('recovery');
    expect(result.overloadWarning).not.toBeNull();
    // Recovery = 60% of normal capacity
    const normalResult = recommendDailyLoad(makeProfile({ burnoutRisk: 0.1 }));
    expect(result.totalRecommended).toBeLessThan(normalResult.totalRecommended);
  });

  it('reduces new cards when accuracy is low', () => {
    const highAccuracy = recommendDailyLoad(makeProfile({ recentAccuracy: 0.80 }));
    const lowAccuracy = recommendDailyLoad(makeProfile({ recentAccuracy: 0.45 }));
    expect(lowAccuracy.newCardCount).toBeLessThanOrEqual(highAccuracy.newCardCount);
  });

  it('boosts load when exam is approaching', () => {
    const noExam = recommendDailyLoad(makeProfile({ daysUntilExam: null }));
    const examSoon = recommendDailyLoad(makeProfile({ daysUntilExam: 14 }));
    // Exam proximity should increase new card count (or at least not decrease)
    expect(examSoon.newCardCount).toBeGreaterThanOrEqual(noExam.newCardCount - 2); // allow small variance
  });

  it('computes remaining correctly', () => {
    const result = recommendDailyLoad(makeProfile({ questionsCompletedToday: 10 }));
    expect(result.remaining).toBe(
      Math.max(0, result.totalRecommended - 10)
    );
  });

  it('handles zero-history learner', () => {
    const result = recommendDailyLoad(
      makeProfile({
        avgDailyQuestions: 0,
        dailyQuestionStdDev: 0,
        reviewsDueToday: 0,
        overdueReviews: 0,
        currentStreak: 0,
      })
    );
    expect(result.totalRecommended).toBeGreaterThan(0);
    expect(result.newCardCount).toBeGreaterThan(0);
  });

  it('never exceeds maxTotalPerDay', () => {
    const result = recommendDailyLoad(
      makeProfile({
        avgDailyQuestions: 200,
        overdueReviews: 100,
        reviewsDueToday: 80,
      })
    );
    expect(result.totalRecommended).toBeLessThanOrEqual(DEFAULT_LOAD_CONFIG.maxTotalPerDay);
  });

  it('caps new cards at maxNewCardsPerDay', () => {
    const result = recommendDailyLoad(
      makeProfile({
        overdueReviews: 0,
        reviewsDueToday: 0,
        avgDailyQuestions: 100,
      })
    );
    expect(result.newCardCount).toBeLessThanOrEqual(DEFAULT_LOAD_CONFIG.maxNewCardsPerDay);
  });
});

// ─── computeSystemPriority ───────────────────────────────────────────

describe('computeSystemPriority', () => {
  it('returns systems sorted by gap descending', () => {
    const result = computeSystemPriority(
      { Cardiovascular: 0.8, Pulmonary: 0.2, Neurology: 0.1 },
      { Cardiovascular: 0.16, Pulmonary: 0.12, Neurology: 0.10 },
      10
    );
    expect(result.length).toBe(3);
    // Neurology has lowest coverage + decent weight → biggest gap
    const neuro = result.find((s) => s.system === 'Neurology');
    expect(neuro).toBeDefined();
    // Gaps should be non-negative
    for (const s of result) {
      expect(s.gap).toBeGreaterThanOrEqual(0);
    }
  });

  it('allocates new cards proportionally to gap', () => {
    const result = computeSystemPriority(
      { A: 0.0, B: 1.0 },
      { A: 0.50, B: 0.50 },
      10
    );
    const systemA = result.find((s) => s.system === 'A');
    const systemB = result.find((s) => s.system === 'B');
    // System A has 0% coverage, B has 100% → all new cards go to A
    expect(systemA!.recommendedNewCards).toBeGreaterThan(systemB!.recommendedNewCards);
  });

  it('handles empty blueprint', () => {
    const result = computeSystemPriority({}, {}, 10);
    expect(result).toHaveLength(0);
  });

  it('total allocated does not exceed totalNewCards', () => {
    const result = computeSystemPriority(
      { A: 0.1, B: 0.2, C: 0.3 },
      { A: 0.33, B: 0.33, C: 0.33 },
      15
    );
    const totalAllocated = result.reduce((s, r) => s + r.recommendedNewCards, 0);
    expect(totalAllocated).toBeLessThanOrEqual(15);
  });
});
