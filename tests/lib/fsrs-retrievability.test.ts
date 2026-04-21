/**
 * Tests for the FSRS v6 retrievability helper (lib/fsrs-retrievability.ts).
 *
 * The purpose of this helper is to be the single source of truth for
 * student-facing forgetting-curve math across the app. These tests pin the
 * formula, its inverse, and the curve-builder's shape so future edits can't
 * silently reintroduce Ebbinghaus (exp(-t/S)) or the ad-hoc (1+t/S)^-1 bug.
 */

import { describe, it, expect } from 'vitest';
import {
  FSRS_FACTOR_DEFAULT,
  FSRS_DECAY_DEFAULT,
  retrievability,
  daysUntilRetrievability,
  buildRetrievabilityCurve,
} from '../../lib/fsrs-retrievability';

describe('FSRS retrievability — constants', () => {
  it('FACTOR and DECAY mirror defaultParameters w[19]/w[20] (ts-fsrs v6 defaults)', () => {
    // Sourced from lib/fsrs.ts defaultParameters: w[19]=0.1597, w[20]=2.2700.
    // DECAY is negated because R = (1 + F·t/S)^DECAY uses the already-signed exponent.
    expect(FSRS_FACTOR_DEFAULT).toBeCloseTo(0.1597, 6);
    expect(FSRS_DECAY_DEFAULT).toBeCloseTo(-2.2700, 6);
  });
});

describe('retrievability(elapsedDays, stability)', () => {
  it('returns 1 at day 0 for any positive stability', () => {
    expect(retrievability(0, 1)).toBe(1);
    expect(retrievability(0, 10)).toBe(1);
    expect(retrievability(0, 100)).toBe(1);
  });

  it('matches the ts-fsrs v6 formula at day=10, S=10 (~0.714)', () => {
    // R = (1 + 0.1597·10/10)^(-2.27) = (1.1597)^(-2.27) ≈ 0.7144
    // Under v6 semantics, stability S is the interval at R ≈ 75.4%; the 90%
    // threshold is reached at ~0.3·S (about day 3 here). request_retention
    // (default 0.9) is what the scheduler targets — NOT the R-at-S value.
    const r = retrievability(10, 10);
    expect(r).toBeCloseTo(0.714, 2);
  });

  it('is NOT Ebbinghaus exp(-t/S) — would give ~0.3679 at day=10, S=10', () => {
    const r = retrievability(10, 10);
    expect(r).not.toBeCloseTo(Math.exp(-1), 2); // guard against the original bug
    expect(r).toBeGreaterThan(0.6); // v6 gives ~0.714 at t=S
  });

  it('is NOT the ad-hoc (1 + t/S)^-1 — would give 0.5 at day=10, S=10', () => {
    const r = retrievability(10, 10);
    expect(r).not.toBeCloseTo(0.5, 2);
  });

  it('monotonically decreases as elapsed days grow', () => {
    const series = [0, 1, 3, 7, 14, 30, 90].map((d) => retrievability(d, 10));
    for (let i = 1; i < series.length; i++) {
      const a = series[i - 1]!;
      const b = series[i]!;
      expect(b).toBeLessThanOrEqual(a);
    }
  });

  it('higher stability → higher retention at the same elapsed time', () => {
    const lowS = retrievability(14, 5);
    const hiS = retrievability(14, 50);
    expect(hiS).toBeGreaterThan(lowS);
  });

  it('returns 0 for non-positive or non-finite stability', () => {
    expect(retrievability(10, 0)).toBe(0);
    expect(retrievability(10, -1)).toBe(0);
    expect(retrievability(10, Number.NaN)).toBe(0);
    expect(retrievability(10, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns 1 for non-finite or negative elapsedDays (guarded "past" queries)', () => {
    expect(retrievability(-1, 10)).toBe(1);
    expect(retrievability(Number.NaN, 10)).toBe(1);
  });

  it('clamps into [0, 1]', () => {
    // Extremely long elapsed time with tiny stability should still be ≥ 0
    const r = retrievability(10_000, 0.1);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe('daysUntilRetrievability(stability, targetR)', () => {
  it('is the true inverse of retrievability at R=0.9', () => {
    const S = 10;
    const t = daysUntilRetrievability(S, 0.9);
    expect(retrievability(t, S)).toBeCloseTo(0.9, 6);
  });

  it('is the true inverse of retrievability at R=0.7', () => {
    const S = 25;
    const t = daysUntilRetrievability(S, 0.7);
    expect(retrievability(t, S)).toBeCloseTo(0.7, 6);
  });

  it('returns 0 when the target is R=1 (only satisfied at t=0)', () => {
    expect(daysUntilRetrievability(10, 1)).toBe(0);
  });

  it('returns Infinity for invalid stability or target', () => {
    expect(daysUntilRetrievability(0, 0.9)).toBe(Infinity);
    expect(daysUntilRetrievability(-1, 0.9)).toBe(Infinity);
    expect(daysUntilRetrievability(Number.NaN, 0.9)).toBe(Infinity);
    expect(daysUntilRetrievability(10, 0)).toBe(Infinity);
    expect(daysUntilRetrievability(10, -0.1)).toBe(Infinity);
    expect(daysUntilRetrievability(10, 1.5)).toBe(Infinity);
  });

  it('higher stability → more days until the threshold is crossed', () => {
    const lo = daysUntilRetrievability(5, 0.9);
    const hi = daysUntilRetrievability(50, 0.9);
    expect(hi).toBeGreaterThan(lo);
  });
});

describe('buildRetrievabilityCurve(stability, maxDay)', () => {
  it('returns 31 points by default (days 0..30 inclusive)', () => {
    const curve = buildRetrievabilityCurve(10);
    expect(curve).toHaveLength(31);
    expect(curve[0]!.day).toBe(0);
    expect(curve[30]!.day).toBe(30);
  });

  it('day 0 retention is 100% regardless of stability', () => {
    expect(buildRetrievabilityCurve(0.5)[0]!.retentionProb).toBe(100);
    expect(buildRetrievabilityCurve(1000)[0]!.retentionProb).toBe(100);
  });

  it('retention values are percentages in [0, 100]', () => {
    const curve = buildRetrievabilityCurve(10);
    for (const point of curve) {
      expect(point.retentionProb).toBeGreaterThanOrEqual(0);
      expect(point.retentionProb).toBeLessThanOrEqual(100);
    }
  });

  it('agrees with the scalar helper × 100 at each sampled day', () => {
    const curve = buildRetrievabilityCurve(12);
    for (const point of curve) {
      expect(point.retentionProb).toBeCloseTo(retrievability(point.day, 12) * 100, 9);
    }
  });

  it('returns empty array for non-positive stability', () => {
    expect(buildRetrievabilityCurve(0)).toEqual([]);
    expect(buildRetrievabilityCurve(-1)).toEqual([]);
    expect(buildRetrievabilityCurve(Number.NaN)).toEqual([]);
  });

  it('returns empty array for invalid maxDay', () => {
    expect(buildRetrievabilityCurve(10, -1)).toEqual([]);
    expect(buildRetrievabilityCurve(10, Number.NaN)).toEqual([]);
  });

  it('honors a custom maxDay', () => {
    expect(buildRetrievabilityCurve(10, 7)).toHaveLength(8);
    expect(buildRetrievabilityCurve(10, 0)).toHaveLength(1);
  });
});
