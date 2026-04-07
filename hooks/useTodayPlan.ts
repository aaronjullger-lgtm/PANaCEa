/**
 * useTodayPlan — Fetches today's recommended study allocation.
 *
 * Returns the MAIN vs TARGETED split, priority systems, targeted conditions,
 * and a human-readable reason summary from the Daily Study Allocator.
 *
 * @see functions/api/study-plan/today.ts
 * @see lib/services/dailyStudyAllocatorService.ts
 * @see components/dashboard/TodayPlanCard.tsx
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export type StudySplit = 'main_heavy' | 'balanced' | 'targeted_heavy';

export interface TodayPlanData {
  recommendedMainCount: number;
  recommendedTargetedCount: number;
  mainSystems: string[];
  targetedConditions: string[];
  readinessPriority: number;
  retentionPriority: number;
  recommendedSplit: StudySplit;
  reasonSummary: string;
  generatedAt: string;
}

export function useTodayPlan() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<TodayPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const endpoint = getApiEndpoint('/api/study-plan/today');
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`Study plan fetch failed: ${response.status}`);
      }

      const json = await response.json();
      if (json?.data) {
        setData(json.data);
      }
    } catch (err) {
      console.warn('[useTodayPlan] Failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isSignedIn) return;
    fetchPlan();
  }, [isSignedIn, fetchPlan]);

  return { data, isLoading, error, refresh: fetchPlan };
}
