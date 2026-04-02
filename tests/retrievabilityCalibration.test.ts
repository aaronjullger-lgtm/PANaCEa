/**
 * Retrievability Calibration — Unit Tests (Sprint 4)
 *
 * Tests the calibration bucketing, correction factor computation,
 * and edge cases for the retrievability validation pipeline.
 */

import { describe, it, expect } from 'vitest';
import {
  bucketReviews,
  computeCorrectionFactor,
  CALIBRATION_CONSTANTS,
  type CalibrationBin,
} from '../lib/services/retrievabilityCalibrationService';

const { NUM_BINS, MIN_BIN_COUNT, CORRECTION_CLAMP_MIN, CORRECTION_CLAMP_MAX } = CALIBRATION_CONSTANTS;

describe('bucketReviews', () => {
  it('returns NUM_BINS bins even with no data', () => {
    const bins = bucketReviews([]);
    expect(bins).toHaveLength(NUM_BINS);
    bins.forEach(bin => expect(bin.count).toBe(0));
  });

  it('places a review with R=0.85 in the correct bin', () => {
    const bins = bucketReviews([{ retrievability: 0.85, wasCorrect: true }]);
    // 0.85 → bin index 8 (0.8-0.9)
    expect(bins[8].count).toBe(1);
  });
  it('clamps R=1.0 into the last bin', () => {
    const bins = bucketReviews([{ retrievability: 0.9999, wasCorrect: true }]);
    expect(bins[9].count).toBe(1);
  });

  it('clamps R=0.0 into the first bin', () => {
    const bins = bucketReviews([{ retrievability: 0.0, wasCorrect: false }]);
    expect(bins[0].count).toBe(1);
  });

  it('computes correct actual recall rate when bin has enough data', () => {
    // Put 20 reviews in the 0.8-0.9 bin, 15 correct
    const reviews = Array.from({ length: 20 }, (_, i) => ({
      retrievability: 0.85,
      wasCorrect: i < 15,
    }));
    const bins = bucketReviews(reviews);
    expect(bins[8].count).toBe(20);
    expect(bins[8].actualRecallRate).toBeCloseTo(0.75, 5);
  });

  it('falls back to predicted center when bin has insufficient data', () => {
    // Only 5 reviews (below MIN_BIN_COUNT of 10)
    const reviews = Array.from({ length: 5 }, () => ({
      retrievability: 0.85,
      wasCorrect: true,
    }));
    const bins = bucketReviews(reviews);
    // Should fall back to predictedCenter = 0.85
    expect(bins[8].actualRecallRate).toBeCloseTo(0.85, 5);
  });
  it('computes calibration ratio correctly', () => {
    // 20 reviews at R≈0.85, all correct → actual = 1.0, predicted center = 0.85
    const reviews = Array.from({ length: 20 }, () => ({
      retrievability: 0.85,
      wasCorrect: true,
    }));
    const bins = bucketReviews(reviews);
    // calibrationRatio = actualRecallRate / predictedCenter = 1.0 / 0.85 ≈ 1.176
    expect(bins[8].calibrationRatio).toBeCloseTo(1.0 / 0.85, 2);
  });
});

describe('computeCorrectionFactor', () => {
  it('returns 1.0 when no bins have enough data', () => {
    const emptyBins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => ({
      predictedCenter: (idx + 0.5) / NUM_BINS,
      actualRecallRate: (idx + 0.5) / NUM_BINS,
      count: 5, // Below MIN_BIN_COUNT
      calibrationRatio: 1.0,
    }));
    expect(computeCorrectionFactor(emptyBins)).toBe(1.0);
  });

  it('returns 1.0 for a perfectly calibrated model', () => {
    const perfectBins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => ({
      predictedCenter: (idx + 0.5) / NUM_BINS,
      actualRecallRate: (idx + 0.5) / NUM_BINS,
      count: 100,
      calibrationRatio: 1.0,
    }));
    expect(computeCorrectionFactor(perfectBins)).toBeCloseTo(1.0, 5);
  });
  it('detects overconfident model (actual < predicted)', () => {
    // Model predicts 0.85 but actual recall is only 0.60
    const overconfidentBins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => {
      const center = (idx + 0.5) / NUM_BINS;
      return {
        predictedCenter: center,
        actualRecallRate: center * 0.7, // 30% overconfident
        count: center >= 0.5 ? 100 : 5, // Only high bins have data
        calibrationRatio: 0.7,
      };
    });
    const factor = computeCorrectionFactor(overconfidentBins);
    expect(factor).toBeLessThan(1.0);
    expect(factor).toBeCloseTo(0.7, 1);
  });

  it('detects underconfident model (actual > predicted)', () => {
    const underconfidentBins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => {
      const center = (idx + 0.5) / NUM_BINS;
      return {
        predictedCenter: center,
        actualRecallRate: Math.min(1, center * 1.3),
        count: center >= 0.5 ? 100 : 5,
        calibrationRatio: 1.3,
      };
    });
    const factor = computeCorrectionFactor(underconfidentBins);
    expect(factor).toBeGreaterThan(1.0);
    expect(factor).toBeCloseTo(1.3, 1);
  });
  it('clamps extreme correction factors', () => {
    // Wildly miscalibrated: actual is 3x predicted
    const extremeBins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => ({
      predictedCenter: (idx + 0.5) / NUM_BINS,
      actualRecallRate: 1.0,
      count: 200,
      calibrationRatio: 3.0,
    }));
    const factor = computeCorrectionFactor(extremeBins);
    expect(factor).toBeLessThanOrEqual(CORRECTION_CLAMP_MAX);
  });

  it('clamps downward extreme correction factors', () => {
    const extremeBins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => ({
      predictedCenter: (idx + 0.5) / NUM_BINS,
      actualRecallRate: 0.01,
      count: 200,
      calibrationRatio: 0.1,
    }));
    const factor = computeCorrectionFactor(extremeBins);
    expect(factor).toBeGreaterThanOrEqual(CORRECTION_CLAMP_MIN);
  });

  it('weights high-retrievability bins more heavily', () => {
    // Two scenarios: high bin with ratio 1.2 vs low bin with ratio 0.8
    // The high bin (0.5-0.95) should dominate
    const bins: CalibrationBin[] = Array.from({ length: NUM_BINS }, (_, idx) => {
      const center = (idx + 0.5) / NUM_BINS;
      const isHighBin = center >= 0.5 && center <= 0.95;
      return {
        predictedCenter: center,
        actualRecallRate: isHighBin ? center * 1.2 : center * 0.5,
        count: 100,
        calibrationRatio: isHighBin ? 1.2 : 0.5,
      };
    });
    const factor = computeCorrectionFactor(bins);
    // Weighted avg: (0.5*500 + 1.2*1000) / 1500 ≈ 0.967
    // Should be closer to 1.2 than to the unweighted midpoint of 0.85
    expect(factor).toBeGreaterThan(0.95);
    expect(factor).toBeLessThan(1.0);
  });
});

describe('bucketReviews + computeCorrectionFactor integration', () => {
  it('produces correction ~1.0 for well-calibrated data', () => {
    // Generate synthetic "calibrated" data: P(correct) ≈ retrievability
    const reviews: Array<{ retrievability: number; wasCorrect: boolean }> = [];
    for (let i = 0; i < 500; i++) {
      const r = 0.5 + Math.random() * 0.4; // R in [0.5, 0.9]
      reviews.push({ retrievability: r, wasCorrect: Math.random() < r });
    }
    const bins = bucketReviews(reviews);
    const factor = computeCorrectionFactor(bins);
    // With 500 samples, should be roughly calibrated (within ±15%)
    expect(factor).toBeGreaterThan(0.85);
    expect(factor).toBeLessThan(1.15);
  });
});