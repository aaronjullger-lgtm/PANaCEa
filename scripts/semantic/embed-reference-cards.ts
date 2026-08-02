/**
 * Reference Library Embedding Backfill
 *
 * Generates embeddings for MedicalContent (reference cards) using Google AI
 * gemini-embedding-2 (768 dims) and stores them in MedicalContentEmbedding (pgvector).
 *
 * Usage:
 *   npx tsx scripts/semantic/embed-reference-cards.ts [--dry-run] [--batch=50] [--skip=0]
 *
 * Requires: GEMINI_API_KEY, DATABASE_URL in env.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMBED_MODEL = 'gemini-embedding-2';
const EMBED_DIMS = 768;
const BATCH_SIZE = 10; // rate limit friendly
const PAUSE_MS = 200;

function buildSearchableText(row: {
  condition: string | null;
  overview: string | null;
  symptoms: string | null;
  first_line_rx: string | null;
  gold_standard_dx: string | null;
  classic_patient: string | null;
  buzzwords: unknown;
  pathophysiology: string | null;
  treatment: string | null;
  diagnostics: string | null;
  best_initial_test: string | null;
  clinical_pearls: unknown;
}): string {
  const parts: string[] = [];
  if (row.condition) parts.push(row.condition);
  if (row.overview) parts.push(row.overview);
  if (row.classic_patient) parts.push(row.classic_patient);
  if (row.symptoms) parts.push(row.symptoms);
  if (row.first_line_rx) parts.push(row.first_line_rx);
  if (row.gold_standard_dx) parts.push(row.gold_standard_dx);
  if (row.best_initial_test) parts.push(row.best_initial_test);
  if (row.pathophysiology) parts.push(row.pathophysiology);
  if (row.treatment) parts.push(row.treatment);
  if (row.diagnostics) parts.push(row.diagnostics);
  if (Array.isArray(row.buzzwords)) parts.push(row.buzzwords.join(' '));
  if (Array.isArray(row.clinical_pearls)) parts.push(row.clinical_pearls.join(' '));
  return parts.filter(Boolean).join('\n').slice(0, 8000);
}

async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIMS,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!Array.isArray(values) || values.length !== EMBED_DIMS) {
    throw new Error(`Invalid embedding shape: got ${values?.length ?? 0}, expected ${EMBED_DIMS}`);
  }
  return values;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const batchArg = args.find((a) => a.startsWith('--batch='));
  const skipArg = args.find((a) => a.startsWith('--skip='));
  const batch = batchArg ? parseInt(batchArg.split('=')[1] ?? '50', 10) : 50;
  const skip = skipArg ? parseInt(skipArg.split('=')[1] ?? '0', 10) : 0;

  console.log('Reference Library Embedding Backfill');
  console.log('====================================');
  console.log(
    `Model: ${EMBED_MODEL} (${EMBED_DIMS}d) | Batch: ${batch} | Skip: ${skip} | Dry run: ${dryRun}\n`
  );

  const rows = await prisma.medicalContent.findMany({
    skip,
    take: batch,
    select: {
      id: true,
      condition: true,
      overview: true,
      symptoms: true,
      first_line_rx: true,
      gold_standard_dx: true,
      classic_patient: true,
      buzzwords: true,
      pathophysiology: true,
      treatment: true,
      diagnostics: true,
      best_initial_test: true,
      clinical_pearls: true,
    },
  });

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const text = buildSearchableText(row);
    if (!text.trim()) {
      console.log(`Skip (no text): ${row.condition ?? row.id}`);
      continue;
    }
    try {
      const embedding = await getEmbedding(text, apiKey);
      const vectorStr = `[${embedding.join(',')}]`;
      if (dryRun) {
        console.log(`[DRY RUN] Would embed: ${row.condition ?? row.id} (${embedding.length}d)`);
        ok++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "MedicalContentEmbedding" ("id", "medicalContentId", "embedding", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2::vector, NOW())
           ON CONFLICT ("medicalContentId") DO UPDATE SET "embedding" = $2::vector, "updatedAt" = NOW()`,
          row.id,
          vectorStr
        );
        console.log(`OK: ${row.condition ?? row.id}`);
        ok++;
      }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    } catch (e) {
      console.error(`FAIL: ${row.condition ?? row.id}`, e instanceof Error ? e.message : e);
      fail++;
    }
  }

  console.log(`\nDone: ${ok} ok, ${fail} fail`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
