/**
 * Prisma Configuration for Prisma 7+
 * 
 * This file configures database connections for Prisma CLI commands
 * (migrations, db push, etc.). Runtime connections use PrismaClient constructor.
 * 
 * @see https://pris.ly/d/config-datasource
 */

import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Load environment variables
import { config } from 'dotenv';
config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  // Configure early access features
  earlyAccess: true,
  
  // Prisma schema location
  schema: path.resolve(process.cwd(), 'prisma/schema.prisma'),
  
  // Migrate configuration for database connections
  migrate: {
    async adapter() {
      // Use pg adapter for PostgreSQL
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      
      // Use DIRECT_DATABASE_URL for migrations (bypasses connection pooler)
      const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
      
      if (!connectionString) {
        throw new Error(
          'Missing database URL. Set DATABASE_URL or DIRECT_DATABASE_URL in .env file.'
        );
      }
      
      const pool = new Pool({ connectionString });
      return new PrismaPg(pool);
    },
  },
});
