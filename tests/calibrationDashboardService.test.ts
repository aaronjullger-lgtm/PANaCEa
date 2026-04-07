/**
 * Tests for Calibration Dashboard Service (Tier 2, Feature 3)
 *
 * Tests pure computation functions: Brier Score, ECE, reliability bins,
 * domain breakdown, weekly trend, and the full dashboard builder.
 */

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
  type CalibrationObservation,
} from '../lib/services/calibrationDashboardService';

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Generate interleaved observations with a target recall rate.
 * Uses the interleaved helper pattern to avoid ordering artifacts.
 */
function generateObservations(
  count: number,
  recallRate: number,
  predictedBase: number = 0.8,
  domain?: string,
  weekOffset: number = 0
): CalibrationObservation[] {
  const correctCount = Math.round(count * recallRate);
  const obs: CalibrationObservation[] = [];

  for (let i = 0; i < count; i++) {
    // Interleave correct/incorrect evenly
    const isCorrect =
      Math.floor(((i + 1) * correctCount) / count) >
      Math.floor((i * correctCount) / count);

    // Spread predictions around predictedBase with some noise
    const noise = (i % 5 - 2) * 0.05;
    const predicted = Math.max(0, Math.min(1, predictedBase + noise));

    const date = new Date('2026-01-05');
    date.setDate(date.getDate() + weekOffset * 7 + (i % 7));

    obs.push({
      predicted,
      actual: isCorrect ? 1 : 0,
      domain,
      reviewedAt: date.toISOString(),
    });
  }

  return obs;
}

// ─── Brier Score ──────────────────────────────────────────────────

describe('computeBrierScore', () => {
  it('returns 0.25 for empty array', () => {
    expect(computeBrierScore([])).toBe(0.25);
  });

  it('returns 0 for perfect predictions', () => {
    // predicted=1, actual=1 → (1-1)²=0; predicted=0, actual=0 → (0-0)²=0
    const pairs = [
      { predicted: 1, actual: 1 },
      { predicted: 0, actual: 0 },
      { predicted: 1, actual: 1 },
      { predicted: 0, actual: 0 },
    ];
    expect(computeBrierScore(pairs)).toBe(0);
  });

  it('returns 1.0 for worst-case predictions', () => {
    // predicted=1, actual=0 → (1-0)²=1; predicted=0, actual=1 → (0-1)²=1
    const pairs = [
      { predicted: 1, actual: 0 },
      { predicted: 0, actual: 1 },
    ];
    expect(computeBrierScore(pairs)).toBe(1);
  });

  it('returns ~0.25 for random baseline (p=0.5, 50% correct)', () => {
    // All predicted at 0.5, half correct: (0.5-1)²=0.25, (0.5-0)²=0.25
    const pairs = Array.from({ length: 100 }, (_, i) => ({
      predicted: 0.5,
      actual: i < 50 ? 1 : 0,
    }));
    expect(computeBrierScore(pairs)).toBeCloseTo(0.25, 4);
  });

  it('returns lower score for well-calibrated predictions', () => {
    // Good calibration: high confidence when correct, low when incorrect
    const pairs = [
      { predicted: 0.9, actual: 1 },
      { predicted: 0.9, actual: 1 },
      { predicted: 0.1, actual: 0 },
      { predicted: 0.1, actual: 0 },
    ];
    // BS = ((0.9-1)² + (0.9-1)² + (0.1-0)² + (0.1-0)²) / 4
    //    = (0.01 + 0.01 + 0.01 + 0.01) / 4 = 0.01
    expect(computeBrierScore(pairs)).toBeCloseTo(0.01, 4);
  });
});

// ─── ECE ──────────────────────────────────────────────────────────

describe('computeECE', () => {
  it('returns 0 for too few observations', () => {
    const pairs = [{ predicted: 0.5, actual: 1 }];
    expect(computeECE(pairs, 10)).toBe(0);
  });

  it('returns 0 for perfectly calibrated data', () => {
    // 100 obs, 10 bins of 10.
    // Each bin: all predicted=0.5, 5 correct 5 incorrect → actual=0.5
    const pairs: Array<{ predicted: number; actual: number }> = [];
    for (let i = 0; i < 100; i++) {
      pairs.push({ predicted: 0.5, actual: i % 2 });
    }
    expect(computeECE(pairs, 10)).toBeCloseTo(0, 1);
  });

  it('returns high ECE for systematically overconfident predictions', () => {
    // All predicted at 0.9, only 50% correct → ECE should be ~0.4
    const pairs = Array.from({ length: 100 }, (_, i) => ({
      predicted: 0.9,
      actual: i < 50 ? 1 : 0,
    }));
    const ece = computeECE(pairs, 10);
    expect(ece).toBeGreaterThan(0.3);
  });

  it('computes lower ECE for well-calibrated spread', () => {
    // Create observations where predicted ≈ actual accuracy per bin
    const pairs: Array<{ predicted: number; actual: number }> = [];
    for (let bin = 0; bin < 10; bin++) {
      const p = (bin + 0.5) / 10; // 0.05, 0.15, ... 0.95
      const correctCount = Math.round(10 * p);
      for (let j = 0; j < 10; j++) {
        pairs.push({
          predicted: p,
          actual: j < correctCount ? 1 : 0,
        });
      }
    }
    const ece = computeECE(pairs, 10);
    expect(ece).toBeLessThan(0.1);
  });
});

// ─── Reliability Bins ─────────────────────────────────────────────

describe('buildReliabilityBins', () => {
  it('returns empty array for too few observations', () => {
    const pairs = [{ predicted: 0.5, actual: 1 }];
    expect(buildReliabilityBins(pairs, 10)).toEqual([]);
  });

  it('produces correct number of bins', () => {
    const pairs = Array.from({ length: 100 }, (_, i) => ({
      predicted: i / 100,
      actual: i < 50 ? 1 : 0,
    }));
    const bins = buildReliabilityBins(pairs, 10);
    expect(bins.length).toBe(10);
  });

  it('each bin has count > 0', () => {
    const pairs = Array.from({ length: 50 }, (_, i) => ({
      predicted: i / 50,
      actual: 1,
    }));
    const bins = buildReliabilityBins(pairs, 5);
    bins.forEach((bin) => {
      expect(bin.count).toBeGreaterThan(0);
    });
  });

  it('meanPredicted and meanActual are in [0, 1]', () => {
    const pairs = Array.from({ length: 100 }, (_, i) => ({
      predicted: Math.random(),
      actual: Math.random() > 0.5 ? 1 : 0,
    }));
    const bins = buildReliabilityBins(pairs, 10);
    bins.forEach((bin) => {
      expect(bin.meanPredicted).toBeGreaterThanOrEqual(0);
      expect(bin.meanPredicted).toBeLessThanOrEqual(1);
      expect(bin.meanActual).toBeGreaterThanOrEqual(0);
      expect(bin.meanActual).toBeLessThanOrEqual(1);
    });
  });
});

// ─── Mean Bias and Direction ──────────────────────────────────────

describe('computeMeanBias', () => {
  it('returns 0 for empty array', () => {
    expect(computeMeanBias([])).toBe(0);
  });

  it('returns positive for overconfident predictions', () => {
    // predicted 0.9, actual all 0 → bias = 0.9
    const pairs = [
      { predicted: 0.9, actual: 0 },
      { predicted: 0.9, actual: 0 },
    ];
    expect(computeMeanBias(pairs)).toBeCloseTo(0.9, 4);
  });

  it('returns negative for underconfident predictions', () => {
    // predicted 0.1, actual all 1 → bias = -0.9
    const pairs = [
      { predicted: 0.1, actual: 1 },
      { predicted: 0.1, actual: 1 },
    ];
    expect(computeMeanBias(pairs)).toBeCloseTo(-0.9, 4);
  });
});

describe('classifyDirection', () => {
  it('returns overconfident for positive bias > threshold', () => {
    expect(classifyDirection(0.1)).toBe('overconfident');
  });

  it('returns underconfident for negative bias < -threshold', () => {
    expect(classifyDirection(-0.1)).toBe('underconfident');
  });

  it('returns calibrated for small bias', () => {
    expect(classifyDirection(0.03)).toBe('calibrated');
    expect(classifyDirection(-0.04)).toBe('calibrated');
  });
});

// ─── Domain Breakdown ─────────────────────────────────────────────

describe('computeDomainBreakdown', () => {
  it('returns empty for insufficient domain data', () => {
    const obs = generateObservations(10, 0.7, 0.8, 'Cardiovascular');
    const result = computeDomainBreakdown(obs, 30);
    expect(result).toEqual([]);
  });

  it('returns domains with sufficient data', () => {
    const cardio = generateObservations(50, 0.7, 0.8, 'Cardiovascular');
    const pulm = generateObservations(50, 0.6, 0.8, 'Pulmonary');
    const derm = generateObservations(10, 0.5, 0.8, 'Dermatologic');
    const obs = [...cardio, ...pulm, ...derm];

    const result = computeDomainBreakdown(obs, 30);

    // Only Cardiovascular and Pulmonary have 50 reviews (>30 threshold)
    expect(result.length).toBe(2);
    expect(result.map((d) => d.domain)).toContain('Cardiovascular');
    expect(result.map((d) => d.domain)).toContain('Pulmonary');
  });

  it('includes valid Brier score and ECE per domain', () => {
    const obs = generateObservations(100, 0.75, 0.8, 'Cardiovascular');
    const result = computeDomainBreakdown(obs, 30);

    expect(result.length).toBe(1);
    expect(result[0].brierScore).toBeGreaterThanOrEqual(0);
    expect(result[0].brierScore).toBeLessThanOrEqual(1);
    expect(result[0].ece).toBeGreaterThanOrEqual(0);
  });
});

// ─── Weekly Trend ─────────────────────────────────────────────────

describe('computeWeeklyTrend', () => {
  it('returns empty for no observations', () => {
    expect(computeWeeklyTrend([])).toEqual([]);
  });

  it('produces weekly points from multi-week data', () => {
    // 3 weeks of data, 20 reviews each
    const obs = [
      ...generateObservations(20, 0.7, 0.8, undefined, 0),
      ...generateObservations(20, 0.75, 0.8, undefined, 1),
      ...generateObservations(20, 0.8, 0.8, undefined, 2),
    ];

    const trend = computeWeeklyTrend(obs, 12, 10);
    expect(trend.length).toBeGreaterThanOrEqual(2);

    // Each point should have valid fields
    trend.forEach((pt) => {
      expect(pt.week).toMatch(/^\d{4}-W\d{2}$/);
      expect(pt.brierScore).toBeGreaterThanOrEqual(0);
      expect(pt.reviewCount).toBeGreaterThanOrEqual(10);
    });
  });
});

// ─── Full Dashboard Builder ───────────────────────────────────────

describe('buildCalibrationDashboard', () => {
  it('handles empty observations gracefully', () => {
    const result = buildCalibrationDashboard([], []);

    expect(result.hasSufficientData).toBe(false);
    expect(result.fsrs.brierScore).toBe(0.25);
    expect(result.metacognitive.brierScore).toBe(0.25);
    expect(result.domainBreakdown).toEqual([]);
    expect(result.weeklyTrend).toEqual([]);
  });

  it('marks hasSufficientData true when enough reviews exist', () => {
    const fsrs = generateObservations(100, 0.75, 0.8);
    const meta = generateObservations(30, 0.7, 0.7);

    const result = buildCalibrationDashboard(fsrs, meta);
    expect(result.hasSufficientData).toBe(true);
  });

  it('computes FSRS and metacognitive calibration independently', () => {
    // FSRS observations: well-calibrated (predicted ~0.8, actual ~80%)
    const fsrs = generateObservations(100, 0.8, 0.8);
    // Meta observations: overconfident (predicted ~0.9, actual ~60%)
    const meta = generateObservations(100, 0.6, 0.9);

    const result = buildCalibrationDashboard(fsrs, meta);

    // FSRS should be better calibrated than metacognitive
    expect(result.fsrs.brierScore).toBeLessThan(result.metacognitive.brierScore);
    expect(result.metacognitive.direction).toBe('overconfident');
  });

  it('includes reliability bins for both tracks', () => {
    const fsrs = generateObservations(100, 0.75, 0.8);
    const meta = generateObservations(100, 0.7, 0.7);

    const result = buildCalibrationDashboard(fsrs, meta);
    expect(result.fsrs.reliabilityBins.length).toBeGreaterThan(0);
    expect(result.metacognitive.reliabilityBins.length).toBeGreaterThan(0);
  });

  it('includes computedAt timestamp', () => {
    const result = buildCalibrationDashboard([], []);
    expect(result.computedAt).toBeDefined();
    // Should be a valid ISO string
    expect(new Date(result.computedAt).getTime()).not.toBeNaN();
  });
});
