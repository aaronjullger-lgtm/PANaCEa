/**
 * Data Migration Script: Static Files → Database
 * 
 * This script safely migrates data from static JSON/TS files to the Supabase database.
 * 
 * IMPORTANT: This does NOT delete any static files. They remain as backup.
 * 
 * What it does:
 * - Reads data from static files (conditionContent, pharmData, etc.)
 * - Inserts/updates records in the database
 * - Creates a migration report
 * - Validates data integrity after migration
 * 
 * Run with: npx tsx scripts/migrateStaticDataToDatabase.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { CONDITION_REGISTRY, buildConditionDefinition } from '../conditionRegistry';

const prisma = new PrismaClient();

// Create a lookup map for faster access
const registryMap = new Map(
  CONDITION_REGISTRY.map((item) => [buildConditionDefinition(item).id, item])
);

function toTitleCase(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSubcategory(sub: string): string {
  return sub.split('__').map(toTitleCase).join(' - ');
}

interface MigrationReport {
  startTime: Date;
  endTime?: Date;
  totalRecords: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    source: string;
    record: string;
    error: string;
  }>;
}

const report: MigrationReport = {
  startTime: new Date(),
  totalRecords: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  errors: [],
};

/**
 * Safely load JSON file with error handling
 */
function loadJsonFile<T>(filePath: string): T | null {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return null;
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`❌ Error loading ${filePath}:`, error);
    return null;
  }
}

/**
 * Migrate condition content to MedicalContent table
 * 
 * Note: This preserves the existing static file as backup
 */
async function migrateConditionContent() {
  console.log('\n📋 Migrating Condition Content...');
  
  // Try multiple possible locations
  const possiblePaths = [
    'conditionContent.generated.json',
    'conditionContent.correct.json',
    'src/conditionContent.generated.json',
  ];

  let conditionData: any = null;
  let usedPath = '';

  for (const p of possiblePaths) {
    conditionData = loadJsonFile(p);
    if (conditionData) {
      usedPath = p;
      break;
    }
  }

  if (!conditionData) {
    console.log('⚠️  No condition content found. Skipping migration.');
    return;
  }

  console.log(`✓ Loaded data from: ${usedPath}`);
  
  const conditions = Object.entries(conditionData);
  report.totalRecords += conditions.length;

  for (const [conditionId, content] of conditions) {
    try {
      // Check if already exists - REMOVED to allow updates
      /*
      const existing = await prisma.medicalContent.findUnique({
        where: { conditionId },
      });

      if (existing) {
        console.log(`  ⏭️  Skipping ${conditionId} (already exists)`);
        report.skipped++;
        continue;
      }
      */

      // Extract metadata from condition ID or Registry
      let system = 'MISC';
      let subcategory = 'general';
      let condition = conditionId;

      const registryEntry = registryMap.get(conditionId);
      if (registryEntry) {
        system = registryEntry.system;
        subcategory = registryEntry.subcategory;
        condition = registryEntry.condition;
      } else {
        // Fallback: Extract from ID
        // Format: SYSTEM__SUBCATEGORY__CONDITION
        const parts = conditionId.split('__');
        system = parts[0] || 'MISC';
        
        const rawCondition = parts.length > 2 ? parts[parts.length - 1] : (parts[2] || conditionId);
        condition = toTitleCase(rawCondition);
        
        // Subcategory is everything in between
        const rawSubcategory = parts.length > 2 ? parts.slice(1, parts.length - 1).join('__') : (parts[1] || 'general');
        subcategory = formatSubcategory(rawSubcategory);
      }

      // Create or update record
      await prisma.medicalContent.upsert({
        where: { conditionId },
        update: {
          system,
          subcategory,
          condition,
          content: content as any,
          updatedAt: new Date(),
        },
        create: {
          conditionId,
          system,
          subcategory,
          condition,
          content: content as any, // Store full JSON structure
          status: 'published', // Assume static data is already approved
          version: 1,
          createdBy: 'migration-script',
          updatedBy: 'migration-script',
          publishedBy: 'migration-script',
          publishedAt: new Date(),
          approvedBy: 'migration-script',
          approvedAt: new Date(),
        },
      });

      console.log(`  ✅ Migrated/Updated: ${conditionId} -> ${condition}`);
      report.successful++;

    } catch (error: any) {
      console.error(`  ❌ Failed to migrate ${conditionId}:`, error.message);
      report.failed++;
      report.errors.push({
        source: 'conditionContent',
        record: conditionId,
        error: error.message,
      });
    }
  }
}

/**
 * Migrate conditions list to Condition table
 */
async function migrateConditions() {
  console.log('\n🏥 Migrating Conditions Registry...');
  
  // Load condition registry (could be TypeScript or JSON)
  const registryPath = 'conditionRegistry.ts';
  
  if (!fs.existsSync(registryPath)) {
    console.log('⚠️  conditionRegistry.ts not found. Skipping.');
    return;
  }

  // For now, skip complex TS parsing. We'll get conditions from MedicalContent instead.
  // This ensures we only create Condition records for content we actually have.
  
  console.log('ℹ️  Deriving conditions from MedicalContent table...');
  
  const medicalContent = await prisma.medicalContent.findMany({
    where: {
      system: {
        not: 'PHARM'
      }
    },
    select: {
      conditionId: true,
      condition: true,
      system: true,
    },
  });

  report.totalRecords += medicalContent.length;

  for (const item of medicalContent) {
    try {
      // Check if condition already exists
      // 1. Try exact name match
      let existing = await prisma.condition.findFirst({
        where: { name: item.condition },
      });

      // 2. If not found, try to find by "raw" name from ID (to fix snake_case)
      if (!existing) {
        const parts = item.conditionId.split('__');
        const rawName = parts.length > 2 ? parts[parts.length - 1] : (parts[2] || item.conditionId);
        
        if (rawName !== item.condition) {
           existing = await prisma.condition.findFirst({
             where: { name: rawName }
           });
        }
      }

      if (existing) {
        // Update existing condition (fix name/system if needed)
        if (existing.name !== item.condition || existing.system !== item.system) {
          await prisma.condition.update({
            where: { id: existing.id },
            data: {
              name: item.condition,
              system: item.system,
            },
          });
          console.log(`  🔄 Updated condition: ${existing.name} -> ${item.condition}`);
          report.successful++;
        } else {
          report.skipped++;
        }
        continue;
      }

      // Create condition record
      await prisma.condition.create({
        data: {
          name: item.condition,
          system: item.system,
        },
      });

      console.log(`  ✅ Created condition: ${item.condition}`);
      report.successful++;

    } catch (error: any) {
      console.error(`  ❌ Failed to create condition ${item.condition}:`, error.message);
      report.failed++;
      report.errors.push({
        source: 'conditions',
        record: item.condition,
        error: error.message,
      });
    }
  }
}

/**
 * Validate migration integrity
 */
async function validateMigration() {
  console.log('\n🔍 Validating migration...');
  
  try {
    // Count records in database
    const medicalContentCount = await prisma.medicalContent.count();
    const conditionsCount = await prisma.condition.count();
    
    console.log(`✓ MedicalContent records: ${medicalContentCount}`);
    console.log(`✓ Condition records: ${conditionsCount}`);
    
    // Check for orphaned records
    const orphanedContent = await prisma.medicalContent.findMany({
      where: {
        condition: {
          not: {
            in: await prisma.condition.findMany().then(cs => cs.map(c => c.name))
          }
        }
      },
      take: 5,
    });
    
    if (orphanedContent.length > 0) {
      console.log(`⚠️  Found ${orphanedContent.length} orphaned content records`);
    } else {
      console.log('✓ No orphaned records found');
    }
    
  } catch (error: any) {
    console.error('❌ Validation failed:', error.message);
  }
}

/**
 * Generate migration report
 */
function generateReport() {
  report.endTime = new Date();
  const duration = report.endTime.getTime() - report.startTime.getTime();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION REPORT');
  console.log('='.repeat(60));
  console.log(`Start Time:  ${report.startTime.toISOString()}`);
  console.log(`End Time:    ${report.endTime.toISOString()}`);
  console.log(`Duration:    ${(duration / 1000).toFixed(2)}s`);
  console.log(`\nTotal Records:     ${report.totalRecords}`);
  console.log(`✅ Successful:     ${report.successful}`);
  console.log(`⏭️  Skipped:        ${report.skipped}`);
  console.log(`❌ Failed:         ${report.failed}`);
  
  if (report.errors.length > 0) {
    console.log(`\n⚠️  ERRORS (${report.errors.length}):`);
    report.errors.forEach((err, idx) => {
      console.log(`\n${idx + 1}. ${err.source} - ${err.record}`);
      console.log(`   ${err.error}`);
    });
  }
  
  console.log('='.repeat(60));
  
  // Save report to file
  const reportPath = path.resolve(process.cwd(), 'output', 'migration-report.json');
  const outputDir = path.dirname(reportPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Starting Data Migration: Static Files → Database');
  console.log('='.repeat(60));
  console.log('⚠️  IMPORTANT: This does NOT delete any static files!');
  console.log('   All original files remain as backup.');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Migrate condition content
    await migrateConditionContent();
    
    // Step 2: Migrate conditions registry
    await migrateConditions();
    
    // Step 3: Validate migration
    await validateMigration();
    
    // Step 4: Generate report
    generateReport();
    
    console.log('\n✨ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Review the migration report in output/migration-report.json');
    console.log('2. Test your application with database-backed data');
    console.log('3. Keep static files as backup until fully verified');
    console.log('4. Update services to read from database first, fall back to static');
    
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
main();
