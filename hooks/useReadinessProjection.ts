/**
 * useReadinessProjection — Fetches FSRS-based exam readiness projection.
 *
 * Consumes GET /api/analytics/readiness-projection, which computes:
 * - Beta-Binomial mastery posteriors per condition
 * - Harmonic mean stability aggregation (weakest-card-dominated)
 * - FSRS v6 forward projection to exam date
 * - Blueprint-weighted system and overall readiness
 * - Projected PANCE score range (300-800) with confidence intervals
 *
 * @module hooks/useReadinessProjection
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';

// ── Types ─────────────────────────────────────────────────────────────────

export interface SystemReadiness {
  system: string;
  readiness: number;
  topicCount: number;
  cardCount: number;
  projectedReadiness?: number;
  blueprintWeight?: number;
}

export interface ExamReadinessProjection {
  overallReadiness: number;
  projectedAtExam: number;
  projectedScoreRange: {
    low: number;
    mid: number;
    high: number;
  };
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  criticalSystems: string[];
  systems: SystemReadiness[];
  daysUntilExam?: number;
  message?: string;
}

export interface UseReadinessProjectionReturn {
  data: ExamReadinessProjection | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useReadinessProjection(
  examDate?: string | null
): UseReadinessProjectionReturn {
  const { isSignedIn, getToken } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<ExamReadinessProjection>({
    queryKey: ['readiness-projection', examDate],
    queryFn: async () => {
      const api = createApiClient(getToken);
      const params: Record<string, string> = {};
      if (examDate) params.examDate = examDate;
      return api.get<ExamReadinessProjection>(
        '/api/analytics/readiness-projection',
        params
      );
    },
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 5,  // 5 minutes — matches server Cache-Control
    gcTime: 1000 * 60 * 30,    // 30 minutes
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? null,
    isLoading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
  };
}
