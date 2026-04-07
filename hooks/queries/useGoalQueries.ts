/**
 * TanStack Query hooks for User Goals CRUD.
 *
 * Replaces the manual fetch + useState pattern in GoalsDashboard
 * with proper caching, automatic refetch on filter change, and
 * optimistic-ready mutations.
 *
 * @module hooks/queries/useGoalQueries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { queryKeys } from '@/lib/queryKeys';

// Re-export the type so consumers don't need a second import
export interface UserGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  goalType: 'daily' | 'weekly' | 'exam_date' | 'mastery';
  targetValue?: number;
  targetUnit?: 'questions' | 'minutes' | 'conditions' | 'accuracy';
  targetDate?: string;
  targetSystem?: string;
  targetStability?: number;
  currentValue: number;
  progressPercentage: number;
  status: 'active' | 'completed' | 'paused' | 'failed';
  isRecurring: boolean;
  milestones?: Array<{ value: number; reached: boolean; date?: string }>;
  currentStreak: number;
  bestStreak: number;
  lastMetDate?: string;
  motivationNotes?: string;
  rewardMessage?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface GoalFilters {
  status?: string;
  type?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function authedFetch<T>(
  getToken: () => Promise<string | null>,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useGoals(filters: GoalFilters = {}) {
  const { isSignedIn, getToken } = useAuth();

  return useQuery<UserGoal[]>({
    queryKey: queryKeys.user.goals(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.type && filters.type !== 'all') params.append('goalType', filters.type);

      const data = await authedFetch<{ goals?: UserGoal[] }>(
        getToken,
        `/api/user/goals?${params.toString()}`,
      );
      return data.goals ?? [];
    },
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 2,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (goalData: Partial<UserGoal>) =>
      authedFetch<UserGoal>(getToken, '/api/user/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.goals() });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: ({ goalId, updates }: { goalId: string; updates: Partial<UserGoal> }) =>
      authedFetch<UserGoal>(getToken, `/api/user/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.goals() });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation({
    mutationFn: (goalId: string) =>
      authedFetch<{ success: boolean }>(getToken, `/api/user/goals/${goalId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.goals() });
    },
  });
}
