/**
 * PANaCEa SDK — Typed Contract Caller
 *
 * The single typed gateway from client code to the edge API. Given an
 * `ApiContract`, `callApi()`:
 *   1. Validates the input against `contract.request`
 *   2. Builds the URL (interpolating `:params`, appending query if needed)
 *   3. Attaches auth + trace headers
 *   4. Performs the fetch (with timeout)
 *   5. Parses the unified `{ success, data, error, code, traceId }` envelope
 *   6. Validates the server's `data` against `contract.response`
 *   7. Returns the typed `data` — or throws a typed `ApiError`
 *
 * If the server drifts from the contract, we throw `ApiError` with
 * `ErrorCode.VALIDATION_FAILED` and details from Zod, so the boundary bug
 * surfaces at the one spot instead of downstream in a component.
 *
 * Usage:
 *   import { submitDrillReview } from '@/lib/api/contracts';
 *   import { callApi } from '@/lib/sdk/callApi';
 *
 *   const result = await callApi(submitDrillReview, payload, { getToken });
 *   // result is fully typed as DrillSubmitReviewResponse
 *
 * This lives alongside `createApiClient` (core.ts). The old client is
 * still used by domain clients that haven't been migrated. New callers
 * should prefer contracts.
 */

import type { ZodTypeAny } from 'zod';
import {
  interpolatePath,
  type ApiContract,
  type ContractParams,
  type ContractRequest,
  type ContractResponse,
} from '../api/contracts/types';
import { ErrorCode } from '../../functions/api/_shared/error-catalog';
import { ApiError, type TokenProvider } from './types';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface CallApiOptions<
  C extends ApiContract<any, any, any>,
> {
  /** Token provider (Clerk-compatible). Omit for unauthenticated calls. */
  getToken?: TokenProvider;
  /** Path parameters (must match `contract.params` if the contract declares them). */
  params?: ContractParams<C>;
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Base URL — defaults to '' (relative to origin). */
  baseUrl?: string;
  /** Request timeout in ms — defaults to 30 000. */
  timeoutMs?: number;
  /** AbortSignal for caller-driven cancellation. */
  signal?: AbortSignal;
  /**
   * Skip runtime response validation. Escape hatch for emergencies — the
   * cost of a mis-typed server response lands in the caller instead.
   * Default: false.
   */
  skipResponseValidation?: boolean;
}

// ─── Envelope types ──────────────────────────────────────────────────────────

interface ApiSuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  traceId?: string;
  timestamp?: string;
  message?: string;
}

interface ApiErrorEnvelope {
  success: false;
  error: string;
  code?: string;
  message?: string;
  details?: unknown;
  traceId?: string;
  timestamp?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;

function buildUrl<C extends ApiContract<any, any, any>>(
  contract: C,
  input: ContractRequest<C> | undefined,
  params: ContractParams<C> | undefined,
  baseUrl: string,
): string {
  const interpolated = interpolatePath(
    contract.path,
    params as Record<string, string | number> | undefined,
  );
  let url = `${baseUrl}${interpolated}`;
  if (contract.source === 'query' && input && typeof input === 'object') {
    const entries: Array<[string, string]> = [];
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) entries.push([k, String(item)]);
      } else {
        entries.push([k, String(v)]);
      }
    }
    if (entries.length > 0) {
      const qs = new URLSearchParams(entries).toString();
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }
  return url;
}

function validateInput<C extends ApiContract<any, any, any>>(
  contract: C,
  input: unknown,
): ContractRequest<C> | undefined {
  if (!contract.request) {
    if (input !== undefined && input !== null) {
      throw new ApiError(
        0,
        `${contract.path} does not accept an input payload`,
        ErrorCode.VALIDATION_FAILED,
      );
    }
    return undefined;
  }
  const parsed = (contract.request as ZodTypeAny).safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      0,
      `Invalid input for ${contract.method} ${contract.path}`,
      ErrorCode.VALIDATION_FAILED,
      { issues: parsed.error.issues } as Record<string, unknown>,
    );
  }
  return parsed.data as ContractRequest<C>;
}

function parseResponseData<C extends ApiContract<any, any, any>>(
  contract: C,
  raw: unknown,
  skip: boolean,
): ContractResponse<C> {
  if (skip) return raw as ContractResponse<C>;
  const parsed = (contract.response as ZodTypeAny).safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(
      500,
      `Server response did not match contract for ${contract.method} ${contract.path}`,
      ErrorCode.VALIDATION_FAILED,
      { issues: parsed.error.issues } as Record<string, unknown>,
    );
  }
  return parsed.data as ContractResponse<C>;
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Call a contracted endpoint with typed input and typed response.
 *
 * Errors:
 *   - Input fails Zod validation → ApiError(0, VALIDATION_FAILED)
 *   - Network failure / timeout → ApiError(0, TIMEOUT | NETWORK_ERROR)
 *   - Non-2xx response          → ApiError(status, server's code)
 *   - Response fails Zod        → ApiError(500, VALIDATION_FAILED)
 */
export async function callApi<C extends ApiContract<any, any, any>>(
  contract: C,
  input?: ContractRequest<C>,
  options: CallApiOptions<C> = {},
): Promise<ContractResponse<C>> {
  const {
    getToken,
    params,
    headers: extraHeaders = {},
    baseUrl = '',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    skipResponseValidation = false,
  } = options;

  // 1. Validate input
  const validated = validateInput(contract, input);

  // 2. Build URL
  const url = buildUrl(contract, validated, params, baseUrl);

  // 3. Build headers
  const headers: Record<string, string> = { ...extraHeaders };
  if (getToken) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (contract.source === 'body' && validated !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(validated);
  }

  // 4. Fire the fetch with timeout + caller signal
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let res: Response;
  try {
    res = await fetch(url, {
      method: contract.method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
    const name = (err as { name?: string } | null)?.name;
    if (name === 'AbortError') {
      throw new ApiError(
        0,
        `Request timed out after ${timeoutMs}ms`,
        ErrorCode.TIMEOUT,
      );
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new ApiError(0, msg, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  // 5. Parse the envelope
  let envelope: unknown;
  try {
    envelope = await res.json();
  } catch {
    if (!res.ok) {
      throw new ApiError(
        res.status,
        res.statusText || 'Request failed',
        ErrorCode.INTERNAL_ERROR,
      );
    }
    // Some endpoints return bare responses — surface as contract mismatch.
    throw new ApiError(
      res.status,
      `Expected JSON envelope from ${contract.method} ${contract.path}`,
      ErrorCode.VALIDATION_FAILED,
    );
  }

  // Error envelope — throw typed ApiError.
  if (
    typeof envelope === 'object' &&
    envelope !== null &&
    (envelope as { success?: unknown }).success === false
  ) {
    const err = envelope as ApiErrorEnvelope;
    throw new ApiError(
      res.status,
      err.message ?? err.error ?? 'Request failed',
      err.code ?? err.error,
      (typeof err.details === 'object' && err.details !== null
        ? (err.details as Record<string, unknown>)
        : undefined),
    );
  }

  // Non-2xx without a proper envelope (shouldn't happen post-sprint-3, but guard).
  if (!res.ok) {
    const err = envelope as Partial<ApiErrorEnvelope> | null;
    throw new ApiError(
      res.status,
      err?.message ?? err?.error ?? res.statusText ?? 'Request failed',
      err?.code,
    );
  }

  // Success envelope — extract `data` and validate.
  let raw: unknown;
  if (
    typeof envelope === 'object' &&
    envelope !== null &&
    (envelope as { success?: unknown }).success === true &&
    'data' in (envelope as Record<string, unknown>)
  ) {
    raw = (envelope as ApiSuccessEnvelope).data;
  } else {
    // Some legacy endpoints still return bare payloads; pass-through.
    raw = envelope;
  }

  return parseResponseData(contract, raw, skipResponseValidation);
}
