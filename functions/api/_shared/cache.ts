// functions/api/_shared/cache.ts
// KV Cache utilities for CloudFlare Pages Functions

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  // TTL in seconds
  TTL: {
    CONDITION_DETAIL: 3600,        // 1 hour - medical content changes infrequently
    QUESTION_POOL: 300,             // 5 minutes - questions rotate frequently
    USER_STATS: 600,                // 10 minutes - stats update with each attempt
    DRUG_DETAIL: 3600,              // 1 hour - drug info is stable
    GUIDELINE_DETAIL: 7200,         // 2 hours - guidelines are very stable
    SYSTEM_METADATA: 1800,          // 30 minutes - system lists, categories
  },
  // Key prefixes for organization
  PREFIX: {
    CONDITION: 'condition:',
    QUESTION_POOL: 'question_pool:',
    USER_STATS: 'user_stats:',
    DRUG: 'drug:',
    GUIDELINE: 'guideline:',
    SYSTEM: 'system:',
    METRICS: 'metrics:',
  },
} as const;

/**
 * Cache hit/miss tracking for metrics
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  lastUpdated: string;
}

/**
 * Get data from KV cache
 * @param kv KV namespace binding
 * @param key Cache key
 * @param prefix Optional key prefix
 * @returns Cached data or null if not found
 */
export async function getFromCache<T>(
  kv: KVNamespace,
  key: string,
  prefix = ''
): Promise<T | null> {
  try {
    const fullKey = prefix + key;
    const cached = await kv.get(fullKey, { type: 'json' });
    
    if (cached) {
      // Track cache hit
      await trackCacheMetric(kv, 'hit');
      return cached as T;
    }
    
    // Track cache miss
    await trackCacheMetric(kv, 'miss');
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    await trackCacheMetric(kv, 'error');
    return null;
  }
}

/**
 * Set data in KV cache
 * @param kv KV namespace binding
 * @param key Cache key
 * @param value Data to cache
 * @param ttl Time to live in seconds
 * @param prefix Optional key prefix
 */
export async function setInCache<T>(
  kv: KVNamespace,
  key: string,
  value: T,
  ttl: number,
  prefix = ''
): Promise<void> {
  try {
    const fullKey = prefix + key;
    await kv.put(fullKey, JSON.stringify(value), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error('Cache set error:', error);
    await trackCacheMetric(kv, 'error');
  }
}

/**
 * Delete data from KV cache
 * @param kv KV namespace binding
 * @param key Cache key
 * @param prefix Optional key prefix
 */
export async function deleteFromCache(
  kv: KVNamespace,
  key: string,
  prefix = ''
): Promise<void> {
  try {
    const fullKey = prefix + key;
    await kv.delete(fullKey);
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

/**
 * Invalidate cache entries by prefix pattern
 * @param kv KV namespace binding
 * @param prefix Key prefix to invalidate
 */
export async function invalidateCacheByPrefix(
  kv: KVNamespace,
  prefix: string
): Promise<void> {
  try {
    // List all keys with prefix
    const keys = await kv.list({ prefix });
    
    // Delete all matching keys
    await Promise.all(
      keys.keys.map((key) => kv.delete(key.name))
    );
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Track cache metrics (hits, misses, errors)
 * @param kv KV namespace binding
 * @param type Metric type
 */
async function trackCacheMetric(
  kv: KVNamespace,
  type: 'hit' | 'miss' | 'error'
): Promise<void> {
  try {
    const metricsKey = CACHE_CONFIG.PREFIX.METRICS + 'daily';
    const cached = await kv.get(metricsKey, { type: 'json' }) as CacheMetrics | null;
    
    const metrics: CacheMetrics = cached || {
      hits: 0,
      misses: 0,
      errors: 0,
      lastUpdated: new Date().toISOString(),
    };
    
    // Increment the appropriate counter
    metrics[type === 'hit' ? 'hits' : type === 'miss' ? 'misses' : 'errors']++;
    metrics.lastUpdated = new Date().toISOString();
    
    // Store metrics with 24-hour TTL
    await kv.put(metricsKey, JSON.stringify(metrics), {
      expirationTtl: 86400, // 24 hours
    });
  } catch (error) {
    // Silently fail - metrics tracking shouldn't break the app
    console.error('Metrics tracking error:', error);
  }
}

/**
 * Get cache metrics
 * @param kv KV namespace binding
 * @returns Current cache metrics
 */
export async function getCacheMetrics(
  kv: KVNamespace
): Promise<CacheMetrics> {
  try {
    const metricsKey = CACHE_CONFIG.PREFIX.METRICS + 'daily';
    const cached = await kv.get(metricsKey, { type: 'json' }) as CacheMetrics | null;
    
    return cached || {
      hits: 0,
      misses: 0,
      errors: 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Get metrics error:', error);
    return {
      hits: 0,
      misses: 0,
      errors: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * Generate cache key for condition detail
 */
export function getConditionCacheKey(conditionId: string): string {
  return `${CACHE_CONFIG.PREFIX.CONDITION}${conditionId.toLowerCase()}`;
}

/**
 * Generate cache key for question pool
 */
export function getQuestionPoolCacheKey(
  filters: {
    system?: string;
    category?: string;
    difficulty?: string;
  }
): string {
  const parts: string[] = [CACHE_CONFIG.PREFIX.QUESTION_POOL];
  
  if (filters.system) parts.push(`sys:${filters.system}`);
  if (filters.category) parts.push(`cat:${filters.category}`);
  if (filters.difficulty) parts.push(`diff:${filters.difficulty}`);
  
  return parts.join(':');
}

/**
 * Generate cache key for user stats
 */
export function getUserStatsCacheKey(userId: string): string {
  return `${CACHE_CONFIG.PREFIX.USER_STATS}${userId}`;
}

/**
 * Generate cache key for drug detail
 */
export function getDrugCacheKey(drugId: string): string {
  return `${CACHE_CONFIG.PREFIX.DRUG}${drugId.toLowerCase()}`;
}

/**
 * Generate cache key for guideline detail
 */
export function getGuidelineCacheKey(guidelineId: string): string {
  return `${CACHE_CONFIG.PREFIX.GUIDELINE}${guidelineId.toLowerCase()}`;
}

/**
 * Check if KV namespace is available
 */
export function isKVAvailable(kv: KVNamespace | undefined): kv is KVNamespace {
  return kv !== undefined;
}
