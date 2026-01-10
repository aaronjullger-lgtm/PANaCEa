/**
 * Prisma Client Singleton with Accelerate Extension
 * 
 * Ensures only one instance of PrismaClient exists throughout the application lifecycle.
 * This prevents connection pool exhaustion and improves performance.
 * 
 * Uses Prisma Accelerate extension for Edge runtime compatibility and caching.
 * 
 * @see https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 * @see https://www.prisma.io/docs/accelerate
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(withAccelerate());
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
