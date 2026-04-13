/**
 * Trial Enricher — Clinical Trials in Explanations
 *
 * Queries the ClinicalTrials.gov API (v2) for relevant Phase III/IV trials
 * related to the current question's condition. Provides active research
 * context in the explanation panel.
 *
 * Uses client-side caching to avoid redundant API calls within a session.
 *
 * ClinicalTrials.gov API v2 docs: https://clinicaltrials.gov/data-api/about-api
 *
 * @see components/panels/ExplanationPanel.tsx
 */

import { logger } from '../../logger';

const LOG_SCOPE = 'TrialEnricher';

export interface ClinicalTrialSummary {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  conditions: string[];
  interventions: string[];
  startDate?: string;
  url: string;
}

interface CTGovStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
    };
    designModule?: {
      phases?: string[];
    };
    conditionsModule?: {
      conditions?: string[];
    };
    armsInterventionsModule?: {
      interventions?: Array<{ name?: string; type?: string }>;
    };
  };
}

interface CTGovResponse {
  studies?: CTGovStudy[];
  totalCount?: number;
}

// In-memory session cache to avoid redundant API calls
const trialCache = new Map<string, { trials: ClinicalTrialSummary[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Search ClinicalTrials.gov for relevant Phase III/IV trials.
 * Returns up to 3 trials for display in the explanation panel.
 *
 * @param condition - The condition name (e.g., "Heart Failure", "COPD")
 * @param system - Optional PANCE system for fallback search
 * @returns Array of trial summaries, or empty array on failure
 */
export async function fetchRelevantTrials(
  condition: string,
  system?: string
): Promise<ClinicalTrialSummary[]> {
  if (!condition || condition.length < 3) return [];

  // Check cache
  const cacheKey = `${condition}|${system || ''}`;
  const cached = trialCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.trials;
  }

  try {
    // ClinicalTrials.gov API v2 — search for Phase 3/4 trials
    const query = encodeURIComponent(condition);
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${query}&filter.phase=PHASE3,PHASE4&filter.overallStatus=RECRUITING,ACTIVE_NOT_RECRUITING,COMPLETED&sort=LastUpdatePostDate:desc&pageSize=5&fields=NCTId,BriefTitle,OverallStatus,Phase,Condition,InterventionName,StartDate`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5s timeout — non-critical feature
    });

    if (!response.ok) {
      logger.warn(LOG_SCOPE, `ClinicalTrials.gov API returned ${response.status}`);
      return [];
    }

    const data = (await response.json()) as CTGovResponse;
    const studies = data.studies || [];

    const trials: ClinicalTrialSummary[] = studies
      .slice(0, 3)
      .map((study) => {
        const proto = study.protocolSection;
        const nctId = proto?.identificationModule?.nctId || '';
        return {
          nctId,
          title: proto?.identificationModule?.briefTitle || 'Untitled Study',
          status: proto?.statusModule?.overallStatus || 'Unknown',
          phase: (proto?.designModule?.phases || []).join(', ') || 'Unknown',
          conditions: proto?.conditionsModule?.conditions || [],
          interventions: (proto?.armsInterventionsModule?.interventions || [])
            .map((i) => i.name || '')
            .filter(Boolean)
            .slice(0, 3),
          startDate: proto?.statusModule?.startDateStruct?.date,
          url: `https://clinicaltrials.gov/study/${nctId}`,
        };
      })
      .filter((t) => t.nctId);

    // Cache result
    trialCache.set(cacheKey, { trials, timestamp: Date.now() });
    return trials;
  } catch (err) {
    // Non-critical: silently fail — don't disrupt the explanation panel
    logger.warn(LOG_SCOPE, 'Failed to fetch trials', err);
    return [];
  }
}

/** Clear the trial cache (useful for testing) */
export function clearTrialCache(): void {
  trialCache.clear();
}

/**
 * Format a trial status for display.
 * Maps API status codes to user-friendly labels.
 */
export function formatTrialStatus(status: string): { label: string; color: string } {
  switch (status) {
    case 'RECRUITING':
      return { label: 'Recruiting', color: 'var(--color-data-pass)' };
    case 'ACTIVE_NOT_RECRUITING':
      return { label: 'Active', color: 'var(--color-accent)' };
    case 'COMPLETED':
      return { label: 'Completed', color: 'var(--color-text-muted)' };
    default:
      return { label: status, color: 'var(--color-text-muted)' };
  }
}
