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

/**
 * Extended PrismaClient type that works with both development (PG Adapter)
 * and production (Accelerate) configurations.
 *
 * We use PrismaClient as the base type since both configurations expose
 * the same API - the only difference is internal implementation.
 */
type ExtendedPrismaClient = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

function createPrismaClient() {
  // Validate DATABASE_URL is present
  if (!process.env.DATABASE_URL) {
    const error = `
╔════════════════════════════════════════════════════════════════╗
║                   PRISMA CONFIGURATION ERROR                   ║
╚════════════════════════════════════════════════════════════════╝

❌ DATABASE_URL environment variable is not set!

This usually means:
  1. You're running 'npm run dev:all' locally but haven't set DATABASE_URL in .env
  2. The dotenv.config() call happened AFTER prisma was imported
  3. Your .env file is missing or corrupted

Fix:
  • Make sure DATABASE_URL is set in your .env file:
    DATABASE_URL="postgresql://user:password@host:5432/database"
  
  • For local development with npm run dev:all, you MUST have .env with DATABASE_URL
  • For Cloudflare deployment, set DATABASE_URL in your Cloudflare dashboard

Current working directory: ${process.cwd()}
NODE_ENV: ${process.env.NODE_ENV || 'undefined'}
`;
    throw new Error(error);
  }

  // Treat undefined NODE_ENV as development (default for local runs)
  // Also treat 'test' environment as development to use PG Adapter
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    !process.env.NODE_ENV;
  const logLevel = isDevelopment ? ['query', 'error', 'warn'] : ['error'];

  // LOCAL DEVELOPMENT & TESTING: Use PG Adapter to satisfy WASM engine requirements
  if (isDevelopment) {
    const connUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString: connUrl,
    });

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log: logLevel as any,
    });
  }

  // PRODUCTION: Use Accelerate extension with prisma:// URL
  const basePrisma = new PrismaClient({
    accelerateUrl: process.env.DATABASE_URL,
    log: logLevel as any,
  });

  return basePrisma.$extends(withAccelerate());
}

export const prisma = (globalForPrisma.prisma ?? createPrismaClient()) as ExtendedPrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
