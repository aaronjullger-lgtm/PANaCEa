#!/usr/bin/env tsx
/**
 * Sync Drug Table from Registry
 * 
 * This script syncs the Drug table with the drugRegistry.
 * The Drug table serves as the source of truth for what drugs exist.
 * 
 * IMPORTANT: This script only ADDS new drugs. It never overwrites existing database records.
 * This preserves any manual edits or AI-generated content in the database.
 * 
 * Workflow:
 * 1. Add drug to drugRegistry.ts
 * 2. Run this script to sync Drug table (adds only, no overwrites)
 * 3. Automation detects new drugs and generates detailed content
 * 
 * Usage: tsx scripts/syncDrugTable.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { DRUG_REGISTRY, buildDrugId } from '../drugRegistry';
import { fileURLToPath } from 'url';

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
  errors: Array<{ drug: string; error: string }>;
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
 * Sync a single drug from registry to database (ADD ONLY)
 */
async function syncDrug(meta: any): Promise<void> {
  const drugId = buildDrugId(meta);

  try {
    // Check if drug exists by genericName
    const existing = await prisma.drug.findFirst({
      where: {
        genericName: meta.genericName,
      },
    });

    if (existing) {
      report.skipped++;
      console.log(`  ⏭️  Skipped (already exists): ${meta.genericName}`);
      return;
    }

    // Create new drug (ADD ONLY)
    await prisma.drug.create({
      data: {
        id: drugId,
        genericName: meta.genericName,
        brandName: meta.brandName || null,
        drugClass: meta.drugClass,
        mechanismOfAction: meta.mechanismOfAction || null,
        indications: meta.indications || [],
        contraindications: meta.contraindications || [],
        sideEffects: meta.commonSideEffects || [],
        interactions: null, // Will be filled by automation
        dosing: null, // Will be filled by automation
        tags: meta.drugClass,
        isHighYield: meta.isHighYield,
      },
    });
    report.created++;
    console.log(`  ✨ Created: ${meta.genericName} (${meta.drugClass.join(', ')})`);
  } catch (error: any) {
    report.failed++;
    report.errors.push({
      drug: meta.genericName,
      error: error.message,
    });
    console.error(`  ❌ Failed: ${meta.genericName} - ${error.message}`);
  }
}

/**
 * Sync all drugs from registry
 */
async function syncAllDrugs(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Syncing Drug Table from Registry (ADD ONLY)            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  report.totalInRegistry = DRUG_REGISTRY.length;
  console.log(`📊 Total drugs in registry: ${report.totalInRegistry}\n`);

  for (const meta of DRUG_REGISTRY) {
    await syncDrug(meta);
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
      console.log(`  ${i + 1}. ${err.drug}: ${err.error}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Main execution
 */
async function main() {
  try {
    await syncAllDrugs();
    printReport();

    if (report.failed > 0) {
      console.log('\n⚠️  Some drugs failed to sync. Check errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ Drug table sync completed successfully!');
      
      if (report.created > 0) {
        console.log(`\n💡 ${report.created} new drugs added to database.`);
        console.log('   Automation will generate detailed content for these drugs.');
      }
      
      if (report.skipped > 0) {
        console.log(`\n📝 ${report.skipped} drugs already exist in database (preserved, not overwritten).`);
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

export { syncAllDrugs };
