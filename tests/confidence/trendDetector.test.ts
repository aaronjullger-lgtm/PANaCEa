/**
 * Tests for lib/confidence/trendDetector.ts
 */

import { describe, it, expect } from 'vitest';
import {
  linearTrendFit,
  detectConfidenceTrend,
  DEFAULT_TREND_CONFIG,
  type TrendConfig,
} from '@/lib/confidence/trendDetector';

describe('linearTrendFit', () => {
  it('returns slope 0 for single value', () => {
    const result = linearTrendFit([0.5]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0.5);
    expect(result.rSquared).toBe(0);
  });

  it('returns slope 0 for empty array', () => {
    const result = linearTrendFit([]);
    expect(result.slope).toBe(0);
  });

  it('computes positive slope for increasing values', () => {
    const result = linearTrendFit([0.3, 0.5, 0.7, 0.9]);
    expect(result.slope).toBeGreaterThan(0);
    expect(result.intercept).toBeCloseTo(0.3, 1);
  });

  it('computes negative slope for decreasing values', () => {
    const result = linearTrendFit([0.9, 0.7, 0.5, 0.3]);
    expect(result.slope).toBeLessThan(0);
  });

  it('computes slope 0 for flat values', () => {
    const result = linearTrendFit([0.5, 0.5, 0.5, 0.5]);
    expect(result.slope).toBeCloseTo(0, 5);
    // ssTot = 0 → rSquared defaults to 0 (no variance to explain)
    expect(result.rSquared).toBe(0);
  });

  it('returns rSquared near 1 for perfectly linear data', () => {
    const result = linearTrendFit([0.2, 0.4, 0.6, 0.8, 1.0]);
    expect(result.rSquared).toBeGreaterThan(0.99);
  });

  it('returns lower rSquared for noisy data', () => {
    const noisy = [0.2, 0.9, 0.3, 0.8, 0.1, 0.7];
    const result = linearTrendFit(noisy);
    expect(result.rSquared).toBeLessThan(0.5);
  });
});

describe('detectConfidenceTrend', () => {
  it('returns stable neutral for fewer than minReviews', () => {
    const result = detectConfidenceTrend([0.5, 0.6]);
    expect(result.category).toBe('stable');
    expect(result.trendMultiplier).toBe(1.0);
    expect(result.isConcerning).toBe(false);
  });

  it('returns stable neutral for empty history', () => {
    const result = detectConfidenceTrend([]);
    expect(result.category).toBe('stable');
    expect(result.trendMultiplier).toBe(1.0);
  });

  it('classifies improving trend for strong positive slope', () => {
    // slope ~0.2 per step, R² near 1
    const history = [0.2, 0.4, 0.6, 0.8, 1.0];
    const result = detectConfidenceTrend(history);
    expect(result.category).toBe('improving');
    expect(result.trendMultiplier).toBeGreaterThan(1.0);
  });

  it('classifies concerning for steep negative slope', () => {
    // slope ~-0.2 per step, well below concerningSlope of -0.08
    const history = [1.0, 0.8, 0.6, 0.4, 0.2];
    const result = detectConfidenceTrend(history);
    expect(result.category).toBe('concerning');
    expect(result.isConcerning).toBe(true);
    expect(result.trendMultiplier).toBeLessThan(1.0);
  });

  it('classifies stable for nearly flat trend', () => {
    const history = [0.5, 0.51, 0.49, 0.52, 0.48];
    const result = detectConfidenceTrend(history);
    expect(result.category).toBe('stable');
    expect(result.trendMultiplier).toBe(1.0);
  });

  it('trims history to maxReviews', () => {
    const config: TrendConfig = { ...DEFAULT_TREND_CONFIG, maxReviews: 3 };
    const history = [0.2, 0.3, 0.4, 0.8, 0.9, 1.0]; // last 3 are strongly increasing
    const result = detectConfidenceTrend(history, config);
    expect(result.dataPoints).toBe(3);
  });

  it('ignores weak trends (low R²)', () => {
    const history = [0.9, 0.3, 0.8, 0.2, 0.7]; // noisy, R² low
    const result = detectConfidenceTrend(history);
    expect(result.category).toBe('stable');
  });

  it('trendMultiplier stays within [maxPenalty, maxBonus]', () => {
    const steepIncrease = Array.from({ length: 10 }, (_, i) => i * 0.1);
    const steepDecrease = Array.from({ length: 10 }, (_, i) => 1.0 - i * 0.1);

    const inc = detectConfidenceTrend(steepIncrease);
    const dec = detectConfidenceTrend(steepDecrease);

    expect(inc.trendMultiplier).toBeLessThanOrEqual(DEFAULT_TREND_CONFIG.maxBonus);
    expect(inc.trendMultiplier).toBeGreaterThanOrEqual(DEFAULT_TREND_CONFIG.maxPenalty);
    expect(dec.trendMultiplier).toBeLessThanOrEqual(DEFAULT_TREND_CONFIG.maxBonus);
    expect(dec.trendMultiplier).toBeGreaterThanOrEqual(DEFAULT_TREND_CONFIG.maxPenalty);
  });

  it('returns correct dataPoints count', () => {
    const history = [0.5, 0.5, 0.5, 0.5, 0.5];
    const result = detectConfidenceTrend(history);
    expect(result.dataPoints).toBe(5);
  });
});
