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
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Creates a PrismaClient instance with Prisma Accelerate support
 * Required for Prisma 7 since url/directUrl were removed from schema.prisma
 */
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required.\n' +
      'Ensure .env file exists or the variable is set.'
    );
  }

  const isAccelerateUrl = databaseUrl.startsWith('prisma://');
  
  // Use PrismaClient with proper constructor options for Prisma 7
  const PrismaClientAny = PrismaClient as any;
  const client = new PrismaClientAny({
    // For Accelerate URLs, use accelerateUrl
    // For direct PostgreSQL URLs, use datasourceUrl
    ...(isAccelerateUrl ? { accelerateUrl: databaseUrl } : { datasourceUrl: databaseUrl }),
  });
  
  return client.$extends(withAccelerate());
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
