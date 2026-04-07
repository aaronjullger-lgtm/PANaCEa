/**
 * PANaCEa SDK — Content Domain Client
 *
 * Wraps:
 *   GET   /api/content/search?q=...
 *   POST  /api/library/semantic-search
 *
 * @module lib/sdk/contentClient
 */

import type { ApiClient } from './core';
import type {
  ContentSearchResult,
  SemanticSearchPayload,
  SemanticSearchResult,
} from './types';

export interface ContentClient {
  search(query: string): Promise<ContentSearchResult>;
  semanticSearch(payload: SemanticSearchPayload): Promise<SemanticSearchResult>;
}

export function createContentClient(api: ApiClient): ContentClient {
  return {
    search(query) {
      return api.get<ContentSearchResult>('/api/content/search', { q: query });
    },
    semanticSearch(payload) {
      return api.post<SemanticSearchResult>('/api/library/semantic-search', {
        query: payload.query,
        limit: payload.limit,
        ...(payload.system ? { system: payload.system } : {}),
      });
    },
  };
}
