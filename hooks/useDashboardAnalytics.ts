import { useAuth } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { createApiClient } from '@/lib/sdk';
import { queryKeys } from '@/lib/queryKeys';
import {
  buildDashboardAnalyticsModel,
  type BlueprintGapsPayload,
  type ConfusionPairsPayload,
  type DashboardAnalyticsModel,
  type DashboardStatsPayload,
  type ReviewForecastPayload,
  type SessionAnalyticsPayload,
  type StudyHistoryPayload,
} from '@/lib/dashboard/realStudyAnalytics';

function toWarning(label: string, reason: unknown): string {
  if (reason instanceof Error) {
    return `${label} unavailable: ${reason.message}`;
  }

  return `${label} unavailable.`;
}

export interface UseDashboardAnalyticsResult {
  data: DashboardAnalyticsModel | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboardAnalytics(): UseDashboardAnalyticsResult {
  const { isSignedIn, getToken } = useAuth();

  const {
    data,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<DashboardAnalyticsModel>({
    queryKey: queryKeys.dashboard.summary(),
    enabled: !!isSignedIn,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const api = createApiClient(getToken);
      const warnings: string[] = [];

      const [
        statsResult,
        sessionsResult,
        reviewResult,
        studyHistoryResult,
        blueprintResult,
        confusionResult,
      ] = await Promise.allSettled([
        api.get<DashboardStatsPayload>('/api/user/stats'),
        api.get<SessionAnalyticsPayload>('/api/analytics/session', {
          limit: '100',
          includeProfile: 'false',
        }),
        api.get<ReviewForecastPayload>('/api/analytics/review-forecast'),
        api.get<StudyHistoryPayload>('/api/user/study-history', {
          range: '30d',
          limit: '500',
          horizonDays: '14',
        }),
        api.get<BlueprintGapsPayload>('/api/analytics/blueprint-gaps'),
        api.get<ConfusionPairsPayload>('/api/analytics/confusion-pairs', {
          limit: '5',
        }),
      ]);

      if (statsResult.status === 'rejected') {
        warnings.push(toWarning('Core stats', statsResult.reason));
      }
      if (sessionsResult.status === 'rejected') {
        warnings.push(toWarning('Session history', sessionsResult.reason));
      }
      if (reviewResult.status === 'rejected') {
        warnings.push(toWarning('Review forecast', reviewResult.reason));
      }
      if (studyHistoryResult.status === 'rejected') {
        warnings.push(toWarning('Study history', studyHistoryResult.reason));
      }
      if (blueprintResult.status === 'rejected') {
        warnings.push(toWarning('Blueprint gaps', blueprintResult.reason));
      }
      if (confusionResult.status === 'rejected') {
        warnings.push(toWarning('Missed-pattern analysis', confusionResult.reason));
      }

      return buildDashboardAnalyticsModel({
        stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
        sessions: sessionsResult.status === 'fulfilled' ? sessionsResult.value : null,
        reviewForecast: reviewResult.status === 'fulfilled' ? reviewResult.value : null,
        studyHistory: studyHistoryResult.status === 'fulfilled' ? studyHistoryResult.value : null,
        blueprintGaps: blueprintResult.status === 'fulfilled' ? blueprintResult.value : null,
        confusionPairs: confusionResult.status === 'fulfilled' ? confusionResult.value : null,
        warnings,
      });
    },
  });

  return {
    data: data ?? null,
    isLoading,
    error: queryError ? (queryError as Error).message : null,
    refetch,
  };
}

export default useDashboardAnalytics;
