/**
 * useAnswerDistribution — Fetches peer answer distribution for a question.
 *
 * Call after the student submits an answer to show "X% of peers also chose Y".
 * Only returns data when ≥10 students have attempted the question (privacy).
 *
 * @see functions/api/analytics/answer-distribution.ts
 * @see components/session/AnswerFeedback.tsx
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getApiEndpoint } from '@/lib/utils/apiConfig';

export interface AnswerDistributionEntry {
  optionLetter: string;
  count: number;
  percent: number;
}

export interface AnswerDistributionData {
  distribution: AnswerDistributionEntry[] | null;
  totalAttempts: number;
}

export function useAnswerDistribution() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AnswerDistributionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDistribution = useCallback(
    async (questionId: string) => {
      if (!questionId) return;

      try {
        setIsLoading(true);
        setData(null);
        const token = await getToken();
        if (!token) return;

        const endpoint = getApiEndpoint(
          `/api/analytics/answer-distribution?questionId=${encodeURIComponent(questionId)}`
        );
        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const json = await response.json();
        if (json?.data) {
          setData(json.data);
        }
      } catch {
        // Non-critical — silently fail, peer stats are optional
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  const reset = useCallback(() => {
    setData(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, fetchDistribution, reset };
}
