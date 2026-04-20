/**
 * Sprint 3.6 — Shadow Validator Unit Tests
 *
 * Covers the pure math in lib/scheduling/shadowValidator.ts:
 *  - brierScore edge cases
 *  - logLoss clamping (no Infinity)
 *  - reliabilityBins boundary assignment
 *  - ECE = 0 at perfect calibration
 *  - computeCalibrationReport full shape + empty-input safety
 *
 * All tests are deterministic and run in <1s. No Prisma, no network.
 */

import { describe, it, expect } from 'vitest';
import {
  brierScore,
  logLoss,
  reliabilityBins,
  expectedCalibrationError,
  computeCalibrationReport,
  stratifiedReport,
  type CalibrationSample,
} from './shadowValidator';

// ────────────────────────────────────────────────────────────────────────────
// brierScore
// ────────────────────────────────────────────────────────────────────────────

describe('brierScore', () => {
  it('returns 0 for empty input (no samples → no error)', () => {
    expect(brierScore([])).toBe(0);
  });

  it('returns 0 for perfect predictions', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 1, actualOutcome: true },
      { predictedRetrievability: 0, actualOutcome: false },
      { predictedRetrievability: 1, actualOutcome: true },
    ];
    // Clamp eps means these become (1-eps, eps, 1-eps). Brier ≈ 0 but not exactly.
    expect(brierScore(samples)).toBeCloseTo(0, 6);
  });

  it('returns 0.25 for constant 0.5 predictions (classic maximum-entropy benchmark)', () => {
    const samples: CalibrationSample[] = Array.from({ length: 100 }, (_, i) => ({
      predictedRetrievability: 0.5,
      actualOutcome: i % 2 === 0,
    }));
    expect(brierScore(samples)).toBeCloseTo(0.25, 3);
  });

  it('penalizes confidently-wrong predictions (0.9 predicted, wrong) near 0.81', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 0.9, actualOutcome: false },
    ];
    expect(brierScore(samples)).toBeCloseTo(0.81, 3);
  });

  it('handles NaN predictions by substituting 0.5 via clampP', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: Number.NaN, actualOutcome: true },
    ];
    // clampP(NaN) = 0.5 → (0.5 - 1)^2 = 0.25
    expect(brierScore(samples)).toBeCloseTo(0.25, 3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// logLoss
// ────────────────────────────────────────────────────────────────────────────

describe('logLoss', () => {
  it('returns 0 for empty input', () => {
    expect(logLoss([])).toBe(0);
  });

  it('stays finite for p=0 with wrong-prediction sample (critical clamp test)', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 0, actualOutcome: true }, // would be -log(0) = Infinity
    ];
    const loss = logLoss(samples);
    expect(Number.isFinite(loss)).toBe(true);
    expect(loss).toBeGreaterThan(0);
    expect(loss).toBeLessThan(25); // -log(1e-9) ≈ 20.7
  });

  it('stays finite for p=1 with wrong-prediction sample', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 1, actualOutcome: false }, // would be -log(0) = Infinity
    ];
    const loss = logLoss(samples);
    expect(Number.isFinite(loss)).toBe(true);
  });

  it('approaches 0 for perfectly calibrated predictions', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 0.99, actualOutcome: true },
      { predictedRetrievability: 0.01, actualOutcome: false },
    ];
    expect(logLoss(samples)).toBeLessThan(0.05);
  });

  it('returns exactly ln(2) for constant 0.5 predictions', () => {
    const samples: CalibrationSample[] = Array.from({ length: 50 }, (_, i) => ({
      predictedRetrievability: 0.5,
      actualOutcome: i % 2 === 0,
    }));
    expect(logLoss(samples)).toBeCloseTo(Math.log(2), 5);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// reliabilityBins
// ────────────────────────────────────────────────────────────────────────────

describe('reliabilityBins', () => {
  it('allocates 10 bins by default', () => {
    const bins = reliabilityBins([]);
    expect(bins).toHaveLength(10);
    bins.forEach((b, i) => {
      expect(b.index).toBe(i);
      expect(b.lowerBound).toBeCloseTo(i / 10, 6);
      expect(b.upperBound).toBeCloseTo((i + 1) / 10, 6);
      expect(b.count).toBe(0);
    });
  });

  it('places p=0 in bin 0 and p=1 in the last bin (boundary assignment)', () => {
    const bins = reliabilityBins(
      [
        { predictedRetrievability: 0, actualOutcome: false },
        { predictedRetrievability: 1, actualOutcome: true },
      ],
      10
    );
    expect(bins[0]?.count).toBe(1);
    expect(bins[9]?.count).toBe(1);
  });

  it('places p=0.5 in bin 5 (i.e. [0.5, 0.6))', () => {
    const bins = reliabilityBins(
      [{ predictedRetrievability: 0.5, actualOutcome: true }],
      10
    );
    expect(bins[5]?.count).toBe(1);
  });

  it('computes observedRate = sum(outcomes) / count per bin', () => {
    const bins = reliabilityBins(
      [
        { predictedRetrievability: 0.85, actualOutcome: true },
        { predictedRetrievability: 0.85, actualOutcome: true },
        { predictedRetrievability: 0.85, actualOutcome: false },
        { predictedRetrievability: 0.85, actualOutcome: true },
      ],
      10
    );
    const b = bins[8];
    expect(b?.count).toBe(4);
    expect(b?.observedRate).toBeCloseTo(0.75, 6);
    expect(b?.meanPredicted).toBeCloseTo(0.85, 6);
    expect(b?.gap).toBeCloseTo(0.1, 6);
  });

  it('clamps binCount to at least 1', () => {
    const bins = reliabilityBins(
      [{ predictedRetrievability: 0.5, actualOutcome: true }],
      0
    );
    expect(bins).toHaveLength(1);
    expect(bins[0]?.count).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// expectedCalibrationError
// ────────────────────────────────────────────────────────────────────────────

describe('expectedCalibrationError', () => {
  it('returns 0 for empty input', () => {
    expect(expectedCalibrationError([])).toBe(0);
  });

  it('is 0 for perfect calibration (observed rate equals mean prediction in every populated bin)', () => {
    // Populate one bin with predictions that exactly match observed rate:
    // p=0.75 for 4 samples, 3 correct → observed 0.75, predicted 0.75, gap = 0
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 0.75, actualOutcome: true },
      { predictedRetrievability: 0.75, actualOutcome: true },
      { predictedRetrievability: 0.75, actualOutcome: true },
      { predictedRetrievability: 0.75, actualOutcome: false },
    ];
    expect(expectedCalibrationError(samples)).toBeCloseTo(0, 6);
  });

  it('is bounded above by 1 and below by 0', () => {
    // Worst-case calibration: predict 1, observe 0 → gap = 1
    const samples: CalibrationSample[] = Array.from({ length: 10 }, () => ({
      predictedRetrievability: 1,
      actualOutcome: false,
    }));
    const ece = expectedCalibrationError(samples);
    expect(ece).toBeGreaterThanOrEqual(0);
    expect(ece).toBeLessThanOrEqual(1);
    expect(ece).toBeCloseTo(1, 2); // Within LOG_EPS of 1
  });
});

// ────────────────────────────────────────────────────────────────────────────
// computeCalibrationReport
// ────────────────────────────────────────────────────────────────────────────

describe('computeCalibrationReport', () => {
  it('returns zeroed report for empty input', () => {
    const r = computeCalibrationReport([]);
    expect(r.n).toBe(0);
    expect(r.brier).toBe(0);
    expect(r.logLoss).toBe(0);
    expect(r.ece).toBe(0);
    expect(r.maxCalibrationError).toBe(0);
    expect(r.overallAccuracy).toBe(0);
    expect(r.meanPredicted).toBe(0);
    expect(r.bins).toEqual([]);
    expect(r.binCount).toBe(10);
  });

  it('computes overallAccuracy as simple proportion of outcomes', () => {
    const samples: CalibrationSample[] = [
      { predictedRetrievability: 0.7, actualOutcome: true },
      { predictedRetrievability: 0.7, actualOutcome: true },
      { predictedRetrievability: 0.7, actualOutcome: false },
    ];
    const r = computeCalibrationReport(samples);
    expect(r.overallAccuracy).toBeCloseTo(2 / 3, 6);
  });

  it('reports maxCalibrationError as the worst single-bin gap', () => {
    const samples: CalibrationSample[] = [
      // Bin 7: predict 0.75, observe 0/1 → gap = 0.75 (near-perfect overconfidence)
      { predictedRetrievability: 0.75, actualOutcome: false },
      // Bin 2: predict 0.25, observe 1/1 → gap = 0.75 (near-perfect underconfidence)
      { predictedRetrievability: 0.25, actualOutcome: true },
    ];
    const r = computeCalibrationReport(samples, 10);
    expect(r.maxCalibrationError).toBeCloseTo(0.75, 2);
  });

  it('accepts custom binCount and reflects it in the report', () => {
    const r = computeCalibrationReport(
      [{ predictedRetrievability: 0.5, actualOutcome: true }],
      5
    );
    expect(r.binCount).toBe(5);
    expect(r.bins).toHaveLength(5);
  });

  it('meanPredicted diverges from overallAccuracy when scheduler is biased', () => {
    // Scheduler predicts ~0.9 but reality is 50/50 → classic overconfidence
    const samples: CalibrationSample[] = Array.from({ length: 20 }, (_, i) => ({
      predictedRetrievability: 0.9,
      actualOutcome: i % 2 === 0,
    }));
    const r = computeCalibrationReport(samples);
    expect(r.meanPredicted).toBeCloseTo(0.9, 2);
    expect(r.overallAccuracy).toBeCloseTo(0.5, 2);
    // gap between belief and reality is visible in ECE
    expect(r.ece).toBeGreaterThan(0.3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// stratifiedReport
// ────────────────────────────────────────────────────────────────────────────

describe('stratifiedReport', () => {
  const makeSample = (p: number, actual: boolean): CalibrationSample => ({
    predictedRetrievability: p,
    actualOutcome: actual,
  });

  it('overall report equals computeCalibrationReport on the same samples', () => {
    const samples = [makeSample(0.8, true), makeSample(0.4, false), makeSample(0.9, true)];
    const { overall } = stratifiedReport(samples, () => 'any');
    const direct = computeCalibrationReport(samples);
    expect(overall.n).toBe(direct.n);
    expect(overall.brier).toBeCloseTo(direct.brier, 6);
    expect(overall.overallAccuracy).toBeCloseTo(direct.overallAccuracy, 6);
  });

  it('splits samples into correct strata by key', () => {
    // Tag each sample via a sentinel field on the extended type
    type TaggedSample = CalibrationSample & { tag: string };
    const all: TaggedSample[] = [
      { predictedRetrievability: 0.8, actualOutcome: true, tag: 'full' },
      { predictedRetrievability: 0.85, actualOutcome: true, tag: 'full' },
      { predictedRetrievability: 0.3, actualOutcome: false, tag: 'minimal' },
    ];

    const { strata } = stratifiedReport(all, (s) => (s as TaggedSample).tag, 10);

    expect(strata.has('full')).toBe(true);
    expect(strata.has('minimal')).toBe(true);
    expect(strata.get('full')?.n).toBe(2);
    expect(strata.get('minimal')?.n).toBe(1);
  });

  it('returns empty strata map for empty input', () => {
    const { overall, strata } = stratifiedReport([], () => 'key');
    expect(overall.n).toBe(0);
    expect(strata.size).toBe(0);
  });

  it('stratum reports are independent — different brier scores per group', () => {
    type KeyedSample = CalibrationSample & { group: string };
    // Group A: well-calibrated (high p → correct)
    // Group B: overconfident (high p → wrong)
    const samples: KeyedSample[] = [
      { predictedRetrievability: 0.95, actualOutcome: true, group: 'A' },
      { predictedRetrievability: 0.9, actualOutcome: false, group: 'B' },
    ];
    const { strata } = stratifiedReport(samples, (s) => (s as KeyedSample).group);

    const brierA = strata.get('A')?.brier ?? -1;
    const brierB = strata.get('B')?.brier ?? -1;
    expect(brierA).toBeLessThan(brierB);
  });

  it('single-stratum result matches overall', () => {
    const samples = [makeSample(0.7, true), makeSample(0.6, false)];
    const { overall, strata } = stratifiedReport(samples, () => 'only');
    const onlyStratum = strata.get('only');
    expect(onlyStratum?.n).toBe(overall.n);
    expect(onlyStratum?.brier).toBeCloseTo(overall.brier, 6);
  });
});
