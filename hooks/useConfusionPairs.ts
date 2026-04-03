/**
 * useConfusionPairs — Fetches top confusion pairs for the current user.
 *
 * Returns conditions the student frequently confuses, sorted by frequency.
 * Used by ConfusionPairCard on the dashboard for targeted drill suggestions.
 *
 * @see functions/api/analytics/confusion-pairs.ts
 * @see components/dashboard/ConfusionPairCard.tsx
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export interface ConfusionPairData {
  id: string;
  correctConditionId: string;
  selectedConditionId: string;
  system: string | null;
  frequency: number;
  lastSeen: string;
  /** Resolved condition names (if available from API) */
  correctConditionName?: string;
  selectedConditionName?: string;
}

export interface ConfusionPairsResult {
  confusionPairs: ConfusionPairData[];
  total: number;
}

export function useConfusionPairs(limit: number = 10) {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<ConfusionPairsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchPairs() {
      try {
        setIsLoading(true);
        const token = await getToken();
        if (!token) return;

        const endpoint = getApiEndpoint(`/api/analytics/confusion-pairs?limit=${limit}`);
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(`Confusion pairs fetch failed: ${response.status}`);
        }

        const json = await response.json();
        if (json?.data?.success) {
          setData({
            confusionPairs: json.data.confusionPairs,
            total: json.data.total,
          });
        }
      } catch (err) {
        console.warn('[useConfusionPairs] Failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPairs();
  }, [isSignedIn, getToken, limit]);

  return { data, isLoading, error };
}
