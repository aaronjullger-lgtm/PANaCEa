/**
 * useDrillRecommendations — Fetches personalized drill suggestions.
 *
 * Consumes GET /api/analytics/drill-recommendations, which internally
 * assembles a WeaknessProfile and runs the deterministic recommendation
 * engine. Returns 3-5 prioritized drill suggestions with reasons.
 *
 * @module hooks/useDrillRecommendations
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';

// ── Types ─────────────────────────────────────────────────────────────────

export interface DrillRecommendation {
  drillType: string;
  label: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  focusSystem?: string;
  focusConditions?: string[];
  priority: number;
}

export interface DrillRecommendationsData {
  recommendations: DrillRecommendation[];
  profile: {
    totalAttempts: number;
    days: number;
    weakestSystem: string | null;
    topConfusionPair: { real: string; mistaken: string } | null;
  };
}

export interface UseDrillRecommendationsReturn {
  data: DrillRecommendationsData | null;
  recommendations: DrillRecommendation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useDrillRecommendations(days = 60): UseDrillRecommendationsReturn {
  const { isSignedIn, getToken } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<DrillRecommendationsData>({
    queryKey: ['drill-recommendations', days],
    queryFn: async () => {
      const api = createApiClient(getToken);
      return api.get<DrillRecommendationsData>('/api/analytics/drill-recommendations', {
        days: String(days),
      });
    },
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 10, // 10 minutes — recommendations don't change fast
    gcTime: 1000 * 60 * 60,    // 1 hour
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? null,
    recommendations: data?.recommendations ?? [],
    isLoading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
  };
}
