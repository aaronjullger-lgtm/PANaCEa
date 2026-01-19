/**
 * Prisma Client Singleton with Hybrid Configuration
 *
 * Handles the Prisma 7 + Accelerate "Catch-22":
 * - @prisma/extension-accelerate forces WASM engine
 * - WASM engine requires either Accelerate URL OR Driver Adapter
 * 
 * Solution:
 * - Local (NODE_ENV=development): Use PG Adapter with direct postgres:// connection
 * - Production: Use Accelerate extension with prisma:// connection
 *
 * This allows us to keep Accelerate installed for production while still
 * working locally with a standard PostgreSQL connection.
 *
 * @see https://www.prisma.io/docs/guides/database/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 * @see https://www.prisma.io/docs/accelerate
 * @see https://www.prisma.io/docs/orm/overview/databases/postgresql#driver-adapters
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | ReturnType<typeof createPrismaClient> | undefined;
};

function createPrismaClient() {
  // Treat undefined NODE_ENV as development (default for local runs)
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const logLevel = isDevelopment ? ['query', 'error', 'warn'] : ['error'];

  // LOCAL DEVELOPMENT: Use PG Adapter to satisfy WASM engine requirements
  if (isDevelopment) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log: logLevel as any,
    });
  }

  // PRODUCTION: Use Accelerate extension with prisma:// URL
  const basePrisma = new PrismaClient({
    log: logLevel as any,
  });

  return basePrisma.$extends(withAccelerate());
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
