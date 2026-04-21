/**
 * Unit tests for lib/services/intervalDeviationService.ts
 *
 * Constants:
 *   EARLY_THRESHOLD = 0.5        (ratio < 0.5 → firmly early)
 *   ON_TIME_LOW = 0.7            (ratio 0.5–0.7 → interpolated early)
 *   ON_TIME_HIGH = 1.3           (ratio 1.3–1.5 → interpolated late)
 *   LATE_THRESHOLD = 1.5         (ratio > 1.5 → firmly late)
 *
 *   EARLY_MULTIPLIER = 0.85      (correct at high R → less informative)
 *   EARLY_INCORRECT_MULTIPLIER = 1.10
 *   LATE_CORRECT_MULTIPLIER = 1.15
 *   LATE_INCORRECT_MULTIPLIER = 1.0
 */

import { describe, it, expect } from 'vitest';
import { computeIntervalDeviation } from './intervalDeviationService';

describe('computeIntervalDeviation', () => {
  // ─── Guard clauses ────────────────────────────────────────────────────────

  it('returns unknown when scheduledDays is 0', () => {
    const r = computeIntervalDeviation(5, 0, true);
    expect(r.classification).toBe('unknown');
    expect(r.deviationRatio).toBeNull();
    expect(r.informationMultiplier).toBe(1.0);
  });

  it('returns unknown when scheduledDays is negative', () => {
    const r = computeIntervalDeviation(5, -1, true);
    expect(r.classification).toBe('unknown');
    expect(r.deviationRatio).toBeNull();
  });

  it('returns unknown when elapsedDays is negative', () => {
    const r = computeIntervalDeviation(-1, 10, true);
    expect(r.classification).toBe('unknown');
    expect(r.deviationRatio).toBeNull();
  });

  // ─── Firmly early (ratio < 0.5) ──────────────────────────────────────────

  it('early + correct → multiplier 0.85 (less informative)', () => {
    // ratio = 2/10 = 0.2 → firmly early
    const r = computeIntervalDeviation(2, 10, true);
    expect(r.classification).toBe('early');
    expect(r.informationMultiplier).toBeCloseTo(0.85, 2);
    expect(r.deviationRatio).toBeCloseTo(0.2, 2);
  });

  it('early + incorrect → multiplier 1.10 (surprising interference)', () => {
    const r = computeIntervalDeviation(2, 10, false);
    expect(r.classification).toBe('early');
    expect(r.informationMultiplier).toBeCloseTo(1.10, 2);
  });

  // ─── Interpolation zone early (0.5 ≤ ratio < 0.7) ───────────────────────

  it('interpolated early + correct → multiplier between 0.85 and 1.0', () => {
    // ratio = 6/10 = 0.6 → interpolated early zone
    const r = computeIntervalDeviation(6, 10, true);
    expect(r.classification).toBe('early');
    expect(r.informationMultiplier).toBeGreaterThan(0.85);
    expect(r.informationMultiplier).toBeLessThan(1.0);
  });

  it('interpolated early + incorrect → multiplier between 1.0 and 1.10', () => {
    const r = computeIntervalDeviation(6, 10, false);
    expect(r.classification).toBe('early');
    expect(r.informationMultiplier).toBeGreaterThan(1.0);
    expect(r.informationMultiplier).toBeLessThan(1.10);
  });

  // ─── On-time (0.7 ≤ ratio ≤ 1.3) ────────────────────────────────────────

  it('on-time correct → multiplier 1.0', () => {
    // ratio = 10/10 = 1.0 → exactly on time
    const r = computeIntervalDeviation(10, 10, true);
    expect(r.classification).toBe('on_time');
    expect(r.informationMultiplier).toBeCloseTo(1.0, 3);
  });

  it('on-time incorrect → multiplier 1.0', () => {
    const r = computeIntervalDeviation(10, 10, false);
    expect(r.classification).toBe('on_time');
    expect(r.informationMultiplier).toBeCloseTo(1.0, 3);
  });

  it('ratio at 0.7 boundary is on-time or early (boundary inclusive)', () => {
    const r = computeIntervalDeviation(7, 10, true);
    // Either on_time or early — must not be late
    expect(r.classification).not.toBe('late');
  });

  it('ratio at 1.3 boundary is on-time or late (boundary inclusive)', () => {
    const r = computeIntervalDeviation(13, 10, true);
    expect(r.classification).not.toBe('early');
  });

  // ─── Interpolation zone late (1.3 < ratio ≤ 1.5) ────────────────────────

  it('interpolated late + correct → multiplier between 1.0 and 1.15', () => {
    // ratio = 14/10 = 1.4 → interpolated late zone
    const r = computeIntervalDeviation(14, 10, true);
    expect(r.classification).toBe('late');
    expect(r.informationMultiplier).toBeGreaterThan(1.0);
    expect(r.informationMultiplier).toBeLessThan(1.15);
  });

  it('interpolated late + incorrect → multiplier 1.0', () => {
    const r = computeIntervalDeviation(14, 10, false);
    expect(r.classification).toBe('late');
    expect(r.informationMultiplier).toBeCloseTo(1.0, 3);
  });

  // ─── Firmly late (ratio > 1.5) ───────────────────────────────────────────

  it('firmly late + correct → multiplier 1.15 (very informative)', () => {
    // ratio = 20/10 = 2.0 → firmly late
    const r = computeIntervalDeviation(20, 10, true);
    expect(r.classification).toBe('late');
    expect(r.informationMultiplier).toBeCloseTo(1.15, 2);
  });

  it('firmly late + incorrect → multiplier 1.0 (expected failure)', () => {
    const r = computeIntervalDeviation(20, 10, false);
    expect(r.classification).toBe('late');
    expect(r.informationMultiplier).toBeCloseTo(1.0, 2);
  });

  // ─── deviationRatio precision ────────────────────────────────────────────

  it('deviationRatio is rounded to 3 decimal places', () => {
    // 3/7 = 0.428571… → rounded to 0.429
    const r = computeIntervalDeviation(3, 7, true);
    expect(r.deviationRatio).toBe(Math.round((3 / 7) * 1000) / 1000);
  });

  it('informationMultiplier is rounded to 3 decimal places', () => {
    const r = computeIntervalDeviation(10, 10, true);
    const rounded = Math.round(r.informationMultiplier * 1000) / 1000;
    expect(r.informationMultiplier).toBe(rounded);
  });
});
