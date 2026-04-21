/**
 * Unit tests for lib/services/sessionAccuracySlopeService.ts
 *
 * MIN_ITEMS_FOR_SLOPE = 6
 * WINDOW_SIZE = 10
 * DECLINE_THRESHOLD = -0.05  → multiplier 0.92
 * WARMUP_THRESHOLD  = +0.05  → multiplier 1.05
 * stable (between thresholds)  → multiplier 1.0
 *
 * Uses clearSessionCache() to reset in-memory state between tests.
 * Each test uses a unique userId to prevent cross-test interference.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordOutcome,
  getConfidenceModifier,
  clearSessionCache,
} from './sessionAccuracySlopeService';

let uid = 0;
function nextUser(): string {
  return `test-user-${uid++}`;
}

beforeEach(() => {
  clearSessionCache();
  uid = 0;
});

// ─── Insufficient data ────────────────────────────────────────────────────────

describe('getConfidenceModifier — insufficient data', () => {
  it('returns neutral result for a brand-new user (no history)', () => {
    const r = getConfidenceModifier(nextUser());
    expect(r.slope).toBeNull();
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.windowSize).toBe(0);
    expect(r.rollingAccuracy).toBeNull();
  });

  it('returns neutral result with fewer than 6 outcomes', () => {
    const user = nextUser();
    for (let i = 0; i < 5; i++) recordOutcome(user, true);
    const r = getConfidenceModifier(user);
    expect(r.slope).toBeNull();
    expect(r.confidenceMultiplier).toBe(1.0);
  });

  it('starts computing after exactly 6 outcomes', () => {
    const user = nextUser();
    for (let i = 0; i < 6; i++) recordOutcome(user, true);
    const r = getConfidenceModifier(user);
    // Should have a slope now (even if 0)
    expect(r.slope).not.toBeNull();
    expect(r.windowSize).toBe(6);
  });
});

// ─── Stable accuracy ─────────────────────────────────────────────────────────

describe('getConfidenceModifier — stable accuracy', () => {
  it('returns multiplier=1.0 for perfect accuracy (all correct)', () => {
    // All correct → slope = 0 (perfectly stable, within [-0.05, 0.05])
    const user = nextUser();
    for (let i = 0; i < 8; i++) recordOutcome(user, true);
    const r = getConfidenceModifier(user);
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.slope).toBeCloseTo(0, 4);
  });

  it('returns multiplier=1.0 for all-incorrect (stable but wrong)', () => {
    // All incorrect → slope = 0 (no change in incorrect pattern)
    const user = nextUser();
    for (let i = 0; i < 8; i++) recordOutcome(user, false);
    const r = getConfidenceModifier(user);
    expect(r.confidenceMultiplier).toBe(1.0);
    expect(r.slope).toBeCloseTo(0, 4);
  });

  it('returns correct rollingAccuracy for all-correct window', () => {
    const user = nextUser();
    for (let i = 0; i < 6; i++) recordOutcome(user, true);
    const r = getConfidenceModifier(user);
    expect(r.rollingAccuracy).toBeCloseTo(1.0, 3);
  });

  it('returns correct rollingAccuracy for mixed window', () => {
    // 3 correct, 3 incorrect → rollingAccuracy = 0.5
    const user = nextUser();
    [true, false, true, false, true, false].forEach(b => recordOutcome(user, b));
    const r = getConfidenceModifier(user);
    expect(r.rollingAccuracy).toBeCloseTo(0.5, 3);
  });
});

// ─── Declining accuracy ───────────────────────────────────────────────────────

describe('getConfidenceModifier — declining accuracy', () => {
  it('returns multiplier=0.92 for sharply declining window', () => {
    // [correct, correct, correct, incorrect, incorrect, incorrect] → strong negative slope
    const user = nextUser();
    [true, true, true, false, false, false].forEach(b => recordOutcome(user, b));
    const r = getConfidenceModifier(user);
    expect(r.slope).toBeLessThan(-0.05);
    expect(r.confidenceMultiplier).toBe(0.92);
  });

  it('correctly computes negative slope for declining pattern', () => {
    // [1,1,1,0,0,0]: slope ≈ -0.257
    const user = nextUser();
    [true, true, true, false, false, false].forEach(b => recordOutcome(user, b));
    const r = getConfidenceModifier(user);
    expect(r.slope).toBeCloseTo(-27 / 105, 3);
  });
});

// ─── Improving accuracy ───────────────────────────────────────────────────────

describe('getConfidenceModifier — improving accuracy (warmup)', () => {
  it('returns multiplier=1.05 for sharply improving window', () => {
    // [incorrect, incorrect, incorrect, correct, correct, correct] → strong positive slope
    const user = nextUser();
    [false, false, false, true, true, true].forEach(b => recordOutcome(user, b));
    const r = getConfidenceModifier(user);
    expect(r.slope).toBeGreaterThan(0.05);
    expect(r.confidenceMultiplier).toBe(1.05);
  });

  it('correctly computes positive slope for improving pattern', () => {
    // [0,0,0,1,1,1]: slope ≈ +0.257
    const user = nextUser();
    [false, false, false, true, true, true].forEach(b => recordOutcome(user, b));
    const r = getConfidenceModifier(user);
    expect(r.slope).toBeCloseTo(27 / 105, 3);
  });
});

// ─── Window size & isolation ──────────────────────────────────────────────────

describe('getConfidenceModifier — windowing', () => {
  it('limits analysis to last 10 outcomes (WINDOW_SIZE)', () => {
    const user = nextUser();
    // First 10: all correct (irrelevant, will be pushed out)
    for (let i = 0; i < 10; i++) recordOutcome(user, true);
    // Next 6: all incorrect (should dominate — but window slides)
    // After 16 total outcomes, the window of 10 is outcomes 7-16 (mixed→declining)
    for (let i = 0; i < 6; i++) recordOutcome(user, false);
    const r = getConfidenceModifier(user);
    // The recent window should show decline
    expect(r.confidenceMultiplier).toBe(0.92);
  });

  it('two different users have isolated session state', () => {
    const user1 = nextUser();
    const user2 = nextUser();
    [true, true, true, false, false, false].forEach(b => recordOutcome(user1, b));
    [false, false, false, true, true, true].forEach(b => recordOutcome(user2, b));
    expect(getConfidenceModifier(user1).confidenceMultiplier).toBe(0.92);
    expect(getConfidenceModifier(user2).confidenceMultiplier).toBe(1.05);
  });

  it('clearSessionCache resets all state', () => {
    const user = nextUser();
    for (let i = 0; i < 8; i++) recordOutcome(user, i % 2 === 0);
    clearSessionCache();
    const r = getConfidenceModifier(user);
    expect(r.slope).toBeNull();
    expect(r.windowSize).toBe(0);
  });
});

// ─── windowSize and rollingAccuracy reporting ────────────────────────────────

describe('getConfidenceModifier — output fields', () => {
  it('windowSize reflects number of outcomes recorded (up to WINDOW_SIZE)', () => {
    const user = nextUser();
    for (let i = 0; i < 6; i++) recordOutcome(user, true);
    expect(getConfidenceModifier(user).windowSize).toBe(6);

    for (let i = 0; i < 4; i++) recordOutcome(user, true);
    expect(getConfidenceModifier(user).windowSize).toBe(10);

    // More than 10: still capped at 10 in the window
    for (let i = 0; i < 5; i++) recordOutcome(user, true);
    expect(getConfidenceModifier(user).windowSize).toBe(10);
  });

  it('rollingAccuracy is in [0, 1]', () => {
    const user = nextUser();
    for (let i = 0; i < 8; i++) recordOutcome(user, i % 3 !== 0);
    const r = getConfidenceModifier(user);
    expect(r.rollingAccuracy).not.toBeNull();
    expect(r.rollingAccuracy!).toBeGreaterThanOrEqual(0);
    expect(r.rollingAccuracy!).toBeLessThanOrEqual(1);
  });

  it('confidenceMultiplier is one of the three expected values', () => {
    const user = nextUser();
    for (let i = 0; i < 8; i++) recordOutcome(user, true);
    const r = getConfidenceModifier(user);
    expect([0.92, 1.0, 1.05]).toContain(r.confidenceMultiplier);
  });
});
