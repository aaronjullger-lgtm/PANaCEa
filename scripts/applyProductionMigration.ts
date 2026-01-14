#!/usr/bin/env node
/**
 * Production Database Migration Script
 * 
 * This script helps apply the database schema to a production database.
 * It's designed to be run locally with production database credentials.
 * 
 * Usage:
 *   1. Set DATABASE_URL in your .env file to your production database
 *   2. Run: npm run migrate:production
 *   or: npx tsx scripts/applyProductionMigration.ts
 * 
 * Safety Features:
 *   - Checks if tables already exist
 *   - Prompts for confirmation before applying
 *   - Provides detailed logging
 *   - Can be run multiple times safely
 */

import { PrismaClient } from '@prisma/client';
import { createInterface } from 'readline';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

interface MigrationCheck {
  hasUserTable: boolean;
  hasAnyTables: boolean;
  tableCount: number;
  missingTables: string[];
}

// Expected tables from the schema
const EXPECTED_TABLES = [
  'User',
  'PerformanceRecord',
  'SRSItem',
  'SavedQuestion',
  'Condition',
  'MediaAsset',
  'UserAchievement',
  'DailyStreak',
  'ConfusionPair',
  'MasteryProgress',
  'BaselineAssessment',
  'ExplanationReaction',
  'WeaknessPattern',
  'MedicalContent',
  'ContentVersion',
  'ContentAuditLog',
  'ContentHealthReport',
  'PreGeneratedQuestion',
  'BackgroundJob',
  'ContentLock',
  'SyncQueue',
  'EducationalResource',
  'QuestionFlag',
  'SemanticCache',
  'QuestionHistory',
  'ContentBranch',
  'BranchChange',
  'StagingQuestion',
  'UserQuestionSeen',
  'QuestionSeed',
  'ClinicalPearl',
  'UserPearl',
  'GuidelineVersion',
  'GuidelineConflict',
  'NCCPABlueprint',
  'ContentDriftReport',
  'QuestionVerification',
  'StalenessReport',
  'BountyReward',
  'QuestionMigration',
];

/**
 * Check the current state of the database
 */
async function checkDatabaseState(): Promise<MigrationCheck> {
  console.log('🔍 Checking database state...\n');

  try {
    // Query to get all tables in the public schema
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const existingTableNames = tables.map(t => t.table_name);
    const hasUserTable = existingTableNames.includes('User');
    const hasAnyTables = existingTableNames.length > 0;
    const tableCount = existingTableNames.length;

    // Find missing tables
    const missingTables = EXPECTED_TABLES.filter(
      expectedTable => !existingTableNames.includes(expectedTable)
    );

    console.log(`📊 Database Status:`);
    console.log(`   - Total tables found: ${tableCount}`);
    console.log(`   - User table exists: ${hasUserTable ? '✅' : '❌'}`);
    console.log(`   - Missing tables: ${missingTables.length}`);

    if (existingTableNames.length > 0) {
      console.log(`\n📋 Existing tables (${existingTableNames.length}):`);
      existingTableNames.forEach(name => console.log(`   - ${name}`));
    }

    if (missingTables.length > 0) {
      console.log(`\n❌ Missing tables (${missingTables.length}):`);
      missingTables.slice(0, 10).forEach(name => console.log(`   - ${name}`));
      if (missingTables.length > 10) {
        console.log(`   ... and ${missingTables.length - 10} more`);
      }
    }

    return {
      hasUserTable,
      hasAnyTables,
      tableCount,
      missingTables,
    };
  } catch (error) {
    console.error('❌ Error checking database state:', error);
    throw error;
  }
}

/**
 * Prompt user for confirmation
 */
async function promptConfirmation(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Apply the migration
 */
async function applyMigration(): Promise<void> {
  console.log('\n🚀 Applying database migration...\n');

  try {
    console.log('Running: npx prisma migrate deploy');
    
    execSync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'inherit',
    });

    console.log('\n✅ Migration applied successfully!');
  } catch (error) {
    console.error('\n❌ Error applying migration:', error);
    throw error;
  }
}

/**
 * Verify the migration was successful
 */
async function verifyMigration(): Promise<boolean> {
  console.log('\n🔍 Verifying migration...\n');

  try {
    const check = await checkDatabaseState();

    if (check.missingTables.length === 0) {
      console.log('✅ All expected tables are present!');
      return true;
    } else {
      console.log(`⚠️  Still missing ${check.missingTables.length} tables:`);
      check.missingTables.slice(0, 5).forEach(name => console.log(`   - ${name}`));
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     PANaCEa Production Database Migration Tool            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Check database connection
  console.log('🔌 Testing database connection...');
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful\n');
  } catch (error) {
    console.error('❌ Cannot connect to database. Please check your DATABASE_URL in .env');
    console.error('Error:', error);
    process.exit(1);
  }

  // Check current database state
  const initialCheck = await checkDatabaseState();

  // Determine what action to take
  if (initialCheck.missingTables.length === 0) {
    console.log('\n✅ All tables already exist! No migration needed.');
    console.log('Your database is up to date.');
    process.exit(0);
  }

  if (initialCheck.hasAnyTables && !initialCheck.hasUserTable) {
    console.log('\n⚠️  WARNING: Database has tables but is missing core tables like "User".');
    console.log('This might indicate a partial migration or different schema.');
  }

  if (!initialCheck.hasAnyTables) {
    console.log('\n📝 Database is empty. Ready for initial migration.');
  } else {
    console.log(`\n📝 Database has ${initialCheck.tableCount} tables but is missing ${initialCheck.missingTables.length} expected tables.`);
  }

  // Get confirmation
  console.log('\n⚠️  IMPORTANT:');
  console.log('   - This will apply the PANaCEa database schema');
  console.log('   - Make sure you have a backup of your database');
  console.log('   - This operation creates new tables and indexes');
  console.log('   - Existing data will NOT be deleted\n');

  const confirmed = await promptConfirmation('Do you want to proceed with the migration?');

  if (!confirmed) {
    console.log('\n❌ Migration cancelled by user.');
    process.exit(0);
  }

  // Apply migration
  await applyMigration();

  // Verify migration
  const success = await verifyMigration();

  if (success) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ MIGRATION COMPLETED SUCCESSFULLY!          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('Next steps:');
    console.log('1. ✅ Your database is ready');
    console.log('2. 🚀 Deploy your application to Cloudflare Pages');
    console.log('3. 🔧 Verify environment variables are set correctly');
    console.log('4. 🧪 Test the /api/sync endpoint');
    console.log('\nFor more information, see DATABASE_MIGRATION.md\n');
  } else {
    console.log('\n⚠️  Migration completed but verification found issues.');
    console.log('Please check the output above and run the script again if needed.\n');
    process.exit(1);
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
