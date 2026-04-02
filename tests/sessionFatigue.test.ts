/**
 * Session Fatigue Detection — Unit Tests (Sprint 2)
 *
 * Tests fatigue correction factor computation and par time adjustment.
 */

import { describe, it, expect } from 'vitest';
import {
  computeFatigueFactor,
  applyFatigueCorrection,
  FATIGUE_THRESHOLD,
  MAX_FATIGUE_FACTOR,
} from '../lib/services/sessionFatigueService';

describe('computeFatigueFactor', () => {
  it('returns 1.0 for questions at or below threshold', () => {
    expect(computeFatigueFactor(1)).toBe(1.0);
    expect(computeFatigueFactor(10)).toBe(1.0);
    expect(computeFatigueFactor(FATIGUE_THRESHOLD)).toBe(1.0);
  });

  it('returns > 1.0 for questions above threshold', () => {
    expect(computeFatigueFactor(FATIGUE_THRESHOLD + 1)).toBeGreaterThan(1.0);
    expect(computeFatigueFactor(20)).toBeGreaterThan(1.0);
    expect(computeFatigueFactor(30)).toBeGreaterThan(1.0);
  });

  it('increases monotonically with question number', () => {
    const f20 = computeFatigueFactor(20);
    const f25 = computeFatigueFactor(25);
    const f30 = computeFatigueFactor(30);
    const f40 = computeFatigueFactor(40);
    expect(f25).toBeGreaterThan(f20);
    expect(f30).toBeGreaterThan(f25);
    expect(f40).toBeGreaterThan(f30);
  });

  it('flattens logarithmically (diminishing returns)', () => {
    const increment16to21 = computeFatigueFactor(21) - computeFatigueFactor(16);
    const increment31to36 = computeFatigueFactor(36) - computeFatigueFactor(31);
    // Later increments should be smaller (log curve flattens)
    expect(increment31to36).toBeLessThan(increment16to21);
  });

  it('never exceeds MAX_FATIGUE_FACTOR', () => {
    expect(computeFatigueFactor(100)).toBeLessThanOrEqual(MAX_FATIGUE_FACTOR);
    expect(computeFatigueFactor(500)).toBeLessThanOrEqual(MAX_FATIGUE_FACTOR);
  });

  it('handles edge cases gracefully', () => {
    expect(computeFatigueFactor(0)).toBe(1.0);
    expect(computeFatigueFactor(-5)).toBe(1.0);
    expect(computeFatigueFactor(NaN)).toBe(1.0);
    expect(computeFatigueFactor(Infinity)).toBe(1.0);
  });

  it('produces reasonable values at key milestones', () => {
    const f20 = computeFatigueFactor(20);  // 5 over threshold
    const f30 = computeFatigueFactor(30);  // 15 over
    const f40 = computeFatigueFactor(40);  // 25 over

    // ~6% at Q20, ~10% at Q30, ~12% at Q40
    expect(f20).toBeGreaterThan(1.04);
    expect(f20).toBeLessThan(1.10);
    expect(f30).toBeGreaterThan(1.08);
    expect(f30).toBeLessThan(1.15);
    expect(f40).toBeGreaterThan(1.10);
    expect(f40).toBeLessThan(1.18);
  });
});

describe('applyFatigueCorrection', () => {
  const basePar = 30000; // 30s

  it('returns unchanged par time when no question number', () => {
    expect(applyFatigueCorrection(basePar, null)).toBe(basePar);
    expect(applyFatigueCorrection(basePar, undefined)).toBe(basePar);
    expect(applyFatigueCorrection(basePar, 0)).toBe(basePar);
  });

  it('returns unchanged par time for early questions', () => {
    expect(applyFatigueCorrection(basePar, 1)).toBe(basePar);
    expect(applyFatigueCorrection(basePar, 10)).toBe(basePar);
    expect(applyFatigueCorrection(basePar, FATIGUE_THRESHOLD)).toBe(basePar);
  });

  it('increases par time for later questions', () => {
    const adjusted = applyFatigueCorrection(basePar, 25);
    expect(adjusted).toBeGreaterThan(basePar);
  });

  it('returns integer milliseconds', () => {
    const adjusted = applyFatigueCorrection(basePar, 25);
    expect(adjusted).toBe(Math.round(adjusted));
  });

  it('max correction is 20% of base par time', () => {
    const maxAdjusted = applyFatigueCorrection(basePar, 500);
    expect(maxAdjusted).toBeLessThanOrEqual(basePar * MAX_FATIGUE_FACTOR);
  });
});
