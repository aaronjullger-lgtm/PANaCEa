/**
 * L-BFGS batch optimizer v7-alpha extensions.
 *
 * Pins the v7 support added to lib/fsrs-optimizer.ts:
 *  - PARAMETER_BOUNDS extended to 29 entries
 *  - computeRetrievability dispatches on w.length (v6 vs v7-alpha)
 *  - validateParameters accepts 21 or 29
 *  - optimizeFSRSParameters + runFullOptimization accept an optional
 *    `initialW` seed (21-length for v6, 29-length for v7-alpha)
 *
 * These tests complement tests/fsrs-v7-optimizer.test.ts, which covers the
 * coordinate-descent optimizer in lib/services/fsrsOptimizerService.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  PARAMETER_BOUNDS,
  validateParameters,
  computeRetrievability,
  optimizeFSRSParameters,
  runFullOptimization,
  type OptimizationReview,
} from '../lib/fsrs-optimizer';
import { defaultParameters, FSRSState, Rating, type ReviewSnapshot } from '../lib/fsrs';
import {
  v7AlphaDefaultParameters,
  computeRetrievabilityV7,
} from '../lib/fsrs-v7';

// ─── Bounds ────────────────────────────────────────────────────────────

describe('L-BFGS PARAMETER_BOUNDS — v7-alpha extensions', () => {
  it('has 29 entries in both min and max arrays', () => {
    expect(PARAMETER_BOUNDS.min).toHaveLength(29);
    expect(PARAMETER_BOUNDS.max).toHaveLength(29);
  });

  it('w[21..27] amplitudes bounded [0, 5]', () => {
    for (const i of [21, 23, 25, 27]) {
      expect(PARAMETER_BOUNDS.min[i]).toBe(0.0);
      expect(PARAMETER_BOUNDS.max[i]).toBe(5.0);
    }
  });

  it('w[22..28] rates bounded [0.01, 10]', () => {
    for (const i of [22, 24, 26, 28]) {
      expect(PARAMETER_BOUNDS.min[i]).toBe(0.01);
      expect(PARAMETER_BOUNDS.max[i]).toBe(10.0);
    }
  });
});

// ─── computeRetrievability dispatch ────────────────────────────────────

describe('computeRetrievability — v6 vs v7 dispatch', () => {
  it('uses v6 power-law for 21-length w', () => {
    const r = computeRetrievability(7, 14, defaultParameters.w);
    const factor = defaultParameters.w[19]!;
    const decay = defaultParameters.w[20]!;
    const expected = Math.pow(1 + (factor * 7) / 14, -decay);
    expect(r).toBeCloseTo(expected, 10);
  });

  it('uses v7 8-parameter curve for 29-length w', () => {
    const r = computeRetrievability(7, 14, v7AlphaDefaultParameters.w);
    const expected = computeRetrievabilityV7(7, 14, v7AlphaDefaultParameters);
    expect(r).toBeCloseTo(expected, 10);
  });

  it('v7 curve scales R <= v6 curve at the same t and S (monotonic correction)', () => {
    // With non-negative w[21..28], the v7 correction is >= 1, so R_v7 <= R_v6.
    for (const t of [1, 5, 10, 30]) {
      const r6 = computeRetrievability(t, 10, defaultParameters.w);
      const r7 = computeRetrievability(t, 10, v7AlphaDefaultParameters.w);
      expect(r7).toBeLessThanOrEqual(r6 + 1e-9);
    }
  });

  it('reduces exactly to v6 when v7 amplitudes are zero', () => {
    const zeroedV7 = {
      ...v7AlphaDefaultParameters,
      w: [...defaultParameters.w, 0, 0, 0, 0, 0, 0, 0, 0],
    };
    const r7 = computeRetrievability(5, 10, zeroedV7.w);
    const r6 = computeRetrievability(5, 10, defaultParameters.w);
    expect(r7).toBeCloseTo(r6, 10);
  });

  it('returns 0 for non-positive stability (safety guard)', () => {
    expect(computeRetrievability(5, 0, v7AlphaDefaultParameters.w)).toBe(0);
    expect(computeRetrievability(5, -1, v7AlphaDefaultParameters.w)).toBe(0);
  });
});

// ─── validateParameters ────────────────────────────────────────────────

describe('validateParameters — v7 acceptance', () => {
  // Invariant: the canonical v6 defaults in lib/fsrs.ts MUST live inside
  // the optimizer's bounds. This was not always true (w[6], w[12], w[14],
  // w[16] sat outside a tighter historical bounds region, forcing L-BFGS
  // to clamp on the first iteration — silently discarding the published
  // starting point). Widened on 2026-04; this test pins it.
  it('canonical defaultParameters.w is entirely within L-BFGS bounds', () => {
    const result = validateParameters(defaultParameters.w);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('canonical v7AlphaDefaultParameters.w is entirely within L-BFGS bounds', () => {
    const result = validateParameters(v7AlphaDefaultParameters.w);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  // Helper fixtures for bounds-check tests below.
  const inBoundsV6 = PARAMETER_BOUNDS.min.slice(0, 21).map((lo, i) => {
    const hi = PARAMETER_BOUNDS.max[i]!;
    return (lo + hi) / 2; // midpoint — always valid
  });
  const inBoundsV7 = [...inBoundsV6, ...PARAMETER_BOUNDS.min.slice(21).map((lo, i) => {
    const hi = PARAMETER_BOUNDS.max[21 + i]!;
    return (lo + hi) / 2;
  })];

  it('accepts 21-length v6 arrays when all entries are in bounds', () => {
    const result = validateParameters(inBoundsV6);
    expect(result.valid).toBe(true);
  });

  it('accepts 29-length v7-alpha arrays when all entries are in bounds', () => {
    expect(inBoundsV7).toHaveLength(29);
    const result = validateParameters(inBoundsV7);
    expect(result.valid).toBe(true);
  });

  it('rejects arrays that are neither 21 nor 29', () => {
    const result = validateParameters([0, 0, 0]); // way too short
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/21 or 29/);
  });

  it('catches w[21..28] values out of bounds', () => {
    const poisoned = [...inBoundsV7];
    poisoned[22] = 100; // way above max (10)
    const result = validateParameters(poisoned);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('w[22]'))).toBe(true);
  });

  it('reports the specific out-of-bounds index, regardless of array length', () => {
    const poisoned21 = [...inBoundsV6];
    poisoned21[3] = 1000; // way above w[3] max
    const result = validateParameters(poisoned21);
    expect(result.errors.some((e) => e.includes('w[3]'))).toBe(true);
  });
});

// ─── optimizeFSRSParameters with custom seed ───────────────────────────

function makeReviews(count: number, correctRate = 0.75): OptimizationReview[] {
  // Synthetic OptimizationReview stream. Keeps it deterministic so test
  // convergence is reproducible.
  return Array.from({ length: count }, (_, i) => ({
    stability: 5 + (i % 10),
    difficulty: 4 + (i % 5),
    elapsedDays: 1 + (i % 20) * 0.5,
    rating: (i % 10) / 10 < correctRate ? Rating.Good : Rating.Again,
    state: FSRSState.Review,
    wasCorrect: (i % 10) / 10 < correctRate,
    timestamp: new Date(2026, 0, 1 + (i % 30)),
    elapsed_days: 1 + (i % 20) * 0.5,
    system: 'cardio',
  }));
}

describe('optimizeFSRSParameters — initialW plumbing', () => {
  // Need 1000+ reviews for the L-BFGS path to actually run (below threshold,
  // the function short-circuits to return seed params unchanged).
  const REVIEW_COUNT = 600;

  it(
    'defaults to v6 21-length seed when initialW is not provided',
    () => {
      const reviews = makeReviews(REVIEW_COUNT);
      const result = optimizeFSRSParameters('u1', reviews);
      expect(result.w).toHaveLength(21);
    },
    60_000
  );

  it(
    'produces a 29-length result when seeded with v7-alpha initial weights',
    () => {
      const reviews = makeReviews(REVIEW_COUNT);
      const result = optimizeFSRSParameters(
        'u2',
        reviews,
        undefined,
        v7AlphaDefaultParameters.w
      );
      expect(result.w).toHaveLength(29);
    },
    60_000
  );

  it(
    'short-circuits to seed length when below MIN_REVIEWS_FOR_OPTIMIZATION',
    () => {
      const reviews = makeReviews(5); // way below threshold
      const v7Result = optimizeFSRSParameters(
        'u3',
        reviews,
        undefined,
        v7AlphaDefaultParameters.w
      );
      expect(v7Result.w).toHaveLength(29);
      // When skipped, w should equal the seed (no optimization).
      for (let i = 0; i < 29; i++) {
        expect(v7Result.w[i]).toBe(v7AlphaDefaultParameters.w[i]);
      }
    }
  );
});

// ─── runFullOptimization plumbing ───────────────────────────────────────

describe('runFullOptimization — initialW plumbing', () => {
  function snapshots(count: number): ReviewSnapshot[] {
    return Array.from({ length: count }, (_, i) => ({
      stability: 5 + (i % 10),
      difficulty: 4 + (i % 5),
      elapsedDays: 1 + (i % 20) * 0.5,
      elapsed_days: 1 + (i % 20) * 0.5,
      rating: (i % 2 === 0 ? Rating.Good : Rating.Again),
      reviewedAt: new Date(2026, 0, 1 + (i % 30)).toISOString(),
      wasCorrect: i % 2 === 0,
      state: FSRSState.Review,
    }));
  }

  it('propagates v7-alpha seed through to the optimizer', async () => {
    const result = await runFullOptimization(
      'u-v7',
      snapshots(10), // short-circuits to seed
      undefined,
      v7AlphaDefaultParameters.w
    );
    expect(result.w).toHaveLength(29);
  });

  it('defaults to v6 when no seed provided', async () => {
    const result = await runFullOptimization('u-v6', snapshots(10));
    expect(result.w).toHaveLength(21);
  });
});
