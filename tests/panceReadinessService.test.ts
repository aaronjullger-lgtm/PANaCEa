/**
 * PANCE Readiness Score Service — Unit Tests (Tier 2, Feature 4)
 *
 * Tests the blueprint-weighted composite readiness heuristic:
 * per-system scoring, consistency modifiers, tier classification,
 * score range estimation, and overall composition.
 */

import { describe, it, expect } from 'vitest';
import {
  computePanceReadiness,
  DEFAULT_READINESS_CONFIG,
  TIER_THRESHOLDS,
  PANCE_SCORE_MAPPING,
  type SystemMetrics,
  type ConsistencyMetrics,
} from '../lib/services/panceReadinessService';

// ─── Helpers ────────────────────────────────────────────────────

function makeSystemMetrics(overrides: Partial<SystemMetrics> & { system: string }): SystemMetrics {
  return {
    totalAttempts: 50,
    correctAnswers: 40,
    recentAccuracy: 0.80,
    matureCardFraction: 0.60,
    meanRetrievability: 0.85,
    meanDifficulty: 5.0,
    recentLapses: 3,
    cardsReviewed: 50,
    cardsAvailable: 100,
    ...overrides,
  };
}

const goodConsistency: ConsistencyMetrics = {
  activeDaysLast14: 10,
  sessionsLast14: 14,
  avgSessionMinutes: 25,
  sessionTrend: 0.2,
};

const poorConsistency: ConsistencyMetrics = {
  activeDaysLast14: 2,
  sessionsLast14: 3,
  avgSessionMinutes: 10,
  sessionTrend: -0.3,
};

const neutralConsistency: ConsistencyMetrics = {
  activeDaysLast14: 5,
  sessionsLast14: 7,
  avgSessionMinutes: 15,
  sessionTrend: 0,
};

// ─── computePanceReadiness ──────────────────────────────────────

describe('computePanceReadiness', () => {
  it('returns a result with required fields', () => {
    const metrics = [makeSystemMetrics({ system: 'Cardiovascular' })];
    const result = computePanceReadiness(metrics, neutralConsistency);

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.readinessLevel).toBeDefined();
    expect(result.systemBreakdown.length).toBeGreaterThan(0);
    expect(result.disclaimer).toContain('not a prediction');
    expect(result.computedAt).toBeDefined();
    expect(result.estimatedScoreRange.low).toBeGreaterThanOrEqual(300);
    expect(result.estimatedScoreRange.high).toBeLessThanOrEqual(800);
  });

  it('handles empty metrics (no study data)', () => {
    const result = computePanceReadiness([], neutralConsistency);
    expect(result.overallScore).toBeLessThanOrEqual(10); // Only consistency modifier possible
    expect(result.readinessLevel).toBe('critical');
    // All systems should be listed as critical (from blueprint)
    expect(result.criticalSystems.length).toBeGreaterThan(0);
  });

  it('weights systems by blueprint percentage', () => {
    // Cardiovascular (11%) strong, Dermatology (5%) weak
    const metrics = [
      makeSystemMetrics({ system: 'Cardiovascular', recentAccuracy: 0.90, matureCardFraction: 0.80 }),
      makeSystemMetrics({ system: 'Dermatology', totalAttempts: 5, correctAnswers: 1, recentAccuracy: 0.20, matureCardFraction: 0.10, cardsReviewed: 5 }),
    ];
    const result = computePanceReadiness(metrics, neutralConsistency);

    const cvBreakdown = result.systemBreakdown.find(s => s.system === 'Cardiovascular')!;
    const dermBreakdown = result.systemBreakdown.find(s => s.system === 'Dermatology')!;

    // CV should contribute more to overall score due to higher blueprint weight
    expect(cvBreakdown.weightedContribution).toBeGreaterThan(dermBreakdown.weightedContribution);
  });

  it('includes all blueprint systems even if not studied', () => {
    const metrics = [makeSystemMetrics({ system: 'Cardiovascular' })];
    const result = computePanceReadiness(metrics, neutralConsistency);

    // Should have entries for all 16 blueprint systems
    expect(result.systemBreakdown.length).toBe(16);

    // Unstudied systems should be critical
    const pulm = result.systemBreakdown.find(s => s.system === 'Pulmonary')!;
    expect(pulm.compositeScore).toBe(0);
    expect(pulm.readinessTier).toBe('critical');
  });

  it('always includes the disclaimer', () => {
    const result = computePanceReadiness([], neutralConsistency);
    expect(result.disclaimer.length).toBeGreaterThan(50);
    expect(result.disclaimer).toContain('not a prediction');
  });
});

// ─── Tier classification ────────────────────────────────────────

describe('tier classification', () => {
  it('classifies high-performing students as exam_ready', () => {
    // All systems at high performance
    const metrics = Object.keys(TIER_THRESHOLDS).length > 0
      ? [
          makeSystemMetrics({ system: 'Cardiovascular', recentAccuracy: 0.95, matureCardFraction: 0.90, meanRetrievability: 0.95, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Pulmonary', recentAccuracy: 0.90, matureCardFraction: 0.85, meanRetrievability: 0.90, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Gastrointestinal', recentAccuracy: 0.90, matureCardFraction: 0.85, meanRetrievability: 0.90, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Musculoskeletal', recentAccuracy: 0.88, matureCardFraction: 0.80, meanRetrievability: 0.88, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'HEENT', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Reproductive', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Neurological', recentAccuracy: 0.88, matureCardFraction: 0.80, meanRetrievability: 0.88, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Psychiatry', recentAccuracy: 0.88, matureCardFraction: 0.80, meanRetrievability: 0.88, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Endocrine', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Dermatology', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Genitourinary', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Hematology', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Infectious Disease', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Nephrology', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'Emergency Medicine', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
          makeSystemMetrics({ system: 'General', recentAccuracy: 0.85, matureCardFraction: 0.80, meanRetrievability: 0.85, cardsReviewed: 80 }),
        ]
      : [];
    const result = computePanceReadiness(metrics, goodConsistency);
    expect(result.readinessLevel).toBe('exam_ready');
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
  });

  it('classifies beginners as critical', () => {
    const result = computePanceReadiness([], poorConsistency);
    expect(result.readinessLevel).toBe('critical');
  });
});

// ─── Consistency modifier ───────────────────────────────────────

describe('consistency modifier', () => {
  it('good consistency adds positive modifier', () => {
    const metrics = [makeSystemMetrics({ system: 'Cardiovascular' })];
    const result = computePanceReadiness(metrics, goodConsistency);
    expect(result.consistencyModifier).toBeGreaterThan(0);
  });

  it('poor consistency subtracts from score', () => {
    const metrics = [makeSystemMetrics({ system: 'Cardiovascular' })];
    const result = computePanceReadiness(metrics, poorConsistency);
    expect(result.consistencyModifier).toBeLessThan(0);
  });

  it('modifier is clamped to [-10, +10]', () => {
    const metrics = [makeSystemMetrics({ system: 'Cardiovascular' })];
    const goodResult = computePanceReadiness(metrics, goodConsistency);
    const poorResult = computePanceReadiness(metrics, poorConsistency);
    expect(goodResult.consistencyModifier).toBeLessThanOrEqual(10);
    expect(poorResult.consistencyModifier).toBeGreaterThanOrEqual(-10);
  });
});

// ─── Per-system scoring ─────────────────────────────────────────

describe('per-system scoring', () => {
  it('gives higher accuracy score to higher-accuracy systems', () => {
    const high = makeSystemMetrics({ system: 'Cardiovascular', recentAccuracy: 0.90 });
    const low = makeSystemMetrics({ system: 'Pulmonary', recentAccuracy: 0.50 });
    const result = computePanceReadiness([high, low], neutralConsistency);

    const cvScore = result.systemBreakdown.find(s => s.system === 'Cardiovascular')!;
    const pulmScore = result.systemBreakdown.find(s => s.system === 'Pulmonary')!;
    expect(cvScore.accuracyScore).toBeGreaterThan(pulmScore.accuracyScore);
  });

  it('gives higher stability score to systems with more mature cards', () => {
    const mature = makeSystemMetrics({ system: 'Cardiovascular', matureCardFraction: 0.90 });
    const fresh = makeSystemMetrics({ system: 'Pulmonary', matureCardFraction: 0.10 });
    const result = computePanceReadiness([mature, fresh], neutralConsistency);

    const cvScore = result.systemBreakdown.find(s => s.system === 'Cardiovascular')!;
    const pulmScore = result.systemBreakdown.find(s => s.system === 'Pulmonary')!;
    expect(cvScore.stabilityScore).toBeGreaterThan(pulmScore.stabilityScore);
  });

  it('penalizes systems with high lapse rates', () => {
    const stable = makeSystemMetrics({ system: 'Cardiovascular', recentLapses: 1 });
    const lapsing = makeSystemMetrics({ system: 'Pulmonary', recentLapses: 20 });
    const result = computePanceReadiness([stable, lapsing], neutralConsistency);

    const cvScore = result.systemBreakdown.find(s => s.system === 'Cardiovascular')!;
    const pulmScore = result.systemBreakdown.find(s => s.system === 'Pulmonary')!;
    expect(pulmScore.lapsePenalty).toBeGreaterThan(cvScore.lapsePenalty);
  });

  it('applies confidence penalty for insufficient attempts', () => {
    const fewAttempts = makeSystemMetrics({ system: 'Cardiovascular', totalAttempts: 5, correctAnswers: 4, recentAccuracy: null });
    const manyAttempts = makeSystemMetrics({ system: 'Pulmonary', totalAttempts: 50, correctAnswers: 40, recentAccuracy: 0.80 });
    const result = computePanceReadiness([fewAttempts, manyAttempts], neutralConsistency);

    const cvScore = result.systemBreakdown.find(s => s.system === 'Cardiovascular')!;
    const pulmScore = result.systemBreakdown.find(s => s.system === 'Pulmonary')!;
    // Few attempts should get penalized accuracy
    expect(cvScore.accuracyScore).toBeLessThan(pulmScore.accuracyScore);
  });
});

// ─── Score range estimation ─────────────────────────────────────

describe('score range estimation', () => {
  it('maps to valid PANCE range (300-800)', () => {
    const result = computePanceReadiness([], neutralConsistency);
    expect(result.estimatedScoreRange.low).toBeGreaterThanOrEqual(300);
    expect(result.estimatedScoreRange.high).toBeLessThanOrEqual(800);
    expect(result.estimatedScoreRange.low).toBeLessThan(result.estimatedScoreRange.high);
  });

  it('higher readiness maps to higher estimated score', () => {
    const weak = computePanceReadiness([], poorConsistency);
    const strong = computePanceReadiness(
      [makeSystemMetrics({ system: 'Cardiovascular', recentAccuracy: 0.95, matureCardFraction: 0.90 })],
      goodConsistency
    );
    expect(strong.estimatedScoreRange.low).toBeGreaterThan(weak.estimatedScoreRange.low);
  });
});

// ─── Critical/exam-ready systems ────────────────────────────────

describe('critical and exam-ready systems', () => {
  it('identifies critical systems', () => {
    const result = computePanceReadiness([], neutralConsistency);
    // All systems should be critical when no data
    expect(result.criticalSystems.length).toBe(16);
  });

  it('identifies exam-ready systems', () => {
    const strong = makeSystemMetrics({
      system: 'Cardiovascular',
      recentAccuracy: 0.95,
      matureCardFraction: 0.90,
      meanRetrievability: 0.95,
      cardsReviewed: 80,
      recentLapses: 0,
    });
    const result = computePanceReadiness([strong], goodConsistency);
    expect(result.examReadySystems).toContain('Cardiovascular');
  });
});

// ─── Configuration defaults ─────────────────────────────────────

describe('configuration defaults', () => {
  it('has weights summing to 1.0', () => {
    const cfg = DEFAULT_READINESS_CONFIG;
    const weightSum = cfg.accuracyWeight + cfg.stabilityWeight +
                      cfg.coverageWeight + cfg.retrievabilityWeight;
    expect(weightSum).toBeCloseTo(1.0, 2);
  });

  it('has valid PANCE score mapping', () => {
    expect(PANCE_SCORE_MAPPING.minScore).toBe(300);
    expect(PANCE_SCORE_MAPPING.maxScore).toBe(800);
    expect(PANCE_SCORE_MAPPING.passingScore).toBeGreaterThan(PANCE_SCORE_MAPPING.minScore);
    expect(PANCE_SCORE_MAPPING.passingScore).toBeLessThan(PANCE_SCORE_MAPPING.maxScore);
  });
});
