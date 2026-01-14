#!/usr/bin/env tsx
/**
 * Seed Database from Condition Registry
 * 
 * This script populates the MedicalContent table directly from the conditionRegistry.
 * This is the source of truth for all medical conditions in the system.
 * 
 * Usage: tsx scripts/seedDatabaseFromRegistry.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { CONDITION_REGISTRY, buildConditionDefinition } from '../config/conditionRegistry';

// Load environment variables
config();

const prisma = new PrismaClient();

interface SeedReport {
  startTime: Date;
  endTime?: Date;
  totalRecords: number;
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ conditionId: string; error: string }>;
}

const report: SeedReport = {
  startTime: new Date(),
  totalRecords: 0,
  created: 0,
  updated: 0,
  failed: 0,
  errors: [],
};

/**
 * Create basic content structure from registry metadata
 */
function createBasicContent(meta: any): any {
  const content: any = {};

  // Add overview if provided
  if (meta.overview) {
    content.overview = meta.overview;
  }

  // Add key points if provided
  if (meta.keyPoints && meta.keyPoints.length > 0) {
    content.keyPoints = meta.keyPoints;
  }

  // Add red flags if provided
  if (meta.redFlags && meta.redFlags.length > 0) {
    content.redFlags = meta.redFlags;
  }

  // Add treatment pearls if provided
  if (meta.treatmentPearls && meta.treatmentPearls.length > 0) {
    content.treatmentPearls = meta.treatmentPearls;
  }

  // Add media IDs if provided
  if (meta.mediaIds && meta.mediaIds.length > 0) {
    content.mediaIds = meta.mediaIds;
  }

  return content;
}

/**
 * Seed condition data from registry
 */
async function seedFromRegistry() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    Seeding Database from Condition Registry               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  report.totalRecords = CONDITION_REGISTRY.length;
  console.log(`📊 Total conditions in registry: ${report.totalRecords}\n`);

  for (const meta of CONDITION_REGISTRY) {
    const definition = buildConditionDefinition(meta);
    const conditionId = definition.id;

    try {
      // Create basic content from metadata
      const content = createBasicContent(meta);

      // Check if already exists
      const existing = await prisma.medicalContent.findUnique({
        where: { conditionId },
      });

      // Prepare related systems array
      const relatedSystems = meta.relatedSystems || [];

      if (existing) {
        // Update existing record
        await prisma.medicalContent.update({
          where: { conditionId },
          data: {
            system: meta.system,
            subcategory: meta.subcategory,
            condition: meta.condition,
            relatedSystems,
            overview: (content as any).overview,
            etiology: (content as any).etiology,
            pathophysiology: (content as any).pathophysiology,
            epidemiology: (content as any).epidemiology,
            symptoms: (content as any).symptoms,
            physicalExam: (content as any).physicalExam,
            diagnostics: (content as any).diagnostics,
            treatment: (content as any).treatment,
            prognosis: (content as any).prognosis,
            riskFactors: (content as any).riskFactors,
            complications: (content as any).complications,
            updatedAt: new Date(),
            updatedBy: 'system:registry-seed',
          },
        });
        report.updated++;
        console.log(`  ✓ Updated: ${meta.condition} (${conditionId})`);
      } else {
        // Create new record
        await prisma.medicalContent.create({
          data: {
            conditionId,
            system: meta.system,
            subcategory: meta.subcategory,
            condition: meta.condition,
            relatedSystems,
            overview: (content as any).overview,
            etiology: (content as any).etiology,
            pathophysiology: (content as any).pathophysiology,
            epidemiology: (content as any).epidemiology,
            symptoms: (content as any).symptoms,
            physicalExam: (content as any).physicalExam,
            diagnostics: (content as any).diagnostics,
            treatment: (content as any).treatment,
            prognosis: (content as any).prognosis,
            riskFactors: (content as any).riskFactors,
            complications: (content as any).complications,
            status: 'published', // Registry items are considered published
            version: 1,
            createdBy: 'system:registry-seed',
            updatedBy: 'system:registry-seed',
          },
        });
        report.created++;
        console.log(`  ✓ Created: ${meta.condition} (${conditionId})`);
      }
    } catch (error: any) {
      report.failed++;
      report.errors.push({
        conditionId,
        error: error.message,
      });
      console.error(`  ✗ Failed: ${conditionId} - ${error.message}`);
    }
  }
}

/**
 * Print summary report
 */
function printReport() {
  report.endTime = new Date();
  const duration = (report.endTime.getTime() - report.startTime.getTime()) / 1000;

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Seed Report Summary                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
  console.log(`📊 Total Records: ${report.totalRecords}`);
  console.log(`✅ Created: ${report.created}`);
  console.log(`🔄 Updated: ${report.updated}`);
  console.log(`❌ Failed: ${report.failed}`);

  if (report.errors.length > 0) {
    console.log('\n⚠️  Errors:');
    report.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err.conditionId}: ${err.error}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Main execution
 */
async function main() {
  try {
    await seedFromRegistry();
    printReport();

    if (report.failed > 0) {
      console.log('\n⚠️  Some records failed to seed. Check errors above.');
      process.exit(1);
    } else {
      console.log('\n✅ Database seeding completed successfully!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { seedFromRegistry };
