import { describe, it, expect } from 'vitest';
import {
  formatStudyTime,
  blendAccuracy,
  determineTrend,
  capOutliers,
  deriveRecentActivity,
  deriveFocusAreas,
  type RecentSessionInput,
} from './derivedMetrics';

// ─── formatStudyTime ──────────────────────────────────────────────────────────

describe('formatStudyTime', () => {
  it('returns "0s" for 0ms', () => {
    expect(formatStudyTime(0)).toBe('0s');
  });

  it('returns "0s" for sub-second values', () => {
    expect(formatStudyTime(999)).toBe('0s');
  });

  it('returns seconds for <60s', () => {
    expect(formatStudyTime(30_000)).toBe('30s');
    expect(formatStudyTime(1_000)).toBe('1s');
    expect(formatStudyTime(59_000)).toBe('59s');
  });

  it('returns minutes for 1m to 59m', () => {
    expect(formatStudyTime(60_000)).toBe('1m');
    expect(formatStudyTime(5 * 60_000)).toBe('5m');
    expect(formatStudyTime(59 * 60_000)).toBe('59m');
  });

  it('returns whole hours when no remaining minutes', () => {
    expect(formatStudyTime(60 * 60_000)).toBe('1h');
    expect(formatStudyTime(2 * 60 * 60_000)).toBe('2h');
  });

  it('returns hours and minutes when remainder exists', () => {
    expect(formatStudyTime(90 * 60_000)).toBe('1h 30m');
    expect(formatStudyTime(2 * 60 * 60_000 + 15 * 60_000)).toBe('2h 15m');
  });

  it('floors seconds (does not round up)', () => {
    // 1999ms → 1s, not 2s
    expect(formatStudyTime(1999)).toBe('1s');
  });
});

// ─── blendAccuracy ────────────────────────────────────────────────────────────

describe('blendAccuracy', () => {
  it('returns 0 when both are null', () => {
    expect(blendAccuracy(null, null)).toBe(0);
  });

  it('returns lifetime value when rolling360 is null', () => {
    expect(blendAccuracy(null, 0.8)).toBe(0.8);
  });

  it('returns rolling360 value when lifetime is null', () => {
    expect(blendAccuracy(0.9, null)).toBe(0.9);
  });

  it('blends 70/30: rolling=0.8, lifetime=0.6 → 0.74', () => {
    const result = blendAccuracy(0.8, 0.6);
    expect(result).toBeCloseTo(0.74, 5);
  });

  it('blends 70/30: equal values → same value', () => {
    expect(blendAccuracy(0.75, 0.75)).toBeCloseTo(0.75, 10);
  });

  it('returns 0 if rolling360 is Infinity', () => {
    expect(blendAccuracy(Infinity, null)).toBe(0);
  });

  it('returns 0 if lifetime is Infinity', () => {
    expect(blendAccuracy(null, Infinity)).toBe(0);
  });

  it('returns 0 if blended result is NaN/Infinity', () => {
    expect(blendAccuracy(NaN, NaN)).toBe(0);
  });

  it('weights rolling360 more than lifetime', () => {
    // rolling=1.0, lifetime=0.0 → 0.7*1 + 0.3*0 = 0.7
    expect(blendAccuracy(1.0, 0.0)).toBeCloseTo(0.7, 10);
  });
});

// ─── determineTrend ───────────────────────────────────────────────────────────

describe('determineTrend', () => {
  it('returns insufficient_data when both are null', () => {
    expect(determineTrend(null, null)).toBe('insufficient_data');
  });

  it('returns insufficient_data when recent is null', () => {
    expect(determineTrend(null, 0.7)).toBe('insufficient_data');
  });

  it('returns insufficient_data when previous is null', () => {
    expect(determineTrend(0.8, null)).toBe('insufficient_data');
  });

  it('returns stable when delta < 0.01', () => {
    expect(determineTrend(0.75, 0.75)).toBe('stable');
    expect(determineTrend(0.75, 0.7401)).toBe('stable');
  });

  it('returns improving when recent > previous by >= 0.01', () => {
    expect(determineTrend(0.80, 0.70)).toBe('improving');
    expect(determineTrend(0.71, 0.70)).toBe('improving');
  });

  it('returns declining when recent < previous by >= 0.01', () => {
    expect(determineTrend(0.65, 0.75)).toBe('declining');
    expect(determineTrend(0.69, 0.70)).toBe('declining');
  });

  it('threshold is exclusive: delta=0.009 → stable', () => {
    expect(determineTrend(0.709, 0.700)).toBe('stable');
  });
});

// ─── capOutliers ──────────────────────────────────────────────────────────────

describe('capOutliers', () => {
  it('returns empty array for empty input', () => {
    expect(capOutliers([])).toHaveLength(0);
  });

  it('default p90 cap: caps values above 90th percentile', () => {
    // 10 values: 0,1,2,...9 → sorted; 90th percentile index = floor(10*0.9)=9 → value=9
    // All values ≤ 9 → no change
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const result = capOutliers(values);
    expect(result).toEqual(values);
  });

  it('caps a single outlier', () => {
    // [1,2,3,4,100]: sorted=[1,2,3,4,100]; p90 index=floor(5*0.9)=4→cap=100
    // Actually with p90 and 5 values: index=min(floor(5*0.9),4)=min(4,4)=4 → cap=100
    // All values ≤ 100, no capping
    // Use stricter percentile to demonstrate capping
    const values = [1, 2, 3, 4, 100];
    const result = capOutliers(values, 0.5);
    // p50 index=floor(5*0.5)=2 → cap=3
    expect(result.every(v => v <= 3)).toBe(true);
  });

  it('does not increase values below the cap', () => {
    const values = [5, 10, 15, 20, 25];
    const result = capOutliers(values, 0.8);
    // p80 index=floor(5*0.8)=4 → cap=25; values unchanged
    result.forEach((v, i) => expect(v).toBeLessThanOrEqual(values[i]! + 1));
  });

  it('preserves length of input array', () => {
    const values = [100, 200, 300, 400, 5000];
    expect(capOutliers(values)).toHaveLength(values.length);
  });

  it('single element array returns that element (unchanged)', () => {
    expect(capOutliers([42])).toEqual([42]);
  });

  it('all equal values are unchanged', () => {
    const values = [5, 5, 5, 5, 5];
    expect(capOutliers(values)).toEqual(values);
  });

  it('result values are always <= original values', () => {
    const values = [1, 3, 7, 50, 999];
    const result = capOutliers(values, 0.6);
    values.forEach((orig, i) => {
      expect(result[i]).toBeLessThanOrEqual(orig);
    });
  });
});

// ─── deriveRecentActivity ─────────────────────────────────────────────────────

// Minimal shape of DatabaseStats that deriveRecentActivity uses
type MinDbStats = {
  overall: { currentStreak: number; totalAttempts?: number; questionsSeenCount?: number; accuracy?: number; avgTimeMs?: number; todayCount?: number; todayTimeMs?: number };
  recentPerformance?: { trend?: string };
  bySystems?: Record<string, unknown>;
  recommendations?: string[];
};

describe('deriveRecentActivity', () => {
  function makeDb(streak = 5, trend?: string): MinDbStats {
    return {
      overall: { currentStreak: streak },
      recentPerformance: { trend },
    };
  }

  it('streakDays from database overall.currentStreak', () => {
    const result = deriveRecentActivity(makeDb(12) as never);
    expect(result.streakDays).toBe(12);
  });

  it('defaults streakDays to 0 when database is null', () => {
    const result = deriveRecentActivity(null);
    expect(result.streakDays).toBe(0);
  });

  it('performanceTrend from database recentPerformance', () => {
    const result = deriveRecentActivity(makeDb(1, 'improving') as never);
    expect(result.performanceTrend).toBe('improving');
  });

  it('defaults performanceTrend to insufficient_data when missing', () => {
    const result = deriveRecentActivity(makeDb(1) as never);
    expect(result.performanceTrend).toBe('insufficient_data');
  });

  it('sessions empty when no rawSessions provided', () => {
    const result = deriveRecentActivity(makeDb() as never);
    expect(result.sessions).toHaveLength(0);
  });

  it('filters sessions older than 7 days', () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const oldDateStr = oldDate.toISOString().slice(0, 10);
    const recentDate = new Date();
    const recentDateStr = recentDate.toISOString().slice(0, 10);
    const sessions: RecentSessionInput[] = [
      { date: oldDateStr, durationMinutes: 30, questionsCompleted: 20, accuracy: 0.8 },
      { date: recentDateStr, durationMinutes: 15, questionsCompleted: 10, accuracy: 0.9 },
    ];
    const result = deriveRecentActivity(makeDb() as never, sessions);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]!.date).toBe(recentDateStr);
  });

  it('session accuracy is null when input accuracy is 0', () => {
    const recentDateStr = new Date().toISOString().slice(0, 10);
    const sessions: RecentSessionInput[] = [
      { date: recentDateStr, durationMinutes: 10, questionsCompleted: 5, accuracy: 0 },
    ];
    const result = deriveRecentActivity(makeDb() as never, sessions);
    expect(result.sessions[0]!.accuracy).toBeNull();
  });

  it('session durationMs = durationMinutes * 60000', () => {
    const recentDateStr = new Date().toISOString().slice(0, 10);
    const sessions: RecentSessionInput[] = [
      { date: recentDateStr, durationMinutes: 30, questionsCompleted: 20, accuracy: 0.85 },
    ];
    const result = deriveRecentActivity(makeDb() as never, sessions);
    expect(result.sessions[0]!.durationMs).toBe(30 * 60_000);
  });
});

// ─── deriveFocusAreas ─────────────────────────────────────────────────────────

type MasteryEntry = { system: string; name: string; mastery: number; attempts: number; avgDecisionTimeSec: number | null; trend: string; isGrowthArea: boolean };

describe('deriveFocusAreas', () => {
  function makeEntry(system: string, mastery: number): MasteryEntry {
    return { system, name: system, mastery, attempts: 20, avgDecisionTimeSec: 30, trend: 'stable', isGrowthArea: mastery < 70 };
  }

  it('growthAreas: systems with mastery < 70', () => {
    const mastery = [makeEntry('Cardio', 60), makeEntry('Pulm', 75), makeEntry('Neuro', 50)];
    const result = deriveFocusAreas(mastery as never, null);
    expect(result.growthAreas).toContain('Cardio');
    expect(result.growthAreas).toContain('Neuro');
    expect(result.growthAreas).not.toContain('Pulm');
  });

  it('growthAreas capped at 3', () => {
    const mastery = [60, 50, 40, 30, 20].map((m, i) => makeEntry(`Sys${i}`, m));
    const result = deriveFocusAreas(mastery as never, null);
    expect(result.growthAreas).toHaveLength(3);
  });

  it('strongAreas: systems with mastery >= 85', () => {
    const mastery = [makeEntry('Expert', 90), makeEntry('Medium', 75), makeEntry('Weak', 55)];
    const result = deriveFocusAreas(mastery as never, null);
    expect(result.strongAreas).toContain('Expert');
    expect(result.strongAreas).not.toContain('Medium');
  });

  it('strongAreas capped at 3', () => {
    const mastery = [90, 88, 87, 86, 85].map((m, i) => makeEntry(`Strong${i}`, m));
    const result = deriveFocusAreas(mastery as never, null);
    expect(result.strongAreas).toHaveLength(3);
  });

  it('recommendations from database', () => {
    const db = { overall: { currentStreak: 0 }, recommendations: ['Study CV', 'Review GI'] };
    const result = deriveFocusAreas([] as never, db as never);
    expect(result.recommendations).toEqual(['Study CV', 'Review GI']);
  });

  it('recommendations empty when database is null', () => {
    const result = deriveFocusAreas([] as never, null);
    expect(result.recommendations).toEqual([]);
  });

  it('system exactly at 70% is not a growth area', () => {
    const mastery = [makeEntry('Exact70', 70)];
    const result = deriveFocusAreas(mastery as never, null);
    expect(result.growthAreas).not.toContain('Exact70');
  });

  it('system exactly at 85% is a strong area', () => {
    const mastery = [makeEntry('Exact85', 85)];
    const result = deriveFocusAreas(mastery as never, null);
    expect(result.strongAreas).toContain('Exact85');
  });
});
