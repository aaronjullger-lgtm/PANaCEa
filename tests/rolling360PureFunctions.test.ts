/**
 * Unit tests for rolling360Service pure functions.
 * Tests the math-only exports — no DB, no Prisma mock needed.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeSystemName,
  calculatePredictedScore,
  calculatePassLikelihood,
  determineScoreConfidence,
  calculateCosineSimilarity,
  identifyWeakestAndStrongest,
  PANCE_SCORE_MIN,
  PANCE_SCORE_MAX,
  PANCE_PASSING_SCORE,
  CONFIDENCE_COLLECTING_THRESHOLD,
  CONFIDENCE_PROVISIONAL_THRESHOLD,
  ROLLING_WINDOW_SIZE,
  type SystemStats,
} from '../lib/services/rolling360Service';

// ─── normalizeSystemName ──────────────────────────────────────────────────────

describe('normalizeSystemName', () => {
  it('returns "Unknown" for null', () => {
    expect(normalizeSystemName(null)).toBe('Unknown');
  });

  it('returns "Unknown" for undefined', () => {
    expect(normalizeSystemName(undefined)).toBe('Unknown');
  });

  it('returns "Unknown" for empty string', () => {
    expect(normalizeSystemName('')).toBe('Unknown');
  });

  it.each([
    ['CV', 'Cardiovascular'],
    ['CARDIO', 'Cardiovascular'],
    ['PULM', 'Pulmonary'],
    ['GI', 'Gastrointestinal'],
    ['MSK', 'Musculoskeletal'],
    ['HEENT', 'HEENT'],
    ['ENT', 'HEENT'],
    ['REPRO', 'Reproductive'],
    ['OB/GYN', 'Reproductive'],
    ['NEURO', 'Neurological'],
    ['PSYCH', 'Psychiatry'],
    ['ENDO', 'Endocrine'],
    ['DERM', 'Dermatology'],
    ['GU', 'Genitourinary'],
    ['HEME', 'Hematology'],
    ['ID', 'Infectious Disease'],
    ['RENAL', 'Renal'],
    ['NEPHRO', 'Renal'],
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizeSystemName(input)).toBe(expected);
  });

  it('is case-insensitive for abbreviations (lowercase input)', () => {
    expect(normalizeSystemName('cv')).toBe('Cardiovascular');
    expect(normalizeSystemName('pulm')).toBe('Pulmonary');
  });

  it('returns title-case for unknown strings', () => {
    expect(normalizeSystemName('neurology')).toBe('Neurology');
    expect(normalizeSystemName('unknown system')).toBe('Unknown system');
  });
});

// ─── calculatePredictedScore ──────────────────────────────────────────────────

describe('calculatePredictedScore', () => {
  it('returns null for null input', () => {
    expect(calculatePredictedScore(null)).toBeNull();
  });

  it('returns 200 (PANCE_SCORE_MIN) for 0% accuracy', () => {
    expect(calculatePredictedScore(0)).toBe(PANCE_SCORE_MIN);
  });

  it('returns 800 (PANCE_SCORE_MAX) for 100% accuracy', () => {
    expect(calculatePredictedScore(100)).toBe(PANCE_SCORE_MAX);
  });

  it('returns 500 for 50% accuracy (midpoint)', () => {
    // 200 + (50/100) * 600 = 200 + 300 = 500
    expect(calculatePredictedScore(50)).toBe(500);
  });

  it('returns passing score ~350 at ~25% accuracy', () => {
    // 200 + (x/100)*600 = 350 → x = 25
    expect(calculatePredictedScore(25)).toBe(PANCE_PASSING_SCORE);
  });

  it('clamps values below 0 to 0', () => {
    expect(calculatePredictedScore(-10)).toBe(PANCE_SCORE_MIN);
  });

  it('clamps values above 100 to 100', () => {
    expect(calculatePredictedScore(110)).toBe(PANCE_SCORE_MAX);
  });

  it('returns a rounded integer', () => {
    const score = calculatePredictedScore(33.3);
    expect(score).toBe(Math.round(score!));
    expect(Number.isInteger(score)).toBe(true);
  });

  it('is monotonically increasing', () => {
    for (let a = 0; a < 100; a++) {
      expect(calculatePredictedScore(a + 1)!).toBeGreaterThan(calculatePredictedScore(a)! - 1);
    }
  });
});

// ─── calculatePassLikelihood ──────────────────────────────────────────────────

describe('calculatePassLikelihood', () => {
  it('returns null for null input', () => {
    expect(calculatePassLikelihood(null)).toBeNull();
  });

  it('returns ~50 at PANCE_PASSING_SCORE (350)', () => {
    const likelihood = calculatePassLikelihood(PANCE_PASSING_SCORE);
    expect(likelihood).toBeCloseTo(50, 0);
  });

  it('returns >50 for scores above passing', () => {
    expect(calculatePassLikelihood(500)!).toBeGreaterThan(50);
  });

  it('returns <50 for scores below passing', () => {
    expect(calculatePassLikelihood(250)!).toBeLessThan(50);
  });

  it('approaches 100 for very high scores', () => {
    expect(calculatePassLikelihood(800)!).toBeGreaterThan(95);
  });

  it('approaches 0 for very low scores', () => {
    expect(calculatePassLikelihood(200)!).toBeLessThan(5);
  });

  it('is monotonically non-decreasing', () => {
    // Sigmoid saturates at high scores (700 and 800 both round to 100.00),
    // so we use ≥ rather than strict > to handle the flat tail.
    const scores = [200, 250, 300, 350, 400, 450, 500, 600, 700, 800];
    for (let i = 0; i < scores.length - 1; i++) {
      expect(calculatePassLikelihood(scores[i + 1])!).toBeGreaterThanOrEqual(
        calculatePassLikelihood(scores[i])!
      );
    }
  });

  it('returns a value in [0, 100]', () => {
    for (const score of [200, 350, 500, 800]) {
      const val = calculatePassLikelihood(score)!;
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});

// ─── determineScoreConfidence ─────────────────────────────────────────────────

describe('determineScoreConfidence', () => {
  it('returns "collecting" for 0 samples', () => {
    expect(determineScoreConfidence(0)).toBe('collecting');
  });

  it('returns "collecting" for samples < 50 (CONFIDENCE_COLLECTING_THRESHOLD)', () => {
    expect(determineScoreConfidence(1)).toBe('collecting');
    expect(determineScoreConfidence(49)).toBe('collecting');
  });

  it('returns "provisional" at exactly the collecting threshold (50)', () => {
    expect(determineScoreConfidence(CONFIDENCE_COLLECTING_THRESHOLD)).toBe('provisional');
  });

  it('returns "provisional" between thresholds (50–179)', () => {
    expect(determineScoreConfidence(100)).toBe('provisional');
    expect(determineScoreConfidence(179)).toBe('provisional');
  });

  it('returns "confident" at exactly the provisional threshold (180)', () => {
    expect(determineScoreConfidence(CONFIDENCE_PROVISIONAL_THRESHOLD)).toBe('confident');
  });

  it('returns "confident" for sample sizes >= 180', () => {
    expect(determineScoreConfidence(180)).toBe('confident');
    expect(determineScoreConfidence(360)).toBe('confident');
    expect(determineScoreConfidence(ROLLING_WINDOW_SIZE)).toBe('confident');
  });
});

// ─── calculateCosineSimilarity ────────────────────────────────────────────────

describe('calculateCosineSimilarity', () => {
  it('returns 1.0 for identical distributions', () => {
    const dist = { CV: 0.3, PULM: 0.2, GI: 0.5 };
    expect(calculateCosineSimilarity(dist, dist)).toBeCloseTo(1.0, 5);
  });

  it('returns 0 when one distribution is all zeros', () => {
    const actual = { CV: 0, PULM: 0 };
    const expected = { CV: 0.5, PULM: 0.5 };
    expect(calculateCosineSimilarity(actual, expected)).toBe(0);
  });

  it('returns 0 when both distributions are empty objects', () => {
    expect(calculateCosineSimilarity({}, {})).toBe(0);
  });

  it('handles keys present in only one distribution (treats missing as 0)', () => {
    const actual = { CV: 1 };
    const expected = { PULM: 1 };
    // Orthogonal vectors → similarity = 0
    expect(calculateCosineSimilarity(actual, expected)).toBeCloseTo(0, 5);
  });

  it('returns value in [0, 1] for valid non-negative distributions', () => {
    const actual = { CV: 10, PULM: 20, GI: 30 };
    const expected = { CV: 15, PULM: 25, GI: 10 };
    const sim = calculateCosineSimilarity(actual, expected);
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('is commutative (swap actual/expected → same result)', () => {
    const a = { CV: 10, PULM: 20, GI: 30 };
    const b = { CV: 5, PULM: 25, GI: 15 };
    expect(calculateCosineSimilarity(a, b)).toBeCloseTo(calculateCosineSimilarity(b, a), 10);
  });
});

// ─── identifyWeakestAndStrongest ──────────────────────────────────────────────

describe('identifyWeakestAndStrongest', () => {
  const makeStats = (accuracy: number, total = 10): SystemStats => ({
    accuracy,
    total,
    correct: Math.round(accuracy * total / 100),
  });

  it('returns empty arrays when no systems have enough data', () => {
    const result = identifyWeakestAndStrongest(
      { CV: makeStats(70, 3), PULM: makeStats(80, 2) },
      5
    );
    expect(result.weakest).toHaveLength(0);
    expect(result.strongest).toHaveLength(0);
  });

  it('returns empty arrays for empty input', () => {
    const result = identifyWeakestAndStrongest({});
    expect(result.weakest).toHaveLength(0);
    expect(result.strongest).toHaveLength(0);
  });

  it('weakest is sorted ascending by accuracy', () => {
    const stats = {
      CV: makeStats(40),
      PULM: makeStats(55),
      GI: makeStats(70),
      NEURO: makeStats(85),
      DERM: makeStats(90),
    };
    const { weakest } = identifyWeakestAndStrongest(stats);
    expect(weakest[0]).toBe('CV');     // 40% — lowest
    expect(weakest[1]).toBe('PULM');   // 55%
    expect(weakest[2]).toBe('GI');     // 70%
  });

  it('strongest is sorted descending by accuracy', () => {
    const stats = {
      CV: makeStats(40),
      PULM: makeStats(55),
      GI: makeStats(70),
      NEURO: makeStats(85),
      DERM: makeStats(90),
    };
    const { strongest } = identifyWeakestAndStrongest(stats);
    expect(strongest[0]).toBe('DERM');   // 90% — highest
    expect(strongest[1]).toBe('NEURO');  // 85%
    expect(strongest[2]).toBe('GI');     // 70%
  });

  it('returns at most 3 in each category', () => {
    const stats: Record<string, SystemStats> = {};
    for (let i = 0; i < 10; i++) {
      stats[`SYS_${i}`] = makeStats(i * 10);
    }
    const { weakest, strongest } = identifyWeakestAndStrongest(stats);
    expect(weakest.length).toBeLessThanOrEqual(3);
    expect(strongest.length).toBeLessThanOrEqual(3);
  });

  it('respects custom minAttempts threshold', () => {
    const stats = {
      CV: makeStats(40, 3),   // below default minAttempts=5 but above custom 2
      PULM: makeStats(80, 10),
    };
    const resultDefault = identifyWeakestAndStrongest(stats, 5);
    expect(resultDefault.weakest).not.toContain('CV');

    const resultCustom = identifyWeakestAndStrongest(stats, 2);
    expect(resultCustom.weakest).toContain('CV');
  });

  it('weakest and strongest can overlap when fewer than 6 systems exist', () => {
    const stats = {
      CV: makeStats(40),
      PULM: makeStats(70),
      GI: makeStats(90),
    };
    const { weakest, strongest } = identifyWeakestAndStrongest(stats);
    // With only 3 systems, weakest[2] and strongest[2] are the same system
    expect(weakest).toHaveLength(3);
    expect(strongest).toHaveLength(3);
    // GI should appear in both (weakest[2] and strongest[0])
    expect(weakest).toContain('GI');
    expect(strongest).toContain('CV');
  });
});
