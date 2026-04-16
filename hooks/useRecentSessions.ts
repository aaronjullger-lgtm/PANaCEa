/**
 * useRecentSessions — Fetches recent study sessions for wellness monitoring.
 *
 * Pulls the last 14 days of sessions from /api/analytics/session
 * and transforms them into the StudySession shape needed by useStudyWellness.
 */

import { useMemo } from 'react';
import { useAuth } from '@clerk/clerk-react';
import useSWR from 'swr';
import type { StudySession } from './useStudyWellness';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

interface RawSessionRecord {
  startedAt: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number | null;
  totalTimeMs: number;
}

interface SessionAnalyticsResponse {
  sessions: RawSessionRecord[];
  stats?: Record<string, unknown>;
}

function createSessionFetcher(getToken: () => Promise<string | null>) {
  return async (url: string): Promise<RawSessionRecord[]> => {
    const token = await getToken();
    if (!token) return [];
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SessionAnalyticsResponse | { data?: SessionAnalyticsResponse };
    // Handle both { sessions: [...] } and { data: { sessions: [...] } } shapes
    const sessions = ('data' in data && data.data?.sessions) || ('sessions' in data && data.sessions) || [];
    return sessions;
  };
}

export function useRecentSessions(): {
  sessions: StudySession[];
  isLoading: boolean;
  error: string | null;
} {
  const { getToken, isSignedIn } = useAuth();

  const fetcher = useMemo(
    () => createSessionFetcher(getToken),
    [getToken]
  );

  const { data, error, isLoading } = useSWR<RawSessionRecord[]>(
    isSignedIn ? getApiEndpoint(API_ENDPOINTS.ANALYTICS_SESSION) + '?limit=100' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // 1 minute
      shouldRetryOnError: false,
      fallbackData: [],
    }
  );

  const sessions = useMemo<StudySession[]>(() => {
    if (!data || data.length === 0) return [];

    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    return data
      .filter((s) => new Date(s.startedAt) >= fourteenDaysAgo)
      .map((s) => {
        const dt = new Date(s.startedAt);
        return {
          date: dt.toISOString().slice(0, 10),
          durationMinutes: Math.round((s.totalTimeMs || 0) / 60000),
          questionsCompleted: s.totalQuestions || 0,
          accuracy: s.accuracy ?? (s.totalQuestions > 0 ? s.correctAnswers / s.totalQuestions : 0),
          hour: dt.getHours(),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // newest first
  }, [data]);

  return {
    sessions,
    isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load sessions') : null,
  };
}

export default useRecentSessions;
