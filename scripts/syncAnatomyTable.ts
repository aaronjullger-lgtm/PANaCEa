#!/usr/bin/env tsx
/**
 * Sync AnatomyStructure Table from Registry
 * 
 * This script syncs the AnatomyStructure table with the anatomyRegistry.
 * 
 * IMPORTANT: This script only ADDS new anatomy structures. It never overwrites existing database records.
 * This preserves any manual edits or AI-generated content in the database.
 * 
 * Workflow:
 * 1. Add anatomy structure to anatomyRegistry.ts
 * 2. Run this script to sync AnatomyStructure table (adds only, no overwrites)
 * 3. Automation detects new structures and generates detailed content
 * 
 * Usage: tsx scripts/syncAnatomyTable.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { ANATOMY_REGISTRY, buildAnatomyId } from '../anatomyRegistry';

// Load environment variables
config();

const prisma = new PrismaClient();

interface SyncReport {
  startTime: Date;
  endTime?: Date;
  totalInRegistry: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ structure: string; error: string }>;
}

const report: SyncReport = {
  startTime: new Date(),
  totalInRegistry: 0,
  created: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

/**
 * Sync a single anatomy structure from registry to database (ADD ONLY)
 */
async function syncAnatomy(meta: any): Promise<void> {
  const anatomyId = buildAnatomyId(meta);

  try {
    // Check if anatomy structure exists by name
    const existing = await prisma.anatomyStructure.findFirst({
      where: {
        name: meta.name,
      },
    });

    if (existing) {
      report.skipped++;
      console.log(`  ⏭️  Skipped (already exists): ${meta.name}`);
      return;
    }

    // Create new anatomy structure (ADD ONLY)
    await prisma.anatomyStructure.create({
      data: {
        id: anatomyId,
        name: meta.name,
        system: meta.system,
        region: meta.region || null,
        description: meta.description || null,
        imageUrl: null, // Will be filled by automation
      },
    });
    report.created++;
    console.log(`  ✨ Created: ${meta.name} (${meta.system}${meta.region ? ' - ' + meta.region : ''})`);
  } catch (error: any) {
    report.failed++;
    report.errors.push({
      structure: meta.name,
      error: error.message,
    });
    console.error(`  ❌ Failed: ${meta.name} - ${error.message}`);
  }
}

/**
 * Sync all anatomy structures from registry
 */
async function syncAllAnatomy(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Syncing AnatomyStructure Table from Registry           ║');
  console.log('║    (ADD ONLY - Preserves Existing Records)                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  report.totalInRegistry = ANATOMY_REGISTRY.length;
  console.log(`📊 Total anatomy structures in registry: ${report.totalInRegistry}\n`);

  for (const meta of ANATOMY_REGISTRY) {
    await syncAnatomy(meta);
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
  console.log(`⏭️  Skipped (Existing): ${report.skipped}`);
  console.log(`❌ Failed: ${report.failed}`);

  if (report.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    report.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.structure}: ${err.error}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Main execution
 */
async function main() {
  try {
    await syncAllAnatomy();
    printReport();

    if (report.failed > 0) {
      console.log('\n⚠️  Some anatomy structures failed to sync. Check errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ AnatomyStructure table sync completed successfully!');
      
      if (report.created > 0) {
        console.log(`\n💡 ${report.created} new anatomy structures added to database.`);
        console.log('   Automation will generate detailed content for these structures.');
      }
      
      if (report.skipped > 0) {
        console.log(`\n📝 ${report.skipped} structures already exist in database (preserved, not overwritten).`);
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
if (require.main === module) {
  main().catch(console.error);
}

export { syncAllAnatomy };
