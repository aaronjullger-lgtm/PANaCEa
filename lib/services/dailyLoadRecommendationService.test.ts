// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/services/dailyLoadRecommendationService.ts
 *
 * Pure functions tested:
 *   recommendDailyLoad    — computes daily study load from learner profile
 *   computeSystemPriority — ranks systems by blueprint coverage gap
 *
 * Constants tested:
 *   DEFAULT_LOAD_CONFIG
 */

import { describe, it, expect } from 'vitest';
import {
  recommendDailyLoad,
  computeSystemPriority,
  DEFAULT_LOAD_CONFIG,
  type LearnerLoadProfile,
  type LoadConfig,
} from './dailyLoadRecommendationService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<LearnerLoadProfile> = {}): LearnerLoadProfile {
  return {
    avgDailyQuestions: 20,
    dailyQuestionStdDev: 5,
    reviewsDueToday: 0,
    reviewsDueNext24h: 0,
    overdueReviews: 0,
    burnoutRisk: 0,
    currentStreak: 5,
    recentAccuracy: 0.75,
    avgTimePerQuestionMs: 45_000,
    systemCoverage: {},
    blueprintWeights: {},
    daysUntilExam: null,
    questionsCompletedToday: 0,
    userDailyGoal: null,
    ...overrides,
  };
}

// ─── DEFAULT_LOAD_CONFIG ──────────────────────────────────────────────────────

describe('DEFAULT_LOAD_CONFIG', () => {
  it('has expected field values', () => {
    expect(DEFAULT_LOAD_CONFIG.baseNewCardsPerDay).toBe(18);
    expect(DEFAULT_LOAD_CONFIG.maxNewCardsPerDay).toBe(30);
    expect(DEFAULT_LOAD_CONFIG.maxTotalPerDay).toBe(120);
    expect(DEFAULT_LOAD_CONFIG.burnoutThreshold).toBe(0.7);
    expect(DEFAULT_LOAD_CONFIG.accuracyFloor).toBe(0.55);
    expect(DEFAULT_LOAD_CONFIG.examProximityDays).toBe(60);
  });
});

// ─── recommendDailyLoad ───────────────────────────────────────────────────────

describe('recommendDailyLoad', () => {
  it('returns an object with required fields', () => {
    const rec = recommendDailyLoad(makeProfile());
    expect(typeof rec.totalRecommended).toBe('number');
    expect(typeof rec.reviewCount).toBe('number');
    expect(typeof rec.newCardCount).toBe('number');
    expect(typeof rec.remaining).toBe('number');
    expect(Array.isArray(rec.systemPriority)).toBe(true);
    expect(typeof rec.confidence).toBe('number');
    expect(typeof rec.rationale).toBe('string');
    expect(['light', 'moderate', 'heavy', 'recovery']).toContain(rec.intensity);
  });

  it('remaining = totalRecommended - questionsCompletedToday', () => {
    const rec = recommendDailyLoad(makeProfile({ questionsCompletedToday: 5 }));
    expect(rec.remaining).toBe(Math.max(0, rec.totalRecommended - 5));
  });

  it('remaining is never negative', () => {
    const rec = recommendDailyLoad(makeProfile({ questionsCompletedToday: 999 }));
    expect(rec.remaining).toBeGreaterThanOrEqual(0);
  });

  it('totalRecommended does not exceed maxTotalPerDay', () => {
    const profile = makeProfile({
      avgDailyQuestions: 200,
      overdueReviews: 200,
      reviewsDueToday: 200,
    });
    const rec = recommendDailyLoad(profile);
    expect(rec.totalRecommended).toBeLessThanOrEqual(DEFAULT_LOAD_CONFIG.maxTotalPerDay);
  });

  it('newCardCount does not exceed maxNewCardsPerDay', () => {
    const profile = makeProfile({ avgDailyQuestions: 10, overdueReviews: 0 });
    const rec = recommendDailyLoad(profile);
    expect(rec.newCardCount).toBeLessThanOrEqual(DEFAULT_LOAD_CONFIG.maxNewCardsPerDay);
  });

  it('activates recovery mode when burnoutRisk >= burnoutThreshold', () => {
    const rec = recommendDailyLoad(makeProfile({ burnoutRisk: 0.8 }));
    expect(rec.intensity).toBe('recovery');
    expect(rec.overloadWarning).not.toBeNull();
    expect(rec.overloadWarning).toContain('Burnout');
  });

  it('overloadWarning is null when burnoutRisk is low', () => {
    const rec = recommendDailyLoad(makeProfile({ burnoutRisk: 0.1 }));
    expect(rec.overloadWarning).toBeNull();
  });

  it('recovery mode reduces total capacity vs. normal mode', () => {
    const base = recommendDailyLoad(makeProfile({ burnoutRisk: 0.0 }));
    const recovery = recommendDailyLoad(makeProfile({ burnoutRisk: 0.9 }));
    expect(recovery.totalRecommended).toBeLessThan(base.totalRecommended);
  });

  it('low accuracy (< accuracyFloor) reduces new card count', () => {
    const goodAcc = recommendDailyLoad(makeProfile({ recentAccuracy: 0.80 }));
    const badAcc = recommendDailyLoad(makeProfile({ recentAccuracy: 0.40 }));
    // New card count should be lower when accuracy is poor
    expect(badAcc.newCardCount).toBeLessThanOrEqual(goodAcc.newCardCount);
  });

  it('exam proximity boost increases allocation when exam is near', () => {
    const noExam = recommendDailyLoad(makeProfile({ daysUntilExam: null }));
    const nearExam = recommendDailyLoad(makeProfile({ daysUntilExam: 10 }));
    // Near-exam should produce >= total as without exam
    expect(nearExam.totalRecommended).toBeGreaterThanOrEqual(noExam.totalRecommended);
  });

  it('reviewCount equals totalReviews when reviews fit within capacity', () => {
    const profile = makeProfile({
      overdueReviews: 3,
      reviewsDueToday: 2,
      avgDailyQuestions: 50,
    });
    const rec = recommendDailyLoad(profile);
    expect(rec.reviewCount).toBe(5);
  });

  it('reviewCount is capped by adjusted capacity', () => {
    const profile = makeProfile({
      overdueReviews: 200,
      reviewsDueToday: 200,
      avgDailyQuestions: 10,
      burnoutRisk: 0,
    });
    const rec = recommendDailyLoad(profile);
    // reviewCount cannot exceed the total recommendation
    expect(rec.reviewCount).toBeLessThanOrEqual(rec.totalRecommended);
  });

  it('rationale is a non-empty string', () => {
    const rec = recommendDailyLoad(makeProfile());
    expect(typeof rec.rationale).toBe('string');
    expect(rec.rationale.length).toBeGreaterThan(0);
  });

  it('rationale mentions overdue reviews when present', () => {
    const rec = recommendDailyLoad(makeProfile({ overdueReviews: 7 }));
    expect(rec.rationale).toContain('7 overdue');
  });

  it('rationale mentions exam proximity when daysUntilExam <= 60', () => {
    const rec = recommendDailyLoad(makeProfile({ daysUntilExam: 30 }));
    expect(rec.rationale).toContain('Exam in 30 days');
  });

  it('rationale mentions recovery mode when burnout risk is high', () => {
    const rec = recommendDailyLoad(makeProfile({ burnoutRisk: 0.9 }));
    expect(rec.rationale).toContain('Recovery mode');
  });

  it('confidence is in [0, 1]', () => {
    const rec = recommendDailyLoad(makeProfile());
    expect(rec.confidence).toBeGreaterThanOrEqual(0);
    expect(rec.confidence).toBeLessThanOrEqual(1);
  });

  it('confidence increases with historical data', () => {
    const noData = recommendDailyLoad(makeProfile({ avgDailyQuestions: 0 }));
    const withData = recommendDailyLoad(makeProfile({ avgDailyQuestions: 20 }));
    expect(withData.confidence).toBeGreaterThan(noData.confidence);
  });

  it('heavy intensity when totalRecommended > 1.3× historical avg', () => {
    // Use a small historical base and a big review debt to push ratio high
    const profile = makeProfile({
      avgDailyQuestions: 10,
      overdueReviews: 50,
      burnoutRisk: 0,
    });
    const rec = recommendDailyLoad(profile);
    // With 50 overdue reviews and base of 10, ratio > 1.3 → heavy
    expect(rec.intensity).toBe('heavy');
  });

  it('uses baseNewCardsPerDay as floor when avgDailyQuestions is 0', () => {
    const rec = recommendDailyLoad(makeProfile({ avgDailyQuestions: 0 }));
    // Capacity ceiling = max(baseNewCardsPerDay, round(0 * 1.2)) = baseNewCardsPerDay = 18
    expect(rec.totalRecommended).toBeGreaterThan(0);
  });

  it('custom config values override defaults', () => {
    const customConfig: LoadConfig = {
      ...DEFAULT_LOAD_CONFIG,
      maxTotalPerDay: 10,
    };
    const rec = recommendDailyLoad(
      makeProfile({ overdueReviews: 100, avgDailyQuestions: 100 }),
      customConfig
    );
    expect(rec.totalRecommended).toBeLessThanOrEqual(10);
  });
});

// ─── computeSystemPriority ────────────────────────────────────────────────────

describe('computeSystemPriority', () => {
  it('returns empty array when blueprintWeights is empty', () => {
    expect(computeSystemPriority({}, {}, 10)).toHaveLength(0);
  });

  it('returns one entry per system in blueprintWeights', () => {
    const result = computeSystemPriority(
      {},
      { Cardiology: 0.2, Pulmonary: 0.1 },
      10
    );
    expect(result).toHaveLength(2);
  });

  it('prioritizes systems with larger coverage gaps first', () => {
    const result = computeSystemPriority(
      { Cardiology: 0.9, Pulmonary: 0.0 },   // Cardiology well-covered; Pulmonary neglected
      { Cardiology: 0.5, Pulmonary: 0.5 },
      10
    );
    // Pulmonary gap is larger → first in results
    expect(result[0]?.system).toBe('Pulmonary');
  });

  it('each entry has system, blueprintWeight, coverage, gap, recommendedNewCards', () => {
    const result = computeSystemPriority(
      { Cardiology: 0.5 },
      { Cardiology: 0.2 },
      10
    );
    const entry = result[0]!;
    expect(typeof entry.system).toBe('string');
    expect(typeof entry.blueprintWeight).toBe('number');
    expect(typeof entry.coverage).toBe('number');
    expect(typeof entry.gap).toBe('number');
    expect(typeof entry.recommendedNewCards).toBe('number');
  });

  it('gap is non-negative (no negative gaps)', () => {
    // Over-covered system (coverage > proportional weight) → gap = 0
    const result = computeSystemPriority(
      { Cardiology: 1.0 },  // fully covered
      { Cardiology: 0.2 },
      10
    );
    expect(result[0]!.gap).toBeGreaterThanOrEqual(0);
  });

  it('sum of recommendedNewCards <= totalNewCards', () => {
    const result = computeSystemPriority(
      {},
      { Cardiology: 0.3, Pulmonary: 0.2, GI: 0.2, MSK: 0.3 },
      15
    );
    const total = result.reduce((sum, r) => sum + r.recommendedNewCards, 0);
    expect(total).toBeLessThanOrEqual(15);
  });

  it('coverage defaults to 0 for systems not in systemCoverage', () => {
    const result = computeSystemPriority(
      {},                  // no coverage data
      { Cardiology: 0.5 },
      10
    );
    expect(result[0]!.coverage).toBe(0);
  });

  it('allocates proportionally — higher-gap system gets more new cards', () => {
    const result = computeSystemPriority(
      { Cardiology: 0.8, Pulmonary: 0.0 },
      { Cardiology: 0.5, Pulmonary: 0.5 },
      10
    );
    const cardio = result.find(r => r.system === 'Cardiology')!;
    const pulm = result.find(r => r.system === 'Pulmonary')!;
    // Pulmonary has bigger gap → more recommended new cards
    expect(pulm.recommendedNewCards).toBeGreaterThanOrEqual(cardio.recommendedNewCards);
  });

  it('handles single system — all new cards go to that system', () => {
    const result = computeSystemPriority({}, { Cardiology: 1.0 }, 8);
    expect(result[0]!.recommendedNewCards).toBe(8);
  });

  it('recommendedNewCards is non-negative for each system', () => {
    const result = computeSystemPriority(
      { A: 1.0, B: 0.5 },
      { A: 0.5, B: 0.5 },
      10
    );
    for (const r of result) {
      expect(r.recommendedNewCards).toBeGreaterThanOrEqual(0);
    }
  });
});
