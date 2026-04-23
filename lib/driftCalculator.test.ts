import { describe, it, expect } from 'vitest';
import {
  calculateRetrievability,
  calculateAggregateRetrievability,
  retrievabilityToAccuracy,
  accuracyToScore,
  scoreToAccuracy,
  calculateDriftProjections,
  calculateDriftVector,
  calculateSystemDrift,
  getDriftMessage,
  getDriftStatusLabel,
  calculateSessionImpact,
  type FSRSCardData,
} from './driftCalculator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<FSRSCardData> = {}): FSRSCardData {
  return {
    conditionId: 'cond-1',
    stability: 10,
    retrievability: 0.9,
    lastReviewedAt: new Date(), // reviewed now
    system: 'Cardiovascular',
    blueprintWeight: 1,
    ...overrides,
  };
}

/** Card reviewed N days ago */
function cardReviewedDaysAgo(days: number, stability = 10): FSRSCardData {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return makeCard({ lastReviewedAt: d, stability });
}

// ─── calculateRetrievability ──────────────────────────────────────────────────

describe('calculateRetrievability', () => {
  it('returns 1 at t=0', () => {
    expect(calculateRetrievability(0, 10)).toBeCloseTo(1, 10);
  });

  it('returns exp(-1) ≈ 0.3679 when t=S', () => {
    expect(calculateRetrievability(10, 10)).toBeCloseTo(Math.exp(-1), 5);
  });

  it('decays exponentially: R(2t) < R(t)^2 is false; R(2t) = R(t)^2 (exponential property)', () => {
    const r1 = calculateRetrievability(5, 10);
    const r2 = calculateRetrievability(10, 10);
    // exp(-10/10) = exp(-5/10)^2
    expect(r2).toBeCloseTo(r1 * r1, 5);
  });

  it('higher stability → higher R for same elapsed time', () => {
    const lowS = calculateRetrievability(5, 5);
    const highS = calculateRetrievability(5, 20);
    expect(highS).toBeGreaterThan(lowS);
  });

  it('returns a value in [0, 1]', () => {
    for (const [t, s] of [[0, 1], [1, 1], [10, 5], [100, 100]] as [number, number][]) {
      const r = calculateRetrievability(t, s);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
    }
  });

  it('defaults stability to 1 when stability <= 0', () => {
    const rZero = calculateRetrievability(1, 0);
    const rNeg = calculateRetrievability(1, -5);
    const rOne = calculateRetrievability(1, 1);
    expect(rZero).toBeCloseTo(rOne, 10);
    expect(rNeg).toBeCloseTo(rOne, 10);
  });

  it('approaches 0 for very large t', () => {
    expect(calculateRetrievability(1000, 1)).toBeCloseTo(0, 5);
  });
});

// ─── calculateAggregateRetrievability ────────────────────────────────────────

describe('calculateAggregateRetrievability', () => {
  it('returns 0 for empty card list', () => {
    expect(calculateAggregateRetrievability([], new Date())).toBe(0);
  });

  it('single card → same as calculateRetrievability', () => {
    const daysAgo = 5;
    const stability = 10;
    const card = cardReviewedDaysAgo(daysAgo, stability);
    const targetDate = new Date();
    const agg = calculateAggregateRetrievability([card], targetDate);
    const direct = calculateRetrievability(daysAgo, stability);
    expect(agg).toBeCloseTo(direct, 3);
  });

  it('averages R for two equal-weight cards', () => {
    const card1 = cardReviewedDaysAgo(0, 10);  // R≈1
    const card2 = cardReviewedDaysAgo(10, 10); // R≈exp(-1)≈0.368
    const agg = calculateAggregateRetrievability([card1, card2], new Date());
    const expected = (1 + Math.exp(-1)) / 2;
    expect(agg).toBeCloseTo(expected, 2);
  });

  it('respects blueprintWeight when useWeights=true', () => {
    // card1: R≈1, weight=3; card2: R≈exp(-1), weight=1
    const card1 = cardReviewedDaysAgo(0, 10);
    card1.blueprintWeight = 3;
    const card2 = cardReviewedDaysAgo(10, 10);
    card2.blueprintWeight = 1;

    const weighted = calculateAggregateRetrievability([card1, card2], new Date(), true);
    const unweighted = calculateAggregateRetrievability([card1, card2], new Date(), false);

    // Weighted should be higher (card1 with R≈1 has 3x weight)
    expect(weighted).toBeGreaterThan(unweighted);
  });

  it('string lastReviewedAt is parsed correctly', () => {
    const daysAgo = 3;
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const card = makeCard({ lastReviewedAt: d.toISOString(), stability: 10 });
    const agg = calculateAggregateRetrievability([card], new Date());
    const direct = calculateRetrievability(daysAgo, 10);
    expect(agg).toBeCloseTo(direct, 2);
  });

  it('result is in [0, 1]', () => {
    const cards = [cardReviewedDaysAgo(1, 5), cardReviewedDaysAgo(10, 5)];
    const r = calculateAggregateRetrievability(cards, new Date());
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});

// ─── retrievabilityToAccuracy ─────────────────────────────────────────────────

describe('retrievabilityToAccuracy', () => {
  it('R=1.0 → 100%', () => {
    expect(retrievabilityToAccuracy(1.0)).toBe(100);
  });

  it('R=0.0 → 0%', () => {
    expect(retrievabilityToAccuracy(0.0)).toBe(0);
  });

  it('R=0.5 → 50%', () => {
    expect(retrievabilityToAccuracy(0.5)).toBeCloseTo(50, 5);
  });

  it('clamps R>1 to 100', () => {
    expect(retrievabilityToAccuracy(1.5)).toBe(100);
  });

  it('clamps R<0 to 0', () => {
    expect(retrievabilityToAccuracy(-0.1)).toBe(0);
  });
});

// ─── accuracyToScore ──────────────────────────────────────────────────────────

describe('accuracyToScore', () => {
  it('0% accuracy → 200 (SCORE_MIN)', () => {
    expect(accuracyToScore(0)).toBe(200);
  });

  it('100% accuracy → 800 (SCORE_MAX)', () => {
    expect(accuracyToScore(100)).toBe(800);
  });

  it('50% accuracy → 500 (midpoint)', () => {
    expect(accuracyToScore(50)).toBe(500);
  });

  it('returns an integer (rounds)', () => {
    const score = accuracyToScore(33.33);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('is monotonically increasing', () => {
    const s25 = accuracyToScore(25);
    const s75 = accuracyToScore(75);
    expect(s75).toBeGreaterThan(s25);
  });
});

// ─── scoreToAccuracy ──────────────────────────────────────────────────────────

describe('scoreToAccuracy', () => {
  it('score=200 → 0%', () => {
    expect(scoreToAccuracy(200)).toBe(0);
  });

  it('score=800 → 100%', () => {
    expect(scoreToAccuracy(800)).toBe(100);
  });

  it('score=500 → 50%', () => {
    expect(scoreToAccuracy(500)).toBe(50);
  });

  it('is the inverse of accuracyToScore (up to rounding)', () => {
    for (const acc of [0, 25, 50, 75, 100]) {
      const score = accuracyToScore(acc);
      expect(scoreToAccuracy(score)).toBeCloseTo(acc, 0);
    }
  });
});

// ─── calculateDriftProjections ────────────────────────────────────────────────

describe('calculateDriftProjections', () => {
  it('returns daysAhead+1 projections (day 0 through daysAhead)', () => {
    const cards = [cardReviewedDaysAgo(1, 10)];
    const result = calculateDriftProjections(cards, 14);
    expect(result).toHaveLength(15); // days 0–14
  });

  it('day 0 projection has highest score (no decay yet)', () => {
    const cards = [cardReviewedDaysAgo(0, 10)];
    const result = calculateDriftProjections(cards, 7);
    const day0 = result[0]!;
    const day7 = result[7]!;
    expect(day0.predictedScore).toBeGreaterThanOrEqual(day7.predictedScore);
  });

  it('each projection has all required fields', () => {
    const cards = [makeCard()];
    const projections = calculateDriftProjections(cards, 3);
    for (const p of projections) {
      expect(p).toHaveProperty('day');
      expect(p).toHaveProperty('retrievability');
      expect(p).toHaveProperty('predictedAccuracy');
      expect(p).toHaveProperty('predictedScore');
    }
  });

  it('scores are in valid range [200, 800]', () => {
    const cards = [cardReviewedDaysAgo(2, 5)];
    for (const p of calculateDriftProjections(cards, 14)) {
      expect(p.predictedScore).toBeGreaterThanOrEqual(200);
      expect(p.predictedScore).toBeLessThanOrEqual(800);
    }
  });

  it('day values are sequential 0, 1, 2, ...', () => {
    const cards = [makeCard()];
    const result = calculateDriftProjections(cards, 5);
    result.forEach((p, i) => {
      expect(p.day).toBe(i);
    });
  });

  it('respects custom daysAhead', () => {
    const cards = [makeCard()];
    expect(calculateDriftProjections(cards, 7)).toHaveLength(8);
    expect(calculateDriftProjections(cards, 3)).toHaveLength(4);
  });
});

// ─── calculateDriftVector ─────────────────────────────────────────────────────

describe('calculateDriftVector', () => {
  it('returns all required fields', () => {
    const result = calculateDriftVector([makeCard()]);
    expect(result).toHaveProperty('currentScore');
    expect(result).toHaveProperty('projectedScoreDay7');
    expect(result).toHaveProperty('projectedScoreDay14');
    expect(result).toHaveProperty('dailyDecayRate');
    expect(result).toHaveProperty('daysUntilDanger');
    expect(result).toHaveProperty('urgency');
    expect(result).toHaveProperty('projections');
  });

  it('urgency is critical when current score < 350', () => {
    // Card reviewed 90 days ago with low stability → score far below passing
    const card = cardReviewedDaysAgo(90, 1);
    const result = calculateDriftVector([card]);
    expect(result.urgency).toBe('critical');
  });

  it('urgency is low for very stable cards reviewed recently', () => {
    // Card reviewed today with extremely high stability → won't decay soon
    const card = cardReviewedDaysAgo(0, 9999);
    const result = calculateDriftVector([card]);
    expect(result.urgency).toBe('low');
  });

  it('projections array has 15 entries (days 0-14)', () => {
    const result = calculateDriftVector([makeCard()]);
    expect(result.projections).toHaveLength(15);
  });

  it('currentScore equals day 0 predictedScore in projections', () => {
    const cards = [cardReviewedDaysAgo(2, 10)];
    const result = calculateDriftVector(cards);
    expect(result.currentScore).toBe(result.projections[0]!.predictedScore);
  });

  it('projectedScoreDay7 <= currentScore (decay only)', () => {
    const result = calculateDriftVector([cardReviewedDaysAgo(2, 5)]);
    expect(result.projectedScoreDay7).toBeLessThanOrEqual(result.currentScore);
  });

  it('projectedScoreDay14 <= projectedScoreDay7', () => {
    const result = calculateDriftVector([cardReviewedDaysAgo(2, 5)]);
    expect(result.projectedScoreDay14).toBeLessThanOrEqual(result.projectedScoreDay7);
  });

  it('daysUntilDanger is 999 when score stays above passing through day 14', () => {
    // Very high stability card reviewed today
    const card = cardReviewedDaysAgo(0, 9999);
    const result = calculateDriftVector([card]);
    expect(result.daysUntilDanger).toBe(999);
  });

  it('empty cards returns critical urgency with SCORE_MIN', () => {
    // Empty cards → projections with avgR=0 (empty array returns 0)
    // calculateDriftProjections with empty cards → all R=0 → score=200
    const result = calculateDriftVector([]);
    expect(result.currentScore).toBe(200);
    expect(result.urgency).toBe('critical');
  });
});

// ─── calculateSystemDrift ─────────────────────────────────────────────────────

describe('calculateSystemDrift', () => {
  it('returns one entry per unique system', () => {
    const cards = [
      makeCard({ system: 'Cardiovascular' }),
      makeCard({ system: 'Pulmonary' }),
      makeCard({ system: 'Cardiovascular' }),
    ];
    const result = calculateSystemDrift(cards);
    const systems = result.map((r) => r.system);
    expect(systems).toContain('Cardiovascular');
    expect(systems).toContain('Pulmonary');
    expect(result).toHaveLength(2);
  });

  it('cards with no system are grouped under UNKNOWN', () => {
    const card = makeCard({ system: undefined });
    const result = calculateSystemDrift([card]);
    expect(result[0]!.system).toBe('UNKNOWN');
  });

  it('currentR is in [0, 1]', () => {
    const card = cardReviewedDaysAgo(3, 10);
    const result = calculateSystemDrift([card]);
    expect(result[0]!.currentR).toBeGreaterThanOrEqual(0);
    expect(result[0]!.currentR).toBeLessThanOrEqual(1);
  });

  it('projectedR7 <= currentR (decay over 7 days)', () => {
    const card = cardReviewedDaysAgo(1, 5); // actively decaying
    const result = calculateSystemDrift([card]);
    expect(result[0]!.projectedR7).toBeLessThanOrEqual(result[0]!.currentR);
  });

  it('decayRate is non-negative for decaying cards', () => {
    const card = cardReviewedDaysAgo(5, 5);
    const result = calculateSystemDrift([card]);
    expect(result[0]!.decayRate).toBeGreaterThanOrEqual(0);
  });

  it('cardsAtRisk counts cards projected below 0.9 R in 7 days', () => {
    // Low stability card reviewed 5 days ago → will be well below 0.9 in 7 more days
    const atRisk = cardReviewedDaysAgo(5, 3);
    // High stability card reviewed today → R stays near 1
    const safe = cardReviewedDaysAgo(0, 9999);
    const result = calculateSystemDrift([
      { ...atRisk, system: 'TestSys' },
      { ...safe, system: 'TestSys' },
    ]);
    expect(result[0]!.cardsAtRisk).toBeGreaterThanOrEqual(1);
  });

  it('results are sorted by decayRate descending', () => {
    // Fast decaying system: low stability, reviewed many days ago
    const fastCard = { ...cardReviewedDaysAgo(10, 2), system: 'FastSys' };
    // Slow decaying system: high stability, reviewed recently
    const slowCard = { ...cardReviewedDaysAgo(0, 999), system: 'SlowSys' };
    const result = calculateSystemDrift([fastCard, slowCard]);
    expect(result[0]!.decayRate).toBeGreaterThanOrEqual(result[1]!.decayRate);
  });
});

// ─── getDriftMessage ──────────────────────────────────────────────────────────

describe('getDriftMessage', () => {
  function makeDrift(overrides: Partial<{ urgency: string; currentScore: number; daysUntilDanger: number; dailyDecayRate: number; projectedScoreDay7: number }> = {}) {
    return {
      urgency: 'low',
      currentScore: 600,
      projectedScoreDay7: 580,
      projectedScoreDay14: 560,
      dailyDecayRate: 2.9,
      daysUntilDanger: 999,
      projections: [],
      ...overrides,
    } as Parameters<typeof getDriftMessage>[0];
  }

  it('critical with score below passing → "below passing" message', () => {
    const msg = getDriftMessage(makeDrift({ urgency: 'critical', currentScore: 300, daysUntilDanger: 0 }));
    expect(msg).toContain('below passing');
  });

  it('critical with score above passing → URGENT message with days', () => {
    const msg = getDriftMessage(makeDrift({ urgency: 'critical', currentScore: 400, daysUntilDanger: 2 }));
    expect(msg).toContain('URGENT');
    expect(msg).toContain('2');
  });

  it('critical message uses "day" (singular) when daysUntilDanger=1', () => {
    const msg = getDriftMessage(makeDrift({ urgency: 'critical', currentScore: 400, daysUntilDanger: 1 }));
    expect(msg).toMatch(/1 day[^s]/);
  });

  it('high urgency → mentions decay rate', () => {
    const msg = getDriftMessage(makeDrift({ urgency: 'high', dailyDecayRate: 5.2 }));
    expect(msg).toContain('5.2');
  });

  it('medium urgency → mentions point drop', () => {
    const msg = getDriftMessage(makeDrift({ urgency: 'medium', currentScore: 600, projectedScoreDay7: 560 }));
    expect(msg).toContain('40');
  });

  it('low urgency → stable message', () => {
    const msg = getDriftMessage(makeDrift({ urgency: 'low' }));
    expect(msg).toContain('stable');
  });
});

// ─── getDriftStatusLabel ──────────────────────────────────────────────────────

describe('getDriftStatusLabel', () => {
  function makeMinimalDrift(urgency: string) {
    return { urgency, currentScore: 500, projectedScoreDay7: 490, projectedScoreDay14: 480, dailyDecayRate: 1, daysUntilDanger: 999, projections: [] } as Parameters<typeof getDriftStatusLabel>[0];
  }

  it('critical → 🔴 Critical', () => {
    expect(getDriftStatusLabel(makeMinimalDrift('critical'))).toBe('🔴 Critical');
  });

  it('high → 🟠 At Risk', () => {
    expect(getDriftStatusLabel(makeMinimalDrift('high'))).toBe('🟠 At Risk');
  });

  it('medium → 🟡 Watch', () => {
    expect(getDriftStatusLabel(makeMinimalDrift('medium'))).toBe('🟡 Watch');
  });

  it('low → 🟢 Stable', () => {
    expect(getDriftStatusLabel(makeMinimalDrift('low'))).toBe('🟢 Stable');
  });
});

// ─── calculateSessionImpact ───────────────────────────────────────────────────

describe('calculateSessionImpact', () => {
  it('returns all required fields', () => {
    const card = cardReviewedDaysAgo(5, 5);
    const impact = calculateSessionImpact([card], [card], []);
    expect(impact).toHaveProperty('scoreDelta');
    expect(impact).toHaveProperty('memoriesStabilized');
    expect(impact).toHaveProperty('decayPrevented');
    expect(impact).toHaveProperty('projectionImprovement');
  });

  it('scoreDelta is 0 when before and after are identical', () => {
    const card = makeCard();
    const impact = calculateSessionImpact([card], [card], []);
    expect(impact.scoreDelta).toBe(0);
  });

  it('scoreDelta is positive when stability increases after review', () => {
    const before = cardReviewedDaysAgo(10, 2);
    // After review: same card reviewed now with higher stability
    const after = makeCard({ conditionId: before.conditionId, stability: 20 });
    const impact = calculateSessionImpact([before], [after], [before.conditionId]);
    expect(impact.scoreDelta).toBeGreaterThanOrEqual(0);
  });

  it('memoriesStabilized counts cards whose stability increased', () => {
    const cardId = 'cond-abc';
    const before = makeCard({ conditionId: cardId, stability: 5 });
    const after = makeCard({ conditionId: cardId, stability: 15 });
    const impact = calculateSessionImpact([before], [after], [cardId]);
    expect(impact.memoriesStabilized).toBe(1);
  });

  it('memoriesStabilized is 0 when stability did not increase', () => {
    const cardId = 'cond-xyz';
    const before = makeCard({ conditionId: cardId, stability: 10 });
    const after = makeCard({ conditionId: cardId, stability: 10 });
    const impact = calculateSessionImpact([before], [after], [cardId]);
    expect(impact.memoriesStabilized).toBe(0);
  });

  it('decayPrevented is between 0 and 100', () => {
    const before = cardReviewedDaysAgo(8, 3);
    const after = makeCard({ conditionId: before.conditionId, stability: 20 });
    const impact = calculateSessionImpact([before], [after], [before.conditionId]);
    expect(impact.decayPrevented).toBeGreaterThanOrEqual(0);
    expect(impact.decayPrevented).toBeLessThanOrEqual(100);
  });

  it('projectionImprovement is non-negative', () => {
    const before = cardReviewedDaysAgo(5, 3);
    const after = makeCard({ conditionId: before.conditionId, stability: 50 });
    const impact = calculateSessionImpact([before], [after], [before.conditionId]);
    expect(impact.projectionImprovement).toBeGreaterThanOrEqual(0);
  });
});
