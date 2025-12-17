#!/usr/bin/env tsx
/**
 * Sync Condition Table from Registry
 * 
 * This script syncs the Condition table with the conditionRegistry.
 * The Condition table serves as the source of truth for what conditions exist.
 * MedicalContent generation is handled separately by automation scripts.
 * 
 * Workflow:
 * 1. Add condition to conditionRegistry.ts
 * 2. Run this script to sync Condition table
 * 3. Automation detects new conditions and generates MedicalContent
 * 
 * Usage: tsx scripts/syncConditionTable.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { CONDITION_REGISTRY, buildConditionDefinition } from '../conditionRegistry';
import { fileURLToPath } from 'url';

// Load environment variables
config();

const prisma = new PrismaClient();

interface SyncReport {
  startTime: Date;
  endTime?: Date;
  totalInRegistry: number;
  created: number;
  unchanged: number;
  failed: number;
  errors: Array<{ condition: string; error: string }>;
}

const report: SyncReport = {
  startTime: new Date(),
  totalInRegistry: 0,
  created: 0,
  unchanged: 0,
  failed: 0,
  errors: [],
};

/**
 * Sync a single condition from registry to database (ADD ONLY)
 * Also checks MedicalContent table to see if content already exists
 */
async function syncCondition(meta: any): Promise<void> {
  const definition = buildConditionDefinition(meta);
  const conditionId = definition.id;

  try {
    // Check if condition exists in Condition table
    const existingCondition = await prisma.condition.findFirst({
      where: {
        OR: [
          { id: conditionId },
          { name: meta.condition, system: meta.system },
        ],
      },
    });

    // Also check if content already exists in MedicalContent table
    const existingContent = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { conditionId: conditionId },
          { condition: meta.condition, system: meta.system },
        ],
      },
    });

    if (existingCondition || existingContent) {
      // Condition already exists - skip to preserve database edits (ADD ONLY)
      report.unchanged++;
      const source = existingContent ? 'MedicalContent' : 'Condition';
      console.log(`  ⏭️  Skipped (already exists in ${source}): ${meta.condition}`);
    } else {
      // Create new condition (ADD ONLY)
      await prisma.condition.create({
        data: {
          id: conditionId,
          name: meta.condition,
          system: meta.system,
        },
      });
      report.created++;
      console.log(`  ✨ Created: ${meta.condition} (${meta.system})`);
    }
  } catch (error: any) {
    report.failed++;
    report.errors.push({
      condition: meta.condition,
      error: error.message,
    });
    console.error(`  ❌ Failed: ${meta.condition} - ${error.message}`);
  }
}

/**
 * Sync all conditions from registry
 */
async function syncAllConditions(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Syncing Condition Table from Registry (ADD ONLY)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  report.totalInRegistry = CONDITION_REGISTRY.length;
  console.log(`📊 Total conditions in registry: ${report.totalInRegistry}\n`);

  for (const meta of CONDITION_REGISTRY) {
    await syncCondition(meta);
  }
}

/**
 * Identify conditions in database not in registry (orphaned)
 */
async function identifyOrphanedConditions(): Promise<void> {
  console.log('\n🔍 Checking for orphaned conditions in database...\n');

  try {
    const registryIds = CONDITION_REGISTRY.map(meta => buildConditionDefinition(meta).id);
    const dbConditions = await prisma.condition.findMany({
      select: { id: true, name: true, system: true },
    });

    const orphaned = dbConditions.filter(c => !registryIds.includes(c.id));

    if (orphaned.length > 0) {
      console.log(`⚠️  Found ${orphaned.length} orphaned conditions (in database but not in registry):`);
      orphaned.forEach(c => {
        console.log(`   - ${c.name} (${c.system}) [ID: ${c.id}]`);
      });
      console.log('\n   These conditions will not receive automated content updates.');
      console.log('   Consider adding them to the registry or archiving them.\n');
    } else {
      console.log('✅ No orphaned conditions found.\n');
    }
  } catch (error: any) {
    console.error('❌ Failed to check orphaned conditions:', error.message);
  }
}

/**
 * Print summary report
 */
function printReport(): void {
  report.endTime = new Date();
  const duration = (report.endTime.getTime() - report.startTime.getTime()) / 1000;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Sync Report Summary                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
  console.log(`📊 Total in Registry: ${report.totalInRegistry}`);
  console.log(`✨ Created (New): ${report.created}`);
  console.log(`⏭️  Skipped (Existing): ${report.unchanged}`);
  console.log(`❌ Failed: ${report.failed}`);

  if (report.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    report.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.condition}: ${err.error}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Main execution
 */
async function main() {
  try {
    await syncAllConditions();
    await identifyOrphanedConditions();
    printReport();

    if (report.failed > 0) {
      console.log('\n⚠️  Some conditions failed to sync. Check errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ Condition table sync completed successfully!');
      
      if (report.created > 0) {
        console.log(`\n💡 ${report.created} new conditions added to database.`);
        console.log('   Next step: Run automation to generate content for new conditions:');
        console.log('   npm run automation:daily');
      }
      
      if (report.unchanged > 0) {
        console.log(`\n📝 ${report.unchanged} conditions already exist in database (preserved, not overwritten).`);
      }
      
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { syncAllConditions };
