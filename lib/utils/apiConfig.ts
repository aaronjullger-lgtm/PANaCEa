/**
 * API Configuration Utility
 *
 * Provides consistent API URL resolution across client and server contexts.
 * Centralizes configuration to avoid duplication and maintenance issues.
 */

/**
 * Get the API base URL for backend requests
 * Works in both browser and server environments
 *
 * @returns The API base URL (e.g., "http://localhost:3001" or production URL)
 */
export function getApiUrl(): string {
  // Browser environment
  if (typeof window !== 'undefined') {
    // Use VITE_API_URL if provided, otherwise default to empty string
    // to use relative paths (which works with Vite proxy and Cloudflare)
    return (import.meta as any).env?.VITE_API_URL || '';
  }

  // Server/Node environment
  if (typeof process !== 'undefined') {
    return process.env.VITE_API_URL || 'http://localhost:3001';
  }

  // Fallback
  return '';
}

/**
 * Get the full API endpoint URL
 *
 * @param path - The API endpoint path (e.g., "/api/content/all")
 * @returns The complete URL
 */
export function getApiEndpoint(path: string): string {
  const baseUrl = getApiUrl();
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Common API endpoints
 */
export const API_ENDPOINTS = {
  CONTENT_ALL: '/api/content/all',
  // Note: Deployed via Cloudflare Functions at /api/content/condition/:conditionId
  CONTENT_BY_ID: (id: string) => `/api/content/condition/${id}`,
  CONTENT_SEARCH: '/api/content/search',
  CONTENT_BY_SYSTEM: (system: string) => `/api/content/system/${system}`,
  BUZZWORDS_ALL: '/api/buzzwords/all',
  SYNC: '/api/sync',
  DRUGS_ALL: '/api/drugs',
  LABS_TESTS: '/api/labs/tests',
  LABS_CASES: '/api/labs/cases',
  LABS_CASES_RANDOM: (count: number) => `/api/labs/cases/random?count=${count}`,
  GEMINI_PROXY: '/geminiProxy',
  // Question pool and curation endpoints
  QUESTIONS_POOL: '/api/questions/pool',
  QUESTIONS_POOL_STATUS: '/api/questions/pool-status',
  QUESTIONS_CURATE: '/api/questions/curate',
  // DDx training endpoint
  DDX_GENERATE: '/api/ddx/generate',
} as const;
