import { describe, it, expect } from 'vitest';
import {
  normalizeSystemName,
  calculatePredictedScore,
  calculatePassLikelihood,
  determineScoreConfidence,
  calculateCosineSimilarity,
  identifyWeakestAndStrongest,
  ROLLING_WINDOW_SIZE,
  PANCE_SCORE_MIN,
  PANCE_SCORE_MAX,
  PANCE_PASSING_SCORE,
  CONFIDENCE_COLLECTING_THRESHOLD,
  CONFIDENCE_PROVISIONAL_THRESHOLD,
  CALIBRATION_STEP_THRESHOLDS,
  type SystemStats,
} from './rolling360Service';

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

  it('maps CV → Cardiovascular', () => {
    expect(normalizeSystemName('CV')).toBe('Cardiovascular');
  });

  it('maps lowercase cv → Cardiovascular', () => {
    expect(normalizeSystemName('cv')).toBe('Cardiovascular');
  });

  it('maps CARDIO → Cardiovascular', () => {
    expect(normalizeSystemName('CARDIO')).toBe('Cardiovascular');
  });

  it('maps PULM → Pulmonary', () => {
    expect(normalizeSystemName('PULM')).toBe('Pulmonary');
  });

  it('maps GI → Gastrointestinal', () => {
    expect(normalizeSystemName('GI')).toBe('Gastrointestinal');
  });

  it('maps ENT → HEENT', () => {
    expect(normalizeSystemName('ENT')).toBe('HEENT');
  });

  it('maps OB/GYN → Reproductive', () => {
    expect(normalizeSystemName('OB/GYN')).toBe('Reproductive');
  });

  it('maps NEURO → Neurological', () => {
    expect(normalizeSystemName('NEURO')).toBe('Neurological');
  });

  it('maps NEPHRO → Renal', () => {
    expect(normalizeSystemName('NEPHRO')).toBe('Renal');
  });

  it('maps ID → Infectious Disease', () => {
    expect(normalizeSystemName('ID')).toBe('Infectious Disease');
  });

  it('returns title-cased unknown system', () => {
    expect(normalizeSystemName('dermatology')).toBe('Dermatology');
  });

  it('handles extra whitespace', () => {
    expect(normalizeSystemName('  CV  ')).toBe('Cardiovascular');
  });
});

// ─── calculatePredictedScore ──────────────────────────────────────────────────

describe('calculatePredictedScore', () => {
  it('returns null for null accuracy', () => {
    expect(calculatePredictedScore(null)).toBeNull();
  });

  it('returns null for undefined accuracy', () => {
    expect(calculatePredictedScore(undefined as unknown as null)).toBeNull();
  });

  it('maps 0% → PANCE_SCORE_MIN (200)', () => {
    expect(calculatePredictedScore(0)).toBe(PANCE_SCORE_MIN);
  });

  it('maps 100% → PANCE_SCORE_MAX (800)', () => {
    expect(calculatePredictedScore(100)).toBe(PANCE_SCORE_MAX);
  });

  it('maps 50% → 500 (midpoint)', () => {
    // 200 + 0.5 * 600 = 500
    expect(calculatePredictedScore(50)).toBe(500);
  });

  it('clamps negative accuracy to 0% (returns 200)', () => {
    expect(calculatePredictedScore(-10)).toBe(PANCE_SCORE_MIN);
  });

  it('clamps accuracy over 100 to 100% (returns 800)', () => {
    expect(calculatePredictedScore(110)).toBe(PANCE_SCORE_MAX);
  });

  it('returns an integer (rounds)', () => {
    const score = calculatePredictedScore(33.33);
    expect(score).not.toBeNull();
    expect(Number.isInteger(score)).toBe(true);
  });

  it('is linear between 0 and 100', () => {
    const s25 = calculatePredictedScore(25)!;
    const s75 = calculatePredictedScore(75)!;
    // Midpoint should be 500
    expect((s25 + s75) / 2).toBeCloseTo(500, 0);
  });
});

// ─── calculatePassLikelihood ──────────────────────────────────────────────────

describe('calculatePassLikelihood', () => {
  it('returns null for null score', () => {
    expect(calculatePassLikelihood(null)).toBeNull();
  });

  it('returns ~50 at passing score (350)', () => {
    const likelihood = calculatePassLikelihood(PANCE_PASSING_SCORE);
    expect(likelihood).not.toBeNull();
    expect(likelihood!).toBeCloseTo(50, 0);
  });

  it('returns value > 50 for score above passing', () => {
    expect(calculatePassLikelihood(500)!).toBeGreaterThan(50);
  });

  it('returns value < 50 for score below passing', () => {
    expect(calculatePassLikelihood(200)!).toBeLessThan(50);
  });

  it('stays between 0 and 100', () => {
    for (const score of [200, 350, 500, 650, 800]) {
      const l = calculatePassLikelihood(score);
      expect(l).not.toBeNull();
      expect(l!).toBeGreaterThanOrEqual(0);
      expect(l!).toBeLessThanOrEqual(100);
    }
  });

  it('returns a number with at most 2 decimal places', () => {
    const l = calculatePassLikelihood(500)!;
    const rounded = Math.round(l * 100) / 100;
    expect(l).toBeCloseTo(rounded, 10);
  });
});

// ─── determineScoreConfidence ─────────────────────────────────────────────────

describe('determineScoreConfidence', () => {
  it('returns "collecting" for 0 samples', () => {
    expect(determineScoreConfidence(0)).toBe('collecting');
  });

  it('returns "collecting" just below collecting threshold', () => {
    expect(determineScoreConfidence(CONFIDENCE_COLLECTING_THRESHOLD - 1)).toBe('collecting');
  });

  it('returns "provisional" at collecting threshold', () => {
    expect(determineScoreConfidence(CONFIDENCE_COLLECTING_THRESHOLD)).toBe('provisional');
  });

  it('returns "provisional" in the middle of the provisional range', () => {
    const mid = Math.floor((CONFIDENCE_COLLECTING_THRESHOLD + CONFIDENCE_PROVISIONAL_THRESHOLD) / 2);
    expect(determineScoreConfidence(mid)).toBe('provisional');
  });

  it('returns "provisional" just below provisional threshold', () => {
    expect(determineScoreConfidence(CONFIDENCE_PROVISIONAL_THRESHOLD - 1)).toBe('provisional');
  });

  it('returns "confident" at provisional threshold', () => {
    expect(determineScoreConfidence(CONFIDENCE_PROVISIONAL_THRESHOLD)).toBe('confident');
  });

  it('returns "confident" at full window size (360)', () => {
    expect(determineScoreConfidence(ROLLING_WINDOW_SIZE)).toBe('confident');
  });
});

// ─── calculateCosineSimilarity ────────────────────────────────────────────────

describe('calculateCosineSimilarity', () => {
  it('returns 1.0 for identical distributions', () => {
    const dist = { Cardio: 0.5, Pulmonary: 0.5 };
    expect(calculateCosineSimilarity(dist, dist)).toBeCloseTo(1, 5);
  });

  it('returns 0 when actual is empty', () => {
    const expected = { Cardio: 0.5 };
    expect(calculateCosineSimilarity({}, expected)).toBe(0);
  });

  it('returns 0 when expected is empty', () => {
    const actual = { Cardio: 0.5 };
    expect(calculateCosineSimilarity(actual, {})).toBe(0);
  });

  it('returns < 1 for partially overlapping distributions', () => {
    const actual = { Cardio: 0.8, Pulmonary: 0.2 };
    const expected = { Cardio: 0.2, Pulmonary: 0.8 };
    const sim = calculateCosineSimilarity(actual, expected);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it('returns 0 for completely orthogonal distributions', () => {
    // Actual has Cardio only, expected has Pulmonary only
    const actual = { Cardio: 1 };
    const expected = { Pulmonary: 1 };
    expect(calculateCosineSimilarity(actual, expected)).toBeCloseTo(0, 5);
  });

  it('handles extra keys in actual not in expected', () => {
    const actual = { Cardio: 0.5, Extra: 0.5 };
    const expected = { Cardio: 1.0 };
    const sim = calculateCosineSimilarity(actual, expected);
    // Should be between 0 and 1
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('is symmetric', () => {
    const a = { Cardio: 0.6, Pulmonary: 0.4 };
    const b = { Cardio: 0.3, Pulmonary: 0.7 };
    expect(calculateCosineSimilarity(a, b)).toBeCloseTo(calculateCosineSimilarity(b, a), 10);
  });
});

// ─── identifyWeakestAndStrongest ──────────────────────────────────────────────

describe('identifyWeakestAndStrongest', () => {
  function makeStats(accuracy: number, total = 10): SystemStats {
    return { total, correct: Math.round(accuracy * total), accuracy: accuracy * 100 };
  }

  it('returns empty arrays when no systems have enough data', () => {
    const systemStats = { Cardio: makeStats(0.8, 2) };
    const { weakest, strongest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(weakest).toHaveLength(0);
    expect(strongest).toHaveLength(0);
  });

  it('uses default minAttempts of 5', () => {
    const systemStats = { Cardio: makeStats(0.8, 4) }; // 4 < 5
    const { weakest } = identifyWeakestAndStrongest(systemStats);
    expect(weakest).toHaveLength(0);
  });

  it('identifies the weakest system correctly', () => {
    const systemStats = {
      Cardio: makeStats(0.9),
      Pulmonary: makeStats(0.3),
      Neuro: makeStats(0.7),
    };
    const { weakest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(weakest[0]).toBe('Pulmonary');
  });

  it('identifies the strongest system correctly', () => {
    const systemStats = {
      Cardio: makeStats(0.9),
      Pulmonary: makeStats(0.3),
      Neuro: makeStats(0.7),
    };
    const { strongest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(strongest[0]).toBe('Cardio');
  });

  it('returns up to 3 weakest systems', () => {
    const systemStats: Record<string, SystemStats> = {};
    const systems = ['A', 'B', 'C', 'D', 'E'];
    systems.forEach((s, i) => {
      systemStats[s] = makeStats(0.1 * (i + 1));
    });
    const { weakest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(weakest).toHaveLength(3);
  });

  it('returns up to 3 strongest systems', () => {
    const systemStats: Record<string, SystemStats> = {};
    const systems = ['A', 'B', 'C', 'D', 'E'];
    systems.forEach((s, i) => {
      systemStats[s] = makeStats(0.1 * (i + 1));
    });
    const { strongest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(strongest).toHaveLength(3);
  });

  it('strongest is returned in descending accuracy order', () => {
    const systemStats = {
      A: makeStats(0.5),
      B: makeStats(0.9),
      C: makeStats(0.7),
    };
    const { strongest } = identifyWeakestAndStrongest(systemStats, 5);
    // B (0.9) should be first, C (0.7) second, A (0.5) third
    expect(strongest[0]).toBe('B');
    expect(strongest[1]).toBe('C');
  });

  it('weakest is returned in ascending accuracy order', () => {
    const systemStats = {
      A: makeStats(0.3),
      B: makeStats(0.1),
      C: makeStats(0.5),
    };
    const { weakest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(weakest[0]).toBe('B');
    expect(weakest[1]).toBe('A');
  });

  it('handles single eligible system', () => {
    const systemStats = { Cardio: makeStats(0.7) };
    const { weakest, strongest } = identifyWeakestAndStrongest(systemStats, 5);
    expect(weakest).toHaveLength(1);
    expect(strongest).toHaveLength(1);
    expect(weakest[0]).toBe('Cardio');
    expect(strongest[0]).toBe('Cardio');
  });
});

// ─── Constants sanity checks ──────────────────────────────────────────────────

describe('constants', () => {
  it('ROLLING_WINDOW_SIZE is 360', () => {
    expect(ROLLING_WINDOW_SIZE).toBe(360);
  });

  it('PANCE score range is 200-800', () => {
    expect(PANCE_SCORE_MIN).toBe(200);
    expect(PANCE_SCORE_MAX).toBe(800);
  });

  it('PANCE_PASSING_SCORE is 350', () => {
    expect(PANCE_PASSING_SCORE).toBe(350);
  });

  it('confidence thresholds are ordered correctly', () => {
    expect(CONFIDENCE_COLLECTING_THRESHOLD).toBeLessThan(CONFIDENCE_PROVISIONAL_THRESHOLD);
    expect(CONFIDENCE_PROVISIONAL_THRESHOLD).toBeLessThan(ROLLING_WINDOW_SIZE);
  });

  it('calibration step thresholds increase monotonically', () => {
    const { BASELINE, LATENCY, METACOGNITION, ERROR_TYPOLOGY } = CALIBRATION_STEP_THRESHOLDS;
    expect(BASELINE).toBeLessThan(LATENCY);
    expect(LATENCY).toBeLessThan(METACOGNITION);
    expect(METACOGNITION).toBeLessThan(ERROR_TYPOLOGY);
  });
});
