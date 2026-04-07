/**
 * TanStack Query hooks wrapping the SRS SDK client.
 *
 * Provides useQuery for due items and useMutation for review submission.
 *
 * @module hooks/queries/useSrsQueries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';
import { createSrsClient } from '@/lib/sdk/srsClient';
import { queryKeys } from '@/lib/queryKeys';
import type { SRSDueResult, SRSSubmitPayload } from '@/lib/sdk/types';

function useSrsClient() {
  const { getToken } = useAuth();
  return createSrsClient(createApiClient(getToken));
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useSrsDueItems() {
  const { isSignedIn } = useAuth();
  const client = useSrsClient();

  return useQuery<SRSDueResult>({
    queryKey: queryKeys.srs.due(),
    queryFn: () => client.getDueItems(),
    enabled: !!isSignedIn,
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useSrsSubmitReview() {
  const queryClient = useQueryClient();
  const client = useSrsClient();

  return useMutation({
    mutationFn: (payload: SRSSubmitPayload) => client.submitReview(payload),
    onSuccess: () => {
      // Refresh due queue and user stats after submitting a review
      queryClient.invalidateQueries({ queryKey: queryKeys.srs.due() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
    },
  });
}
