/**
 * derivedMetrics.ts — Comprehensive unit tests
 *
 * Tests the single source of truth for all dashboard analytics:
 * - formatStudyTime: ms → human-readable string
 * - blendAccuracy: weighted rolling360/lifetime merge
 * - determineTrend: performance delta classification
 * - capOutliers: 90th-percentile capping
 * - deriveAccuracy: accuracy harmonization from two sources
 * - deriveQuestionCounts: count reconciliation
 * - deriveStudyTime: time standardization with NaN guards
 * - deriveRecentActivity: session mapping + streak + trend
 */

import { describe, it, expect } from 'vitest';
import {
  formatStudyTime,
  blendAccuracy,
  determineTrend,
  capOutliers,
  deriveAccuracy,
  deriveQuestionCounts,
  deriveStudyTime,
  deriveRecentActivity,
  getSystemDisplayName,
  type RecentSessionInput,
} from '../lib/dashboard/derivedMetrics';
import type { Rolling360Stats } from '../hooks/useRolling360Stats';
import type { DatabaseStats } from '../hooks/useDatabaseStats';

// ============================================================================
// Helpers
// ============================================================================

/** Minimal DatabaseStats factory */
function makeDatabase(overrides: Partial<DatabaseStats['overall']> = {}, extra: Partial<DatabaseStats> = {}): DatabaseStats {
  return {
    overall: {
      totalAttempts: 200,
      correctAttempts: 150,
      accuracy: 75,
      questionsSeenCount: 180,
      currentStreak: 5,
      totalStudyDays: 30,
      avgTimeMs: 45000,
      avgAnswerChanges: 0.2,
      todayCount: 10,
      todayTimeMs: 600000,
      ...overrides,
    },
    bySystems: {},
    weakAreas: [],
    strongAreas: [],
    recentPerformance: {
      last7Days: { attempts: 50, accuracy: 78 },
      previous7Days: { attempts: 45, accuracy: 72 },
      trend: 'improving',
    },
    recommendations: [],
    ...extra,
  };
}

/** Minimal Rolling360Stats factory */
function makeRolling360(overrides: Partial<Rolling360Stats> = {}): Rolling360Stats {
  return {
    scoreConfidence: 'confident',
    totalInWindow: 300,
    correctInWindow: 240,
    accuracyPercent: 80,
    systemStats: {},
    predictedScore: 72,
    passLikelihood: 0.85,
    blueprintAdherence: 0.9,
    isValidExamDistribution: true,
    weakestSystems: [],
    strongestSystems: [],
    windowStartTime: null,
    windowEndTime: null,
    questionsNeeded: 60,
    message: '',
    ...overrides,
  };
}

/** Create a session N days ago */
function sessionDaysAgo(n: number, overrides: Partial<RecentSessionInput> = {}): RecentSessionInput {
  return {
    date: new Date(Date.now() - n * 86400000).toISOString().slice(0, 10),
    durationMinutes: 30,
    questionsCompleted: 20,
    accuracy: 0.75,
    hour: 14,
    ...overrides,
  };
}

// ============================================================================
// formatStudyTime
// ============================================================================

describe('formatStudyTime', () => {
  it('returns "0s" for sub-second values', () => {
    expect(formatStudyTime(0)).toBe('0s');
    expect(formatStudyTime(500)).toBe('0s');
    expect(formatStudyTime(999)).toBe('0s');
  });

  it('formats seconds', () => {
    expect(formatStudyTime(1000)).toBe('1s');
    expect(formatStudyTime(45000)).toBe('45s');
    expect(formatStudyTime(59000)).toBe('59s');
  });

  it('formats minutes', () => {
    expect(formatStudyTime(60_000)).toBe('1m');
    expect(formatStudyTime(90_000)).toBe('1m');
    expect(formatStudyTime(3_540_000)).toBe('59m');
  });

  it('formats hours', () => {
    expect(formatStudyTime(3_600_000)).toBe('1h');
    expect(formatStudyTime(7_200_000)).toBe('2h');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatStudyTime(5_400_000)).toBe('1h 30m');
    expect(formatStudyTime(9_000_000)).toBe('2h 30m');
  });
});

// ============================================================================
// blendAccuracy
// ============================================================================

describe('blendAccuracy', () => {
  it('blends with 0.7 rolling / 0.3 lifetime weights', () => {
    // 0.8 * 0.7 + 0.6 * 0.3 = 0.56 + 0.18 = 0.74
    expect(blendAccuracy(0.8, 0.6)).toBeCloseTo(0.74);
  });

  it('returns lifetime when rolling360 is null', () => {
    expect(blendAccuracy(null, 0.65)).toBe(0.65);
  });

  it('returns rolling360 when lifetime is null', () => {
    expect(blendAccuracy(0.82, null)).toBe(0.82);
  });

  it('returns 0 when both are null', () => {
    expect(blendAccuracy(null, null)).toBe(0);
  });

  it('guards against NaN in single-source paths', () => {
    expect(blendAccuracy(null, NaN)).toBe(0);
    expect(blendAccuracy(Infinity, null)).toBe(0);
  });

  it('guards against NaN in blended result', () => {
    expect(blendAccuracy(NaN, NaN)).toBe(0);
  });
});

// ============================================================================
// determineTrend
// ============================================================================

describe('determineTrend', () => {
  it('returns improving when delta > 1%', () => {
    expect(determineTrend(0.80, 0.70)).toBe('improving');
  });

  it('returns declining when delta < -1%', () => {
    expect(determineTrend(0.60, 0.75)).toBe('declining');
  });

  it('returns stable when delta < 1%', () => {
    expect(determineTrend(0.75, 0.755)).toBe('stable');
    expect(determineTrend(0.75, 0.745)).toBe('stable');
  });

  it('returns insufficient_data when recent is null', () => {
    expect(determineTrend(null, 0.75)).toBe('insufficient_data');
  });

  it('returns insufficient_data when previous is null', () => {
    expect(determineTrend(0.75, null)).toBe('insufficient_data');
  });

  it('returns insufficient_data when both null', () => {
    expect(determineTrend(null, null)).toBe('insufficient_data');
  });
});

// ============================================================================
// capOutliers
// ============================================================================

describe('capOutliers', () => {
  it('returns empty array for empty input', () => {
    expect(capOutliers([])).toEqual([]);
  });

  it('caps values above 90th percentile by default', () => {
    // 10 values: [10, 20, ..., 100]
    // 90th percentile index = floor(10 * 0.9) = 9 → value = 100
    // Actually sorted[9] = 100, so cap = 100 (no cap)
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const capped = capOutliers(values);
    expect(capped).toEqual(values); // 90th pct IS the max
  });

  it('caps extreme outliers', () => {
    // 10 values, one extreme: sorted[9]=500, sorted[8]=90
    // 90th pct index = 9 → cap = 500. Hmm, need more values.
    // 20 values: cap at index 18
    const values = Array.from({ length: 19 }, (_, i) => (i + 1) * 10); // 10..190
    values.push(10000); // outlier
    const capped = capOutliers(values);
    // sorted: [10,20,...,190,10000], index = floor(20*0.9) = 18 → sorted[18] = 190
    expect(capped[capped.length - 1]).toBeLessThanOrEqual(190);
  });

  it('handles single value', () => {
    expect(capOutliers([42])).toEqual([42]);
  });

  it('respects custom percentile', () => {
    const values = [10, 20, 30, 40, 50];
    const capped = capOutliers(values, 0.5);
    // 50th pct index = floor(5 * 0.5) = 2 → sorted[2] = 30
    expect(Math.max(...capped)).toBe(30);
  });
});

// ============================================================================
// deriveAccuracy
// ============================================================================

describe('deriveAccuracy', () => {
  it('blends rolling360 and database accuracy', () => {
    const rolling = makeRolling360({ accuracyPercent: 80 });
    const db = makeDatabase({ accuracy: 70 });
    const result = deriveAccuracy(rolling, db);
    // rolling360 = 80/100 = 0.8, lifetime = 70/100 = 0.7
    // blended = 0.8*0.7 + 0.7*0.3 = 0.56 + 0.21 = 0.77
    expect(result.global).toBeCloseTo(0.77);
    expect(result.rolling360).toBeCloseTo(0.8);
    expect(result.lifetime).toBeCloseTo(0.7);
  });

  it('uses only database when rolling360 is null', () => {
    const db = makeDatabase({ accuracy: 82 });
    const result = deriveAccuracy(null, db);
    expect(result.global).toBeCloseTo(0.82);
    expect(result.rolling360).toBeNull();
  });

  it('uses only rolling360 when database is null', () => {
    const rolling = makeRolling360({ accuracyPercent: 75 });
    const result = deriveAccuracy(rolling, null);
    expect(result.global).toBeCloseTo(0.75);
    expect(result.lifetime).toBeNull();
  });

  it('returns 0 global when both sources are null', () => {
    const result = deriveAccuracy(null, null);
    expect(result.global).toBe(0);
    expect(result.confidenceInterval).toBeNull();
  });

  it('provides confidence interval when global > 0', () => {
    const rolling = makeRolling360({ accuracyPercent: 80 });
    const result = deriveAccuracy(rolling, null);
    expect(result.confidenceInterval).not.toBeNull();
    expect(result.confidenceInterval![0]).toBeLessThan(result.global);
    expect(result.confidenceInterval![1]).toBeGreaterThan(result.global);
  });
});

// ============================================================================
// deriveQuestionCounts
// ============================================================================

describe('deriveQuestionCounts', () => {
  it('reconciles counts from both sources', () => {
    const rolling = makeRolling360({ totalInWindow: 300 });
    const db = makeDatabase({ questionsSeenCount: 500, totalAttempts: 800, todayCount: 15 });
    const result = deriveQuestionCounts(rolling, db, 25);
    expect(result.uniqueQuestions).toBe(500);
    expect(result.totalAttempts).toBe(800);
    expect(result.rollingWindowAttempts).toBe(300);
    expect(result.today).toBe(15);
    expect(result.dueForReview).toBe(25);
  });

  it('defaults to 0 when both sources null', () => {
    const result = deriveQuestionCounts(null, null);
    expect(result.uniqueQuestions).toBe(0);
    expect(result.totalAttempts).toBe(0);
    expect(result.rollingWindowAttempts).toBe(0);
    expect(result.today).toBe(0);
    expect(result.dueForReview).toBe(0);
  });
});

// ============================================================================
// deriveStudyTime
// ============================================================================

describe('deriveStudyTime', () => {
  it('computes total, average, and today from database stats', () => {
    const db = makeDatabase({ avgTimeMs: 45000, totalAttempts: 200, todayTimeMs: 600000 });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(45000 * 200);
    expect(result.avgPerQuestionMs).toBe(45000);
    expect(result.todayMs).toBe(600000);
  });

  it('returns zeroed values when database is null', () => {
    const result = deriveStudyTime(null);
    expect(result.totalMs).toBe(0);
    expect(result.avgPerQuestionMs).toBeNull();
    expect(result.todayMs).toBe(0);
  });

  it('formats display strings', () => {
    const db = makeDatabase({ avgTimeMs: 45000, totalAttempts: 200, todayTimeMs: 600000 });
    const result = deriveStudyTime(db);
    expect(result.display.total).toBeTruthy();
    expect(result.display.avgPerQuestion).toBe('45s');
    expect(result.display.today).toBe('10m');
  });

  it('guards against NaN avgTimeMs', () => {
    const db = makeDatabase({ avgTimeMs: NaN, totalAttempts: 100 });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
    expect(result.avgPerQuestionMs).toBeNull();
  });

  it('guards against null avgTimeMs', () => {
    const db = makeDatabase({ avgTimeMs: null, totalAttempts: 100 });
    const result = deriveStudyTime(db);
    expect(result.totalMs).toBe(0);
    expect(result.avgPerQuestionMs).toBeNull();
  });

  it('shows dash for avg display when no data', () => {
    const result = deriveStudyTime(null);
    expect(result.display.avgPerQuestion).toBe('—');
  });
});

// ============================================================================
// deriveRecentActivity
// ============================================================================

describe('deriveRecentActivity', () => {
  it('returns streak and trend from database', () => {
    const db = makeDatabase({ currentStreak: 7 }, {
      recentPerformance: {
        last7Days: { attempts: 50, accuracy: 80 },
        previous7Days: { attempts: 40, accuracy: 70 },
        trend: 'improving',
      },
    });
    const result = deriveRecentActivity(db);
    expect(result.streakDays).toBe(7);
    expect(result.performanceTrend).toBe('improving');
  });

  it('defaults to 0 streak and insufficient_data when database is null', () => {
    const result = deriveRecentActivity(null);
    expect(result.streakDays).toBe(0);
    expect(result.performanceTrend).toBe('insufficient_data');
    expect(result.sessions).toEqual([]);
  });

  it('maps real session data into UnifiedStats shape', () => {
    const sessions = [
      sessionDaysAgo(0, { durationMinutes: 45, questionsCompleted: 30, accuracy: 0.85 }),
      sessionDaysAgo(1, { durationMinutes: 30, questionsCompleted: 20, accuracy: 0.70 }),
    ];
    const result = deriveRecentActivity(null, sessions);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]!.questions).toBe(30);
    expect(result.sessions[0]!.accuracy).toBeCloseTo(0.85);
    expect(result.sessions[0]!.durationMs).toBe(45 * 60_000);
  });

  it('filters sessions to last 7 days only', () => {
    const sessions = [
      sessionDaysAgo(0),
      sessionDaysAgo(3),
      sessionDaysAgo(6),
      sessionDaysAgo(8),  // outside 7-day window
      sessionDaysAgo(14), // outside 7-day window
    ];
    const result = deriveRecentActivity(null, sessions);
    expect(result.sessions).toHaveLength(3);
  });

  it('sets accuracy to null for sessions with 0 accuracy', () => {
    const sessions = [sessionDaysAgo(0, { accuracy: 0 })];
    const result = deriveRecentActivity(null, sessions);
    expect(result.sessions[0]!.accuracy).toBeNull();
  });

  it('generates unique IDs for sessions', () => {
    const sessions = [
      sessionDaysAgo(0),
      sessionDaysAgo(0),  // same day, different session
    ];
    const result = deriveRecentActivity(null, sessions);
    expect(result.sessions[0]!.id).not.toBe(result.sessions[1]!.id);
  });

  it('returns empty sessions when no rawSessions provided', () => {
    const db = makeDatabase({ currentStreak: 3 });
    const result = deriveRecentActivity(db);
    expect(result.sessions).toEqual([]);
    expect(result.streakDays).toBe(3);
  });
});

// ============================================================================
// getSystemDisplayName
// ============================================================================

describe('getSystemDisplayName', () => {
  it('returns the code itself for unknown systems', () => {
    expect(getSystemDisplayName('UNKNOWN_SYS')).toBe('UNKNOWN_SYS');
  });
});
