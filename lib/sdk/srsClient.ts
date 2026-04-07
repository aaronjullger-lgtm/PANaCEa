/**
 * PANaCEa SDK — SRS Domain Client
 *
 * Wraps:
 *   GET  /api/srs/due
 *   POST /api/srs/submit
 *
 * @module lib/sdk/srsClient
 */

import type { ApiClient } from './core';
import type { SRSDueResult, SRSSubmitPayload } from './types';

export interface SrsClient {
  getDueItems(): Promise<SRSDueResult>;
  submitReview(payload: SRSSubmitPayload): Promise<{ success: boolean }>;
}

export function createSrsClient(api: ApiClient): SrsClient {
  return {
    getDueItems() {
      return api.get<SRSDueResult>('/api/srs/due');
    },
    submitReview(payload) {
      return api.post<{ success: boolean }>('/api/srs/submit', payload);
    },
  };
}
