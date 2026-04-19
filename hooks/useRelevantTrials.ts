/**
 * useRelevantTrials — Fetch clinical trials for a condition
 *
 * Non-blocking hook that fetches relevant Phase III/IV trials from
 * ClinicalTrials.gov for display in the ExplanationPanel.
 *
 * Exposes both the trials array *and* a typed failure state so the UI can
 * distinguish "no trials found for this condition" from "the evidence service
 * is unavailable". PA students must never see a silently-empty references
 * section when the underlying API is down — that violates PANaCEa's safety
 * mandate that medical sections be complete or visibly marked incomplete.
 *
 * @see lib/services/question/trialEnricher.ts
 * @see lib/services/enrichment/enrichmentResult.ts
 */

import { useState, useEffect } from 'react';
import {
  fetchRelevantTrialsResult,
  type ClinicalTrialSummary,
} from '@/lib/services/question/trialEnricher';
import type { EnrichmentFailed } from '@/lib/services/enrichment/enrichmentResult';

interface UseRelevantTrialsReturn {
  trials: ClinicalTrialSummary[];
  isLoading: boolean;
  /** Populated when the upstream service failed; null on success. */
  failure: EnrichmentFailed | null;
}

export function useRelevantTrials(
  condition: string | undefined,
  system?: string
): UseRelevantTrialsReturn {
  const [trials, setTrials] = useState<ClinicalTrialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [failure, setFailure] = useState<EnrichmentFailed | null>(null);

  useEffect(() => {
    if (!condition || condition.length < 3) {
      setTrials([]);
      setFailure(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setFailure(null);

    fetchRelevantTrialsResult(condition, system)
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'ok') {
          setTrials(result.data);
          setFailure(null);
        } else {
          setTrials([]);
          setFailure(result);
        }
      })
      .catch(() => {
        // fetchRelevantTrialsResult never throws, but be defensive.
        if (!cancelled) {
          setTrials([]);
          setFailure({
            status: 'failed',
            reason: 'unknown',
            message: 'Unexpected error',
            failedAt: new Date().toISOString(),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [condition, system]);

  return { trials, isLoading, failure };
}
