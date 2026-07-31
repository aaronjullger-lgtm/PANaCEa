#!/usr/bin/env tsx
/**
 * scripts/verify-langsmith.ts
 *
 * Verifies LangSmith tracing is working end-to-end by:
 * 1. Invoking an agent (intent-router) via the registry
 * 2. Waiting for LangSmith to ingest the trace
 * 3. Querying the LangSmith API for recent runs
 * 4. Reporting whether the trace was found
 *
 * Exit codes:
 *   0 — trace found, LangSmith is working
 *   1 — trace not found within timeout, or query failed
 *
 * Usage: npx tsx scripts/verify-langsmith.ts
 * Requires: LANGSMITH_API_KEY and at least one AI provider key in .env
 */

import { invokeAgent } from '@/lib/agents/registry';

const LANGSMITH_API = 'https://api.smith.langchain.com';
const INGEST_DELAY_MS = 5000;
const MAX_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryLangsmithRuns(apiKey: string, project: string): Promise<unknown[]> {
  const url = `${LANGSMITH_API}/runs?session=${encodeURIComponent(project)}&limit=10&order_by=-start_time`;
  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`LangSmith API returned ${response.status}: ${await response.text()}`);
  }
  const data = await response.json() as unknown;
  return Array.isArray(data) ? data : [];
}

async function main() {
  const apiKey = process.env.LANGSMITH_API_KEY;
  if (!apiKey) {
    console.error('LANGSMITH_API_KEY not set in environment.');
    process.exit(1);
  }
  const project = process.env.LANGSMITH_PROJECT ?? 'panacea';
  const aiKey = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!aiKey) {
    console.error('No AI provider API key found. Need at least one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY');
    process.exit(1);
  }

  console.log(`Verifying LangSmith tracing for project "${project}"...`);
  console.log('Step 1: Invoking intent-router agent...');

  const invokeStart = Date.now();
  const result = await invokeAgent(
    'intent-router',
    { studentUtterance: 'How long has the pain been present?' },
    {
      env: {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      } as Record<string, string>,
    },
  );

  console.log(`  Agent returned: status=${result.status}, durationMs=${result.durationMs}`);

  console.log(`Step 2: Waiting ${INGEST_DELAY_MS / 1000}s for LangSmith ingestion...`);
  await sleep(INGEST_DELAY_MS);

  console.log('Step 3: Querying LangSmith for recent runs...');
  const searchAfter = new Date(invokeStart - 10_000).toISOString();

  let found = false;
  const deadline = Date.now() + MAX_WAIT_MS;

  while (Date.now() < deadline) {
    try {
      const runs = await queryLangsmithRuns(apiKey, project);
      const recentRuns = runs.filter((r: unknown) => {
        const run = r as { start_time?: string; name?: string };
        return run.start_time && new Date(run.start_time).getTime() >= invokeStart - 10_000;
      });

      if (recentRuns.length > 0) {
        const run = recentRuns[0] as { name?: string; run_type?: string; start_time?: string };
        console.log(`\n✅ LangSmith trace found!`);
        console.log(`  Run name: ${run.name ?? 'unknown'}`);
        console.log(`  Run type: ${run.run_type ?? 'unknown'}`);
        console.log(`  Start time: ${run.start_time ?? 'unknown'}`);
        console.log(`  Total runs in window: ${recentRuns.length}`);
        found = true;
        break;
      }
    } catch (err) {
      console.warn(`  Query failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`  No trace found yet, retrying in ${POLL_INTERVAL_MS / 1000}s...`);
    await sleep(POLL_INTERVAL_MS);
  }

  if (!found) {
    console.error('\n❌ No LangSmith trace found within 30s timeout.');
    console.error('   Check:');
    console.error('   1. LANGSMITH_API_KEY is valid');
    console.error(`   2. Project "${project}" exists in LangSmith`);
    console.error('   3. The agent actually called routeTask/routeStructured (check agent status)');
    console.error('   4. LangSmith ingestion delay is longer than expected');
    process.exit(1);
  }

  console.log('\nLangSmith tracing is verified working. ✅');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});