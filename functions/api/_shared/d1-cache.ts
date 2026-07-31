/**
 * D1-Backed Edge Cache
 *
 * Structured caching layer over Cloudflare D1 (SQLite at the edge).
 * Complements the existing KV cache (cache.ts, kv-cache.ts) with:
 * - SQL-queryable keys (prefix scan, pattern matching, aggregation)
 * - Persistent TTL via expires_at column (no KV eventual consistency)
 * - User-scoped cache invalidation (DELETE WHERE key LIKE 'user:123:%')
 * - Cache metrics via SQL aggregation (no separate metrics key)
 *
 * Table: edge_cache (key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER)
 *
 * Usage:
 *   import { d1Get, d1Set, d1GetOrSet, d1InvalidatePrefix } from '../_shared/d1-cache';
 *
 *   // Simple get/set
 *   const cached = await d1Get<MyType>(env.EDGE_DB, 'condition:chf');
 *   await d1Set(env.EDGE_DB, 'condition:chf', data, 3600);
 *
 *   // Get-or-set (fetch-on-miss)
 *   const data = await d1GetOrSet(env.EDGE_DB, 'user:abc:stats', () => fetchStats(), 300);
 *
 *   // Prefix invalidation
 *   await d1InvalidatePrefix(env.EDGE_DB, 'user:abc:');
 *
 * @module functions/api/_shared/d1-cache
 */

import type { D1Database } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

interface D1CacheEntry {
  key: string;
  value: string;
  expires_at: number | null;
}

export interface D1CacheMetrics {
  hits: number;
  misses: number;
  expired: number;
  sets: number;
  deletes: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default TTL: 1 hour */
const DEFAULT_TTL = 3600;

/** Short TTL: 5 minutes */
export const SHORT_TTL = 300;

/** Long TTL: 24 hours */
export const LONG_TTL = 86400;

/** Week TTL: 7 days */
export const WEEK_TTL = 604800;

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Get a cached value by key.
 * Returns null if not found or expired.
 */
export async function d1Get<T>(
  db: D1Database | undefined,
  key: string,
): Promise<T | null> {
  if (!db) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .prepare('SELECT key, value, expires_at FROM edge_cache WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)')
      .bind(key, now)
      .first<D1CacheEntry>();

    if (!result) return null;

    return JSON.parse(result.value) as T;
  } catch (err) {
    console.error('[d1-cache] get error:', err);
    return null;
  }
}

/**
 * Set a cached value with TTL in seconds.
 * Uses upsert (INSERT OR REPLACE) for atomic writes.
 */
export async function d1Set<T>(
  db: D1Database | undefined,
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<void> {
  if (!db) return;

  try {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    await db
      .prepare('INSERT OR REPLACE INTO edge_cache (key, value, expires_at) VALUES (?1, ?2, ?3)')
      .bind(key, JSON.stringify(value), expiresAt)
      .run();
  } catch (err) {
    console.error('[d1-cache] set error:', err);
  }
}

/**
 * Set a cached value that never expires.
 * Useful for semi-permanent reference data.
 */
export async function d1SetPermanent<T>(
  db: D1Database | undefined,
  key: string,
  value: T,
): Promise<void> {
  if (!db) return;

  try {
    await db
      .prepare('INSERT OR REPLACE INTO edge_cache (key, value, expires_at) VALUES (?1, ?2, NULL)')
      .bind(key, JSON.stringify(value))
      .run();
  } catch (err) {
    console.error('[d1-cache] setPermanent error:', err);
  }
}

/**
 * Delete a cached value by key.
 */
export async function d1Delete(
  db: D1Database | undefined,
  key: string,
): Promise<void> {
  if (!db) return;

  try {
    await db.prepare('DELETE FROM edge_cache WHERE key = ?1').bind(key).run();
  } catch (err) {
    console.error('[d1-cache] delete error:', err);
  }
}

/**
 * Check if a key exists (and is not expired) without reading the value.
 */
export async function d1Has(
  db: D1Database | undefined,
  key: string,
): Promise<boolean> {
  if (!db) return false;

  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .prepare('SELECT 1 FROM edge_cache WHERE key = ?1 AND (expires_at IS NULL OR expires_at > ?2)')
      .bind(key, now)
      .first<{ '1': number }>();

    return result !== null;
  } catch (err) {
    console.error('[d1-cache] has error:', err);
    return false;
  }
}

/**
 * Get remaining TTL for a key in seconds.
 * Returns -1 if not found, 0 if expired, -2 if permanent (no expiry).
 */
export async function d1Ttl(
  db: D1Database | undefined,
  key: string,
): Promise<number> {
  if (!db) return -1;

  try {
    const result = await db
      .prepare('SELECT expires_at FROM edge_cache WHERE key = ?1')
      .bind(key)
      .first<{ expires_at: number | null }>();

    if (!result) return -1;
    if (result.expires_at === null) return -2; // permanent

    const now = Math.floor(Date.now() / 1000);
    const remaining = result.expires_at - now;
    return remaining > 0 ? remaining : 0;
  } catch (err) {
    console.error('[d1-cache] ttl error:', err);
    return -1;
  }
}

// ─── Compound Operations ────────────────────────────────────────────────────

/**
 * Get-or-set: return cached value, or fetch + cache on miss.
 * The fetch function is only called on cache miss.
 */
export async function d1GetOrSet<T>(
  db: D1Database | undefined,
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<T> {
  const cached = await d1Get<T>(db, key);
  if (cached !== null) return cached;

  const data = await fetchFn();
  await d1Set(db, key, data, ttlSeconds);
  return data;
}

/**
 * Invalidate all keys matching a SQL LIKE pattern.
 * Uses D1's SQL capabilities for prefix/pattern invalidation.
 *
 * Examples:
 *   d1InvalidatePrefix(db, 'user:abc:')      — all keys for user abc
 *   d1InvalidatePrefix(db, 'condition:%')     — all condition caches
 *   d1InvalidatePrefix(db, 'pool:%:%:cardio') — specific pool filters
 */
export async function d1InvalidatePrefix(
  db: D1Database | undefined,
  prefix: string,
): Promise<number> {
  if (!db) return 0;

  try {
    // D1 doesn't support parameterized LIKE with % in bind params,
    // so we concatenate the prefix with % for the LIKE pattern
    const result = await db
      .prepare(`DELETE FROM edge_cache WHERE key LIKE ?1`)
      .bind(`${prefix}%`)
      .run();

    return (result.meta?.changes as number) ?? 0;
  } catch (err) {
    console.error('[d1-cache] invalidatePrefix error:', err);
    return 0;
  }
}

/**
 * Bulk delete all expired entries.
 * Run periodically via cron or on cache-miss path to keep table small.
 */
export async function d1PurgeExpired(
  db: D1Database | undefined,
): Promise<number> {
  if (!db) return 0;

  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .prepare('DELETE FROM edge_cache WHERE expires_at IS NOT NULL AND expires_at <= ?1')
      .bind(now)
      .run();

    return (result.meta?.changes as number) ?? 0;
  } catch (err) {
    console.error('[d1-cache] purgeExpired error:', err);
    return 0;
  }
}

// ─── Batch Operations ───────────────────────────────────────────────────────

/**
 * Get multiple keys in a single query.
 * More efficient than individual get() calls.
 */
export async function d1GetBatch<T>(
  db: D1Database | undefined,
  keys: string[],
): Promise<Map<string, T>> {
  const result = new Map<string, T>();
  if (!db || keys.length === 0) return result;

  try {
    const now = Math.floor(Date.now() / 1000);
    // D1 supports up to ~100 bind params per query; batch in chunks of 50
    const CHUNK_SIZE = 50;
    for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
      const chunk = keys.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map((_, idx) => `?${idx + 1}`).join(',');
      const stmt = db
        .prepare(`SELECT key, value, expires_at FROM edge_cache WHERE key IN (${placeholders}) AND (expires_at IS NULL OR expires_at > ?${chunk.length + 1})`)
        .bind(...chunk, now);

      const { results } = await stmt.all<D1CacheEntry>();
      for (const row of results ?? []) {
        try {
          result.set(row.key, JSON.parse(row.value) as T);
        } catch {
          // Skip malformed entries
        }
      }
    }
  } catch (err) {
    console.error('[d1-cache] getBatch error:', err);
  }

  return result;
}

/**
 * Set multiple key-value pairs in a batch.
 * Uses D1 batch() for atomic multi-statement execution.
 */
export async function d1SetBatch<T>(
  db: D1Database | undefined,
  entries: Array<{ key: string; value: T; ttlSeconds?: number }>,
): Promise<void> {
  if (!db || entries.length === 0) return;

  try {
    const now = Math.floor(Date.now() / 1000);
    const statements = entries.map((entry) => {
      const expiresAt = entry.ttlSeconds != null ? now + entry.ttlSeconds : null;
      return db
        .prepare('INSERT OR REPLACE INTO edge_cache (key, value, expires_at) VALUES (?1, ?2, ?3)')
        .bind(entry.key, JSON.stringify(entry.value), expiresAt);
    });

    await db.batch(statements);
  } catch (err) {
    console.error('[d1-cache] setBatch error:', err);
  }
}

// ─── Query Operations (D1 advantage over KV) ────────────────────────────────

/**
 * List all keys matching a prefix.
 * KV has this, but D1 gives you SQL-level filtering + pagination.
 */
export async function d1ListKeys(
  db: D1Database | undefined,
  prefix: string,
  limit: number = 100,
): Promise<string[]> {
  if (!db) return [];

  try {
    const { results } = await db
      .prepare('SELECT key FROM edge_cache WHERE key LIKE ?1 AND (expires_at IS NULL OR expires_at > ?2) LIMIT ?3')
      .bind(`${prefix}%`, Math.floor(Date.now() / 1000), limit)
      .all<{ key: string }>();

    return (results ?? []).map((r) => r.key);
  } catch (err) {
    console.error('[d1-cache] listKeys error:', err);
    return [];
  }
}

/**
 * Count entries matching a prefix.
 * Useful for dashboards and metrics.
 */
export async function d1Count(
  db: D1Database | undefined,
  prefix?: string,
): Promise<number> {
  if (!db) return 0;

  try {
    const now = Math.floor(Date.now() / 1000);
    let result: { count: number } | null;

    if (prefix) {
      result = await db
        .prepare('SELECT COUNT(*) as count FROM edge_cache WHERE key LIKE ?1 AND (expires_at IS NULL OR expires_at > ?2)')
        .bind(`${prefix}%`, now)
        .first<{ count: number }>();
    } else {
      result = await db
        .prepare('SELECT COUNT(*) as count FROM edge_cache WHERE expires_at IS NULL OR expires_at > ?1')
        .bind(now)
        .first<{ count: number }>();
    }

    return result?.count ?? 0;
  } catch (err) {
    console.error('[d1-cache] count error:', err);
    return 0;
  }
}

// ─── Convenience Wrappers (match cache.ts patterns) ─────────────────────────

/** Cache key prefix constants (mirror CACHE_CONFIG.PREFIX from cache.ts) */
export const D1_PREFIX = {
  CONDITION: 'condition:',
  QUESTION_POOL: 'question_pool:',
  USER_STATS: 'user_stats:',
  DRUG: 'drug:',
  GUIDELINE: 'guideline:',
  SYSTEM: 'system:',
  STUDY_PATH: 'study_path:',
  QUESTION_SEED: 'qseed:',
  SEMANTIC: 'sem:',
} as const;

/** Default TTL values (mirror CACHE_CONFIG.TTL from cache.ts) */
export const D1_TTL = {
  CONDITION: 3600,
  QUESTION_POOL: 300,
  USER_STATS: 600,
  DRUG: 3600,
  GUIDELINE: 7200,
  SYSTEM: 1800,
  STUDY_PATH: 3600,
} as const;

/**
 * Check if D1 is available (non-undefined binding).
 */
export function isD1Available(db: D1Database | undefined): db is D1Database {
  return db !== undefined && db !== null;
}
