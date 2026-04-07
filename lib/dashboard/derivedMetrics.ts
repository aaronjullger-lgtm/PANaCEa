/**
 * Derived Metrics Service
 *
 * Computes consistent, harmonized dashboard statistics from multiple data sources.
 * Ensures a single source of truth for all user‑facing analytics.
 */

import type { Rolling360Stats } from '@/hooks/useRolling360Stats';
import type { DatabaseStats } from '@/hooks/useDatabaseStats';
import type { LearningProfile } from '@/types/unified-stats';
import type { UnifiedStats } from '@/types/unified-stats';
import { ABBREVIATION_TO_TOPIC_MAP } from '@/src/constants';
import { wilsonScoreBounds, MASTERY_THRESHOLD, GOLD_MASTERY_THRESHOLD, MIN_OBSERVATIONS } from '@/lib/services/wilsonMasteryService';

// =============================================================================
// Helper Functions
// =============================================================================

/** Format milliseconds into human‑readable study time */
export function formatStudyTime(ms: number): string {
  if (ms < 1000) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

/** Blend two accuracy values with weights (rolling‑360 weight 0.7, lifetime 0.3) */
export function blendAccuracy(rolling360: number | null, lifetime: number | null): number {
  if (rolling360 === null && lifetime === null) return 0;
  if (rolling360 === null) return isFinite(lifetime!) ? lifetime! : 0;
  if (lifetime === null) return isFinite(rolling360) ? rolling360 : 0;
  const blended = rolling360 * 0.7 + lifetime * 0.3;
  // Guard against NaN/Infinity from upstream garbage
  return isFinite(blended) ? blended : 0;
}

/** Determine trend from recent performance data */
export function determineTrend(
  recentAccuracy: number | null,
  previousAccuracy: number | null
): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
  if (recentAccuracy === null || previousAccuracy === null) return 'insufficient_data';
  const delta = recentAccuracy - previousAccuracy;
  if (Math.abs(delta) < 0.01) return 'stable';
  return delta > 0 ? 'improving' : 'declining';
}

/** Cap outliers in decision times (90th percentile) */
export function capOutliers(values: number[], percentile = 0.9): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(Math.floor(sorted.length * percentile), sorted.length - 1);
  const cap = sorted[index] ?? sorted[sorted.length - 1] ?? 0;
  return values.map(v => Math.min(v, cap));
}

/** Convert system code to full display name */
export function getSystemDisplayName(systemCode: string): string {
  return ABBREVIATION_TO_TOPIC_MAP[systemCode as keyof typeof ABBREVIATION_TO_TOPIC_MAP] || systemCode;
}

// =============================================================================
// Core Derivation Functions
// =============================================================================

/**
 * Compute harmonized accuracy metrics
 */
export function deriveAccuracy(
  rolling360: Rolling360Stats | null,
  database: DatabaseStats | null
): UnifiedStats['accuracy'] {
  const rawRolling = rolling360?.accuracyPercent;
  const rolling360Accuracy =
    rawRolling != null && isFinite(rawRolling) ? rawRolling / 100 : null;
  const rawLifetime = database?.overall?.accuracy;
  const lifetimeAccuracy =
    rawLifetime != null && isFinite(rawLifetime) ? rawLifetime / 100 : null;

  const global = blendAccuracy(rolling360Accuracy, lifetimeAccuracy);

  // Placeholder confidence interval (±5%)
  const confidenceInterval: [number, number] | null =
    global > 0 ? [Math.max(0, global - 0.05), Math.min(1, global + 0.05)] : null;

  return {
    global,
    rolling360: rolling360Accuracy,
    lifetime: lifetimeAccuracy,
    confidenceInterval,
  };
}

/**
 * Compute reconciled question counts
 */
export function deriveQuestionCounts(
  rolling360: Rolling360Stats | null,
  database: DatabaseStats | null,
  dueCount?: number
): UnifiedStats['questionCounts'] {
  const uniqueQuestions = database?.overall.questionsSeenCount ?? 0;
  const totalAttempts = database?.overall.totalAttempts ?? 0;
  const rollingWindowAttempts = rolling360?.totalInWindow ?? 0;
  const today = database?.overall.todayCount ?? 0;

  return {
    uniqueQuestions,
    totalAttempts,
    rollingWindowAttempts,
    today,
    dueForReview: dueCount ?? 0,
  };
}

/**
 * Compute standardized study time
 */
export function deriveStudyTime(
  database: DatabaseStats | null
): UnifiedStats['studyTime'] {
  const rawAvg = database?.overall?.avgTimeMs;
  const rawTotal = database?.overall?.totalAttempts;
  const safeAvg = rawAvg != null && isFinite(rawAvg) && rawAvg > 0 ? rawAvg : 0;
  const safeTotal = rawTotal != null && isFinite(rawTotal) && rawTotal > 0 ? rawTotal : 0;
  const totalMs = safeAvg > 0 && safeTotal > 0 ? safeAvg * safeTotal : 0;
  const avgPerQuestionMs = safeAvg > 0 ? safeAvg : null;
  const rawToday = database?.overall?.todayTimeMs;
  const todayMs = rawToday != null && isFinite(rawToday) ? rawToday : 0;

  return {
    totalMs,
    avgPerQuestionMs,
    todayMs,
    display: {
      total: formatStudyTime(totalMs),
      avgPerQuestion: avgPerQuestionMs ? formatStudyTime(avgPerQuestionMs) : '—',
      today: formatStudyTime(todayMs),
    },
  };
}

/**
 * Compute predictions and target times
 */
export function derivePredictions(
  rolling360: Rolling360Stats | null
): UnifiedStats['predictions'] {
  const rawPance = rolling360?.predictedScore;
  const panceScore = rawPance != null && isFinite(rawPance) ? rawPance : null;
  const rawPass = rolling360?.passLikelihood;
  const passLikelihood = rawPass != null && isFinite(rawPass) ? rawPass : null;
  const readinessScore = panceScore !== null ? Math.min(100, Math.max(0, panceScore)) : 0;

  return {
    panceScore,
    passLikelihood,
    readinessScore,
    targetTimes: {
      recall: 60,
      clinicalReasoning: 90,
      vignette: 120,
    },
  };
}

/**
 * Compute system‑level mastery with outlier‑capped decision times
 */
export function deriveSystemMastery(
  rolling360: Rolling360Stats | null,
  database: DatabaseStats | null
): UnifiedStats['systemMastery'] {
  const rollingSystems = rolling360?.systemStats ?? {};
  const databaseSystems = database?.bySystems ?? {};

  const allSystemCodes = new Set([
    ...Object.keys(rollingSystems),
    ...Object.keys(databaseSystems),
  ]);

  const mastery: UnifiedStats['systemMastery'] = [];

  // Collect decision times for capping
  const decisionTimes: number[] = [];
  for (const sys of allSystemCodes) {
    const dbSys = databaseSystems[sys];
    if (dbSys?.avgTimeMs) decisionTimes.push(dbSys.avgTimeMs);
  }
  const cappedTimes = capOutliers(decisionTimes);

  let timeIndex = 0;
  for (const system of allSystemCodes) {
    const rolling = rollingSystems[system];
    const db = databaseSystems[system];

    const attempts = rolling?.total ?? db?.total ?? 0;
    const rawAccuracy = rolling?.accuracy ?? db?.accuracy ?? 0;
    // Guard: accuracy should be 0–1; clamp and protect against NaN
    const accuracy = isFinite(rawAccuracy) ? Math.max(0, Math.min(1, rawAccuracy)) : 0;

    // Wilson score lower bound for conservative mastery estimation.
    // Prevents 5/5 (100% raw) from being treated identically to 50/50 (100% raw).
    // Research (Wilson, 1927): handles small sample sizes and extreme proportions.
    let masteryPercent: number;
    if (attempts >= MIN_OBSERVATIONS) {
      const successes = Math.round(accuracy * attempts);
      const { lower } = wilsonScoreBounds(successes, attempts);
      masteryPercent = Math.round(lower * 100);
    } else {
      // Too few observations: show raw accuracy but flag as uncertain
      masteryPercent = Math.round(accuracy * 100);
    }

    // Map decision time (capped)
    let avgDecisionTimeSec = null;
    if (db?.avgTimeMs && timeIndex < cappedTimes.length) {
      const capped = cappedTimes[timeIndex++];
      avgDecisionTimeSec = capped != null && isFinite(capped) ? Math.round(capped / 1000) : null;
    }

    // Determine trend
    const trend = db?.trend === 'improving' || db?.trend === 'declining' ? db.trend : 'insufficient_data';

    // Growth area: accuracy < 70% and attempts >= 5
    const isGrowthArea = accuracy < 0.7 && attempts >= 5;

    mastery.push({
      system,
      name: getSystemDisplayName(system),
      mastery: masteryPercent,
      attempts,
      avgDecisionTimeSec,
      trend,
      isGrowthArea,
    });
  }

  // Sort by mastery (ascending) so weakest systems appear first
  mastery.sort((a, b) => a.mastery - b.mastery);

  return mastery;
}

/** Raw session data input for deriveRecentActivity */
export interface RecentSessionInput {
  date: string;
  durationMinutes: number;
  questionsCompleted: number;
  accuracy: number;
  hour?: number;
}

/**
 * Compute recent activity (sessions, streak, trend)
 */
export function deriveRecentActivity(
  database: DatabaseStats | null,
  rawSessions?: RecentSessionInput[]
): UnifiedStats['recentActivity'] {
  const streakDays = database?.overall.currentStreak ?? 0;
  const performanceTrend = database?.recentPerformance?.trend ?? 'insufficient_data';

  const sessions: UnifiedStats['recentActivity']['sessions'] = [];
  if (rawSessions && rawSessions.length > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    for (let i = 0; i < rawSessions.length; i++) {
      const s = rawSessions[i]!;
      if (s.date < cutoffStr) continue;
      sessions.push({
        id: `session-${s.date}-${i}`,
        date: s.date,
        mode: 'study',
        questions: s.questionsCompleted,
        accuracy: s.accuracy === 0 ? null : s.accuracy,
        durationMs: s.durationMinutes * 60_000,
      });
    }
  }

  return {
    sessions,
    performanceTrend,
    streakDays,
  };
}

/**
 * Compute focus areas and recommendations
 */
export function deriveFocusAreas(
  systemMastery: UnifiedStats['systemMastery'],
  database: DatabaseStats | null
): UnifiedStats['focusAreas'] {
  // Growth areas: systems with mastery < 70%
  const growthAreas = systemMastery
    .filter(s => s.mastery < 70)
    .slice(0, 3)
    .map(s => s.system);

  // Strong areas: systems with mastery >= 85%
  const strongAreas = systemMastery
    .filter(s => s.mastery >= 85)
    .slice(0, 3)
    .map(s => s.system);

  // Recommendations from database (if any)
  const recommendations = database?.recommendations ?? [];

  return {
    growthAreas,
    strongAreas,
    recommendations,
  };
}

// =============================================================================
// Main Orchestrator
// =============================================================================

export interface RawSources {
  rolling360?: Rolling360Stats | null;
  database?: DatabaseStats | null;
  learningProfile?: LearningProfile | null;
  dueCount?: number;
}

/**
 * Compute unified statistics from raw sources
 */
export function computeUnifiedStats(sources: RawSources): UnifiedStats {
  const { rolling360, database, learningProfile, dueCount } = sources;

  const accuracy = deriveAccuracy(rolling360 ?? null, database ?? null);
  const questionCounts = deriveQuestionCounts(rolling360 ?? null, database ?? null, dueCount);
  const studyTime = deriveStudyTime(database ?? null);
  const predictions = derivePredictions(rolling360 ?? null);
  const systemMastery = deriveSystemMastery(rolling360 ?? null, database ?? null);
  const recentActivity = deriveRecentActivity(database ?? null);
  const focusAreas = deriveFocusAreas(systemMastery, database ?? null);

  return {
    timestamp: new Date().toISOString(),
    freshnessSeconds: 0, // Will be set by endpoint
    sources: {
      rolling360: !!rolling360,
      database: !!database,
      learningProfile: !!learningProfile,
    },
    accuracy,
    questionCounts,
    studyTime,
    predictions,
    systemMastery,
    recentActivity,
    focusAreas,
    _raw: sources, // Include raw data for debugging (optional)
  };
}