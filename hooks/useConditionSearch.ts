import { useState, useCallback, useRef, useEffect } from 'react';
import { searchConditions, type ConditionSearchResult } from '@/lib/conditionSearch';
import type { SystemCode } from '@/types';

interface UseConditionSearchOptions {
  /** Minimum query length before searching (default: 2) */
  minQueryLength?: number;
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** System filter */
  system?: SystemCode;
  /** Subcategory filter */
  subcategory?: string;
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
}

interface UseConditionSearchReturn {
  /** Current query string */
  query: string;
  /** Set query string (triggers search) */
  setQuery: (query: string) => void;
  /** Search results */
  results: ConditionSearchResult[];
  /** Whether a search is in progress */
  isLoading: boolean;
  /** Error message, if any */
  error: string | null;
  /** Clear results and error */
  clear: () => void;
}

/**
 * Hook for condition search with debounced API calls.
 * Provides autocomplete suggestions for condition names.
 */
export function useConditionSearch(options: UseConditionSearchOptions = {}): UseConditionSearchReturn {
  const {
    minQueryLength = 2,
    limit = 10,
    system,
    subcategory,
    debounceMs = 300,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConditionSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < minQueryLength) {
      setResults([]);
      setError(null);
      return;
    }

    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const filters = { system, subcategory, limit };
      const searchResults = await searchConditions(searchQuery, filters);
      setResults(searchResults);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Ignore abort errors
        return;
      }
      console.error('Condition search failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to search conditions');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit, minQueryLength, system, subcategory]);

  const handleSetQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);

    // Clear previous debounce timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new debounce timeout
    debounceTimeout.current = setTimeout(() => {
      performSearch(newQuery);
    }, debounceMs);
  }, [debounceMs, performSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
      debounceTimeout.current = null;
    }
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  // Clean up debounce timer and abort controller on unmount
  useEffect(() => {
    return () => cleanup();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    query,
    setQuery: handleSetQuery,
    results,
    isLoading,
    error,
    clear,
  };
}
