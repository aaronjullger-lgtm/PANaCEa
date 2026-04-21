/**
 * Session Regularity Score Service (Wave 3B)
 *
 * Computes a per-user habit consistency metric from recent session history.
 * Erratic study patterns (high coefficient of variation in inter-session intervals)
 * slightly reduce telemetry trust — erratic users' behavioral signals are noisier.
 *
 * Integration: Call once per session (cache for 24h). Apply telemetryTrustMultiplier
 * to adjustedConfidence in the pipeline.
 *
 * @see plans/behavioral-signals-implementation-plan.md — Feature 3B (Feature #5)
 */

// ── Types ──

export type RegularityClassification = 'regular' | 'moderate' | 'erratic' | 'insufficient_data';

export interface SessionRegularityResult {
  /** Coefficient of variation of inter-session intervals (lower = more regular) */
  intervalCV: number | null;
  /** Consecutive days with ≥1 review session (current streak) */
  streakDays: number;
  /** Telemetry trust multiplier: 0.95–1.0 */
  telemetryTrustMultiplier: number;
  /** Classification of study regularity */
  regularity: RegularityClassification;
}

// ── Constants ──

/** Minimum distinct session dates required for meaningful analysis */
const MIN_SESSION_DATES = 3;

/** CV threshold for "regular" classification */
const REGULAR_CV_THRESHOLD = 0.3;

/** CV threshold for "moderate" (above this → "erratic") */
const MODERATE_CV_THRESHOLD = 0.8;

/** Multiplier applied to erratic study patterns */
const ERRATIC_TRUST_PENALTY = 0.95;

/** Default lookback window in days */
const DEFAULT_LOOKBACK_DAYS = 14;

// ── Main function ──

/**
 * Compute session regularity from recent review history.
 *
 * @param prisma - Prisma client for DB queries
 * @param userId - The user ID
 * @param lookbackDays - Number of days to look back (default: 14)
 * @returns Session regularity analysis with trust multiplier
 */
export async function computeSessionRegularity(
  prisma: any,
  userId: string,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): Promise<SessionRegularityResult> {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000);

  const sessions = await prisma.reviewLog.findMany({
    where: { userId, reviewedAt: { gte: cutoff }, review_type: 'real' },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: 'asc' },
  });

  // Group by calendar date (deduplicate same-day sessions)
  const sessionDates = [...new Set(
    sessions.map((s: any) => s.reviewedAt.toISOString().slice(0, 10))
  )].sort() as string[];

  if (sessionDates.length < MIN_SESSION_DATES) {
    return {
      intervalCV: null,
      streakDays: sessionDates.length,
      telemetryTrustMultiplier: 1.0,
      regularity: 'insufficient_data',
    };
  }

  // Compute inter-session intervals in days
  const intervals: number[] = [];
  for (let i = 1; i < sessionDates.length; i++) {
    const diff = (new Date(sessionDates[i]).getTime() - new Date(sessionDates[i - 1]).getTime()) / 86400000;
    intervals.push(diff);
  }

  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const stdDev = Math.sqrt(
    intervals.reduce((sum, x) => sum + (x - mean) ** 2, 0) / intervals.length
  );
  const cv = mean > 0 ? stdDev / mean : 0;

  // Compute current streak (consecutive days ending today or yesterday)
  const streak = computeStreak(sessionDates);

  let regularity: RegularityClassification;
  let multiplier = 1.0;

  if (cv < REGULAR_CV_THRESHOLD) {
    regularity = 'regular';
  } else if (cv < MODERATE_CV_THRESHOLD) {
    regularity = 'moderate';
  } else {
    regularity = 'erratic';
    multiplier = ERRATIC_TRUST_PENALTY;
  }

  return {
    intervalCV: Math.round(cv * 1000) / 1000,
    streakDays: streak,
    telemetryTrustMultiplier: multiplier,
    regularity,
  };
}

/**
 * Compute current streak of consecutive study days ending today or yesterday.
 * Exported for testing.
 */
export function computeStreak(sessionDates: string[]): number {
  if (sessionDates.length === 0) return 0;

  let streak = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Start from the most recent date and work backward
  const lastDate = sessionDates[sessionDates.length - 1];
  if (lastDate !== todayStr && lastDate !== yesterdayStr) return 0;

  // Anchor offset: 0 if today has a session, 1 if anchored at yesterday
  const anchorOffset = lastDate === todayStr ? 0 : 1;

  for (let i = sessionDates.length - 1; i >= 0; i--) {
    const expected = new Date(Date.now() - (streak + anchorOffset) * 86400000)
      .toISOString()
      .slice(0, 10);
    if (sessionDates[i] === expected) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
