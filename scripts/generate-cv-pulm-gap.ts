#!/usr/bin/env node
/**
 * CV/PULM Blueprint Gap Generator
 *
 * Generates questions for under-represented PANCE blueprint areas:
 * Cardiovascular (CV) and Pulmonary (PULM).
 *
 * These are the two highest-weight organ systems on the PANCE:
 *   CV: 16% of exam | PULM: 10% of exam
 *
 * Usage:
 *   npx tsx scripts/generate-cv-pulm-gap.ts           # generate for both
 *   npx tsx scripts/generate-cv-pulm-gap.ts --system CV    # CV only
 *   npx tsx scripts/generate-cv-pulm-gap.ts --system PULM  # PULM only
 */

import 'dotenv/config';

// ─── Target definitions ──────────────────────────────────────────────────────

interface GapTarget {
  system: string;
  systemName: string;
  blueprintWeight: number; // % of PANCE
  target: number;
  estimatedCurrent: number;
  deficit: number;
}

const TARGETS: GapTarget[] = [
  {
    system: 'CV',
    systemName: 'Cardiovascular',
    blueprintWeight: 16,
    target: 50,
    estimatedCurrent: 30,
    deficit: 20,
  },
  {
    system: 'PULM',
    systemName: 'Pulmonary',
    blueprintWeight: 10,
    target: 35,
    estimatedCurrent: 20,
    deficit: 15,
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const systemFilter = args.find((a) => a.startsWith('--system='))?.split('=')[1];

  const targets = systemFilter
    ? TARGETS.filter((t) => t.system === systemFilter)
    : TARGETS;

  if (targets.length === 0) {
    console.error(`No matching systems. Available: ${TARGETS.map((t) => t.system).join(', ')}`);
    process.exit(1);
  }

  console.log('=== CV/PULM Blueprint Gap Generator ===\n');
  console.log('Targets:');
  for (const t of targets) {
    console.log(`  ${t.system} (${t.systemName}): ${t.blueprintWeight}% of PANCE, need ${t.deficit} more (${t.estimatedCurrent}/${t.target})`);
  }
  const totalDeficit = targets.reduce((sum, t) => sum + t.deficit, 0);
  console.log(`\nTotal deficit: ${totalDeficit} questions\n`);

  // Dynamically import the batch generator service
  let generateBatchForSystem: (system: string, count: number) => Promise<{ promoted: number; pending: number; failed: number }>;
  try {
    const mod = await import('../services/ai/batchGeneratorService');
    generateBatchForSystem = mod.generateBatchForSystem;
  } catch (err) {
    console.error('Failed to import batchGeneratorService:', err instanceof Error ? err.message : err);
    console.error('\nMake sure you have DATABASE_URL and GEMINI_API_KEY set in .env');
    process.exit(1);
  }

  const results: Record<string, { promoted: number; pending: number; failed: number }> = {};

  for (const { system, systemName, deficit } of targets) {
    console.log(`\n--- Generating for ${system} (${systemName}) — need ${deficit} more ---`);
    try {
      const batch = await generateBatchForSystem(system, deficit);
      results[system] = batch;
      console.log(`  Promoted: ${batch.promoted}, Pending: ${batch.pending}, Failed: ${batch.failed}`);
    } catch (error) {
      console.error(`  ERROR for ${system}:`, error instanceof Error ? error.message : error);
      results[system] = { promoted: 0, pending: 0, failed: 0 };
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  let totalPromoted = 0;
  let totalPending = 0;
  let totalFailed = 0;
  for (const [system, r] of Object.entries(results)) {
    console.log(`${system}: ${r.promoted} promoted, ${r.pending} pending, ${r.failed} failed`);
    totalPromoted += r.promoted;
    totalPending += r.pending;
    totalFailed += r.failed;
  }
  console.log(`\nTotal: ${totalPromoted} promoted, ${totalPending} pending, ${totalFailed} failed`);

  if (totalFailed > 0) {
    console.log('\n⚠️  Some questions failed to generate. Check GEMINI_API_KEY and rate limits.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
