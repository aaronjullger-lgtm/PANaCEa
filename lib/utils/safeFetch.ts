/**
 * Safe Fetch Utilities
 * Provides wrapper functions around fetch with content-type validation,
 * single-read protection, and consistent error handling.
 *
 * Pattern:
 * - Always validate content-type before parsing JSON
 * - Never call response.json() more than once
 * - Use getApiEndpoint for API paths
 */

import { getApiEndpoint } from './apiConfig';

/**
 * Wraps fetch to ensure content-type is application/json before parsing.
 * Returns the Response object after validation.
 * If the response is not JSON, throws an error with the content-type.
 */
export async function safeFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON but got ${contentType}`);
  }
  return response;
}

/**
 * Safely fetches and parses JSON, ensuring single read and proper error handling.
 * Returns the parsed data.
 * If the response is not ok, throws an error with the parsed error message if available.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await safeFetch(input, init);
  const text = await response.text();
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If not JSON, use text as error message
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetches from an API endpoint using getApiEndpoint to construct the URL.
 * Automatically adds authorization header if token is provided.
 */
export async function apiFetch(
  endpoint: string,
  options?: {
    token?: string;
    init?: RequestInit;
  }
): Promise<Response> {
  const url = getApiEndpoint(endpoint);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options?.token && { Authorization: `Bearer ${options.token}` }),
    ...options?.init?.headers,
  };
  const init: RequestInit = {
    ...options?.init,
    headers,
  };
  return safeFetch(url, init);
}

/**
 * Fetches JSON from an API endpoint using getApiEndpoint.
 * Returns parsed data.
 */
export async function apiFetchJson<T = any>(
  endpoint: string,
  options?: {
    token?: string;
    init?: RequestInit;
  }
): Promise<T> {
  const response = await apiFetch(endpoint, options);
  const text = await response.text();
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(text);
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper to read a response body only once and cache it.
 * Monkey-patches response.json to prevent accidental double reads.
 * Use with caution.
 */
export function protectResponseFromDoubleRead(response: Response): Response {
  let bodyUsed = false;
  let textPromise: Promise<string> | null = null;
  const originalJson = response.json;
  const originalText = response.text;

  response.json = async function () {
    if (bodyUsed) {
      throw new Error('Response body already read');
    }
    bodyUsed = true;
    if (!textPromise) {
      textPromise = originalText.call(this);
    }
    const text = await textPromise;
    return JSON.parse(text);
  };

  response.text = async function () {
    if (bodyUsed) {
      throw new Error('Response body already read');
    }
    bodyUsed = true;
    if (!textPromise) {
      textPromise = originalText.call(this);
    }
    return textPromise;
  };

  return response;
}