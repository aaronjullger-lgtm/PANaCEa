/**
 * Database Statistics Hook
 *
 * Fetches user statistics from the database (QuestionAttempt table).
 * This provides server-side analytics separate from localStorage-based stats.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getUserStats } from '@/services/core';

interface SystemStats {
  total: number;
  correct: number;
  accuracy: number;
  trend: 'improving' | 'declining' | 'neutral';
  avgTimeMs: number | null;
  lastAttempt: string | null;
}

interface WeakArea {
  system: string;
  accuracy: number;
  attempts: number;
  trend: 'improving' | 'declining' | 'neutral';
}

interface StrongArea {
  system: string;
  accuracy: number;
  attempts: number;
}

interface ConditionStat {
  conditionId: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface DatabaseStats {
  overall: {
    totalAttempts: number;
    correctAttempts: number;
    accuracy: number;
    questionsSeenCount: number;
    currentStreak: number;
    totalStudyDays: number;
    avgTimeMs: number | null;
    avgAnswerChanges: number | null;
  };
  bySystems: Record<string, SystemStats>;
  byConditions?: ConditionStat[];
  weakAreas: WeakArea[];
  strongAreas: StrongArea[];
  weakConditions?: ConditionStat[];
  recentPerformance: {
    last7Days: {
      attempts: number;
      accuracy: number | null;
    };
    previous7Days: {
      attempts: number;
      accuracy: number | null;
    };
    trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
  };
  recommendations: string[];
}

interface UseDatabaseStatsResult {
  stats: DatabaseStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  lastFetched: number | null;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export function useDatabaseStats(): UseDatabaseStatsResult {
  const { isSignedIn, getToken } = useAuth();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const fetchStats = useCallback(
    async (force = false) => {
      if (!isSignedIn) {
        setStats(null);
        return;
      }

      // Check cache
      if (!force && lastFetched && Date.now() - lastFetched < CACHE_DURATION && stats) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        const result = await getUserStats(token);

        if (result) {
          setStats(result as DatabaseStats);
          setLastFetched(Date.now());
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cc925588-f854-48c4-bfb9-7695098805ff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'useDatabaseStats.ts:fetch',
              message: 'Database stats loaded',
              data: { hasStats: true, systemsCount: Object.keys((result as DatabaseStats).bySystems || {}).length },
              hypothesisId: 'H4',
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        } else {
          setError('Failed to fetch stats');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/cc925588-f854-48c4-bfb9-7695098805ff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'useDatabaseStats.ts:fetch',
              message: 'Database stats null result',
              data: { hasStats: false },
              hypothesisId: 'H4',
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      } catch (err) {
        console.error('[useDatabaseStats] Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/cc925588-f854-48c4-bfb9-7695098805ff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'useDatabaseStats.ts:fetch',
            message: 'Database stats fetch error',
            data: { error: err instanceof Error ? err.message : String(err) },
            hypothesisId: 'H4',
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      } finally {
        setIsLoading(false);
      }
    },
    [isSignedIn, getToken, lastFetched, stats]
  );

  // Initial fetch when user signs in
  useEffect(() => {
    if (isSignedIn && !stats && !isLoading) {
      fetchStats();
    }
  }, [isSignedIn, stats, isLoading, fetchStats]);

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    await fetchStats(true);
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch,
    lastFetched,
  };
}

export default useDatabaseStats;
