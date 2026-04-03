/**
 * Session Accuracy Slope Service
 *
 * Complements sessionFatigueService (which adjusts par time and applies
 * position-based confidence dampening) by adjusting confidence when the
 * student's observed accuracy trajectory shows decline within a session.
 *
 * Uses an in-memory per-user-session rolling window. The drillReviewService
 * calls recordOutcome() for each review, then getConfidenceModifier() to
 * get the current session's accuracy-based confidence adjustment.
 *
 * Research: Sievertsen et al. (2016) — ~0.9% SD performance decline per hour.
 */

interface SessionWindow {
  outcomes: boolean[]; // recent outcomes (true = correct)
  userId: string;
  sessionStart: number; // timestamp
}

const WINDOW_SIZE = 10;
const DECLINE_THRESHOLD = -0.05; // slope below this → confidence penalty
const WARMUP_THRESHOLD = 0.05;   // slope above this → confidence bonus
const DECLINE_MULTIPLIER = 0.92;
const WARMUP_MULTIPLIER = 1.05;
const MIN_ITEMS_FOR_SLOPE = 6;   // need at least 6 items in window

// In-memory session cache (keyed by `${userId}_${sessionDate}`)
const sessionCache = new Map<string, SessionWindow>();

/** Clear stale sessions older than 4 hours */
function pruneCache(): void {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [key, session] of sessionCache) {
    if (session.sessionStart < cutoff) sessionCache.delete(key);
  }
}

/**
 * Record a review outcome for the current session's accuracy tracker.
 *
 * @param userId - User identifier
 * @param isCorrect - Whether the answer was correct
 */
export function recordOutcome(userId: string, isCorrect: boolean): void {
  const key = `${userId}_${new Date().toISOString().slice(0, 10)}`;

  if (!sessionCache.has(key)) {
    // Prune on new session creation
    if (sessionCache.size > 1000) pruneCache();
    sessionCache.set(key, {
      outcomes: [],
      userId,
      sessionStart: Date.now(),
    });
  }

  const session = sessionCache.get(key)!;
  session.outcomes.push(isCorrect);
}

export interface AccuracySlopeResult {
  /** Linear regression slope of recent accuracy (null if insufficient data) */
  slope: number | null;
  /** Confidence multiplier: 0.92 (declining), 1.0 (stable), or 1.05 (warming up) */
  confidenceMultiplier: number;
  /** Number of outcomes in the analysis window */
  windowSize: number;
  /** Rolling accuracy over the window (null if insufficient data) */
  rollingAccuracy: number | null;
}

/**
 * Get the confidence modifier based on the current session's accuracy trajectory.
 *
 * @param userId - User identifier
 * @returns Accuracy slope analysis and confidence multiplier
 */
export function getConfidenceModifier(userId: string): AccuracySlopeResult {
  const key = `${userId}_${new Date().toISOString().slice(0, 10)}`;
  const session = sessionCache.get(key);

  if (!session || session.outcomes.length < MIN_ITEMS_FOR_SLOPE) {
    return { slope: null, confidenceMultiplier: 1.0, windowSize: 0, rollingAccuracy: null };
  }

  // Take last WINDOW_SIZE items
  const recent = session.outcomes.slice(-WINDOW_SIZE);
  const n = recent.length;

  // Simple linear regression: y = correctness (0/1), x = position (0..n-1)
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    const y = recent[i] ? 1 : 0;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: null, confidenceMultiplier: 1.0, windowSize: n, rollingAccuracy: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const rollingAccuracy = sumY / n;

  let multiplier = 1.0;
  if (slope < DECLINE_THRESHOLD) {
    multiplier = DECLINE_MULTIPLIER;
  } else if (slope > WARMUP_THRESHOLD) {
    multiplier = WARMUP_MULTIPLIER;
  }

  return {
    slope: Math.round(slope * 10000) / 10000,
    confidenceMultiplier: multiplier,
    windowSize: n,
    rollingAccuracy: Math.round(rollingAccuracy * 1000) / 1000,
  };
}

/** For testing — clear the in-memory session cache */
export function clearSessionCache(): void {
  sessionCache.clear();
}
