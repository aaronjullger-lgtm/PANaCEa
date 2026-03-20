/**
 * Unified Dashboard Statistics Hook
 *
 * Single hook that provides consistent, harmonized stats for all dashboard widgets.
 * Combines data from Rolling360Stats, DatabaseStats, and other sources,
 * applying the DerivedMetricsService to eliminate inconsistencies.
 */

import { useCallback, useMemo } from 'react';
import { useRolling360Stats } from './useRolling360Stats';
import { useDatabaseStats } from './useDatabaseStats';
import { useSRSItems } from './useSRSItems';
import type { UnifiedStats } from '@/types/unified-stats';
import { computeUnifiedStats } from '@/lib/dashboard/derivedMetrics';

/**
 * Options for the unified stats hook
 */
export interface UseUnifiedStatsOptions {
  /** Include raw source data in the result (for debugging) */
  includeRaw?: boolean;
  /** Refresh interval in milliseconds (default: 5 minutes) */
  refreshInterval?: number;
}

/**
 * Return type of the unified stats hook
 */
export interface UseUnifiedStatsResult {
  /** Unified statistics (null while loading or on error) */
  stats: UnifiedStats | null;
  /** Whether any source is currently loading */
  isLoading: boolean;
  /** Combined error message (if any source failed) */
  error: string | null;
  /** Manually refetch all sources */
  refetch: () => Promise<void>;
  /** Timestamp of the last successful fetch */
  lastFetched: number | null;
}

/**
 * Unified stats hook
 */
export function useUnifiedStats(
  options: UseUnifiedStatsOptions = {}
): UseUnifiedStatsResult {
  const { includeRaw = false } = options;

  // Fetch raw sources
  const {
    stats: rolling360Stats,
    isLoading: rolling360Loading,
    error: rolling360Error,
    mutate: refetchRolling360,
  } = useRolling360Stats();
  const rolling360Fetched = null; // not provided by hook

  const {
    stats: databaseStats,
    isLoading: databaseLoading,
    error: databaseError,
    refetch: refetchDatabase,
    lastFetched: databaseFetched,
  } = useDatabaseStats();

  const {
    dueCount,
    loading: srsItemsLoading,
    error: srsItemsError,
    refetch: refetchSRSItems,
  } = useSRSItems();

  // Determine overall loading state — SRS items are a soft dependency and do not
  // block the primary stats from being computed.
  const primaryLoading = rolling360Loading || databaseLoading;

  // Only treat errors from primary sources as blocking; SRS items error degrades
  // gracefully (dueCount falls back to 0) so the rest of the dashboard still works.
  const error = rolling360Error?.message || rolling360Error?.toString() || databaseError || null;

  // Last fetched timestamp (most recent among sources)
  const lastFetched = useMemo(() => {
    const timestamps = [rolling360Fetched, databaseFetched].filter(Boolean) as number[];
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }, [rolling360Fetched, databaseFetched]);

  // When SRS items fail to load, use 0 so stats can still be computed.
  const effectiveDueCount = srsItemsError ? 0 : dueCount;

  // Compute unified stats when primary sources are ready; SRS items loading state
  // is NOT a hard blocker — render stats with effectiveDueCount=0 while they load.
  const stats = useMemo(() => {
    if (primaryLoading || error) return null;
    if (!rolling360Stats && !databaseStats) return null;

    const rawSources = {
      rolling360: rolling360Stats,
      database: databaseStats,
      dueCount: effectiveDueCount,
    };

    const unified = computeUnifiedStats(rawSources);

    // Remove raw data unless explicitly requested
    if (!includeRaw) {
      delete unified._raw;
    }

    return unified;
  }, [rolling360Stats, databaseStats, effectiveDueCount, primaryLoading, error, includeRaw]);

  // Combined refetch function
  const refetch = useCallback(async () => {
    await Promise.allSettled([
      refetchRolling360(),
      refetchDatabase(),
      refetchSRSItems(),
    ]);
  }, [refetchRolling360, refetchDatabase, refetchSRSItems]);

  return {
    stats,
    isLoading: primaryLoading || srsItemsLoading,
    error,
    refetch,
    lastFetched,
  };
}

export default useUnifiedStats;