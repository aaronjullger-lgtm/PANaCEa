#!/usr/bin/env npx tsx
/**
 * Phase 5a: Add conditionId to PatientEncounterCase
 *
 * 1. Add conditionId column if not present (via raw SQL)
 * 2. Fuzzy-match correctDiagnosis to Condition.name
 * 3. Populate conditionId for all matching cases
 *
 * Usage: npx tsx scripts/fixes/phase5a-encounter-condition-fk.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 5a: Link PatientEncounterCase to Condition         ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Step 1: Check if conditionId column exists
  try {
    await prisma.$queryRawUnsafe(`SELECT "conditionId" FROM "PatientEncounterCase" LIMIT 1`);
    console.log('\n✅ conditionId column already exists');
  } catch {
    console.log('\n📝 Adding conditionId column to PatientEncounterCase...');
    if (!DRY_RUN) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "PatientEncounterCase" ADD COLUMN IF NOT EXISTS "conditionId" TEXT`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_pec_conditionId" ON "PatientEncounterCase" ("conditionId")`);
      console.log('  ✅ Column and index created');
    } else {
      console.log('  [DRY-RUN] Would add conditionId column');
    }
  }

  // Step 2: Get all conditions for matching
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, aliases: true, displayName: true },
  });

  // Build lookup maps
  const exactMap = new Map<string, string>(); // normalized name -> condition id
  const aliasMap = new Map<string, string>(); // normalized alias -> condition id

  for (const c of conditions) {
    exactMap.set(normalize(c.name), c.id);
    if (c.displayName) exactMap.set(normalize(c.displayName), c.id);
    for (const alias of c.aliases || []) {
      aliasMap.set(normalize(alias), c.id);
    }
  }

  console.log(`\nLoaded ${conditions.length} conditions for matching`);

  // Step 3: Get all encounter cases
  const cases: Array<{ id: string; correctDiagnosis: string; conditionId: string | null }> = await prisma.$queryRawUnsafe(
    `SELECT id, "correctDiagnosis", "conditionId" FROM "PatientEncounterCase"`
  );

  console.log(`Total encounter cases: ${cases.length}`);

  let matched = 0;
  let alreadyLinked = 0;
  let unmatched = 0;

  for (const c of cases) {
    if (c.conditionId) {
      alreadyLinked++;
      continue;
    }

    const normalizedDx = normalize(c.correctDiagnosis);

    // Try exact match
    let conditionId = exactMap.get(normalizedDx);

    // Try alias match
    if (!conditionId) {
      conditionId = aliasMap.get(normalizedDx);
    }

    // Try contains match (condition name is substring of diagnosis or vice versa)
    if (!conditionId) {
      for (const [normName, cId] of exactMap) {
        if (normalizedDx.includes(normName) || normName.includes(normalizedDx)) {
          conditionId = cId;
          break;
        }
      }
    }

    if (conditionId) {
      if (!DRY_RUN) {
        await prisma.$executeRawUnsafe(
          `UPDATE "PatientEncounterCase" SET "conditionId" = $1 WHERE id = $2`,
          conditionId,
          c.id
        );
      }
      matched++;
    } else {
      console.log(`  ❓ Unmatched: "${c.correctDiagnosis}"`);
      unmatched++;
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Already linked: ${alreadyLinked}`);
  console.log(`Newly matched: ${matched}`);
  console.log(`Unmatched: ${unmatched}`);
  console.log(`Total: ${cases.length}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
