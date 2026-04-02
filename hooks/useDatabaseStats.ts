/**
 * Database Statistics Hook
 *
 * Fetches user statistics from the database (QuestionAttempt table).
 * This provides server-side analytics separate from localStorage-based stats.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
    todayCount?: number;
    todayTimeMs?: number;
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

// Error cooldown: 30 seconds before retrying after a failure
const ERROR_COOLDOWN = 30 * 1000;

export function useDatabaseStats(): UseDatabaseStatsResult {
  const { isSignedIn, getToken } = useAuth();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Use refs for cache/cooldown checks so fetchStats has a stable identity
  const statsRef = useRef(stats);
  const lastFetchedRef = useRef(lastFetched);
  const isLoadingRef = useRef(isLoading);
  statsRef.current = stats;
  lastFetchedRef.current = lastFetched;
  isLoadingRef.current = isLoading;

  const fetchStats = useCallback(
    async (force = false) => {
      if (!isSignedIn) {
        setStats(null);
        return;
      }

      // Prevent concurrent fetches — set ref immediately before any async work
      if (isLoadingRef.current) return;
      isLoadingRef.current = true;

      // Check cache (success) or cooldown (error)
      if (!force && lastFetchedRef.current) {
        const elapsed = Date.now() - lastFetchedRef.current;
        if (statsRef.current && elapsed < CACHE_DURATION) { isLoadingRef.current = false; return; }
        if (!statsRef.current && elapsed < ERROR_COOLDOWN) { isLoadingRef.current = false; return; }
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        const result = await getUserStats(token);

        if (result) {
          setStats(result as DatabaseStats);
        } else {
          setError('Failed to fetch stats');
        }
      } catch (err) {
        console.error('[useDatabaseStats] Error fetching stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        // Always set lastFetched — on success for cache, on error for cooldown
        setLastFetched(Date.now());
        setIsLoading(false);
      }
    },
    [isSignedIn, getToken]
  );

  // Initial fetch when user signs in
  useEffect(() => {
    if (isSignedIn && !statsRef.current && !isLoadingRef.current) {
      fetchStats();
    }
  }, [isSignedIn, fetchStats]);

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
