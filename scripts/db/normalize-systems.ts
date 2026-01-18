#!/usr/bin/env tsx
/**
 * Database System Name Normalization Script
 *
 * Fixes the mismatch between short codes (CV, PULM, GI) and full labels
 * (Cardiovascular, Pulmonary, Gastrointestinal) in the database.
 *
 * The NCCPA Blueprint uses FULL LABELS, so we standardize on those.
 *
 * Usage: npx tsx scripts/db/normalize-systems.ts
 *        npx tsx scripts/db/normalize-systems.ts --dry-run
 */

import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Load environment variables from .env file
config();

// Use DIRECT_DATABASE_URL for scripts (bypasses Accelerate proxy)
const directUrl = process.env.DIRECT_DATABASE_URL;

if (!directUrl) {
  console.error('❌ DIRECT_DATABASE_URL not set in environment');
  process.exit(1);
}

console.log('🔌 Connecting to database...');

// Prisma v7 requires adapter for PostgreSQL
const pool = new Pool({ connectionString: directUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const isDryRun = process.argv.includes('--dry-run');

// ==================== Tracking Counters ====================

interface NormalizationStats {
  systemsRenamed: number;
  duplicatesFound: number;
  orphanedContent: number;
  orphanedConditions: number;
  missingConditions: number;
  missingContent: number;
  errors: string[];
}

const stats: NormalizationStats = {
  systemsRenamed: 0,
  duplicatesFound: 0,
  orphanedContent: 0,
  orphanedConditions: 0,
  missingConditions: 0,
  missingContent: 0,
  errors: [],
};

/**
 * Canonical system names from NCCPA Blueprint
 * All database records should use these exact strings
 */
export const CANONICAL_SYSTEMS = [
  'Cardiovascular',
  'Pulmonary',
  'Gastrointestinal',
  'Musculoskeletal',
  'Infectious Disease',
  'Neurological',
  'Psychiatry',
  'Reproductive',
  'Endocrine',
  'HEENT',
  'Professional Practice',
  'Hematology',
  'Renal',
  'Dermatology',
  'Genitourinary',
] as const;

/**
 * Map all known variants to canonical names
 */
export const SYSTEM_NORMALIZATION: Record<string, string> = {
  // Cardiovascular
  CV: 'Cardiovascular',
  Cardiac: 'Cardiovascular',
  Cardiology: 'Cardiovascular',
  Heart: 'Cardiovascular',

  // Pulmonary
  PULM: 'Pulmonary',
  Respiratory: 'Pulmonary',
  Lungs: 'Pulmonary',

  // Gastrointestinal
  GI: 'Gastrointestinal',
  Gastro: 'Gastrointestinal',
  Digestive: 'Gastrointestinal',

  // Neurological
  NEURO: 'Neurological',
  Neuro: 'Neurological',
  Neurology: 'Neurological',
  'Nervous System': 'Neurological',

  // Musculoskeletal
  MSK: 'Musculoskeletal',
  Ortho: 'Musculoskeletal',
  Orthopedic: 'Musculoskeletal',
  Orthopedics: 'Musculoskeletal',

  // Dermatology
  DERM: 'Dermatology',
  Derm: 'Dermatology',
  Skin: 'Dermatology',

  // Hematology
  HEME: 'Hematology',
  Heme: 'Hematology',
  Blood: 'Hematology',
  Oncology: 'Hematology',
  'Hematology/Oncology': 'Hematology',

  // Endocrine
  ENDO: 'Endocrine',
  Endo: 'Endocrine',
  Endocrinology: 'Endocrine',
  Hormones: 'Endocrine',

  // HEENT (already canonical but add variants)
  ENT: 'HEENT',
  Eyes: 'HEENT',
  Ears: 'HEENT',
  'Head and Neck': 'HEENT',

  // Renal
  RENAL: 'Renal',
  Nephrology: 'Renal',
  Kidney: 'Renal',

  // Reproductive - CRITICAL: Merge OB into Reproductive
  REPRO: 'Reproductive',
  Repro: 'Reproductive',
  OB: 'Reproductive',
  'OB/GYN': 'Reproductive',
  OBGYN: 'Reproductive',
  Obstetrics: 'Reproductive',
  Gynecology: 'Reproductive',
  "Women's Health": 'Reproductive',
  "Men's Health": 'Reproductive',

  // Psychiatry
  PSYCH: 'Psychiatry',
  Psych: 'Psychiatry',
  'Mental Health': 'Psychiatry',
  Behavioral: 'Psychiatry',
  'Behavioral Health': 'Psychiatry',

  // Infectious Disease
  ID: 'Infectious Disease',
  Infectious: 'Infectious Disease',
  Infection: 'Infectious Disease',
  Infections: 'Infectious Disease',

  // Genitourinary
  GU: 'Genitourinary',
  Urology: 'Genitourinary',
  Urinary: 'Genitourinary',

  // Professional Practice
  'Prof Practice': 'Professional Practice',
  Ethics: 'Professional Practice',
  'Practice Management': 'Professional Practice',
};

interface NormalizationReport {
  table: string;
  updates: { from: string; to: string; count: number }[];
  errors: string[];
}

async function normalizeTable(
  tableName: 'medicalContent' | 'condition',
  dryRun: boolean
): Promise<NormalizationReport> {
  const report: NormalizationReport = {
    table: tableName,
    updates: [],
    errors: [],
  };

  console.log(`\n📋 Processing ${tableName} table...`);

  // Get current system distribution
  let currentSystems: { system: string; _count: { id: number } }[];

  if (tableName === 'medicalContent') {
    currentSystems = (await prisma.medicalContent.groupBy({
      by: ['system'],
      _count: { id: true },
    })) as any;
  } else {
    currentSystems = (await prisma.condition.groupBy({
      by: ['system'],
      _count: { id: true },
    })) as any;
  }

  console.log(`  Current systems: ${currentSystems.length}`);

  // Process each non-canonical system
  for (const { system, _count } of currentSystems) {
    // Skip if already canonical
    if (CANONICAL_SYSTEMS.includes(system as any)) {
      continue;
    }

    // Find canonical mapping
    const canonical = SYSTEM_NORMALIZATION[system];

    if (!canonical) {
      // Unknown system - report it
      console.log(`  ⚠️  Unknown system: "${system}" (${_count.id} records)`);
      report.errors.push(`Unknown system: ${system} (${_count.id} records)`);
      continue;
    }

    // Apply normalization
    if (dryRun) {
      console.log(`  🔍 Would rename: "${system}" → "${canonical}" (${_count.id} records)`);
    } else {
      try {
        let result;
        if (tableName === 'medicalContent') {
          result = await prisma.medicalContent.updateMany({
            where: { system },
            data: { system: canonical },
          });
        } else {
          result = await prisma.condition.updateMany({
            where: { system },
            data: { system: canonical },
          });
        }
        console.log(`  ✅ Renamed: "${system}" → "${canonical}" (${result.count} records)`);
        report.updates.push({ from: system, to: canonical, count: result.count });
      } catch (error) {
        const msg = `Failed to rename ${system}: ${error}`;
        console.log(`  ❌ ${msg}`);
        report.errors.push(msg);
      }
    }
  }

  return report;
}

async function validateAndReport() {
  console.log('\n📊 Post-normalization validation...\n');

  // Check MedicalContent
  const contentSystems = await prisma.medicalContent.groupBy({
    by: ['system'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('MedicalContent system distribution:');
  console.log('─'.repeat(50));

  let nonCanonicalCount = 0;
  for (const { system, _count } of contentSystems) {
    const isCanonical = CANONICAL_SYSTEMS.includes(system as any);
    const icon = isCanonical ? '✅' : '⚠️';
    console.log(`  ${icon} ${system.padEnd(25)} ${String(_count.id).padStart(6)} records`);
    if (!isCanonical) nonCanonicalCount += _count.id;
  }

  console.log('─'.repeat(50));
  console.log(`  Total: ${contentSystems.reduce((sum, s) => sum + s._count.id, 0)} conditions`);

  if (nonCanonicalCount > 0) {
    console.log(`  ⚠️  ${nonCanonicalCount} records still have non-canonical system names`);
  } else {
    console.log(`  ✅ All records use canonical system names`);
  }

  // Check Condition table
  const conditionSystems = await prisma.condition.groupBy({
    by: ['system'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\nCondition registry distribution:');
  console.log('─'.repeat(50));

  for (const { system, _count } of conditionSystems) {
    const isCanonical = CANONICAL_SYSTEMS.includes(system as any);
    const icon = isCanonical ? '✅' : '⚠️';
    console.log(`  ${icon} ${system.padEnd(25)} ${String(_count.id).padStart(6)} conditions`);
  }

  console.log('─'.repeat(50));
}

async function checkSpecificConditions() {
  console.log('\n🔍 Checking specific conditions...\n');

  // Check Placental Abruption
  const placentalAbruption = await prisma.medicalContent.findFirst({
    where: {
      condition: {
        contains: 'Placental Abruption',
        mode: 'insensitive',
      },
    },
    select: { condition: true, system: true, subcategory: true },
  });

  if (placentalAbruption) {
    const icon = placentalAbruption.system === 'Reproductive' ? '✅' : '⚠️';
    console.log(
      `  ${icon} Placental Abruption: system="${placentalAbruption.system}", subcategory="${placentalAbruption.subcategory}"`
    );

    if (placentalAbruption.system !== 'Reproductive') {
      console.log(`     → Should be: system="Reproductive", subcategory="Obstetric Emergencies"`);
    }
  } else {
    console.log('  ❓ Placental Abruption not found in database');
  }

  // Check for orphaned OB conditions
  const obConditions = await prisma.medicalContent.findMany({
    where: {
      OR: [{ system: 'OB' }, { system: 'OB/GYN' }, { system: 'OBGYN' }, { system: 'Obstetrics' }],
    },
    select: { condition: true, system: true },
    take: 10,
  });

  if (obConditions.length > 0) {
    console.log(`\n  ⚠️  Found ${obConditions.length} conditions with OB-variant system names:`);
    for (const c of obConditions) {
      console.log(`     - ${c.condition} (${c.system})`);
    }
  } else {
    console.log('  ✅ No orphaned OB/OBGYN conditions found');
  }
}

// ==================== Table Sync & Integrity Checks ====================

/**
 * Check for duplicate conditions across both tables
 */
async function checkDuplicates() {
  console.log('\n🔍 Checking for duplicates...\n');

  // Check MedicalContent duplicates by condition name
  const contentDuplicates = await prisma.$queryRaw<Array<{ condition: string; count: bigint }>>`
    SELECT condition, COUNT(*) as count
    FROM "MedicalContent"
    GROUP BY condition
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;

  if (contentDuplicates.length > 0) {
    console.log(
      `  ⚠️  Found ${contentDuplicates.length} duplicate condition names in MedicalContent:`
    );
    for (const dup of contentDuplicates) {
      console.log(`     - "${dup.condition}" (${dup.count} entries)`);
      stats.duplicatesFound += Number(dup.count) - 1;
    }
  } else {
    console.log('  ✅ No duplicate condition names in MedicalContent');
  }

  // Check Condition table duplicates
  const conditionDuplicates = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
    SELECT name, COUNT(*) as count
    FROM "Condition"
    GROUP BY name
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `;

  if (conditionDuplicates.length > 0) {
    console.log(
      `\n  ⚠️  Found ${conditionDuplicates.length} duplicate condition names in Condition table:`
    );
    for (const dup of conditionDuplicates) {
      console.log(`     - "${dup.name}" (${dup.count} entries)`);
      stats.duplicatesFound += Number(dup.count) - 1;
    }
  } else {
    console.log('  ✅ No duplicate condition names in Condition table');
  }
}

/**
 * Sync Condition ↔ MedicalContent tables
 * Based on condition-doctor.ts Phase 6 logic
 */
async function syncConditionTables(dryRun: boolean) {
  console.log('\n🔗 Syncing Condition ↔ MedicalContent tables...\n');

  // Get all MedicalContent records
  const allMedicalContent = await prisma.medicalContent.findMany({
    select: { id: true, conditionId: true, condition: true, system: true, subcategory: true },
  });

  // Get all Condition records
  const allConditions = await prisma.condition.findMany({
    select: { id: true, name: true, system: true },
  });

  const conditionMap = new Map(allConditions.map((c) => [c.id, c]));
  const conditionNameMap = new Map(allConditions.map((c) => [c.name.toLowerCase(), c]));

  console.log(`   📋 MedicalContent records: ${allMedicalContent.length}`);
  console.log(`   📋 Condition records: ${allConditions.length}`);

  // Find MedicalContent records without corresponding Condition entry
  const orphanedContent: typeof allMedicalContent = [];

  for (const mc of allMedicalContent) {
    const byId = conditionMap.has(mc.conditionId);
    const byName = conditionNameMap.has(mc.condition.toLowerCase());

    if (!byId && !byName) {
      orphanedContent.push(mc);
    }
  }

  stats.orphanedContent = orphanedContent.length;
  console.log(`\n   🔍 MedicalContent without Condition entry: ${orphanedContent.length}`);

  if (orphanedContent.length > 0) {
    if (dryRun) {
      console.log('   📝 Would create missing Condition entries:');
      for (const mc of orphanedContent.slice(0, 10)) {
        console.log(`      - ${mc.condition} (${mc.system})`);
      }
      if (orphanedContent.length > 10) {
        console.log(`      ... and ${orphanedContent.length - 10} more`);
      }
    } else {
      console.log('   ✏️  Creating missing Condition entries...');

      for (const mc of orphanedContent) {
        try {
          await prisma.condition.create({
            data: {
              id: mc.conditionId,
              name: mc.condition,
              system: mc.system,
              subcategory: mc.subcategory || 'General',
              aliases: [],
              relatedSystems: [],
            },
          });
          console.log(`      ✓ Created: ${mc.condition}`);
          stats.missingConditions++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          if (!errorMsg.includes('Unique constraint')) {
            console.log(`      ⚠️  Skipped ${mc.condition}: ${errorMsg}`);
            stats.errors.push(`Failed to create Condition for ${mc.condition}: ${errorMsg}`);
          }
        }
      }
    }
  }

  // Find Condition records without corresponding MedicalContent
  const contentIdSet = new Set(allMedicalContent.map((mc) => mc.conditionId));
  const orphanedConditions = allConditions.filter((c) => !contentIdSet.has(c.id));

  stats.orphanedConditions = orphanedConditions.length;
  console.log(`\n   🔍 Condition records without MedicalContent: ${orphanedConditions.length}`);

  if (orphanedConditions.length > 0) {
    console.log('   ⚠️  Orphaned Condition records (need manual review):');
    for (const c of orphanedConditions.slice(0, 10)) {
      console.log(`      - ${c.name} (${c.system})`);
      stats.missingContent++;
    }
    if (orphanedConditions.length > 10) {
      console.log(`      ... and ${orphanedConditions.length - 10} more`);
    }
  }
}

/**
 * Check for critical missing fields in MedicalContent
 * Based on analyze-database.ts logic
 */
async function checkContentQuality() {
  console.log('\n📊 Checking content quality...\n');

  const total = await prisma.medicalContent.count();

  const missingFields = await prisma.medicalContent.count({
    where: {
      OR: [
        { gold_standard_dx: null },
        { first_line_rx: null },
        { best_initial_test: null },
        { overview: null },
      ],
    },
  });

  const missingGoldStandard = await prisma.medicalContent.count({
    where: { gold_standard_dx: null },
  });
  const missingFirstLine = await prisma.medicalContent.count({
    where: { first_line_rx: null },
  });
  const missingBestInitial = await prisma.medicalContent.count({
    where: { best_initial_test: null },
  });
  const missingOverview = await prisma.medicalContent.count({
    where: { overview: null },
  });

  console.log('   🔍 Missing Critical Fields:');
  console.log(
    `      • gold_standard_dx:   ${missingGoldStandard} (${((missingGoldStandard / total) * 100).toFixed(1)}%)`
  );
  console.log(
    `      • first_line_rx:      ${missingFirstLine} (${((missingFirstLine / total) * 100).toFixed(1)}%)`
  );
  console.log(
    `      • best_initial_test:  ${missingBestInitial} (${((missingBestInitial / total) * 100).toFixed(1)}%)`
  );
  console.log(
    `      • overview:           ${missingOverview} (${((missingOverview / total) * 100).toFixed(1)}%)`
  );

  if (missingFields > total * 0.1) {
    stats.errors.push(
      `Warning: ${missingFields} records (${((missingFields / total) * 100).toFixed(1)}%) missing critical fields`
    );
  }

  // Check buzzwords
  const allRecords = await prisma.medicalContent.findMany({
    select: { id: true, buzzwords: true },
  });

  const emptyBuzzwords = allRecords.filter((r) => !r.buzzwords || r.buzzwords.length === 0).length;
  console.log(`\n   🏷️  Buzzwords Status:`);
  console.log(
    `      • With buzzwords:    ${total - emptyBuzzwords} (${(((total - emptyBuzzwords) / total) * 100).toFixed(1)}%)`
  );
  console.log(
    `      • Without buzzwords: ${emptyBuzzwords} (${((emptyBuzzwords / total) * 100).toFixed(1)}%)`
  );
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🔧 DATABASE SYSTEM NAME NORMALIZATION');
  console.log('═'.repeat(60));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  console.log('Canonical systems (from NCCPA Blueprint):');
  for (const system of CANONICAL_SYSTEMS) {
    console.log(`  • ${system}`);
  }

  try {
    // Phase 1: Check specific conditions first
    await checkSpecificConditions();

    // Phase 2: Check for duplicates
    await checkDuplicates();

    // Phase 3: Sync Condition ↔ MedicalContent tables
    await syncConditionTables(isDryRun);

    // Phase 4: Check content quality
    await checkContentQuality();

    // Phase 5: Normalize system names
    console.log('\n📋 Normalizing system names...\n');
    const contentReport = await normalizeTable('medicalContent', isDryRun);
    const conditionReport = await normalizeTable('condition', isDryRun);

    // Phase 6: Validate results
    if (!isDryRun) {
      await validateAndReport();
      await checkSpecificConditions();
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📈 NORMALIZATION SUMMARY');
    console.log('═'.repeat(60));

    const totalUpdates = contentReport.updates.length + conditionReport.updates.length;
    const totalErrors = contentReport.errors.length + conditionReport.errors.length;

    console.log(`\n  System Names:`);
    console.log(`    • Renamed: ${totalUpdates} records`);

    console.log(`\n  Table Integrity:`);
    console.log(`    • Duplicates found: ${stats.duplicatesFound}`);
    console.log(`    • Orphaned MedicalContent: ${stats.orphanedContent}`);
    console.log(`    • Orphaned Conditions: ${stats.orphanedConditions}`);
    if (!isDryRun && stats.missingConditions > 0) {
      console.log(`    • Conditions created: ${stats.missingConditions}`);
    }

    console.log(`\n  Status:`);
    console.log(`    • Errors encountered: ${totalErrors + stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n  ⚠️  Warnings:');
      for (const error of stats.errors.slice(0, 5)) {
        console.log(`    - ${error}`);
      }
      if (stats.errors.length > 5) {
        console.log(`    ... and ${stats.errors.length - 5} more`);
      }
    }

    if (isDryRun) {
      console.log('\n💡 Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Normalization complete!');
      if (stats.orphanedConditions > 0) {
        console.log(
          '⚠️  Note: Some Condition records have no MedicalContent - manual review recommended'
        );
      }
      if (stats.duplicatesFound > 0) {
        console.log(
          '⚠️  Note: Duplicates detected - consider running condition-doctor.ts for deduplication'
        );
      }
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
