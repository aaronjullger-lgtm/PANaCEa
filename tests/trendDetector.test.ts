import { describe, it, expect } from 'vitest';
import {
  linearTrendFit,
  detectConfidenceTrend,
  DEFAULT_TREND_CONFIG,
  type TrendConfig,
} from '../lib/confidence/trendDetector';

// ─── linearTrendFit ─────────────────────────────────────────────────────────

describe('linearTrendFit — edge cases', () => {
  it('returns zeros for empty array', () => {
    const result = linearTrendFit([]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0);
    expect(result.rSquared).toBe(0);
  });

  it('returns zero slope and intercept = value for single data point', () => {
    const result = linearTrendFit([0.75]);
    expect(result.slope).toBe(0);
    expect(result.intercept).toBe(0.75);
    expect(result.rSquared).toBe(0);
  });

  it('returns zero slope + rSquared for flat values (no variance)', () => {
    const result = linearTrendFit([0.5, 0.5, 0.5, 0.5]);
    expect(result.slope).toBe(0);
    expect(result.rSquared).toBe(0); // ssTot = 0 → short-circuit to 0
  });
});

describe('linearTrendFit — known trends', () => {
  it('computes slope=1 for a perfect increasing line', () => {
    // y = x → slope = 1, intercept = 0, R² = 1
    const result = linearTrendFit([0, 1, 2, 3, 4]);
    expect(result.slope).toBeCloseTo(1, 5);
    expect(result.intercept).toBeCloseTo(0, 5);
    expect(result.rSquared).toBeCloseTo(1, 5);
  });

  it('computes negative slope for decreasing values', () => {
    const result = linearTrendFit([1.0, 0.8, 0.6, 0.4, 0.2]);
    expect(result.slope).toBeCloseTo(-0.2, 5);
    expect(result.rSquared).toBeCloseTo(1, 5);
  });

  it('returns lower R² for noisy data', () => {
    // Noisy but overall flat: [0.5, 0.6, 0.4, 0.55, 0.5]
    const result = linearTrendFit([0.5, 0.6, 0.4, 0.55, 0.5]);
    expect(result.rSquared).toBeLessThan(0.3);
  });

  it('returns high R² for clean linear data', () => {
    const result = linearTrendFit([0.9, 0.8, 0.7, 0.6, 0.5]);
    expect(result.rSquared).toBeGreaterThan(0.9);
  });
});

// ─── detectConfidenceTrend — insufficient data ──────────────────────────────

describe('detectConfidenceTrend — insufficient data', () => {
  it('returns neutral when fewer than minReviews (3) reviews', () => {
    const result = detectConfidenceTrend([0.8, 0.7]);
    expect(result.slope).toBe(0);
    expect(result.trendMultiplier).toBe(1.0);
    expect(result.category).toBe('stable');
    expect(result.isConcerning).toBe(false);
    expect(result.dataPoints).toBe(2);
  });

  it('returns neutral for empty history', () => {
    const result = detectConfidenceTrend([]);
    expect(result.trendMultiplier).toBe(1.0);
    expect(result.dataPoints).toBe(0);
  });
});

// ─── detectConfidenceTrend — R² filtering ───────────────────────────────────

describe('detectConfidenceTrend — R² filtering', () => {
  it('returns neutral multiplier (1.0) for noisy / low-R² trends', () => {
    // Alternating noise — low R² despite some slope
    const result = detectConfidenceTrend([0.5, 0.6, 0.4, 0.55, 0.45, 0.52]);
    expect(result.rSquared).toBeLessThan(DEFAULT_TREND_CONFIG.minRSquared);
    expect(result.trendMultiplier).toBe(1.0);
  });
});

// ─── detectConfidenceTrend — categories ─────────────────────────────────────

describe('detectConfidenceTrend — category classification', () => {
  it('classifies concerning trend when slope <= -0.08', () => {
    // Slope of -0.1: [0.9, 0.8, 0.7, 0.6, 0.5]
    const result = detectConfidenceTrend([0.9, 0.8, 0.7, 0.6, 0.5]);
    expect(result.category).toBe('concerning');
    expect(result.isConcerning).toBe(true);
    expect(result.trendMultiplier).toBeLessThan(1.0);
  });

  it('classifies improving trend when slope > 0.04 (clean increase)', () => {
    // Slope of 0.1: [0.5, 0.6, 0.7, 0.8, 0.9]
    const result = detectConfidenceTrend([0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(result.category).toBe('improving');
    expect(result.isConcerning).toBe(false);
    expect(result.trendMultiplier).toBeGreaterThan(1.0);
  });

  it('classifies declining trend when slope in (-0.08, -0.02)', () => {
    // Slope of ~-0.03 → declining but not concerning
    const result = detectConfidenceTrend([0.85, 0.82, 0.79, 0.76, 0.73]);
    expect(result.category).toBe('declining');
    expect(result.isConcerning).toBe(false);
    expect(result.trendMultiplier).toBeLessThanOrEqual(1.0);
  });

  it('classifies stable trend when slope in (-0.02, 0.04)', () => {
    // Near-flat slope: [0.78, 0.79, 0.78, 0.79, 0.78] has very low R² → neutral
    // Use a clean slightly-positive but below-0.04 slope with high R²
    const result = detectConfidenceTrend([0.80, 0.81, 0.82, 0.83]);
    // Slope = 0.01 → stable zone
    if (result.rSquared >= DEFAULT_TREND_CONFIG.minRSquared) {
      expect(result.category).toBe('stable');
      expect(result.trendMultiplier).toBe(1.0);
    }
  });
});

// ─── detectConfidenceTrend — multiplier clamping ────────────────────────────

describe('detectConfidenceTrend — multiplier bounds', () => {
  it('clamps trendMultiplier to maxPenalty (0.8) for extreme decline', () => {
    // Extreme decline: [1.0, 0.5, 0.1] — very steep slope
    const result = detectConfidenceTrend([1.0, 0.7, 0.4, 0.1]);
    expect(result.trendMultiplier).toBeGreaterThanOrEqual(DEFAULT_TREND_CONFIG.maxPenalty);
  });

  it('clamps trendMultiplier to maxBonus (1.15) for extreme improvement', () => {
    // Extreme improvement
    const result = detectConfidenceTrend([0.1, 0.4, 0.7, 1.0]);
    expect(result.trendMultiplier).toBeLessThanOrEqual(DEFAULT_TREND_CONFIG.maxBonus);
  });
});

// ─── detectConfidenceTrend — window behavior ────────────────────────────────

describe('detectConfidenceTrend — window behavior', () => {
  it('uses only the last maxReviews (8) values when history is longer', () => {
    // 12-element history: first 4 improving, last 8 declining
    const history = [
      0.3, 0.4, 0.5, 0.6, // ignored
      0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, // last 8 — declining
    ];
    const result = detectConfidenceTrend(history);
    expect(result.dataPoints).toBe(DEFAULT_TREND_CONFIG.maxReviews);
    expect(result.slope).toBeLessThan(0);
    expect(result.category).toBe('concerning');
  });

  it('respects custom config (maxReviews=5)', () => {
    const customConfig: TrendConfig = { ...DEFAULT_TREND_CONFIG, maxReviews: 5 };
    const result = detectConfidenceTrend(
      [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3],
      customConfig
    );
    expect(result.dataPoints).toBe(5);
  });

  it('respects custom config (minReviews=5)', () => {
    const customConfig: TrendConfig = { ...DEFAULT_TREND_CONFIG, minReviews: 5 };
    // 4 reviews, minReviews=5 → neutral
    const result = detectConfidenceTrend([0.9, 0.7, 0.5, 0.3], customConfig);
    expect(result.trendMultiplier).toBe(1.0);
    expect(result.category).toBe('stable');
  });
});

// ─── detectConfidenceTrend — rounding ───────────────────────────────────────

describe('detectConfidenceTrend — rounding', () => {
  it('rounds slope and rSquared to 3 decimal places', () => {
    const result = detectConfidenceTrend([0.9, 0.8, 0.7, 0.6, 0.5]);
    // Verify at most 3 decimals of precision on slope
    const slopeStr = result.slope.toString();
    const afterDecimal = slopeStr.includes('.') ? slopeStr.split('.')[1] : '';
    expect(afterDecimal.length).toBeLessThanOrEqual(3);
  });

  it('rounds trendMultiplier to 3 decimal places', () => {
    const result = detectConfidenceTrend([0.5, 0.6, 0.7, 0.8, 0.9]);
    const multStr = result.trendMultiplier.toString();
    const afterDecimal = multStr.includes('.') ? multStr.split('.')[1] : '';
    expect(afterDecimal.length).toBeLessThanOrEqual(3);
  });
});

// ─── DEFAULT_TREND_CONFIG ───────────────────────────────────────────────────

describe('DEFAULT_TREND_CONFIG', () => {
  it('has documented defaults', () => {
    expect(DEFAULT_TREND_CONFIG.minReviews).toBe(3);
    expect(DEFAULT_TREND_CONFIG.maxReviews).toBe(8);
    expect(DEFAULT_TREND_CONFIG.concerningSlope).toBe(-0.08);
    expect(DEFAULT_TREND_CONFIG.minRSquared).toBe(0.3);
    expect(DEFAULT_TREND_CONFIG.maxPenalty).toBe(0.8);
    expect(DEFAULT_TREND_CONFIG.maxBonus).toBe(1.15);
  });
});
