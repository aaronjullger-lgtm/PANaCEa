/**
 * Prisma 7 Configuration File
 * 
 * This file configures database connection settings for Prisma CLI operations
 * (migrate, generate, etc.) since url/directUrl were removed from schema.prisma.
 * 
 * @see https://www.prisma.io/docs/orm/reference/prisma-cli-reference
 */

import { defineConfig } from 'prisma';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  
  // Database connection configuration (moved from schema.prisma)
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      
      // Use DIRECT_DATABASE_URL for migrations (bypasses connection pooler)
      const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
      
      if (!connectionString) {
        throw new Error('DATABASE_URL or DIRECT_DATABASE_URL environment variable is required');
      }
      
      const pool = new Pool({ connectionString });
      return new PrismaPg(pool);
    },
  },
});
