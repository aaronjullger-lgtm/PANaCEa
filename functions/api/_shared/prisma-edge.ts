/**
 * Prisma Client for Cloudflare Edge Runtime
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
 * Alternative for Development:
 * - Use the Express server (server.ts) which can use regular Prisma Client with PostgreSQL
 * - Deploy server.ts to a Node.js environment (Railway, Render, etc.)
 * - Use Cloudflare Pages only for static frontend
 * 
 * @see https://www.prisma.io/docs/accelerate
 * @see https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare
 */

import type { PrismaClient as PrismaClientType } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { createRequire } from 'module';

// Workaround for "module is not defined" error in Cloudflare Pages Functions
// The Prisma Client Edge build is CommonJS, but the runtime expects ESM.
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client/edge') as { PrismaClient: typeof PrismaClientType };

/**
 * Type for the Edge Prisma Client with Accelerate
 */
export type EdgePrismaClient = ReturnType<typeof createEdgePrismaClient>;

/**
 * Creates a Prisma Client instance for Cloudflare Edge Runtime.
 * 
 * REQUIREMENTS:
 * - DATABASE_URL must be a Prisma Accelerate connection string
 * - Format: prisma://accelerate.prisma-data.net/?api_key=YOUR_ACCELERATE_KEY
 * - Get your key from: https://www.prisma.io/data-platform/accelerate
 * 
 * The Accelerate extension provides:
 * - Edge-compatible HTTP-based database access
 * - Connection pooling optimized for serverless
 * - Query caching and performance optimization
 * - No need to bundle database drivers
 * 
 * @param databaseUrl - Prisma Accelerate connection string
 * @returns Configured PrismaClient with Accelerate extension
 * @throws Error if databaseUrl is not an Accelerate URL
 */
export function createEdgePrismaClient(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Set it in Cloudflare Pages environment variables.\n' +
      'For Cloudflare deployment, you must use Prisma Accelerate:\n' +
      '  Format: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY\n' +
      '  Sign up: https://www.prisma.io/data-platform/accelerate'
    );
  }

  // Validate that this is an Accelerate URL
  if (!databaseUrl.startsWith('prisma://')) {
    throw new Error(
      'DATABASE_URL must be a Prisma Accelerate connection string for Cloudflare deployment.\n' +
      '  Current URL starts with: ' + databaseUrl.split('://')[0] + '://\n' +
      '  Required format: prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY\n\n' +
      'Alternatives:\n' +
      '  1. Use Prisma Accelerate (recommended): https://www.prisma.io/data-platform/accelerate\n' +
      '  2. Deploy the Express server (server.ts) to a Node.js host instead of using Cloudflare Functions'
    );
  }

  try {
    // Create Prisma client with Accelerate
    // The Accelerate extension handles HTTP-based communication with the database
    return new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    }).$extends(withAccelerate()) as any;
  } catch (error) {
    console.error('[Prisma Edge] Failed to create Prisma client:', error);
    throw new Error(
      'Failed to initialize Prisma Client with Accelerate. ' +
      'Verify your DATABASE_URL is a valid Prisma Accelerate connection string.'
    );
  }
}
