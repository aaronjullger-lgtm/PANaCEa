/**
 * PANaCEa API Contracts — Core Types
 *
 * An `ApiContract` is a runtime-validated description of a single HTTP
 * endpoint. It pairs the HTTP method + path with Zod schemas for the
 * request and response payloads, plus the set of error codes the endpoint
 * is documented to return.
 *
 * Both sides of the wire use the same contract:
 *   - The server derives its validation middleware from `contract.request`
 *     and guarantees its success payload matches `contract.response`.
 *   - The client calls `callApi(contract, input)` which validates the
 *     input before sending, parses the unified envelope, and validates the
 *     server's response data against `contract.response`.
 *
 * If the server ever drifts from the contract, the client surfaces it as a
 * typed `SchemaMismatchError` — the bug is caught at the API boundary
 * instead of turning into `undefined is not a function` deep in a drill.
 *
 * Usage:
 *   export const drillSubmitReview = defineContract({
 *     method: 'POST',
 *     path: '/api/drills/submit-review',
 *     request: DrillSubmitReviewRequestSchema,
 *     response: DrillSubmitReviewResponseSchema,
 *     errors: [ErrorCode.UNAUTHORIZED, ErrorCode.VALIDATION_FAILED, ErrorCode.RATE_LIMITED],
 *   });
 */

import type { z, ZodTypeAny } from 'zod';
import type { ErrorCode } from '../../../functions/api/_shared/error-catalog';

// ─── HTTP ────────────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ─── Contract ────────────────────────────────────────────────────────────────

/**
 * Runtime-validated description of a single endpoint.
 *
 * `TRequest` and `TResponse` are Zod schemas. TypeScript's `z.infer<>` is used
 * to derive the compile-time types — callers never hand-write these.
 *
 * `request` may be `null` for endpoints that take no input (pure GET with no
 * query params, DELETE by path, etc.). This keeps the contract honest: you
 * cannot pass a body to an endpoint that doesn't accept one.
 *
 * `params` is an optional schema for URL path parameters (e.g. `/items/:id`)
 * — validated before the path is interpolated.
 */
export interface ApiContract<
  TRequest extends ZodTypeAny | null = ZodTypeAny | null,
  TResponse extends ZodTypeAny = ZodTypeAny,
  TParams extends ZodTypeAny | null = ZodTypeAny | null,
> {
  /** HTTP method. */
  readonly method: HttpMethod;
  /**
   * URL path, with optional `:param` placeholders that are substituted from
   * the `params` input. e.g. `/api/conditions/:id`.
   */
  readonly path: string;
  /**
   * Where to send the request payload.
   * - `body` (default) — JSON-serialized body
   * - `query` — URL-encoded query string (for GET / DELETE)
   * - `none`  — no payload accepted
   */
  readonly source: 'body' | 'query' | 'none';
  /** Zod schema for the request payload, or `null` if none. */
  readonly request: TRequest;
  /** Zod schema for URL path parameters, or `null` if none. */
  readonly params: TParams;
  /** Zod schema for the success `data` field of the envelope. */
  readonly response: TResponse;
  /**
   * Canonical error codes this endpoint is documented to return. Lets clients
   * reason about which failures are expected vs. which indicate a bug.
   * Always includes the universal codes (UNAUTHORIZED, RATE_LIMITED,
   * INTERNAL_ERROR) implicitly.
   */
  readonly errors: readonly ErrorCode[];
  /** One-line human summary for docs + debugging. */
  readonly description: string;
}

// Helper types for deriving TS types from a contract.

export type ContractRequest<C extends ApiContract<any, any, any>> =
  C['request'] extends ZodTypeAny ? z.infer<C['request']> : undefined;

export type ContractResponse<C extends ApiContract<any, any, any>> = z.infer<
  C['response']
>;

export type ContractParams<C extends ApiContract<any, any, any>> =
  C['params'] extends ZodTypeAny ? z.infer<C['params']> : undefined;

// ─── Factory ─────────────────────────────────────────────────────────────────

export interface DefineContractOptions<
  TRequest extends ZodTypeAny | null,
  TResponse extends ZodTypeAny,
  TParams extends ZodTypeAny | null,
> {
  method: HttpMethod;
  path: string;
  /**
   * Where the request payload lives. Defaults:
   *   - GET / DELETE → 'query'
   *   - POST / PUT / PATCH → 'body'
   * Override when an endpoint consumes its body itself (e.g. multipart).
   */
  source?: 'body' | 'query' | 'none';
  request?: TRequest;
  params?: TParams;
  response: TResponse;
  errors?: readonly ErrorCode[];
  description: string;
}

/**
 * Build an ApiContract with sensible defaults.
 *
 * The default `source` follows HTTP conventions:
 *   - GET / DELETE  → 'query' (no body)
 *   - POST/PUT/PATCH → 'body'
 * Pass `source` explicitly for endpoints that break convention (e.g. a POST
 * that consumes multipart form-data and does its own body parsing).
 */
export function defineContract<
  TRequest extends ZodTypeAny | null,
  TResponse extends ZodTypeAny,
  TParams extends ZodTypeAny | null = null,
>(
  opts: DefineContractOptions<TRequest, TResponse, TParams>,
): ApiContract<TRequest, TResponse, TParams> {
  const defaultSource: 'body' | 'query' =
    opts.method === 'GET' || opts.method === 'DELETE' ? 'query' : 'body';
  return {
    method: opts.method,
    path: opts.path,
    source: opts.source ?? (opts.request ? defaultSource : 'none'),
    request: (opts.request ?? null) as TRequest,
    params: (opts.params ?? null) as TParams,
    response: opts.response,
    errors: opts.errors ?? [],
    description: opts.description,
  };
}

// ─── Path interpolation ──────────────────────────────────────────────────────

/**
 * Substitute `:name` placeholders in a path from a params record.
 * Missing keys throw so contract mismatches are loud.
 *
 * Example:
 *   interpolatePath('/api/conditions/:id/drugs', { id: 'abc' })
 *     → '/api/conditions/abc/drugs'
 */
export function interpolatePath(
  path: string,
  params: Record<string, string | number> | undefined,
): string {
  if (!params) {
    if (/:[a-zA-Z_][a-zA-Z0-9_]*/.test(path)) {
      throw new Error(
        `Path "${path}" has parameters but no params were provided`,
      );
    }
    return path;
  }
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    if (!(name in params)) {
      throw new Error(`Path "${path}" is missing param ":${name}"`);
    }
    return encodeURIComponent(String(params[name]));
  });
}
