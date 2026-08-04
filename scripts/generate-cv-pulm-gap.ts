#!/usr/bin/env node
/**
 * CV/PULM Blueprint Gap Generator
 *
 * Generates questions for under-represented PANCE blueprint areas.
 * Uses the canonical analyzer (lib/services/reservoir/blueprintGapAnalyzer)
 * to compute REAL deficits from the prod DB — no stale hardcoded estimates.
 *
 * Usage:
 *   npx tsx scripts/generate-cv-pulm-gap.ts --dry-run          # report gaps only, no Gemini
 *   npx tsx scripts/generate-cv-pulm-gap.ts                    # generate for ALL gapped systems
 *   npx tsx scripts/generate-cv-pulm-gap.ts --system CV        # CV only
 *   npx tsx scripts/generate-cv-pulm-gap.ts --system PULM      # PULM only
 *   npx tsx scripts/generate-cv-pulm-gap.ts --system CV --dry-run
 */

import 'dotenv/config';
import { prisma } from './helpers/prisma-client';
import { analyzeBlueprintGaps } from '../lib/services/reservoir/blueprintGapAnalyzer';

// ─── CLI parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const systemFilter = argv.find((a) => a.startsWith('--system='))?.split('=')[1];
  const dryRun = argv.includes('--dry-run');
  return { systemFilter, dryRun };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { systemFilter, dryRun } = parseArgs(process.argv.slice(2));

  console.log('=== Blueprint Gap Generator ===\n');

  // Real numbers from the canonical analyzer
  const { totalUnused, gaps } = await analyzeBlueprintGaps(prisma);

  console.log(`Total unused (pool) questions: ${totalUnused}\n`);

  if (gaps.length === 0) {
    console.log('No gapped systems — pool is proportionally healthy. Nothing to generate.');
    return;
  }

  console.log('Gapped systems (ratio < 0.5 or critical pool):');
  for (const g of gaps) {
    console.log(
      `  ${g.abbreviation} (${g.system}): unused=${g.unusedCount} expected%=${g.expectedPercent.toFixed(1)} actual%=${g.actualPercent.toFixed(1)} ratio=${g.gapRatio.toFixed(2)} deficit=${g.deficit}`
    );
  }

  // Apply system filter
  const targets = systemFilter ? gaps.filter((g) => g.abbreviation === systemFilter) : gaps;

  if (targets.length === 0) {
    console.error(
      `\nNo gapped systems match --system=${systemFilter}. ` +
        `Gapped: ${gaps.map((g) => g.abbreviation).join(', ') || '(none)'}`
    );
    process.exit(1);
  }

  const totalDeficit = targets.reduce((sum, g) => sum + g.deficit, 0);
  console.log(`\nTarget deficit: ${totalDeficit} questions (${targets.map((g) => `${g.abbreviation}:${g.deficit}`).join(', ')})`);

  if (dryRun) {
    console.log('\n[DRY RUN] No generation performed. Re-run without --dry-run to generate.');
    return;
  }

  // Dynamically import the batch generator service (Node-only Gemini SDK)
  let generateBatchForSystem: (system: string, count: number) => Promise<{ promoted: number; pending: number; failed: number }>;
  try {
    const mod = await import('../services/ai/batchGeneratorService');
    generateBatchForSystem = mod.generateBatchForSystem;
  } catch (err) {
    console.error('Failed to import batchGeneratorService:', err instanceof Error ? err.message : err);
    console.error('\nMake sure you have DATABASE_URL and GEMINI_API_KEY set.');
    process.exit(1);
  }

  const results: Record<string, { promoted: number; pending: number; failed: number }> = {};

  for (const { abbreviation, system, deficit } of targets) {
    console.log(`\n--- Generating for ${abbreviation} (${system}) — need ${deficit} more ---`);
    try {
      const batch = await generateBatchForSystem(abbreviation, deficit);
      results[abbreviation] = batch;
      console.log(`  Promoted: ${batch.promoted}, Pending: ${batch.pending}, Failed: ${batch.failed}`);
    } catch (error) {
      console.error(`  ERROR for ${abbreviation}:`, error instanceof Error ? error.message : error);
      results[abbreviation] = { promoted: 0, pending: 0, failed: 0 };
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });