import { describe, it, expect } from 'vitest';
import {
  betaBinomialPosterior,
  harmonicMeanStability,
  projectRetrievability,
  aggregateTopicReadiness,
  aggregateSystemReadiness,
  computeExamReadiness,
  detectRisk,
  type CardState,
  type SystemReadinessProjection,
} from '@/lib/services/readinessProjectionService';
import type { ConfidenceTrendResult } from '@/lib/confidence/trendDetector';

// ─── betaBinomialPosterior ────────────────────────────────────────

describe('betaBinomialPosterior', () => {
  it('returns 0.5 mean with uniform prior and no data', () => {
    const result = betaBinomialPosterior(0, 0);
    expect(result.mean).toBeCloseTo(0.5, 2);
  });

  it('computes correct posterior for 5/10', () => {
    const result = betaBinomialPosterior(5, 10);
    // Beta(6,6) mean = 6/12 = 0.5
    expect(result.mean).toBeCloseTo(0.5, 2);
    expect(result.lower95).toBeLessThan(0.5);
    expect(result.upper95).toBeGreaterThan(0.5);
  });

  it('high success rate gives high posterior', () => {
    const result = betaBinomialPosterior(90, 100);
    expect(result.mean).toBeGreaterThan(0.85);
    expect(result.lower95).toBeGreaterThan(0.75);
  });

  it('CI narrows with more data', () => {
    const small = betaBinomialPosterior(5, 10);
    const large = betaBinomialPosterior(50, 100);
    const smallWidth = small.upper95 - small.lower95;
    const largeWidth = large.upper95 - large.lower95;
    expect(largeWidth).toBeLessThan(smallWidth);
  });

  it('CI is always within [0,1]', () => {
    const result = betaBinomialPosterior(0, 100);
    expect(result.lower95).toBeGreaterThanOrEqual(0);
    expect(result.upper95).toBeLessThanOrEqual(1);
  });
});

// ─── harmonicMeanStability ────────────────────────────────────────

describe('harmonicMeanStability', () => {
  it('returns 0 for empty array', () => {
    expect(harmonicMeanStability([])).toBe(0);
  });

  it('returns the value for single element', () => {
    expect(harmonicMeanStability([30])).toBeCloseTo(30, 5);
  });

  it('is dominated by the smallest value', () => {
    // H(1, 100) = 2 / (1/1 + 1/100) ≈ 1.98
    const result = harmonicMeanStability([1, 100]);
    expect(result).toBeLessThan(2);
    expect(result).toBeGreaterThan(1);
  });

  it('equals arithmetic mean for equal values', () => {
    const result = harmonicMeanStability([30, 30, 30]);
    expect(result).toBeCloseTo(30, 5);
  });

  it('filters out zero values', () => {
    const result = harmonicMeanStability([0, 30, 0]);
    expect(result).toBeCloseTo(30, 5);
  });
});

// ─── projectRetrievability ────────────────────────────────────────

describe('projectRetrievability', () => {
  it('returns ~0.71 at exactly one stability period (FSRS v6 defaults)', () => {
    // With ts-fsrs v6 defaults (w19=0.1597, w20=2.27), R(t=S,S) ≈ 0.714.
    // FSRS v6 does NOT use S as the "time to 90% retention" — the 90% point
    // is at t ≈ 0.41*S. See lib/fsrs-retrievability.ts for derivation.
    const r = projectRetrievability(30, 30, 0);
    expect(r).toBeCloseTo(0.714, 2);
  });

  it('returns 1.0 at t=0', () => {
    const r = projectRetrievability(30, 0, 0);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it('decreases with more elapsed time', () => {
    const r1 = projectRetrievability(30, 10);
    const r2 = projectRetrievability(30, 30);
    const r3 = projectRetrievability(30, 90);
    expect(r1).toBeGreaterThan(r2);
    expect(r2).toBeGreaterThan(r3);
  });

  it('higher stability decays more slowly', () => {
    const rLow = projectRetrievability(10, 30);
    const rHigh = projectRetrievability(100, 30);
    expect(rHigh).toBeGreaterThan(rLow);
  });

  it('forward projection reduces R', () => {
    const rNow = projectRetrievability(30, 10);
    const rLater = projectRetrievability(30, 10, 20);
    expect(rLater).toBeLessThan(rNow);
  });

  it('returns 0 for zero stability', () => {
    expect(projectRetrievability(0, 10)).toBe(0);
  });
});

// ─── aggregateTopicReadiness ──────────────────────────────────────

describe('aggregateTopicReadiness', () => {
  it('returns zero readiness for empty cards', () => {
    const topic = aggregateTopicReadiness('cond-1', 'cardiovascular', []);
    expect(topic.meanRetrievability).toBe(0);
    expect(topic.cardCount).toBe(0);
  });

  it('computes correct mean retrievability', () => {
    const cards: CardState[] = [
      { conditionId: 'c1', system: 'cv', stability: 30, difficulty: 5, retrievability: 0.9, lastReviewAt: new Date(), totalAttempts: 10, correctCount: 8 },
      { conditionId: 'c1', system: 'cv', stability: 30, difficulty: 5, retrievability: 0.7, lastReviewAt: new Date(), totalAttempts: 10, correctCount: 6 },
    ];
    const topic = aggregateTopicReadiness('c1', 'cv', cards);
    expect(topic.meanRetrievability).toBeCloseTo(0.8, 2);
    expect(topic.cardCount).toBe(2);
  });

  it('mastery CI contains the point estimate', () => {
    const cards: CardState[] = [
      { conditionId: 'c1', system: 'cv', stability: 30, difficulty: 5, retrievability: 0.9, lastReviewAt: new Date(), totalAttempts: 20, correctCount: 16 },
    ];
    const topic = aggregateTopicReadiness('c1', 'cv', cards);
    expect(topic.masteryCI[0]).toBeLessThanOrEqual(topic.masteryEstimate);
    expect(topic.masteryCI[1]).toBeGreaterThanOrEqual(topic.masteryEstimate);
  });
});

// ─── computeExamReadiness ─────────────────────────────────────────

describe('computeExamReadiness', () => {
  const makeCards = (system: string, count: number, r: number): CardState[] =>
    Array.from({ length: count }, (_, i) => ({
      conditionId: `${system}-cond-${i}`,
      system,
      stability: 30,
      difficulty: 5,
      retrievability: r,
      lastReviewAt: new Date(),
      totalAttempts: 20,
      correctCount: Math.round(r * 20),
    }));

  it('produces valid projection for single system', () => {
    const cards = makeCards('Cardiovascular', 10, 0.85);
    const result = computeExamReadiness(cards);
    expect(result.overallReadiness).toBeGreaterThan(0);
    expect(result.overallReadiness).toBeLessThanOrEqual(1);
    expect(result.systems.length).toBe(1);
    expect(result.estimatedScoreRange[0]).toBeGreaterThanOrEqual(300);
    expect(result.estimatedScoreRange[1]).toBeLessThanOrEqual(800);
  });

  it('projects lower readiness with future exam date', () => {
    const cards = makeCards('Cardiovascular', 10, 0.90);
    const now = computeExamReadiness(cards, 0);
    const later = computeExamReadiness(cards, 60);
    expect(later.projectedAtExam).toBeLessThanOrEqual(now.projectedAtExam + 0.01);
  });

  it('handles empty card set', () => {
    const result = computeExamReadiness([]);
    expect(result.overallReadiness).toBe(0);
    expect(result.systems.length).toBe(0);
  });

  it('handles multiple systems with different readiness', () => {
    const cards = [
      ...makeCards('Cardiovascular', 10, 0.90),
      ...makeCards('Pulmonary', 10, 0.40),
    ];
    const result = computeExamReadiness(cards);
    expect(result.systems.length).toBe(2);
    expect(result.criticalSystems).toContain('Pulmonary');
  });
});

// ─── detectRisk ───────────────────────────────────────────────────

describe('detectRisk', () => {
  const makeSys = (readiness: number): SystemReadinessProjection => ({
    system: 'test',
    blueprintWeight: 0.1,
    currentReadiness: readiness,
    projectedReadiness: readiness,
    projectedCI: [readiness - 0.05, readiness + 0.05],
    weakTopics: [],
    topicCount: 5,
  });

  it('returns "low" for strong readiness', () => {
    const { level } = detectRisk(0.85, 0, [makeSys(0.85)]);
    expect(level).toBe('low');
  });

  it('returns "moderate" for 65-80% readiness', () => {
    const { level } = detectRisk(0.72, 0, [makeSys(0.72)]);
    expect(level).toBe('moderate');
  });

  it('returns "high" for sub-65% readiness', () => {
    const { level } = detectRisk(0.55, 0, [makeSys(0.55)]);
    expect(level).toBe('high');
  });

  it('returns "critical" when any system below 40%', () => {
    const { level } = detectRisk(0.70, 1, [makeSys(0.35), makeSys(0.90)]);
    expect(level).toBe('critical');
  });
});

// ─── aggregateSystemReadiness with trend ──────────────────────────

describe('aggregateSystemReadiness - trend-aware', () => {
  const makeTopic = (r: number) => ({
    conditionId: 'cond-1',
    system: 'CV',
    meanRetrievability: r,
    harmonicStability: 30,
    masteryEstimate: r,
    masteryCI: [r - 0.05, r + 0.05],
    cardCount: 10,
  });

  it('returns needsIntervention=false when no trend provided', () => {
    const result = aggregateSystemReadiness('CV', [makeTopic(0.8)]);
    expect(result.needsIntervention).toBe(false);
    expect(result.trend).toBeUndefined();
  });

  it('narrower CI for improving trend', () => {
    const improvingTrend: ConfidenceTrendResult = {
      slope: 0.08,
      isConcerning: false,
      trendMultiplier: 1.1,
      dataPoints: 5,
      rSquared: 0.7,
      category: 'improving',
    };

    const resultNoTrend = aggregateSystemReadiness('CV', [makeTopic(0.8)], 0);
    const resultWithTrend = aggregateSystemReadiness('CV', [makeTopic(0.8)], 0, improvingTrend);

    // Improving trend should narrow the CI
    const ciWidthNoTrend = resultNoTrend.projectedCI[1] - resultNoTrend.projectedCI[0];
    const ciWidthWithTrend = resultWithTrend.projectedCI[1] - resultWithTrend.projectedCI[0];
    expect(ciWidthWithTrend).toBeLessThan(ciWidthNoTrend);
  });

  it('wider CI for declining trend', () => {
    const decliningTrend: ConfidenceTrendResult = {
      slope: -0.1,
      isConcerning: true,
      trendMultiplier: 0.85,
      dataPoints: 5,
      rSquared: 0.6,
      category: 'concerning',
    };

    const resultNoTrend = aggregateSystemReadiness('CV', [makeTopic(0.8)], 0);
    const resultWithTrend = aggregateSystemReadiness('CV', [makeTopic(0.8)], 0, decliningTrend);

    const ciWidthNoTrend = resultNoTrend.projectedCI[1] - resultNoTrend.projectedCI[0];
    const ciWidthWithTrend = resultWithTrend.projectedCI[1] - resultWithTrend.projectedCI[0];
    expect(ciWidthWithTrend).toBeGreaterThan(ciWidthNoTrend);
  });

  it('sets needsIntervention=true for declining trend', () => {
    const decliningTrend: ConfidenceTrendResult = {
      slope: -0.1,
      isConcerning: true,
      trendMultiplier: 0.85,
      dataPoints: 5,
      rSquared: 0.6,
      category: 'concerning',
    };
    const result = aggregateSystemReadiness('CV', [makeTopic(0.8)], 0, decliningTrend);
    expect(result.needsIntervention).toBe(true);
  });

  it('sets needsIntervention=true for stable trend below mastery', () => {
    const stableTrend: ConfidenceTrendResult = {
      slope: 0.01,
      isConcerning: false,
      trendMultiplier: 1.0,
      dataPoints: 5,
      rSquared: 0.5,
      category: 'stable',
    };
    const result = aggregateSystemReadiness('CV', [makeTopic(0.6)], 0, stableTrend);
    expect(result.needsIntervention).toBe(true);
  });

  it('sets needsIntervention=false for stable trend at mastery', () => {
    const stableTrend: ConfidenceTrendResult = {
      slope: 0.01,
      isConcerning: false,
      trendMultiplier: 1.0,
      dataPoints: 5,
      rSquared: 0.5,
      category: 'stable',
    };
    const result = aggregateSystemReadiness('CV', [makeTopic(0.85)], 0, stableTrend);
    expect(result.needsIntervention).toBe(false);
  });

  it('ignores trend with low R²', () => {
    const weakTrend: ConfidenceTrendResult = {
      slope: -0.15,
      isConcerning: false,
      trendMultiplier: 1.0,
      dataPoints: 5,
      rSquared: 0.1, // Too low to trust
      category: 'stable',
    };
    const result = aggregateSystemReadiness('CV', [makeTopic(0.8)], 0, weakTrend);
    expect(result.needsIntervention).toBe(false);
  });
});

// ─── computeExamReadiness with trend data ────────────────────────

describe('computeExamReadiness - trend-aware', () => {
  const makeCards = (system: string, count: number, r: number): CardState[] =>
    Array.from({ length: count }, (_, i) => ({
      conditionId: `${system}-cond-${i}`,
      system,
      stability: 30,
      difficulty: 5,
      retrievability: r,
      lastReviewAt: new Date(),
      totalAttempts: 20,
      correctCount: Math.round(r * 20),
    }));

  it('includes empty earlyWarnings when no trends provided', () => {
    const result = computeExamReadiness(makeCards('Cardiovascular', 10, 0.85));
    expect(result.earlyWarnings).toEqual([]);
    expect(result.decliningSystems).toEqual([]);
    expect(result.plateauingSystems).toEqual([]);
    expect(result.acceleratingSystems).toEqual([]);
  });

  it('populates decliningSystems when trend is declining', () => {
    const trends = new Map<string, ConfidenceTrendResult>();
    trends.set('Cardiovascular', {
      slope: -0.12,
      isConcerning: true,
      trendMultiplier: 0.85,
      dataPoints: 5,
      rSquared: 0.6,
      category: 'concerning',
    });

    const result = computeExamReadiness(makeCards('Cardiovascular', 10, 0.7), null, trends);
    expect(result.decliningSystems).toContain('Cardiovascular');
    expect(result.earlyWarnings.length).toBeGreaterThan(0);
    expect(result.earlyWarnings[0]!.type).toBe('declining_confidence');
    expect(result.earlyWarnings[0]!.system).toBe('Cardiovascular');
  });

  it('populates plateauingSystems when stable below mastery', () => {
    const trends = new Map<string, ConfidenceTrendResult>();
    trends.set('Pulmonary', {
      slope: 0.01,
      isConcerning: false,
      trendMultiplier: 1.0,
      dataPoints: 4,
      rSquared: 0.5,
      category: 'stable',
    });

    const result = computeExamReadiness(makeCards('Pulmonary', 10, 0.6), null, trends);
    expect(result.plateauingSystems).toContain('Pulmonary');
    expect(result.earlyWarnings.some(w => w.type === 'plateauing')).toBe(true);
  });

  it('populates acceleratingSystems for improving trends', () => {
    const trends = new Map<string, ConfidenceTrendResult>();
    trends.set('Cardiovascular', {
      slope: 0.08,
      isConcerning: false,
      trendMultiplier: 1.1,
      dataPoints: 5,
      rSquared: 0.7,
      category: 'improving',
    });

    const result = computeExamReadiness(makeCards('Cardiovascular', 10, 0.8), null, trends);
    expect(result.acceleratingSystems).toContain('Cardiovascular');
    expect(result.earlyWarnings.length).toBe(0); // No warnings for improving
  });

  it('includes trend data in system results', () => {
    const trends = new Map<string, ConfidenceTrendResult>();
    trends.set('Cardiovascular', {
      slope: -0.05,
      isConcerning: false,
      trendMultiplier: 0.95,
      dataPoints: 4,
      rSquared: 0.5,
      category: 'declining',
    });

    const result = computeExamReadiness(makeCards('Cardiovascular', 10, 0.8), null, trends);
    const cvSystem = result.systems.find(s => s.system === 'Cardiovascular');
    expect(cvSystem?.trend).toBeDefined();
    expect(cvSystem?.needsIntervention).toBe(true);
  });
});
