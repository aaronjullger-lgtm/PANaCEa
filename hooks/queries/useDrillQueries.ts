/**
 * TanStack Query hooks wrapping the Drills SDK client.
 *
 * Provides useMutation for drill review submission with automatic
 * cache invalidation of related queries.
 *
 * @module hooks/queries/useDrillQueries
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';
import { createDrillsClient } from '@/lib/sdk/drillsClient';
import { queryKeys } from '@/lib/queryKeys';
import type { DrillSubmitPayload, DrillSubmitResult } from '@/lib/sdk/types';

function useDrillsClient() {
  const { getToken } = useAuth();
  return createDrillsClient(createApiClient(getToken));
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useDrillSubmitReview() {
  const queryClient = useQueryClient();
  const client = useDrillsClient();

  return useMutation<DrillSubmitResult, Error, DrillSubmitPayload>({
    mutationFn: (payload) => client.submitReview(payload),
    onSuccess: () => {
      // After a drill submission, refresh stats and due queue
      queryClient.invalidateQueries({ queryKey: queryKeys.user.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.srs.due() });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.dueQueue() });
    },
  });
}
