/**
 * PANaCEa Internal SDK — Core Client
 *
 * Base HTTP client that every domain module delegates to.
 * Handles auth token injection, response envelope unwrapping,
 * error normalisation, and timeout.
 *
 * Usage:
 *   const api = createApiClient(getToken);
 *   const profile = await api.get<UserProfile>('/api/user/profile');
 *
 * @module lib/sdk/core
 */

import {
  type TokenProvider,
  type SdkClientOptions,
  type WrappedResponse,
  type ApiResult,
  ApiError,
  apiErrorToResult,
} from './types';

// ─── Defaults ─────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

/** Methods that are safe to retry (idempotent or explicitly allowed) */
const RETRYABLE_METHODS = new Set(['GET', 'PUT', 'DELETE']);

// ─── Public Interface ─────────────────────────────────────────────────────

export interface ApiClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  getResult<T>(path: string, params?: Record<string, string>): Promise<ApiResult<T>>;
  postResult<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  putResult<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  deleteResult<T>(path: string): Promise<ApiResult<T>>;
}

// ─── Factory ──────────────────────────────────────────────────────────────

/**
 * Create a typed API client that automatically injects auth and
 * normalises every response into the expected shape `T`.
 *
 * @param getToken  Clerk-compatible token provider (injected, no React coupling)
 * @param options   Optional base URL, timeout, extra headers
 */
export function createApiClient(
  getToken: TokenProvider,
  options: SdkClientOptions = {},
): ApiClient {
  const {
    baseUrl = '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    defaultHeaders = {},
    maxRetries = DEFAULT_MAX_RETRIES,
    retryablePosts = [],
  } = options;

  const retryablePostPaths = new Set(retryablePosts);

  /** Whether this request is safe to retry */
  function canRetry(method: string, path: string): boolean {
    if (RETRYABLE_METHODS.has(method)) return true;
    // POST is only retryable for explicitly allowed idempotent paths
    if (method === 'POST' && retryablePostPaths.has(path)) return true;
    return false;
  }

  /** Exponential backoff with jitter: 500ms, 1000ms, ... */
  function retryDelay(attempt: number): number {
    const base = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
    const jitter = Math.random() * base * 0.3; // ±30% jitter
    return base + jitter;
  }

  // ── Single-attempt request helper ─────────────────────────────────────

  async function singleRequest<T>(
    method: string,
    url: string,
    headers: Record<string, string>,
    fetchBody: string | undefined,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: fetchBody,
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new ApiError(0, `Request timed out after ${timeoutMs}ms`, 'TIMEOUT');
      }
      throw new ApiError(0, err.message ?? 'Network error', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
    }

    // Parse JSON
    let json: any;
    try {
      json = await res.json();
    } catch {
      if (!res.ok) {
        throw new ApiError(res.status, res.statusText || 'Request failed');
      }
      return undefined as unknown as T;
    }

    const envelopeError = extractEnvelopeError(json, res.status, res.statusText);

    // Error responses, including the production envelope { ok: false, error }.
    if (!res.ok || envelopeError) {
      const errorStatus = res.ok && envelopeError ? 400 : res.status;
      throw new ApiError(
        errorStatus,
        envelopeError?.message ?? res.statusText ?? 'Request failed',
        envelopeError?.code,
        envelopeError?.details,
      );
    }

    // Unwrap envelope
    return unwrap<T>(json);
  }

  // ── Shared request helper with retry ──────────────────────────────────

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    // 1. Build URL
    let url = `${baseUrl}${path}`;
    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    // 2. Auth token
    const token = await getToken();
    const headers: Record<string, string> = {
      ...defaultHeaders,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    // 3. Body handling
    let fetchBody: string | undefined;
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }

    // 4. Attempt with retry for transient errors
    const shouldRetry = canRetry(method, path);
    const attempts = shouldRetry ? maxRetries + 1 : 1;
    let lastError: ApiError | undefined;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await singleRequest<T>(method, url, headers, fetchBody);
      } catch (err) {
        if (!(err instanceof ApiError)) throw err;
        lastError = err;

        // Only retry transient (retryable) errors, and not on the last attempt
        const isLastAttempt = attempt >= attempts - 1;
        if (!err.isRetryable || isLastAttempt) {
          throw err;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)));
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError ?? new ApiError(0, 'Request failed after retries', 'RETRY_EXHAUSTED');
  }

  async function requestResult<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<ApiResult<T>> {
    try {
      const data = await request<T>(method, path, body, params);
      return { ok: true, data };
    } catch (error) {
      return apiErrorToResult(error);
    }
  }

  // ── Public methods ─────────────────────────────────────────────────────

  return {
    get<T>(path: string, params?: Record<string, string>) {
      return request<T>('GET', path, undefined, params);
    },
    post<T>(path: string, body?: unknown) {
      return request<T>('POST', path, body);
    },
    put<T>(path: string, body?: unknown) {
      return request<T>('PUT', path, body);
    },
    delete<T>(path: string) {
      return request<T>('DELETE', path);
    },
    getResult<T>(path: string, params?: Record<string, string>) {
      return requestResult<T>('GET', path, undefined, params);
    },
    postResult<T>(path: string, body?: unknown) {
      return requestResult<T>('POST', path, body);
    },
    putResult<T>(path: string, body?: unknown) {
      return requestResult<T>('PUT', path, body);
    },
    deleteResult<T>(path: string) {
      return requestResult<T>('DELETE', path);
    },
  };
}

// ─── Envelope Unwrapping ──────────────────────────────────────────────────

/**
 * Normalise the three server response shapes into plain `T`:
 *   1. { data: T }                → T
 *   2. { success: true, data: T } → T
 *   3. bare T                     → T
 */
function unwrap<T>(json: unknown): T {
  if (json === null || json === undefined) return json as unknown as T;
  if (typeof json !== 'object') return json as unknown as T;

  const obj = json as WrappedResponse;

  // Production shape: { ok: true, data: T }
  if ('ok' in obj && obj.ok === true && 'data' in obj) {
    return obj.data as T;
  }

  // Shape 1 & 2: has a `data` key
  if ('data' in obj && obj.data !== undefined) {
    return obj.data as T;
  }

  // Shape 2 variant: success but no data (e.g. { success: true })
  if ('success' in obj && obj.success === true && !('data' in obj)) {
    return json as unknown as T;
  }

  // Shape 3: bare object — return as-is
  return json as unknown as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function extractEnvelopeError(
  json: unknown,
  status: number,
  statusText?: string,
): { code?: string; message: string; details?: unknown } | null {
  if (!isRecord(json)) return null;

  const explicitError =
    json.ok === false ||
    json.success === false ||
    (status >= 400 && ('error' in json || 'message' in json));
  if (!explicitError) return null;

  const nested = isRecord(json.error) ? json.error : null;
  const message =
    asString(nested?.message) ??
    asString(json.message) ??
    asString(json.error) ??
    statusText ??
    'Request failed';
  const code =
    asString(nested?.code) ??
    asString(json.code) ??
    (status > 0 ? `HTTP_${status}` : undefined);
  const details =
    nested && 'details' in nested
      ? nested.details
      : 'details' in json
        ? json.details
        : undefined;

  return { message, code, details };
}
