/**
 * API client for authenticated requests.
 * Re-exports API config and provides fetchWithAuth for bearer token requests.
 */

import {
  API_ENDPOINTS as CONFIG_ENDPOINTS,
  getApiEndpoint,
  getApiBaseUrl,
} from './utils/apiConfig';
import { withTraceHeaders, getResponseTraceId } from './utils/traceHeaders';
import { setLastApiTraceId } from './utils/lastTraceId';

export const API_ENDPOINTS = {
  ...CONFIG_ENDPOINTS,
  SYSTEM_PERFORMANCE: '/api/user/analytics',
} as const;

/**
 * Fetch with Authorization Bearer token.
 * Uses getApiBaseUrl() + path for full URL in browser; path-only for relative.
 *
 * Every outgoing request gets an `X-Request-ID` header so the edge function
 * `resolveRequestId()` reuses the same id throughout request_start logs,
 * response envelope body, and X-Trace-ID response header. This is how a
 * single Sentry event can be correlated back to one edge log line.
 */
export async function fetchWithAuth(
  pathOrKey: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const url = pathOrKey.startsWith('/')
    ? `${getApiBaseUrl()}${pathOrKey}`
    : getApiEndpoint(pathOrKey);
  const { headers } = withTraceHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...init?.headers,
  });
  const response = await fetch(url, {
    ...init,
    headers,
  });
  // Capture the server trace id so error surfaces can show it alongside any
  // client-generated error id. Happens on both ok and error responses.
  setLastApiTraceId(getResponseTraceId(response));
  return response;
}
