/**
 * PANaCEa SDK — Drills Domain Client
 *
 * Wraps POST /api/drills/submit-review
 *
 * This client now delegates to `callApi(submitDrillReview, ...)` so the
 * request payload and response shape are validated against the shared
 * contract on both sides of the wire. The `ApiClient` argument is kept
 * for backward compatibility with existing factory wiring — callers that
 * need a stand-alone instance can pass `null` (the internal implementation
 * uses the contract directly).
 *
 * @module lib/sdk/drillsClient
 */

import type { ApiClient } from './core';
import { callApi } from './callApi';
import { submitDrillReview } from '../api/contracts';
import type { DrillSubmitPayload, DrillSubmitResult } from './types';
import type { TokenProvider } from './types';

export interface DrillsClient {
  submitReview(payload: DrillSubmitPayload): Promise<DrillSubmitResult>;
}

/**
 * Create a drills client.
 *
 * `api` is still accepted so the factory signature is unchanged; token
 * provisioning is re-derived from it. When `api` is a contract-aware
 * client (exposing `getToken`), we delegate directly. Otherwise we fall
 * through to the generic `api.post` path.
 */
export function createDrillsClient(
  api: ApiClient,
  opts: { getToken?: TokenProvider } = {},
): DrillsClient {
  return {
    async submitReview(payload) {
      // Prefer the contract-driven path: validates payload + response at the
      // boundary and returns the fully-typed `data`.
      if (opts.getToken) {
        const result = await callApi(submitDrillReview, payload, {
          getToken: opts.getToken,
        });
        return result as unknown as DrillSubmitResult;
      }
      // Fallback for existing wiring that doesn't thread a token provider.
      return api.post<DrillSubmitResult>('/api/drills/submit-review', payload);
    },
  };
}
