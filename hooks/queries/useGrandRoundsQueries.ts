/**
 * TanStack Query hooks for Grand Rounds and Targeted Daily Challenge.
 *
 * Extracts the 6 fetch patterns from GrandRoundsMode.tsx into
 * reusable hooks with proper caching and error handling.
 *
 * @module hooks/queries/useGrandRoundsQueries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { queryKeys } from '@/lib/queryKeys';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GrandRoundsChallengeResponse {
  status: 'active' | 'completed';
  challengeId?: string;
  questions?: unknown[];
  stats?: {
    score?: number;
    correctCount: number;
    totalQuestions: number;
    timeSpentMs: number;
    percentile?: number;
    ranking?: number;
  };
}

export interface TargetedDailyChallengeResponse {
  status: 'active' | 'completed';
  question?: {
    id: string;
    vignette?: string;
    question: string;
    options: string[];
    system: string;
    difficulty: string;
    tags?: string[];
  };
  stats?: {
    correctCount: number;
    totalQuestions: number;
    timeSpentMs: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  completionTimeMs: number;
  correctAnswers: number;
}

export interface ReviewEntry {
  questionId: string;
  question: string;
  options: string[];
  correct: boolean;
  rationale: string;
}

export interface SubmissionResult {
  success: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  percentile: number;
  ranking: number;
  speedBonus: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function authedFetch<T>(
  getToken: () => Promise<string | null>,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Authentication required. Please sign in again.');

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getApiEnvelopeError(body, `HTTP ${res.status}`));
  }

  return unwrapApiEnvelope<T>(await res.json());
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch today's Grand Rounds challenge.
 * Returns 'active' with questions or 'completed' with stats.
 */
export function useGrandRoundsToday(enabled = true) {
  const { isSignedIn, getToken } = useAuth();

  return useQuery<GrandRoundsChallengeResponse>({
    queryKey: queryKeys.grandRounds.today(),
    queryFn: () =>
      authedFetch<GrandRoundsChallengeResponse>(getToken, '/api/grand-rounds/today'),
    enabled: !!isSignedIn && enabled,
    staleTime: 1000 * 60 * 5, // 5 min — challenge won't change mid-session
    retry: 1,
  });
}

/**
 * Fetch today's targeted daily question for given systems.
 */
export function useTargetedDailyToday(systems: string[], enabled = true) {
  const { isSignedIn, getToken } = useAuth();
  const systemsKey = systems.sort().join(',');

  return useQuery<TargetedDailyChallengeResponse>({
    queryKey: queryKeys.targetedDaily.today(systemsKey),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('systems', systems.join(','));
      return authedFetch<TargetedDailyChallengeResponse>(
        getToken,
        `/api/targeted-daily/today?${params}`,
      );
    },
    enabled: !!isSignedIn && enabled && systems.length > 0,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

/**
 * Fetch Grand Rounds leaderboard.
 */
export function useGrandRoundsLeaderboard(enabled = true) {
  const { isSignedIn, getToken } = useAuth();

  return useQuery<LeaderboardEntry[]>({
    queryKey: queryKeys.grandRounds.leaderboard(),
    queryFn: async () => {
      const json = await authedFetch<{ leaderboard?: unknown[] }>(
        getToken,
        '/api/grand-rounds/leaderboard?limit=20',
      );
      const list = json?.leaderboard ?? [];
      return (Array.isArray(list) ? list : []) as LeaderboardEntry[];
    },
    enabled: !!isSignedIn && enabled,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch review/rationales for a completed Grand Rounds challenge.
 */
export function useGrandRoundsReview(challengeId: string | null, enabled = true) {
  const { isSignedIn, getToken } = useAuth();

  return useQuery<ReviewEntry[]>({
    queryKey: queryKeys.grandRounds.review(challengeId ?? ''),
    queryFn: async () => {
      if (!challengeId) return [];
      const json = await authedFetch<{ review?: unknown[] }>(
        getToken,
        `/api/grand-rounds/review?challengeId=${encodeURIComponent(challengeId)}`,
      );
      const list = json?.review ?? [];
      return (Array.isArray(list) ? list : []) as ReviewEntry[];
    },
    enabled: !!isSignedIn && enabled && !!challengeId,
    staleTime: Infinity, // Review data never changes
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Submit answers for Grand Rounds challenge.
 */
export function useSubmitGrandRounds() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<SubmissionResult, Error, { challengeId: string; answers: Record<string, number>; timeSpentMs: number }>({
    mutationFn: (payload) =>
      authedFetch<SubmissionResult>(getToken, '/api/grand-rounds/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // Challenge is now completed — refetch today's data and leaderboard
      queryClient.invalidateQueries({ queryKey: queryKeys.grandRounds.today() });
      queryClient.invalidateQueries({ queryKey: queryKeys.grandRounds.leaderboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}

/**
 * Submit answer for Targeted Daily question.
 */
export function useSubmitTargetedDaily() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<
    { success: boolean; stats: { correctCount: number; totalQuestions: number; timeSpentMs: number } },
    Error,
    { answerIndex: number; timeSpentMs: number }
  >({
    mutationFn: (payload) =>
      authedFetch(getToken, '/api/targeted-daily/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.targetedDaily.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}
