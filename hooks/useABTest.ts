/**
 * useABTest — React hook for client-side A/B test feature flags.
 *
 * Fetches the user's active experiment assignments from the server
 * and returns a typed map of experimentId → variant.
 *
 * The assignments are stable per-user (deterministic hash) and cached
 * via TanStack Query (5-minute stale time) to avoid refetching on every render.
 */

import { useQuery } from '@tanstack/react-query';
import { unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export interface ABVariantAssignment {
  variantName: string;
  config: Record<string, unknown>;
}

export type ABAssignmentMap = Record<string, ABVariantAssignment>;

interface ABAssignmentsResponse {
  assignments: ABAssignmentMap;
}

/**
 * Fetch A/B test assignments for the current user.
 */
export function useABTest(getToken?: () => Promise<string | null>) {
  return useQuery<ABAssignmentMap>({
    queryKey: ['ab-assignments'],
    queryFn: async (): Promise<ABAssignmentMap> => {
      const token = getToken ? await getToken() : null;
      const res = await fetch('/api/users/me/ab-assignments', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return {};
      const data = unwrapApiEnvelope<ABAssignmentsResponse>(await res.json());
      return data.assignments ?? {};
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — assignments don't change mid-session
    retry: 1,
  });
}
