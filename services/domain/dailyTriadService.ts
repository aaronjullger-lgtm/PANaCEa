import { getApiEnvelopeError, unwrapApiEnvelope } from '@/lib/utils/apiEnvelope';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DailyTriad {
  /** Canonical condition identifier from MedicalContent */
  conditionId: string;

  /** Name of the condition (e.g., "Acute Myocardial Infarction") */
  condition: string;

  /** Key clinical highlight or teaching point */
  highlight: string;

  /** Type of triad entry */
  type: 'gold_standard' | 'clinical_pearl';

  /** Organ system (e.g., "Cardiovascular") */
  system: string;

  /** Subcategory within system (optional) */
  subcategory: string | null;

  /** PANCE exam yield percentage (if applicable) */
  panceYield: number | null;

  /** Key buzzwords for pattern recognition */
  buzzwords: string[];

  /** Source reference (e.g., "AAPA Guidelines 2025") */
  source: 'database';

  /** Last source update timestamp */
  updatedAt: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch today's daily triad
 *
 * The server rotates triads based on:
 * 1. User's weakest organ systems (personalized)
 * 2. High-yield PANCE content
 * 3. Daily rotation to ensure variety
 *
 * @returns Promise resolving to today's DailyTriad
 * @throws Error if fetch fails
 */
export async function fetchDailyTriad(signal?: AbortSignal): Promise<DailyTriad> {
  const response = await fetch('/api/dashboard/daily-triad', { signal });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(getApiEnvelopeError(errorPayload, 'Failed to fetch daily triad'));
  }

  return unwrapApiEnvelope<DailyTriad>(await response.json());
}

/**
 * Fetch daily triad with authentication (for personalized selection)
 *
 * @param token - Authentication token
 * @returns Promise resolving to personalized DailyTriad
 */
export async function fetchPersonalizedTriad(token: string): Promise<DailyTriad> {
  const response = await fetch('/api/dashboard/daily-triad', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(getApiEnvelopeError(errorPayload, 'Failed to fetch personalized triad'));
  }

  return unwrapApiEnvelope<DailyTriad>(await response.json());
}

/**
 * Mark today's triad as reviewed
 *
 * @param token - Authentication token
 * @returns Promise resolving when review is logged
 */
export async function markTriadReviewed(token: string): Promise<void> {
  const response = await fetch('/api/dashboard/daily-triad/review', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(getApiEnvelopeError(errorPayload, 'Failed to mark triad as reviewed'));
  }
}
