/**
 * Cloudflare KV Cache Service
 * 
 * Provides caching layer for hot-path data using Cloudflare KV.
 * Reduces database load for frequently accessed medical content.
 * 
 * Hot paths cached:
 * - High-yield condition data
 * - System-specific content lists
 * - Drug/lab reference data
 * - User statistics (short TTL)
 */

interface CacheOptions {
  ttl?: number; // Time-to-live in seconds
  namespace?: string;
}

// Import KVNamespace type from @cloudflare/workers-types
type KVNamespace = {
  get(key: string, type?: 'text'): Promise<string | null>;
  get(key: string, type: 'json'): Promise<any | null>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expirationTtl?: number; expiration?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: any }>; list_complete: boolean; cursor?: string }>;
};

interface CloudflareEnv {
  CACHE?: KVNamespace;
  DATABASE_URL?: string;
}

const DEFAULT_TTL = 3600; // 1 hour
const SHORT_TTL = 300; // 5 minutes
const LONG_TTL = 86400; // 24 hours

/**
 * Cache key prefixes for organization
 */
const CACHE_KEYS = {
  CONDITION: 'condition:',
  SYSTEM_CONDITIONS: 'system:conditions:',
  HIGH_YIELD: 'conditions:high-yield',
  DRUG: 'drug:',
  LAB: 'lab:',
  USER_STATS: 'user:stats:',
  POOL_STATUS: 'pool:status:',
} as const;

/**
 * Get cached value or fetch from source
 */
export async function getOrSet<T>(
  env: CloudflareEnv,
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = DEFAULT_TTL } = options;

  // Check if KV is available
  if (!env.CACHE) {
    console.warn('[KV Cache] KV namespace not configured, fetching directly');
    return fetchFn();
  }

  // Try to get from cache
  try {
    const cached = await env.CACHE.get(key, 'json');
    if (cached) {
      console.log(`[KV Cache] HIT: ${key}`);
      return cached as T;
    }
  } catch (error) {
    console.error('[KV Cache] Error reading from cache:', error);
  }

  // Cache miss - fetch and store
  console.log(`[KV Cache] MISS: ${key}`);
  const data = await fetchFn();

  // Store in cache (non-blocking)
  try {
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
    console.log(`[KV Cache] STORED: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.error('[KV Cache] Error writing to cache:', error);
  }

  return data;
}

/**
 * Invalidate a specific cache key
 */
export async function invalidate(env: CloudflareEnv, key: string): Promise<void> {
  if (!env.CACHE) return;

  try {
    await env.CACHE.delete(key);
    console.log(`[KV Cache] INVALIDATED: ${key}`);
  } catch (error) {
    console.error('[KV Cache] Error invalidating cache:', error);
  }
}

/**
 * Invalidate multiple cache keys with a prefix
 */
export async function invalidatePrefix(env: CloudflareEnv, prefix: string): Promise<void> {
  if (!env.CACHE) return;

  try {
    // List all keys with prefix
    const list = await env.CACHE.list({ prefix });
    
    // Delete each key
    await Promise.all(
      list.keys.map(({ name }) => env.CACHE!.delete(name))
    );
    
    console.log(`[KV Cache] INVALIDATED PREFIX: ${prefix} (${list.keys.length} keys)`);
  } catch (error) {
    console.error('[KV Cache] Error invalidating prefix:', error);
  }
}

/**
 * Helper: Cache condition data
 */
export async function getCachedCondition<T>(
  env: CloudflareEnv,
  conditionId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  return getOrSet(env, CACHE_KEYS.CONDITION + conditionId, fetchFn, {
    ttl: LONG_TTL, // Condition data rarely changes
  });
}

/**
 * Helper: Cache system conditions list
 */
export async function getCachedSystemConditions(
  env: CloudflareEnv,
  system: string,
  fetchFn: () => Promise<string[]>
): Promise<string[]> {
  return getOrSet(env, CACHE_KEYS.SYSTEM_CONDITIONS + system, fetchFn, {
    ttl: LONG_TTL,
  });
}

/**
 * Helper: Cache high-yield conditions
 */
export async function getCachedHighYieldConditions<T>(
  env: CloudflareEnv,
  fetchFn: () => Promise<T>
): Promise<T> {
  return getOrSet(env, CACHE_KEYS.HIGH_YIELD, fetchFn, {
    ttl: LONG_TTL,
  });
}

/**
 * Helper: Cache user stats (short TTL for freshness)
 */
export async function getCachedUserStats<T>(
  env: CloudflareEnv,
  userId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  return getOrSet(env, CACHE_KEYS.USER_STATS + userId, fetchFn, {
    ttl: SHORT_TTL, // Refresh every 5 minutes
  });
}

/**
 * Helper: Cache question pool status
 */
export async function getCachedPoolStatus<T>(
  env: CloudflareEnv,
  userId: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  return getOrSet(env, CACHE_KEYS.POOL_STATUS + userId, fetchFn, {
    ttl: SHORT_TTL,
  });
}

/**
 * Helper: Invalidate user-specific caches after data changes
 */
export async function invalidateUserCache(env: CloudflareEnv, userId: string): Promise<void> {
  await Promise.all([
    invalidate(env, CACHE_KEYS.USER_STATS + userId),
    invalidate(env, CACHE_KEYS.POOL_STATUS + userId),
  ]);
}

/**
 * Helper: Warm up cache with frequently accessed data
 * Call this during application startup or on scheduled worker
 */
export async function warmCache(env: CloudflareEnv, prisma: any): Promise<void> {
  console.log('[KV Cache] Warming cache...');
  
  try {
    // Cache high-yield conditions
    const highYieldConditions = await prisma.medicalContent.findMany({
      where: { isHighYield: true, status: 'published' },
      select: { conditionId: true, title: true, system: true },
    });
    
    await getOrSet(env, CACHE_KEYS.HIGH_YIELD, async () => highYieldConditions, {
      ttl: LONG_TTL,
    });

    // Cache system lists
    const systems = ['CV', 'RESP', 'GI', 'NEURO', 'ENDO', 'DERM', 'MSK', 'PSYCH', 'ID', 'GU', 'HEME', 'IMMUNO', 'REPRO', 'EYE_ENT'];
    
    for (const system of systems) {
      const conditions = await prisma.medicalContent.findMany({
        where: { 
          OR: [
            { system },
            { relatedSystems: { has: system } }
          ],
          status: 'published'
        },
        select: { conditionId: true },
      });
      
      await getOrSet(env, CACHE_KEYS.SYSTEM_CONDITIONS + system, 
        async () => conditions.map((c: any) => c.conditionId),
        { ttl: LONG_TTL }
      );
    }

    console.log('[KV Cache] Cache warmed successfully');
  } catch (error) {
    console.error('[KV Cache] Error warming cache:', error);
  }
}

export { CACHE_KEYS };