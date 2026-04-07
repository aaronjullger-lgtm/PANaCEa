/**
 * TanStack Query hooks wrapping the User SDK client.
 *
 * Provides useQuery hooks for profile, stats, and FSRS params,
 * plus a useMutation hook for updating preferences.
 *
 * @module hooks/queries/useUserQueries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';
import { createUserClient } from '@/lib/sdk/userClient';
import { queryKeys } from '@/lib/queryKeys';
import type { UserProfile, UserStats, FSRSParams } from '@/lib/sdk/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function useUserClient() {
  const { getToken } = useAuth();
  return createUserClient(createApiClient(getToken));
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useUserProfile() {
  const { isSignedIn } = useAuth();
  const client = useUserClient();

  return useQuery<UserProfile>({
    queryKey: queryKeys.user.profile(),
    queryFn: () => client.getProfile(),
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 5, // 5 min — profile rarely changes mid-session
  });
}

export function useUserStats() {
  const { isSignedIn } = useAuth();
  const client = useUserClient();

  return useQuery<UserStats>({
    queryKey: queryKeys.user.stats(),
    queryFn: () => client.getStats(),
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 2, // 2 min — stats change after each question
  });
}

export function useUserFSRSParams() {
  const { isSignedIn } = useAuth();
  const client = useUserClient();

  return useQuery<FSRSParams>({
    queryKey: queryKeys.user.fsrsParams(),
    queryFn: () => client.getFSRSParams(),
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 15, // 15 min — params change only after optimizer cron
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  const client = useUserClient();

  return useMutation({
    mutationFn: (prefs: Record<string, unknown>) => client.updatePreferences(prefs),
    onSuccess: () => {
      // Invalidate profile since preferences affect it
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
    },
  });
}
