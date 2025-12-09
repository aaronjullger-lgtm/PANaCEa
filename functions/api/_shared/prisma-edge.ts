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
 * Creates a Prisma Client instance compatible with Cloudflare Edge Runtime
 * using Prisma Accelerate extension for caching and connection pooling.
 * 
 * @param databaseUrl - Prisma Accelerate connection string from environment
 * @returns Configured PrismaClient instance with Accelerate extension
 */
export function createEdgePrismaClient(databaseUrl: string) {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
  }).$extends(withAccelerate());
}
