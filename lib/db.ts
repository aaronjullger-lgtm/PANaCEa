/**
 * Database client for Prisma with Accelerate Extension
 * Provides a singleton instance of PrismaClient for Cloudflare Functions
 * 
 * Uses Prisma Accelerate extension for Edge runtime compatibility and caching.
 */

import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

let prisma: ReturnType<typeof createPrismaClient> | null = null;

function createPrismaClient(databaseUrl?: string) {
  return new PrismaClient({
    datasourceUrl: databaseUrl || process.env.DATABASE_URL,
  }).$extends(withAccelerate());
}

/**
 * Get or create a Prisma client instance
 * Uses singleton pattern to reuse connections in serverless environment
 */
export function getPrismaClient(databaseUrl?: string) {
  if (!prisma) {
    prisma = createPrismaClient(databaseUrl);
  }
  return prisma;
}

/**
 * Disconnect Prisma client (for cleanup)
 */
export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
