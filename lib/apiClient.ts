/**
 * API client for authenticated requests.
 * Re-exports API config and provides fetchWithAuth for bearer token requests.
 */

import {
  API_ENDPOINTS as CONFIG_ENDPOINTS,
  getApiEndpoint,
  getApiBaseUrl,
} from './utils/apiConfig';

export const API_ENDPOINTS = {
  ...CONFIG_ENDPOINTS,
  SYSTEM_PERFORMANCE: '/api/user/analytics',
} as const;

/**
 * Fetch with Authorization Bearer token.
 * Uses getApiBaseUrl() + path for full URL in browser; path-only for relative.
 */
export async function fetchWithAuth(
  pathOrKey: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const url = pathOrKey.startsWith('/') ? `${getApiBaseUrl()}${pathOrKey}` : getApiEndpoint(pathOrKey);
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}
