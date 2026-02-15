/**
 * Phase 5: Smart Library — Step 2 (Cache). Create a Gemini context cache from textbook text
 * and optionally store the cache name on an EducationalResource.
 *
 * Cursor Implementation Plan (Phase 5):
 * - Step 1 (Ingest): Use @adobe/pdfservices-node-sdk to extract text + bounding boxes to JSON.
 *   Store structuredData.json in Supabase; set adobeDataPath on resource. Maps every sentence to coordinates.
 * - Step 2 (this script): Use Gemini cachedContents API (POST /v1beta/cachedContents) to upload textbook content.
 *   Set TTL to 2 hours (7200s). Store cacheName in DB (EducationalResource.geminiCacheName, geminiCacheExpiresAt).
 * - Step 3 (Query): POST /api/library/query with cachedContent; LLM returns {{Page:X}}; frontend matches to Adobe JSON to highlight.
 *
 * Usage:
 *   npx tsx scripts/library/ingest-cache.ts --textFile ./path/to/extracted.txt [--resourceId <id>] [--ttl 7200] [--model gemini-2.0-flash]
 *   cat extracted.txt | npx tsx scripts/library/ingest-cache.ts --stdin [--resourceId <id>] [--ttl 7200]
 *
 * Env: GEMINI_API_KEY (required), DATABASE_URL (required if --resourceId)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { PrismaClient } from '@prisma/client';

const GEMINI_CACHE_URL = 'https://generativelanguage.googleapis.com/v1beta/cachedContents';
const DEFAULT_TTL = 7200; // 2 hours
const DEFAULT_MODEL = 'gemini-2.0-flash';

interface Args {
  textFile?: string;
  stdin: boolean;
  resourceId?: string;
  ttl: number;
  model: string;
  displayName?: string;
}

function parseArgs(): Args {
  const args: Args = {
    stdin: false,
    ttl: DEFAULT_TTL,
    model: DEFAULT_MODEL,
  };
  const argv = process.argv.slice(2);
  let idx = 0;
  while (idx < argv.length) {
    const arg = argv[idx];
    const next = () => argv[idx + 1];
    if (arg === '--textFile' && next()) {
      args.textFile = resolve(argv[++idx]);
    } else if (arg === '--stdin') {
      args.stdin = true;
    } else if (arg === '--resourceId' && next()) {
      args.resourceId = argv[++idx];
    } else if (arg === '--ttl' && next()) {
      args.ttl = Number.parseInt(argv[++idx], 10) || DEFAULT_TTL;
    } else if (arg === '--model' && next()) {
      args.model = argv[++idx];
    } else if (arg === '--displayName' && next()) {
      args.displayName = argv[++idx];
    }
    idx++;
  }
  return args;
}

async function readStdin(): Promise<string> {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines: string[] = [];
  for await (const line of rl) lines.push(line);
  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required');
    process.exit(1);
  }

  const args = parseArgs();
  let text: string;
  if (args.stdin) {
    text = await readStdin();
  } else if (args.textFile) {
    text = readFileSync(args.textFile, 'utf-8');
  } else {
    console.error('Provide --textFile <path> or --stdin');
    process.exit(1);
  }

  if (!text.trim()) {
    console.error('Text content is empty');
    process.exit(1);
  }

  const ttlSeconds = Math.max(1, Math.min(args.ttl, 86400 * 7)); // cap 7 days
  const ttlStr = `${ttlSeconds}s`;
  const modelName = args.model.startsWith('models/') ? args.model : `models/${args.model}`;

  const body = {
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
    ttl: ttlStr,
    displayName: args.displayName ?? 'smart-library-textbook',
  };

  const res = await fetch(`${GEMINI_CACHE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini cachedContents create failed:', res.status, err.slice(0, 500));
    process.exit(1);
  }

  const data = (await res.json()) as {
    name?: string;
    expiration?: { expireTime?: string };
  };
  const cacheName = data.name;
  const expireTime = data.expiration?.expireTime;

  if (!cacheName) {
    console.error('Response missing name');
    process.exit(1);
  }

  console.log('Cache created:', cacheName);
  if (expireTime) console.log('Expires:', expireTime);

  if (args.resourceId) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('DATABASE_URL is required when using --resourceId');
      process.exit(1);
    }
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const expiresAt = expireTime
        ? new Date(expireTime)
        : new Date(Date.now() + ttlSeconds * 1000);
      await prisma.educationalResource.update({
        where: { id: args.resourceId },
        data: {
          geminiCacheName: cacheName,
          geminiCacheExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      });
      console.log('Updated EducationalResource', args.resourceId, 'with geminiCacheName');
    } catch (e) {
      console.error('Prisma update failed:', e);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log('Done. Use cachedContent:', cacheName, 'in POST /api/library/query');
}

main();
