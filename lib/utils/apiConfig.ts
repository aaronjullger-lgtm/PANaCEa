/**
 * API Configuration Utility
 * Stub implementation for test environment
 */

export const API_ENDPOINTS = {
  CONTENT_ALL: '/api/content/all',
  CONTENT_BY_ID: (id: string) => `/api/content/${id}`,
  CONDITIONS: '/api/conditions',
  QUESTIONS: '/api/questions',
  QUESTIONS_POOL: '/api/questions/pool',
  QUESTIONS_CURATE: '/api/questions/curate',
  LAB_TESTS: '/api/labtests',
  LAB_CASES: '/api/labcases',
  LABS_CASES: '/api/labs/cases', // Alternative naming for lab cases
  LAB_CASES_RANDOM: (count: number) => `/api/labcases/random/${count}`,
  IMAGING: '/api/imaging',
  DRUGS: '/api/drugs',
  DRUGS_ALL: '/api/drugs/all',
  GEMINI_PROXY: '/api/gemini',
  GEMINI_STREAM: '/api/gemini/stream',
  DDX_GENERATE: '/api/ddx/generate',
  SESSIONS: '/api/sessions',
  REVIEWS: '/api/reviews',
  SYNC: '/api/sync',
} as const;

export type ApiEndpoint = keyof typeof API_ENDPOINTS;

/**
 * Get full API endpoint URL
 * In production, this would include the full domain
 * In development/test, returns relative paths
 */
export function getApiEndpoint(endpoint: ApiEndpoint | string): string {
  // Defensive check for undefined/null
  if (!endpoint) {
    console.warn('[apiConfig] getApiEndpoint called with undefined/null endpoint');
    return '/api';
  }

  // If it's a known endpoint constant, use it
  if (endpoint in API_ENDPOINTS) {
    return API_ENDPOINTS[endpoint as ApiEndpoint];
  }

  // If it's already a full path, return as-is
  if (endpoint.startsWith('/') || endpoint.startsWith('http')) {
    return endpoint;
  }

  // Default: assume it's a relative API path
  return `/api/${endpoint}`;
}

/**
 * Get base API URL
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side or test environment
  return process.env.API_BASE_URL || 'http://localhost:5173';
}

/**
 * Build full API URL
 */
export function buildApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const path = getApiEndpoint(endpoint);
  return `${base}${path}`;
}
