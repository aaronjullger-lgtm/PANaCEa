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
  submitReview(payload: SRSSubmitPayload): Promise<{
    success: boolean;
    nextReviewDate?: string;
    questionId?: string;
    conditionId?: string;
    topicProgressId?: string;
  }>;
}

export function createSrsClient(api: ApiClient): SrsClient {
  return {
    async getDueItems() {
      const result = await api.get<SRSDueResult>('/api/srs/due');
      return {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          dueDate: item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate as unknown as string),
        })),
      };
    },
    submitReview(payload) {
      return api.post<{
        success: boolean;
        nextReviewDate?: string;
        questionId?: string;
        conditionId?: string;
        topicProgressId?: string;
      }>('/api/srs/submit', payload);
    },
  };
}
