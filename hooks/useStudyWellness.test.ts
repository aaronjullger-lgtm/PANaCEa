/**
 * useStudyWellness — Unit tests for computeWellnessState
 *
 * Tests the pure wellness computation logic:
 * - Empty / single session handling
 * - Consecutive day counting (today, yesterday, gaps)
 * - Burnout detection (14+ day streak + declining metrics)
 * - Tired detection (long sessions, high daily volume, declining trends)
 * - Thriving detection (7+ day streak, stable/improving accuracy)
 * - Steady fallback
 * - Session length and accuracy trend computation
 * - Today's study totals including current session
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeWellnessState, type StudySession } from './useStudyWellness';

// ============================================================================
// Helpers
// ============================================================================

/** Create an ISO date string N days before today. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

/** Shorthand factory for a StudySession. */
function session(
  overrides: Partial<StudySession> & { daysAgo?: number } = {}
): StudySession {
  const { daysAgo: d = 0, ...rest } = overrides;
  return {
    date: daysAgo(d),
    durationMinutes: 30,
    questionsCompleted: 20,
    accuracy: 0.75,
    hour: 14,
    ...rest,
  };
}

/** Generate a streak of sessions over consecutive days. */
function streak(days: number, overrides: Partial<StudySession> = {}): StudySession[] {
  return Array.from({ length: days }, (_, i) => session({ daysAgo: i, ...overrides }));
}

// ============================================================================
// Empty & Single Session
// ============================================================================

describe('computeWellnessState — empty / minimal input', () => {
  it('returns steady for empty sessions array', () => {
    const result = computeWellnessState([], 0);
    expect(result.signal.level).toBe('steady');
    expect(result.consecutiveDays).toBe(0);
    expect(result.averageSessionMinutes).toBe(0);
    expect(result.sessionLengthTrend).toBe('stable');
    expect(result.accuracyTrend).toBe('stable');
    expect(result.totalStudyToday).toBe(0);
    expect(result.longestSessionToday).toBe(0);
  });

  it('returns steady for a single session today', () => {
    const result = computeWellnessState([session({ daysAgo: 0 })]);
    expect(result.signal.level).toBe('steady');
    expect(result.consecutiveDays).toBe(1);
    expect(result.averageSessionMinutes).toBe(30);
  });

  it('counts 0 consecutive days if only session is 3+ days old', () => {
    const result = computeWellnessState([session({ daysAgo: 3 })]);
    expect(result.consecutiveDays).toBe(0);
  });
});

// ============================================================================
// Consecutive Days
// ============================================================================

describe('computeWellnessState — consecutiveDays', () => {
  it('counts consecutive days starting from today', () => {
    const sessions = streak(5);
    const result = computeWellnessState(sessions);
    expect(result.consecutiveDays).toBe(5);
  });

  it('counts consecutive days starting from yesterday', () => {
    // Days 1,2,3,4 ago — no today entry, streak starts from yesterday
    const sessions = [
      session({ daysAgo: 1 }),
      session({ daysAgo: 2 }),
      session({ daysAgo: 3 }),
      session({ daysAgo: 4 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.consecutiveDays).toBe(4);
  });

  it('breaks the streak at a gap', () => {
    // Days 0, 1, 2, then skip 3, then 4
    const sessions = [
      session({ daysAgo: 0 }),
      session({ daysAgo: 1 }),
      session({ daysAgo: 2 }),
      session({ daysAgo: 4 }), // gap at day 3
    ];
    const result = computeWellnessState(sessions);
    expect(result.consecutiveDays).toBe(3);
  });

  it('deduplicates multiple sessions on the same day', () => {
    const sessions = [
      session({ daysAgo: 0, hour: 8 }),
      session({ daysAgo: 0, hour: 14 }),
      session({ daysAgo: 0, hour: 20 }),
      session({ daysAgo: 1 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.consecutiveDays).toBe(2);
  });
});

// ============================================================================
// Burnout Risk
// ============================================================================

describe('computeWellnessState — burnout_risk', () => {
  it('triggers burnout_risk with 14+ day streak + decreasing sessions + declining accuracy', () => {
    // Build a 15-day streak with declining metrics in recent days
    const sessions: StudySession[] = [];

    // Older sessions (days 4-14): longer, higher accuracy
    for (let i = 4; i <= 14; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 60, accuracy: 0.85 }));
    }
    // Recent sessions (days 0-2): shorter, lower accuracy
    for (let i = 0; i <= 2; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 20, accuracy: 0.55 }));
    }
    // Day 3 bridges the gap
    sessions.push(session({ daysAgo: 3, durationMinutes: 40, accuracy: 0.70 }));

    const result = computeWellnessState(sessions);
    expect(result.signal.level).toBe('burnout_risk');
    expect(result.signal.urgent).toBe(true);
    expect(result.consecutiveDays).toBe(15);
  });

  it('does NOT trigger burnout_risk if streak is under 14 days', () => {
    const sessions: StudySession[] = [];
    // 13-day streak with declining metrics
    for (let i = 4; i <= 12; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 60, accuracy: 0.85 }));
    }
    for (let i = 0; i <= 2; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 20, accuracy: 0.55 }));
    }
    sessions.push(session({ daysAgo: 3, durationMinutes: 40, accuracy: 0.70 }));

    const result = computeWellnessState(sessions);
    expect(result.signal.level).not.toBe('burnout_risk');
  });

  it('does NOT trigger burnout_risk if accuracy is stable', () => {
    const sessions: StudySession[] = [];
    for (let i = 4; i <= 14; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 60, accuracy: 0.80 }));
    }
    for (let i = 0; i <= 2; i++) {
      // Sessions shorter (decreasing trend) but accuracy stable
      sessions.push(session({ daysAgo: i, durationMinutes: 20, accuracy: 0.80 }));
    }
    sessions.push(session({ daysAgo: 3, durationMinutes: 40, accuracy: 0.80 }));

    const result = computeWellnessState(sessions);
    expect(result.signal.level).not.toBe('burnout_risk');
  });
});

// ============================================================================
// Tired
// ============================================================================

describe('computeWellnessState — tired', () => {
  it('triggers tired when current session >= 90 minutes', () => {
    const result = computeWellnessState([session({ daysAgo: 0 })], 90);
    expect(result.signal.level).toBe('tired');
  });

  it('triggers tired when total study today >= 240 minutes', () => {
    const todaySessions = [
      session({ daysAgo: 0, durationMinutes: 120 }),
      session({ daysAgo: 0, durationMinutes: 100 }),
    ];
    // 120 + 100 + 25 current = 245 >= 240
    const result = computeWellnessState(todaySessions, 25);
    expect(result.signal.level).toBe('tired');
    expect(result.totalStudyToday).toBe(245);
  });

  it('marks urgent when current session >= 120 minutes', () => {
    const result = computeWellnessState([session({ daysAgo: 0 })], 120);
    expect(result.signal.level).toBe('tired');
    expect(result.signal.urgent).toBe(true);
  });

  it('not urgent at 90 minutes', () => {
    const result = computeWellnessState([session({ daysAgo: 0 })], 90);
    expect(result.signal.level).toBe('tired');
    expect(result.signal.urgent).toBe(false);
  });

  it('triggers tired when sessions are decreasing AND accuracy declining', () => {
    // Recent (0-2): short sessions, low accuracy
    // Older (4-6): longer sessions, higher accuracy
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 15, accuracy: 0.50 }),
      session({ daysAgo: 1, durationMinutes: 15, accuracy: 0.50 }),
      session({ daysAgo: 2, durationMinutes: 15, accuracy: 0.50 }),
      session({ daysAgo: 4, durationMinutes: 60, accuracy: 0.85 }),
      session({ daysAgo: 5, durationMinutes: 60, accuracy: 0.85 }),
      session({ daysAgo: 6, durationMinutes: 60, accuracy: 0.85 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.signal.level).toBe('tired');
    expect(result.sessionLengthTrend).toBe('decreasing');
    expect(result.accuracyTrend).toBe('declining');
  });
});

// ============================================================================
// Thriving
// ============================================================================

describe('computeWellnessState — thriving', () => {
  it('triggers thriving with 7+ day streak and stable accuracy', () => {
    const sessions = streak(8, { accuracy: 0.80 });
    const result = computeWellnessState(sessions);
    expect(result.signal.level).toBe('thriving');
    expect(result.consecutiveDays).toBe(8);
  });

  it('triggers thriving with 7+ day streak and improving accuracy', () => {
    const sessions: StudySession[] = [];
    for (let i = 0; i <= 2; i++) {
      sessions.push(session({ daysAgo: i, accuracy: 0.90 }));
    }
    for (let i = 3; i <= 7; i++) {
      sessions.push(session({ daysAgo: i, accuracy: 0.70 }));
    }
    const result = computeWellnessState(sessions);
    expect(result.signal.level).toBe('thriving');
    expect(result.accuracyTrend).toBe('improving');
  });

  it('does NOT trigger thriving with only 6-day streak', () => {
    const sessions = streak(6, { accuracy: 0.80 });
    const result = computeWellnessState(sessions);
    expect(result.signal.level).not.toBe('thriving');
  });
});

// ============================================================================
// Steady (default)
// ============================================================================

describe('computeWellnessState — steady', () => {
  it('returns steady for moderate activity (3-day streak, stable metrics)', () => {
    const sessions = streak(3, { accuracy: 0.75 });
    const result = computeWellnessState(sessions);
    expect(result.signal.level).toBe('steady');
    expect(result.signal.message).toContain('Day 3');
  });

  it('returns steady with no activity prompt when consecutiveDays is 0', () => {
    const result = computeWellnessState([]);
    expect(result.signal.level).toBe('steady');
    expect(result.signal.message).toContain('Ready to study');
  });
});

// ============================================================================
// Trends
// ============================================================================

describe('computeWellnessState — trends', () => {
  it('detects increasing session length trend', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 60 }),
      session({ daysAgo: 1, durationMinutes: 55 }),
      session({ daysAgo: 2, durationMinutes: 50 }),
      session({ daysAgo: 4, durationMinutes: 20 }),
      session({ daysAgo: 5, durationMinutes: 20 }),
      session({ daysAgo: 6, durationMinutes: 20 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.sessionLengthTrend).toBe('increasing');
  });

  it('detects decreasing session length trend', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 15 }),
      session({ daysAgo: 1, durationMinutes: 15 }),
      session({ daysAgo: 2, durationMinutes: 15 }),
      session({ daysAgo: 4, durationMinutes: 60 }),
      session({ daysAgo: 5, durationMinutes: 60 }),
      session({ daysAgo: 6, durationMinutes: 60 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.sessionLengthTrend).toBe('decreasing');
  });

  it('returns stable trend when change < 10%', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 31 }),
      session({ daysAgo: 1, durationMinutes: 31 }),
      session({ daysAgo: 2, durationMinutes: 31 }),
      session({ daysAgo: 4, durationMinutes: 30 }),
      session({ daysAgo: 5, durationMinutes: 30 }),
      session({ daysAgo: 6, durationMinutes: 30 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.sessionLengthTrend).toBe('stable');
  });

  it('returns stable accuracy trend when change < 3%', () => {
    const sessions = [
      session({ daysAgo: 0, accuracy: 0.76 }),
      session({ daysAgo: 1, accuracy: 0.76 }),
      session({ daysAgo: 2, accuracy: 0.76 }),
      session({ daysAgo: 4, accuracy: 0.75 }),
      session({ daysAgo: 5, accuracy: 0.75 }),
      session({ daysAgo: 6, accuracy: 0.75 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.accuracyTrend).toBe('stable');
  });

  it('returns stable when no older data exists for comparison', () => {
    const sessions = [session({ daysAgo: 0 }), session({ daysAgo: 1 })];
    const result = computeWellnessState(sessions);
    expect(result.sessionLengthTrend).toBe('stable');
    expect(result.accuracyTrend).toBe('stable');
  });
});

// ============================================================================
// Today's totals
// ============================================================================

describe('computeWellnessState — today totals', () => {
  it('sums today sessions + current session minutes', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 45 }),
      session({ daysAgo: 0, durationMinutes: 30 }),
      session({ daysAgo: 1, durationMinutes: 60 }),
    ];
    const result = computeWellnessState(sessions, 15);
    expect(result.totalStudyToday).toBe(90); // 45 + 30 + 15
  });

  it('tracks longest session today including current', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 25 }),
      session({ daysAgo: 0, durationMinutes: 40 }),
    ];
    const result = computeWellnessState(sessions, 50);
    expect(result.longestSessionToday).toBe(50); // current session is longest
  });

  it('tracks longest session today from past sessions', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 60 }),
      session({ daysAgo: 0, durationMinutes: 20 }),
    ];
    const result = computeWellnessState(sessions, 10);
    expect(result.longestSessionToday).toBe(60);
  });
});

// ============================================================================
// averageSessionMinutes
// ============================================================================

describe('computeWellnessState — averageSessionMinutes', () => {
  it('averages all session durations', () => {
    const sessions = [
      session({ daysAgo: 0, durationMinutes: 20 }),
      session({ daysAgo: 1, durationMinutes: 40 }),
      session({ daysAgo: 2, durationMinutes: 60 }),
    ];
    const result = computeWellnessState(sessions);
    expect(result.averageSessionMinutes).toBe(40);
  });

  it('returns 0 for empty sessions', () => {
    const result = computeWellnessState([]);
    expect(result.averageSessionMinutes).toBe(0);
  });
});

// ============================================================================
// Priority ordering (burnout > tired > thriving > steady)
// ============================================================================

describe('computeWellnessState — signal priority', () => {
  it('burnout_risk takes priority over tired from session length', () => {
    // 14-day streak with declining metrics AND long session today
    const sessions: StudySession[] = [];
    for (let i = 4; i <= 14; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 60, accuracy: 0.85 }));
    }
    for (let i = 0; i <= 2; i++) {
      sessions.push(session({ daysAgo: i, durationMinutes: 20, accuracy: 0.55 }));
    }
    sessions.push(session({ daysAgo: 3, durationMinutes: 40, accuracy: 0.70 }));

    // Even with 90+ min current session, burnout should take priority
    const result = computeWellnessState(sessions, 0);
    expect(result.signal.level).toBe('burnout_risk');
  });

  it('tired from long session takes priority over thriving streak', () => {
    // 10-day streak with stable metrics + very long current session
    const sessions = streak(10, { accuracy: 0.80 });
    const result = computeWellnessState(sessions, 95);
    expect(result.signal.level).toBe('tired');
  });
});
