/**
 * Prisma Client Helper for Scripts
 *
 * Provides a properly configured PrismaClient instance for use in scripts.
 * Handles Prisma v7 adapter requirements and environment variable loading.
 *
 * Usage:
 *   import { prisma } from './helpers/prisma-client';
 *
 *   // Use prisma as normal
 *   const records = await prisma.medicalContent.findMany();
 *
 *   // Don't forget to disconnect when done
 *   await prisma.$disconnect();
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables (override ensures .env wins over stale shell vars)
config({ override: true });

// Use DIRECT_DATABASE_URL for scripts (bypasses Accelerate proxy)
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!directUrl) {
  console.error('❌ DATABASE_URL or DIRECT_DATABASE_URL not set in environment');
  console.error('Please create a .env file with your database connection string.');
  process.exit(1);
}

// Prisma v7 requires adapter for PostgreSQL
// sslmode=require/prefer means "encrypt, don't verify the chain" (Supabase direct
// hosts use a non-public CA). pg-connection-string v2.12 aliases require/prefer
// to verify-full AND its parse() result overrides explicit Pool ssl config
// (pg ConnectionParameters: Object.assign({}, config, parse(connectionString))),
// so strip sslmode from the URL and set ssl explicitly.
const url = new URL(directUrl);
const sslmode = url.searchParams.get('sslmode') ?? 'prefer';
url.searchParams.delete('sslmode');
const pool = new Pool({
  connectionString: url.toString(),
  ssl:
    sslmode === 'require' || sslmode === 'prefer'
      ? { rejectUnauthorized: false }
      : undefined,
});
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Gracefully disconnect from the database
 * Call this before your script exits
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
  await pool.end();
}
