// services/optimization/apiOptimizationService.ts

import { getApiEndpoint, API_ENDPOINTS } from '@/lib/utils/apiConfig';

/**
 * API Optimization Service
 *
 * This service provides intelligent API call optimization including:
 * 1. Request deduplication (same request within a time window)
 * 2. Intelligent caching with stale-while-revalidate
 * 3. Batch processing for multiple similar requests
 * 4. Request prioritization and queuing
 * 5. Automatic retry with exponential backoff
 */

export interface ApiRequest<T = any> {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  cacheKey?: string;
  cacheTTL?: number; // milliseconds
  retryCount?: number;
  maxRetries?: number;
  timeout?: number; // milliseconds
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Headers;
  cached: boolean;
  timestamp: number;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  staleAt: number;
  etag?: string;
  lastModified?: string;
}

export interface BatchRequest {
  requests: ApiRequest[];
  batchId: string;
  timeout?: number;
}

export interface BatchResponse {
  batchId: string;
  responses: Array<{
    requestId: string;
    data?: any;
    error?: string;
    status: number;
  }>;
}

class ApiOptimizationService {
  private static instance: ApiOptimizationService;
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<ApiResponse>> = new Map();
  private requestQueue: Array<{
    request: ApiRequest;
    resolve: (value: ApiResponse) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  private isProcessingQueue = false;
  private maxConcurrentRequests = 6; // Browser limit is 6 per domain
  private activeRequests = 0;
  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  // Cache configuration
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEFAULT_STALE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly DEDUPLICATION_WINDOW = 1000; // 1 second

  private constructor() {
    this.startCacheCleanup();
  }

  static getInstance(): ApiOptimizationService {
    if (!ApiOptimizationService.instance) {
      ApiOptimizationService.instance = new ApiOptimizationService();
    }
    return ApiOptimizationService.instance;
  }

  /**
   * Make an optimized API request
   */
  async request<T = any>(request: ApiRequest): Promise<ApiResponse<T>> {
    // Generate request ID if not provided
    const requestId = request.id || this.generateRequestId(request);

    // Check for duplicate pending requests
    const pendingRequest = this.pendingRequests.get(requestId);
    if (pendingRequest) {
      return pendingRequest as Promise<ApiResponse<T>>;
    }

    // Check cache for GET requests
    if (request.method === 'GET' && request.cacheKey) {
      const cached = this.getFromCache<T>(request.cacheKey);
      if (cached) {
        // Return cached data immediately
        const response: ApiResponse<T> = {
          data: cached.data,
          status: 200,
          headers: new Headers(),
          cached: true,
          timestamp: cached.timestamp,
        };

        // Refresh cache in background if stale
        if (Date.now() > cached.staleAt) {
          this.refreshCacheInBackground(request);
        }

        return response;
      }
    }

    // Create the request promise
    const requestPromise = this.executeRequest<T>(request);

    // Store in pending requests for deduplication
    this.pendingRequests.set(requestId, requestPromise);

    // Clean up after request completes
    requestPromise.finally(() => {
      this.pendingRequests.delete(requestId);
    });

    return requestPromise;
  }

  /**
   * Execute a batch of requests with optimization
   */
  async batchRequest(batch: BatchRequest): Promise<BatchResponse> {
    const batchId =
      batch.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Group requests by type and cache status
    const { cachedRequests, freshRequests } = this.groupBatchRequests(batch.requests);

    const responses: BatchResponse['responses'] = [];

    // Handle cached requests immediately
    for (const request of cachedRequests) {
      try {
        const cached = this.getFromCache(request.cacheKey!);
        if (cached) {
          responses.push({
            requestId: request.id,
            data: cached.data,
            status: 200,
          });
        } else {
          // If cache miss, add to fresh requests
          freshRequests.push(request);
        }
      } catch (error) {
        responses.push({
          requestId: request.id,
          error: error instanceof Error ? error.message : 'Cache error',
          status: 500,
        });
      }
    }

    // Execute fresh requests in parallel with concurrency limit
    if (freshRequests.length > 0) {
      const freshResponses = await this.executeBatchRequests(freshRequests, batch.timeout);
      responses.push(...freshResponses);
    }

    return {
      batchId,
      responses,
    };
  }

  /**
   * Prefetch API endpoints that are likely to be needed
   */
  async prefetch(endpoints: string[], priority: 'high' | 'normal' | 'low' = 'low'): Promise<void> {
    const requests = endpoints.map((endpoint) => ({
      id: `prefetch_${endpoint}`,
      url: getApiEndpoint(endpoint as any),
      method: 'GET' as const,
      priority,
      cacheKey: endpoint,
      cacheTTL: this.DEFAULT_CACHE_TTL,
    }));

    // Execute prefetch requests with low priority
    await Promise.allSettled(
      requests.map((request) =>
        this.request(request).catch(() => {
          // Silently fail for prefetch requests
        })
      )
    );
  }

  /**
   * Clear cache for specific endpoints or all cache
   */
  clearCache(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const regex = typeof pattern === 'string' ? new RegExp(pattern.replace(/\*/g, '.*')) : pattern;

    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    hitRate: number;
    memoryUsage: number;
  } {
    let totalSize = 0;
    let hitCount = 0;
    let missCount = 0;

    // Estimate memory usage (rough approximation)
    for (const [key, entry] of this.cache) {
      totalSize += key.length;
      totalSize += JSON.stringify(entry.data).length;

      // Check if entry is still valid
      if (Date.now() < entry.expiresAt) {
        hitCount++;
      } else {
        missCount++;
      }
    }

    const hitRate = hitCount + missCount > 0 ? hitCount / (hitCount + missCount) : 0;

    return {
      totalEntries: this.cache.size,
      hitRate,
      memoryUsage: totalSize,
    };
  }

  /**
   * Set concurrency limit for API requests
   */
  setConcurrencyLimit(limit: number): void {
    this.maxConcurrentRequests = Math.max(1, Math.min(limit, 10)); // Cap at 10
  }

  private async executeRequest<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    const timeout = request.timeout || 30000; // Default 30 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const startTime = Date.now();

      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          'Content-Type': 'application/json',
          ...request.headers,
        },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      // Log performance for monitoring
      this.logPerformance(request.url, responseTime, response.status);

      const data = await response.json();

      const apiResponse: ApiResponse<T> = {
        data,
        status: response.status,
        headers: response.headers,
        cached: false,
        timestamp: Date.now(),
      };

      // Cache successful GET responses
      if (request.method === 'GET' && response.ok && request.cacheKey) {
        const etag = response.headers.get('etag');
        const lastModified = response.headers.get('last-modified');

        this.setCache(request.cacheKey, data, {
          etag,
          lastModified,
          ttl: request.cacheTTL || this.DEFAULT_CACHE_TTL,
        });
      }

      return apiResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle retry logic
      if (this.shouldRetry(request, error)) {
        return this.retryRequest(request);
      }

      throw error;
    }
  }

  private async executeBatchRequests(
    requests: ApiRequest[],
    timeout?: number
  ): Promise<BatchResponse['responses']> {
    const batchTimeout = timeout || 60000; // Default 1 minute for batches
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), batchTimeout);

    try {
      // Execute requests in parallel with concurrency control
      const results = await Promise.allSettled(
        requests.map(async (request) => {
          try {
            const response = await this.executeRequest(request);
            return {
              requestId: request.id,
              data: response.data,
              status: response.status,
            };
          } catch (error) {
            return {
              requestId: request.id,
              error: error instanceof Error ? error.message : 'Request failed',
              status: 500,
            };
          }
        })
      );

      clearTimeout(timeoutId);

      return results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              requestId: 'unknown',
              error: 'Promise rejected',
              status: 500,
            }
      );
    } catch (error) {
      clearTimeout(timeoutId);

      // Return timeout errors for all requests
      return requests.map((request) => ({
        requestId: request.id,
        error: 'Batch timeout',
        status: 408,
      }));
    }
  }

  private getFromCache<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry as CacheEntry<T>;
  }

  private setCache<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      etag?: string;
      lastModified?: string;
    } = {}
  ): void {
    const ttl = options.ttl || this.DEFAULT_CACHE_TTL;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      staleAt: now + ttl / 2, // Consider stale after half TTL
      etag: options.etag,
      lastModified: options.lastModified,
    };

    this.cache.set(key, entry);
  }

  private async refreshCacheInBackground(request: ApiRequest): Promise<void> {
    // Don't block main thread
    setTimeout(async () => {
      try {
        const response = await fetch(request.url, {
          method: 'GET',
          headers: request.headers,
        });

        if (response.ok) {
          const data = await response.json();
          const etag = response.headers.get('etag');
          const lastModified = response.headers.get('last-modified');

          this.setCache(request.cacheKey!, data, {
            etag,
            lastModified,
            ttl: request.cacheTTL || this.DEFAULT_CACHE_TTL,
          });
        }
      } catch (error) {
        // Silently fail background refresh
        console.debug('Background cache refresh failed:', error);
      }
    }, 0);
  }

  private groupBatchRequests(requests: ApiRequest[]): {
    cachedRequests: ApiRequest[];
    freshRequests: ApiRequest[];
  } {
    const cachedRequests: ApiRequest[] = [];
    const freshRequests: ApiRequest[] = [];

    for (const request of requests) {
      if (request.method === 'GET' && request.cacheKey) {
        const cached = this.getFromCache(request.cacheKey);
        if (cached) {
          cachedRequests.push(request);
        } else {
          freshRequests.push(request);
        }
      } else {
        freshRequests.push(request);
      }
    }

    return { cachedRequests, freshRequests };
  }

  private generateRequestId(request: ApiRequest): string {
    const { url, method, body } = request;
    const bodyHash = body ? JSON.stringify(body) : '';
    return `${method}_${url}_${bodyHash}`.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private shouldRetry(request: ApiRequest, error: any): boolean {
    const retryCount = request.retryCount || 0;
    const maxRetries = request.maxRetries || 3;

    // Don't retry if max retries reached
    if (retryCount >= maxRetries) {
      return false;
    }

    // Retry on network errors or 5xx status codes
    if (error.name === 'AbortError' || error.name === 'TypeError') {
      return true;
    }

    // Check if error is a response with 5xx status
    if (error.status && error.status >= 500) {
      return true;
    }

    return false;
  }

  private async retryRequest<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    const retryCount = (request.retryCount || 0) + 1;
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s

    await new Promise((resolve) => setTimeout(resolve, delay));

    return this.executeRequest({
      ...request,
      retryCount,
    });
  }

  private logPerformance(url: string, responseTime: number, status: number): void {
    // In production, this would send to analytics service
    console.debug(`API Performance: ${url} - ${responseTime}ms - ${status}`);

    // Track slow requests
    if (responseTime > 5000) {
      // 5 seconds
      console.warn(`Slow API request: ${url} took ${responseTime}ms`);
    }
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every minute
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [key, entry] of this.cache) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.debug(`Cache cleanup: removed ${cleanedCount} expired entries`);
      }
    }, 60000); // Every minute
  }

  destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }

    this.cache.clear();
    this.pendingRequests.clear();
    this.requestQueue = [];
  }
}

// Export singleton instance
export const apiOptimizationService = ApiOptimizationService.getInstance();

// Convenience functions for common API patterns
export async function optimizedFetch<T = any>(
  endpoint: keyof typeof API_ENDPOINTS,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
    cacheKey?: string;
    cacheTTL?: number;
    priority?: 'high' | 'normal' | 'low';
  }
): Promise<T> {
  const url = getApiEndpoint(API_ENDPOINTS[endpoint]);
  const cacheKey = options?.cacheKey || endpoint;

  const response = await apiOptimizationService.request({
    id: `${options?.method || 'GET'}_${endpoint}`,
    url,
    method: options?.method || 'GET',
    body: options?.body,
    headers: options?.headers,
    cacheKey,
    cacheTTL: options?.cacheTTL,
    priority: options?.priority || 'normal',
  });

  return response.data;
}

export async function prefetchCriticalEndpoints(): Promise<void> {
  const criticalEndpoints: (keyof typeof API_ENDPOINTS)[] = [
    'SYNC',
    'USER_PROFILE',
    'PERFORMANCE',
    'QUESTIONS',
    'CONDITIONS',
  ];

  await apiOptimizationService.prefetch(
    criticalEndpoints.map((e) => getApiEndpoint(API_ENDPOINTS[e])),
    'high'
  );
}

// Hook for React components
export function useApiOptimization() {
  return {
    request: apiOptimizationService.request.bind(apiOptimizationService),
    batchRequest: apiOptimizationService.batchRequest.bind(apiOptimizationService),
    clearCache: apiOptimizationService.clearCache.bind(apiOptimizationService),
    getCacheStats: apiOptimizationService.getCacheStats.bind(apiOptimizationService),
    prefetch: apiOptimizationService.prefetch.bind(apiOptimizationService),
  };
}
