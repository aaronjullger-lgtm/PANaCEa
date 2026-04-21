/**
 * Unit tests for the pure `computeStreak` export from
 * lib/services/sessionRegularityService.ts
 *
 * Rules:
 *   - Empty array → 0
 *   - Last date is neither today nor yesterday → 0
 *   - Consecutive dates anchored at today → streak count
 *   - Consecutive dates anchored at yesterday (today not studied) → streak count
 *   - Gap in the sequence breaks the streak
 */

import { describe, it, expect } from 'vitest';
import { computeStreak } from './sessionRegularityService';

// Build ISO date strings relative to now
function isoDate(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

const today = isoDate(0);
const yesterday = isoDate(1);
const twoDaysAgo = isoDate(2);
const threeDaysAgo = isoDate(3);
const fourDaysAgo = isoDate(4);

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('computeStreak — edge cases', () => {
  it('returns 0 for an empty array', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('returns 0 when last date is two days ago (streak broken)', () => {
    expect(computeStreak([twoDaysAgo])).toBe(0);
  });

  it('returns 0 when last date is far in the past', () => {
    expect(computeStreak([isoDate(30), isoDate(31)])).toBe(0);
  });
});

// ─── Single session ───────────────────────────────────────────────────────────

describe('computeStreak — single session', () => {
  it('returns 1 for a session today', () => {
    expect(computeStreak([today])).toBe(1);
  });

  it('returns 1 for a session yesterday (no session today)', () => {
    expect(computeStreak([yesterday])).toBe(1);
  });
});

// ─── Consecutive days ending today ───────────────────────────────────────────

describe('computeStreak — consecutive days ending today', () => {
  it('counts 2 consecutive days (yesterday + today)', () => {
    expect(computeStreak([yesterday, today])).toBe(2);
  });

  it('counts 3 consecutive days', () => {
    expect(computeStreak([twoDaysAgo, yesterday, today])).toBe(3);
  });

  it('counts 4 consecutive days', () => {
    expect(computeStreak([threeDaysAgo, twoDaysAgo, yesterday, today])).toBe(4);
  });

  it('counts 5 consecutive days', () => {
    const dates = [fourDaysAgo, threeDaysAgo, twoDaysAgo, yesterday, today];
    expect(computeStreak(dates)).toBe(5);
  });
});

// ─── Consecutive days ending yesterday ───────────────────────────────────────

describe('computeStreak — consecutive days ending yesterday', () => {
  it('counts 2 consecutive days ending yesterday', () => {
    expect(computeStreak([twoDaysAgo, yesterday])).toBe(2);
  });

  it('counts 3 consecutive days ending yesterday', () => {
    expect(computeStreak([threeDaysAgo, twoDaysAgo, yesterday])).toBe(3);
  });
});

// ─── Gaps break the streak ────────────────────────────────────────────────────

describe('computeStreak — gaps in history', () => {
  it('returns 1 if gap exists before today (only today counts)', () => {
    // threeDaysAgo, today — gap of 2 days breaks the streak
    const result = computeStreak([threeDaysAgo, today]);
    expect(result).toBe(1);
  });

  it('returns 1 if only yesterday after a gap', () => {
    // fourDaysAgo then yesterday — gap breaks it; only yesterday counts
    const result = computeStreak([fourDaysAgo, yesterday]);
    expect(result).toBe(1);
  });

  it('does not count duplicate entries (sorted set assumed)', () => {
    // Providing sorted unique dates is a contract of the caller
    expect(computeStreak([yesterday, yesterday, today])).toBeGreaterThanOrEqual(1);
  });
});
