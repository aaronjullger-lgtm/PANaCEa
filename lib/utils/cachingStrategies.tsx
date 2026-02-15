/**
 * Caching Strategies for Performance Optimization
 * Multi-layer caching with memory, localStorage, and IndexedDB support
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// CACHE TYPES AND INTERFACES
// ============================================================================

export interface CacheEntry<T = any> {
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  timestamp: number;
  /** Time to live in milliseconds */
  ttl: number;
  /** ETag for HTTP cache validation */
  etag?: string;
  /** Last modified timestamp */
  lastModified?: string;
  /** Cache key */
  key: string;
}

export interface CacheOptions {
  /** Time to live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Whether to persist to localStorage (default: false) */
  persist?: boolean;
  /** Maximum size in bytes for memory cache (default: 10MB) */
  maxSize?: number;
  /** Whether to use stale-while-revalidate pattern */
  staleWhileRevalidate?: boolean;
  /** Custom serialization function */
  serialize?: (data: any) => string;
  /** Custom deserialization function */
  deserialize?: (str: string) => any;
}

export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Memory cache size in bytes */
  memorySize: number;
  /** Number of entries in memory cache */
  memoryEntries: number;
  /** Number of entries in localStorage */
  persistentEntries: number;
  /** Cache hit rate */
  hitRate: number;
  /** Average response time from cache */
  avgResponseTime: number;
}

// ============================================================================
// MEMORY CACHE
// ============================================================================

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    size: 0,
    responseTimes: [] as number[],
  };

  constructor(private maxSize: number = 10 * 1024 * 1024) {} // 10MB default

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    // Estimate size
    const entrySize = this.estimateSize(entry);

    // Check if we need to evict entries
    if (this.stats.size + entrySize > this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
    this.stats.size += entrySize;
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.size -= this.estimateSize(entry);
      this.stats.misses++;
      return null;
    }

    const start = performance.now();
    this.stats.hits++;
    const responseTime = performance.now() - start;
    this.stats.responseTimes.push(responseTime);

    // Keep only last 100 response times
    if (this.stats.responseTimes.length > 100) {
      this.stats.responseTimes.shift();
    }

    return entry;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.size -= this.estimateSize(entry);
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  private estimateSize(entry: CacheEntry): number {
    try {
      return JSON.stringify(entry).length * 2; // Rough estimate in bytes
    } catch {
      return 1024; // Default 1KB if serialization fails
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const avgResponseTime =
      this.stats.responseTimes.length > 0
        ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
        : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      memorySize: this.stats.size,
      memoryEntries: this.cache.size,
      persistentEntries: 0, // Will be updated by persistent cache
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      avgResponseTime,
    };
  }
}

// ============================================================================
// PERSISTENT CACHE (localStorage)
// ============================================================================

class PersistentCache {
  private prefix = 'panacea_cache_';
  private stats = {
    hits: 0,
    misses: 0,
  };

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    if (!this.isAvailable()) return;

    const ttl = options.ttl || 5 * 60 * 1000;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    try {
      const serialized = options.serialize ? options.serialize(entry) : JSON.stringify(entry);

      localStorage.setItem(this.prefix + key, serialized);
    } catch (error) {
      console.warn('Failed to persist cache entry:', error);
      // localStorage might be full, try to clean up
      this.cleanup();
    }
  }

  get<T>(key: string, options: CacheOptions = {}): CacheEntry<T> | null {
    if (!this.isAvailable()) {
      this.stats.misses++;
      return null;
    }

    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) {
        this.stats.misses++;
        return null;
      }

      const entry = options.deserialize
        ? (options.deserialize(item) as CacheEntry<T>)
        : (JSON.parse(item) as CacheEntry<T>);

      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.delete(key);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return entry;
    } catch (error) {
      console.warn('Failed to read cache entry:', error);
      this.stats.misses++;
      return null;
    }
  }

  delete(key: string): void {
    if (!this.isAvailable()) return;
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    if (!this.isAvailable()) return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  private isAvailable(): boolean {
    try {
      const testKey = this.prefix + 'test';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  private cleanup(): void {
    if (!this.isAvailable()) return;

    const now = Date.now();
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const entry = JSON.parse(item) as CacheEntry;
            if (now - entry.timestamp > entry.ttl) {
              keysToRemove.push(key);
            }
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }

  getEntryCount(): number {
    if (!this.isAvailable()) return 0;

    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        count++;
      }
    }
    return count;
  }

  getStats() {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
    };
  }
}

// ============================================================================
// MULTI-LAYER CACHE
// ============================================================================

export class MultiLayerCache {
  private memoryCache: MemoryCache;
  private persistentCache: PersistentCache;
  private options: CacheOptions;

  constructor(options: CacheOptions = {}) {
    this.memoryCache = new MemoryCache(options.maxSize);
    this.persistentCache = new PersistentCache();
    this.options = {
      ttl: 5 * 60 * 1000, // 5 minutes
      persist: false,
      maxSize: 10 * 1024 * 1024, // 10MB
      staleWhileRevalidate: false,
      ...options,
    };
  }

  async set<T>(key: string, data: T, options: Partial<CacheOptions> = {}): Promise<void> {
    const mergedOptions = { ...this.options, ...options };

    // Store in memory cache
    this.memoryCache.set(key, data, mergedOptions);

    // Store in persistent cache if enabled
    if (mergedOptions.persist) {
      this.persistentCache.set(key, data, mergedOptions);
    }
  }

  async get<T>(
    key: string,
    options: Partial<CacheOptions> = {}
  ): Promise<{ data: T | null; source: 'memory' | 'persistent' | 'none' }> {
    const mergedOptions = { ...this.options, ...options };

    // Try memory cache first
    const memoryEntry = this.memoryCache.get<T>(key);
    if (memoryEntry) {
      return { data: memoryEntry.data, source: 'memory' };
    }

    // Try persistent cache if enabled
    if (mergedOptions.persist) {
      const persistentEntry = this.persistentCache.get<T>(key, mergedOptions);
      if (persistentEntry) {
        // Populate memory cache
        this.memoryCache.set(key, persistentEntry.data, mergedOptions);
        return { data: persistentEntry.data, source: 'persistent' };
      }
    }

    return { data: null, source: 'none' };
  }

  async getWithFallback<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: Partial<CacheOptions> = {}
  ): Promise<{ data: T; source: 'cache' | 'network'; stale: boolean }> {
    const mergedOptions = { ...this.options, ...options };
    const cacheResult = await this.get<T>(key, mergedOptions);

    if (cacheResult.data !== null) {
      const entry = this.memoryCache.get(key) || this.persistentCache.get(key, mergedOptions);
      const isStale = entry ? Date.now() - entry.timestamp > entry.ttl * 0.8 : false; // 80% of TTL

      // If stale and staleWhileRevalidate is enabled, fetch in background
      if (isStale && mergedOptions.staleWhileRevalidate) {
        fetchFn()
          .then((freshData) => {
            this.set(key, freshData, mergedOptions);
          })
          .catch(() => {
            // Silently fail background refresh
          });
      }

      return {
        data: cacheResult.data,
        source: 'cache',
        stale: isStale,
      };
    }

    // Cache miss, fetch from network
    const freshData = await fetchFn();
    await this.set(key, freshData, mergedOptions);

    return {
      data: freshData,
      source: 'network',
      stale: false,
    };
  }

  delete(key: string): void {
    this.memoryCache.delete(key);
    this.persistentCache.delete(key);
  }

  clear(): void {
    this.memoryCache.clear();
    this.persistentCache.clear();
  }

  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const persistentEntries = this.persistentCache.getEntryCount();

    return {
      ...memoryStats,
      persistentEntries,
    };
  }
}

// ============================================================================
// REACT HOOKS
// ============================================================================

/**
 * Hook for caching data with automatic invalidation
 */
export function useCache<T = any>(
  key: string,
  fetchFn?: () => Promise<T>,
  options: CacheOptions = {}
) {
  const [cache] = useState(() => new MultiLayerCache(options));
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<'cache' | 'network' | null>(null);
  const [stale, setStale] = useState(false);

  const fetchData = useCallback(async () => {
    if (!fetchFn) return;

    setLoading(true);
    setError(null);

    try {
      const result = await cache.getWithFallback(key, fetchFn, options);
      setData(result.data);
      setSource(result.source);
      setStale(result.stale);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch data'));
    } finally {
      setLoading(false);
    }
  }, [key, fetchFn, cache, options]);

  const setCacheData = useCallback(
    (newData: T) => {
      cache.set(key, newData, options);
      setData(newData);
      setSource('cache');
    },
    [key, cache, options]
  );

  const invalidate = useCallback(() => {
    cache.delete(key);
    setData(null);
    setSource(null);
  }, [key, cache]);

  // Auto-fetch on mount if fetchFn provided
  useEffect(() => {
    if (fetchFn) {
      fetchData();
    }
  }, [fetchFn, fetchData]);

  return {
    data,
    loading,
    error,
    source,
    stale,
    fetchData,
    setCacheData,
    invalidate,
    cache,
  };
}

/**
 * Hook for caching API responses with automatic refresh
 */
export function useApiCache<T = any>(
  key: string,
  url: string,
  options: CacheOptions & {
    fetchOptions?: RequestInit;
    autoRefresh?: boolean;
    refreshInterval?: number;
  } = {}
) {
  const {
    fetchOptions = {},
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    ...cacheOptions
  } = options;

  const fetchFn = useCallback(async (): Promise<T> => {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }, [url, fetchOptions]);

  const cache = useCache<T>(key, fetchFn, cacheOptions);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !cache.source) return;

    const interval = setInterval(() => {
      cache.fetchData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, cache]);

  return cache;
}

// ============================================================================
// CACHE STRATEGIES
// ============================================================================

export const CacheStrategies = {
  /**
   * Cache-First: Try cache, fall back to network
   */
  cacheFirst: async <T,>(
    key: string,
    fetchFn: () => Promise<T>,
    cache: MultiLayerCache,
    options: CacheOptions = {}
  ): Promise<T> => {
    const result = await cache.get<T>(key, options);
    if (result.data !== null) {
      return result.data;
    }

    const freshData = await fetchFn();
    await cache.set(key, freshData, options);
    return freshData;
  },

  /**
   * Network-First: Try network, fall back to cache
   */
  networkFirst: async <T,>(
    key: string,
    fetchFn: () => Promise<T>,
    cache: MultiLayerCache,
    options: CacheOptions = {}
  ): Promise<T> => {
    try {
      const freshData = await fetchFn();
      await cache.set(key, freshData, options);
      return freshData;
    } catch (error) {
      const result = await cache.get<T>(key, options);
      if (result.data !== null) {
        return result.data;
      }
      throw error;
    }
  },

  /**
   * Stale-While-Revalidate: Return cached immediately, fetch fresh in background
   */
  staleWhileRevalidate: async <T,>(
    key: string,
    fetchFn: () => Promise<T>,
    cache: MultiLayerCache,
    options: CacheOptions = {}
  ): Promise<T> => {
    const result = await cache.get<T>(key, options);

    // Fetch fresh data in background
    fetchFn()
      .then((freshData) => cache.set(key, freshData, options))
      .catch(() => {
        // Silently fail background refresh
      });

    if (result.data !== null) {
      return result.data;
    }

    // If no cache, wait for network
    const freshData = await fetchFn();
    await cache.set(key, freshData, options);
    return freshData;
  },

  /**
   * Cache-Only: Only use cache, never network
   */
  cacheOnly: async <T,>(
    key: string,
    cache: MultiLayerCache,
    options: CacheOptions = {}
  ): Promise<T | null> => {
    const result = await cache.get<T>(key, options);
    return result.data;
  },

  /**
   * Network-Only: Only use network, never cache
   */
  networkOnly: async <T,>(fetchFn: () => Promise<T>): Promise<T> => {
    return fetchFn();
  },
};

// ============================================================================
// CACHE MANAGER (Singleton)
// ============================================================================

class CacheManager {
  private static instance: CacheManager;
  private caches = new Map<string, MultiLayerCache>();

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  getCache(name: string, options: CacheOptions = {}): MultiLayerCache {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MultiLayerCache(options));
    }
    return this.caches.get(name)!;
  }

  clearCache(name: string): void {
    const cache = this.caches.get(name);
    if (cache) {
      cache.clear();
    }
  }

  clearAll(): void {
    this.caches.forEach((cache) => cache.clear());
    this.caches.clear();
  }

  getStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    return stats;
  }
}

export const cacheManager = CacheManager.getInstance();

// ============================================================================
// CACHE MIDDLEWARE FOR FETCH
// ============================================================================

export function createCachedFetch(
  cache: MultiLayerCache,
  strategy: keyof typeof CacheStrategies = 'cacheFirst'
) {
  return async function cachedFetch<T = any>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string
  ): Promise<T> {
    const key = cacheKey || `fetch:${url}:${JSON.stringify(options)}`;

    const fetchFn = async (): Promise<T> => {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Extract cache headers
      const etag = response.headers.get('etag');
      const lastModified = response.headers.get('last-modified');

      const data = await response.json();

      // Store with cache headers
      await cache.set(key, data, {
        etag,
        lastModified,
        ttl: 5 * 60 * 1000, // 5 minutes default
      });

      return data;
    };

    return CacheStrategies[strategy](key, fetchFn, cache);
  };
}

// CacheDashboard moved to lib/utils/CacheDashboard.tsx
