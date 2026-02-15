/**
 * OpenStax Ingest Script (RAG)
 *
 * Purpose:
 * - Extract text from an OpenStax PDF or XML file
 * - Chunk it into retrieval-friendly segments
 * - Store chunks in `TextbookChunk` for Edge-safe retrieval
 *
 * Usage:
 *   npx tsx scripts/ingest/openstax-ingest.ts --file ./path/to/book.pdf --book "Anatomy and Physiology" --system CV,PULM
 *
 * Options:
 *   --file <path>           PDF or XML file path
 *   --book <title>          Book title (stored on chunks)
 *   --source <name>         Source label (default: OpenStax)
 *   --system <codes>        Comma-separated system codes (e.g. CV,PULM,GI)
 *   --chapter <label>       Optional chapter label to store
 *   --section <label>       Optional section label to store
 *   --maxChars <n>          Max chars per chunk (default: 6000)
 *   --replace               Delete existing chunks for (source,book) first
 *   --dryRun                Print stats only (no DB writes)
 */

import fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import pdfParse from 'pdf-parse';
import { prisma, disconnect } from '../_shared/db';

type Args = Record<string, string | boolean | undefined>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (!token?.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      i += 1;
      continue;
    }
    args[key] = next;
    i += 2;
  }
  return args;
}

function normalizeWhitespace(text: string): string {
  return text
    .replaceAll(/\r\n/g, '\n')
    .replaceAll(/[ \t]+\n/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

function stripXml(xml: string): string {
  return normalizeWhitespace(
    xml
      .replaceAll(/<script[\s\S]*?<\/script>/gi, '')
      .replaceAll(/<style[\s\S]*?<\/style>/gi, '')
      .replaceAll(/<[^>]+>/g, ' ')
      .replaceAll(/&nbsp;/g, ' ')
      .replaceAll(/&amp;/g, '&')
      .replaceAll(/&lt;/g, '<')
      .replaceAll(/&gt;/g, '>')
  );
}

function chunkText(text: string, maxChars: number): string[] {
  const paragraphs = normalizeWhitespace(text)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = '';

  for (const p of paragraphs) {
    if (!buf) {
      buf = p;
      continue;
    }

    // If adding this paragraph would exceed, flush current buffer.
    if (buf.length + 2 + p.length > maxChars) {
      chunks.push(buf);
      buf = p;
      continue;
    }

    buf = `${buf}\n\n${p}`;
  }

  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

async function extractText(filePath: string): Promise<{ text: string; kind: 'pdf' | 'xml' }> {
  const bytes = await fs.readFile(filePath);
  if (filePath.toLowerCase().endsWith('.pdf')) {
    const parsed = await pdfParse(bytes);
    return { text: normalizeWhitespace(parsed.text || ''), kind: 'pdf' };
  }
  // Treat everything else as XML-ish text
  return { text: stripXml(bytes.toString('utf8')), kind: 'xml' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const filePath = (args.file as string | undefined) ?? '';
  const bookTitle = (args.book as string | undefined) ?? '';
  const source = (args.source as string | undefined) ?? 'OpenStax';
  const systemCodesRaw = (args.system as string | undefined) ?? '';
  const chapter = (args.chapter as string | undefined) ?? undefined;
  const section = (args.section as string | undefined) ?? undefined;
  const maxChars = Math.max(
    1000,
    Number.parseInt((args.maxChars as string | undefined) ?? '6000', 10)
  );
  const replace = Boolean(args.replace);
  const dryRun = Boolean(args.dryRun);

  if (!filePath || !bookTitle) {
    throw new Error(
      'Missing required args.\n' +
        'Required: --file <path> --book "Title"\n' +
        'Optional: --system CV,PULM --replace --dryRun'
    );
  }

  const systemCodes = systemCodesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { text, kind } = await extractText(filePath);
  if (!text || text.length < 200) {
    throw new Error(`Extracted text too short (kind=${kind}). Check input file: ${filePath}`);
  }

  const chunks = chunkText(text, maxChars);
  console.log(
    `[OpenStaxIngest] Extracted ${text.length} chars (${kind}); chunked into ${chunks.length} chunks (maxChars=${maxChars}).`
  );

  if (dryRun) {
    console.log('[OpenStaxIngest] dryRun enabled; skipping DB writes.');
    return;
  }

  if (replace) {
    const deleted = await prisma.textbookChunk.deleteMany({
      where: { source, bookTitle },
    });
    console.log(`[OpenStaxIngest] Replacing: deleted ${deleted.count} existing chunks.`);
  }

  const now = new Date();
  const records = chunks.map((chunk) => ({
    id: crypto.randomUUID(),
    source,
    bookTitle,
    chapter: chapter ?? null,
    section: section ?? null,
    text: chunk,
    systemCodes,
    createdAt: now,
    updatedAt: now,
  }));

  // Chunked insert to avoid oversized payloads
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await prisma.textbookChunk.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`[OpenStaxIngest] Inserted ${inserted}/${records.length}...`);
  }

  console.log(`[OpenStaxIngest] Done. Inserted ${inserted} chunks for "${bookTitle}".`);
}

try {
  await main();
} catch (err) {
  console.error('[OpenStaxIngest] Failed:', err);
  process.exitCode = 1;
} finally {
  await disconnect();
}
