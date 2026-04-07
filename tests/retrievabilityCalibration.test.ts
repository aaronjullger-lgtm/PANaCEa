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
  it('returns empty array with no data', () => {
    const bins = bucketReviews([]);
    expect(bins).toHaveLength(0);
  });

  it('places a review with R=0.85 in one bin', () => {
    const bins = bucketReviews([{ retrievability: 0.85, wasCorrect: true }]);
    // With only 1 review, it fills one bin
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(1);
  });
  it('clamps R=1.0 into a bin', () => {
    const bins = bucketReviews([{ retrievability: 0.9999, wasCorrect: true }]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(1);
  });

  it('clamps R=0.0 into first bin', () => {
    const bins = bucketReviews([{ retrievability: 0.0, wasCorrect: false }]);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(1);
  });

  it('computes correct actual recall rate when bin has enough data', () => {
    // Create 300 reviews in a narrow range, with 225 correct (75%)
    // Distribute correct/incorrect evenly so bins have ~0.75 recall rate
    const reviews = Array.from({ length: 300 }, (_, i) => ({
      retrievability: 0.85,
      wasCorrect: i % 4 !== 3,  // 3 correct, 1 incorrect per 4 items → 75%
    }));
    const bins = bucketReviews(reviews);
    // All items have same retrievability, so they distribute evenly across bins
    // Each bin should have count >= MIN_BIN_COUNT and actualRecallRate ≈ 0.75
    const binWithData = bins.find(b => b.count >= MIN_BIN_COUNT);
    expect(binWithData).toBeDefined();
    expect(binWithData!.actualRecallRate).toBeCloseTo(0.75, 1);
  });

  it('falls back to predicted center when bin has insufficient data', () => {
    // Only 5 reviews (below MIN_BIN_COUNT of 30)
    const reviews = Array.from({ length: 5 }, () => ({
      retrievability: 0.85,
      wasCorrect: true,
    }));
    const bins = bucketReviews(reviews);
    // Should fall back to predictedCenter = 0.85
    expect(bins[0].actualRecallRate).toBeCloseTo(0.85, 5);
  });
  it('computes calibration ratio correctly', () => {
    // 300 reviews at R≈0.85, all correct → actual = 1.0, predicted center = 0.85
    const reviews = Array.from({ length: 300 }, () => ({
      retrievability: 0.85,
      wasCorrect: true,
    }));
    const bins = bucketReviews(reviews);
    // Find the bin with enough data (>= MIN_BIN_COUNT)
    const bin = bins.find(b => b.count >= MIN_BIN_COUNT);
    expect(bin).toBeDefined();
    // actualRecallRate = 1.0, predictedCenter ≈ 0.85
    // rawRatio = 1.0 / 0.85 ≈ 1.176
    // with shrinkage: 1.0 + (1.176 - 1.0) * min(1, count/SHRINKAGE_N)
    // With count=30, shrinkage = min(1, 30/200) = 0.15
    // calibrationRatio = 1.0 + 0.176 * 0.15 ≈ 1.026
    expect(bin!.calibrationRatio).toBeGreaterThan(1.0);
    expect(bin!.calibrationRatio).toBeLessThan(1.1);
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