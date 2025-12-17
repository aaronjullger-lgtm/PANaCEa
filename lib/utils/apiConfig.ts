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
    return (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
  }
  
  // Server/Node environment
  if (typeof process !== 'undefined') {
    return process.env.VITE_API_URL || 'http://localhost:3001';
  }
  
  // Fallback
  return 'http://localhost:3001';
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
} as const;
