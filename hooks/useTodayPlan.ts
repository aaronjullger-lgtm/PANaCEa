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
  planId?: string;
  planDate?: string;
  status?: string;
  progress?: {
    questionsAnswered: number;
    questionsTarget: number;
    percentComplete: number;
  };
  tasks?: Array<{
    id: string;
    kind: string;
    mode: string;
    title: string;
    count: number;
    estimatedMinutes: number;
    reason: string;
    priority: string;
    status: string;
    systemFilter?: string[];
    conditionIds?: string[];
    route: string;
    launchParams: Record<string, string>;
  }>;
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

      const json: any = await response.json();
      const payload = json?.data?.data ?? json?.data ?? json;
      if (payload) setData(payload);
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
