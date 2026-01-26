/**
 * Shared Prisma Client for Scripts (Prisma 7 Compatible)
 *
 * All scripts should import from this module to ensure consistent
 * database connection handling with the datasourceUrl parameter.
 *
 * Usage:
 *   import { prisma } from './_shared/db';
 *   // or from nested directories:
 *   import { prisma } from '../_shared/db';
 *
 * @see prisma.config.ts for CLI configuration
 */

import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Creates a PrismaClient instance with proper configuration for Prisma 7
 * Uses DIRECT_DATABASE_URL for scripts that need direct database access
 */
function createPrismaClient() {
  // Prefer DIRECT_DATABASE_URL for scripts (bypasses connection pooling like PgBouncer)
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required.\n' +
        'Ensure .env file exists or the variable is set.'
    );
  }

  const isAccelerateUrl = databaseUrl.startsWith('prisma://');

  // For Prisma 7 with Accelerate: use accelerateUrl in constructor
  if (isAccelerateUrl) {
    const client = new PrismaClient({
      accelerateUrl: databaseUrl,
    });
    return client.$extends(withAccelerate());
  }

  // For direct PostgreSQL: use adapter-pg for Node.js scripts
  // Prisma 7 requires an adapter when schema doesn't have datasource URL
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  return client;
}

// Export singleton instance
export const prisma = createPrismaClient();

/**
 * Graceful disconnect helper for scripts
 * Call this at the end of your script to properly close connections
 *
 * @example
 * async function main() {
 *   try {
 *     // ... your script logic
 *   } finally {
 *     await disconnect();
 *   }
 * }
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Helper to run a script with automatic connection cleanup
 *
 * @example
 * runScript(async () => {
 *   const users = await prisma.user.findMany();
 *   console.log(users);
 * });
 */
export async function runScript(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error('Script error:', error);
    process.exit(1);
  } finally {
    await disconnect();
  }
}

// Export the PrismaClient type for type annotations
export type { PrismaClient };
