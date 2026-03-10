#!/usr/bin/env npx tsx
/**
 * Phase 3c: Populate PearlConditionLink from existing ClinicalPearl.conditionId
 *
 * Many ClinicalPearl records already have conditionId or medicalContentId set.
 * This creates PearlConditionLink entries from those existing FKs.
 *
 * Usage: npx tsx scripts/fixes/phase3c-pearl-links.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { v4 as uuidv4 } from 'uuid';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Phase 3c: Populate PearlConditionLink                    ║');
  console.log(`║  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}                                            ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Get pearls with conditionId set
  const pearlsWithCondition = await prisma.clinicalPearl.findMany({
    where: { conditionId: { not: null } },
    select: { id: true, conditionId: true, medicalContentId: true },
  });

  console.log(`\nPearls with conditionId: ${pearlsWithCondition.length}`);

  // Get existing links
  const existing = await prisma.pearlConditionLink.findMany({
    select: { pearlId: true, conditionId: true },
  });
  const existingSet = new Set(existing.map((l) => `${l.pearlId}:${l.conditionId}`));
  console.log(`Existing PearlConditionLinks: ${existing.length}\n`);

  let created = 0;
  let skipped = 0;

  for (const pearl of pearlsWithCondition) {
    if (!pearl.conditionId) continue;
    const key = `${pearl.id}:${pearl.conditionId}`;
    if (existingSet.has(key)) { skipped++; continue; }

    if (!DRY_RUN) {
      try {
        await prisma.pearlConditionLink.create({
          data: {
            id: uuidv4(),
            pearlId: pearl.id,
            conditionId: pearl.conditionId,
            medicalContentId: pearl.medicalContentId,
            relevance: 'direct',
            updatedAt: new Date(),
          } as any,
        });
        existingSet.add(key);
        created++;
      } catch { skipped++; }
    } else { created++; }
  }

  // Also link pearls that have medicalContentId but no conditionId
  const pearlsWithMC = await prisma.clinicalPearl.findMany({
    where: {
      conditionId: null,
      medicalContentId: { not: null },
    },
    select: { id: true, medicalContentId: true },
  });

  console.log(`Pearls with medicalContentId only: ${pearlsWithMC.length}`);

  for (const pearl of pearlsWithMC) {
    if (!pearl.medicalContentId) continue;
    // Look up the condition via MedicalContent
    const mc = await prisma.medicalContent.findUnique({
      where: { id: pearl.medicalContentId },
      select: { conditionId: true },
    });
    if (!mc) continue;

    const conditionId = mc.conditionId;
    const key = `${pearl.id}:${conditionId}`;
    if (existingSet.has(key)) { skipped++; continue; }

    // Verify condition exists
    const condExists = await prisma.condition.findUnique({ where: { id: conditionId } });
    if (!condExists) continue;

    if (!DRY_RUN) {
      try {
        await prisma.pearlConditionLink.create({
          data: {
            id: uuidv4(),
            pearlId: pearl.id,
            conditionId,
            medicalContentId: pearl.medicalContentId,
            relevance: 'direct',
            updatedAt: new Date(),
          } as any,
        });
        existingSet.add(key);
        created++;
      } catch { skipped++; }
    } else { created++; }
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);

  await disconnectPrisma();
}

main().catch(async (e) => {
  console.error('❌ Fatal error:', e);
  await disconnectPrisma();
  process.exit(1);
});
