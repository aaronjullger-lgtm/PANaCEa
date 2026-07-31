/**
 * Generate missing embeddings for PreGeneratedQuestion records.
 *
 * Target table: QuestionEmbedding (pgvector, FK to PreGeneratedQuestion).
 * Uses Google's gemini-embedding-2 via REST batch embed API.
 * BATCH: 20 records per API call (rate-limited).
 *
 * SAFE: idempotent — ON CONFLICT DO NOTHING.
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
  ssl: { rejectUnauthorized: false },
});

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIM = 768;
const BATCH = 20;

async function embedBatch(texts: string[]): Promise<number[][]> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: t }] },
          outputDimensionality: EMBEDDING_DIM,
        })),
      }),
    },
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Embedding API error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as any;
  return data.embeddings.map((e: any) => e.values);
}

function pgVectorLit(vec: number[]): string {
  return `[${vec.map((v) => v.toFixed(8)).join(',')}]`;
}

function extractText(qd: any): string {
  const parts: string[] = [];
  const stem = qd?.stem || qd?.questionText || qd?.question || '';
  if (stem) parts.push(stem);
  const options = qd?.options;
  if (Array.isArray(options)) {
    for (const opt of options) {
      const t = typeof opt === 'string' ? opt : opt?.text || opt?.option || '';
      if (t) parts.push(t);
    }
  }
  const explanation = qd?.explanation || qd?.rationale || '';
  if (explanation) parts.push(explanation);
  return parts.join(' ').trim();
}

interface QRow {
  id: string;
  questionData: any;
}

async function main() {
  const client = await pool.connect();
  try {
    if (!GEMINI_KEY) {
      console.error('GEMINI_API_KEY not set');
      process.exit(1);
    }

    const { rows } = await client.query<QRow>(`
      SELECT pq.id, pq."questionData"
      FROM "PreGeneratedQuestion" pq
      WHERE NOT EXISTS (
        SELECT 1 FROM "QuestionEmbedding" qe
        WHERE qe."questionId" = pq.id
      )
    `);

    console.log(`Found ${rows.length} PreGeneratedQuestion records without embeddings`);

    if (rows.length === 0) {
      console.log('✅ All questions already have embeddings');
      return;
    }

    let inserted = 0;
    let skippedText = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);

      const texts = batch.map((row) => extractText(row.questionData));

      // Filter out questions with too little text
      const validBatch: { row: QRow; text: string }[] = [];
      for (let j = 0; j < batch.length; j++) {
        const text = texts[j];
        if (text && text.length >= 10) {
          validBatch.push({ row: batch[j], text });
        } else {
          skippedText++;
        }
      }

      if (validBatch.length === 0) continue;

      try {
        const embeddings = await embedBatch(validBatch.map((v) => v.text.slice(0, 2000)));

        await client.query('BEGIN');
        try {
          for (let j = 0; j < validBatch.length; j++) {
            const emb = embeddings[j];
            if (!emb) continue;
            const { row, text } = validBatch[j];
            const vec = pgVectorLit(emb);
            const truncatedText = text.slice(0, 500);
            await client.query(
              `
              INSERT INTO "QuestionEmbedding" ("id", "questionId", "embedding", "model", "embeddedText", "createdAt", "updatedAt")
              VALUES (gen_random_uuid()::text, $1, $2::vector, $3, $4, NOW(), NOW())
              ON CONFLICT ("questionId") DO NOTHING
            `,
              [row.id, vec, EMBEDDING_MODEL, truncatedText],
            );
            inserted++;
          }
          await client.query('COMMIT');
        } catch (e: any) {
          await client.query('ROLLBACK');
          console.error(`  Batch commit error: ${e.message}`);
        }

        console.log(
          `  Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} (inserted: ${inserted})`,
        );
      } catch (e: any) {
        console.error(`  Embedding API error: ${e.message}`);
        if (e.message.includes('429')) {
          console.log('  Rate limited, waiting 60s...');
          await new Promise((r) => setTimeout(r, 60000));
        }
      }

      // Rate-limit pause between batches
      if (i + BATCH < rows.length) {
        await new Promise((r) => setTimeout(r, 4500));
      }
    }

    const {
      rows: [{ cnt }],
    } = await client.query('SELECT COUNT(*) as cnt FROM "QuestionEmbedding"');
    console.log(
      `\n✅ Done. Inserted: ${inserted}/${rows.length} (skipped text: ${skippedText}). Total QuestionEmbedding: ${cnt}`,
    );
  } finally {
    await client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
