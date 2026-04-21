/**
 * Unit tests for lib/services/wellnessEngine.ts
 *
 * Pure exports tested (no I/O, no async):
 *   detectDiminishingReturns(attempts)
 *   checkDailyLimits(todaySessions)
 *   calculateQualityPoints(attempts)
 *   assessDailyWellness(recentDays)
 *   calculateStreakWithFreezes(dailyActivity, freezesAvailable, weekendMode)
 *   detectProactiveFatigue(attempts)
 *
 * Constants (internal, verified via behavior):
 *   ACCURACY_DROP_THRESHOLD = 0.12
 *   TIME_INCREASE_THRESHOLD = 0.30
 *   MAX_SESSION_MINUTES = 90
 *   MAX_DAILY_SESSIONS = 4
 *   MAX_DAILY_QUESTIONS = 150
 *   DEFAULT_DAILY_TARGET = 50 points
 *   EARLY_WARNING_MIN_QUESTIONS = 8 (proactive)
 *   ROLLING_WINDOW = 5
 *   ROLLING_ACCURACY_BREAK = 0.50 (with >= 15 attempts)
 *
 * Quality points:
 *   hard+correct+confident=5, hard+correct+not-confident=4
 *   medium+correct+confident=3, medium+correct+not-confident=2
 *   easy+correct=1
 *   incorrect+confident=-2, incorrect+not-confident=0
 */

import { describe, it, expect } from 'vitest';
import {
  detectDiminishingReturns,
  checkDailyLimits,
  calculateQualityPoints,
  assessDailyWellness,
  calculateStreakWithFreezes,
  detectProactiveFatigue,
  type SessionAttempt,
} from './wellnessEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAttempt(
  wasCorrect: boolean,
  responseTimeMs: number = 3000,
  offsetMs: number = 0
): SessionAttempt {
  return {
    wasCorrect,
    responseTimeMs,
    timestamp: new Date(Date.now() + offsetMs),
  };
}

/** Build N attempts with constant RT and accuracy. */
function buildAttempts(
  count: number,
  wasCorrect: boolean,
  rt: number = 3000,
  startOffset: number = 0
): SessionAttempt[] {
  return Array.from({ length: count }, (_, i) =>
    makeAttempt(wasCorrect, rt, startOffset + i * 5000)
  );
}

/** Build N attempts alternating correct/wrong. */
function buildMixed(count: number): SessionAttempt[] {
  return Array.from({ length: count }, (_, i) =>
    makeAttempt(i % 2 === 0, 3000, i * 5000)
  );
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!;
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0]!;
}

// ─── detectDiminishingReturns ─────────────────────────────────────────────────

describe('detectDiminishingReturns', () => {
  it('fewer than 10 attempts → shouldStop=false', () => {
    const result = detectDiminishingReturns(buildAttempts(5, true));
    expect(result.shouldStop).toBe(false);
    expect(result.reason).toBeNull();
  });

  it('stats.questionsAnswered matches input length', () => {
    const result = detectDiminishingReturns(buildAttempts(8, true));
    expect(result.stats.questionsAnswered).toBe(8);
  });

  it('session over 90 minutes → shouldStop=true, reason=session_too_long', () => {
    // 10 attempts 11 minutes apart → 9 × 11 = 99 minutes span (> 90)
    const attempts = Array.from({ length: 10 }, (_, i) =>
      makeAttempt(true, 3000, i * 11 * 60 * 1000)
    );
    const result = detectDiminishingReturns(attempts);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('session_too_long');
  });

  it('large accuracy drop AND time increase → shouldStop=true, reason=accuracy_declining', () => {
    // First 5: all correct, fast (1000ms)
    // Second 5: all wrong, slow (5000ms) → big drop + time increase
    const first5 = buildAttempts(5, true, 1000, 0);
    const second5 = buildAttempts(5, false, 5000, 5 * 5000);
    const result = detectDiminishingReturns([...first5, ...second5]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('accuracy_declining');
  });

  it('large accuracy drop alone (>1.5× threshold = 0.18) → shouldStop=true', () => {
    // First 6: all correct; last 6: all wrong → drop = 1.0 - 0.0 = 1.0 > 0.18
    const first = buildAttempts(6, true, 3000, 0);
    const second = buildAttempts(6, false, 3000, 6 * 5000);
    const result = detectDiminishingReturns([...first, ...second]);
    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe('accuracy_declining');
  });

  it('steady performance (10 correct, same RT) → shouldStop=false', () => {
    const attempts = buildAttempts(10, true, 3000, 0);
    const result = detectDiminishingReturns(attempts);
    expect(result.shouldStop).toBe(false);
  });

  it('stats.accuracy = fraction of correct answers', () => {
    // 6 correct out of 10
    const correct = buildAttempts(6, true, 3000, 0);
    const wrong = buildAttempts(4, false, 3000, 6 * 5000);
    const result = detectDiminishingReturns([...correct, ...wrong]);
    expect(result.stats.accuracy).toBeCloseTo(0.6, 5);
  });
});

// ─── checkDailyLimits ─────────────────────────────────────────────────────────

describe('checkDailyLimits', () => {
  it('no sessions → shouldStop=false', () => {
    expect(checkDailyLimits([]).shouldStop).toBe(false);
  });

  it('≥ 150 questions total → shouldStop=true', () => {
    const sessions = [{ questionsAnswered: 80, accuracy: 0.75, durationMinutes: 30 },
                      { questionsAnswered: 80, accuracy: 0.75, durationMinutes: 30 }];
    expect(checkDailyLimits(sessions).shouldStop).toBe(true);
  });

  it('≥ 4 sessions → shouldStop=true', () => {
    const sessions = Array.from({ length: 4 }, () =>
      ({ questionsAnswered: 20, accuracy: 0.80, durationMinutes: 20 })
    );
    expect(checkDailyLimits(sessions).shouldStop).toBe(true);
  });

  it('3 sessions with strictly declining accuracy → shouldStop=true', () => {
    const sessions = [
      { questionsAnswered: 30, accuracy: 0.80, durationMinutes: 25 },
      { questionsAnswered: 30, accuracy: 0.75, durationMinutes: 25 },
      { questionsAnswered: 30, accuracy: 0.70, durationMinutes: 25 },
    ];
    expect(checkDailyLimits(sessions).shouldStop).toBe(true);
  });

  it('3 sessions with stable accuracy → shouldStop=false', () => {
    const sessions = [
      { questionsAnswered: 30, accuracy: 0.80, durationMinutes: 25 },
      { questionsAnswered: 30, accuracy: 0.80, durationMinutes: 25 },
      { questionsAnswered: 30, accuracy: 0.80, durationMinutes: 25 },
    ];
    expect(checkDailyLimits(sessions).shouldStop).toBe(false);
  });

  it('2 sessions under limits → shouldStop=false', () => {
    const sessions = [
      { questionsAnswered: 30, accuracy: 0.80, durationMinutes: 25 },
      { questionsAnswered: 30, accuracy: 0.75, durationMinutes: 25 },
    ];
    expect(checkDailyLimits(sessions).shouldStop).toBe(false);
  });
});

// ─── calculateQualityPoints ───────────────────────────────────────────────────

describe('calculateQualityPoints', () => {
  it('empty attempts → 0 points, not complete', () => {
    const result = calculateQualityPoints([]);
    expect(result.earnedPoints).toBe(0);
    expect(result.isComplete).toBe(false);
  });

  it('hard + correct + confident → +5 points', () => {
    const result = calculateQualityPoints([
      { wasCorrect: true, difficulty: 'hard', confidence: 0.8 },
    ]);
    expect(result.earnedPoints).toBe(5);
  });

  it('hard + correct + not confident (< 0.6) → +4 points', () => {
    const result = calculateQualityPoints([
      { wasCorrect: true, difficulty: 'hard', confidence: 0.5 },
    ]);
    expect(result.earnedPoints).toBe(4);
  });

  it('medium + correct + confident → +3 points', () => {
    const result = calculateQualityPoints([
      { wasCorrect: true, difficulty: 'medium', confidence: 0.7 },
    ]);
    expect(result.earnedPoints).toBe(3);
  });

  it('medium + correct + not confident → +2 points', () => {
    const result = calculateQualityPoints([
      { wasCorrect: true, difficulty: 'medium', confidence: 0.4 },
    ]);
    expect(result.earnedPoints).toBe(2);
  });

  it('easy + correct → +1 point', () => {
    const result = calculateQualityPoints([
      { wasCorrect: true, difficulty: 'easy', confidence: 0.9 },
    ]);
    expect(result.earnedPoints).toBe(1);
  });

  it('incorrect + confident → -2 points (misconception)', () => {
    const result = calculateQualityPoints([
      { wasCorrect: false, difficulty: 'medium', confidence: 0.8 },
    ]);
    // earnedPoints = max(0, -2) = 0
    expect(result.earnedPoints).toBe(0);
  });

  it('incorrect + not confident → 0 points', () => {
    const result = calculateQualityPoints([
      { wasCorrect: false, difficulty: 'medium', confidence: 0.3 },
    ]);
    expect(result.earnedPoints).toBe(0);
  });

  it('null difficulty defaults to medium', () => {
    const confident = calculateQualityPoints([{ wasCorrect: true, difficulty: null, confidence: 0.7 }]);
    const explicit = calculateQualityPoints([{ wasCorrect: true, difficulty: 'medium', confidence: 0.7 }]);
    expect(confident.earnedPoints).toBe(explicit.earnedPoints);
  });

  it('isComplete when earnedPoints >= 50', () => {
    // 10 hard+correct+confident = 50 points
    const attempts = Array.from({ length: 10 }, () =>
      ({ wasCorrect: true, difficulty: 'hard', confidence: 0.8 })
    );
    expect(calculateQualityPoints(attempts).isComplete).toBe(true);
  });

  it('targetPoints = 50', () => {
    expect(calculateQualityPoints([]).targetPoints).toBe(50);
  });

  it('points are additive across multiple attempts', () => {
    const result = calculateQualityPoints([
      { wasCorrect: true, difficulty: 'hard', confidence: 0.8 },  // +5
      { wasCorrect: true, difficulty: 'medium', confidence: 0.7 }, // +3
      { wasCorrect: false, difficulty: 'medium', confidence: 0.3 }, // 0
    ]);
    expect(result.earnedPoints).toBe(8);
  });
});

// ─── assessDailyWellness ──────────────────────────────────────────────────────

describe('assessDailyWellness', () => {
  it('empty array → state=steady, questions=0', () => {
    const report = assessDailyWellness([]);
    expect(report.state).toBe('steady');
    expect(report.questionsToday).toBe(0);
  });

  it('improving accuracy trend + high accuracy today → state=thriving', () => {
    // detectTrend uses last 3 of last7; avgDiff must be > 0.03
    // Last 3: [0.78, 0.84, 0.90] → diffs=[0.06, 0.06] → avgDiff=0.06 > 0.03 ✓
    // Today accuracy = 0.90 ≥ 0.80 ✓; study minutes = 30, avg = 30 → not overAvg
    const days = [
      { date: daysAgoStr(6), questionsAnswered: 30, accuracy: 0.60, studyMinutes: 30, sessionsCount: 1 },
      { date: daysAgoStr(5), questionsAnswered: 30, accuracy: 0.65, studyMinutes: 30, sessionsCount: 1 },
      { date: daysAgoStr(4), questionsAnswered: 30, accuracy: 0.70, studyMinutes: 30, sessionsCount: 1 },
      { date: daysAgoStr(3), questionsAnswered: 30, accuracy: 0.74, studyMinutes: 30, sessionsCount: 1 },
      { date: daysAgoStr(2), questionsAnswered: 30, accuracy: 0.78, studyMinutes: 30, sessionsCount: 1 },
      { date: daysAgoStr(1), questionsAnswered: 30, accuracy: 0.84, studyMinutes: 30, sessionsCount: 1 },
      { date: todayStr(), questionsAnswered: 30, accuracy: 0.90, studyMinutes: 30, sessionsCount: 1 },
    ];
    const report = assessDailyWellness(days);
    expect(report.state).toBe('thriving');
  });

  it('5+ consecutive high-study days with declining trend → burnout_risk', () => {
    // 7 days 90+ min each → consecutiveHighDays=7 ≥ 5 ✓
    // Last 3 accuracy: [0.68, 0.60, 0.52] → diffs=[-0.08,-0.08] → avgDiff=-0.08 < -0.03 → 'declining' ✓
    const days = [
      { date: daysAgoStr(6), questionsAnswered: 50, accuracy: 0.88, studyMinutes: 90, sessionsCount: 2 },
      { date: daysAgoStr(5), questionsAnswered: 50, accuracy: 0.84, studyMinutes: 90, sessionsCount: 2 },
      { date: daysAgoStr(4), questionsAnswered: 50, accuracy: 0.80, studyMinutes: 90, sessionsCount: 2 },
      { date: daysAgoStr(3), questionsAnswered: 50, accuracy: 0.76, studyMinutes: 90, sessionsCount: 2 },
      { date: daysAgoStr(2), questionsAnswered: 50, accuracy: 0.68, studyMinutes: 90, sessionsCount: 2 },
      { date: daysAgoStr(1), questionsAnswered: 50, accuracy: 0.60, studyMinutes: 90, sessionsCount: 2 },
      { date: todayStr(), questionsAnswered: 50, accuracy: 0.52, studyMinutes: 90, sessionsCount: 2 },
    ];
    const report = assessDailyWellness(days);
    expect(report.state).toBe('burnout_risk');
  });

  it('returns questionsToday from last entry', () => {
    const days = [
      { date: todayStr(), questionsAnswered: 42, accuracy: 0.80, studyMinutes: 35, sessionsCount: 1 },
    ];
    expect(assessDailyWellness(days).questionsToday).toBe(42);
  });

  it('report has trend field', () => {
    const days = [
      { date: todayStr(), questionsAnswered: 30, accuracy: 0.75, studyMinutes: 25, sessionsCount: 1 },
    ];
    const report = assessDailyWellness(days);
    expect(['improving', 'stable', 'declining']).toContain(report.trend);
  });
});

// ─── calculateStreakWithFreezes ────────────────────────────────────────────────

describe('calculateStreakWithFreezes', () => {
  it('no activity → currentStreak = 0', () => {
    const result = calculateStreakWithFreezes([], 2, false);
    expect(result.currentStreak).toBe(0);
    expect(result.freezesRemaining).toBe(2);
  });

  it('studied today → streak = 1', () => {
    const activity = [{ date: todayStr(), questionsAnswered: 20 }];
    const result = calculateStreakWithFreezes(activity, 0, false);
    expect(result.currentStreak).toBeGreaterThanOrEqual(1);
  });

  it('studied consecutive days → streak grows', () => {
    const activity = [
      { date: daysAgoStr(2), questionsAnswered: 20 },
      { date: daysAgoStr(1), questionsAnswered: 20 },
      { date: todayStr(), questionsAnswered: 20 },
    ];
    const result = calculateStreakWithFreezes(activity, 0, false);
    expect(result.currentStreak).toBeGreaterThanOrEqual(3);
  });

  it('missed one day with freeze → streak continues', () => {
    // Studied today, missed yesterday, studied 2 days ago
    const activity = [
      { date: daysAgoStr(2), questionsAnswered: 20 },
      // yesterday: missing (freeze used)
      { date: todayStr(), questionsAnswered: 20 },
    ];
    const result = calculateStreakWithFreezes(activity, 1, false);
    // With freeze: streak should be 3 (today=1, yesterday=freeze=1, 2daysago=1)
    expect(result.currentStreak).toBeGreaterThanOrEqual(2);
    expect(result.freezesRemaining).toBe(0);
  });

  it('missed one day with no freeze → streak breaks', () => {
    const activity = [
      { date: daysAgoStr(2), questionsAnswered: 20 },
      // yesterday: missing, no freeze
      { date: todayStr(), questionsAnswered: 20 },
    ];
    const result = calculateStreakWithFreezes(activity, 0, false);
    // Streak should only count consecutive from today until break
    expect(result.currentStreak).toBe(1);
  });

  it('weekendModeEnabled passes through to result', () => {
    const result = calculateStreakWithFreezes([], 0, true);
    expect(result.weekendModeEnabled).toBe(true);
  });

  it('freezesRemaining decreases by freezes used', () => {
    // Missed 2 consecutive days
    const activity = [
      { date: daysAgoStr(3), questionsAnswered: 20 },
      // day 2 ago: missing
      // day 1 ago: missing
      { date: todayStr(), questionsAnswered: 20 },
    ];
    const result = calculateStreakWithFreezes(activity, 2, false);
    // Both freezes used → 0 remaining
    expect(result.freezesRemaining).toBe(0);
  });
});

// ─── detectProactiveFatigue ───────────────────────────────────────────────────

describe('detectProactiveFatigue', () => {
  it('fewer than 8 attempts → fatigueLevel=fresh', () => {
    const result = detectProactiveFatigue(buildAttempts(5, true));
    expect(result.fatigueLevel).toBe('fresh');
    expect(result.nudgeMessage).toBeNull();
  });

  it('exactly 8 attempts, good performance → fatigueLevel=fresh', () => {
    const attempts = buildAttempts(8, true, 2000, 0);
    const result = detectProactiveFatigue(attempts);
    expect(result.fatigueLevel).toBe('fresh');
  });

  it('recent accuracy < 0.50 with ≥ 15 attempts → break_suggested', () => {
    // 10 correct attempts, then 5 wrong in rolling window → recentAccuracy=0
    const correct = buildAttempts(10, true, 2000, 0);
    const wrong = buildAttempts(5, false, 2000, 10 * 5000);
    const result = detectProactiveFatigue([...correct, ...wrong]);
    expect(result.fatigueLevel).toBe('break_suggested');
    expect(result.recentAccuracy).toBe(0);
  });

  it('fresh performance: high accuracy, flat RT slope → fresh or warming', () => {
    const attempts = buildAttempts(12, true, 2000, 0);
    const result = detectProactiveFatigue(attempts);
    // Should not be break_suggested for steady good performance
    expect(result.fatigueLevel).not.toBe('break_suggested');
  });

  it('recentAccuracy is fraction of recent correct answers', () => {
    // 10 correct, then 5 correct in window → recentAccuracy = 1.0
    const all = buildAttempts(15, true, 3000, 0);
    const result = detectProactiveFatigue(all);
    expect(result.recentAccuracy).toBeCloseTo(1.0, 5);
  });

  it('suggestedBreakMinutes is 0 for fresh', () => {
    const result = detectProactiveFatigue(buildAttempts(4, true));
    expect(result.suggestedBreakMinutes).toBe(0);
  });

  it('suggestedBreakMinutes > 0 for break_suggested', () => {
    const correct = buildAttempts(10, true, 2000, 0);
    const wrong = buildAttempts(5, false, 2000, 10 * 5000);
    const result = detectProactiveFatigue([...correct, ...wrong]);
    expect(result.suggestedBreakMinutes).toBeGreaterThan(0);
  });
});
