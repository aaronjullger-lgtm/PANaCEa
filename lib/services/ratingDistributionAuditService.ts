/**
 * Rating Distribution Audit Service
 *
 * Analyses the Again/Good binary rating distribution from ReviewLog data
 * to detect pipeline health issues. Since PANaCEa uses binary FSRS ratings
 * (Again=1, Good=3 — Hard/Easy deprecated), the distribution balance is
 * critical for scheduling quality:
 *
 *   - Too many Again → cards never stabilise, student sees same material endlessly
 *   - Too many Good  → inflated stability, cards scheduled too far out, forgetting spikes
 *
 * This service produces a diagnostic report per user (or global) with:
 *   - Overall Again/Good ratio
 *   - Per-system breakdown
 *   - Per-session-type breakdown (TARGETED vs MAIN vs DRILL)
 *   - Temporal trend (weekly buckets)
 *   - Anomaly flags (e.g., >80% Again, or >90% Good)
 *
 * Design: purely read-only, receives PrismaClient, no writes.
 *
 * Sprint: Implicit Rating Audit — April 2026
 */

import type { PrismaClient } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RatingBucket {
  total: number;
  againCount: number;
  goodCount: number;
  againPct: number;   // 0–100
  goodPct: number;    // 0–100
}

export interface SystemRatingBreakdown extends RatingBucket {
  system: string;
}

export interface SessionTypeBreakdown extends RatingBucket {
  sessionType: string;
}

export interface WeeklyTrend extends RatingBucket {
  weekStart: string;   // ISO date string (Monday of that week)
}

export type AnomalyLevel = 'healthy' | 'warning' | 'critical';

export interface RatingAnomaly {
  level: AnomalyLevel;
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface RatingDistributionAudit {
  userId: string;
  windowDays: number;
  overall: RatingBucket;
  bySystem: SystemRatingBreakdown[];
  bySessionType: SessionTypeBreakdown[];
  weeklyTrend: WeeklyTrend[];
  anomalies: RatingAnomaly[];
  generatedAt: Date;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default lookback window in days */
const DEFAULT_WINDOW_DAYS = 90;

/** FSRS rating values — Again=1, Good=3 (binary system) */
const RATING_AGAIN = 1;
const RATING_GOOD = 3;

/**
 * Healthy Again% range.
 * Literature suggests 20–40% failure rate is optimal for learning;
 * FSRS binary system (Again vs Good) should cluster around 25–45% Again.
 */
const HEALTHY_AGAIN_MIN = 15;
const HEALTHY_AGAIN_MAX = 55;

/** Warning thresholds: outside healthy but not yet critical */
const WARNING_AGAIN_MIN = 10;
const WARNING_AGAIN_MAX = 65;

/** Minimum reviews needed for a statistically meaningful bucket */
const MIN_BUCKET_SIZE = 10;

/** Minimum reviews needed per system or session type to flag anomalies */
const MIN_BREAKDOWN_SIZE = 5;

// ─── Pure scoring functions (exported for testing) ──────────────────────────

/**
 * Compute a RatingBucket from Again/Good counts.
 */
export function computeBucket(againCount: number, goodCount: number): RatingBucket {
  const total = againCount + goodCount;
  return {
    total,
    againCount,
    goodCount,
    againPct: total > 0 ? Math.round((againCount / total) * 1000) / 10 : 0,
    goodPct: total > 0 ? Math.round((goodCount / total) * 1000) / 10 : 0,
  };
}

/**
 * Assess the anomaly level for an Again% given a bucket size.
 */
export function assessAnomalyLevel(againPct: number, bucketSize: number): AnomalyLevel {
  if (bucketSize < MIN_BUCKET_SIZE) return 'healthy'; // not enough data to judge

  if (againPct < WARNING_AGAIN_MIN || againPct > WARNING_AGAIN_MAX) return 'critical';
  if (againPct < HEALTHY_AGAIN_MIN || againPct > HEALTHY_AGAIN_MAX) return 'warning';
  return 'healthy';
}

/**
 * Detect trend direction from weekly Again% values.
 * Returns positive if Again% is increasing (more failures over time),
 * negative if decreasing, near-zero if stable.
 */
export function detectTrendSlope(weeklyAgainPcts: number[]): number {
  const n = weeklyAgainPcts.length;
  if (n < 3) return 0; // not enough points

  // Simple linear regression slope
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += weeklyAgainPcts[i];
    sumXY += i * weeklyAgainPcts[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Generate anomaly flags from the audit data.
 */
export function generateAnomalies(
  overall: RatingBucket,
  bySystem: SystemRatingBreakdown[],
  bySessionType: SessionTypeBreakdown[],
  trendSlope: number
): RatingAnomaly[] {
  const anomalies: RatingAnomaly[] = [];

  // 1. Overall distribution
  const overallLevel = assessAnomalyLevel(overall.againPct, overall.total);
  if (overallLevel !== 'healthy') {
    const direction = overall.againPct > HEALTHY_AGAIN_MAX ? 'high' : 'low';
    anomalies.push({
      level: overallLevel,
      code: `overall_again_${direction}`,
      message: direction === 'high'
        ? `Overall Again rate is ${overall.againPct}% — cards may not be stabilising. Check if implicit metrics are too harsh.`
        : `Overall Again rate is only ${overall.againPct}% — possible grade inflation. Stability may be growing too fast.`,
      context: { againPct: overall.againPct, total: overall.total },
    });
  }

  // 2. Per-system outliers
  for (const sys of bySystem) {
    if (sys.total < MIN_BREAKDOWN_SIZE) continue;
    const level = assessAnomalyLevel(sys.againPct, sys.total);
    if (level !== 'healthy') {
      anomalies.push({
        level,
        code: `system_skew_${sys.system.toLowerCase().replace(/\s+/g, '_')}`,
        message: `${sys.system}: Again rate is ${sys.againPct}% across ${sys.total} reviews.`,
        context: { system: sys.system, againPct: sys.againPct, total: sys.total },
      });
    }
  }

  // 3. Session type discrepancies
  const targetedBucket = bySessionType.find(s => s.sessionType === 'TARGETED');
  const mainBucket = bySessionType.find(s => s.sessionType === 'MAIN');
  if (targetedBucket && mainBucket &&
      targetedBucket.total >= MIN_BREAKDOWN_SIZE &&
      mainBucket.total >= MIN_BREAKDOWN_SIZE) {
    const diff = Math.abs(targetedBucket.againPct - mainBucket.againPct);
    if (diff > 25) {
      anomalies.push({
        level: 'warning',
        code: 'session_type_discrepancy',
        message: `TARGETED Again rate (${targetedBucket.againPct}%) differs from MAIN (${mainBucket.againPct}%) by ${Math.round(diff)}pp — check if difficulty differs by session type.`,
        context: { targetedAgainPct: targetedBucket.againPct, mainAgainPct: mainBucket.againPct },
      });
    }
  }

  // 4. Trend analysis
  if (Math.abs(trendSlope) > 3) {
    const direction = trendSlope > 0 ? 'increasing' : 'decreasing';
    anomalies.push({
      level: 'warning',
      code: `again_trend_${direction}`,
      message: `Again rate is ${direction} at ~${Math.abs(Math.round(trendSlope))}pp/week. ${
        direction === 'increasing'
          ? 'Student may be struggling or implicit metrics are drifting harsh.'
          : 'Student may be improving or implicit metrics are drifting lenient.'
      }`,
      context: { slope: Math.round(trendSlope * 100) / 100 },
    });
  }

  return anomalies;
}

// ─── DB-integrated function ─────────────────────────────────────────────────

/**
 * Run the rating distribution audit for a user.
 *
 * Reads from: ReviewLog (grade, wasCorrect, system, sessionType, reviewedAt)
 * Does not write anything.
 *
 * @param prisma  PrismaClient instance (caller manages lifecycle)
 * @param userId  Clerk user ID
 * @param windowDays  Lookback window in days (default: 90)
 */
export async function getRatingDistributionAudit(
  prisma: PrismaClient,
  userId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS
): Promise<RatingDistributionAudit> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  // Fetch all review logs with real reviews in the window
  // Note: `prisma as any` because generated Prisma types aren't available in lib/
  const reviews: Array<{
    grade: number;
    system: string | null;
    sessionType: string;
    reviewedAt: Date;
    wasCorrect: boolean;
  }> = await (prisma as any).reviewLog.findMany({
    where: {
      userId,
      review_type: 'real',
      reviewedAt: { gte: cutoff },
      grade: { in: [RATING_AGAIN, RATING_GOOD] },
    },
    select: {
      grade: true,
      system: true,
      sessionType: true,
      reviewedAt: true,
      wasCorrect: true,
    },
  });

  // ── 1. Overall bucket ──────────────────────────────────────────────────────
  let overallAgain = 0;
  let overallGood = 0;
  for (const r of reviews) {
    if (r.grade === RATING_AGAIN) overallAgain++;
    else overallGood++;
  }
  const overall = computeBucket(overallAgain, overallGood);

  // ── 2. Per-system breakdown ────────────────────────────────────────────────
  const systemMap = new Map<string, { again: number; good: number }>();
  for (const r of reviews) {
    const sys = r.system ?? 'Unknown';
    if (!systemMap.has(sys)) systemMap.set(sys, { again: 0, good: 0 });
    const entry = systemMap.get(sys)!;
    if (r.grade === RATING_AGAIN) entry.again++;
    else entry.good++;
  }
  const bySystem: SystemRatingBreakdown[] = [...systemMap.entries()]
    .map(([system, counts]) => ({ system, ...computeBucket(counts.again, counts.good) }))
    .sort((a, b) => b.total - a.total);

  // ── 3. Per-session-type breakdown ──────────────────────────────────────────
  const sessionMap = new Map<string, { again: number; good: number }>();
  for (const r of reviews) {
    const st = r.sessionType ?? 'UNKNOWN';
    if (!sessionMap.has(st)) sessionMap.set(st, { again: 0, good: 0 });
    const entry = sessionMap.get(st)!;
    if (r.grade === RATING_AGAIN) entry.again++;
    else entry.good++;
  }
  const bySessionType: SessionTypeBreakdown[] = [...sessionMap.entries()]
    .map(([sessionType, counts]) => ({ sessionType, ...computeBucket(counts.again, counts.good) }))
    .sort((a, b) => b.total - a.total);

  // ── 4. Weekly trend ────────────────────────────────────────────────────────
  const weekMap = new Map<string, { again: number; good: number }>();
  for (const r of reviews) {
    const weekStart = getWeekStart(new Date(r.reviewedAt));
    if (!weekMap.has(weekStart)) weekMap.set(weekStart, { again: 0, good: 0 });
    const entry = weekMap.get(weekStart)!;
    if (r.grade === RATING_AGAIN) entry.again++;
    else entry.good++;
  }
  const weeklyTrend: WeeklyTrend[] = [...weekMap.entries()]
    .map(([weekStart, counts]) => ({ weekStart, ...computeBucket(counts.again, counts.good) }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  // ── 5. Anomaly detection ───────────────────────────────────────────────────
  const weeklyAgainPcts = weeklyTrend
    .filter(w => w.total >= MIN_BREAKDOWN_SIZE)
    .map(w => w.againPct);
  const trendSlope = detectTrendSlope(weeklyAgainPcts);
  const anomalies = generateAnomalies(overall, bySystem, bySessionType, trendSlope);

  return {
    userId,
    windowDays,
    overall,
    bySystem,
    bySessionType,
    weeklyTrend,
    anomalies,
    generatedAt: now,
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Get the ISO date string for the Monday of the week containing `date`.
 */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().split('T')[0];
}
