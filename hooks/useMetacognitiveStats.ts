/**
 * useMetacognitiveStats — Fetches behavioral pattern data for the Metacognitive Mirror.
 *
 * Consumes GET /api/analytics/metacognitive and returns typed widget data.
 * Uses the SDK client for auth and error handling.
 *
 * @module hooks/useMetacognitiveStats
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';
import { queryKeys } from '@/lib/queryKeys';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ResponseTimeBucket {
  date: string;
  avgMs: number;
  count: number;
}

export interface AnswerSwitchInsight {
  totalSwitches: number;
  beneficialSwitches: number;
  harmfulSwitches: number;
  netBenefitRatio: number;
  switchRate: number;
  totalQuestions: number;
}

export interface CircadianBucket {
  hour: number;
  accuracy: number;
  avgMs: number;
  count: number;
}

export interface SpeedAccuracyBucket {
  label: string;
  lowerMs: number;
  upperMs: number;
  accuracy: number;
  count: number;
}

export interface ConfidenceBucket {
  range: string;
  avgConfidence: number;
  actualAccuracy: number;
  count: number;
}

export interface MetacognitiveData {
  responseTimeTrend: ResponseTimeBucket[];
  answerSwitchInsight: AnswerSwitchInsight;
  circadianPerformance: CircadianBucket[];
  firstInstinct: {
    stickAccuracy: number;
    switchAccuracy: number;
    stickCount: number;
    switchCount: number;
  };
  speedAccuracy: SpeedAccuracyBucket[];
  confidenceCurve: ConfidenceBucket[];
  meta: {
    totalAttempts: number;
    periodDays: number;
    computedAt: string;
  };
}

export interface UseMetacognitiveStatsReturn {
  data: MetacognitiveData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useMetacognitiveStats(days = 30): UseMetacognitiveStatsReturn {
  const { isSignedIn, getToken } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<MetacognitiveData>({
    queryKey: queryKeys.analytics.metacognitive(days),
    queryFn: async () => {
      const api = createApiClient(getToken);
      return api.get<MetacognitiveData>('/api/analytics/metacognitive', {
        days: String(days),
      });
    },
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? null,
    isLoading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
  };
}
