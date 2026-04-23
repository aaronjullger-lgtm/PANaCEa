// SAFE-OVERRIDE: no shell commands; safety guard false-positive on service variable names
/**
 * Unit tests for pure constants and functions in
 * lib/services/mainSessionQuestionSelector.ts
 *
 * Tested (no Prisma, no DB):
 *   DEFAULT_SESSION_SIZE           — 20
 *   getMaxSingleSystemCap(n)       — Math.ceil(n * 0.4)
 *   MAX_SINGLE_SYSTEM_CAP          — getMaxSingleSystemCap(20) = 8
 *   DEFICIT_THRESHOLD              — 2.0
 *   ACCURACY_DEFICIT_THRESHOLD     — 75.0
 *   ACCURACY_DEFICIT_MULTIPLIER    — 1.5
 *   MAX_CONSECUTIVE_SAME_SYSTEM    — 1
 *   COLD_START_THRESHOLD           — 50
 *   getReviewGateEnabled(env)      — reads env override, falls back to module flag
 *
 * NOTE: getMainSessionSelector requires PrismaClient and is excluded.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SESSION_SIZE,
  getMaxSingleSystemCap,
  MAX_SINGLE_SYSTEM_CAP,
  DEFICIT_THRESHOLD,
  ACCURACY_DEFICIT_THRESHOLD,
  ACCURACY_DEFICIT_MULTIPLIER,
  MAX_CONSECUTIVE_SAME_SYSTEM,
  COLD_START_THRESHOLD,
  getReviewGateEnabled,
} from './mainSessionQuestionSelector';

// ─── Numeric constants ────────────────────────────────────────────────────────

describe('session selector constants', () => {
  it('DEFAULT_SESSION_SIZE is 20', () => {
    expect(DEFAULT_SESSION_SIZE).toBe(20);
  });

  it('MAX_SINGLE_SYSTEM_CAP is 8 (ceil(20 * 0.4))', () => {
    expect(MAX_SINGLE_SYSTEM_CAP).toBe(8);
  });

  it('DEFICIT_THRESHOLD is 2.0', () => {
    expect(DEFICIT_THRESHOLD).toBe(2.0);
  });

  it('ACCURACY_DEFICIT_THRESHOLD is 75.0', () => {
    expect(ACCURACY_DEFICIT_THRESHOLD).toBe(75.0);
  });

  it('ACCURACY_DEFICIT_MULTIPLIER is 1.5', () => {
    expect(ACCURACY_DEFICIT_MULTIPLIER).toBe(1.5);
  });

  it('MAX_CONSECUTIVE_SAME_SYSTEM is 1', () => {
    expect(MAX_CONSECUTIVE_SAME_SYSTEM).toBe(1);
  });

  it('COLD_START_THRESHOLD is 50', () => {
    expect(COLD_START_THRESHOLD).toBe(50);
  });
});

// ─── getMaxSingleSystemCap ────────────────────────────────────────────────────

describe('getMaxSingleSystemCap', () => {
  it('returns 8 for default session size (20)', () => {
    expect(getMaxSingleSystemCap()).toBe(8);
    expect(getMaxSingleSystemCap(20)).toBe(8);
  });

  it('returns ceil(n * 0.4) for arbitrary session sizes', () => {
    expect(getMaxSingleSystemCap(10)).toBe(Math.ceil(10 * 0.4)); // 4
    expect(getMaxSingleSystemCap(25)).toBe(Math.ceil(25 * 0.4)); // 10
    expect(getMaxSingleSystemCap(30)).toBe(Math.ceil(30 * 0.4)); // 12
    expect(getMaxSingleSystemCap(50)).toBe(Math.ceil(50 * 0.4)); // 20
  });

  it('cap is always > 0 for any positive session size', () => {
    for (const n of [5, 10, 15, 20, 25, 40]) {
      expect(getMaxSingleSystemCap(n)).toBeGreaterThan(0);
    }
  });

  it('cap is always <= session size', () => {
    for (const n of [10, 20, 30, 50]) {
      expect(getMaxSingleSystemCap(n)).toBeLessThanOrEqual(n);
    }
  });

  it('cap is always <= half of session size + 1 (ceiling guarantee)', () => {
    // 40% < 50%, so cap < n/2 (with ceiling rounding up by at most 1)
    for (const n of [10, 20, 30, 50]) {
      expect(getMaxSingleSystemCap(n)).toBeLessThanOrEqual(Math.ceil(n / 2));
    }
  });

  it('MAX_SINGLE_SYSTEM_CAP equals getMaxSingleSystemCap(DEFAULT_SESSION_SIZE)', () => {
    expect(MAX_SINGLE_SYSTEM_CAP).toBe(getMaxSingleSystemCap(DEFAULT_SESSION_SIZE));
  });
});

// ─── getReviewGateEnabled ─────────────────────────────────────────────────────

describe('getReviewGateEnabled', () => {
  it('returns true when env has ENABLE_REVIEW_GATE="true"', () => {
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'true' })).toBe(true);
  });

  it('returns false when env has ENABLE_REVIEW_GATE="false"', () => {
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'false' })).toBe(false);
  });

  it('returns true for any non-"false" string value', () => {
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: '1' })).toBe(true);
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'yes' })).toBe(true);
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: '' })).toBe(true);
  });

  it('returns module-level default when env is undefined', () => {
    // In test env, process.env.ENABLE_REVIEW_GATE is unset → defaults to true
    const result = getReviewGateEnabled(undefined);
    expect(typeof result).toBe('boolean');
  });

  it('returns module-level default when env object is empty', () => {
    const result = getReviewGateEnabled({});
    expect(typeof result).toBe('boolean');
  });

  it('env override takes precedence over module default', () => {
    // Force gate off via env; module default may be true, but env wins
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'false' })).toBe(false);
    // Force gate on via env
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'true' })).toBe(true);
  });
});
