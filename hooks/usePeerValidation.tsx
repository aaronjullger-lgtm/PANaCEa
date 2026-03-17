/**
 * usePeerValidation Hook
 *
 * Fetches "Wisdom of the Crowds" data for incorrect answers.
 * Shows: "73% of users also missed this" in explanation view.
 */

import { useEffect, useState } from 'react';
import { API_ENDPOINTS } from '@/lib/utils/apiConfig';

interface QuestionStatistics {
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  percentageMissed: number; // percentage of users who missed this question (i.e., got it wrong)
  percentageCorrect: number;
}

export function usePeerValidation(questionId: string, wasCorrect: boolean) {
  const [data, setData] = useState<QuestionStatistics | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wasCorrect || !questionId) return;

    setLoading(true);
    fetch(API_ENDPOINTS.QUESTION_STATISTICS(questionId))
      .then(res => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.data) {
          setData(json.data);
        } else {
          throw new Error('Invalid response format');
        }
      })
      .catch((err) => {
        console.warn('[usePeerValidation] Failed to fetch question statistics:', err);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [questionId, wasCorrect]);

  return { data, loading };
}

// React component for explanation view
export function PeerValidationBadge({
  peerData
}: {
  peerData: QuestionStatistics | null;
}) {
  if (!peerData) return null;

  const { percentageMissed, totalAttempts } = peerData;

  // Only show if there are enough attempts and percentageMissed is meaningful
  if (totalAttempts < 5) return null;

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 mt-4">
      <p className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">{percentageMissed}%</span> of users also missed this question
        <span className="text-xs text-text-muted ml-2">({totalAttempts} total attempts)</span>
      </p>
    </div>
  );
}
