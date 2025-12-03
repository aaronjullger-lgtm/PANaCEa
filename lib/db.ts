/**
 * Database client for Prisma
 * Provides a singleton instance of PrismaClient for Cloudflare Functions
 */

import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get or create a Prisma client instance
 * Uses singleton pattern to reuse connections in serverless environment
 */
export function getPrismaClient(databaseUrl?: string): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl || process.env.DATABASE_URL,
        },
      },
    });
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
