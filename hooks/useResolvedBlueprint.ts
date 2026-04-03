/**
 * useResolvedBlueprint Hook
 *
 * Fetches the user's resolved exam blueprint from the server.
 * The blueprint determines which learner stage the user is in (didactic,
 * clinical rotation, PANCE prep, PANRE) and the corresponding system weights.
 *
 * Uses SWR for caching — the blueprint rarely changes within a session.
 */

import { useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import useSWR from 'swr';

import type { LearnerStage } from '@/lib/services/learnerStageBlueprint';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResolvedBlueprintData {
  examTypes: string[];
  stage: LearnerStage;
  weights: Record<string, number>;
  gatedSystems: string[];
  daysToExam: number | null;
  label: string;
  urgencyMultiplier: number;
  rotationTransition: string | null;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useResolvedBlueprint() {
  const { getToken } = useAuth();

  const fetcher = useCallback(
    async (url: string): Promise<ResolvedBlueprintData> => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Blueprint resolution failed: ${res.status}`);
      }

      return res.json();
    },
    [getToken]
  );

  const { data, error, isLoading, mutate } = useSWR<ResolvedBlueprintData>(
    '/api/study/resolve-blueprint',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300_000, // 5 min cache — blueprint rarely changes
      errorRetryCount: 2,
    }
  );

  return {
    blueprint: data ?? null,
    stage: (data?.stage ?? 'general') as LearnerStage,
    weights: data?.weights ?? {},
    gatedSystems: data?.gatedSystems ?? [],
    examTypes: data?.examTypes ?? [],
    daysToExam: data?.daysToExam ?? null,
    label: data?.label ?? 'Loading...',
    urgencyMultiplier: data?.urgencyMultiplier ?? 1,
    rotationTransition: data?.rotationTransition ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}
