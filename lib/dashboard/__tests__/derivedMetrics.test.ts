/**
 * derivedMetrics — regression tests
 *
 * Targeted at two specific bugs:
 * 1. deriveStudyTime fabricates phantom study time when totalAttempts = 0
 * 2. blendAccuracy returns NaN when a single source is NaN (not null)
 */

import { describe, it, expect } from 'vitest';
import { deriveStudyTime, blendAccuracy, deriveAccuracy } from '../derivedMetrics';
import type { DatabaseStats } from '@/hooks/useDatabaseStats';

// ---------------------------------------------------------------------------
// Helpers – minimal DatabaseStats stubs
// ---------------------------------------------------------------------------

function makeDatabaseStats(overrides: Partial<DatabaseStats['overall']> = {}): DatabaseStats {
  return {
    overall: {
      totalAttempts: 0,
      correctAttempts: 0,
      accuracy: 0,
      questionsSeenCount: 0,
      currentStreak: 0,
      totalStudyDays: 0,
      avgTimeMs: null,
      avgAnswerChanges: null,
      todayCount: 0,
      todayTimeMs: 0,
      ...overrides,
    },
    bySystems: {},
    recentPerformance: { trend: 'insufficient_data' },
    recommendations: [],
  } as DatabaseStats;
}

// ===========================================================================
// BUG 1: deriveStudyTime phantom study time
// ===========================================================================

describe('deriveStudyTime', () => {
  it('returns 0 totalMs when totalAttempts is 0 even if avgTimeMs is positive', () => {
    const db = makeDatabaseStats({ totalAttempts: 0, avgTimeMs: 5000 });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
    expect(result.display.total).toBe('0s');
  });

  it('returns 0 totalMs when totalAttempts is null', () => {
    // Simulate a fresh user whose totalAttempts hasn't been computed yet
    const db = makeDatabaseStats({ avgTimeMs: 3000 });
    // Force totalAttempts to undefined/null to simulate missing field
    (db.overall as Record<string, unknown>).totalAttempts = null;
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
  });

  it('computes correct totalMs when both avgTimeMs and totalAttempts are valid', () => {
    const db = makeDatabaseStats({ totalAttempts: 100, avgTimeMs: 5000 });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(500_000); // 5s * 100
  });

  it('returns 0 totalMs when avgTimeMs is null', () => {
    const db = makeDatabaseStats({ totalAttempts: 50, avgTimeMs: null });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
  });

  it('returns 0 totalMs when avgTimeMs is NaN', () => {
    const db = makeDatabaseStats({ totalAttempts: 50, avgTimeMs: NaN });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
  });

  it('returns 0 totalMs when avgTimeMs is Infinity', () => {
    const db = makeDatabaseStats({ totalAttempts: 50, avgTimeMs: Infinity });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
  });

  it('returns 0 totalMs when database is null', () => {
    const result = deriveStudyTime(null);
    expect(result.totalMs).toBe(0);
  });

  it('safely handles todayTimeMs as NaN', () => {
    const db = makeDatabaseStats({ todayTimeMs: NaN as unknown as number });
    const result = deriveStudyTime(db);
    expect(result.todayMs).toBe(0);
  });
});

// ===========================================================================
// BUG 2: blendAccuracy NaN passthrough on single-source paths
// ===========================================================================

describe('blendAccuracy', () => {
  it('returns 0 when both sources are null', () => {
    expect(blendAccuracy(null, null)).toBe(0);
  });

  it('returns lifetime when rolling360 is null', () => {
    expect(blendAccuracy(null, 0.75)).toBe(0.75);
  });

  it('returns rolling360 when lifetime is null', () => {
    expect(blendAccuracy(0.80, null)).toBe(0.80);
  });

  it('blends with 0.7/0.3 weights when both sources are present', () => {
    const result = blendAccuracy(0.8, 0.6);
    expect(result).toBeCloseTo(0.8 * 0.7 + 0.6 * 0.3, 10);
  });

  // --- NaN passthrough bug ---

  it('returns 0 (not NaN) when rolling360 is NaN and lifetime is null', () => {
    const result = blendAccuracy(NaN, null);
    expect(result).toBe(0);
    expect(isFinite(result)).toBe(true);
  });

  it('returns 0 (not NaN) when lifetime is NaN and rolling360 is null', () => {
    const result = blendAccuracy(null, NaN);
    expect(result).toBe(0);
    expect(isFinite(result)).toBe(true);
  });

  it('returns 0 (not Infinity) when rolling360 is Infinity and lifetime is null', () => {
    const result = blendAccuracy(Infinity, null);
    expect(result).toBe(0);
    expect(isFinite(result)).toBe(true);
  });

  it('returns 0 when both values are NaN', () => {
    const result = blendAccuracy(NaN, NaN);
    expect(result).toBe(0);
    expect(isFinite(result)).toBe(true);
  });

  it('handles 0 as a valid accuracy (not confused with null)', () => {
    // 0% accuracy is a legitimate value, not a missing value
    expect(blendAccuracy(0, null)).toBe(0);
    expect(blendAccuracy(null, 0)).toBe(0);
    expect(blendAccuracy(0, 0)).toBe(0);
  });
});
