/**
 * Prisma Client for Cloudflare Edge Runtime (Prisma 7)
 *
 * IMPORTANT: Cloudflare Workers/Pages Functions require Prisma Accelerate for database access.
 *
 * Prisma Accelerate is a connection pooler and query accelerator that works with edge runtimes.
 * It provides an HTTP API that's compatible with Cloudflare Workers.
 *
 * Setup Steps:
 * 1. Sign up for Prisma Accelerate: https://www.prisma.io/data-platform/accelerate
 * 2. Get your Accelerate connection string: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY
 * 3. Set DATABASE_URL environment variable in Cloudflare Pages to your Accelerate URL
 *
 * @see https://www.prisma.io/docs/accelerate
 * @see https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare
 */

// Prisma 7: Import from EDGE client for Cloudflare Workers (no Node.js binary)
// The /edge import provides a lightweight JS/WASM wrapper instead of the ~15MB Rust binary
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

/**
 * Prisma Accelerate Cache Strategy Configuration
 *
 * Use these presets for common query patterns:
 * - STATIC: Content that rarely changes (conditions, medical content) - 1 hour cache, 24h SWR
 * - QUESTIONS: Pre-generated questions - 5 min cache, 1h SWR (rotates frequently)
 * - USER_DATA: User-specific data - 1 min cache, 5 min SWR (changes often)
 * - REALTIME: No caching (sync operations, writes)
 *
 * @see https://www.prisma.io/docs/accelerate/caching
 */
export const CACHE_STRATEGY = {
  /** Static content: conditions, medical content, anatomy data - rarely changes */
  STATIC: { cacheStrategy: { ttl: 3600, swr: 86400 } }, // 1h cache, 24h stale-while-revalidate

  /** Question pool: rotates but doesn't change frequently */
  QUESTIONS: { cacheStrategy: { ttl: 300, swr: 3600 } }, // 5min cache, 1h SWR

  /** User-specific data: SRS items, saved questions */
  USER_DATA: { cacheStrategy: { ttl: 60, swr: 300 } }, // 1min cache, 5min SWR

  /** Lists and aggregates: system lists, counts */
  AGGREGATE: { cacheStrategy: { ttl: 1800, swr: 7200 } }, // 30min cache, 2h SWR

  /** No caching - for sync operations and writes */
  REALTIME: {},
} as const;

/**
 * Type for the Edge Prisma Client with Accelerate
 */
export type EdgePrismaClient = ReturnType<typeof createEdgePrismaClient>;

type DatabaseUrlInput =
  | string
  | { DATABASE_URL?: string | undefined }
  | { env?: { DATABASE_URL?: string | undefined } | undefined }
  | null
  | undefined;

// Global singleton cache per isolate (keyed by normalized DATABASE_URL)
// Reduces connection churn when multiple handlers run in the same isolate.
declare global {
  var __EDGE_PRISMA__: Map<string, EdgePrismaClient> | undefined;
}

function getSingletonCache(): Map<string, EdgePrismaClient> {
  if (typeof globalThis.__EDGE_PRISMA__ === 'undefined') {
    globalThis.__EDGE_PRISMA__ = new Map();
  }
  return globalThis.__EDGE_PRISMA__;
}

function normalizeDatabaseUrl(url: string): string {
  return url.trim();
}

/**
 * Creates a Prisma Client instance for Cloudflare Edge Runtime.
 * Reuses a single client per isolate when DATABASE_URL is the same (global singleton).
 *
 * Uses Prisma Accelerate for edge-compatible HTTP-based database access.
 *
 * PRODUCTION REQUIREMENTS:
 * - DATABASE_URL should be a Prisma Accelerate connection string (or Supabase Transaction Pooler on port 6543)
 * - Format: prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_KEY
 * - Get your key from: https://www.prisma.io/data-platform/accelerate
 * - Direct PostgreSQL URLs are dev-only; production must use Accelerate or pooler.
 *
 * The Accelerate extension provides:
 * - Edge-compatible HTTP-based database access
 * - Connection pooling optimized for serverless
 * - Query caching and performance optimization
 * - No need to bundle database drivers
 *
 * @param databaseUrl - Prisma Accelerate connection string
 * @returns Configured PrismaClient with Accelerate extension
 */
export function createEdgePrismaClient(databaseUrlOrEnv: DatabaseUrlInput) {
  const databaseUrl =
    typeof databaseUrlOrEnv === 'string'
      ? databaseUrlOrEnv
      : (databaseUrlOrEnv && 'DATABASE_URL' in databaseUrlOrEnv
          ? (databaseUrlOrEnv as any).DATABASE_URL
          : (databaseUrlOrEnv as any)?.env?.DATABASE_URL) || '';

  if (!databaseUrl) {
    console.error('[Prisma Edge] DATABASE_URL is missing');
    throw new Error(
      'DATABASE_URL is required. Set it in Cloudflare Pages environment variables.\n' +
        'For Cloudflare deployment, you must use Prisma Accelerate:\n' +
        '  Format: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY\n' +
        '  Sign up: https://www.prisma.io/data-platform/accelerate'
    );
  }

  const isAccelerateUrl =
    databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://');
  const isPostgresUrl =
    databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');

  // Warn if using direct PostgreSQL (won't work on Cloudflare Workers in production)
  if (isPostgresUrl) {
    console.warn(
      '[Prisma Edge] WARNING: Using direct PostgreSQL URL.\n' +
        'This may not work on Cloudflare Workers (no TCP support).\n' +
        'For production, use Prisma Accelerate: https://www.prisma.io/data-platform/accelerate'
    );
  }

  // Validate URL format
  if (!isAccelerateUrl && !isPostgresUrl) {
    console.error('[Prisma Edge] Invalid DATABASE_URL format:', databaseUrl.split('://')[0]);
    throw new Error(
      'DATABASE_URL must be either:\n' +
        '  1. Prisma Accelerate: prisma://... or prisma+postgres://...\n' +
        '  2. Direct PostgreSQL: postgresql://user:pass@host/db\n' +
        '  Current format: ' +
        databaseUrl.split('://')[0] +
        '://'
    );
  }

  try {
    const key = normalizeDatabaseUrl(databaseUrl);
    const cache = getSingletonCache();
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    // Prisma 7 with Accelerate: Use accelerateUrl in constructor
    // This is the new Prisma 7 approach for edge runtimes
    const PrismaClientAny = PrismaClient as any;
    const client = new PrismaClientAny({
      // For Accelerate URLs, use accelerateUrl
      // For direct PostgreSQL URLs, use datasourceUrl (development only)
      ...(isAccelerateUrl ? { accelerateUrl: databaseUrl } : { datasourceUrl: databaseUrl }),
      log: ['warn', 'error'], // Add logging for debugging
    });

    // Apply Accelerate extension for edge runtime HTTP-based queries
    const extendedClient = client.$extends(withAccelerate()) as EdgePrismaClient & {
      __isSingleton?: boolean;
    };
    (extendedClient as { __isSingleton?: boolean }).__isSingleton = true;
    cache.set(key, extendedClient);

    // Note: $on() is not available on extended clients, so we skip beforeExit hook
    // Singleton is not disconnected per request; isolate lifecycle handles cleanup.

    return extendedClient;
  } catch (error) {
    console.error('[Prisma Edge] Failed to create Prisma client:', error);
    console.error('[Prisma Edge] Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error(
      '[Prisma Edge] Error message:',
      error instanceof Error ? error.message : 'Unknown'
    );
    console.error('[Prisma Edge] Error stack:', error instanceof Error ? error.stack : 'No stack');
    throw new Error(
      'Failed to initialize Prisma Client. ' +
        'Error: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}

/**
 * Safely disconnect Prisma client with error handling.
 * Skips disconnect for singleton clients (reused per isolate); non-singleton clients are disconnected.
 */
export async function safePrismaDisconnect(prisma: EdgePrismaClient | null): Promise<void> {
  if (!prisma) return;

  const withFlag = prisma as EdgePrismaClient & { __isSingleton?: boolean };
  if (withFlag.__isSingleton) {
    return; // Do not disconnect singleton; reuse in same isolate
  }

  try {
    await prisma.$disconnect();
  } catch (error) {
    // Log but don't throw - disconnection errors shouldn't fail the request
    console.warn('[Prisma Edge] Error during disconnect (non-fatal):', error);
  }
}
