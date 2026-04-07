/**
 * Wellness Engine — Burnout Prevention & Diminishing Returns Detection
 *
 * Research:
 * - >50% of medical students experience burnout (PMC, 2024)
 * - Pass-fail grading is the only curricular intervention with evidence
 *   of reducing burnout in medical education
 * - Technology should make self-care the path of least resistance,
 *   not lecture students about wellness
 *
 * Philosophy: Frame rest as STRATEGY, not weakness. The system never says
 * "you should take a break" — it says "your retention will be better if
 * you come back tomorrow."
 *
 * @module lib/services/wellnessEngine
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type WellnessState = 'thriving' | 'steady' | 'fatigued' | 'burnout_risk';

export interface SessionAttempt {
  wasCorrect: boolean;
  responseTimeMs: number;
  timestamp: Date;
  implicitConfidence?: number;
}

export interface SessionWellnessCheck {
  /** Whether the system recommends stopping */
  shouldStop: boolean;
  /** Why the system is recommending a stop */
  reason: StopReason | null;
  /** Current session stats for the student to see */
  stats: SessionStats;
  /** Message to show (always framed as strategy, not health advice) */
  message: string;
}

export type StopReason =
  | 'accuracy_declining'
  | 'response_time_increasing'
  | 'session_too_long'
  | 'daily_limit_reached'
  | 'optimal_session_complete';

/**
 * Early-warning fatigue level, surfaced BEFORE the hard shouldStop trigger.
 * - 'fresh' — No signs of decline
 * - 'warming' — Mild signal: RT trending up OR slight accuracy dip in last 5
 * - 'break_suggested' — Moderate signal: break would help retention
 */
export type FatigueLevel = 'fresh' | 'warming' | 'break_suggested';

export interface ProactiveFatigueCheck {
  /** Graduated fatigue level — acts before shouldStop fires */
  fatigueLevel: FatigueLevel;
  /** Rolling 5-question accuracy (NaN if < 5 questions) */
  recentAccuracy: number;
  /** Rolling 5-question RT slope (ms/question; positive = slowing) */
  recentRtSlope: number;
  /** Strategy-framed nudge message (null if fresh) */
  nudgeMessage: string | null;
  /** Recommended break duration in minutes */
  suggestedBreakMinutes: number;
}

export interface SessionStats {
  questionsAnswered: number;
  accuracy: number;
  accuracyDrop: number; // Difference between first-half and second-half accuracy
  avgResponseTimeMs: number;
  timeIncreaseRatio: number; // How much slower the second half is vs first half
  sessionDurationMinutes: number;
}

export interface DailyWellnessReport {
  state: WellnessState;
  sessionsToday: number;
  questionsToday: number;
  totalStudyMinutes: number;
  averageAccuracy: number;
  trend: 'improving' | 'stable' | 'declining';
  message: string;
  recommendation: string;
}

export interface QualityGoal {
  /** Points earned so far today */
  earnedPoints: number;
  /** Target for the day */
  targetPoints: number;
  /** Whether the goal is met */
  isComplete: boolean;
  /** Human-readable progress */
  progressMessage: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Accuracy drop threshold (first half vs second half) to suggest stopping */
const ACCURACY_DROP_THRESHOLD = 0.12;

/** Response time increase ratio to suggest stopping */
const TIME_INCREASE_THRESHOLD = 0.30;

/** Maximum continuous session duration before suggesting a break (minutes) */
const MAX_SESSION_MINUTES = 90;

/** Maximum productive sessions per day */
const MAX_DAILY_SESSIONS = 4;

/** Maximum productive questions per day */
const MAX_DAILY_QUESTIONS = 150;

/** Quality points per question type */
const POINTS = {
  hard_correct_confident: 5,
  hard_correct_not_confident: 4,
  medium_correct_confident: 3,
  medium_correct_not_confident: 2,
  easy_correct: 1,
  incorrect_confident: -2, // Misconception penalty
  incorrect_not_confident: 0, // Acknowledged gap — no penalty
};

/** Default daily point target */
const DEFAULT_DAILY_TARGET = 50;

// ─── Diminishing Returns Detection ───────────────────────────────────────────

/**
 * Check if the student is hitting diminishing returns within their current session.
 *
 * Compares first-half vs second-half performance to detect fatigue patterns:
 *   - Accuracy declining
 *   - Response time increasing
 *   - Both together = strong signal to stop
 *
 * Returns a recommendation framed as strategy, not health advice.
 */
export function detectDiminishingReturns(
  attempts: SessionAttempt[]
): SessionWellnessCheck {
  const stats = computeSessionStats(attempts);

  // Not enough data to assess
  if (attempts.length < 10) {
    return {
      shouldStop: false,
      reason: null,
      stats,
      message: `${stats.questionsAnswered} questions so far. Keep going!`,
    };
  }

  // Check session duration
  if (stats.sessionDurationMinutes > MAX_SESSION_MINUTES) {
    return {
      shouldStop: true,
      reason: 'session_too_long',
      stats,
      message: `You've been studying for ${Math.round(stats.sessionDurationMinutes)} minutes with ${pct(stats.accuracy)} accuracy — that's a strong session. Your retention will be better with a break.`,
    };
  }

  // Check for fatigue pattern: accuracy dropping + time increasing
  if (stats.accuracyDrop > ACCURACY_DROP_THRESHOLD && stats.timeIncreaseRatio > TIME_INCREASE_THRESHOLD) {
    return {
      shouldStop: true,
      reason: 'accuracy_declining',
      stats,
      message: `You've covered ${stats.questionsAnswered} questions with ${pct(stats.accuracy)} accuracy. Your pace is shifting — come back fresh for better retention.`,
    };
  }

  // Check for significant accuracy drop alone
  if (stats.accuracyDrop > ACCURACY_DROP_THRESHOLD * 1.5) {
    return {
      shouldStop: true,
      reason: 'accuracy_declining',
      stats,
      message: `${stats.questionsAnswered} questions done. Your accuracy shifted from the first half — a good stopping point. You'll retain more this way.`,
    };
  }

  // Check for significant time increase alone
  if (stats.timeIncreaseRatio > TIME_INCREASE_THRESHOLD * 1.5) {
    return {
      shouldStop: false, // Just a nudge, not a stop
      reason: null,
      stats,
      message: `${stats.questionsAnswered} questions at ${pct(stats.accuracy)} accuracy. You're taking a bit longer per question — that's normal as you go deeper.`,
    };
  }

  // All good
  return {
    shouldStop: false,
    reason: null,
    stats,
    message: `${stats.questionsAnswered} questions at ${pct(stats.accuracy)} accuracy. You're in a good rhythm.`,
  };
}

/**
 * Check if the student should stop for the day based on cumulative activity.
 */
export function checkDailyLimits(
  todaySessions: { questionsAnswered: number; accuracy: number; durationMinutes: number }[]
): { shouldStop: boolean; message: string } {
  const totalQuestions = todaySessions.reduce((s, sess) => s + sess.questionsAnswered, 0);
  const totalMinutes = todaySessions.reduce((s, sess) => s + sess.durationMinutes, 0);
  const sessionCount = todaySessions.length;

  // Track if performance is declining across sessions
  if (todaySessions.length >= 3) {
    const lastThree = todaySessions.slice(-3);
    const declining = lastThree[0]!.accuracy > lastThree[1]!.accuracy &&
                      lastThree[1]!.accuracy > lastThree[2]!.accuracy;
    if (declining) {
      return {
        shouldStop: true,
        message: `Your accuracy has been declining over the last 3 sessions (${lastThree.map(s => pct(s.accuracy)).join(' → ')}). Come back tomorrow — sleep consolidates what you've learned today.`,
      };
    }
  }

  if (totalQuestions >= MAX_DAILY_QUESTIONS) {
    return {
      shouldStop: true,
      message: `${totalQuestions} questions today — that's serious work. Diminishing returns set in after this volume. Rest is part of the strategy.`,
    };
  }

  if (sessionCount >= MAX_DAILY_SESSIONS) {
    return {
      shouldStop: true,
      message: `${sessionCount} sessions today. Research shows diminishing returns beyond this point. Your brain needs consolidation time.`,
    };
  }

  return { shouldStop: false, message: '' };
}

// ─── Quality-Weighted Goals ──────────────────────────────────────────────────

/**
 * Calculate quality-weighted mastery points for a set of attempts.
 *
 * Points = f(difficulty, correctness, confidence)
 * This prevents spamming easy questions to hit a raw count target.
 */
export function calculateQualityPoints(
  attempts: {
    wasCorrect: boolean;
    difficulty: string | null;
    confidence: number;
  }[]
): QualityGoal {
  let earned = 0;

  for (const a of attempts) {
    const isConfident = a.confidence >= 0.6;
    const diff = (a.difficulty ?? 'medium').toLowerCase();

    if (a.wasCorrect) {
      if (diff === 'hard') {
        earned += isConfident ? POINTS.hard_correct_confident : POINTS.hard_correct_not_confident;
      } else if (diff === 'medium') {
        earned += isConfident ? POINTS.medium_correct_confident : POINTS.medium_correct_not_confident;
      } else {
        earned += POINTS.easy_correct;
      }
    } else {
      earned += isConfident ? POINTS.incorrect_confident : POINTS.incorrect_not_confident;
    }
  }

  const isComplete = earned >= DEFAULT_DAILY_TARGET;

  let progressMessage: string;
  if (isComplete) {
    progressMessage = `Goal reached! ${earned} mastery points today. Additional study has diminishing returns.`;
  } else if (earned > 0) {
    progressMessage = `${earned} / ${DEFAULT_DAILY_TARGET} mastery points. ${DEFAULT_DAILY_TARGET - earned} to go.`;
  } else {
    progressMessage = `Start studying to earn mastery points. Target: ${DEFAULT_DAILY_TARGET} today.`;
  }

  return {
    earnedPoints: Math.max(0, earned),
    targetPoints: DEFAULT_DAILY_TARGET,
    isComplete,
    progressMessage,
  };
}

// ─── Daily Wellness Assessment ───────────────────────────────────────────────

/**
 * Assess the student's daily wellness state based on their study patterns.
 */
export function assessDailyWellness(
  recentDays: {
    date: string;
    questionsAnswered: number;
    accuracy: number;
    studyMinutes: number;
    sessionsCount: number;
  }[]
): DailyWellnessReport {
  if (recentDays.length === 0) {
    return {
      state: 'steady',
      sessionsToday: 0,
      questionsToday: 0,
      totalStudyMinutes: 0,
      averageAccuracy: 0,
      trend: 'stable',
      message: 'Welcome back! Ready to get started?',
      recommendation: 'Start with a focused 20-question session.',
    };
  }

  const today = recentDays[recentDays.length - 1]!; // Safe: length >= 3 (guarded above)
  const last7 = recentDays.slice(-7);

  // Detect trend
  const trend = detectTrend(last7.map(d => d.accuracy));

  // Detect overwork
  const avgDailyMinutes = last7.reduce((s, d) => s + d.studyMinutes, 0) / last7.length;
  const todayOverAvg = today.studyMinutes > avgDailyMinutes * 1.5;
  const consecutiveHighDays = countConsecutiveHighDays(last7);

  let state: WellnessState;
  let message: string;
  let recommendation: string;

  if (consecutiveHighDays >= 5 && trend === 'declining') {
    state = 'burnout_risk';
    message = 'You\'ve been studying hard for 5+ days straight with declining returns. A rest day would actually help your retention.';
    recommendation = 'Take today off or do a light 10-question review.';
  } else if (todayOverAvg && today.accuracy < 0.75) {
    state = 'fatigued';
    message = `You've studied ${Math.round(today.studyMinutes)} minutes today — more than usual. Your accuracy suggests you'd benefit from stopping.`;
    recommendation = 'Call it a day. Sleep consolidates what you\'ve learned.';
  } else if (trend === 'improving' && today.accuracy >= 0.80) {
    state = 'thriving';
    message = `${pct(today.accuracy)} accuracy and improving. You're in a great rhythm.`;
    recommendation = 'Keep going — you\'re in the zone.';
  } else {
    state = 'steady';
    message = `Steady progress. ${today.questionsAnswered} questions at ${pct(today.accuracy)} today.`;
    recommendation = 'A balanced session would be great right now.';
  }

  return {
    state,
    sessionsToday: today.sessionsCount,
    questionsToday: today.questionsAnswered,
    totalStudyMinutes: today.studyMinutes,
    averageAccuracy: today.accuracy,
    trend,
    message,
    recommendation,
  };
}

// ─── Streak Freeze Logic ─────────────────────────────────────────────────────

export interface StreakState {
  currentStreak: number;
  freezesRemaining: number;
  freezeUsedToday: boolean;
  weekendModeEnabled: boolean;
}

/**
 * Calculate streak considering freezes and weekend mode.
 */
export function calculateStreakWithFreezes(
  dailyActivity: { date: string; questionsAnswered: number }[],
  freezesAvailable: number,
  weekendModeEnabled: boolean
): StreakState {
  if (dailyActivity.length === 0) {
    return { currentStreak: 0, freezesRemaining: freezesAvailable, freezeUsedToday: false, weekendModeEnabled };
  }

  let streak = 0;
  let freezesUsed = 0;
  let freezeUsedToday = false;
  const today = new Date();

  // Walk backwards from today
  for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - daysAgo);
    const dateKey = checkDate.toISOString().split('T')[0];
    const dayOfWeek = checkDate.getDay(); // 0=Sun, 6=Sat

    // Weekend mode: skip weekends
    if (weekendModeEnabled && (dayOfWeek === 0 || dayOfWeek === 6)) {
      continue; // Weekends don't count for or against the streak
    }

    const dayActivity = dailyActivity.find(d => d.date === dateKey);
    const studied = dayActivity && dayActivity.questionsAnswered > 0;

    if (studied) {
      streak++;
    } else if (freezesUsed < freezesAvailable) {
      // Use a freeze
      freezesUsed++;
      streak++; // Streak continues
      if (daysAgo === 0) freezeUsedToday = true;
    } else {
      break; // Streak broken
    }
  }

  return {
    currentStreak: streak,
    freezesRemaining: Math.max(0, freezesAvailable - freezesUsed),
    freezeUsedToday,
    weekendModeEnabled,
  };
}

// ─── Proactive Fatigue Detection ────────────────────────────────────────────

/** Minimum questions before early-warning kicks in */
const EARLY_WARNING_MIN_QUESTIONS = 8;

/** Rolling window size for recent performance trend */
const ROLLING_WINDOW = 5;

/** RT slope threshold (ms/question) for "warming" level */
const RT_SLOPE_WARMING = 500;

/** RT slope threshold (ms/question) for "break suggested" */
const RT_SLOPE_BREAK = 1200;

/** Rolling accuracy threshold for "break suggested" */
const ROLLING_ACCURACY_BREAK = 0.50;

/** Session minute thresholds for proactive nudges */
const PROACTIVE_BREAK_MINUTES = 45;

/**
 * Proactive fatigue check — runs a rolling-window analysis over recent
 * attempts to detect fatigue *before* the hard shouldStop threshold.
 *
 * Uses linear regression on the last ROLLING_WINDOW response times and
 * a rolling accuracy window. This catches gradual slow-downs and accuracy
 * erosion that the split-half `detectDiminishingReturns` misses early.
 *
 * Philosophy: same as wellnessEngine — frame as strategy, never lecture.
 */
export function detectProactiveFatigue(
  attempts: SessionAttempt[]
): ProactiveFatigueCheck {
  const FRESH: ProactiveFatigueCheck = {
    fatigueLevel: 'fresh',
    recentAccuracy: NaN,
    recentRtSlope: 0,
    nudgeMessage: null,
    suggestedBreakMinutes: 0,
  };

  if (attempts.length < EARLY_WARNING_MIN_QUESTIONS) return FRESH;

  // Rolling window stats
  const recent = attempts.slice(-ROLLING_WINDOW);
  const recentAccuracy = recent.filter(a => a.wasCorrect).length / recent.length;

  // Linear regression on RT within the rolling window
  const rts = recent.map(a => a.responseTimeMs);
  const recentRtSlope = linearSlope(rts);

  // Session duration
  const sessionMinutes = attempts.length > 1
    ? (attempts[attempts.length - 1]!.timestamp.getTime() - attempts[0]!.timestamp.getTime()) / 60000
    : 0;

  // Compare rolling accuracy to session-wide baseline
  const overallAccuracy = attempts.filter(a => a.wasCorrect).length / attempts.length;
  const accuracyDelta = overallAccuracy - recentAccuracy; // positive = recent is worse

  // --- Level detection ---

  // break_suggested: strong signals
  if (
    (recentRtSlope > RT_SLOPE_BREAK && accuracyDelta > 0.08) ||
    (recentAccuracy < ROLLING_ACCURACY_BREAK && attempts.length >= 15) ||
    (sessionMinutes > PROACTIVE_BREAK_MINUTES && recentRtSlope > RT_SLOPE_WARMING && accuracyDelta > 0.05)
  ) {
    return {
      fatigueLevel: 'break_suggested',
      recentAccuracy,
      recentRtSlope,
      nudgeMessage: sessionMinutes > PROACTIVE_BREAK_MINUTES
        ? `${Math.round(sessionMinutes)} minutes of focused study — a 5-minute break would help lock in what you've covered.`
        : `Your last ${ROLLING_WINDOW} questions are running ${pct(accuracyDelta)} below your session average. A quick break resets your focus.`,
      suggestedBreakMinutes: 5,
    };
  }

  // warming: mild signals
  if (
    recentRtSlope > RT_SLOPE_WARMING ||
    (accuracyDelta > 0.06 && attempts.length >= 12) ||
    sessionMinutes > PROACTIVE_BREAK_MINUTES
  ) {
    return {
      fatigueLevel: 'warming',
      recentAccuracy,
      recentRtSlope,
      nudgeMessage: null, // warming is silent — just tracked for UI hints
      suggestedBreakMinutes: 3,
    };
  }

  return { ...FRESH, recentAccuracy, recentRtSlope };
}

/**
 * Ordinary least-squares slope for an array of values.
 * Returns the change per index (e.g., ms per question).
 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSessionStats(attempts: SessionAttempt[]): SessionStats {
  if (attempts.length === 0) {
    return {
      questionsAnswered: 0,
      accuracy: 0,
      accuracyDrop: 0,
      avgResponseTimeMs: 0,
      timeIncreaseRatio: 0,
      sessionDurationMinutes: 0,
    };
  }

  const mid = Math.floor(attempts.length / 2);
  const firstHalf = attempts.slice(0, mid);
  const secondHalf = attempts.slice(mid);

  const firstAccuracy = firstHalf.length > 0
    ? firstHalf.filter(a => a.wasCorrect).length / firstHalf.length
    : 0;
  const secondAccuracy = secondHalf.length > 0
    ? secondHalf.filter(a => a.wasCorrect).length / secondHalf.length
    : 0;

  const firstAvgTime = avg(firstHalf.map(a => a.responseTimeMs));
  const secondAvgTime = avg(secondHalf.map(a => a.responseTimeMs));
  const timeIncrease = firstAvgTime > 0 ? (secondAvgTime - firstAvgTime) / firstAvgTime : 0;

  const totalMs = attempts.length > 1
    ? attempts[attempts.length - 1]!.timestamp.getTime() - attempts[0]!.timestamp.getTime()
    : 0;

  return {
    questionsAnswered: attempts.length,
    accuracy: attempts.filter(a => a.wasCorrect).length / attempts.length,
    accuracyDrop: Math.max(0, firstAccuracy - secondAccuracy),
    avgResponseTimeMs: avg(attempts.map(a => a.responseTimeMs)),
    timeIncreaseRatio: Math.max(0, timeIncrease),
    sessionDurationMinutes: totalMs / 60000,
  };
}

function detectTrend(values: number[]): 'improving' | 'stable' | 'declining' {
  if (values.length < 3) return 'stable';
  const recent = values.slice(-3);
  const diffs = [];
  for (let i = 1; i < recent.length; i++) {
    diffs.push(recent[i]! - recent[i - 1]!);
  }
  const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  if (avgDiff > 0.03) return 'improving';
  if (avgDiff < -0.03) return 'declining';
  return 'stable';
}

function countConsecutiveHighDays(
  days: { studyMinutes: number }[]
): number {
  let count = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i]!.studyMinutes > 60) count++;
    else break;
  }
  return count;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function pct(val: number): string {
  return `${Math.round(val * 100)}%`;
}
