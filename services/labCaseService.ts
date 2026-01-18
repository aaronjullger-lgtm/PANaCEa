/**
 * Lab Case Service
 *
 * Fetches lab cases from the database API for Mini Lab Drill mode.
 * Follows the Database-First architecture - no static fallbacks.
 */

import type { LabCase, LabCategory } from '@/hooks/game/use-mini-lab-drill';

interface LabCasesResponse {
  success: boolean;
  cases: LabCase[];
  total: number;
  error?: string;
}

interface DiagnosesResponse {
  success: boolean;
  diagnoses: string[];
  error?: string;
}

/**
 * Fetch lab cases from the database
 */
export async function fetchLabCases(
  category?: LabCategory,
  limit: number = 20,
  token?: string | null
): Promise<LabCase[]> {
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  // In tests/offline mode, skip network to avoid invalid URL errors (hook will fall back to static cases)
  if (isTestEnv) {
    return [];
  }

  const params = new URLSearchParams();
  if (category && category !== 'random') {
    params.set('category', category);
  }
  params.set('limit', limit.toString());
  params.set('shuffle', 'true');

  const baseUrl =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';

  const response = await fetch(`${baseUrl}/api/drills/lab-cases?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lab cases: ${response.status}`);
  }

  const data: LabCasesResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch lab cases');
  }

  return data.cases;
}

/**
 * Fetch list of valid diagnoses for autocomplete/validation
 */
export async function fetchValidDiagnoses(token?: string | null): Promise<string[]> {
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  // Tests/offline skip network; hook will fall back to static diagnoses derived from cases
  if (isTestEnv) {
    return [];
  }

  const baseUrl =
    typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';

  const response = await fetch(`${baseUrl}/api/drills/lab-cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: 'getDiagnoses' }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch diagnoses: ${response.status}`);
  }

  const data: DiagnosesResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch diagnoses');
  }

  return data.diagnoses;
}

/**
 * Cache key for localStorage
 */
const DIAGNOSES_CACHE_KEY = 'panceai_lab_diagnoses_cache';
const DIAGNOSES_CACHE_EXPIRY = 1000 * 60 * 60; // 1 hour

/**
 * Get diagnoses with caching for better UX
 */
export async function getCachedDiagnoses(token?: string | null): Promise<string[]> {
  // Try to get from cache first
  try {
    const cached = localStorage.getItem(DIAGNOSES_CACHE_KEY);
    if (cached) {
      const { diagnoses, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < DIAGNOSES_CACHE_EXPIRY) {
        return diagnoses;
      }
    }
  } catch {
    // Cache miss or invalid
  }

  // Fetch from API
  const diagnoses = await fetchValidDiagnoses(token);

  // Update cache
  try {
    localStorage.setItem(
      DIAGNOSES_CACHE_KEY,
      JSON.stringify({
        diagnoses,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Storage full, ignore
  }

  return diagnoses;
}
