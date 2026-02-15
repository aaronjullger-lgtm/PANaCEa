#!/usr/bin/env npx tsx
/**
 * Phase 3c: Populate DifferentialConditionLink
 *
 * Two-pass approach:
 * 1. SQL pass: Parse DifferentialDiagnosis.differentialList[] and mustNotMiss[]
 *    and fuzzy-match to Condition.name
 * 2. AI pass (optional): For unmatched names
 *
 * Usage: npx tsx scripts/fixes/phase3c-differential-links.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { v4 as uuidv4 } from 'uuid';

const DRY_RUN = process.argv.includes('--dry-run');

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 3c: Populate DifferentialConditionLink             ║');
  console.log(
    `║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`
  );
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Load all conditions for matching
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, aliases: true, displayName: true },
  });

  // Build lookup maps
  const exactMap = new Map<string, string>();
  const aliasMap = new Map<string, string>();
  for (const c of conditions) {
    exactMap.set(normalize(c.name), c.id);
    if (c.displayName) exactMap.set(normalize(c.displayName), c.id);
    for (const alias of c.aliases || []) {
      aliasMap.set(normalize(alias), c.id);
    }
  }

  console.log(`Loaded ${conditions.length} conditions for matching\n`);

  // Load all differential diagnoses
  const ddxList = await prisma.differentialDiagnosis.findMany({
    select: {
      id: true,
      presentingComplaint: true,
      differentialList: true,
      mustNotMiss: true,
      mostCommon: true,
      mostDangerous: true,
      oftenMissed: true,
    },
  });

  console.log(`Processing ${ddxList.length} differential diagnoses...\n`);

  // Load existing links to skip
  const existingLinks = await prisma.differentialConditionLink.findMany({
    select: { differentialId: true, conditionId: true },
  });
  const existingSet = new Set(existingLinks.map((l) => `${l.differentialId}:${l.conditionId}`));
  console.log(`Existing links: ${existingLinks.length}\n`);

  let created = 0;
  let skipped = 0;
  let unmatched = 0;

  function findConditionId(name: string): string | null {
    const norm = normalize(name);
    let id = exactMap.get(norm);
    if (id) return id;
    id = aliasMap.get(norm);
    if (id) return id;
    // Partial match
    for (const [n, cId] of exactMap) {
      if (norm.includes(n) || n.includes(norm)) return cId;
    }
    return null;
  }

  for (const ddx of ddxList) {
    // Combine all condition names from the DDx
    const allNames = new Set<string>();
    for (const name of ddx.differentialList || []) allNames.add(name);
    for (const name of ddx.mustNotMiss || []) allNames.add(name);
    for (const name of ddx.mostCommon || []) allNames.add(name);
    for (const name of ddx.mostDangerous || []) allNames.add(name);
    for (const name of ddx.oftenMissed || []) allNames.add(name);

    let rank = 0;
    for (const name of allNames) {
      rank++;
      const conditionId = findConditionId(name);
      if (!conditionId) {
        unmatched++;
        continue;
      }

      const key = `${ddx.id}:${conditionId}`;
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      const isMustNotMiss = (ddx.mustNotMiss || []).some((m) => normalize(m) === normalize(name));
      const isMostDangerous = (ddx.mostDangerous || []).some(
        (m) => normalize(m) === normalize(name)
      );

      if (!DRY_RUN) {
        try {
          await prisma.differentialConditionLink.create({
            data: {
              id: uuidv4(),
              differentialId: ddx.id,
              conditionId,
              rankOrder: rank,
              likelihood: isMustNotMiss || isMostDangerous ? 'must_not_miss' : 'common',
              distinguishingFeatures: `Differential for: ${ddx.presentingComplaint}`,
              updatedAt: new Date(),
            } as any,
          });
          existingSet.add(key);
          created++;
        } catch {
          // Duplicate or other error
          skipped++;
        }
      } else {
        created++;
      }
    }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Created: ${created}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Unmatched names: ${unmatched}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
