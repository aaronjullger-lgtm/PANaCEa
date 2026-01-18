#!/usr/bin/env tsx
/**
 * Cleanup orphaned Condition records that don't have corresponding MedicalContent
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanOrphanedConditions() {
  console.log('🧹 Cleaning orphaned Condition records...\n');

  // Get all MedicalContent conditionIds
  const medicalContent = await prisma.medicalContent.findMany({
    select: { conditionId: true },
  });
  const mcIds = new Set(medicalContent.map((m) => m.conditionId));

  // Get all Condition records
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  // Find orphans (in Condition but not in MedicalContent)
  const orphans = conditions.filter((c) => !mcIds.has(c.id));

  console.log('📋 MedicalContent records:', mcIds.size);
  console.log('📋 Condition records:', conditions.length);
  console.log('🔍 Orphaned Condition records:', orphans.length);

  if (orphans.length > 0) {
    console.log('\nDeleting orphaned Condition records...\n');

    for (const orphan of orphans) {
      await prisma.condition.delete({ where: { id: orphan.id } });
      console.log(`  ✓ Deleted: ${orphan.name} (${orphan.system})`);
    }

    console.log(`\n✅ Deleted ${orphans.length} orphaned Condition records`);
  } else {
    console.log('\n✅ No orphaned records found - tables are in sync!');
  }

  // Verify final counts
  const finalConditions = await prisma.condition.count();
  console.log('\n═══════════════════════════════════════');
  console.log('Final Condition count:', finalConditions);
  console.log('MedicalContent count:', mcIds.size);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

cleanOrphanedConditions().catch(console.error);
