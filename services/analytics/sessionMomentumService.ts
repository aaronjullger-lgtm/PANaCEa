/**
 * Session Momentum Service
 *
 * Tracks and visualizes session "momentum" - a composite metric that
 * captures the user's flow state based on:
 * - Streak continuity
 * - Answer speed consistency
 * - Accuracy trend
 *
 * High momentum = "in the zone" - fast, accurate, confident
 * Low momentum = struggling or fatigued
 */

export type MomentumLevel = 'rising' | 'peaked' | 'steady' | 'cooling' | 'cold';

export interface MomentumState {
  level: MomentumLevel;
  score: number; // 0-100
  streak: number;
  recentAccuracy: number; // % of last 5 questions
  speedTrend: 'faster' | 'consistent' | 'slower';
  recommendation: string | null;
}

interface QuestionResult {
  wasCorrect: boolean;
  timeSpentMs: number;
  parTimeMs: number;
  timestamp: number;
}

const STORAGE_KEY = 'panceai_session_momentum';

/**
 * Get momentum history from session
 */
function getSessionHistory(): QuestionResult[] {
  if (typeof window === 'undefined') return [];
  const stored = sessionStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Record a question result for momentum tracking
 */
export function recordMomentumResult(
  wasCorrect: boolean,
  timeSpentMs: number,
  parTimeMs: number
): void {
  const history = getSessionHistory();
  history.push({
    wasCorrect,
    timeSpentMs,
    parTimeMs,
    timestamp: Date.now(),
  });

  // Keep last 20 for analysis
  if (history.length > 20) {
    history.shift();
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/**
 * Calculate current momentum state
 */
export function calculateMomentum(): MomentumState {
  const history = getSessionHistory();

  if (history.length < 3) {
    return {
      level: 'steady',
      score: 50,
      streak: 0,
      recentAccuracy: 0,
      speedTrend: 'consistent',
      recommendation: null,
    };
  }

  // Calculate current streak
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]!.wasCorrect) {
      streak++;
    } else {
      break;
    }
  }

  // Recent accuracy (last 5)
  const recent = history.slice(-5);
  const recentCorrect = recent.filter((r) => r.wasCorrect).length;
  const recentAccuracy = Math.round((recentCorrect / recent.length) * 100);

  // Speed trend (comparing recent 3 to previous 3)
  let speedTrend: 'faster' | 'consistent' | 'slower' = 'consistent';
  if (history.length >= 6) {
    const recentThree = history.slice(-3);
    const previousThree = history.slice(-6, -3);

    const recentAvgRatio = recentThree.reduce((sum, r) => sum + r.timeSpentMs / r.parTimeMs, 0) / 3;
    const previousAvgRatio =
      previousThree.reduce((sum, r) => sum + r.timeSpentMs / r.parTimeMs, 0) / 3;

    if (recentAvgRatio < previousAvgRatio * 0.85) {
      speedTrend = 'faster';
    } else if (recentAvgRatio > previousAvgRatio * 1.15) {
      speedTrend = 'slower';
    }
  }

  // Calculate composite momentum score
  let score = 50;

  // Streak bonus (up to +25)
  score += Math.min(streak * 5, 25);

  // Accuracy bonus (up to +25)
  score += (recentAccuracy - 50) / 2;

  // Speed adjustment
  if (speedTrend === 'faster') score += 10;
  if (speedTrend === 'slower') score -= 10;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Determine level
  let level: MomentumLevel;
  if (score >= 80) {
    level = 'peaked';
  } else if (score >= 65) {
    level = 'rising';
  } else if (score >= 40) {
    level = 'steady';
  } else if (score >= 20) {
    level = 'cooling';
  } else {
    level = 'cold';
  }

  // Generate recommendation
  let recommendation: string | null = null;

  if (level === 'peaked' && streak >= 5) {
    recommendation = "You're in the zone! Keep this momentum going.";
  } else if (level === 'cooling' && speedTrend === 'slower') {
    recommendation = 'Take a short break? You seem to be slowing down.';
  } else if (level === 'cold' && recentAccuracy < 40) {
    recommendation = 'Consider reviewing your weak areas or taking a break.';
  } else if (streak >= 3 && level === 'rising') {
    recommendation = 'Nice streak! Your confidence is building.';
  }

  return {
    level,
    score: Math.round(score),
    streak,
    recentAccuracy,
    speedTrend,
    recommendation,
  };
}

/**
 * Detect if user might be fatigued based on patterns
 */
export function detectFatigueSignals(): {
  isFatigued: boolean;
  signals: string[];
} {
  const history = getSessionHistory();
  const signals: string[] = [];

  if (history.length < 10) {
    return { isFatigued: false, signals: [] };
  }

  const recent5 = history.slice(-5);
  const previous5 = history.slice(-10, -5);

  // Check for slowing down
  const recentAvgTime = recent5.reduce((s, r) => s + r.timeSpentMs, 0) / 5;
  const previousAvgTime = previous5.reduce((s, r) => s + r.timeSpentMs, 0) / 5;

  if (recentAvgTime > previousAvgTime * 1.3) {
    signals.push('Response time increasing');
  }

  // Check for declining accuracy
  const recentCorrect = recent5.filter((r) => r.wasCorrect).length;
  const previousCorrect = previous5.filter((r) => r.wasCorrect).length;

  if (recentCorrect < previousCorrect && previousCorrect >= 4) {
    signals.push('Accuracy declining');
  }

  // Check for very long pauses (> 3x par time)
  const verySlowRecent = recent5.filter((r) => r.timeSpentMs > r.parTimeMs * 3).length;
  if (verySlowRecent >= 2) {
    signals.push('Multiple extended pauses');
  }

  return {
    isFatigued: signals.length >= 2,
    signals,
  };
}

/**
 * Reset momentum tracking
 */
export function resetMomentum(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Get momentum insights for session analytics sync
 */
export function getMomentumInsights(): {
  currentLevel: MomentumLevel;
  peakMomentum: number;
  avgMomentum: number;
  momentumHistory: number[];
} | null {
  const history = getSessionHistory();

  if (history.length < 3) return null;

  // Recalculate momentum at each point to find peak and average
  const momentumHistory: number[] = [];
  let peakMomentum = 0;

  for (let i = 3; i <= history.length; i++) {
    const subHistory = history.slice(0, i);

    // Calculate streak at this point
    let streak = 0;
    for (let j = subHistory.length - 1; j >= 0; j--) {
      if (subHistory[j]!.wasCorrect) streak++;
      else break;
    }

    // Recent accuracy at this point
    const recent = subHistory.slice(-5);
    const recentCorrect = recent.filter((r) => r.wasCorrect).length;
    const recentAccuracy = (recentCorrect / recent.length) * 100;

    // Calculate score
    let score = 50;
    score += Math.min(streak * 5, 25);
    score += (recentAccuracy - 50) / 2;
    score = Math.max(0, Math.min(100, score));

    momentumHistory.push(score);
    peakMomentum = Math.max(peakMomentum, score);
  }

  const avgMomentum =
    momentumHistory.length > 0
      ? momentumHistory.reduce((sum, m) => sum + m, 0) / momentumHistory.length
      : 50;

  const currentState = calculateMomentum();

  return {
    currentLevel: currentState.level,
    peakMomentum,
    avgMomentum,
    momentumHistory,
  };
}
