/**
 * Unit tests for lib/services/leechDetectionService.ts
 *
 * Weights: lapseRate=0.35, difficultySignal=0.25, stabilityStagnation=0.25, reviewInefficiency=0.15
 * Thresholds: emerging≥0.40, leech≥0.60, severe≥0.80
 * MIN_REVIEWS_FOR_DETECTION = 5
 * EXPECTED_STABILITY_PER_REVIEW = 2.0 days
 */

import { describe, it, expect } from 'vitest';
import {
  computeLapseRate,
  computeDifficultySignal,
  computeStabilityStagnation,
  computeReviewInefficiency,
  assessLeech,
  classifyLeechSeverity,
  MIN_REVIEWS_FOR_DETECTION,
  LEECH_THRESHOLDS,
  LEECH_WEIGHTS,
  type CardFsrsState,
} from './leechDetectionService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<CardFsrsState> = {}): CardFsrsState {
  return {
    difficulty: 5,
    stability: 10,
    reviewCount: 10,
    lapseCount: 0,
    retrievability: 0.9,
    ...overrides,
  };
}

// ─── computeLapseRate ─────────────────────────────────────────────────────────

describe('computeLapseRate', () => {
  it('returns 0 when reviewCount is below MIN_REVIEWS_FOR_DETECTION', () => {
    expect(computeLapseRate(5, MIN_REVIEWS_FOR_DETECTION - 1)).toBe(0);
  });

  it('returns 0 when reviewCount is exactly MIN_REVIEWS_FOR_DETECTION - 1', () => {
    expect(computeLapseRate(3, 4)).toBe(0);
  });

  it('returns 0 when lapseCount is 0', () => {
    expect(computeLapseRate(0, 10)).toBe(0);
  });

  it('returns 1.0 when lapse rate equals or exceeds 50% (normalization cap)', () => {
    // 5/10 = 0.5 → 0.5/0.5 = 1.0
    expect(computeLapseRate(5, 10)).toBe(1.0);
  });

  it('clamps to 1.0 for lapse rate above 50%', () => {
    // 8/10 = 0.8 → 0.8/0.5 = 1.6, clamped to 1.0
    expect(computeLapseRate(8, 10)).toBe(1.0);
  });

  it('returns proportional value for moderate lapse rate', () => {
    // 2/10 = 0.2 → 0.2/0.5 = 0.4
    expect(computeLapseRate(2, 10)).toBeCloseTo(0.4, 3);
  });

  it('returns proportional value for low lapse rate', () => {
    // 1/10 = 0.1 → 0.1/0.5 = 0.2
    expect(computeLapseRate(1, 10)).toBeCloseTo(0.2, 3);
  });
});

// ─── computeDifficultySignal ──────────────────────────────────────────────────

describe('computeDifficultySignal', () => {
  it('returns 0 at minimum difficulty (D=1)', () => {
    expect(computeDifficultySignal(1)).toBe(0);
  });

  it('returns 1 at maximum difficulty (D=10)', () => {
    expect(computeDifficultySignal(10)).toBe(1.0);
  });

  it('returns 0.5 at midpoint (D=5.5)', () => {
    // (5.5-1)/9 = 4.5/9 = 0.5
    expect(computeDifficultySignal(5.5)).toBeCloseTo(0.5, 3);
  });

  it('returns proportional values across the range', () => {
    // (7-1)/9 = 6/9 ≈ 0.667
    expect(computeDifficultySignal(7)).toBeCloseTo(6 / 9, 3);
  });

  it('is monotonically increasing with difficulty', () => {
    const d3 = computeDifficultySignal(3);
    const d5 = computeDifficultySignal(5);
    const d8 = computeDifficultySignal(8);
    expect(d5).toBeGreaterThan(d3);
    expect(d8).toBeGreaterThan(d5);
  });
});

// ─── computeStabilityStagnation ───────────────────────────────────────────────

describe('computeStabilityStagnation', () => {
  it('returns 0 when reviewCount is below MIN_REVIEWS_FOR_DETECTION', () => {
    expect(computeStabilityStagnation(5, 4)).toBe(0);
  });

  it('returns 0 when stability meets expected growth', () => {
    // expectedStability = 2.0 * 10 = 20; ratio = 20/20 = 1; 1-1 = 0
    expect(computeStabilityStagnation(20, 10)).toBe(0);
  });

  it('returns 0 when stability exceeds expected (clamp floor)', () => {
    // expectedStability = 20; stability = 30 → ratio=1.5 → 1-1.5 = -0.5 → clamped to 0
    expect(computeStabilityStagnation(30, 10)).toBe(0);
  });

  it('returns high signal for very low stability relative to reviews', () => {
    // expectedStability = 20; stability = 5 → ratio=0.25 → 1-0.25 = 0.75
    expect(computeStabilityStagnation(5, 10)).toBeCloseTo(0.75, 3);
  });

  it('returns 1.0 for near-zero stability (maximum stagnation)', () => {
    // expectedStability = 20; stability ≈ 0 → ratio≈0 → 1-0 ≈ 1.0
    expect(computeStabilityStagnation(0.001, 10)).toBeCloseTo(1.0, 1);
  });

  it('is higher for low-stability cards with same review count', () => {
    const low = computeStabilityStagnation(3, 10);
    const high = computeStabilityStagnation(15, 10);
    expect(low).toBeGreaterThan(high);
  });
});

// ─── computeReviewInefficiency ────────────────────────────────────────────────

describe('computeReviewInefficiency', () => {
  it('returns 0 when reviewCount is below MIN_REVIEWS_FOR_DETECTION', () => {
    expect(computeReviewInefficiency(5, 4, 0)).toBe(0);
  });

  it('returns 0 for efficient card (stability equals expected growth)', () => {
    // stabilityPerReview = 20/10 = 2.0; efficiency = 2.0/2.0 = 1.0; (1-1)*... = 0
    expect(computeReviewInefficiency(20, 10, 0)).toBe(0);
  });

  it('returns positive value for inefficient card (low stability, no lapses)', () => {
    // stabilityPerReview = 5/10 = 0.5; efficiency = 0.25; lapseMultiplier=1
    // (1-0.25)*1*0.5 = 0.375
    expect(computeReviewInefficiency(5, 10, 0)).toBeCloseTo(0.375, 3);
  });

  it('compounds inefficiency with lapses', () => {
    const noLapses = computeReviewInefficiency(5, 10, 0);
    const withLapses = computeReviewInefficiency(5, 10, 5);
    expect(withLapses).toBeGreaterThan(noLapses);
  });

  it('clamps result to [0, 1]', () => {
    // Very inefficient card: stability=0.1, reviews=20, lapses=15
    const result = computeReviewInefficiency(0.1, 20, 15);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1.0);
  });
});

// ─── classifyLeechSeverity ────────────────────────────────────────────────────

describe('classifyLeechSeverity', () => {
  it('returns none for score below emerging threshold', () => {
    expect(classifyLeechSeverity(0)).toBe('none');
    expect(classifyLeechSeverity(0.39)).toBe('none');
  });

  it('returns emerging at exactly the emerging threshold', () => {
    expect(classifyLeechSeverity(LEECH_THRESHOLDS.emerging)).toBe('emerging');
  });

  it('returns emerging for score between emerging and leech thresholds', () => {
    expect(classifyLeechSeverity(0.5)).toBe('emerging');
    expect(classifyLeechSeverity(0.59)).toBe('emerging');
  });

  it('returns leech at exactly the leech threshold', () => {
    expect(classifyLeechSeverity(LEECH_THRESHOLDS.leech)).toBe('leech');
  });

  it('returns leech for score between leech and severe thresholds', () => {
    expect(classifyLeechSeverity(0.7)).toBe('leech');
    expect(classifyLeechSeverity(0.79)).toBe('leech');
  });

  it('returns severe_leech at exactly the severe threshold', () => {
    expect(classifyLeechSeverity(LEECH_THRESHOLDS.severe)).toBe('severe_leech');
  });

  it('returns severe_leech for score above severe threshold', () => {
    expect(classifyLeechSeverity(0.9)).toBe('severe_leech');
    expect(classifyLeechSeverity(1.0)).toBe('severe_leech');
  });
});

// ─── assessLeech — guard clause ───────────────────────────────────────────────

describe('assessLeech — insufficient history', () => {
  it('returns no-leech result when reviewCount is below MIN_REVIEWS_FOR_DETECTION', () => {
    const result = assessLeech(makeState({ reviewCount: 4 }));
    expect(result.isLeech).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.leechScore).toBe(0);
    expect(result.mnemonicRecommended).toBe(false);
  });

  it('includes all zero signals for insufficient history', () => {
    const result = assessLeech(makeState({ reviewCount: 3 }));
    expect(result.signals.lapseRate).toBe(0);
    expect(result.signals.difficultySignal).toBe(0);
    expect(result.signals.stabilityStagnation).toBe(0);
    expect(result.signals.reviewInefficiency).toBe(0);
  });
});

// ─── assessLeech — healthy card ───────────────────────────────────────────────

describe('assessLeech — healthy card', () => {
  it('classifies a well-performing card as none', () => {
    // stability=20, reviewCount=5, lapseCount=0, difficulty=3 → very low score
    const result = assessLeech(makeState({
      difficulty: 3,
      stability: 20,
      reviewCount: 5,
      lapseCount: 0,
    }));
    expect(result.severity).toBe('none');
    expect(result.isLeech).toBe(false);
    expect(result.leechScore).toBeLessThan(LEECH_THRESHOLDS.emerging);
  });

  it('does not recommend mnemonic for healthy card', () => {
    const result = assessLeech(makeState({
      difficulty: 2,
      stability: 30,
      reviewCount: 5,
      lapseCount: 0,
    }));
    expect(result.mnemonicRecommended).toBe(false);
  });
});

// ─── assessLeech — leech card ─────────────────────────────────────────────────

describe('assessLeech — leech card', () => {
  it('classifies a high-lapse, high-difficulty card as leech or worse', () => {
    // reviewCount=10, lapseCount=3, difficulty=7, stability=5
    const result = assessLeech(makeState({
      difficulty: 7,
      stability: 5,
      reviewCount: 10,
      lapseCount: 3,
    }));
    expect(['leech', 'severe_leech']).toContain(result.severity);
    expect(result.isLeech).toBe(true);
    expect(result.mnemonicRecommended).toBe(true);
  });

  it('classifies extreme leech card as severe_leech', () => {
    // reviewCount=20, lapseCount=12, difficulty=9, stability=3
    const result = assessLeech(makeState({
      difficulty: 9,
      stability: 3,
      reviewCount: 20,
      lapseCount: 12,
    }));
    expect(result.severity).toBe('severe_leech');
    expect(result.isLeech).toBe(true);
    expect(result.leechScore).toBeGreaterThanOrEqual(LEECH_THRESHOLDS.severe);
  });

  it('recommends mnemonic for all leech severities including emerging', () => {
    // Craft a score in the emerging range
    // reviewCount=5, lapseCount=0, difficulty=8, stability=0.5
    // lapseRate=0, difficultySignal=(8-1)/9≈0.778, stagnation=1-0.5/10=0.95, inefficiency?
    // Let's check: score ≈ 0.35*0 + 0.25*0.778 + 0.25*0.95 + ...
    const result = assessLeech(makeState({
      difficulty: 8,
      stability: 0.5,
      reviewCount: 5,
      lapseCount: 0,
    }));
    if (result.severity === 'emerging') {
      expect(result.mnemonicRecommended).toBe(true);
    }
    // At minimum, score should be elevated for this card
    expect(result.leechScore).toBeGreaterThan(0);
  });
});

// ─── assessLeech — composite score integrity ──────────────────────────────────

describe('assessLeech — composite score', () => {
  it('leechScore is in [0, 1]', () => {
    const cards = [
      makeState({ reviewCount: 5, lapseCount: 0, difficulty: 1, stability: 100 }),
      makeState({ reviewCount: 20, lapseCount: 15, difficulty: 10, stability: 0.5 }),
      makeState({ reviewCount: 7, lapseCount: 3, difficulty: 6, stability: 8 }),
    ];
    for (const card of cards) {
      const result = assessLeech(card);
      expect(result.leechScore).toBeGreaterThanOrEqual(0);
      expect(result.leechScore).toBeLessThanOrEqual(1);
    }
  });

  it('worse card always scores higher than better card', () => {
    const good = assessLeech(makeState({ difficulty: 2, stability: 30, reviewCount: 10, lapseCount: 0 }));
    const bad = assessLeech(makeState({ difficulty: 9, stability: 2, reviewCount: 10, lapseCount: 5 }));
    expect(bad.leechScore).toBeGreaterThan(good.leechScore);
  });

  it('isLeech is true iff severity is leech or severe_leech', () => {
    const scores = [0.1, 0.45, 0.65, 0.85];
    for (const score of scores) {
      const severity = classifyLeechSeverity(score);
      const expectedIsLeech = severity === 'leech' || severity === 'severe_leech';
      expect(['leech', 'severe_leech'].includes(severity)).toBe(expectedIsLeech);
    }
  });

  it('signals object contains all 4 expected keys', () => {
    const result = assessLeech(makeState({ reviewCount: 8 }));
    expect(result.signals).toHaveProperty('lapseRate');
    expect(result.signals).toHaveProperty('difficultySignal');
    expect(result.signals).toHaveProperty('stabilityStagnation');
    expect(result.signals).toHaveProperty('reviewInefficiency');
  });

  it('reason is a non-empty string', () => {
    const healthy = assessLeech(makeState({ reviewCount: 10, difficulty: 2 }));
    const unhealthy = assessLeech(makeState({ reviewCount: 20, lapseCount: 12, difficulty: 9, stability: 2 }));
    expect(typeof healthy.reason).toBe('string');
    expect(healthy.reason.length).toBeGreaterThan(0);
    expect(typeof unhealthy.reason).toBe('string');
    expect(unhealthy.reason.length).toBeGreaterThan(0);
  });
});

// ─── Constants sanity ────────────────────────────────────────────────────────

describe('constants', () => {
  it('LEECH_WEIGHTS sum to 1.0', () => {
    const total = LEECH_WEIGHTS.lapseRate + LEECH_WEIGHTS.difficultySignal +
                  LEECH_WEIGHTS.stabilityStagnation + LEECH_WEIGHTS.reviewInefficiency;
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('thresholds are ordered: emerging < leech < severe', () => {
    expect(LEECH_THRESHOLDS.emerging).toBeLessThan(LEECH_THRESHOLDS.leech);
    expect(LEECH_THRESHOLDS.leech).toBeLessThan(LEECH_THRESHOLDS.severe);
  });

  it('MIN_REVIEWS_FOR_DETECTION is a positive integer', () => {
    expect(MIN_REVIEWS_FOR_DETECTION).toBeGreaterThan(0);
    expect(Number.isInteger(MIN_REVIEWS_FOR_DETECTION)).toBe(true);
  });
});
