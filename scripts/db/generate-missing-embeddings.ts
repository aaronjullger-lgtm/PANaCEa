/**
 * Generate missing embeddings for MedicalContent records.
 * 
 * Target table: MedicalContentEmbedding (separate table with FK to MedicalContent).
 * Uses Google's gemini-embedding-2 via REST API.
 * BATCH: 20 records per API call.
 * 
 * SAFE: idempotent, only inserts where MedicalContentEmbedding doesn't exist.
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

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIM = 768;

async function embedBatch(texts: string[]): Promise<number[][]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map(t => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: t }] },
          outputDimensionality: EMBEDDING_DIM
        }))
      })
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Embedding API error ${resp.status}: ${err}`);
  }

  const data = await resp.json() as any;
  return data.embeddings.map((e: any) => e.values);
}

function pgVectorLit(vec: number[]): string {
  return `[${vec.map(v => v.toFixed(8)).join(',')}]`;
}

interface MCRow {
  id: string;
  condition: string | null;
  overview: string | null;
  symptoms: string | null;
  treatment: string | null;
  pathophysiology: string | null;
}

async function main() {
  const client = await pool.connect();
  try {
    if (!GEMINI_KEY) {
      console.error('GEMINI_API_KEY not set');
      process.exit(1);
    }

    const { rows } = await client.query<MCRow>(`
      SELECT mc.id, mc."condition", mc."overview", mc."symptoms", 
             mc."treatment", mc."pathophysiology"
      FROM "MedicalContent" mc
      WHERE NOT EXISTS (
        SELECT 1 FROM "MedicalContentEmbedding" mce 
        WHERE mce."medicalContentId" = mc.id
      )
    `);

    console.log(`Found ${rows.length} MedicalContent records without embeddings`);

    if (rows.length === 0) {
      console.log('✅ All MedicalContent records already have embeddings');
      return;
    }

    let inserted = 0;
    const BATCH = 20;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      const texts = batch.map(row => {
        const parts = [row.condition || ''];
        if (row.overview) parts.push(row.overview);
        if (row.pathophysiology) parts.push(row.pathophysiology);
        if (row.symptoms) parts.push(typeof row.symptoms === 'string' ? row.symptoms : JSON.stringify(row.symptoms));
        if (row.treatment) parts.push(typeof row.treatment === 'string' ? row.treatment : JSON.stringify(row.treatment));
        return parts.filter(Boolean).join(' ').slice(0, 2000);
      });

      try {
        const embeddings = await embedBatch(texts);

        await client.query('BEGIN');
        try {
          for (let j = 0; j < batch.length; j++) {
            const emb = embeddings[j];
            if (!emb) continue;
            const row = batch[j];
            if (!row) continue;
            const vec = pgVectorLit(emb);
            await client.query(`
              INSERT INTO "MedicalContentEmbedding" (id, "medicalContentId", embedding, "updatedAt")
              VALUES ($1, $2, $3::vector, NOW())
              ON CONFLICT ("medicalContentId") DO NOTHING
            `, [`mce_${row.id}`, row.id, vec]);
            inserted++;
          }
          await client.query('COMMIT');
        } catch (e: any) {
          await client.query('ROLLBACK');
          console.error(`  Batch commit error: ${e.message}`);
        }

        console.log(`  Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} (inserted: ${inserted})`);
      } catch (e: any) {
        console.error(`  Embedding API error: ${e.message}`);
        if (e.message.includes('429')) {
          console.log('  Rate limited, waiting 60s...');
          await new Promise(r => setTimeout(r, 60000));
        }
      }

      if (i + BATCH < rows.length) {
        await new Promise(r => setTimeout(r, 4500));
      }
    }

    const { rows: [{ cnt }] } = await client.query('SELECT COUNT(*) as cnt FROM "MedicalContentEmbedding"');
    console.log(`\n✅ Done. Inserted: ${inserted}/${rows.length}. Total embeddings: ${cnt}`);
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
