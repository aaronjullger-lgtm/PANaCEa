/**
 * useRolling360Stats Hook
 *
 * React hook for consuming Rolling 360 statistics on the dashboard.
 * Provides real-time exam readiness metrics based on the last 360
 * Main Session questions.
 *
 * Features:
 * - SWR caching with automatic revalidation
 * - Optimistic updates after answering questions
 * - Skeleton loading states
 * - Error boundary compatible
 */

import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';

// =============================================================================
// TYPES
// =============================================================================

export interface SystemStats {
  total: number;
  correct: number;
  accuracy: number;
}

/**
 * Calibration Metrics for Cold Start (0-60 questions)
 * Unlocked progressively to gamify the onboarding experience
 */
export interface CalibrationMetrics {
  /** Avg response time in ms (unlocks at 10 questions) */
  avgResponseTimeMs: number | null;
  /** High Confidence + Correct alignment ratio (unlocks at 30 questions) */
  confidenceAlignment: number | null;
  /** Most frequent error system (unlocks at 50 questions) */
  primaryErrorSystem: string | null;
  /** Secondary error system */
  secondaryErrorSystem: string | null;
  /** Current calibration step (1-4) */
  currentStep: number;
  /** Questions to next unlock */
  questionsToNextUnlock: number;
}

export interface Rolling360Stats {
  scoreConfidence: 'collecting' | 'provisional' | 'confident';
  totalInWindow: number;
  correctInWindow: number;
  accuracyPercent: number | null;
  systemStats: Record<string, SystemStats>;
  predictedScore: number | null;
  passLikelihood: number | null;
  blueprintAdherence: number | null;
  isValidExamDistribution: boolean;
  weakestSystems: string[];
  strongestSystems: string[];
  windowStartTime: string | null;
  windowEndTime: string | null;
  questionsNeeded: number;
  message: string;
  /** Calibration metrics for cold start users (0-60 questions) */
  calibrationMetrics?: CalibrationMetrics;
}

interface UseRolling360StatsReturn {
  stats: Rolling360Stats | null;
  isLoading: boolean;
  isValidating: boolean;
  error: Error | null;
  mutate: () => void;
  isEmpty: boolean;
  isCollecting: boolean;
  isProvisional: boolean;
  isConfident: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const API_ENDPOINT = '/api/user/rolling-360-stats';
const CACHE_KEY = 'rolling-360-stats';

// Empty state for new users
const EMPTY_STATS: Rolling360Stats = {
  scoreConfidence: 'collecting',
  totalInWindow: 0,
  correctInWindow: 0,
  accuracyPercent: null,
  systemStats: {},
  predictedScore: null,
  passLikelihood: null,
  blueprintAdherence: null,
  isValidExamDistribution: false,
  weakestSystems: [],
  strongestSystems: [],
  windowStartTime: null,
  windowEndTime: null,
  questionsNeeded: 50,
  message: 'Answer Main Session questions to build your Rolling 360 score.',
};

// =============================================================================
// FETCHER
// =============================================================================

async function fetchRolling360Stats(url: string, token: string | null): Promise<Rolling360Stats> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Rolling 360 stats failed: ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON but got ${contentType || 'text/html'}`);
  }
  return response.json();
}

// =============================================================================
// HOOK
// =============================================================================

export function useRolling360Stats(): UseRolling360StatsReturn {
  const { getToken, isSignedIn } = useAuth();

  const { data, error, isLoading, isValidating, mutate } = useSWR<Rolling360Stats, Error>(
    isSignedIn ? [API_ENDPOINT, CACHE_KEY] : null,
    async ([url]) => {
      const token = await getToken();
      return fetchRolling360Stats(url, token);
    },
    {
      // Revalidate on focus (user returns to tab)
      revalidateOnFocus: true,
      // Revalidate every 5 minutes while tab is open
      refreshInterval: 5 * 60 * 1000,
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Dedupe requests within 2 seconds
      dedupingInterval: 2000,
      // Don't retry on error (endpoint returns 200 with empty state)
      shouldRetryOnError: false,
      // Return empty stats on error
      fallbackData: EMPTY_STATS,
    }
  );

  const stats = data || EMPTY_STATS;

  return {
    stats,
    isLoading,
    isValidating,
    error: error || null,
    mutate: () => mutate(),
    isEmpty: stats.totalInWindow === 0,
    isCollecting: stats.scoreConfidence === 'collecting',
    isProvisional: stats.scoreConfidence === 'provisional',
    isConfident: stats.scoreConfidence === 'confident',
  };
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

/**
 * Hook for getting the predicted PANCE score badge
 */
export function usePredictedScoreBadge(): {
  score: number | null;
  color: string;
  label: string;
  confidence: string;
} {
  const { stats } = useRolling360Stats();

  if (!stats || stats.predictedScore === null) {
    return {
      score: null,
      color: 'gray',
      label: 'Not enough data',
      confidence: 'collecting',
    };
  }

  const score = stats.predictedScore;
  let color = 'gray';
  let label = '';

  if (stats.scoreConfidence === 'collecting') {
    color = 'gray';
    label = 'Building profile...';
  } else if (stats.scoreConfidence === 'provisional') {
    color = 'amber';
    label = 'Provisional';
  } else {
    color = score >= 350 ? 'emerald' : 'red';
    label = score >= 350 ? 'Passing' : 'Below Passing';
  }

  return {
    score,
    color,
    label,
    confidence: stats.scoreConfidence,
  };
}

/**
 * Hook for getting system weakness analysis
 */
export function useSystemWeaknesses(): {
  weakest: string[];
  strongest: string[];
  hasEnoughData: boolean;
} {
  const { stats } = useRolling360Stats();

  if (!stats || stats.totalInWindow < 50) {
    return {
      weakest: [],
      strongest: [],
      hasEnoughData: false,
    };
  }

  return {
    weakest: stats.weakestSystems || [],
    strongest: stats.strongestSystems || [],
    hasEnoughData: true,
  };
}

/**
 * Hook for optimistic update after answering a question
 */
export function useOptimisticRolling360Update(): (isCorrect: boolean, system: string) => void {
  const { stats, mutate } = useRolling360Stats();

  return (isCorrect: boolean, system: string) => {
    if (!stats) return;

    // Optimistically update local state
    const newTotal = Math.min(stats.totalInWindow + 1, 360);
    const newCorrect = stats.correctInWindow + (isCorrect ? 1 : 0);
    const newAccuracy = (newCorrect / newTotal) * 100;

    // Update system stats
    const newSystemStats = { ...stats.systemStats };
    if (!newSystemStats[system]) {
      newSystemStats[system] = { total: 0, correct: 0, accuracy: 0 };
    }
    newSystemStats[system].total += 1;
    if (isCorrect) {
      newSystemStats[system].correct += 1;
    }
    newSystemStats[system].accuracy =
      (newSystemStats[system].correct / newSystemStats[system].total) * 100;

    // Calculate predicted score (same formula as backend)
    const predictedScore = Math.round(200 + (newAccuracy / 100) * 600);

    // Optimistic update
    mutate();
  };
}

export default useRolling360Stats;
