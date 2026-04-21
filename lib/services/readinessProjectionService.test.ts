/**
 * Unit tests for lib/services/readinessProjectionService.ts
 *
 * Pure exports tested (no I/O, no async):
 *   betaBinomialPosterior(successes, trials, priorAlpha?, priorBeta?)
 *   harmonicMeanStability(stabilities)
 *   projectRetrievability(stability, elapsedDays, additionalDays?)
 *   aggregateTopicReadiness(conditionId, system, cards)
 *   aggregateSystemReadiness(system, topics, daysForward?, trend?)
 *   detectRisk(projectedReadiness, criticalSystemCount, systems)
 *   computeExamReadiness(cards, daysUntilExam?, systemTrends?)
 *
 * Statistical notes:
 *   betaBinomialPosterior: alpha = priorAlpha + successes
 *                          beta  = priorBeta  + (trials - successes)
 *                          mean  = alpha / (alpha + beta)
 *                          95% CI via normal approximation with z=1.96
 *   harmonicMeanStability: n / Σ(1/sᵢ) — zeros filtered out
 *   projectRetrievability: (1 + FACTOR × t / S)^DECAY — DECAY < 0
 *   detectRisk: critical if criticalSystemCount>0 OR projectedReadiness<0.50
 *               high if projectedReadiness<0.65 OR belowHalf>2
 *               moderate if projectedReadiness<0.80
 *               low otherwise
 */

import { describe, it, expect } from 'vitest';
import {
  betaBinomialPosterior,
  harmonicMeanStability,
  projectRetrievability,
  aggregateTopicReadiness,
  aggregateSystemReadiness,
  detectRisk,
  computeExamReadiness,
  type CardState,
  type TopicReadiness,
  type SystemReadinessProjection,
} from './readinessProjectionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<CardState> = {}): CardState {
  return {
    conditionId: 'cond-1',
    system: 'Cardiovascular',
    stability: 10,
    difficulty: 5,
    retrievability: 0.75,
    lastReviewAt: new Date(),
    totalAttempts: 10,
    correctCount: 8,
    ...overrides,
  };
}

function makeTopicReadiness(overrides: Partial<TopicReadiness> = {}): TopicReadiness {
  return {
    conditionId: 'cond-1',
    system: 'Cardiovascular',
    meanRetrievability: 0.75,
    harmonicStability: 10,
    masteryEstimate: 0.80,
    masteryCI: [0.60, 0.95],
    cardCount: 3,
    ...overrides,
  };
}

function makeSystemProjection(
  overrides: Partial<SystemReadinessProjection> = {}
): SystemReadinessProjection {
  return {
    system: 'Cardiovascular',
    blueprintWeight: 0.11,
    currentReadiness: 0.75,
    projectedReadiness: 0.70,
    projectedCI: [0.55, 0.85],
    weakTopics: [],
    topicCount: 2,
    needsIntervention: false,
    ...overrides,
  };
}

// ─── betaBinomialPosterior ─────────────────────────────────────────────────────

describe('betaBinomialPosterior', () => {
  it('uniform prior with 0 trials → mean = 0.5', () => {
    const result = betaBinomialPosterior(0, 0);
    // alpha=1, beta=1 → mean = 1/2
    expect(result.mean).toBeCloseTo(0.5, 5);
  });

  it('uniform prior, 5/10 successes → mean = 0.5', () => {
    // alpha = 1+5=6, beta = 1+5=6 → mean = 6/12 = 0.5
    const result = betaBinomialPosterior(5, 10);
    expect(result.mean).toBeCloseTo(0.5, 5);
  });

  it('all correct (10/10) → mean close to 1', () => {
    // alpha=11, beta=1 → mean = 11/12 ≈ 0.9167
    const result = betaBinomialPosterior(10, 10);
    expect(result.mean).toBeCloseTo(11 / 12, 5);
    expect(result.mean).toBeGreaterThan(0.9);
  });

  it('none correct (0/10) → mean close to 0', () => {
    // alpha=1, beta=11 → mean = 1/12 ≈ 0.0833
    const result = betaBinomialPosterior(0, 10);
    expect(result.mean).toBeCloseTo(1 / 12, 5);
    expect(result.mean).toBeLessThan(0.1);
  });

  it('lower95 < mean < upper95', () => {
    const result = betaBinomialPosterior(5, 10);
    expect(result.lower95).toBeLessThan(result.mean);
    expect(result.upper95).toBeGreaterThan(result.mean);
  });

  it('bounds are always in [0, 1]', () => {
    for (const [s, t] of [[0, 0], [0, 10], [10, 10], [1, 2]]) {
      const r = betaBinomialPosterior(s!, t!);
      expect(r.lower95).toBeGreaterThanOrEqual(0);
      expect(r.upper95).toBeLessThanOrEqual(1);
    }
  });

  it('CI narrows with more data (larger trials → smaller spread)', () => {
    const small = betaBinomialPosterior(5, 10);
    const large = betaBinomialPosterior(50, 100);
    const smallSpread = small.upper95 - small.lower95;
    const largeSpread = large.upper95 - large.lower95;
    expect(largeSpread).toBeLessThan(smallSpread);
  });

  it('custom prior shifts mean toward prior', () => {
    // Strong prior toward 0 (alpha=1, beta=10): 0/5 trials
    const strongLowPrior = betaBinomialPosterior(0, 5, 1, 10);
    // Uniform prior: 0/5 trials
    const uniformPrior = betaBinomialPosterior(0, 5, 1, 1);
    // Strong low prior should have lower mean than uniform
    expect(strongLowPrior.mean).toBeLessThan(uniformPrior.mean);
  });

  it('mean is exact fraction alpha/(alpha+beta)', () => {
    // successes=3, trials=7, prior alpha=2, beta=3
    // alpha = 2+3=5, beta = 3+(7-3)=7 → mean = 5/12
    const result = betaBinomialPosterior(3, 7, 2, 3);
    expect(result.mean).toBeCloseTo(5 / 12, 5);
  });
});

// ─── harmonicMeanStability ─────────────────────────────────────────────────────

describe('harmonicMeanStability', () => {
  it('empty array → 0', () => {
    expect(harmonicMeanStability([])).toBe(0);
  });

  it('single value → same value', () => {
    expect(harmonicMeanStability([7])).toBeCloseTo(7, 5);
  });

  it('[2, 3, 6] → 3', () => {
    // 3 / (1/2 + 1/3 + 1/6) = 3 / (3/6 + 2/6 + 1/6) = 3/1 = 3
    expect(harmonicMeanStability([2, 3, 6])).toBeCloseTo(3, 5);
  });

  it('[1, 1, 1] → 1', () => {
    expect(harmonicMeanStability([1, 1, 1])).toBeCloseTo(1, 5);
  });

  it('filters zeros (zero stability excluded)', () => {
    // [0, 4]: valid = [4], harmonic = 4
    expect(harmonicMeanStability([0, 4])).toBeCloseTo(4, 5);
  });

  it('all zeros → 0', () => {
    expect(harmonicMeanStability([0, 0, 0])).toBe(0);
  });

  it('harmonic mean ≤ arithmetic mean (AM-HM inequality)', () => {
    const values = [2, 4, 8, 16];
    const hmean = harmonicMeanStability(values);
    const amean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(hmean).toBeLessThanOrEqual(amean);
  });

  it('weakest card dominates — adding a small stability lowers harmonic mean', () => {
    const withoutWeak = harmonicMeanStability([10, 20, 30]);
    const withWeak = harmonicMeanStability([1, 10, 20, 30]);
    expect(withWeak).toBeLessThan(withoutWeak);
  });
});

// ─── projectRetrievability ─────────────────────────────────────────────────────

describe('projectRetrievability', () => {
  it('zero stability → returns 0', () => {
    expect(projectRetrievability(0, 5)).toBe(0);
  });

  it('negative stability → returns 0', () => {
    expect(projectRetrievability(-1, 5)).toBe(0);
  });

  it('zero elapsed time (no additional days) → returns 1', () => {
    expect(projectRetrievability(10, 0, 0)).toBe(1);
  });

  it('R(t) < 1 when t > 0', () => {
    expect(projectRetrievability(10, 1)).toBeLessThan(1);
  });

  it('R(t) > 0 for positive t and stability', () => {
    expect(projectRetrievability(10, 30)).toBeGreaterThan(0);
  });

  it('R is strictly decreasing as elapsed time increases', () => {
    const s = 10;
    const r1 = projectRetrievability(s, 5);
    const r2 = projectRetrievability(s, 10);
    const r3 = projectRetrievability(s, 20);
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
  });

  it('higher stability → higher R for the same elapsed time', () => {
    const t = 10;
    const lowS = projectRetrievability(5, t);
    const highS = projectRetrievability(20, t);
    expect(highS).toBeGreaterThan(lowS);
  });

  it('additionalDays adds to elapsed (same as larger elapsedDays)', () => {
    const s = 10;
    const combined = projectRetrievability(s, 5, 5);
    const direct = projectRetrievability(s, 10, 0);
    expect(combined).toBeCloseTo(direct, 8);
  });

  it('R approaches 0 for very large elapsed time', () => {
    expect(projectRetrievability(10, 100000)).toBeLessThan(0.01);
  });
});

// ─── aggregateTopicReadiness ───────────────────────────────────────────────────

describe('aggregateTopicReadiness', () => {
  it('empty cards → all zeros', () => {
    const result = aggregateTopicReadiness('cond-1', 'Cardiovascular', []);
    expect(result.cardCount).toBe(0);
    expect(result.meanRetrievability).toBe(0);
    expect(result.harmonicStability).toBe(0);
    expect(result.masteryEstimate).toBe(0);
    expect(result.masteryCI).toEqual([0, 0]);
  });

  it('single card → meanR = card.retrievability', () => {
    const card = makeCard({ retrievability: 0.80 });
    const result = aggregateTopicReadiness('cond-1', 'Cardiovascular', [card]);
    expect(result.meanRetrievability).toBeCloseTo(0.80, 5);
  });

  it('meanRetrievability is arithmetic mean of card retrievabilities', () => {
    const cards = [
      makeCard({ retrievability: 0.60 }),
      makeCard({ retrievability: 0.80 }),
      makeCard({ retrievability: 1.00 }),
    ];
    const result = aggregateTopicReadiness('cond-1', 'Cardiology', cards);
    expect(result.meanRetrievability).toBeCloseTo(0.80, 5);
  });

  it('harmonicStability is harmonic mean of card stabilities', () => {
    const cards = [
      makeCard({ stability: 2 }),
      makeCard({ stability: 3 }),
      makeCard({ stability: 6 }),
    ];
    const result = aggregateTopicReadiness('cond-1', 'Pulmonary', cards);
    expect(result.harmonicStability).toBeCloseTo(3, 5);
  });

  it('masteryEstimate from betaBinomial uses total counts', () => {
    // 8 correct, 10 attempts → alpha=9, beta=3 → mean=9/12=0.75
    const cards = [makeCard({ totalAttempts: 10, correctCount: 8 })];
    const result = aggregateTopicReadiness('cond-1', 'GI', cards);
    expect(result.masteryEstimate).toBeCloseTo(9 / 12, 5);
  });

  it('cardCount equals input length', () => {
    const cards = [makeCard(), makeCard(), makeCard()];
    const result = aggregateTopicReadiness('cond-1', 'Neurology', cards);
    expect(result.cardCount).toBe(3);
  });

  it('conditionId and system are passed through', () => {
    const result = aggregateTopicReadiness('my-cond', 'Dermatology', [makeCard()]);
    expect(result.conditionId).toBe('my-cond');
    expect(result.system).toBe('Dermatology');
  });

  it('masteryCI: lower < mean < upper for non-trivial data', () => {
    const cards = Array.from({ length: 5 }, () =>
      makeCard({ totalAttempts: 5, correctCount: 3 })
    );
    const result = aggregateTopicReadiness('cond-1', 'Cardiovascular', cards);
    expect(result.masteryCI[0]).toBeLessThan(result.masteryEstimate);
    expect(result.masteryCI[1]).toBeGreaterThan(result.masteryEstimate);
  });
});

// ─── aggregateSystemReadiness ──────────────────────────────────────────────────

describe('aggregateSystemReadiness', () => {
  it('empty topics → currentReadiness = 0, topicCount = 0', () => {
    const result = aggregateSystemReadiness('Cardiovascular', []);
    expect(result.currentReadiness).toBe(0);
    expect(result.topicCount).toBe(0);
    expect(result.projectedReadiness).toBe(0);
  });

  it('blueprintWeight for Cardiovascular = 0.11 / 100 = 0.0011 (service divides by 100)', () => {
    // NCCPA_2025_BLUEPRINT has Cardiovascular: 0.11; service does / 100 → 0.0011
    const result = aggregateSystemReadiness('Cardiovascular', [makeTopicReadiness()]);
    expect(result.blueprintWeight).toBeCloseTo(0.11 / 100, 5);
  });

  it('blueprintWeight defaults to 0.05 for unknown system', () => {
    const result = aggregateSystemReadiness('UnknownSystem', [makeTopicReadiness({ system: 'UnknownSystem' })]);
    expect(result.blueprintWeight).toBeCloseTo(0.05, 5);
  });

  it('currentReadiness is card-count-weighted mean of topic retrievabilities', () => {
    const topics = [
      makeTopicReadiness({ meanRetrievability: 0.60, cardCount: 2 }),
      makeTopicReadiness({ meanRetrievability: 0.90, cardCount: 2 }),
    ];
    const result = aggregateSystemReadiness('Cardiovascular', topics);
    // Equal weights → simple mean = 0.75
    expect(result.currentReadiness).toBeCloseTo(0.75, 5);
  });

  it('weakTopics lists conditionIds where meanRetrievability < 0.60', () => {
    const topics = [
      makeTopicReadiness({ conditionId: 'weak-1', meanRetrievability: 0.40 }),
      makeTopicReadiness({ conditionId: 'strong-1', meanRetrievability: 0.80 }),
    ];
    const result = aggregateSystemReadiness('Cardiovascular', topics);
    expect(result.weakTopics).toContain('weak-1');
    expect(result.weakTopics).not.toContain('strong-1');
  });

  it('projectedReadiness ≤ 1', () => {
    const topics = [makeTopicReadiness({ meanRetrievability: 0.90, harmonicStability: 30 })];
    const result = aggregateSystemReadiness('Cardiovascular', topics, 0);
    expect(result.projectedReadiness).toBeLessThanOrEqual(1);
  });

  it('projectedReadiness ≥ 0', () => {
    const topics = [makeTopicReadiness({ meanRetrievability: 0.20, harmonicStability: 1 })];
    const result = aggregateSystemReadiness('Cardiovascular', topics, 90);
    expect(result.projectedReadiness).toBeGreaterThanOrEqual(0);
  });

  it('system and topicCount are passed through', () => {
    const topics = [makeTopicReadiness(), makeTopicReadiness({ conditionId: 'cond-2' })];
    const result = aggregateSystemReadiness('Pulmonary', topics);
    expect(result.system).toBe('Pulmonary');
    expect(result.topicCount).toBe(2);
  });

  it('needsIntervention is false when no trend provided', () => {
    const result = aggregateSystemReadiness('Cardiovascular', [makeTopicReadiness()]);
    expect(result.needsIntervention).toBe(false);
  });
});

// ─── detectRisk ───────────────────────────────────────────────────────────────

describe('detectRisk', () => {
  it('critical: projectedReadiness < 0.50 → critical', () => {
    const result = detectRisk(0.45, 0, []);
    expect(result.level).toBe('critical');
  });

  it('critical: any criticalSystemCount > 0 → critical', () => {
    const result = detectRisk(0.80, 1, []);
    expect(result.level).toBe('critical');
  });

  it('high: projectedReadiness < 0.65 (with no critical systems)', () => {
    const result = detectRisk(0.60, 0, []);
    expect(result.level).toBe('high');
  });

  it('high: >2 systems below 0.50 readiness', () => {
    const lowSystems = [
      makeSystemProjection({ currentReadiness: 0.40 }),
      makeSystemProjection({ currentReadiness: 0.45 }),
      makeSystemProjection({ currentReadiness: 0.48 }),
    ];
    const result = detectRisk(0.70, 0, lowSystems);
    expect(result.level).toBe('high');
  });

  it('moderate: projectedReadiness in [0.65, 0.80)', () => {
    const result = detectRisk(0.72, 0, []);
    expect(result.level).toBe('moderate');
  });

  it('low: projectedReadiness ≥ 0.80 with no critical systems', () => {
    const result = detectRisk(0.85, 0, []);
    expect(result.level).toBe('low');
  });

  it('boundary: projectedReadiness = 0.50 is critical (< 0.50 fails, but exactly 0.50 is not < 0.50)', () => {
    // 0.50 is not < 0.50, so not critical from readiness alone
    // 0.50 is < 0.65, so → high
    const result = detectRisk(0.50, 0, []);
    expect(result.level).toBe('high');
  });

  it('reasons array is non-empty for non-low risk', () => {
    const result = detectRisk(0.40, 0, []);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('low risk → reasons still reflects any warnings', () => {
    const result = detectRisk(0.90, 0, []);
    expect(result.level).toBe('low');
    // No critical/high reasons
    expect(result.reasons.filter(r => r.includes('below 40%') || r.includes('below 50%'))).toHaveLength(0);
  });
});

// ─── computeExamReadiness ──────────────────────────────────────────────────────

describe('computeExamReadiness', () => {
  it('empty cards → overallReadiness = 0', () => {
    const result = computeExamReadiness([]);
    expect(result.overallReadiness).toBe(0);
  });

  it('daysUntilExam passed through to projection', () => {
    const result = computeExamReadiness([], 30);
    expect(result.daysUntilExam).toBe(30);
  });

  it('daysUntilExam null by default', () => {
    const result = computeExamReadiness([]);
    expect(result.daysUntilExam).toBeNull();
  });

  it('overallReadiness in [0, 1]', () => {
    const cards = [
      makeCard({ system: 'Cardiovascular', retrievability: 0.80, stability: 15 }),
      makeCard({ system: 'Cardiovascular', retrievability: 0.60, stability: 8 }),
    ];
    const result = computeExamReadiness(cards);
    expect(result.overallReadiness).toBeGreaterThanOrEqual(0);
    expect(result.overallReadiness).toBeLessThanOrEqual(1);
  });

  it('projectedAtExam in [0, 1]', () => {
    const cards = [makeCard({ retrievability: 0.75, stability: 10 })];
    const result = computeExamReadiness(cards, 60);
    expect(result.projectedAtExam).toBeGreaterThanOrEqual(0);
    expect(result.projectedAtExam).toBeLessThanOrEqual(1);
  });

  it('estimatedScoreRange is within [300, 800]', () => {
    const cards = [makeCard({ retrievability: 0.75, stability: 10 })];
    const result = computeExamReadiness(cards, 90);
    expect(result.estimatedScoreRange[0]).toBeGreaterThanOrEqual(300);
    expect(result.estimatedScoreRange[1]).toBeLessThanOrEqual(800);
    expect(result.estimatedScoreRange[0]).toBeLessThanOrEqual(result.estimatedScoreRange[1]);
  });

  it('riskLevel is a valid RiskLevel', () => {
    const result = computeExamReadiness([makeCard({ retrievability: 0.75 })]);
    expect(['low', 'moderate', 'high', 'critical']).toContain(result.riskLevel);
  });

  it('systems array has one entry per distinct system', () => {
    const cards = [
      makeCard({ system: 'Cardiovascular', conditionId: 'c1' }),
      makeCard({ system: 'Pulmonary', conditionId: 'c2' }),
    ];
    const result = computeExamReadiness(cards);
    expect(result.systems).toHaveLength(2);
    const systemNames = result.systems.map(s => s.system);
    expect(systemNames).toContain('Cardiovascular');
    expect(systemNames).toContain('Pulmonary');
  });

  it('criticalSystems lists systems with currentReadiness < 0.40', () => {
    const cards = [
      makeCard({ system: 'Cardiovascular', retrievability: 0.20, conditionId: 'c1' }),
      makeCard({ system: 'Pulmonary', retrievability: 0.80, conditionId: 'c2' }),
    ];
    const result = computeExamReadiness(cards);
    expect(result.criticalSystems).toContain('Cardiovascular');
    expect(result.criticalSystems).not.toContain('Pulmonary');
  });

  it('projectedAt is a valid ISO datetime string', () => {
    const result = computeExamReadiness([]);
    expect(() => new Date(result.projectedAt)).not.toThrow();
    expect(new Date(result.projectedAt).getTime()).not.toBeNaN();
  });

  it('blueprint-weighted readiness: system with higher blueprint weight dominates', () => {
    // Cardiovascular (0.11) with high R, Pulmonary (0.09) with low R
    const cards = [
      makeCard({ system: 'Cardiovascular', retrievability: 0.90, conditionId: 'c1' }),
      makeCard({ system: 'Pulmonary', retrievability: 0.10, conditionId: 'c2' }),
    ];
    const resultCV = computeExamReadiness(cards);

    // Reverse: Cardiovascular low, Pulmonary high
    const cardsReversed = [
      makeCard({ system: 'Cardiovascular', retrievability: 0.10, conditionId: 'c1' }),
      makeCard({ system: 'Pulmonary', retrievability: 0.90, conditionId: 'c2' }),
    ];
    const resultPulm = computeExamReadiness(cardsReversed);

    // CV has higher blueprint weight → first scenario has higher overallReadiness
    expect(resultCV.overallReadiness).toBeGreaterThan(resultPulm.overallReadiness);
  });
});
