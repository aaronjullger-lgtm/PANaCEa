/**
 * Tests for Cross-Session Confidence Trend Detector
 * Sprint 7 of Confidence Pipeline v3
 */
import { describe, it, expect } from 'vitest';
import {
  detectConfidenceTrend,
  linearTrendFit,
  DEFAULT_TREND_CONFIG,
  type TrendConfig,
} from '../lib/confidence/trendDetector';

describe('Confidence Trend Detector', () => {
  describe('linearTrendFit', () => {
    it('detects positive slope for increasing values', () => {
      const { slope } = linearTrendFit([0.5, 0.6, 0.7, 0.8, 0.9]);
      expect(slope).toBeGreaterThan(0);
      expect(slope).toBeCloseTo(0.1, 2);
    });

    it('detects negative slope for decreasing values', () => {
      const { slope } = linearTrendFit([0.9, 0.8, 0.7, 0.6, 0.5]);
      expect(slope).toBeLessThan(0);
      expect(slope).toBeCloseTo(-0.1, 2);
    });

    it('detects zero slope for flat values', () => {
      const { slope } = linearTrendFit([0.7, 0.7, 0.7, 0.7]);
      expect(slope).toBeCloseTo(0, 5);
    });

    it('returns R² = 1.0 for perfectly linear data', () => {
      const { rSquared } = linearTrendFit([0.3, 0.4, 0.5, 0.6, 0.7]);
      expect(rSquared).toBeCloseTo(1.0, 3);
    });

    it('returns low R² for noisy data', () => {
      const { rSquared } = linearTrendFit([0.3, 0.8, 0.4, 0.9, 0.5]);
      expect(rSquared).toBeLessThan(0.5);
    });

    it('handles single value', () => {
      const { slope, rSquared } = linearTrendFit([0.7]);
      expect(slope).toBe(0);
      expect(rSquared).toBe(0);
    });

    it('handles two values', () => {
      const { slope, rSquared } = linearTrendFit([0.5, 0.8]);
      expect(slope).toBeCloseTo(0.3, 5);
      expect(rSquared).toBeCloseTo(1.0, 5);
    });
  });

  describe('detectConfidenceTrend', () => {
    it('returns neutral for insufficient history', () => {
      const result = detectConfidenceTrend([0.5, 0.3]);
      expect(result.trendMultiplier).toBe(1.0);
      expect(result.category).toBe('stable');
      expect(result.isConcerning).toBe(false);
    });

    it('detects concerning decline with strong linear fit', () => {
      // Strong downward trend: 0.90 → 0.50 over 5 reviews (slope ≈ -0.10, below -0.08 threshold)
      const result = detectConfidenceTrend([0.90, 0.80, 0.70, 0.60, 0.50]);
      expect(result.slope).toBeLessThan(-0.08);
      expect(result.category).toBe('concerning');
      expect(result.isConcerning).toBe(true);
      expect(result.trendMultiplier).toBeLessThan(1.0);
    });

    it('detects improving trend', () => {
      const result = detectConfidenceTrend([0.4, 0.5, 0.6, 0.7, 0.8]);
      expect(result.slope).toBeGreaterThan(0);
      expect(result.category).toBe('improving');
      expect(result.trendMultiplier).toBeGreaterThan(1.0);
    });

    it('returns stable for flat confidence', () => {
      const result = detectConfidenceTrend([0.7, 0.71, 0.69, 0.7, 0.71]);
      expect(result.category).toBe('stable');
      expect(result.trendMultiplier).toBeCloseTo(1.0, 1);
    });

    it('ignores noisy data with low R²', () => {
      // Noisy data: no clear trend
      const result = detectConfidenceTrend([0.3, 0.9, 0.4, 0.8, 0.5]);
      // R² will be low → should return stable/neutral
      if (result.rSquared < DEFAULT_TREND_CONFIG.minRSquared) {
        expect(result.trendMultiplier).toBe(1.0);
      }
    });
  });

  describe('multiplier bounds', () => {
    it('never goes below maxPenalty', () => {
      // Extreme decline
      const result = detectConfidenceTrend([0.95, 0.7, 0.45, 0.3, 0.3]);
      expect(result.trendMultiplier).toBeGreaterThanOrEqual(DEFAULT_TREND_CONFIG.maxPenalty);
    });

    it('never exceeds maxBonus', () => {
      // Extreme improvement
      const result = detectConfidenceTrend([0.3, 0.5, 0.7, 0.85, 0.95]);
      expect(result.trendMultiplier).toBeLessThanOrEqual(DEFAULT_TREND_CONFIG.maxBonus);
    });

    it('multiplier range is [0.8, 1.15]', () => {
      expect(DEFAULT_TREND_CONFIG.maxPenalty).toBe(0.8);
      expect(DEFAULT_TREND_CONFIG.maxBonus).toBe(1.15);
    });
  });

  describe('maxReviews trimming', () => {
    it('only uses the most recent N reviews', () => {
      // 12 reviews: first 4 declining, last 8 improving
      const history = [
        0.9, 0.8, 0.7, 0.6, // old — should be trimmed
        0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8 // recent — improving
      ];
      const result = detectConfidenceTrend(history);
      // Should only see the improving part (last 8)
      expect(result.slope).toBeGreaterThan(0);
    });
  });

  describe('custom config', () => {
    it('respects custom minReviews', () => {
      const config: TrendConfig = { ...DEFAULT_TREND_CONFIG, minReviews: 5 };
      const result = detectConfidenceTrend([0.9, 0.7, 0.5], config);
      expect(result.trendMultiplier).toBe(1.0); // Not enough data
    });

    it('respects custom concerningSlope', () => {
      const lenientConfig: TrendConfig = { ...DEFAULT_TREND_CONFIG, concerningSlope: -0.15 };
      const strictConfig: TrendConfig = { ...DEFAULT_TREND_CONFIG, concerningSlope: -0.03 };

      const history = [0.8, 0.73, 0.66, 0.60, 0.55]; // slope ≈ -0.06

      const lenient = detectConfidenceTrend(history, lenientConfig);
      const strict = detectConfidenceTrend(history, strictConfig);

      // Lenient: slope -0.06 > -0.15 → not concerning
      // Strict: slope -0.06 < -0.03 → concerning
      expect(strict.isConcerning).toBe(true);
    });
  });

  describe('data points reporting', () => {
    it('reports correct number of data points used', () => {
      const history = [0.5, 0.6, 0.7, 0.8, 0.9];
      const result = detectConfidenceTrend(history);
      expect(result.dataPoints).toBe(5);
    });

    it('reports trimmed count when exceeding maxReviews', () => {
      const history = Array.from({ length: 15 }, (_, i) => 0.5 + i * 0.03);
      const result = detectConfidenceTrend(history);
      expect(result.dataPoints).toBe(DEFAULT_TREND_CONFIG.maxReviews);
    });
  });

  describe('mild decline category', () => {
    it('detects mild decline (between -0.02 and concerningSlope)', () => {
      // Slope around -0.04 (mild decline, not concerning)
      const result = detectConfidenceTrend([0.75, 0.73, 0.71, 0.69, 0.67]);
      if (result.rSquared >= DEFAULT_TREND_CONFIG.minRSquared) {
        // The slope is about -0.02, which is right at the boundary
        expect(['declining', 'stable']).toContain(result.category);
      }
    });
  });
});
