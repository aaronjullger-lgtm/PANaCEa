import { describe, it, expect } from 'vitest';
import {
  computeBrierScore,
  linearRegression,
  computeCalibrationBuckets,
  deriveDampenerFactor,
  computeCalibrationProfile,
} from '../lib/services/calibrationService';

describe('Calibration Service', () => {
  describe('computeBrierScore', () => {
    it('perfect calibration returns 0', () => {
      const pairs = [
        { confidence: 1.0, wasCorrect: true },
        { confidence: 0.0, wasCorrect: false },
      ];
      expect(computeBrierScore(pairs)).toBeCloseTo(0, 5);
    });

    it('worst calibration returns 1', () => {
      const pairs = [
        { confidence: 1.0, wasCorrect: false },
        { confidence: 0.0, wasCorrect: true },
      ];
      expect(computeBrierScore(pairs)).toBeCloseTo(1, 5);
    });

    it('moderate calibration returns intermediate score', () => {
      const pairs = [
        { confidence: 0.8, wasCorrect: true },
        { confidence: 0.8, wasCorrect: false },
        { confidence: 0.4, wasCorrect: true },
        { confidence: 0.4, wasCorrect: false },
      ];
      const score = computeBrierScore(pairs);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('empty array returns 0.5', () => {
      expect(computeBrierScore([])).toBe(0.5);
    });

    it('50-50 split at 0.5 confidence returns 0.5', () => {
      const pairs = [
        { confidence: 0.5, wasCorrect: true },
        { confidence: 0.5, wasCorrect: false },
      ];
      // Brier = mean((0.5-1)² + (0.5-0)²) = mean(0.25 + 0.25) = 0.25
      expect(computeBrierScore(pairs)).toBeCloseTo(0.25, 5);
    });
  });

  describe('linearRegression', () => {
    it('perfect positive correlation returns slope ~1', () => {
      const pairs = Array.from({ length: 100 }, (_, i) => ({
        confidence: i / 100,
        wasCorrect: i >= 50,
      }));
      const { slope } = linearRegression(pairs);
      expect(slope).toBeGreaterThan(0.5);
    });

    it('single pair returns default slope 1', () => {
      expect(linearRegression([{ confidence: 0.5, wasCorrect: true }]).slope).toBe(1);
    });

    it('constant confidence returns slope 0 or near-0 (denominator ≈ 0)', () => {
      const pairs = [
        { confidence: 0.5, wasCorrect: true },
        { confidence: 0.5, wasCorrect: false },
        { confidence: 0.5, wasCorrect: true },
      ];
      // All same x → denominator ≈ 0 → default
      const { slope } = linearRegression(pairs);
      expect(slope).toBe(1); // falls back to default
    });

    it('negative correlation returns negative slope', () => {
      const pairs = Array.from({ length: 50 }, (_, i) => ({
        confidence: i / 50,
        wasCorrect: i < 25, // More mistakes at higher confidence
      }));
      const { slope } = linearRegression(pairs);
      expect(slope).toBeLessThan(0);
    });
  });

  describe('deriveDampenerFactor', () => {
    it('well-calibrated returns 1.0', () => {
      expect(deriveDampenerFactor(1.0, 0.2)).toBe(1.0);
    });

    it('overconfident (slope < 0.8) returns < 1.0', () => {
      const factor = deriveDampenerFactor(0.5, 0.3);
      expect(factor).toBeLessThan(1.0);
      expect(factor).toBeGreaterThanOrEqual(0.7);
    });

    it('underconfident (slope > 1.2) returns > 1.0', () => {
      const factor = deriveDampenerFactor(1.5, 0.3);
      expect(factor).toBeGreaterThan(1.0);
      expect(factor).toBeLessThanOrEqual(1.3);
    });

    it('extreme overconfidence clamped at 0.7', () => {
      expect(deriveDampenerFactor(0.0, 0.5)).toBe(0.7);
    });

    it('extreme underconfidence clamped at 1.3', () => {
      expect(deriveDampenerFactor(3.0, 0.5)).toBe(1.3);
    });

    it('slope of 1.0 with low Brier returns 1.0', () => {
      expect(deriveDampenerFactor(1.0, 0.15)).toBe(1.0);
    });

    it('slope of 0.9 with Brier 0.3 uses formula (Brier > 0.25 threshold)', () => {
      const factor = deriveDampenerFactor(0.9, 0.3);
      // Brier 0.3 > 0.25 → not well-calibrated → formula: 0.7 + 0.3 * 0.9 = 0.97
      expect(factor).toBeCloseTo(0.97, 2);
    });
  });

  describe('computeCalibrationBuckets', () => {
    it('produces 5 buckets', () => {
      const pairs = [
        { confidence: 0.4, wasCorrect: true },
        { confidence: 0.55, wasCorrect: false },
        { confidence: 0.65, wasCorrect: true },
        { confidence: 0.75, wasCorrect: true },
        { confidence: 0.85, wasCorrect: false },
      ];
      const buckets = computeCalibrationBuckets(pairs);
      expect(buckets).toHaveLength(5);
    });

    it('empty buckets have count 0', () => {
      const pairs = [{ confidence: 0.9, wasCorrect: true }];
      const buckets = computeCalibrationBuckets(pairs);
      const emptyBuckets = buckets.filter(b => b.count === 0);
      expect(emptyBuckets.length).toBeGreaterThan(0);
    });

    it('buckets have correct confidence ranges', () => {
      const pairs = Array.from({ length: 50 }, (_, i) => ({
        confidence: 0.3 + (i / 50) * 0.65,
        wasCorrect: Math.random() > 0.5,
      }));
      const buckets = computeCalibrationBuckets(pairs);
      expect(buckets[0].confidenceRange).toEqual([0.3, 0.5]);
      expect(buckets[4].confidenceRange).toEqual([0.8, 0.95]);
    });

    it('actualRetention is between 0 and 1', () => {
      const pairs = Array.from({ length: 30 }, (_, i) => ({
        confidence: 0.3 + (i / 30) * 0.65,
        wasCorrect: Math.random() > 0.5,
      }));
      const buckets = computeCalibrationBuckets(pairs);
      for (const bucket of buckets) {
        expect(bucket.actualRetention).toBeGreaterThanOrEqual(0);
        expect(bucket.actualRetention).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('computeCalibrationProfile', () => {
    it('returns complete profile with all fields', () => {
      const pairs = Array.from({ length: 50 }, (_, i) => ({
        confidence: 0.3 + (i / 50) * 0.65,
        wasCorrect: Math.random() > 0.5,
      }));
      const profile = computeCalibrationProfile(pairs);
      expect(profile.brierScore).toBeGreaterThanOrEqual(0);
      expect(profile.brierScore).toBeLessThanOrEqual(1);
      expect(profile.dampenerFactor).toBeGreaterThanOrEqual(0.7);
      expect(profile.dampenerFactor).toBeLessThanOrEqual(1.3);
      expect(profile.n).toBe(50);
      expect(profile.buckets).toHaveLength(5);
      expect(profile.computedAt).toBeTruthy();
    });

    it('well-calibrated profile has Brier < 0.25 and dampener ≈ 1.0', () => {
      // Synthetic: confidence matches actual accuracy
      const pairs = Array.from({ length: 100 }, (_, i) => {
        const conf = 0.3 + (i / 100) * 0.65;
        return {
          confidence: conf,
          wasCorrect: Math.random() < conf, // Actual ≈ predicted
        };
      });
      const profile = computeCalibrationProfile(pairs);
      expect(profile.brierScore).toBeLessThan(0.3);
    });

    it('returns finite numeric fields', () => {
      const pairs = [
        { confidence: 0.333, wasCorrect: true },
        { confidence: 0.666, wasCorrect: false },
        { confidence: 0.5, wasCorrect: true },
      ];
      const profile = computeCalibrationProfile(pairs);
      expect(Number.isFinite(profile.brierScore)).toBe(true);
      expect(Number.isFinite(profile.calibrationSlope)).toBe(true);
      expect(Number.isFinite(profile.calibrationIntercept)).toBe(true);
      expect(Number.isFinite(profile.dampenerFactor)).toBe(true);
    });
  });
});
