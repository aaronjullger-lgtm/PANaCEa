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
  if (rolling360 === null) return lifetime!;
  if (lifetime === null) return rolling360;
  return rolling360 * 0.7 + lifetime * 0.3;
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
  const index = Math.floor(sorted.length * percentile);
  const cap = sorted[index];
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
  const rolling360Accuracy = rolling360?.accuracyPercent !== null ? rolling360.accuracyPercent / 100 : null;
  const lifetimeAccuracy = database?.overall.accuracy !== undefined ? database.overall.accuracy / 100 : null;

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
  const today = 0; // TODO: fetch from daily stats endpoint

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
  const totalMs = database?.overall.avgTimeMs
    ? database.overall.avgTimeMs * (database.overall.totalAttempts || 1)
    : 0;
  const avgPerQuestionMs = database?.overall.avgTimeMs ?? null;
  const todayMs = 0; // TODO: fetch from daily stats

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
  const panceScore = rolling360?.predictedScore ?? null;
  const passLikelihood = rolling360?.passLikelihood ?? null;
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
    const accuracy = rolling?.accuracy ?? db?.accuracy ?? 0;
    const masteryPercent = Math.round(accuracy * 100);

    // Map decision time (capped)
    let avgDecisionTimeSec = null;
    if (db?.avgTimeMs) {
      avgDecisionTimeSec = Math.round(cappedTimes[timeIndex++] / 1000);
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

/**
 * Compute recent activity (sessions, streak, trend)
 */
export function deriveRecentActivity(
  database: DatabaseStats | null
): UnifiedStats['recentActivity'] {
  const sessions: UnifiedStats['recentActivity']['sessions'] = [];
  // TODO: integrate with real session history endpoint
  // For now, use placeholder from database recent performance
  const streakDays = database?.overall.currentStreak ?? 0;

  const performanceTrend = database?.recentPerformance.trend ?? 'insufficient_data';

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