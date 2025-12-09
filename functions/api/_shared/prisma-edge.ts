/**
 * Prisma Client for Cloudflare Edge Runtime
 * 
 * This module provides a Prisma Client configured for Cloudflare Pages Functions
 * which run on Edge Runtime and don't support the standard Prisma Client.
 * 
 * Uses @neondatabase/serverless driver adapter which is compatible with
 * Supabase PostgreSQL connections.
 */

import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

/**
 * Creates a Prisma Client instance compatible with Cloudflare Edge Runtime
 * 
 * @param databaseUrl - PostgreSQL connection string from environment
 * @returns Configured PrismaClient instance
 */
export function createEdgePrismaClient(databaseUrl: string): PrismaClient {
  // Create Prisma Neon adapter with connection config
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  
  // Create and return Prisma Client with adapter
  return new PrismaClient({ adapter });
}
