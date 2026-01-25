/**
 * API Configuration Utility
 * Stub implementation for test environment
 */

export const API_ENDPOINTS = {
  CONTENT_ALL: '/api/content/all',
  CONDITIONS: '/api/conditions',
  QUESTIONS: '/api/questions',
  QUESTIONS_POOL: '/api/questions/pool',
  QUESTIONS_CURATE: '/api/questions/curate',
  LAB_TESTS: '/api/labtests',
  LAB_CASES: '/api/labcases',
  LAB_CASES_RANDOM: (count: number) => `/api/labcases/random/${count}`,
  IMAGING: '/api/imaging',
  DRUGS: '/api/drugs',
  GEMINI_PROXY: '/api/gemini',
  DDX_GENERATE: '/api/ddx/generate',
  SESSIONS: '/api/sessions',
  REVIEWS: '/api/reviews',
} as const;

export type ApiEndpoint = keyof typeof API_ENDPOINTS;

/**
 * Get full API endpoint URL
 * In production, this would include the full domain
 * In development/test, returns relative paths
 */
export function getApiEndpoint(endpoint: ApiEndpoint | string): string {
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
