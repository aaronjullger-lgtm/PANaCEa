/**
 * scripts/run-relevance-benchmark.ts
 *
 * Runs the PANaCEa clinical-library relevance benchmark against the live
 * hybrid-search pipeline (`lib/search.ts`) and prints Hit@1/5/10 + MRR with
 * per-intent and per-system breakdowns.
 *
 * Usage:
 *   npx tsx scripts/run-relevance-benchmark.ts
 *   npx tsx scripts/run-relevance-benchmark.ts --limit 10
 *   npx tsx scripts/run-relevance-benchmark.ts --out docs/benchmarks/relevance-baseline.json
 *
 * Env required:
 *   DATABASE_URL     — pooled Postgres (pgbouncer). Same URL the Edge uses.
 *   GEMINI_API_KEY   — for query embedding (same model as production).
 *
 * Exit codes:
 *   0  — ran successfully
 *   1  — missing env / runtime error
 *   2  — results written but Hit@5 dropped below the minimum (regression)
 *
 * Philosophy: the script is *diagnostic*. It hits the real DB so the numbers
 * match production semantics. Do not mock Gemini here — we want to see the
 * real embedding behaviour. If you need a cheap smoke test, import
 * `scoreSingleQuery` directly in a unit test with synthetic RankedHit lists.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { searchMedicalContent } from '../lib/search';
import {
  PANACEA_RELEVANCE_QUERIES,
  scoreSingleQuery,
  summarize,
  formatSummary,
  type RankedHit,
  type RelevanceQuery,
} from '../lib/evaluation/panaceaRelevanceBenchmark';

config();

// ── CLI args ────────────────────────────────────────────────────────────────

interface Args {
  limit: number;
  out?: string;
  /** Minimum Hit@5 to pass; if result is below, exit code 2. */
  minHitAt5: number;
  /** Max concurrent search calls (Gemini rate-limit friendly). */
  concurrency: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    limit: 10,
    minHitAt5: 0,
    concurrency: 4,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--limit') args.limit = Number(next());
    else if (a === '--out') args.out = resolve(next());
    else if (a === '--min-hit5') args.minHitAt5 = Number(next());
    else if (a === '--concurrency') args.concurrency = Number(next());
    else if (a === '--help' || a === '-h') {
      console.log(
        [
          'Usage: npx tsx scripts/run-relevance-benchmark.ts [options]',
          '',
          '  --limit N         top-K to request from search (default 10)',
          '  --out PATH        write JSON summary to PATH',
          '  --min-hit5 X      fail with exit 2 if Hit@5 < X (e.g. 0.60)',
          '  --concurrency N   parallel search calls (default 4)',
        ].join('\n'),
      );
      process.exit(0);
    }
  }
  return args;
}

// ── Concurrency-bounded map ─────────────────────────────────────────────────

async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── Per-query runner ────────────────────────────────────────────────────────

async function runQuery(
  q: RelevanceQuery,
  prisma: PrismaClient,
  apiKey: string,
  limit: number,
): Promise<{ query: RelevanceQuery; hits: RankedHit[]; error?: string }> {
  try {
    const hits = await searchMedicalContent(q.query, { prisma, apiKey, limit });
    const ranked: RankedHit[] = hits.map((h) => ({
      id: h.id,
      condition: h.condition ?? '',
    }));
    return { query: q, hits: ranked };
  } catch (err) {
    return {
      query: q,
      hits: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  const apiKey = process.env.GEMINI_API_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not set. Source your .env before running.');
    process.exit(1);
  }
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set. Source your .env before running.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const started = Date.now();
  console.log(
    `▶ Running PANaCEa relevance benchmark — ${PANACEA_RELEVANCE_QUERIES.length} queries, top-${args.limit}, concurrency=${args.concurrency}`,
  );

  try {
    const runs = await pMap(
      PANACEA_RELEVANCE_QUERIES,
      args.concurrency,
      (q) => runQuery(q, prisma, apiKey, args.limit),
    );

    const failures = runs.filter((r) => r.error);
    if (failures.length > 0) {
      console.warn(`⚠ ${failures.length} query(ies) errored — counted as misses:`);
      for (const f of failures) console.warn(`   ${f.query.id}: ${f.error}`);
    }

    const perQuery = runs.map((r) => scoreSingleQuery(r.query, r.hits));
    const summary = summarize(perQuery);
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log('');
    console.log(formatSummary(summary));
    console.log('');
    console.log(`⏱  Elapsed: ${elapsed}s`);

    if (args.out) {
      const payload = {
        generatedAt: new Date().toISOString(),
        limit: args.limit,
        errors: failures.map((f) => ({ id: f.query.id, error: f.error })),
        summary: {
          hitAt1: summary.hitAt1,
          hitAt5: summary.hitAt5,
          hitAt10: summary.hitAt10,
          mrr: summary.mrr,
          perIntent: summary.perIntent,
          perSystem: summary.perSystem,
        },
        perQuery: summary.perQuery,
      };
      const outDir = dirname(args.out);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(args.out, JSON.stringify(payload, null, 2));
      console.log(`💾 Wrote ${args.out}`);
    }

    if (args.minHitAt5 > 0 && summary.hitAt5 < args.minHitAt5) {
      console.error(
        `\n❌ Regression: Hit@5 = ${(summary.hitAt5 * 100).toFixed(1)}% < floor ${(args.minHitAt5 * 100).toFixed(1)}%`,
      );
      process.exit(2);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Benchmark crashed:', err);
  process.exit(1);
});
