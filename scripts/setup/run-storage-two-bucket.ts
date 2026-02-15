/**
 * Run Supabase two-bucket storage setup SQL.
 * Uses DIRECT_DATABASE_URL or DATABASE_URL from .env (load with dotenv).
 *
 * Usage: npx dotenv -e .env -- tsx scripts/setup/run-storage-two-bucket.ts
 *    or: node --env-file=.env --import tsx scripts/setup/run-storage-two-bucket.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DIRECT_DATABASE_URL or DATABASE_URL in env');
  process.exit(1);
}

const sqlPath = join(__dirname, 'supabase-storage-two-bucket.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({ connectionString });
try {
  await client.connect();
  await client.query(sql);
  console.log('Supabase storage two-bucket setup applied successfully.');
} catch (e: any) {
  console.error('Setup failed:', e?.message || e);
  process.exit(1);
} finally {
  await client.end();
}
