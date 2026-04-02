/**
 * FSRS Optimizer — Unit Tests (Sprint 5)
 *
 * Tests the continuous-grade parameter optimizer:
 * - Log-loss computation
 * - Single parameter optimization step
 * - Full coordinate descent convergence
 * - Parameter bounds enforcement
 */

import { describe, it, expect } from 'vitest';
import {
  computeLogLoss,
  optimizeOneParameter,
  optimizeParameters,
  OPTIMIZER_CONSTANTS,
} from '../lib/services/fsrsOptimizerService';
import { defaultParameters, type FSRSParameters } from '../lib/fsrs';

const { OPTIMIZABLE_INDICES, PARAM_BOUNDS } = OPTIMIZER_CONSTANTS;

// Helper: generate synthetic review data
function generateReviews(
  count: number,
  opts: { correctRate?: number; avgStability?: number; avgElapsed?: number } = {}
) {
  const { correctRate = 0.8, avgStability = 5, avgElapsed = 3 } = opts;
  return Array.from({ length: count }, (_, i) => ({    stability: avgStability * (0.5 + Math.random()),
    difficulty: 3 + Math.random() * 4,
    elapsedDays: avgElapsed * (0.2 + Math.random() * 1.8),
    gradeContinuous: Math.random() < correctRate ? 2.5 + Math.random() : 1 + Math.random() * 0.5,
    wasCorrect: Math.random() < correctRate,
    retrievability: 0.5 + Math.random() * 0.4,
  }));
}

describe('computeLogLoss', () => {
  it('returns 0 for empty reviews', () => {
    expect(computeLogLoss([], defaultParameters)).toBe(0);
  });

  it('returns a positive finite number for valid reviews', () => {
    const reviews = generateReviews(50);
    const loss = computeLogLoss(reviews, defaultParameters);
    expect(loss).toBeGreaterThan(0);
    expect(Number.isFinite(loss)).toBe(true);
  });

  it('handles reviews with stability=0 gracefully', () => {
    const reviews = [{
      stability: 0,
      difficulty: 5,
      elapsedDays: 3,
      gradeContinuous: 3.0,
      wasCorrect: true,
      retrievability: 0.9,
    }];
    // Should skip zero-stability reviews, return 0
    expect(computeLogLoss(reviews, defaultParameters)).toBe(0);
  });
  it('lower loss for better calibrated model', () => {
    // Perfect model: high stability + short elapsed → high R → correct
    const goodReviews = Array.from({ length: 100 }, () => ({
      stability: 10,
      difficulty: 5,
      elapsedDays: 1,
      gradeContinuous: 3.0,
      wasCorrect: true,
      retrievability: 0.95,
    }));
    // Bad model: high stability + short elapsed → predicts recall, but actually wrong
    const badReviews = Array.from({ length: 100 }, () => ({
      stability: 10,
      difficulty: 5,
      elapsedDays: 1,
      gradeContinuous: 1.0,
      wasCorrect: false,
      retrievability: 0.3,
    }));
    const goodLoss = computeLogLoss(goodReviews, defaultParameters);
    const badLoss = computeLogLoss(badReviews, defaultParameters);
    expect(goodLoss).toBeLessThan(badLoss);
  });
});

describe('optimizeOneParameter', () => {
  it('does not crash for any optimizable index', () => {
    const reviews = generateReviews(50);
    for (const idx of OPTIMIZABLE_INDICES) {
      const result = optimizeOneParameter(reviews, defaultParameters, idx, 0.01);
      expect(result.params).toBeDefined();
      expect(typeof result.improved).toBe('boolean');
    }
  });
  it('respects parameter bounds', () => {
    const reviews = generateReviews(50);
    for (const idx of OPTIMIZABLE_INDICES) {
      const bounds = PARAM_BOUNDS[idx];
      const result = optimizeOneParameter(reviews, defaultParameters, idx, 100);
      const val = result.params.w[idx];
      expect(val).toBeGreaterThanOrEqual(bounds[0]);
      expect(val).toBeLessThanOrEqual(bounds[1]);
    }
  });

  it('does not modify non-target parameters', () => {
    const reviews = generateReviews(50);
    const { params } = optimizeOneParameter(reviews, defaultParameters, 8, 0.01);
    for (let i = 0; i < defaultParameters.w.length; i++) {
      if (i !== 8) {
        expect(params.w[i]).toBe(defaultParameters.w[i]);
      }
    }
  });
});

describe('optimizeParameters (full coordinate descent)', () => {
  it('does not increase loss', () => {
    const reviews = generateReviews(200);
    const { initialLoss, finalLoss } = optimizeParameters(reviews);
    expect(finalLoss).toBeLessThanOrEqual(initialLoss + 1e-6);
  });

  it('returns valid parameter count (21 for v6)', () => {
    const reviews = generateReviews(200);
    const { parameters } = optimizeParameters(reviews);
    expect(parameters.w.length).toBe(21);
  });
  it('preserves non-optimizable parameters (w[15], w[16], w[17], w[18])', () => {
    const reviews = generateReviews(200);
    const { parameters } = optimizeParameters(reviews);
    const nonOptimizable = [15, 16, 17, 18];
    for (const idx of nonOptimizable) {
      expect(parameters.w[idx]).toBe(defaultParameters.w[idx]);
    }
  });

  it('all optimized params stay within bounds', () => {
    const reviews = generateReviews(200);
    const { parameters } = optimizeParameters(reviews);
    for (const idx of OPTIMIZABLE_INDICES) {
      const bounds = PARAM_BOUNDS[idx];
      expect(parameters.w[idx]).toBeGreaterThanOrEqual(bounds[0]);
      expect(parameters.w[idx]).toBeLessThanOrEqual(bounds[1]);
    }
  });

  it('handles edge case of all-correct reviews', () => {
    const reviews = generateReviews(200, { correctRate: 1.0 });
    const { parameters, finalLoss } = optimizeParameters(reviews);
    expect(Number.isFinite(finalLoss)).toBe(true);
    expect(parameters.w.length).toBe(21);
  });

  it('handles edge case of all-incorrect reviews', () => {
    const reviews = generateReviews(200, { correctRate: 0.0 });
    const { parameters, finalLoss } = optimizeParameters(reviews);
    expect(Number.isFinite(finalLoss)).toBe(true);
    expect(parameters.w.length).toBe(21);
  });
});
