/**
 * Unit tests for lib/services/sessionFatigueService.ts
 *
 * FATIGUE_THRESHOLD = 15   (correction kicks in after Q15)
 * FATIGUE_RATE = 0.035
 * MAX_FATIGUE_FACTOR = 1.20
 *
 * computeFatigueFactor(q):
 *   q ≤ 15 → 1.0
 *   q > 15 → min(1.20, 1.0 + 0.035 * ln(1 + (q - 15)))
 *
 * computeFatigueConfidenceDampener(q):
 *   q ≤ 15 → 1.0
 *   q > 15 → max(0.85, 1.0 - 0.035 * ln(1 + (q - 15)))
 */

import { describe, it, expect } from 'vitest';
import {
  computeFatigueFactor,
  applyFatigueCorrection,
  computeFatigueConfidenceDampener,
  FATIGUE_THRESHOLD,
  FATIGUE_RATE,
  MAX_FATIGUE_FACTOR,
} from './sessionFatigueService';

// ─── computeFatigueFactor ─────────────────────────────────────────────────────

describe('computeFatigueFactor', () => {
  it('returns 1.0 at exactly the fatigue threshold', () => {
    expect(computeFatigueFactor(FATIGUE_THRESHOLD)).toBe(1.0);
  });

  it('returns 1.0 for any question at or before threshold', () => {
    expect(computeFatigueFactor(1)).toBe(1.0);
    expect(computeFatigueFactor(10)).toBe(1.0);
    expect(computeFatigueFactor(14)).toBe(1.0);
  });

  it('returns 1.0 for non-finite input', () => {
    expect(computeFatigueFactor(Infinity)).toBe(1.0);
    expect(computeFatigueFactor(NaN)).toBe(1.0);
  });

  it('returns greater than 1.0 for questions beyond threshold', () => {
    expect(computeFatigueFactor(16)).toBeGreaterThan(1.0);
    expect(computeFatigueFactor(20)).toBeGreaterThan(1.0);
    expect(computeFatigueFactor(30)).toBeGreaterThan(1.0);
  });

  it('computes correct factor at Q20 (~6% increase)', () => {
    // questionsOver=5, factor = 1 + 0.035*ln(6) ≈ 1.0627
    const expected = 1.0 + FATIGUE_RATE * Math.log(1 + (20 - FATIGUE_THRESHOLD));
    expect(computeFatigueFactor(20)).toBeCloseTo(expected, 5);
    expect(computeFatigueFactor(20)).toBeGreaterThan(1.06);
    expect(computeFatigueFactor(20)).toBeLessThan(1.07);
  });

  it('computes correct factor at Q30 (~10% increase)', () => {
    // questionsOver=15, factor = 1 + 0.035*ln(16) ≈ 1.097
    expect(computeFatigueFactor(30)).toBeGreaterThan(1.09);
    expect(computeFatigueFactor(30)).toBeLessThan(1.11);
  });

  it('caps at MAX_FATIGUE_FACTOR for very large question numbers', () => {
    // Cap hits when 1 + 0.035*ln(1+Q-15) = 1.20, i.e. Q ≥ ~317
    expect(computeFatigueFactor(400)).toBe(MAX_FATIGUE_FACTOR);
    expect(computeFatigueFactor(1000)).toBe(MAX_FATIGUE_FACTOR);
  });

  it('never exceeds MAX_FATIGUE_FACTOR', () => {
    for (const q of [15, 20, 30, 50, 100, 500]) {
      expect(computeFatigueFactor(q)).toBeLessThanOrEqual(MAX_FATIGUE_FACTOR);
    }
  });

  it('is monotonically non-decreasing', () => {
    let prev = computeFatigueFactor(1);
    for (let q = 2; q <= 100; q++) {
      const curr = computeFatigueFactor(q);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});

// ─── applyFatigueCorrection ───────────────────────────────────────────────────

describe('applyFatigueCorrection', () => {
  it('returns parTimeMs unchanged when questionNumber is null', () => {
    expect(applyFatigueCorrection(5000, null)).toBe(5000);
  });

  it('returns parTimeMs unchanged when questionNumber is undefined', () => {
    expect(applyFatigueCorrection(5000, undefined)).toBe(5000);
  });

  it('returns parTimeMs unchanged when questionNumber is 0 or negative', () => {
    expect(applyFatigueCorrection(5000, 0)).toBe(5000);
    expect(applyFatigueCorrection(5000, -1)).toBe(5000);
  });

  it('returns parTimeMs unchanged for early questions (no fatigue)', () => {
    expect(applyFatigueCorrection(5000, 10)).toBe(5000);
    expect(applyFatigueCorrection(5000, 15)).toBe(5000);
  });

  it('returns rounded increased value for late questions', () => {
    const result = applyFatigueCorrection(10000, 20);
    const factor = computeFatigueFactor(20);
    expect(result).toBe(Math.round(10000 * factor));
    expect(result).toBeGreaterThan(10000);
  });

  it('correctly applies rounding', () => {
    // Result must be an integer
    const result = applyFatigueCorrection(7777, 25);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('later questions produce longer adjusted par time', () => {
    const early = applyFatigueCorrection(10000, 20);
    const late = applyFatigueCorrection(10000, 35);
    expect(late).toBeGreaterThanOrEqual(early);
  });
});

// ─── computeFatigueConfidenceDampener ────────────────────────────────────────

describe('computeFatigueConfidenceDampener', () => {
  it('returns 1.0 at exactly the fatigue threshold', () => {
    expect(computeFatigueConfidenceDampener(FATIGUE_THRESHOLD)).toBe(1.0);
  });

  it('returns 1.0 for questions at or before threshold', () => {
    expect(computeFatigueConfidenceDampener(1)).toBe(1.0);
    expect(computeFatigueConfidenceDampener(10)).toBe(1.0);
  });

  it('returns 1.0 for non-finite input', () => {
    expect(computeFatigueConfidenceDampener(Infinity)).toBe(1.0);
    expect(computeFatigueConfidenceDampener(NaN)).toBe(1.0);
  });

  it('returns less than 1.0 for questions beyond threshold', () => {
    expect(computeFatigueConfidenceDampener(20)).toBeLessThan(1.0);
    expect(computeFatigueConfidenceDampener(30)).toBeLessThan(1.0);
  });

  it('computes correct dampener at Q20 (~6% reduction)', () => {
    // fatiguePenalty = 0.035*ln(6); dampener = 1 - penalty ≈ 0.9373
    const penalty = FATIGUE_RATE * Math.log(1 + (20 - FATIGUE_THRESHOLD));
    expect(computeFatigueConfidenceDampener(20)).toBeCloseTo(1 - penalty, 5);
    expect(computeFatigueConfidenceDampener(20)).toBeGreaterThan(0.93);
    expect(computeFatigueConfidenceDampener(20)).toBeLessThan(0.94);
  });

  it('floors at 0.85 for very large question numbers', () => {
    expect(computeFatigueConfidenceDampener(200)).toBe(0.85);
    expect(computeFatigueConfidenceDampener(1000)).toBe(0.85);
  });

  it('never goes below 0.85', () => {
    for (const q of [15, 20, 30, 50, 100, 500]) {
      expect(computeFatigueConfidenceDampener(q)).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('never exceeds 1.0', () => {
    for (const q of [1, 10, 15, 20, 50]) {
      expect(computeFatigueConfidenceDampener(q)).toBeLessThanOrEqual(1.0);
    }
  });

  it('is monotonically non-increasing', () => {
    let prev = computeFatigueConfidenceDampener(1);
    for (let q = 2; q <= 100; q++) {
      const curr = computeFatigueConfidenceDampener(q);
      expect(curr).toBeLessThanOrEqual(prev + 1e-10); // tiny epsilon for float
      prev = curr;
    }
  });
});
