/**
 * FSRS v7-alpha optimizer integration tests.
 *
 * Pins the per-review coordinate-descent optimizer's v7 support:
 *   - Dispatch: 21-length params → v6 loss, 29-length → v7 loss
 *   - Optimizable indices: v6 omits w[21..28], v7 includes them
 *   - Bounds: w[21..28] are respected
 *   - Optimizer can actually move w[21..28] toward lower loss
 *
 * These tests do not cover the batch L-BFGS optimizer in lib/fsrs-optimizer.ts;
 * that's a separate file with its own bounds array.
 */

import { describe, it, expect } from 'vitest';
import {
  computeLogLoss,
  optimizeParameters,
  OPTIMIZER_CONSTANTS,
  getOptimizableIndicesForParams,
} from '../lib/services/fsrsOptimizerService';
import { defaultParameters, type FSRSParameters } from '../lib/fsrs';
import { v7AlphaDefaultParameters, computeRetrievabilityV7 } from '../lib/fsrs-v7';

const { OPTIMIZABLE_INDICES_V6, OPTIMIZABLE_INDICES_V7, PARAM_BOUNDS } = OPTIMIZER_CONSTANTS;

// Synthetic review data. Deterministic — no random — so convergence is reproducible.
function makeReviews(
  count: number,
  opts: { correctRate?: number; avgStability?: number; avgElapsed?: number } = {}
) {
  const { correctRate = 0.8, avgStability = 5, avgElapsed = 3 } = opts;
  return Array.from({ length: count }, (_, i) => ({
    stability: avgStability * (0.5 + ((i % 7) / 7)),
    difficulty: 3 + (i % 5),
    elapsedDays: avgElapsed * (0.2 + ((i % 11) / 11) * 1.8),
    gradeContinuous: (i % 10) / 10 < correctRate ? 2.8 : 1.2,
    wasCorrect: (i % 10) / 10 < correctRate,
    retrievability: 0.5 + ((i % 13) / 13) * 0.4,
  }));
}

// ────────────────────────────────────────────────────────────────────
// Index dispatch
// ────────────────────────────────────────────────────────────────────

describe('getOptimizableIndicesForParams', () => {
  it('returns v6 indices for 21-length w', () => {
    expect(getOptimizableIndicesForParams(defaultParameters.w)).toEqual(OPTIMIZABLE_INDICES_V6);
  });

  it('returns v7 indices (+ w[21..28]) for 29-length w', () => {
    expect(getOptimizableIndicesForParams(v7AlphaDefaultParameters.w)).toEqual(
      OPTIMIZABLE_INDICES_V7
    );
  });

  it('v7 indices include all 8 curve params', () => {
    for (let i = 21; i <= 28; i++) {
      expect(OPTIMIZABLE_INDICES_V7).toContain(i);
    }
  });

  it('v6 indices do not include any of w[21..28]', () => {
    for (let i = 21; i <= 28; i++) {
      expect(OPTIMIZABLE_INDICES_V6).not.toContain(i);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Log-loss v6/v7 dispatch
// ────────────────────────────────────────────────────────────────────

describe('computeLogLoss version dispatch', () => {
  it('uses v6 retrievability for 21-length params', () => {
    const reviews = makeReviews(30);
    const loss = computeLogLoss(reviews, defaultParameters);
    expect(loss).toBeGreaterThan(0);
    expect(Number.isFinite(loss)).toBe(true);
  });

  it('uses v7 retrievability for 29-length params', () => {
    const reviews = makeReviews(30);
    const loss = computeLogLoss(reviews, v7AlphaDefaultParameters);
    expect(loss).toBeGreaterThan(0);
    expect(Number.isFinite(loss)).toBe(true);
  });

  it('v7 loss differs from v6 loss on identical data (curves differ)', () => {
    const reviews = makeReviews(50);
    const v6Loss = computeLogLoss(reviews, defaultParameters);
    const v7Loss = computeLogLoss(reviews, v7AlphaDefaultParameters);
    // Different curves → different loss values. Both valid.
    expect(Math.abs(v6Loss - v7Loss)).toBeGreaterThan(1e-6);
  });

  it('v7 loss matches a hand-rolled evaluation via computeRetrievabilityV7', () => {
    const reviews = makeReviews(20);
    const direct = (() => {
      const eps = 1e-7;
      let total = 0;
      for (const r of reviews) {
        if (r.stability <= 0 || r.elapsedDays < 0) continue;
        const p = computeRetrievabilityV7(r.elapsedDays, r.stability, v7AlphaDefaultParameters);
        const clamped = Math.max(eps, Math.min(1 - eps, p));
        const y = r.wasCorrect ? 1 : 0;
        total += -(y * Math.log(clamped) + (1 - y) * Math.log(1 - clamped));
      }
      return total / reviews.length;
    })();
    const viaService = computeLogLoss(reviews, v7AlphaDefaultParameters);
    expect(viaService).toBeCloseTo(direct, 10);
  });
});

// ────────────────────────────────────────────────────────────────────
// Bounds
// ────────────────────────────────────────────────────────────────────

describe('v7 parameter bounds', () => {
  it('PARAM_BOUNDS has 29 entries', () => {
    expect(PARAM_BOUNDS).toHaveLength(29);
  });

  it('w[21..28] amplitudes bounded [0, 5]', () => {
    for (const i of [21, 23, 25, 27]) {
      expect(PARAM_BOUNDS[i]![0]).toBe(0.0);
      expect(PARAM_BOUNDS[i]![1]).toBe(5.0);
    }
  });

  it('w[22..28] rates bounded [0.01, 10]', () => {
    for (const i of [22, 24, 26, 28]) {
      expect(PARAM_BOUNDS[i]![0]).toBe(0.01);
      expect(PARAM_BOUNDS[i]![1]).toBe(10.0);
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// End-to-end optimization
// ────────────────────────────────────────────────────────────────────

describe('optimizeParameters — v6 vs v7 behavior', () => {
  it('v6 params: optimizer does not touch w[21..28] (out-of-bounds access safe)', () => {
    const reviews = makeReviews(60);
    const { parameters: after } = optimizeParameters(reviews, defaultParameters);
    expect(after.w).toHaveLength(21);
  });

  it('v7 params: optimizer preserves w array length 29', () => {
    const reviews = makeReviews(60);
    const { parameters: after } = optimizeParameters(reviews, v7AlphaDefaultParameters);
    expect(after.w).toHaveLength(29);
  });

  it('v7 params: all optimized weights stay within bounds', () => {
    const reviews = makeReviews(60);
    const { parameters: after } = optimizeParameters(reviews, v7AlphaDefaultParameters);
    for (let i = 0; i < 29; i++) {
      const bounds = PARAM_BOUNDS[i]!;
      const v = after.w[i]!;
      expect(v).toBeGreaterThanOrEqual(bounds[0] - 1e-9);
      expect(v).toBeLessThanOrEqual(bounds[1] + 1e-9);
    }
  });

  it('v7 optimization reduces (or at worst preserves) log-loss vs defaults', () => {
    const reviews = makeReviews(80);
    const { initialLoss, finalLoss } = optimizeParameters(reviews, v7AlphaDefaultParameters);
    expect(finalLoss).toBeLessThanOrEqual(initialLoss + 1e-9);
  });

  it('v7 optimizer can move w[21..28] from defaults when it helps', () => {
    // Construct data where the default v7 curve is mis-calibrated — all
    // reviews correct at a retrievability the default model under-predicts.
    const reviews = Array.from({ length: 100 }, (_, i) => ({
      stability: 10,
      difficulty: 5,
      elapsedDays: 3 + (i % 5),
      gradeContinuous: 3,
      wasCorrect: true, // systematic over-prediction of forgetting
      retrievability: 0.95,
    }));
    const { parameters: after } = optimizeParameters(reviews, v7AlphaDefaultParameters);
    // At least one v7 curve parameter (w[21..28]) should have moved from its
    // reference default. If none moved, the v7 branch is not actually being
    // exercised — that would be a regression.
    let anyMoved = false;
    for (let i = 21; i <= 28; i++) {
      if (Math.abs(after.w[i]! - v7AlphaDefaultParameters.w[i]!) > 1e-9) {
        anyMoved = true;
        break;
      }
    }
    expect(anyMoved).toBe(true);
  });
});
