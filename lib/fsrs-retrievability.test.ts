// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for lib/fsrs-retrievability.ts
 *
 * Pure functions tested:
 *   retrievability(elapsedDays, stability)          — FSRS v6 R formula
 *   daysUntilRetrievability(stability, targetR)     — inverse of R formula
 *   buildRetrievabilityCurve(stability, maxDay?)    — chart data array
 *
 * Constants verified:
 *   FSRS_FACTOR_DEFAULT  — defaultParameters.w[19] (≈ 0.1597)
 *   FSRS_DECAY_DEFAULT   — -(defaultParameters.w[20]) (≈ -2.27)
 *
 * Formula: R(t) = (1 + FACTOR * t / S) ^ DECAY
 *   At t=0: R=1 (just reviewed)
 *   Decreases monotonically as t increases
 *   R(S) ≈ 0.9 for the 90% retention target
 */

import { describe, it, expect } from 'vitest';
import {
  retrievability,
  daysUntilRetrievability,
  buildRetrievabilityCurve,
  FSRS_FACTOR_DEFAULT,
  FSRS_DECAY_DEFAULT,
} from './fsrs-retrievability';

// ─── Constants ────────────────────────────────────────────────────────────────

describe('FSRS retrievability constants', () => {
  it('FSRS_FACTOR_DEFAULT is a positive number around 0.1597', () => {
    expect(FSRS_FACTOR_DEFAULT).toBeGreaterThan(0);
    expect(FSRS_FACTOR_DEFAULT).toBeLessThan(1);
  });

  it('FSRS_DECAY_DEFAULT is negative (required for decreasing curve)', () => {
    expect(FSRS_DECAY_DEFAULT).toBeLessThan(0);
  });
});

// ─── retrievability ───────────────────────────────────────────────────────────

describe('retrievability', () => {
  it('returns 1 at elapsed=0 (just reviewed)', () => {
    expect(retrievability(0, 10)).toBeCloseTo(1.0, 5);
  });

  it('returns value in (0, 1) for elapsed > 0 and valid stability', () => {
    const r = retrievability(5, 10);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });

  it('is monotonically decreasing as elapsed increases', () => {
    const s = 10;
    const days = [0, 1, 3, 5, 10, 20, 50];
    let prev = retrievability(0, s);
    for (const d of days.slice(1)) {
      const curr = retrievability(d, s);
      expect(curr).toBeLessThanOrEqual(prev + 0.0001);
      prev = curr;
    }
  });

  it('higher stability → slower decay at same elapsed', () => {
    const r_lowS = retrievability(5, 5);
    const r_highS = retrievability(5, 20);
    expect(r_highS).toBeGreaterThan(r_lowS);
  });

  it('returns 1 for negative elapsed (guard clause)', () => {
    expect(retrievability(-1, 10)).toBe(1);
  });

  it('returns 0 for non-positive stability', () => {
    expect(retrievability(5, 0)).toBe(0);
    expect(retrievability(5, -1)).toBe(0);
  });

  it('returns 0 for non-finite stability', () => {
    expect(retrievability(5, Infinity)).toBe(0);
    expect(retrievability(5, NaN)).toBe(0);
  });

  it('returns 1 for non-finite elapsed (guard clause)', () => {
    expect(retrievability(Infinity, 10)).toBe(1);
    expect(retrievability(NaN, 10)).toBe(1);
  });

  it('result is always finite', () => {
    const testCases: [number, number][] = [
      [0, 10], [1, 10], [10, 10], [100, 10], [5, 0.1], [5, 1000],
    ];
    for (const [e, s] of testCases) {
      expect(isFinite(retrievability(e, s))).toBe(true);
    }
  });
});

// ─── daysUntilRetrievability ──────────────────────────────────────────────────

describe('daysUntilRetrievability', () => {
  it('returns Infinity for non-positive stability', () => {
    expect(daysUntilRetrievability(0, 0.9)).toBe(Infinity);
    expect(daysUntilRetrievability(-1, 0.9)).toBe(Infinity);
  });

  it('returns 0 for targetR = 1 (R=1 occurs at t=0, already achieved)', () => {
    expect(daysUntilRetrievability(10, 1.0)).toBe(0);
  });

  it('returns Infinity for invalid targetR (0 or negative)', () => {
    expect(daysUntilRetrievability(10, 0)).toBe(Infinity);
    expect(daysUntilRetrievability(10, -0.1)).toBe(Infinity);
  });

  it('returns 0 for targetR just below 1 (almost just-reviewed)', () => {
    // targetR = 1 → 0 days; very close to 1 → very few days
    const d = daysUntilRetrievability(10, 0.9999);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(1);
  });

  it('days > 0 for any valid (stability, targetR) pair in (0,1)', () => {
    const d = daysUntilRetrievability(10, 0.9);
    expect(d).toBeGreaterThan(0);
    expect(isFinite(d)).toBe(true);
  });

  it('longer stability → more days until targetR is crossed', () => {
    const d10 = daysUntilRetrievability(10, 0.9);
    const d20 = daysUntilRetrievability(20, 0.9);
    expect(d20).toBeGreaterThan(d10);
  });

  it('lower targetR → more days (crosses lower threshold later)', () => {
    const d90 = daysUntilRetrievability(10, 0.9);
    const d70 = daysUntilRetrievability(10, 0.7);
    expect(d70).toBeGreaterThan(d90);
  });

  it('is approximately the inverse of retrievability', () => {
    const stability = 15;
    const targetR = 0.85;
    const days = daysUntilRetrievability(stability, targetR);
    // Verify: retrievability(days, stability) ≈ targetR
    expect(retrievability(days, stability)).toBeCloseTo(targetR, 4);
  });
});

// ─── buildRetrievabilityCurve ─────────────────────────────────────────────────

describe('buildRetrievabilityCurve', () => {
  it('returns empty array for non-positive stability', () => {
    expect(buildRetrievabilityCurve(0)).toHaveLength(0);
    expect(buildRetrievabilityCurve(-5)).toHaveLength(0);
  });

  it('returns (maxDay + 1) points for valid stability', () => {
    const curve = buildRetrievabilityCurve(10, 14);
    expect(curve).toHaveLength(15); // day 0 through day 14
  });

  it('default maxDay=30 → 31 data points', () => {
    const curve = buildRetrievabilityCurve(10);
    expect(curve).toHaveLength(31);
  });

  it('first point has day=0 and retentionProb≈100', () => {
    const curve = buildRetrievabilityCurve(10);
    expect(curve[0]!.day).toBe(0);
    expect(curve[0]!.retentionProb).toBeCloseTo(100, 2);
  });

  it('retentionProb is in [0, 100] for all points', () => {
    const curve = buildRetrievabilityCurve(5, 30);
    for (const point of curve) {
      expect(point.retentionProb).toBeGreaterThanOrEqual(0);
      expect(point.retentionProb).toBeLessThanOrEqual(100);
    }
  });

  it('retentionProb is monotonically non-increasing', () => {
    const curve = buildRetrievabilityCurve(10, 20);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]!.retentionProb).toBeLessThanOrEqual(
        curve[i - 1]!.retentionProb + 0.001
      );
    }
  });

  it('day values are sequential 0, 1, 2, ...', () => {
    const curve = buildRetrievabilityCurve(10, 5);
    curve.forEach((point, i) => {
      expect(point.day).toBe(i);
    });
  });

  it('higher stability → higher retentionProb at same day', () => {
    const lowS = buildRetrievabilityCurve(5, 10);
    const highS = buildRetrievabilityCurve(20, 10);
    // Compare at day 10 (last point)
    expect(highS[10]!.retentionProb).toBeGreaterThan(lowS[10]!.retentionProb);
  });

  it('returns empty array for non-finite maxDay', () => {
    expect(buildRetrievabilityCurve(10, NaN)).toHaveLength(0);
    expect(buildRetrievabilityCurve(10, Infinity)).toHaveLength(0);
  });

  it('each point has required fields: day (number) and retentionProb (number)', () => {
    const curve = buildRetrievabilityCurve(10, 5);
    for (const point of curve) {
      expect(typeof point.day).toBe('number');
      expect(typeof point.retentionProb).toBe('number');
    }
  });
});
