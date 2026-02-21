/**
 * Unified Dashboard Statistics
 *
 * Single source of truth for all user-facing analytics.
 * Merges data from Rolling360Stats, DatabaseStats, and LearningProfile
 * to eliminate inconsistencies across dashboard widgets.
 */

import type { Rolling360Stats } from '@/hooks/useRolling360Stats';
import type { DatabaseStats } from '@/hooks/useDatabaseStats';
// LearningProfile is not currently available; placeholder for future integration
export interface LearningProfile {}

/**
 * Combined statistics from all sources
 */
export interface UnifiedStats {
  // ===========================================================================
  // Meta
  // ===========================================================================
  /** Timestamp of this snapshot */
  timestamp: string;
  /** Data freshness (seconds since last update) */
  freshnessSeconds: number;
  /** Source availability flags */
  sources: {
    rolling360: boolean;
    database: boolean;
    learningProfile: boolean;
  };

  // ===========================================================================
  // Accuracy (Harmonized)
  // ===========================================================================
  accuracy: {
    /** Primary accuracy value shown as "Global Accuracy" (weighted blend) */
    global: number;
    /** Rolling 360 accuracy (last 360 Main Session questions) */
    rolling360: number | null;
    /** Lifetime accuracy (all‑time server‑side) */
    lifetime: number | null;
    /** Confidence interval for accuracy (lower, upper) */
    confidenceInterval: [number, number] | null;
  };

  // ===========================================================================
  // Question Counts (Reconciled)
  // ===========================================================================
  questionCounts: {
    /** Unique questions seen (server‑side) */
    uniqueQuestions: number;
    /** Total attempts (including repeats) */
    totalAttempts: number;
    /** Attempts within the rolling 360 window */
    rollingWindowAttempts: number;
    /** Questions answered today */
    today: number;
    /** Questions due for review (FSRS) */
    dueForReview: number;
  };

  // ===========================================================================
  // Study Time (Standardized)
  // ===========================================================================
  studyTime: {
    /** Total study time in milliseconds */
    totalMs: number;
    /** Average time per question (ms) */
    avgPerQuestionMs: number | null;
    /** Today's study time (ms) */
    todayMs: number;
    /** Formatted strings for display */
    display: {
      total: string;          // e.g., "42h 15m"
      avgPerQuestion: string; // e.g., "45s"
      today: string;          // e.g., "1h 30m"
    };
  };

  // ===========================================================================
  // Predictions & Targets
  // ===========================================================================
  predictions: {
    /** Predicted PANCE score (rolling‑360 model) */
    panceScore: number | null;
    /** Pass likelihood (0‑1) */
    passLikelihood: number | null;
    /** Estimated exam readiness (0‑100) */
    readinessScore: number;
    /** Target times per question type */
    targetTimes: {
      recall: number;        // <60s
      clinicalReasoning: number; // <90s
      vignette: number;      // <120s
    };
  };

  // ===========================================================================
  // System‑Level Mastery
  // ===========================================================================
  systemMastery: Array<{
    system: string;
    /** Full display name */
    name: string;
    /** Mastery percentage (0‑100) */
    mastery: number;
    /** Attempt count within rolling window */
    attempts: number;
    /** Average decision time (seconds) */
    avgDecisionTimeSec: number | null;
    /** Trend direction */
    trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    /** Whether system is a growth area */
    isGrowthArea: boolean;
  }>;

  // ===========================================================================
  // Recent Activity
  // ===========================================================================
  recentActivity: {
    /** Sessions from the last 7 days */
    sessions: Array<{
      id: string;
      date: string;
      mode: string;
      questions: number;
      accuracy: number | null;
      durationMs: number;
    }>;
    /** Performance trend over last 7 days */
    performanceTrend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
    /** Current day streak */
    streakDays: number;
  };

  // ===========================================================================
  // Focus Areas & Recommendations
  // ===========================================================================
  focusAreas: {
    /** Top 3 growth areas (by accuracy delta) */
    growthAreas: string[];
    /** Top 3 strong areas */
    strongAreas: string[];
    /** AI‑generated recommendations */
    recommendations: string[];
  };

  // ===========================================================================
  // Raw Source Data (for debugging)
  // ===========================================================================
  _raw?: {
    rolling360?: Rolling360Stats;
    database?: DatabaseStats;
    learningProfile?: LearningProfile;
  };
}

/**
 * Options for fetching unified stats
 */
export interface UnifiedStatsOptions {
  /** Include raw source data in response */
  includeRaw?: boolean;
  /** Force refresh (skip cache) */
  forceRefresh?: boolean;
}