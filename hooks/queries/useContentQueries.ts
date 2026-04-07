/**
 * TanStack Query hooks wrapping the Content SDK client.
 *
 * Provides useQuery for content search and semantic search.
 *
 * @module hooks/queries/useContentQueries
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { createApiClient } from '@/lib/sdk';
import { createContentClient } from '@/lib/sdk/contentClient';
import { queryKeys } from '@/lib/queryKeys';
import type { ContentSearchResult, SemanticSearchPayload, SemanticSearchResult } from '@/lib/sdk/types';

function useContentClient() {
  const { getToken } = useAuth();
  return createContentClient(createApiClient(getToken));
}

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Search content by text query (BM25 / tsvector).
 * Disabled when query is empty.
 */
export function useContentSearch(query: string) {
  const { isSignedIn } = useAuth();
  const client = useContentClient();

  return useQuery<ContentSearchResult>({
    queryKey: queryKeys.content.search(query),
    queryFn: () => client.search(query),
    enabled: !!isSignedIn && query.length > 0,
    staleTime: 1000 * 60 * 60, // 1 hour — content rarely changes
  });
}

/**
 * Semantic search with pgvector hybrid scoring.
 * Disabled when query is empty.
 */
export function useSemanticSearch(payload: SemanticSearchPayload) {
  const { isSignedIn } = useAuth();
  const client = useContentClient();

  return useQuery<SemanticSearchResult>({
    queryKey: ['content', 'semantic', payload.query, payload.system] as const,
    queryFn: () => client.semanticSearch(payload),
    enabled: !!isSignedIn && payload.query.length > 0,
    staleTime: 1000 * 60 * 60,
  });
}
