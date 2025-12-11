#!/usr/bin/env tsx

/**
 * Migration Script: Add and Populate relatedSystems
 * 
 * This script:
 * 1. Applies the relatedSystems schema migration
 * 2. Optionally populates relatedSystems for known multi-system conditions
 * 
 * Usage:
 *   npm run migrate:related-systems
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Common multi-system conditions and their related systems
const MULTI_SYSTEM_CONDITIONS = {
  'Sarcoidosis': {
    primarySystem: 'PULM',
    relatedSystems: ['DERM', 'HEENT', 'CV', 'NEURO']
  },
  'Systemic Lupus Erythematosus': {
    primarySystem: 'MSK',
    relatedSystems: ['DERM', 'RENAL', 'HEME', 'CV', 'NEURO']
  },
  'SLE': {
    primarySystem: 'MSK',
    relatedSystems: ['DERM', 'RENAL', 'HEME', 'CV', 'NEURO']
  },
  'Syphilis': {
    primarySystem: 'ID',
    relatedSystems: ['DERM', 'NEURO', 'CV']
  },
  'HIV/AIDS': {
    primarySystem: 'ID',
    relatedSystems: ['DERM', 'NEURO', 'GI', 'PULM']
  },
  'Tuberculosis': {
    primarySystem: 'PULM',
    relatedSystems: ['ID', 'NEURO', 'MSK', 'GU']
  },
  'Amyloidosis': {
    primarySystem: 'HEME',
    relatedSystems: ['CV', 'RENAL', 'GI', 'NEURO']
  },
  'Hemochromatosis': {
    primarySystem: 'HEME',
    relatedSystems: ['ENDO', 'CV', 'MSK', 'GI']
  },
  'Diabetes Mellitus': {
    primarySystem: 'ENDO',
    relatedSystems: ['CV', 'RENAL', 'NEURO', 'DERM']
  },
  'Hyperthyroidism': {
    primarySystem: 'ENDO',
    relatedSystems: ['CV', 'NEURO', 'MSK', 'HEENT']
  },
  'Hypothyroidism': {
    primarySystem: 'ENDO',
    relatedSystems: ['CV', 'NEURO', 'DERM', 'GI']
  },
  'Scleroderma': {
    primarySystem: 'MSK',
    relatedSystems: ['DERM', 'GI', 'PULM', 'RENAL', 'CV']
  },
  'Dermatomyositis': {
    primarySystem: 'MSK',
    relatedSystems: ['DERM', 'PULM', 'CV']
  },
  'Polymyositis': {
    primarySystem: 'MSK',
    relatedSystems: ['PULM', 'CV']
  },
  "Wilson's Disease": {
    primarySystem: 'GI',
    relatedSystems: ['NEURO', 'PSYCH', 'HEENT']
  },
  'Inflammatory Bowel Disease': {
    primarySystem: 'GI',
    relatedSystems: ['MSK', 'DERM', 'HEENT']
  },
  "Crohn's Disease": {
    primarySystem: 'GI',
    relatedSystems: ['MSK', 'DERM', 'HEENT']
  },
  'Ulcerative Colitis': {
    primarySystem: 'GI',
    relatedSystems: ['MSK', 'DERM', 'HEENT']
  },
  'Lyme Disease': {
    primarySystem: 'ID',
    relatedSystems: ['MSK', 'NEURO', 'CV', 'DERM']
  },
  'Vasculitis': {
    primarySystem: 'MSK',
    relatedSystems: ['DERM', 'RENAL', 'NEURO', 'PULM']
  },
  'Behcet Disease': {
    primarySystem: 'MSK',
    relatedSystems: ['DERM', 'HEENT', 'GI', 'NEURO']
  },
};

async function main() {
  console.log('🔄 Starting relatedSystems migration...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not set in environment');
    console.log('\nThis script requires a database connection.');
    console.log('Set DATABASE_URL in your .env file and try again.\n');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected\n');

    // Check if column exists (migration already applied)
    console.log('🔍 Checking if relatedSystems column exists...');
    const tableInfo = await prisma.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
        AND table_name = 'MedicalContent' 
        AND column_name = 'relatedSystems'
    `;

    if (tableInfo.length === 0) {
      console.log('📋 Column does not exist. Migration needs to be applied.\n');
      console.log('Run: npx prisma migrate deploy\n');
      process.exit(0);
    }

    console.log('✅ relatedSystems column exists\n');

    // Count existing content
    const totalContent = await prisma.medicalContent.count();
    console.log(`📊 Found ${totalContent} content records\n`);

    if (totalContent === 0) {
      console.log('ℹ️  No content in database yet. Skipping population.\n');
      process.exit(0);
    }

    // Ask user if they want to populate relatedSystems
    console.log('🔧 Populating relatedSystems for known multi-system conditions...\n');

    let updateCount = 0;
    for (const [conditionName, config] of Object.entries(MULTI_SYSTEM_CONDITIONS)) {
      try {
        // Find conditions by name (case-insensitive)
        const conditions = await prisma.medicalContent.findMany({
          where: {
            condition: {
              contains: conditionName,
              mode: 'insensitive'
            },
            // Only update if relatedSystems is empty
            relatedSystems: { isEmpty: true }
          }
        });

        if (conditions.length === 0) {
          continue;
        }

        // Update each matching condition
        for (const condition of conditions) {
          await prisma.medicalContent.update({
            where: { id: condition.id },
            data: {
              relatedSystems: config.relatedSystems
            }
          });
          
          console.log(`  ✓ Updated: ${condition.condition} (${config.relatedSystems.join(', ')})`);
          updateCount++;
        }
      } catch (error) {
        console.warn(`  ⚠️  Could not update ${conditionName}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    console.log(`\n✅ Migration complete! Updated ${updateCount} conditions.\n`);

    // Show statistics
    const withRelatedSystems = await prisma.medicalContent.count({
      where: {
        relatedSystems: { isEmpty: false }
      }
    });

    console.log('📊 Statistics:');
    console.log(`   Total content: ${totalContent}`);
    console.log(`   With relatedSystems: ${withRelatedSystems}`);
    console.log(`   Without relatedSystems: ${totalContent - withRelatedSystems}\n`);

    console.log('💡 Next steps:');
    console.log('   - Review conditions with relatedSystems set');
    console.log('   - Add relatedSystems to additional conditions as needed');
    console.log('   - Test multi-system queries with getConditionsBySystem()\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
