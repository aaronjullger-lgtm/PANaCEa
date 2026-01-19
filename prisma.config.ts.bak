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
  // Prisma schema location
  schema: path.resolve(process.cwd(), 'prisma/schema.prisma'),

  // Datasource URL for db push/pull commands
  datasource: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '',
  },
});
