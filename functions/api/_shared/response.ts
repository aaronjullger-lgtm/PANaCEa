/**
 * Legacy response helpers for PANaCEa.
 *
 * These now delegate to `api-response.ts` — the single source of truth.
 * New code should import `ok`, `fail`, `ErrorCode` from `./api-response`
 * directly. These aliases exist so existing call sites keep compiling while
 * the fleet migrates.
 */

import { ok, fail, type ApiSuccessEnvelope, type ApiErrorEnvelope } from './api-response';
import { codeFromStatus, isKnownErrorCode, ErrorCode } from './error-catalog';

// Re-export envelope types under the legacy names
export type APIResponseSuccess<T = unknown> = ApiSuccessEnvelope<T>;
export type APIResponseError = ApiErrorEnvelope;
export type APIResponse<T = unknown> = APIResponseSuccess<T> | APIResponseError;

/**
 * @deprecated Use `ok()` from `./api-response` instead.
 * Wraps data in the unified envelope shape.
 */
export function jsonSuccess<T>(
  data: T,
  options?: {
    status?: number;
    message?: string;
    headers?: Record<string, string>;
  }
): Response {
  return ok(data, options);
}

/**
 * @deprecated Use `fail(ErrorCode.*, ...)` from `./api-response` instead.
 * Wraps an error message + status in the unified envelope shape.
 */
export function jsonError(
  message: string,
  status: number = 500,
  options?: {
    code?: string;
    details?: unknown;
    headers?: Record<string, string>;
  }
): Response {
  const code: ErrorCode = options?.code && isKnownErrorCode(options.code)
    ? options.code
    : codeFromStatus(status);

  return fail(code, {
    status,
    message,
    details: options?.details,
    headers: options?.headers,
  });
}
