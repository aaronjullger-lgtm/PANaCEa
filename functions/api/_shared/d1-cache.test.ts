import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  d1Get,
  d1Set,
  d1SetPermanent,
  d1Delete,
  d1Has,
  d1Ttl,
  d1GetOrSet,
  d1InvalidatePrefix,
  d1PurgeExpired,
  d1GetBatch,
  d1SetBatch,
  d1ListKeys,
  d1Count,
  isD1Available,
  D1_PREFIX,
  D1_TTL,
  SHORT_TTL,
  LONG_TTL,
  WEEK_TTL,
} from './d1-cache';
import type { D1Database } from './types';

// ─── Mock D1 Database ───────────────────────────────────────────────────────

type StoreEntry = { value: string; expires_at: number | null };

function createMockD1() {
  const store = new Map<string, StoreEntry>();

  function now() {
    return Math.floor(Date.now() / 1000);
  }

  function isExpired(entry: StoreEntry): boolean {
    return entry.expires_at !== null && entry.expires_at <= now();
  }

  return {
    store,

    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              // SELECT with key = ? pattern
              if (sql.includes('WHERE key = ?')) {
                const key = params[0] as string;
                const entry = store.get(key);
                if (!entry || isExpired(entry)) return null;
                return { key, value: entry.value, expires_at: entry.expires_at } as T;
              }
              // COUNT(*) query
              if (sql.includes('COUNT(*)')) {
                let count = 0;
                for (const [, entry] of store.entries()) {
                  if (!isExpired(entry)) count++;
                }
                return { count } as T;
              }
              // SELECT expires_at for TTL
              if (sql.includes('SELECT expires_at')) {
                const key = params[0] as string;
                const entry = store.get(key);
                if (!entry) return null;
                return { expires_at: entry.expires_at } as T;
              }
              // SELECT 1 for has check
              if (sql.includes('SELECT 1')) {
                const key = params[0] as string;
                const entry = store.get(key);
                if (!entry || isExpired(entry)) return null;
                return { '1': 1 } as T;
              }
              return null;
            },

            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
              const results: T[] = [];
              const prefixParam = params[0] as string | undefined;
              const limitParam = params[params.length - 1];

              for (const [key, entry] of store.entries()) {
                if (isExpired(entry)) continue;
                if (prefixParam && !key.startsWith(prefixParam.replace(/%$/, ''))) continue;
                results.push({ key, value: entry.value, expires_at: entry.expires_at } as T);
                if (typeof limitParam === 'number' && results.length >= limitParam) break;
              }
              return { results };
            },

            async run(): Promise<{ meta: { changes: number } }> {
              let changes = 0;

              if (sql.includes('INSERT OR REPLACE')) {
                const key = params[0] as string;
                const value = params[1] as string;
                const expires_at = (params[2] as number | null) ?? null;
                store.set(key, { value, expires_at });
                changes = 1;
              } else if (sql.includes('DELETE')) {
                const pattern = params[0] as string;
                const prefix = pattern.replace(/%$/, '');
                for (const [k] of store.entries()) {
                  if (k.startsWith(prefix)) {
                    store.delete(k);
                    changes++;
                  }
                }
              }

              return { meta: { changes } };
            },
          };
        },
      };
    },

    async batch(_statements: unknown[]): Promise<unknown[]> {
      return _statements.map(() => ({ meta: { changes: 0 } }));
    },

    async exec(): Promise<unknown> {
      return {};
    },

    async raw(): Promise<unknown[][]> {
      return [];
    },

    async first<T = Record<string, unknown>>(): Promise<T | null> {
      return null;
    },
  } as unknown as D1Database;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('d1-cache', () => {
  let db: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    db = createMockD1();
    vi.clearAllMocks();
  });

  describe('d1Get / d1Set', () => {
    it('should store and retrieve a value', async () => {
      await d1Set(db as unknown as D1Database, 'test:key', { foo: 'bar' }, 60);
      const result = await d1Get<{ foo: string }>(db as unknown as D1Database, 'test:key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for missing keys', async () => {
      const result = await d1Get(db as unknown as D1Database, 'missing:key');
      expect(result).toBeNull();
    });

    it('should return null when db is undefined', async () => {
      const result = await d1Get(undefined, 'test:key');
      expect(result).toBeNull();
    });

    it('should store strings, numbers, and booleans', async () => {
      await d1Set(db as unknown as D1Database, 'str', 'hello', 60);
      await d1Set(db as unknown as D1Database, 'num', 42, 60);
      await d1Set(db as unknown as D1Database, 'bool', true, 60);

      expect(await d1Get(db as unknown as D1Database, 'str')).toBe('hello');
      expect(await d1Get(db as unknown as D1Database, 'num')).toBe(42);
      expect(await d1Get(db as unknown as D1Database, 'bool')).toBe(true);
    });
  });

  describe('d1SetPermanent', () => {
    it('should store with null expiry', async () => {
      await d1SetPermanent(db as unknown as D1Database, 'perm:key', { data: 1 });
      const entry = (db as unknown as { store: Map<string, StoreEntry> }).store.get('perm:key');
      expect(entry?.expires_at).toBeNull();
    });
  });

  describe('d1Delete', () => {
    it('should remove a key', async () => {
      await d1Set(db as unknown as D1Database, 'del:key', 'value', 60);
      await d1Delete(db as unknown as D1Database, 'del:key');
      const result = await d1Get(db as unknown as D1Database, 'del:key');
      expect(result).toBeNull();
    });
  });

  describe('d1Has', () => {
    it('should return true for existing keys', async () => {
      await d1Set(db as unknown as D1Database, 'has:key', 'value', 60);
      expect(await d1Has(db as unknown as D1Database, 'has:key')).toBe(true);
    });

    it('should return false for missing keys', async () => {
      expect(await d1Has(db as unknown as D1Database, 'has:missing')).toBe(false);
    });
  });

  describe('d1Ttl', () => {
    it('should return -1 for missing keys', async () => {
      expect(await d1Ttl(db as unknown as D1Database, 'ttl:missing')).toBe(-1);
    });

    it('should return -2 for permanent keys', async () => {
      await d1SetPermanent(db as unknown as D1Database, 'ttl:perm', 'val');
      expect(await d1Ttl(db as unknown as D1Database, 'ttl:perm')).toBe(-2);
    });

    it('should return positive TTL for keys with expiry', async () => {
      await d1Set(db as unknown as D1Database, 'ttl:exp', 'val', 3600);
      const ttl = await d1Ttl(db as unknown as D1Database, 'ttl:exp');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('d1GetOrSet', () => {
    it('should return cached value on hit', async () => {
      await d1Set(db as unknown as D1Database, 'gos:key', 'cached', 60);
      const fetchFn = vi.fn(async () => 'fetched');
      const result = await d1GetOrSet(db as unknown as D1Database, 'gos:key', fetchFn, 60);
      expect(result).toBe('cached');
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache on miss', async () => {
      const fetchFn = vi.fn(async () => 'fetched');
      const result = await d1GetOrSet(db as unknown as D1Database, 'gos:miss', fetchFn, 60);
      expect(result).toBe('fetched');
      expect(fetchFn).toHaveBeenCalledOnce();
      const cached = await d1Get(db as unknown as D1Database, 'gos:miss');
      expect(cached).toBe('fetched');
    });
  });

  describe('d1InvalidatePrefix', () => {
    it('should delete all keys with matching prefix', async () => {
      await d1Set(db as unknown as D1Database, 'user:abc:1', 'a', 60);
      await d1Set(db as unknown as D1Database, 'user:abc:2', 'b', 60);
      await d1Set(db as unknown as D1Database, 'user:def:1', 'c', 60);

      const deleted = await d1InvalidatePrefix(db as unknown as D1Database, 'user:abc:');
      expect(deleted).toBeGreaterThanOrEqual(2);
      expect(await d1Get(db as unknown as D1Database, 'user:abc:1')).toBeNull();
      expect(await d1Get(db as unknown as D1Database, 'user:abc:2')).toBeNull();
      expect(await d1Get(db as unknown as D1Database, 'user:def:1')).toBe('c');
    });
  });

  describe('d1PurgeExpired', () => {
    it('should return 0 when db is undefined', async () => {
      const result = await d1PurgeExpired(undefined);
      expect(result).toBe(0);
    });
  });

  describe('d1GetBatch', () => {
    it('should return empty map for undefined db', async () => {
      const result = await d1GetBatch(undefined, ['a', 'b']);
      expect(result.size).toBe(0);
    });

    it('should return empty map for empty keys array', async () => {
      const result = await d1GetBatch(db as unknown as D1Database, []);
      expect(result.size).toBe(0);
    });
  });

  describe('d1SetBatch', () => {
    it('should return early for undefined db', async () => {
      await d1SetBatch(undefined, [{ key: 'a', value: 1 }]);
      // No error thrown
    });

    it('should return early for empty entries', async () => {
      await d1SetBatch(db as unknown as D1Database, []);
      // No error thrown
    });
  });

  describe('d1ListKeys', () => {
    it('should return empty array for undefined db', async () => {
      const result = await d1ListKeys(undefined, 'prefix:');
      expect(result).toEqual([]);
    });
  });

  describe('d1Count', () => {
    it('should return 0 for undefined db', async () => {
      const result = await d1Count(undefined);
      expect(result).toBe(0);
    });
  });

  describe('isD1Available', () => {
    it('should return true when db is defined', () => {
      expect(isD1Available(db as unknown as D1Database)).toBe(true);
    });

    it('should return false when db is undefined', () => {
      expect(isD1Available(undefined)).toBe(false);
    });
  });

  describe('constants', () => {
    it('should have correct TTL values', () => {
      expect(SHORT_TTL).toBe(300);
      expect(LONG_TTL).toBe(86400);
      expect(WEEK_TTL).toBe(604800);
    });

    it('should have prefix constants', () => {
      expect(D1_PREFIX.CONDITION).toBe('condition:');
      expect(D1_PREFIX.QUESTION_POOL).toBe('question_pool:');
      expect(D1_PREFIX.USER_STATS).toBe('user_stats:');
    });

    it('should have TTL constants', () => {
      expect(D1_TTL.CONDITION).toBe(3600);
      expect(D1_TTL.QUESTION_POOL).toBe(300);
      expect(D1_TTL.USER_STATS).toBe(600);
    });
  });
});
