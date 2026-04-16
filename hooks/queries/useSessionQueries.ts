/**
 * TanStack Query hooks wrapping the Sessions SDK client.
 *
 * Provides useMutation for session generation.
 *
 * @module hooks/queries/useSessionQueries
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';
import { createSessionsClient } from '@/lib/sdk/sessionsClient';
import { queryKeys } from '@/lib/queryKeys';
import type { SessionGeneratePayload } from '@/lib/sdk/types';
import {
  normalizeSessionGenerateResult,
  type NormalizedSessionGenerateResult,
} from '@/lib/sessionGeneration';

function useSessionsClient() {
  const { getToken } = useAuth();
  return createSessionsClient(createApiClient(getToken));
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useGenerateSession() {
  const queryClient = useQueryClient();
  const client = useSessionsClient();

  return useMutation<NormalizedSessionGenerateResult, Error, SessionGeneratePayload | undefined>({
    mutationFn: async (opts) => normalizeSessionGenerateResult(await client.generate(opts)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.current() });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.reservoir() });
    },
  });
}
