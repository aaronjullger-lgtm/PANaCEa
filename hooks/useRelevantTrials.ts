/**
 * useRelevantTrials — Fetch clinical trials for a condition
 *
 * Non-blocking hook that fetches relevant Phase III/IV trials from
 * ClinicalTrials.gov for display in the ExplanationPanel.
 * Silently no-ops on failure (clinical trials are supplementary content).
 *
 * @see lib/services/question/trialEnricher.ts
 */

import { useState, useEffect } from 'react';
import {
  fetchRelevantTrials,
  type ClinicalTrialSummary,
} from '@/lib/services/question/trialEnricher';

interface UseRelevantTrialsReturn {
  trials: ClinicalTrialSummary[];
  isLoading: boolean;
}

export function useRelevantTrials(
  condition: string | undefined,
  system?: string
): UseRelevantTrialsReturn {
  const [trials, setTrials] = useState<ClinicalTrialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!condition || condition.length < 3) {
      setTrials([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchRelevantTrials(condition, system)
      .then((results) => {
        if (!cancelled) {
          setTrials(results);
        }
      })
      .catch(() => {
        // Silently fail — non-critical feature
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [condition, system]);

  return { trials, isLoading };
}
