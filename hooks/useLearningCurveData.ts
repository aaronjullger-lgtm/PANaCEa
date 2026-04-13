/**
 * Hook for fetching learning curve data (daily performance + stability trend).
 */

import useSWR from 'swr';
import { useAuth } from '@clerk/clerk-react';
import { fetchLearningCurveData } from '@/services/analytics/learningCurveService';
import { logger } from "@/lib/simple-logger";

export interface UseLearningCurveDataOptions {
  days?: number;
  enabled?: boolean;
}

export function useLearningCurveData({ days = 30, enabled = true }: UseLearningCurveDataOptions = {}) {
  const { getToken } = useAuth();

  const fetcher = async () => {
    const token = await getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    return fetchLearningCurveData(token, days);
  };

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    enabled ? `learning-curve-${days}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      onError: (err) => {
        logger.error('useLearningCurveData', 'Failed to fetch learning curve data', err);
      },
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    isEmpty: !isLoading && !error && (!data || data.points.length === 0),
  };
}