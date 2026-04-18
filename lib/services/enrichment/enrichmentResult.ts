/**
 * Enrichment Result — Explicit failure semantics for external content enrichers.
 *
 * PANaCEa's safety mandate: medical content sections must be *complete or
 * visibly marked incomplete*. Historically, enrichers (PubMed, ClinicalTrials)
 * swallowed errors and returned `[]`, which the UI could not distinguish from
 * "no results found". A PA student seeing an empty references section might
 * silently trust the absence of evidence.
 *
 * This module provides a typed discriminated-union wrapper so callers and UI
 * can render a failure-specific state ("Evidence service unavailable — retry"),
 * keeping the safety guarantee intact without a schema migration.
 *
 * Why no DB persistence (yet): persisting `lastEnrichedAt` requires a Prisma
 * migration which is gated by Aaron-approval (per CLAUDE.md). This wrapper is
 * the transport-layer contract; persistence can layer on top later without a
 * breaking change.
 */

/** The enrichment call succeeded and produced zero or more items. */
export interface EnrichmentOk<T> {
  readonly status: 'ok';
  readonly data: T;
  /** ISO 8601 timestamp of when the data was fetched. */
  readonly fetchedAt: string;
  /** Optional: whether the successful result came from a cache hit. */
  readonly fromCache?: boolean;
}

/** The enrichment call failed. UI MUST render a visible failure indicator. */
export interface EnrichmentFailed {
  readonly status: 'failed';
  /** Machine-readable failure category for UI branching and telemetry. */
  readonly reason:
    | 'network'
    | 'timeout'
    | 'rate_limited'
    | 'upstream_error'
    | 'invalid_response'
    | 'unknown';
  /** Short human-readable message. Safe to surface in a tooltip. */
  readonly message: string;
  /** ISO 8601 timestamp of when the failure was observed. */
  readonly failedAt: string;
  /** Optional HTTP status code if the failure was an upstream response. */
  readonly httpStatus?: number;
}

/** Typed result: either `{status:'ok', data}` or `{status:'failed', reason, message}`. */
export type EnrichmentResult<T> = EnrichmentOk<T> | EnrichmentFailed;

/** Factory helpers so callers don't reinvent the shape. */
export function ok<T>(data: T, options?: { fromCache?: boolean }): EnrichmentOk<T> {
  return {
    status: 'ok',
    data,
    fetchedAt: new Date().toISOString(),
    ...(options?.fromCache !== undefined ? { fromCache: options.fromCache } : {}),
  };
}

export function failed(
  reason: EnrichmentFailed['reason'],
  message: string,
  options?: { httpStatus?: number }
): EnrichmentFailed {
  return {
    status: 'failed',
    reason,
    message,
    failedAt: new Date().toISOString(),
    ...(options?.httpStatus !== undefined ? { httpStatus: options.httpStatus } : {}),
  };
}

/**
 * Classify an unknown thrown error into a machine-readable failure reason.
 * Centralises the mapping so PubMed/Trials/future enrichers report consistently.
 */
export function classifyError(err: unknown): EnrichmentFailed {
  // AbortSignal.timeout rejects with DOMException name "TimeoutError" or "AbortError".
  if (err instanceof Error) {
    const name = err.name;
    const msg = err.message;
    if (name === 'TimeoutError' || /timed? ?out/i.test(msg)) {
      return failed('timeout', msg || 'Request timed out');
    }
    if (name === 'AbortError') {
      return failed('timeout', msg || 'Request aborted');
    }
    if (/fetch|network|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
      return failed('network', msg);
    }
    return failed('unknown', msg);
  }
  return failed('unknown', typeof err === 'string' ? err : 'Unknown error');
}

/**
 * Classify an HTTP response as a typed failure reason (caller checks `res.ok`).
 */
export function failedFromResponse(res: Response, label: string): EnrichmentFailed {
  const s = res.status;
  if (s === 429) return failed('rate_limited', `${label} rate-limited`, { httpStatus: s });
  if (s >= 500) return failed('upstream_error', `${label} ${s}`, { httpStatus: s });
  return failed('upstream_error', `${label} ${s}`, { httpStatus: s });
}

/**
 * Back-compat helper: extract the data array (or `[]` on failure) for call
 * sites that have not yet migrated to the new result shape. Safe to use
 * everywhere — failures silently degrade to `[]`, matching legacy behaviour.
 */
export function dataOrEmpty<T>(result: EnrichmentResult<T[]>): T[] {
  return result.status === 'ok' ? result.data : [];
}

/** Narrow-predicate helpers used by UI components. */
export function isEnrichmentFailed<T>(r: EnrichmentResult<T>): r is EnrichmentFailed {
  return r.status === 'failed';
}
export function isEnrichmentOk<T>(r: EnrichmentResult<T>): r is EnrichmentOk<T> {
  return r.status === 'ok';
}
