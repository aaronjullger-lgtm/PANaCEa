/**
 * Database Normalization Script: Fix Optional Nulls
 *
 * PURPOSE:
 * Converts inconsistent "empty" states in JSONB columns to the sentinel value "NONE".
 * This signals to AI generation scripts: "We checked, nothing exists here, stop asking."
 *
 * PROBLEM:
 * We have two types of "empty" that are semantically different:
 * 1. SQL NULL (Prisma.DbNull) - Field never processed/checked
 * 2. JSON null (Prisma.JsonNull) - Field was processed but found empty
 *
 * SOLUTION:
 * For records where `clinical_pearls` exists (meaning processed/generated),
 * convert BOTH types of null in optional fields to the explicit string "NONE".
 *
 * FIELDS AFFECTED:
 * - classic_triad
 * - mnemonic
 * - guidelines
 *
 * USAGE:
 * npx ts-node scripts/db/fix-optional-nulls.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface NullFixStats {
  field: string;
  sqlNullsFixed: number;
  jsonNullsFixed: number;
  total: number;
}

interface FieldConfig {
  name: string;
  type: 'json' | 'string';
}

/**
 * Fix a single JSONB field by converting SQL NULL and JSON null to "NONE"
 */
async function fixNullsInJsonField(fieldName: string): Promise<NullFixStats> {
  console.log(`\n🔍 Processing JSONB field: ${fieldName}`);
  console.log('━'.repeat(60));

  let sqlNullsFixed = 0;
  let jsonNullsFixed = 0;

  // STEP 1: Fix SQL NULLs (Prisma.DbNull) for JSONB fields
  console.log(`\n📊 Checking for SQL NULL in ${fieldName}...`);

  const sqlNullQuery: any = {
    clinical_pearls: { not: Prisma.DbNull }, // Pearls exist (processed)
    [fieldName]: { equals: Prisma.DbNull }, // Field is SQL NULL
  };

  const sqlNullCount = await prisma.medicalContent.count({
    where: sqlNullQuery,
  });

  console.log(`   Found ${sqlNullCount} records with SQL NULL`);

  if (sqlNullCount > 0) {
    const sqlNullUpdate = await prisma.medicalContent.updateMany({
      where: sqlNullQuery,
      data: {
        [fieldName]: 'NONE', // Set to sentinel value
      },
    });
    sqlNullsFixed = sqlNullUpdate.count;
    console.log(`   ✅ Fixed ${sqlNullsFixed} SQL NULL records`);
  }

  // STEP 2: Fix JSON nulls (Prisma.JsonNull) for JSONB fields
  console.log(`\n📊 Checking for JSON null in ${fieldName}...`);

  const jsonNullQuery: any = {
    clinical_pearls: { not: Prisma.DbNull }, // Pearls exist (processed)
    [fieldName]: { equals: Prisma.JsonNull }, // Field is JSON null
  };

  const jsonNullCount = await prisma.medicalContent.count({
    where: jsonNullQuery,
  });

  console.log(`   Found ${jsonNullCount} records with JSON null`);

  if (jsonNullCount > 0) {
    const jsonNullUpdate = await prisma.medicalContent.updateMany({
      where: jsonNullQuery,
      data: {
        [fieldName]: 'NONE', // Set to sentinel value
      },
    });
    jsonNullsFixed = jsonNullUpdate.count;
    console.log(`   ✅ Fixed ${jsonNullsFixed} JSON null records`);
  }

  const total = sqlNullsFixed + jsonNullsFixed;

  return {
    field: fieldName,
    sqlNullsFixed,
    jsonNullsFixed,
    total,
  };
}

/**
 * Fix a single String field by converting NULL to "NONE"
 */
async function fixNullsInStringField(fieldName: string): Promise<NullFixStats> {
  console.log(`\n🔍 Processing String field: ${fieldName}`);
  console.log('━'.repeat(60));

  let nullsFixed = 0;

  // String fields only have regular NULL (not JSON null)
  console.log(`\n📊 Checking for NULL in ${fieldName}...`);

  const nullQuery: any = {
    clinical_pearls: { not: Prisma.DbNull }, // Pearls exist (processed)
    [fieldName]: null, // Field is NULL
  };

  const nullCount = await prisma.medicalContent.count({
    where: nullQuery,
  });

  console.log(`   Found ${nullCount} records with NULL`);

  if (nullCount > 0) {
    const nullUpdate = await prisma.medicalContent.updateMany({
      where: nullQuery,
      data: {
        [fieldName]: 'NONE', // Set to sentinel value
      },
    });
    nullsFixed = nullUpdate.count;
    console.log(`   ✅ Fixed ${nullsFixed} NULL records`);
  }

  return {
    field: fieldName,
    sqlNullsFixed: nullsFixed, // For String fields, this is the only null type
    jsonNullsFixed: 0, // String fields don't have JSON null
    total: nullsFixed,
  };
}

/**
 * Main execution function
 */
async function fixOptionalNulls() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Database Normalization: Fix Optional Nulls             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const stats: NullFixStats[] = [];

  try {
    // Check total processed records (those with pearls)
    const processedCount = await prisma.medicalContent.count({
      where: {
        clinical_pearls: { not: Prisma.DbNull },
      },
    });

    console.log(`📈 Total processed records (with clinical_pearls): ${processedCount}`);

    // Define fields to fix with their types
    const fieldsToFix: FieldConfig[] = [
      { name: 'classic_triad', type: 'json' },
      { name: 'mnemonic', type: 'string' },
      { name: 'guidelines', type: 'string' },
    ];

    for (const field of fieldsToFix) {
      const fieldStats =
        field.type === 'json'
          ? await fixNullsInJsonField(field.name)
          : await fixNullsInStringField(field.name);
      stats.push(fieldStats);
    }

    // Summary report
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   SUMMARY REPORT                                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    let totalSqlNulls = 0;
    let totalJsonNulls = 0;
    let grandTotal = 0;

    console.log('┌─────────────────┬─────────────┬──────────────┬───────────┐');
    console.log('│ Field           │ SQL NULLs   │ JSON nulls   │ Total     │');
    console.log('├─────────────────┼─────────────┼──────────────┼───────────┤');

    stats.forEach((stat) => {
      console.log(
        `│ ${stat.field.padEnd(15)} │ ${String(stat.sqlNullsFixed).padStart(11)} │ ${String(stat.jsonNullsFixed).padStart(12)} │ ${String(stat.total).padStart(9)} │`
      );
      totalSqlNulls += stat.sqlNullsFixed;
      totalJsonNulls += stat.jsonNullsFixed;
      grandTotal += stat.total;
    });

    console.log('├─────────────────┼─────────────┼──────────────┼───────────┤');
    console.log(
      `│ ${'TOTAL'.padEnd(15)} │ ${String(totalSqlNulls).padStart(11)} │ ${String(totalJsonNulls).padStart(12)} │ ${String(grandTotal).padStart(9)} │`
    );
    console.log('└─────────────────┴─────────────┴──────────────┴───────────┘');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n⏱️  Completed in ${duration}s`);

    if (grandTotal > 0) {
      console.log(`\n✅ Successfully normalized ${grandTotal} null values to "NONE"`);
      console.log('   AI scripts will now skip these fields instead of repeatedly checking.');
    } else {
      console.log('\n✨ No nulls found! Database is already normalized.');
    }

    // Verification step
    console.log('\n🔍 Verification:');
    for (const field of fieldsToFix) {
      let remaining = 0;

      if (field.type === 'json') {
        const remainingSqlNulls = await prisma.medicalContent.count({
          where: {
            clinical_pearls: { not: Prisma.DbNull },
            [field.name]: { equals: Prisma.DbNull },
          },
        });

        const remainingJsonNulls = await prisma.medicalContent.count({
          where: {
            clinical_pearls: { not: Prisma.DbNull },
            [field.name]: { equals: Prisma.JsonNull },
          },
        });

        remaining = remainingSqlNulls + remainingJsonNulls;
      } else {
        // String field
        remaining = await prisma.medicalContent.count({
          where: {
            clinical_pearls: { not: Prisma.DbNull },
            [field.name]: null,
          },
        });
      }

      const status = remaining === 0 ? '✅' : '⚠️';
      console.log(`   ${status} ${field.name}: ${remaining} nulls remaining`);
    }
  } catch (error) {
    console.error('\n❌ Error during normalization:', error);
    throw error;
  }
}

// Execute script
fixOptionalNulls()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
