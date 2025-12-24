/**
 * Drill Statistics Service
 * 
 * Centralized service for tracking drill mode statistics and progress.
 * Uses localStorage with in-memory caching for performance.
 * 
 * Features:
 * - Per-drill statistics tracking
 * - Session history
 * - Difficulty progression
 * - Spaced repetition scheduling
 * - Performance analytics
 */

import type { DrillStats } from '@/components/drill/DrillLandingPage';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type DrillType =
  | 'ecg_drill'
  | 'derm_drill'
  | 'imaging_drill'
  | 'system_drill'
  | 'subcategory_drill'
  | 'condition_drill'
  | 'pharmacology'
  | 'physiology_drill'
  | 'anatomy_review'
  | 'ventilator_hero'
  | 'mini_lab'
  | 'fluid_electrolyte'
  | 'first_line_treatment'
  | 'guideline_drill'
  | 'rapid_recall'
  | 'code_blue_speed'
  | 'ddx_compare'
  | 'antibiotic_mode';

export interface DrillSession {
  /** Session ID */
  id: string;
  /** Drill type */
  drillType: DrillType;
  /** Timestamp when session started */
  startTime: string;
  /** Timestamp when session ended */
  endTime: string;
  /** Number of questions/cases attempted */
  questionsAttempted: number;
  /** Number of correct answers */
  correctAnswers: number;
  /** Accuracy percentage */
  accuracy: number;
  /** Time spent in seconds */
  timeSpent: number;
  /** Best streak achieved */
  bestStreak: number;
  /** Difficulty level if applicable */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Additional metadata (system, subcategory, etc.) */
  metadata?: Record<string, any>;
}

export interface DrillStatistics {
  /** Drill type */
  drillType: DrillType;
  /** Total number of sessions */
  totalSessions: number;
  /** Total questions attempted across all sessions */
  totalAttempts: number;
  /** Total correct answers */
  totalCorrect: number;
  /** Average accuracy across all sessions */
  averageAccuracy: number;
  /** Best accuracy achieved in a single session */
  bestAccuracy: number;
  /** Total time spent in minutes */
  totalTimeSpent: number;
  /** Last attempted date */
  lastAttempted: string | null;
  /** Best streak across all sessions */
  bestStreak: number;
  /** Current difficulty level */
  currentDifficulty: 'easy' | 'medium' | 'hard';
  /** Next scheduled review (for spaced repetition) */
  nextReview: string | null;
  /** Session history (last 10 sessions) */
  recentSessions: DrillSession[];
  /** Per-category stats (for system/subcategory drills) */
  categoryStats?: Record<string, {
    attempts: number;
    correct: number;
    accuracy: number;
  }>;
}

export interface DrillProgress {
  /** Overall mastery level (0-100) */
  masteryLevel: number;
  /** XP earned */
  xp: number;
  /** Milestone progress */
  milestones: {
    sessions10: boolean;
    sessions25: boolean;
    sessions50: boolean;
    sessions100: boolean;
    accuracy80: boolean;
    accuracy90: boolean;
    accuracy95: boolean;
    streak10: boolean;
    streak25: boolean;
    streak50: boolean;
  };
}

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEY = 'panacea_drill_stats_v1';
const CACHE_TTL = 5000; // 5 seconds

let cachedStats: Record<DrillType, DrillStatistics> | null = null;
let cacheTimestamp = 0;
let cachedStorageValue: string | null = null;

function loadAllStats(): Record<DrillType, DrillStatistics> {
  if (typeof window === 'undefined') return {} as Record<DrillType, DrillStatistics>;

  const raw = localStorage.getItem(STORAGE_KEY);
  const now = Date.now();

  // Check cache
  if (
    cachedStats &&
    now - cacheTimestamp < CACHE_TTL &&
    raw === cachedStorageValue
  ) {
    return cachedStats;
  }

  // Load from localStorage
  try {
    if (!raw) {
      cachedStats = {} as Record<DrillType, DrillStatistics>;
      cacheTimestamp = now;
      cachedStorageValue = raw;
      return cachedStats;
    }

    const parsed = JSON.parse(raw);
    cachedStats = parsed;
    cacheTimestamp = now;
    cachedStorageValue = raw;
    return parsed;
  } catch (error) {
    console.error('Failed to load drill stats:', error);
    cachedStats = {} as Record<DrillType, DrillStatistics>;
    cacheTimestamp = now;
    cachedStorageValue = raw;
    return cachedStats;
  }
}

function saveAllStats(stats: Record<DrillType, DrillStatistics>): void {
  if (typeof window === 'undefined') return;

  try {
    const serialized = JSON.stringify(stats);
    localStorage.setItem(STORAGE_KEY, serialized);

    // Update cache
    cachedStats = stats;
    cacheTimestamp = Date.now();
    cachedStorageValue = serialized;

    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('drill-stats-updated'));
  } catch (error) {
    console.error('Failed to save drill stats:', error);
  }
}

export function clearDrillStatsCache(): void {
  cachedStats = null;
  cacheTimestamp = 0;
  cachedStorageValue = null;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeDrillStats(drillType: DrillType): DrillStatistics {
  return {
    drillType,
    totalSessions: 0,
    totalAttempts: 0,
    totalCorrect: 0,
    averageAccuracy: 0,
    bestAccuracy: 0,
    totalTimeSpent: 0,
    lastAttempted: null,
    bestStreak: 0,
    currentDifficulty: 'easy',
    nextReview: null,
    recentSessions: [],
    categoryStats: {},
  };
}

// ============================================================================
// CORE API
// ============================================================================

/**
 * Record a completed drill session
 * Saves to localStorage (cache/backup) and syncs to backend database
 */
export function recordDrillSession(session: Omit<DrillSession, 'id'>): void {
  const allStats = loadAllStats();
  const drillStats = allStats[session.drillType] || initializeDrillStats(session.drillType);

  // Add session ID
  const fullSession: DrillSession = {
    ...session,
    id: `${session.drillType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };

  // Update statistics
  drillStats.totalSessions += 1;
  drillStats.totalAttempts += session.questionsAttempted;
  drillStats.totalCorrect += session.correctAnswers;
  drillStats.averageAccuracy = (drillStats.totalCorrect / drillStats.totalAttempts) * 100;
  drillStats.bestAccuracy = Math.max(drillStats.bestAccuracy, session.accuracy);
  drillStats.totalTimeSpent += Math.round(session.timeSpent / 60); // Convert to minutes
  drillStats.lastAttempted = session.endTime;
  drillStats.bestStreak = Math.max(drillStats.bestStreak, session.bestStreak);

  // Update difficulty based on performance
  if (session.difficulty) {
    drillStats.currentDifficulty = session.difficulty;
  } else {
    drillStats.currentDifficulty = calculateNextDifficulty(drillStats);
  }

  // Calculate next review date (spaced repetition)
  drillStats.nextReview = calculateNextReview(drillStats);

  // Update category stats if metadata provided
  if (session.metadata?.category) {
    const cat = session.metadata.category;
    if (!drillStats.categoryStats) drillStats.categoryStats = {};
    if (!drillStats.categoryStats[cat]) {
      drillStats.categoryStats[cat] = { attempts: 0, correct: 0, accuracy: 0 };
    }
    drillStats.categoryStats[cat].attempts += session.questionsAttempted;
    drillStats.categoryStats[cat].correct += session.correctAnswers;
    drillStats.categoryStats[cat].accuracy =
      (drillStats.categoryStats[cat].correct / drillStats.categoryStats[cat].attempts) * 100;
  }

  // Add to recent sessions (keep last 10)
  drillStats.recentSessions.unshift(fullSession);
  drillStats.recentSessions = drillStats.recentSessions.slice(0, 10);

  // Save to localStorage (cache/backup)
  allStats[session.drillType] = drillStats;
  saveAllStats(allStats);

  // Sync to backend database (fire-and-forget)
  syncToBackend(fullSession).catch((error) => {
    console.error('Failed to sync performance data to backend:', error);
    // Data is still saved in localStorage as backup
  });
}

/**
 * Sync performance data to backend database
 * @private
 */
async function syncToBackend(session: DrillSession): Promise<void> {
  try {
    const response = await fetch('/api/performance/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        drillType: session.drillType,
        startTime: session.startTime,
        endTime: session.endTime,
        questionsAttempted: session.questionsAttempted,
        correctAnswers: session.correctAnswers,
        accuracy: session.accuracy,
        timeSpent: session.timeSpent,
        bestStreak: session.bestStreak,
        metadata: session.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Backend sync failed: ${error.error || response.statusText}`);
    }

    const result = await response.json();
    // Successfully synced to backend - data persisted in both localStorage and database
  } catch (error) {
    // Log error but don't throw - localStorage backup remains
    console.warn('Backend sync failed, data preserved in localStorage:', error);
    throw error; // Re-throw for caller's error handling
  }
}

/**
 * Get statistics for a specific drill
 */
export function getDrillStats(drillType: DrillType): DrillStatistics {
  const allStats = loadAllStats();
  return allStats[drillType] || initializeDrillStats(drillType);
}

/**
 * Get all drill statistics
 */
export function getAllDrillStats(): Record<DrillType, DrillStatistics> {
  return loadAllStats();
}

/**
 * Get stats in DrillLandingPage format
 */
export function getDrillLandingStats(drillType: DrillType): DrillStats {
  const stats = getDrillStats(drillType);

  return {
    totalAttempts: stats.totalAttempts,
    averageScore: stats.averageAccuracy,
    bestScore: stats.bestAccuracy,
    lastAttempted: stats.lastAttempted || undefined,
    timeSpent: stats.totalTimeSpent,
  };
}

/**
 * Get drill progress/mastery information
 */
export function getDrillProgress(drillType: DrillType): DrillProgress {
  const stats = getDrillStats(drillType);

  // Calculate mastery level (0-100)
  const sessionWeight = Math.min(stats.totalSessions / 50, 1) * 30;
  const accuracyWeight = (stats.averageAccuracy / 100) * 50;
  const consistencyWeight = (stats.bestStreak / 25) * 20;
  const masteryLevel = Math.round(sessionWeight + accuracyWeight + consistencyWeight);

  // Calculate XP
  const xp = stats.totalSessions * 100 + stats.totalCorrect * 10 + stats.bestStreak * 25;

  // Check milestones
  const milestones = {
    sessions10: stats.totalSessions >= 10,
    sessions25: stats.totalSessions >= 25,
    sessions50: stats.totalSessions >= 50,
    sessions100: stats.totalSessions >= 100,
    accuracy80: stats.averageAccuracy >= 80,
    accuracy90: stats.averageAccuracy >= 90,
    accuracy95: stats.averageAccuracy >= 95,
    streak10: stats.bestStreak >= 10,
    streak25: stats.bestStreak >= 25,
    streak50: stats.bestStreak >= 50,
  };

  return { masteryLevel, xp, milestones };
}

/**
 * Get drills that need review (spaced repetition)
 */
export function getDrillsDueForReview(): DrillType[] {
  const allStats = loadAllStats();
  const now = new Date().toISOString();
  const duedrills: DrillType[] = [];

  Object.entries(allStats).forEach(([drillType, stats]) => {
    if (stats.nextReview && stats.nextReview <= now) {
      duedrills.push(drillType as DrillType);
    }
  });

  return duedrills;
}

/**
 * Reset stats for a specific drill
 */
export function resetDrillStats(drillType: DrillType): void {
  const allStats = loadAllStats();
  allStats[drillType] = initializeDrillStats(drillType);
  saveAllStats(allStats);
}

/**
 * Export drill statistics
 */
export function exportDrillStats(): string {
  const allStats = loadAllStats();
  return JSON.stringify(allStats, null, 2);
}

// ============================================================================
// DIFFICULTY PROGRESSION
// ============================================================================

/**
 * Calculate next difficulty level based on performance
 */
export function calculateNextDifficulty(
  stats: DrillStatistics
): 'easy' | 'medium' | 'hard' {
  // Need at least 10 attempts to progress
  if (stats.totalAttempts < 10) return 'easy';

  const recentAccuracy =
    stats.recentSessions.length > 0
      ? stats.recentSessions.slice(0, 3).reduce((sum, s) => sum + s.accuracy, 0) /
        Math.min(3, stats.recentSessions.length)
      : stats.averageAccuracy;

  // Easy → Medium: 3+ sessions with 75%+ accuracy
  if (stats.currentDifficulty === 'easy') {
    if (stats.totalSessions >= 3 && recentAccuracy >= 75) {
      return 'medium';
    }
    return 'easy';
  }

  // Medium → Hard: 5+ sessions with 80%+ accuracy
  if (stats.currentDifficulty === 'medium') {
    if (stats.totalSessions >= 5 && recentAccuracy >= 80) {
      return 'hard';
    }
    // Medium → Easy: recent accuracy < 60%
    if (recentAccuracy < 60) {
      return 'easy';
    }
    return 'medium';
  }

  // Hard → Medium: recent accuracy < 70%
  if (stats.currentDifficulty === 'hard' && recentAccuracy < 70) {
    return 'medium';
  }

  return stats.currentDifficulty;
}

/**
 * Get recommended difficulty for a drill session
 */
export function getRecommendedDifficulty(drillType: DrillType): 'easy' | 'medium' | 'hard' {
  const stats = getDrillStats(drillType);
  return calculateNextDifficulty(stats);
}

// ============================================================================
// SPACED REPETITION
// ============================================================================

/**
 * Calculate next review date based on performance (FSRS-inspired)
 */
export function calculateNextReview(stats: DrillStatistics): string {
  const now = new Date();
  let daysUntilReview = 1; // Default: review tomorrow

  if (stats.totalSessions === 0) {
    daysUntilReview = 1; // First review: 1 day
  } else if (stats.averageAccuracy >= 90) {
    daysUntilReview = Math.min(30, 1 + stats.totalSessions * 2); // High accuracy: longer intervals
  } else if (stats.averageAccuracy >= 75) {
    daysUntilReview = Math.min(14, 1 + stats.totalSessions); // Medium accuracy: moderate intervals
  } else {
    daysUntilReview = 1; // Low accuracy: daily review
  }

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilReview);
  return nextReviewDate.toISOString();
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get overall drill performance summary
 */
export function getDrillPerformanceSummary() {
  const allStats = loadAllStats();
  const drills = Object.values(allStats);

  if (drills.length === 0) {
    return {
      totalDrills: 0,
      totalSessions: 0,
      totalTime: 0,
      averageAccuracy: 0,
      strongestDrill: null,
      weakestDrill: null,
      mostPracticed: null,
      needsReview: [],
    };
  }

  const totalSessions = drills.reduce((sum, d) => sum + d.totalSessions, 0);
  const totalTime = drills.reduce((sum, d) => sum + d.totalTimeSpent, 0);
  const averageAccuracy =
    drills.reduce((sum, d) => sum + d.averageAccuracy * d.totalSessions, 0) / totalSessions || 0;

  const strongestDrill = drills.reduce((max, d) =>
    d.averageAccuracy > max.averageAccuracy ? d : max
  );
  const weakestDrill = drills.reduce((min, d) =>
    d.averageAccuracy < min.averageAccuracy && d.totalSessions > 0 ? d : min
  );
  const mostPracticed = drills.reduce((max, d) =>
    d.totalSessions > max.totalSessions ? d : max
  );

  const needsReview = getDrillsDueForReview();

  return {
    totalDrills: drills.filter((d) => d.totalSessions > 0).length,
    totalSessions,
    totalTime,
    averageAccuracy: Math.round(averageAccuracy),
    strongestDrill: strongestDrill.totalSessions > 0 ? strongestDrill.drillType : null,
    weakestDrill: weakestDrill.totalSessions > 0 ? weakestDrill.drillType : null,
    mostPracticed: mostPracticed.totalSessions > 0 ? mostPracticed.drillType : null,
    needsReview,
  };
}

/**
 * Get category breakdown for system/subcategory drills
 */
export function getCategoryBreakdown(
  drillType: 'system_drill' | 'subcategory_drill'
): Array<{ category: string; attempts: number; accuracy: number }> {
  const stats = getDrillStats(drillType);
  if (!stats.categoryStats) return [];

  return Object.entries(stats.categoryStats)
    .map(([category, data]) => ({
      category,
      attempts: data.attempts,
      accuracy: Math.round(data.accuracy),
    }))
    .sort((a, b) => b.attempts - a.attempts);
}

/**
 * Get simulation-specific statistics for clinical modes
 * Returns metrics unique to Code Blue, Fluids, and Antibiotic modes
 */
export function getSimulationStats() {
  const codeBlueStats = getDrillStats('code_blue_speed');
  const fluidsStats = getDrillStats('fluid_electrolyte');
  const antibioticStats = getDrillStats('antibiotic_mode');

  // Code Blue: Calculate survival rate (accuracy) and best time
  const codeBlueSurvivalRate = codeBlueStats.totalSessions > 0
    ? Math.round(codeBlueStats.averageAccuracy)
    : 0;
  
  // Extract best time from recent sessions metadata if available
  let codeBluebestTime: number | null = null;
  if (codeBlueStats.recentSessions.length > 0) {
    const timesInSeconds = codeBlueStats.recentSessions
      .filter(s => s.metadata?.completionTime)
      .map(s => s.metadata!.completionTime as number);
    if (timesInSeconds.length > 0) {
      codeBluebestTime = Math.min(...timesInSeconds);
    }
  }

  // Fluids: Total cases solved (count of sessions)
  const fluidsCasesSolved = fluidsStats.totalSessions;

  // Antibiotics: Coverage mastery (accuracy %)
  const antibioticCoverageMastery = antibioticStats.totalSessions > 0
    ? Math.round(antibioticStats.averageAccuracy)
    : 0;

  return {
    codeBlue: {
      survivalRate: codeBlueSurvivalRate,
      bestTime: codeBluebestTime,
      totalAttempts: codeBlueStats.totalSessions,
      hasActivity: codeBlueStats.totalSessions > 0,
    },
    fluids: {
      casesSolved: fluidsCasesSolved,
      averageAccuracy: Math.round(fluidsStats.averageAccuracy),
      hasActivity: fluidsStats.totalSessions > 0,
    },
    antibiotics: {
      coverageMastery: antibioticCoverageMastery,
      totalChallenges: antibioticStats.totalSessions,
      hasActivity: antibioticStats.totalSessions > 0,
    },
  };
}
