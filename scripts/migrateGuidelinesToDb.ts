/**
 * Data Migration Script: Guidelines → Database
 * 
 * Migrates clinical guidelines from data/guidelinesData.ts to the GuidelineVersion table.
 * 
 * Run with: npx tsx scripts/migrateGuidelinesToDb.ts
 */

import { PrismaClient } from '@prisma/client';
import { GUIDELINES_DATABASE } from '../data/guidelinesData';

const prisma = new PrismaClient();

async function migrateGuidelines() {
  console.log('📋 Migrating Clinical Guidelines...');
  console.log(`Found ${GUIDELINES_DATABASE.length} guidelines to migrate.`);

  let successCount = 0;
  let errorCount = 0;

  for (const guideline of GUIDELINES_DATABASE) {
    try {
      // Default values since source/version aren't in the static data
      const source = 'PANaCEa'; 
      const version = '1.0';
      const effectiveDate = new Date();

      await prisma.guidelineVersion.upsert({
        where: {
          source_guidelineName_version: {
            source,
            guidelineName: guideline.name,
            version
          }
        },
        update: {
          content: guideline as any,
          effectiveDate,
          reviewStatus: 'reviewed',
        },
        create: {
          source,
          guidelineName: guideline.name,
          version,
          effectiveDate,
          content: guideline as any,
          detectionMethod: 'manual_migration',
          reviewStatus: 'reviewed',
          keyChanges: ['Initial migration'],
        },
      });

      console.log(`✅ Migrated: ${guideline.name}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to migrate ${guideline.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n============================================================');
  console.log('📊 GUIDELINE MIGRATION REPORT');
  console.log('============================================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed:     ${errorCount}`);
  console.log('============================================================');
}

migrateGuidelines()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
