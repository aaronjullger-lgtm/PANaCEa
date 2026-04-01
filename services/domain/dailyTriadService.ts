/**
 * Daily Triad Service
 *
 * Provides one "Gold Standard" or "Clinical Pearl" condition per day.
 * Helps users build systematic knowledge by focusing on high-yield content.
 *
 * @architecture Database-First: Triads stored in PostgreSQL, rotated daily
 * @integration Used by components/dashboard/DailyTriad.tsx
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DailyTriad {
  /** Name of the condition (e.g., "Acute Myocardial Infarction") */
  condition: string;

  /** Key clinical highlight or teaching point */
  highlight: string;

  /** Type of triad entry */
  type: 'gold_standard' | 'clinical_pearl';

  /** Organ system (e.g., "Cardiovascular") */
  system: string;

  /** Subcategory within system (optional) */
  subcategory?: string;

  /** PANCE exam yield percentage (if applicable) */
  panceYield?: number;

  /** Key buzzwords for pattern recognition */
  buzzwords: string[];

  /** Source reference (e.g., "AAPA Guidelines 2025") */
  source: string;
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
export async function fetchDailyTriad(): Promise<DailyTriad> {
  const response = await fetch('/api/dashboard/daily-triad');

  if (!response.ok) {
    throw new Error(`Failed to fetch daily triad: ${response.statusText}`);
  }

  const data = await response.json() as DailyTriad;
  return data;
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
    throw new Error(`Failed to fetch personalized triad: ${response.statusText}`);
  }

  const data = await response.json() as DailyTriad;
  return data;
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
    throw new Error(`Failed to mark triad as reviewed: ${response.statusText}`);
  }
}
