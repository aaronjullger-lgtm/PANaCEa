/**
 * RAG Chunking Script – fill ContentChunk from MedicalContent key fields.
 *
 * Splits overview, treatment, symptoms, diagnostics, pathophysiology into
 * ~300–500 char chunks (sentence-boundary), embeds via Gemini, upserts into ContentChunk.
 *
 * Usage:
 *   npx tsx scripts/intelligence/chunk-content.ts
 *   npx tsx scripts/intelligence/chunk-content.ts --conditionId=hypertension
 *
 * Requires: GEMINI_API_KEY; DIRECT_DATABASE_URL or DATABASE_URL.
 */

import { config } from 'dotenv';
config();

import { prisma, disconnect } from '../_shared/db';
import { getEmbedding } from '../../lib/gemini';

const FIELDS = ['overview', 'treatment', 'symptoms', 'diagnostics', 'pathophysiology'] as const;
const MIN_CHUNK = 300;
const MAX_CHUNK = 500;
const PAUSE_MS = 150;

type FieldName = (typeof FIELDS)[number];

function parseArgs(): { conditionId: string | null } {
  const arg = process.argv.find((a) => a.startsWith('--conditionId='));
  if (!arg) return { conditionId: null };
  return { conditionId: arg.split('=')[1]?.trim() ?? null };
}

/**
 * Split text into sentences (rough: split on . ! ? followed by space or end).
 */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Group sentences into chunks of ~MIN_CHUNK–MAX_CHUNK chars, preserving sentence boundaries.
 */
function chunkText(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= MAX_CHUNK) return [t];

  const sents = sentences(t);
  const chunks: string[] = [];
  let current: string[] = [];
  let len = 0;

  for (const s of sents) {
    const add = s + (current.length > 0 ? ' ' : '');
    if (len + add.length > MAX_CHUNK && current.length > 0) {
      chunks.push(current.join(' '));
      current = [];
      len = 0;
    }
    current.push(s);
    len += add.length;
  }
  if (current.length > 0) chunks.push(current.join(' '));

  return chunks;
}

function getFieldText(row: Record<string, unknown>, field: FieldName): string | null {
  const v = row[field];
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

type ContentRow = {
  id: string;
  condition: string | null;
  conditionId: string;
  overview: string | null;
  treatment: string | null;
  symptoms: string | null;
  diagnostics: string | null;
  pathophysiology: string | null;
};

async function fetchContentToChunk(conditionId: string | null): Promise<ContentRow[]> {
  if (conditionId) {
    const one = await prisma.medicalContent.findFirst({
      where: { OR: [{ conditionId }, { id: conditionId }] },
      select: {
        id: true,
        condition: true,
        conditionId: true,
        overview: true,
        treatment: true,
        symptoms: true,
        diagnostics: true,
        pathophysiology: true,
      },
    });
    if (!one) throw new Error(`No MedicalContent found for conditionId/id: ${conditionId}`);
    return [one];
  }
  const withChunks = await prisma.contentChunk.findMany({
    select: { medicalContentId: true },
    distinct: ['medicalContentId'],
  });
  const idsWithChunks = new Set(withChunks.map((c) => c.medicalContentId));
  const all = await prisma.medicalContent.findMany({
    select: {
      id: true,
      condition: true,
      conditionId: true,
      overview: true,
      treatment: true,
      symptoms: true,
      diagnostics: true,
      pathophysiology: true,
    },
  });
  return all.filter((c) => !idsWithChunks.has(c.id));
}

async function insertChunksForField(
  row: ContentRow,
  field: FieldName,
  chunks: string[],
  apiKey: string
): Promise<number> {
  const conditionLabel = row.condition ?? row.conditionId;
  let inserted = 0;
  await prisma.contentChunk.deleteMany({
    where: { medicalContentId: row.id, field },
  });
  for (let i = 0; i < chunks.length; i++) {
    const chunkTextVal = chunks[i];
    try {
      const embedding = await getEmbedding(chunkTextVal, apiKey);
      const vectorStr = `[${embedding.join(',')}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ContentChunk" (id, "medicalContentId", field, "chunkIndex", text, embedding)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector)`,
        row.id,
        field,
        i,
        chunkTextVal,
        vectorStr
      );
      inserted++;
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    } catch (e) {
      console.error(
        `Failed to embed chunk ${i} for ${conditionLabel} / ${field}:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return inserted;
}

async function processOneContent(row: ContentRow, apiKey: string): Promise<number> {
  let totalChunks = 0;
  for (const field of FIELDS) {
    const text = getFieldText(row as Record<string, unknown>, field);
    if (!text) continue;
    const chunks = text.length > 500 ? chunkText(text) : [text];
    if (chunks.length === 0) continue;
    totalChunks += await insertChunksForField(row, field, chunks, apiKey);
  }
  return totalChunks;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required');
    process.exit(1);
  }

  const { conditionId } = parseArgs();
  const contentList = await fetchContentToChunk(conditionId);

  console.log(
    conditionId
      ? `Chunking 1 condition: ${contentList[0]?.condition ?? contentList[0]?.conditionId}`
      : `Chunking ${contentList.length} conditions (no chunks yet).`
  );

  for (const row of contentList) {
    const totalChunks = await processOneContent(row, apiKey);
    console.log(`Processed ${row.condition ?? row.conditionId} – Generated ${totalChunks} chunks.`);
  }

  await disconnect();
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
