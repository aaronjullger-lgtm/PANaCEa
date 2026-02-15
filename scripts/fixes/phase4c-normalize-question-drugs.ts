#!/usr/bin/env npx tsx
/**
 * Phase 4c: Normalize Question.relatedDrugs to match Drug.genericName
 *
 * The relatedDrugs field contains free-text drug names that may not match
 * the Drug table's genericName exactly. This script normalizes them.
 *
 * Usage: npx tsx scripts/fixes/phase4c-normalize-question-drugs.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 4c: Normalize Question.relatedDrugs                ║');
  console.log(
    `║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`
  );
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Build drug lookup
  const drugs = await prisma.drug.findMany({
    select: { genericName: true, brandName: true, aliases: true },
  });

  const drugLookup = new Map<string, string>(); // normalized -> genericName
  for (const d of drugs) {
    drugLookup.set(normalize(d.genericName), d.genericName);
    if (d.brandName) drugLookup.set(normalize(d.brandName), d.genericName);
    for (const alias of d.aliases || []) {
      if (alias) drugLookup.set(normalize(alias), d.genericName);
    }
  }

  console.log(`Drug lookup entries: ${drugLookup.size}`);

  // Get questions with relatedDrugs
  const questions = await prisma.question.findMany({
    where: { relatedDrugs: { isEmpty: false } },
    select: { id: true, relatedDrugs: true },
  });

  console.log(`Questions with relatedDrugs: ${questions.length}\n`);

  let updated = 0;
  let totalNormalized = 0;
  let totalUnmatched = 0;

  for (const q of questions) {
    const normalized: string[] = [];
    let changed = false;

    for (const drugName of q.relatedDrugs) {
      const match = drugLookup.get(normalize(drugName));
      if (match) {
        if (match !== drugName) changed = true;
        normalized.push(match);
        totalNormalized++;
      } else {
        // Keep as-is but log unmatched
        normalized.push(drugName);
        totalUnmatched++;
      }
    }

    // Deduplicate
    const deduped = [...new Set(normalized)];
    if (deduped.length !== normalized.length) changed = true;

    if (changed && !DRY_RUN) {
      await prisma.question.update({
        where: { id: q.id },
        data: { relatedDrugs: deduped },
      });
      updated++;
    } else if (changed) {
      updated++;
    }
  }

  console.log('════════════════════════════════════════');
  console.log(`Questions updated: ${updated}`);
  console.log(`Drug names normalized: ${totalNormalized}`);
  console.log(`Unmatched drug names: ${totalUnmatched}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
