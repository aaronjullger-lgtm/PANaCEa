/**
 * Prisma Client for Cloudflare Edge Runtime with Neon Adapter
 * 
 * This module provides a Prisma Client configured for Cloudflare Pages Functions
 * which run on Edge Runtime. Uses Neon serverless driver for edge compatibility.
 * 
 * @see https://www.prisma.io/docs/orm/overview/databases/neon
 */

import { PrismaClient } from '@prisma/client/edge';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { withAccelerate } from '@prisma/extension-accelerate';
import ws from 'ws';

/**
 * Type for the extended Edge Prisma Client with Neon adapter
 */
export type EdgePrismaClient = ReturnType<typeof createEdgePrismaClient>;

/**
 * Creates a Prisma Client instance compatible with Cloudflare Edge Runtime using Neon adapter.
 * 
 * IMPORTANT: This function works with PostgreSQL connections via Neon serverless driver:
 * 
 * - URL format: `postgresql://user:pass@host:port/db`
 * - Works with Neon, Supabase (in proxy mode), or any PostgreSQL provider
 * - The Neon adapter provides edge-compatible connection pooling
 * 
 * @param databaseUrl - PostgreSQL connection string from environment
 * @returns Configured PrismaClient instance with Neon adapter
 * @throws Error if databaseUrl is missing or invalid
 */
export function createEdgePrismaClient(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is required but not provided. ' +
      'Please set DATABASE_URL in your Cloudflare Pages environment variables.'
    );
  }

  // Configure WebSocket for Node.js environments (not needed in actual edge runtime)
  if (typeof process !== 'undefined' && process.versions?.node) {
    neonConfig.webSocketConstructor = ws;
  }

  try {
    // Create Neon connection pool
    const pool = new Pool({ connectionString: databaseUrl });
    
    // Create Neon adapter
    const adapter = new PrismaNeon(pool);
    
    // Create the Prisma client with Neon adapter and Accelerate extension
    return new PrismaClient({
      adapter,
    }).$extends(withAccelerate()) as any;
    
  } catch (error) {
    console.error('[Prisma Edge] Failed to create Prisma client:', error);
    throw error;
  }
}
