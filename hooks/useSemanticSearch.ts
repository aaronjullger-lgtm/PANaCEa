/**
 * useSemanticSearch - Semantic search over Reference Library (RAG)
 *
 * Calls POST /api/library/semantic-search for nearest-neighbor results and
 * optionally POST /api/library/answer for a 1-sentence answer (SGE style)
 * when the query looks like a question.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { MedicalContentDisplay } from '@/types/medical-content';
import { createApiClient, createContentClient } from '@/lib/sdk';

const DEBOUNCE_MS = 320;
const DEFAULT_LIMIT = 20;

/** Result item from semantic search API (content + similarity) */
export interface SemanticSearchResult extends Partial<MedicalContentDisplay> {
  similarity: number;
}

export interface UseSemanticSearchOptions {
  /** Request a 1-sentence answer from Gemini when query looks like a question */
  requestAnswer?: boolean;
  limit?: number;
}

export interface UseSemanticSearchReturn {
  results: SemanticSearchResult[];
  answer: string | null;
  loading: boolean;
  error: string | null;
  /** Whether the last request asked for an answer (question-like query) */
  askedForAnswer: boolean;
}

/** Heuristic: query looks like a question (e.g. "What is first line tx for Otitis Media?") */
export function looksLikeQuestion(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q.endsWith('?')) return true;
  const lower = q.toLowerCase();
  const questionPatterns = [
    /^what\s+(is|are|'s)/,
    /^how\s+(do you|to)\s+(treat|diagnose|work up)/,
    /first\s*line\s*(tx|treatment|therapy)/,
    /treatment\s+for\s+/,
    /diagnosis\s+of\s+/,
    /workup\s+for\s+/,
    /gold\s*standard\s*(dx|diagnosis)/,
    /best\s*(initial\s*)?test\s+for/,
  ];
  return questionPatterns.some((p) => p.test(lower));
}

export function useSemanticSearch(
  query: string,
  options: UseSemanticSearchOptions = {}
): UseSemanticSearchReturn {
  const { getToken, isSignedIn } = useAuth();
  const { requestAnswer = true, limit = DEFAULT_LIMIT } = options;

  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askedForAnswer, setAskedForAnswer] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim() || !isSignedIn) {
        setResults([]);
        setAnswer(null);
        setError(null);
        setAskedForAnswer(false);
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      setLoading(true);
      setError(null);
      setAnswer(null);
      const isQuestion = requestAnswer && looksLikeQuestion(q);
      setAskedForAnswer(isQuestion);

      const api = createApiClient(getToken);
      const content = createContentClient(api);

      try {
        if (isQuestion) {
          // Answer API — still uses raw api.post until we add answerClient
          const payload = await api.post<{
            answer?: string;
            results?: SemanticSearchResult[];
          }>('/api/library/answer', { query: q.trim(), topK: Math.min(limit, 10) });
          setAnswer(payload?.answer ?? null);
          setResults(Array.isArray(payload?.results) ? payload.results : []);
        } else {
          const payload = await content.semanticSearch({ query: q.trim(), limit });
          const results = (payload as any)?.results ?? [];
          setResults(Array.isArray(results) ? results : []);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Semantic search failed');
        setResults([]);
        setAnswer(null);
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [getToken, isSignedIn, limit, requestAnswer]
  );

  useEffect(() => {
    const q = query.trim();
    if (!q || !isSignedIn) {
      setResults([]);
      setAnswer(null);
      setLoading(false);
      setError(null);
      setAskedForAnswer(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      runSearch(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [query, isSignedIn, runSearch]);

  return { results, answer, loading, error, askedForAnswer };
}
