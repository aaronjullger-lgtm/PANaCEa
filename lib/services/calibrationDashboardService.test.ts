import { describe, it, expect } from 'vitest';
import {
  computeBrierScore,
  computeECE,
  buildReliabilityBins,
  computeMeanBias,
  classifyDirection,
  computeDomainBreakdown,
  computeWeeklyTrend,
  buildCalibrationDashboard,
  MIN_OBSERVATIONS_RELIABLE,
  MIN_DOMAIN_OBSERVATIONS,
  NUM_QUANTILE_BINS,
  type CalibrationObservation,
} from './calibrationDashboardService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeObs(predicted: number, actual: number, domain?: string, reviewedAt?: string): CalibrationObservation {
  return {
    predicted,
    actual,
    domain,
    reviewedAt: reviewedAt ?? '2026-04-01T10:00:00.000Z',
  };
}

/** Create N observations with given predicted/actual */
function makeN(n: number, predicted: number, actual: number, domain?: string): CalibrationObservation[] {
  return Array.from({ length: n }, (_, i) =>
    makeObs(predicted, actual, domain, `2026-04-${String(Math.floor(i / 7) + 1).padStart(2, '0')}T10:00:00.000Z`)
  );
}

/** Create observations perfectly calibrated: predicted == actual in expectation */
function makePerfectCalibration(n: number): CalibrationObservation[] {
  // Alternating 1.0 predicted + 1 actual, and 0.0 predicted + 0 actual → perfectly calibrated
  return Array.from({ length: n }, (_, i) =>
    makeObs(i % 2 === 0 ? 1.0 : 0.0, i % 2 === 0 ? 1 : 0)
  );
}

// ─── computeBrierScore ────────────────────────────────────────────────────────

describe('computeBrierScore', () => {
  it('returns 0.25 for empty array (random baseline)', () => {
    expect(computeBrierScore([])).toBe(0.25);
  });

  it('returns 0 for perfectly calibrated predictions (all predicted=actual)', () => {
    const obs = [
      { predicted: 1, actual: 1 },
      { predicted: 0, actual: 0 },
    ];
    expect(computeBrierScore(obs)).toBe(0);
  });

  it('returns 1 for worst-case predictions (always completely wrong)', () => {
    const obs = [
      { predicted: 1, actual: 0 },
      { predicted: 0, actual: 1 },
    ];
    // (1-0)^2 = 1, (0-1)^2 = 1 → mean = 1
    expect(computeBrierScore(obs)).toBe(1);
  });

  it('returns 1 for single observation with maximum error', () => {
    expect(computeBrierScore([{ predicted: 1, actual: 0 }])).toBe(1);
    expect(computeBrierScore([{ predicted: 0, actual: 1 }])).toBe(1);
  });

  it('computes mean squared error correctly', () => {
    // BS = ((0.8-1)^2 + (0.3-0)^2) / 2 = (0.04 + 0.09) / 2 = 0.065
    const obs = [
      { predicted: 0.8, actual: 1 },
      { predicted: 0.3, actual: 0 },
    ];
    expect(computeBrierScore(obs)).toBeCloseTo(0.065, 6);
  });

  it('is between 0 and 1 for realistic predictions', () => {
    const obs = [
      { predicted: 0.9, actual: 1 },
      { predicted: 0.6, actual: 1 },
      { predicted: 0.4, actual: 0 },
      { predicted: 0.1, actual: 0 },
    ];
    const bs = computeBrierScore(obs);
    expect(bs).toBeGreaterThanOrEqual(0);
    expect(bs).toBeLessThanOrEqual(1);
  });

  it('lower score for better-calibrated model', () => {
    const good = [{ predicted: 0.9, actual: 1 }, { predicted: 0.1, actual: 0 }];
    const bad = [{ predicted: 0.5, actual: 1 }, { predicted: 0.5, actual: 0 }];
    expect(computeBrierScore(good)).toBeLessThan(computeBrierScore(bad));
  });
});

// ─── computeMeanBias ──────────────────────────────────────────────────────────

describe('computeMeanBias', () => {
  it('returns 0 for empty array', () => {
    expect(computeMeanBias([])).toBe(0);
  });

  it('returns positive bias when overconfident', () => {
    const obs = [
      { predicted: 0.9, actual: 0 },
      { predicted: 0.8, actual: 0 },
    ];
    expect(computeMeanBias(obs)).toBeCloseTo(0.85, 5);
  });

  it('returns negative bias when underconfident', () => {
    const obs = [
      { predicted: 0.1, actual: 1 },
      { predicted: 0.2, actual: 1 },
    ];
    expect(computeMeanBias(obs)).toBeCloseTo(-0.85, 5);
  });

  it('returns 0 for perfectly calibrated predictions', () => {
    const obs = [
      { predicted: 0.8, actual: 1 },
      { predicted: 0.8, actual: 0.6 }, // not binary but symmetric
    ];
    // bias = (0.8-1 + 0.8-0.6) / 2 = (-0.2 + 0.2) / 2 = 0
    expect(computeMeanBias(obs)).toBeCloseTo(0, 10);
  });

  it('computes mean correctly for a single observation', () => {
    expect(computeMeanBias([{ predicted: 0.7, actual: 0.5 }])).toBeCloseTo(0.2, 5);
  });
});

// ─── classifyDirection ────────────────────────────────────────────────────────

describe('classifyDirection', () => {
  it('classifies large positive bias as overconfident', () => {
    expect(classifyDirection(0.1)).toBe('overconfident');
    expect(classifyDirection(0.5)).toBe('overconfident');
  });

  it('classifies large negative bias as underconfident', () => {
    expect(classifyDirection(-0.1)).toBe('underconfident');
    expect(classifyDirection(-0.5)).toBe('underconfident');
  });

  it('classifies zero bias as calibrated', () => {
    expect(classifyDirection(0)).toBe('calibrated');
  });

  it('classifies small positive bias within threshold as calibrated', () => {
    expect(classifyDirection(0.03)).toBe('calibrated');
    expect(classifyDirection(0.04)).toBe('calibrated');
  });

  it('classifies small negative bias within threshold as calibrated', () => {
    expect(classifyDirection(-0.03)).toBe('calibrated');
    expect(classifyDirection(-0.04)).toBe('calibrated');
  });

  it('classifies bias exactly at threshold boundary', () => {
    // BIAS_THRESHOLD = 0.05; strict comparison means 0.05 → overconfident
    expect(classifyDirection(0.05 + 0.001)).toBe('overconfident');
    expect(classifyDirection(-0.05 - 0.001)).toBe('underconfident');
  });
});

// ─── computeECE ──────────────────────────────────────────────────────────────

describe('computeECE', () => {
  it('returns 0 when fewer observations than bins', () => {
    const obs = Array.from({ length: NUM_QUANTILE_BINS - 1 }, () =>
      ({ predicted: 0.5, actual: 1 })
    );
    expect(computeECE(obs)).toBe(0);
  });

  it('returns 0 for perfectly calibrated predictions', () => {
    // 50 perfect predictions: predicted=0 actual=0, predicted=1 actual=1
    const obs = Array.from({ length: 50 }, (_, i) =>
      ({ predicted: i % 2 === 0 ? 1.0 : 0.0, actual: i % 2 === 0 ? 1 : 0 })
    );
    expect(computeECE(obs)).toBeCloseTo(0, 1);
  });

  it('returns > 0 for poorly calibrated predictions', () => {
    // All predict 0.9 but half are wrong
    const obs = Array.from({ length: 20 }, (_, i) =>
      ({ predicted: 0.9, actual: i % 2 === 0 ? 1 : 0 })
    );
    expect(computeECE(obs)).toBeGreaterThan(0);
  });

  it('is between 0 and 1', () => {
    const obs = Array.from({ length: 20 }, (_, i) =>
      ({ predicted: Math.random(), actual: i % 2 === 0 ? 1 : 0 })
    );
    const ece = computeECE(obs);
    expect(ece).toBeGreaterThanOrEqual(0);
    expect(ece).toBeLessThanOrEqual(1);
  });

  it('uses custom numBins parameter', () => {
    // fewer observations than bins → returns 0
    const obs = Array.from({ length: 4 }, () => ({ predicted: 0.5, actual: 1 }));
    expect(computeECE(obs, 5)).toBe(0);
    // 5 obs with 4 bins → processes; miscalibrated (predict 0.9, actual 0) → ece > 0
    const miscalib = Array.from({ length: 5 }, () => ({ predicted: 0.9, actual: 0 }));
    const ece = computeECE(miscalib, 4);
    expect(ece).toBeGreaterThan(0);
  });
});

// ─── buildReliabilityBins ────────────────────────────────────────────────────

describe('buildReliabilityBins', () => {
  it('returns empty array when fewer observations than bins', () => {
    const obs = Array.from({ length: NUM_QUANTILE_BINS - 1 }, () =>
      ({ predicted: 0.5, actual: 1 })
    );
    expect(buildReliabilityBins(obs)).toHaveLength(0);
  });

  it('returns NUM_QUANTILE_BINS bins with sufficient data', () => {
    const obs = Array.from({ length: 50 }, (_, i) =>
      ({ predicted: i / 50, actual: i % 2 === 0 ? 1 : 0 })
    );
    const bins = buildReliabilityBins(obs);
    expect(bins).toHaveLength(NUM_QUANTILE_BINS);
  });

  it('each bin has required fields', () => {
    const obs = Array.from({ length: 20 }, (_, i) =>
      ({ predicted: i / 20, actual: i % 2 === 0 ? 1 : 0 })
    );
    const bins = buildReliabilityBins(obs);
    for (const bin of bins) {
      expect(bin).toHaveProperty('index');
      expect(bin).toHaveProperty('meanPredicted');
      expect(bin).toHaveProperty('meanActual');
      expect(bin).toHaveProperty('count');
      expect(bin).toHaveProperty('calibrationError');
    }
  });

  it('bins are sorted in ascending predicted order', () => {
    const obs = Array.from({ length: 20 }, (_, i) =>
      ({ predicted: i / 20, actual: i % 2 === 0 ? 1 : 0 })
    );
    const bins = buildReliabilityBins(obs);
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i]!.meanPredicted).toBeGreaterThanOrEqual(bins[i - 1]!.meanPredicted);
    }
  });

  it('calibrationError = |meanPredicted - meanActual|', () => {
    const obs = Array.from({ length: 20 }, (_, i) =>
      ({ predicted: i / 20, actual: i % 2 === 0 ? 1 : 0 })
    );
    const bins = buildReliabilityBins(obs);
    for (const bin of bins) {
      expect(bin.calibrationError).toBeCloseTo(
        Math.abs(bin.meanPredicted - bin.meanActual),
        3
      );
    }
  });
});

// ─── computeDomainBreakdown ───────────────────────────────────────────────────

describe('computeDomainBreakdown', () => {
  it('returns empty array when no observations', () => {
    expect(computeDomainBreakdown([])).toHaveLength(0);
  });

  it('excludes domains with fewer than minCount observations', () => {
    const obs = makeN(MIN_DOMAIN_OBSERVATIONS - 1, 0.8, 1, 'Cardio');
    const result = computeDomainBreakdown(obs, MIN_DOMAIN_OBSERVATIONS);
    expect(result).toHaveLength(0);
  });

  it('includes domains at or above minCount', () => {
    const obs = makeN(MIN_DOMAIN_OBSERVATIONS, 0.8, 1, 'Cardio');
    const result = computeDomainBreakdown(obs, MIN_DOMAIN_OBSERVATIONS);
    expect(result).toHaveLength(1);
    expect(result[0]!.domain).toBe('Cardio');
  });

  it('uses "Unknown" for observations without domain', () => {
    const obs = Array.from({ length: MIN_DOMAIN_OBSERVATIONS }, () =>
      makeObs(0.8, 1)
    );
    const result = computeDomainBreakdown(obs, MIN_DOMAIN_OBSERVATIONS);
    expect(result[0]!.domain).toBe('Unknown');
  });

  it('computes direction correctly', () => {
    // Overconfident: high predicted, low actual
    const obs = makeN(MIN_DOMAIN_OBSERVATIONS, 0.9, 0, 'Cardio');
    const result = computeDomainBreakdown(obs, MIN_DOMAIN_OBSERVATIONS);
    expect(result[0]!.direction).toBe('overconfident');
  });

  it('sorts by count descending when multiple domains', () => {
    const cardio = makeN(MIN_DOMAIN_OBSERVATIONS + 10, 0.7, 1, 'Cardio');
    const pulm = makeN(MIN_DOMAIN_OBSERVATIONS, 0.5, 1, 'Pulmonary');
    const result = computeDomainBreakdown([...cardio, ...pulm], MIN_DOMAIN_OBSERVATIONS);
    expect(result[0]!.domain).toBe('Cardio');
    expect(result[1]!.domain).toBe('Pulmonary');
  });

  it('each result has brierScore, ece, direction, meanBias, count', () => {
    const obs = makeN(MIN_DOMAIN_OBSERVATIONS, 0.7, 1, 'Neuro');
    const result = computeDomainBreakdown(obs, MIN_DOMAIN_OBSERVATIONS);
    const d = result[0]!;
    expect(d.brierScore).toBeGreaterThanOrEqual(0);
    expect(d.ece).toBeGreaterThanOrEqual(0);
    expect(['overconfident', 'underconfident', 'calibrated']).toContain(d.direction);
    expect(typeof d.meanBias).toBe('number');
    expect(d.count).toBe(MIN_DOMAIN_OBSERVATIONS);
  });
});

// ─── computeWeeklyTrend ───────────────────────────────────────────────────────

describe('computeWeeklyTrend', () => {
  it('returns empty array for no observations', () => {
    expect(computeWeeklyTrend([])).toHaveLength(0);
  });

  it('excludes weeks with fewer than minWeeklyReviews', () => {
    const obs = Array.from({ length: 5 }, (_, i) =>
      makeObs(0.8, 1, undefined, '2026-04-07T10:00:00.000Z') // all same week
    );
    const result = computeWeeklyTrend(obs, 12, 10);
    expect(result).toHaveLength(0);
  });

  it('includes weeks at or above minWeeklyReviews', () => {
    const obs = Array.from({ length: 10 }, () =>
      makeObs(0.8, 1, undefined, '2026-04-07T10:00:00.000Z')
    );
    const result = computeWeeklyTrend(obs, 12, 10);
    expect(result).toHaveLength(1);
  });

  it('returns at most the last N weeks', () => {
    // Create observations across 15 different weeks, 10 each
    const obs: CalibrationObservation[] = [];
    for (let w = 0; w < 15; w++) {
      const weekDate = new Date('2026-01-05T10:00:00.000Z');
      weekDate.setUTCDate(weekDate.getUTCDate() + w * 7);
      const isoDate = weekDate.toISOString();
      for (let i = 0; i < 10; i++) {
        obs.push(makeObs(0.7, 1, undefined, isoDate));
      }
    }
    const result = computeWeeklyTrend(obs, 12, 10);
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it('each trend point has required fields', () => {
    const obs = Array.from({ length: 10 }, () =>
      makeObs(0.8, 1, undefined, '2026-04-07T10:00:00.000Z')
    );
    const result = computeWeeklyTrend(obs, 12, 10);
    const point = result[0]!;
    expect(point).toHaveProperty('week');
    expect(point).toHaveProperty('weekStart');
    expect(point).toHaveProperty('brierScore');
    expect(point).toHaveProperty('ece');
    expect(point).toHaveProperty('reviewCount');
    expect(point).toHaveProperty('meanBias');
  });

  it('week field has ISO format YYYY-Www', () => {
    const obs = Array.from({ length: 10 }, () =>
      makeObs(0.8, 1, undefined, '2026-04-07T10:00:00.000Z')
    );
    const result = computeWeeklyTrend(obs, 12, 10);
    expect(result[0]!.week).toMatch(/^\d{4}-W\d{2}$/);
  });
});

// ─── buildCalibrationDashboard ────────────────────────────────────────────────

describe('buildCalibrationDashboard', () => {
  it('returns complete dashboard structure', () => {
    const obs: CalibrationObservation[] = [];
    const result = buildCalibrationDashboard(obs, obs);
    expect(result).toHaveProperty('fsrs');
    expect(result).toHaveProperty('metacognitive');
    expect(result).toHaveProperty('domainBreakdown');
    expect(result).toHaveProperty('weeklyTrend');
    expect(result).toHaveProperty('hasSufficientData');
    expect(result).toHaveProperty('computedAt');
  });

  it('hasSufficientData is false below MIN_OBSERVATIONS_RELIABLE', () => {
    const obs = makeN(MIN_OBSERVATIONS_RELIABLE - 1, 0.7, 1);
    const result = buildCalibrationDashboard(obs, obs);
    expect(result.hasSufficientData).toBe(false);
  });

  it('hasSufficientData is true at or above MIN_OBSERVATIONS_RELIABLE', () => {
    const obs = makeN(MIN_OBSERVATIONS_RELIABLE, 0.7, 1);
    const result = buildCalibrationDashboard(obs, []);
    expect(result.hasSufficientData).toBe(true);
  });

  it('hasSufficientData is true if metacognitive has enough', () => {
    const meta = makeN(MIN_OBSERVATIONS_RELIABLE, 0.7, 1);
    const result = buildCalibrationDashboard([], meta);
    expect(result.hasSufficientData).toBe(true);
  });

  it('fsrs.totalReviews matches input count', () => {
    const obs = makeN(25, 0.7, 1);
    const result = buildCalibrationDashboard(obs, []);
    expect(result.fsrs.totalReviews).toBe(25);
  });

  it('metacognitive.totalReviews matches input count', () => {
    const meta = makeN(30, 0.6, 1);
    const result = buildCalibrationDashboard([], meta);
    expect(result.metacognitive.totalReviews).toBe(30);
  });

  it('fsrs direction is overconfident when always predicting high, always wrong', () => {
    const obs = makeN(50, 0.95, 0); // high predicted, all incorrect
    const result = buildCalibrationDashboard(obs, []);
    expect(result.fsrs.direction).toBe('overconfident');
  });

  it('computedAt is a valid ISO timestamp', () => {
    const result = buildCalibrationDashboard([], []);
    expect(() => new Date(result.computedAt)).not.toThrow();
    expect(new Date(result.computedAt).getTime()).toBeGreaterThan(0);
  });
});
