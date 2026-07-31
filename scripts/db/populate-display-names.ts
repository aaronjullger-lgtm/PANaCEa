/**
 * Populate Condition.displayName from name field.
 * 
 * 1158/1316 conditions are missing displayName.
 * Uses a single SQL UPDATE with regexp_replace for speed.
 * SAFE: idempotent, only updates NULL displayName.
 */
import { config } from 'dotenv';
import path from 'node:path';
import { Pool } from 'pg';

config({ path: path.resolve(process.cwd(), '.env') });

const url = new URL(process.env.DIRECT_DATABASE_URL!);
url.searchParams.set('uselibpqcompat', 'true');
const pool = new Pool({
  host: url.hostname,
  port: parseInt(url.port || '5432'),
  database: url.pathname.slice(1),
  user: url.username,
  password: url.password,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(`
      UPDATE "Condition"
      SET "displayName" = replace(initcap(replace(name, '_', ' ')), '  ', ' ')
      WHERE "displayName" IS NULL OR "displayName" = ''
    `);

    console.log(`✅ Updated ${rowCount} conditions with displayName`);

    const { rows: [{ cnt }] } = await client.query(
      'SELECT COUNT(*) as cnt FROM "Condition" WHERE "displayName" IS NULL'
    );
    console.log(`Remaining NULL displayNames: ${cnt}`);
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
