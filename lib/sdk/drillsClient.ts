/**
 * PANaCEa SDK — Drills Domain Client
 *
 * Wraps POST /api/drills/submit-review
 *
 * @module lib/sdk/drillsClient
 */

import type { ApiClient } from './core';
import type { DrillSubmitPayload, DrillSubmitResult } from './types';

export interface DrillsClient {
  submitReview(payload: DrillSubmitPayload): Promise<DrillSubmitResult>;
}

export function createDrillsClient(api: ApiClient): DrillsClient {
  return {
    submitReview(payload) {
      return api.post<DrillSubmitResult>('/api/drills/submit-review', payload);
    },
  };
}
