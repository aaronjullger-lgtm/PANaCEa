import { describe, it, expect } from 'vitest';
import {
  calculateRetrievability,
  calculateAggregateRetrievability,
  calculateDriftProjections,
  calculateDriftVector,
  calculateSystemDrift,
  calculateSessionImpact,
  getDriftMessage,
  getDriftStatusLabel,
  retrievabilityToAccuracy,
  accuracyToScore,
  scoreToAccuracy,
  type FSRSCardData,
} from '../lib/driftCalculator';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a card with "lastReviewedAt = today" — no decay yet. */
function freshCard(overrides: Partial<FSRSCardData> = {}): FSRSCardData {
  return {
    conditionId: 'cond-1',
    stability: 10,
    retrievability: 1.0,
    lastReviewedAt: new Date(),
    ...overrides,
  };
}

/** Build a card reviewed N days ago. */
function cardReviewedDaysAgo(daysAgo: number, overrides: Partial<FSRSCardData> = {}): FSRSCardData {
  const past = new Date();
  past.setDate(past.getDate() - daysAgo);
  return freshCard({ lastReviewedAt: past, ...overrides });
}

// ─── calculateRetrievability ────────────────────────────────────────────────

describe('calculateRetrievability — FSRS decay', () => {
  it('returns 1.0 at t=0 (no decay)', () => {
    // R(0) = exp(-0/S) = 1.0
    expect(calculateRetrievability(0, 10)).toBe(1);
  });

  it('returns ~0.368 (1/e) when t equals stability', () => {
    // R(S) = exp(-S/S) = exp(-1) ≈ 0.368
    expect(calculateRetrievability(10, 10)).toBeCloseTo(0.368, 2);
  });

  it('monotonically decreases with time', () => {
    const r1 = calculateRetrievability(1, 10);
    const r5 = calculateRetrievability(5, 10);
    const r10 = calculateRetrievability(10, 10);
    expect(r1).toBeGreaterThan(r5);
    expect(r5).toBeGreaterThan(r10);
  });

  it('falls back to DEFAULT_STABILITY (1) when stability <= 0', () => {
    // With stability=0 → treated as 1 → R(1, 1) ≈ 0.368
    expect(calculateRetrievability(1, 0)).toBeCloseTo(0.368, 2);
    expect(calculateRetrievability(1, -5)).toBeCloseTo(0.368, 2);
  });
});

// ─── calculateAggregateRetrievability ───────────────────────────────────────

describe('calculateAggregateRetrievability', () => {
  it('returns 0 for empty card array', () => {
    expect(calculateAggregateRetrievability([], new Date())).toBe(0);
  });

  it('averages retrievability unweighted', () => {
    const now = new Date();
    // Both cards just reviewed → R ≈ 1.0 each → average ≈ 1.0
    const cards: FSRSCardData[] = [
      freshCard({ conditionId: 'a', stability: 10 }),
      freshCard({ conditionId: 'b', stability: 20 }),
    ];
    expect(calculateAggregateRetrievability(cards, now, false)).toBeCloseTo(1.0, 2);
  });

  it('applies blueprint weights when useWeights=true', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    // Two cards, one with 10x weight → weighted average pulls toward high-weight card
    const cards: FSRSCardData[] = [
      freshCard({ stability: 1, blueprintWeight: 10 }),  // Heavy decay, high weight
      freshCard({ stability: 1000, blueprintWeight: 1 }), // Almost no decay, low weight
    ];
    const weighted = calculateAggregateRetrievability(cards, future, true);
    const unweighted = calculateAggregateRetrievability(cards, future, false);
    // Weighted should pull toward the low-R (high-weight) card
    expect(weighted).toBeLessThan(unweighted);
  });

  it('uses current R when targetDate is before lastReviewedAt (past)', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const cards: FSRSCardData[] = [
      { ...freshCard({ stability: 10 }), lastReviewedAt: future, retrievability: 0.5 },
    ];
    const now = new Date();
    // targetDate (now) < lastReview (future) → use stored retrievability directly
    expect(calculateAggregateRetrievability(cards, now)).toBeCloseTo(0.5, 2);
  });
});

// ─── Score mappings ─────────────────────────────────────────────────────────

describe('score mapping', () => {
  it('retrievabilityToAccuracy clamps to [0, 100]', () => {
    expect(retrievabilityToAccuracy(0.5)).toBe(50);
    expect(retrievabilityToAccuracy(1.0)).toBe(100);
    expect(retrievabilityToAccuracy(-0.5)).toBe(0);
    expect(retrievabilityToAccuracy(1.5)).toBe(100);
  });

  it('accuracyToScore maps 0% → 200, 100% → 800', () => {
    expect(accuracyToScore(0)).toBe(200);
    expect(accuracyToScore(100)).toBe(800);
    expect(accuracyToScore(50)).toBe(500);
  });

  it('scoreToAccuracy is inverse of accuracyToScore', () => {
    expect(scoreToAccuracy(200)).toBeCloseTo(0, 5);
    expect(scoreToAccuracy(800)).toBeCloseTo(100, 5);
    expect(scoreToAccuracy(500)).toBeCloseTo(50, 5);
  });
});

// ─── calculateDriftProjections ──────────────────────────────────────────────

describe('calculateDriftProjections', () => {
  it('returns daysAhead + 1 projections (inclusive of day 0)', () => {
    const cards = [freshCard()];
    const result = calculateDriftProjections(cards, 14);
    expect(result).toHaveLength(15);
    expect(result[0].day).toBe(0);
    expect(result[14].day).toBe(14);
  });

  it('produces monotonically non-increasing scores over time', () => {
    const cards = [freshCard({ stability: 5 })]; // Decays over 2 weeks
    const result = calculateDriftProjections(cards, 14);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].predictedScore).toBeLessThanOrEqual(result[i - 1].predictedScore);
    }
  });

  it('accepts custom daysAhead', () => {
    const result = calculateDriftProjections([freshCard()], 7);
    expect(result).toHaveLength(8);
  });
});

// ─── calculateDriftVector ───────────────────────────────────────────────────

describe('calculateDriftVector', () => {
  it('returns critical urgency and min score for empty cards (no data)', () => {
    const result = calculateDriftVector([]);
    // Empty array → 15 projections all with R=0 → score=200
    expect(result.currentScore).toBe(200);
    expect(result.urgency).toBe('critical');
  });

  it('returns low urgency for high-stability cards', () => {
    // Stability 365 → near-perfect R for weeks
    const cards = Array.from({ length: 5 }, () =>
      freshCard({ stability: 365, blueprintWeight: 1 })
    );
    const result = calculateDriftVector(cards);
    expect(result.urgency).toBe('low');
    expect(result.currentScore).toBeGreaterThanOrEqual(700);
  });

  it('flags critical when score is already below 350', () => {
    // Very old card with short stability → already decayed
    const cards = [cardReviewedDaysAgo(100, { stability: 1 })];
    const result = calculateDriftVector(cards);
    expect(result.currentScore).toBeLessThan(350);
    expect(result.urgency).toBe('critical');
  });

  it('includes all 15 projections (day 0-14)', () => {
    const result = calculateDriftVector([freshCard()]);
    expect(result.projections).toHaveLength(15);
  });

  it('computes dailyDecayRate as (currentScore - day7Score) / 7', () => {
    const cards = [freshCard({ stability: 7 })];
    const result = calculateDriftVector(cards);
    const expectedRate =
      Math.round(((result.currentScore - result.projectedScoreDay7) / 7) * 10) / 10;
    expect(result.dailyDecayRate).toBeCloseTo(expectedRate, 5);
  });
});

// ─── calculateSystemDrift ───────────────────────────────────────────────────

describe('calculateSystemDrift', () => {
  it('groups cards by system', () => {
    const cards: FSRSCardData[] = [
      freshCard({ conditionId: 'a', system: 'CV', stability: 10 }),
      freshCard({ conditionId: 'b', system: 'CV', stability: 10 }),
      freshCard({ conditionId: 'c', system: 'PULM', stability: 10 }),
    ];
    const result = calculateSystemDrift(cards);
    expect(result).toHaveLength(2);
    const systems = result.map((r) => r.system);
    expect(systems).toContain('CV');
    expect(systems).toContain('PULM');
  });

  it('sorts by decayRate (fastest decaying first)', () => {
    const cards: FSRSCardData[] = [
      freshCard({ conditionId: 'a', system: 'STABLE', stability: 1000 }),
      freshCard({ conditionId: 'b', system: 'FAST_DECAY', stability: 2 }),
    ];
    const result = calculateSystemDrift(cards);
    // Fastest decay comes first
    expect(result[0].system).toBe('FAST_DECAY');
    expect(result[0].decayRate).toBeGreaterThan(result[1].decayRate);
  });

  it('groups cards with no system under UNKNOWN', () => {
    const cards = [freshCard({ system: undefined })];
    const result = calculateSystemDrift(cards);
    expect(result).toHaveLength(1);
    expect(result[0].system).toBe('UNKNOWN');
  });

  it('counts cards at risk (R < 0.9 at day 7)', () => {
    // Stability 2 + 7 days = R ≈ 0.03 → definitely at risk
    const riskCards = Array.from({ length: 3 }, (_, i) =>
      freshCard({ conditionId: `risk-${i}`, system: 'AT_RISK', stability: 2 })
    );
    const result = calculateSystemDrift(riskCards);
    expect(result[0].cardsAtRisk).toBe(3);
  });
});

// ─── calculateSessionImpact ─────────────────────────────────────────────────

describe('calculateSessionImpact', () => {
  it('reports positive scoreDelta when stability increases', () => {
    const before: FSRSCardData[] = [cardReviewedDaysAgo(5, { stability: 1 })];
    const after: FSRSCardData[] = [freshCard({ stability: 10 })];
    const result = calculateSessionImpact(before, after, ['cond-1']);
    expect(result.scoreDelta).toBeGreaterThan(0);
    expect(result.memoriesStabilized).toBe(1);
  });

  it('counts only cards whose stability actually increased', () => {
    const before: FSRSCardData[] = [
      freshCard({ conditionId: 'improved', stability: 5 }),
      freshCard({ conditionId: 'same', stability: 5 }),
    ];
    const after: FSRSCardData[] = [
      freshCard({ conditionId: 'improved', stability: 10 }),
      freshCard({ conditionId: 'same', stability: 5 }),
    ];
    const result = calculateSessionImpact(before, after, ['improved', 'same']);
    expect(result.memoriesStabilized).toBe(1);
  });

  it('returns 0 decayPrevented when before and after are identical', () => {
    const cards = [freshCard()];
    const result = calculateSessionImpact(cards, cards, []);
    expect(result.decayPrevented).toBe(0);
    expect(result.scoreDelta).toBe(0);
  });
});

// ─── Messaging ──────────────────────────────────────────────────────────────

describe('getDriftMessage', () => {
  it('returns below-passing warning when score is below passing', () => {
    const drift = calculateDriftVector([cardReviewedDaysAgo(100, { stability: 1 })]);
    const msg = getDriftMessage(drift);
    expect(msg.toLowerCase()).toContain('below passing');
  });

  it('returns stable message for low urgency', () => {
    const drift = calculateDriftVector([freshCard({ stability: 365 })]);
    const msg = getDriftMessage(drift);
    expect(msg.toLowerCase()).toContain('stable');
  });
});

describe('getDriftStatusLabel', () => {
  it('returns emoji-prefixed label for each urgency level', () => {
    const lowDrift = calculateDriftVector([freshCard({ stability: 365 })]);
    const critDrift = calculateDriftVector([cardReviewedDaysAgo(100, { stability: 1 })]);
    expect(getDriftStatusLabel(lowDrift)).toMatch(/Stable/);
    expect(getDriftStatusLabel(critDrift)).toMatch(/Critical/);
  });
});
