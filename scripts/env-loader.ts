/**
 * Environment Variable Loader
 * 
 * This module MUST be imported FIRST in any script that needs DATABASE_URL
 * or other environment variables. Due to JavaScript import hoisting, all
 * imports execute in order of appearance, so this ensures dotenv.config()
 * runs before any module that depends on process.env.
 * 
 * Usage in scripts:
 *   import './env-loader';  // <-- Import FIRST, before any other imports
 *   import { prisma } from '../lib/prisma';
 */

import path from 'node:path';
import { config } from 'dotenv';

// Load environment variables in priority order
// .env.local overrides .env (for local development overrides)
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

// Validate critical environment variables
if (!process.env.DATABASE_URL) {
  console.error('\n❌ ERROR: DATABASE_URL not found in environment variables');
  console.error('   Make sure you have a .env file with DATABASE_URL set\n');
  process.exit(1);
}

// Success - environment variables loaded
console.log('✓ Environment variables loaded');
