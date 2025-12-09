/**
 * Prisma Client for Cloudflare Edge Runtime with Accelerate
 * 
 * This module provides a Prisma Client configured for Cloudflare Pages Functions
 * which run on Edge Runtime. Uses Prisma Accelerate extension for optimal 
 * Edge runtime compatibility and caching support.
 * 
 * For Neon database connections, use the Prisma Accelerate connection string
 * which handles Edge runtime compatibility automatically.
 * 
 * @see https://www.prisma.io/docs/accelerate
 */

import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

/**
 * Type for the extended Edge Prisma Client with Accelerate
 */
export type EdgePrismaClient = ReturnType<typeof createEdgePrismaClient>;

/**
 * Creates a Prisma Client instance compatible with Cloudflare Edge Runtime.
 * 
 * IMPORTANT: This function works with two types of database connections:
 * 
 * 1. **Prisma Accelerate** (Recommended for production):
 *    - URL format: `prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY`
 *    - Provides connection pooling, caching, and edge optimization
 *    - Get API key from: https://www.prisma.io/data-platform/accelerate
 *    - Uses Accelerate extension for enhanced features
 * 
 * 2. **Direct PostgreSQL** (Development/testing):
 *    - URL format: `postgresql://user:pass@host:port/db`
 *    - Works with Supabase, Neon, or any PostgreSQL provider
 *    - Accelerate extension is included but won't use Accelerate-specific features
 * 
 * @param databaseUrl - Database connection string from environment
 * @returns Configured PrismaClient instance with Accelerate extension
 * @throws Error if databaseUrl is missing or invalid
 */
export function createEdgePrismaClient(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required but not provided. ' +
      'Please set DATABASE_URL in your Cloudflare Pages environment variables.'
    );
  }

  // Log helpful info for debugging (without exposing the full URL)
  const urlPrefix = databaseUrl.split('://')[0];
  console.log(`[Prisma Edge] Creating client with connection protocol: ${urlPrefix}://`);

  try {
    // Check if URL is in Accelerate format
    if (databaseUrl.startsWith('prisma://')) {
      console.log('[Prisma Edge] Using Prisma Accelerate with connection pooling and caching');
    } else if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
      console.log('[Prisma Edge] Using direct PostgreSQL connection');
      console.log('[Prisma Edge] Note: For Accelerate features (connection pooling, caching), use prisma:// URL');
      console.log('[Prisma Edge] Visit https://www.prisma.io/data-platform/accelerate to set up Accelerate');
    } else {
      console.warn(
        `[Prisma Edge] Warning: Unexpected DATABASE_URL protocol: ${urlPrefix}://. ` +
        'Expected "prisma://" or "postgresql://". Attempting to connect anyway...'
      );
    }

    // Create the Prisma client with Accelerate extension
    // The extension gracefully handles both prisma:// and postgresql:// URLs
    return new PrismaClient({
      datasourceUrl: databaseUrl,
    }).$extends(withAccelerate());
  } catch (error) {
    console.error('[Prisma Edge] Failed to create Prisma client:', error);
    if (error instanceof Error && error.message.includes('prisma://')) {
      console.error('[Prisma Edge] Fix: Set DATABASE_URL to either:');
      console.error('[Prisma Edge]   1. Prisma Accelerate URL: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY');
      console.error('[Prisma Edge]   2. PostgreSQL URL: postgresql://user:pass@host:port/db');
    }
    throw error;
  }
}
