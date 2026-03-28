// hooks/useOptimizedApi.ts

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  apiOptimizationService,
  optimizedFetch,
  ApiRequest,
  ApiResponse,
  prefetchCriticalEndpoints,
} from '@/services/optimization/apiOptimizationService';
import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

export interface UseOptimizedApiOptions<T = any> {
  endpoint?: keyof typeof API_ENDPOINTS;
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  cacheKey?: string;
  cacheTTL?: number;
  priority?: 'high' | 'normal' | 'low';
  autoFetch?: boolean;
  prefetch?: boolean;
  deduplicate?: boolean;
  retryCount?: number;
  timeout?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseOptimizedApiResult<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  response: ApiResponse<T> | null;
  fetch: (options?: Partial<UseOptimizedApiOptions<T>>) => Promise<T>;
  refetch: () => Promise<T>;
  clearCache: () => void;
  setData: (data: T) => void;
}

/**
 * React hook for optimized API calls with built-in caching, deduplication, and retry logic
 */
export function useOptimizedApi<T = any>(
  options: UseOptimizedApiOptions<T> = {}
): UseOptimizedApiResult<T> {
  const {
    endpoint,
    url: initialUrl,
    method = 'GET',
    body: initialBody,
    headers: initialHeaders,
    cacheKey: initialCacheKey,
    cacheTTL,
    priority = 'normal',
    autoFetch = true,
    prefetch: shouldPrefetch = false,
    deduplicate = true,
    retryCount = 3,
    timeout = 30000,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [response, setResponse] = useState<ApiResponse<T> | null>(null);

  const requestIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const dataRef = useRef<T | null>(null);
  const errorRef = useRef<Error | null>(null);

  // Generate URL from endpoint or use provided URL
  const getUrl = useCallback((): string => {
    if (initialUrl) return initialUrl;
    if (endpoint) return getApiEndpoint(API_ENDPOINTS[endpoint]);
    throw new Error('Either endpoint or url must be provided');
  }, [endpoint, initialUrl]);

  // Generate cache key
  const getCacheKey = useCallback((): string => {
    if (initialCacheKey) return initialCacheKey;
    if (endpoint) return endpoint;
    return getUrl();
  }, [endpoint, initialCacheKey, getUrl]);

  // Generate request ID for deduplication
  const getRequestId = useCallback(
    (body?: any): string => {
      const url = getUrl();
      const bodyHash = body ? JSON.stringify(body) : '';
      return `${method}_${url}_${bodyHash}`.replace(/[^a-zA-Z0-9]/g, '_');
    },
    [getUrl, method]
  );

  // Main fetch function — uses refs for loading/data/error to keep callback identity stable
  const fetch = useCallback(
    async (overrideOptions: Partial<UseOptimizedApiOptions<T>> = {}): Promise<T> => {
      const {
        body = initialBody,
        headers = initialHeaders,
        cacheKey = getCacheKey(),
        priority: reqPriority = priority,
        deduplicate: shouldDeduplicate = deduplicate,
      } = overrideOptions;

      const url = getUrl();
      const requestId = getRequestId(body);

      // Check for duplicate request (using refs to avoid stale closure)
      if (shouldDeduplicate && requestIdRef.current === requestId && loadingRef.current) {
        // Wait for existing request to complete
        return new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (!loadingRef.current) {
              clearInterval(checkInterval);
              if (errorRef.current) {
                reject(errorRef.current);
              } else {
                resolve(dataRef.current as T);
              }
            }
          }, 100);
        });
      }

      // Abort previous request if still in progress
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      requestIdRef.current = requestId;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      errorRef.current = null;

      try {
        const apiRequest: ApiRequest<T> = {
          id: requestId,
          url,
          method,
          body,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          cacheKey,
          cacheTTL,
          priority: reqPriority,
          retryCount,
          timeout,
        };

        const apiResponse = await apiOptimizationService.request<T>(apiRequest);

        // Check if request was aborted
        if (abortController.signal.aborted) {
          throw new Error('Request aborted');
        }

        setResponse(apiResponse);
        dataRef.current = apiResponse.data;
        setData(apiResponse.data);

        if (onSuccess) {
          onSuccess(apiResponse.data);
        }

        return apiResponse.data;
      } catch (err) {
        const fetchError = err instanceof Error ? err : new Error('Request failed');

        // Don't set error if request was aborted
        if (fetchError.name !== 'AbortError') {
          errorRef.current = fetchError;
          setError(fetchError);

          if (onError) {
            onError(fetchError);
          }
        }

        throw fetchError;
      } finally {
        if (!abortController.signal.aborted) {
          loadingRef.current = false;
          setLoading(false);
          abortControllerRef.current = null;
        }
      }
    },
    [
      initialBody,
      initialHeaders,
      getUrl,
      getCacheKey,
      getRequestId,
      method,
      cacheTTL,
      priority,
      deduplicate,
      retryCount,
      timeout,
      onSuccess,
      onError,
    ]
  );

  // Refetch function (bypasses cache)
  const refetch = useCallback(async (): Promise<T> => {
    // Clear cache for this request
    apiOptimizationService.clearCache(getCacheKey());

    return fetch({
      cacheKey: `${getCacheKey()}_${Date.now()}`, // Unique cache key to bypass cache
    });
  }, [fetch, getCacheKey]);

  // Clear cache function
  const clearCache = useCallback(() => {
    apiOptimizationService.clearCache(getCacheKey());
    setData(null);
    setResponse(null);
  }, [getCacheKey]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && method === 'GET') {
      fetch();
    }
  }, [autoFetch, fetch, method]);

  // Prefetch on mount if requested
  useEffect(() => {
    if (shouldPrefetch && endpoint && method === 'GET') {
      apiOptimizationService.prefetch([getUrl()], priority);
    }
  }, [shouldPrefetch, endpoint, getUrl, method, priority]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    response,
    fetch,
    refetch,
    clearCache,
    setData,
  };
}

/**
 * Hook for batch API requests
 */
export function useBatchApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeBatch = useCallback(
    async (
      requests: Array<{
        endpoint: keyof typeof API_ENDPOINTS;
        method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        body?: any;
        cacheKey?: string;
      }>
    ) => {
      setLoading(true);
      setError(null);

      try {
        const batchRequests = requests.map((req, index) => ({
          id: `batch_${index}_${Date.now()}`,
          url: getApiEndpoint(API_ENDPOINTS[req.endpoint]),
          method: req.method || 'GET',
          body: req.body,
          cacheKey: req.cacheKey || req.endpoint,
        }));

        const response = await apiOptimizationService.batchRequest({
          requests: batchRequests,
          batchId: `batch_${Date.now()}`,
          timeout: 60000, // 1 minute timeout for batches
        });

        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Batch request failed');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    executeBatch,
    loading,
    error,
  };
}

/**
 * Hook for prefetching critical endpoints
 */
export function usePrefetch() {
  const [prefetching, setPrefetching] = useState(false);
  const [prefetched, setPrefetched] = useState<string[]>([]);

  const prefetch = useCallback(async (endpoints: (keyof typeof API_ENDPOINTS)[]) => {
    setPrefetching(true);

    try {
      const urls = endpoints.map((e) => getApiEndpoint(API_ENDPOINTS[e]));
      await apiOptimizationService.prefetch(urls, 'low');

      setPrefetched((prev) => [...prev, ...endpoints]);
    } catch (error) {
      console.warn('Prefetch failed:', error);
    } finally {
      setPrefetching(false);
    }
  }, []);

  const prefetchCritical = useCallback(async () => {
    await prefetchCriticalEndpoints();
    setPrefetched(['SYNC', 'USER_PROFILE', 'PERFORMANCE', 'QUESTIONS', 'CONDITIONS']);
  }, []);

  const isPrefetched = useCallback(
    (endpoint: keyof typeof API_ENDPOINTS) => {
      return prefetched.includes(endpoint);
    },
    [prefetched]
  );

  return {
    prefetch,
    prefetchCritical,
    prefetching,
    prefetched,
    isPrefetched,
  };
}

/**
 * Convenience hook for common API patterns
 */
export function useApi() {
  const { prefetch, prefetchCritical, prefetching, prefetched, isPrefetched } = usePrefetch();

  // Common API calls with optimized defaults
  const api = {
    // User data
    getUserProfile: () => optimizedFetch('USER_PROFILE', { cacheKey: 'user_profile' }),
    getPerformance: () =>
      optimizedFetch('PERFORMANCE', { cacheKey: 'performance', cacheTTL: 300000 }), // 5 minutes
    syncData: (data: any) => optimizedFetch('SYNC', { method: 'POST', body: data }),

    // Content
    getQuestions: (params?: any) =>
      optimizedFetch('QUESTIONS', {
        cacheKey: `questions_${JSON.stringify(params)}`,
        cacheTTL: 60000, // 1 minute
      }),
    getConditions: () => optimizedFetch('CONDITIONS', { cacheKey: 'conditions', cacheTTL: 300000 }), // 5 minutes
    getBuzzwords: () => optimizedFetch('BUZZWORDS', { cacheKey: 'buzzwords', cacheTTL: 600000 }), // 10 minutes

    // Analytics
    getAnalytics: (period: string) =>
      optimizedFetch('ANALYTICS', {
        cacheKey: `analytics_${period}`,
        cacheTTL: 300000, // 5 minutes
      }),

    // Session
    startSession: (settings: any) =>
      optimizedFetch('SESSION_START', { method: 'POST', body: settings }),
    submitAnswer: (data: any) => optimizedFetch('ANSWER_SUBMIT', { method: 'POST', body: data }),
  };

  return {
    api,
    prefetch,
    prefetchCritical,
    prefetching,
    prefetched,
    isPrefetched,
  };
}
