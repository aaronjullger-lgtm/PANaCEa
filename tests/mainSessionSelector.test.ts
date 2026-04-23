/**
 * Tests for mainSessionQuestionSelector constants and pure functions.
 * The class methods require deep DB mocking — tested via drillPipeline integration tests.
 * Here we cover the exported pure functions and constant relationships.
 */
import { describe, it, expect } from 'vitest';
import {
  getMaxSingleSystemCap,
  getReviewGateEnabled,
  DEFAULT_SESSION_SIZE,
  DEFICIT_THRESHOLD,
  ACCURACY_DEFICIT_THRESHOLD,
  ACCURACY_DEFICIT_MULTIPLIER,
  COLD_START_THRESHOLD,
  MAX_CONSECUTIVE_SAME_SYSTEM,
} from '../lib/services/mainSessionQuestionSelector';

// ─── getMaxSingleSystemCap ────────────────────────────────────────────────────

describe('getMaxSingleSystemCap', () => {
  it('returns ceil(20 * 0.4) = 8 for default session size of 20', () => {
    expect(getMaxSingleSystemCap(DEFAULT_SESSION_SIZE)).toBe(8);
    expect(getMaxSingleSystemCap()).toBe(8); // default arg
  });

  it('returns ceil(10 * 0.4) = 4 for session size 10', () => {
    expect(getMaxSingleSystemCap(10)).toBe(4);
  });

  it('returns ceil(30 * 0.4) = 12 for session size 30', () => {
    expect(getMaxSingleSystemCap(30)).toBe(12);
  });

  it('returns ceil(25 * 0.4) = 10 for session size 25', () => {
    expect(getMaxSingleSystemCap(25)).toBe(10);
  });

  it('result is always a positive integer', () => {
    for (const size of [1, 5, 10, 15, 20, 25, 30, 40, 50]) {
      const cap = getMaxSingleSystemCap(size);
      expect(Number.isInteger(cap)).toBe(true);
      expect(cap).toBeGreaterThan(0);
    }
  });

  it('cap is at most 40% of session size (rounded up)', () => {
    for (const size of [10, 15, 20, 25, 30]) {
      const cap = getMaxSingleSystemCap(size);
      expect(cap).toBeLessThanOrEqual(Math.ceil(size * 0.4) + 0.001);
      expect(cap).toBeGreaterThanOrEqual(Math.floor(size * 0.4));
    }
  });

  it('is monotonically non-decreasing with session size', () => {
    let prev = getMaxSingleSystemCap(5);
    for (let size = 6; size <= 50; size++) {
      const curr = getMaxSingleSystemCap(size);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});

// ─── getReviewGateEnabled ─────────────────────────────────────────────────────

describe('getReviewGateEnabled', () => {
  it('returns true when ENABLE_REVIEW_GATE is not "false"', () => {
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'true' })).toBe(true);
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: '1' })).toBe(true);
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'yes' })).toBe(true);
  });

  it('returns false when ENABLE_REVIEW_GATE is exactly "false"', () => {
    expect(getReviewGateEnabled({ ENABLE_REVIEW_GATE: 'false' })).toBe(false);
  });

  it('falls back to module-level ENABLE_REVIEW_GATE when env is undefined', () => {
    // Just check it returns a boolean — the actual value depends on env at import time
    expect(typeof getReviewGateEnabled(undefined)).toBe('boolean');
  });

  it('falls back to module-level ENABLE_REVIEW_GATE when env is empty object', () => {
    expect(typeof getReviewGateEnabled({})).toBe('boolean');
  });

  it('falls back when the key is absent from env', () => {
    expect(typeof getReviewGateEnabled({ OTHER_VAR: 'something' })).toBe('boolean');
  });
});

// ─── constants ────────────────────────────────────────────────────────────────

describe('exported constants', () => {
  it('DEFAULT_SESSION_SIZE is 20', () => {
    expect(DEFAULT_SESSION_SIZE).toBe(20);
  });

  it('DEFICIT_THRESHOLD is 2.0 percent', () => {
    expect(DEFICIT_THRESHOLD).toBe(2.0);
  });

  it('ACCURACY_DEFICIT_THRESHOLD is 75.0 percent', () => {
    expect(ACCURACY_DEFICIT_THRESHOLD).toBe(75.0);
  });

  it('ACCURACY_DEFICIT_MULTIPLIER is 1.5', () => {
    expect(ACCURACY_DEFICIT_MULTIPLIER).toBe(1.5);
  });

  it('COLD_START_THRESHOLD is 50 questions', () => {
    expect(COLD_START_THRESHOLD).toBe(50);
  });

  it('MAX_CONSECUTIVE_SAME_SYSTEM is 1 (strict no-repeat)', () => {
    expect(MAX_CONSECUTIVE_SAME_SYSTEM).toBe(1);
  });

  it('getMaxSingleSystemCap(DEFAULT_SESSION_SIZE) matches MAX_SINGLE_SYSTEM_CAP', async () => {
    // Verify the deprecated constant is consistent with the function
    const { MAX_SINGLE_SYSTEM_CAP } = await import('../lib/services/mainSessionQuestionSelector');
    expect(MAX_SINGLE_SYSTEM_CAP).toBe(getMaxSingleSystemCap(DEFAULT_SESSION_SIZE));
  });
});
