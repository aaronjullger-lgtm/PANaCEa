/**
 * useBlueprintGaps — Fetches blueprint gap analysis from the API.
 *
 * Returns per-system data comparing actual study distribution against
 * the NCCPA 2025 PANCE Blueprint target weights.
 *
 * @see functions/api/analytics/blueprint-gaps.ts
 * @see components/dashboard/BlueprintGapHeatmap.tsx
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';
import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

export interface BlueprintGapSystem {
  system: string;
  targetPercent: number;
  actualPercent: number;
  gapPercent: number;
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
}

export interface BlueprintGapsData {
  systems: BlueprintGapSystem[];
  totalAttempts: number;
  coverageScore: number;
}

export function useBlueprintGaps() {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<BlueprintGapsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchGaps() {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) return;

        const endpoint = getApiEndpoint('/api/analytics/blueprint-gaps');
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(
            getApiEnvelopeError(errorPayload, `Blueprint gaps fetch failed: ${response.status}`)
          );
        }

        setData(unwrapApiEnvelope<BlueprintGapsData>(await response.json()));
      } catch (err) {
        console.warn('[useBlueprintGaps] Failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchGaps();
  }, [isSignedIn, getToken]);

  return { data, isLoading, error };
}
