/**
 * Database Revert Script: Unlock Fields for Regeneration
 * 
 * PURPOSE:
 * Converts sentinel value "NONE" back to NULL to allow AI generation scripts
 * to process these fields again. Some records were skipped in previous runs
 * and may actually have content worth discovering.
 * 
 * USAGE:
 * npx ts-node scripts/db/revert-none-to-null.ts
 * 
 * CONFIGURATION:
 * Uncomment/comment fields in the FIELDS_TO_UNLOCK array to control which
 * fields get reset. This allows selective unlocking (e.g., only mnemonics today).
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldConfig {
  name: string;
  type: 'json' | 'string';
}

interface UnlockStats {
  field: string;
  recordsUnlocked: number;
}

/**
 * CONFIGURATION: Choose which fields to unlock
 * Comment out any fields you DON'T want to reset
 */
const FIELDS_TO_UNLOCK: FieldConfig[] = [
  { name: 'mnemonic', type: 'string' },
  { name: 'guidelines', type: 'string' },
  { name: 'classic_triad', type: 'json' },
];

/**
 * Unlock a String field by reverting "NONE" to null
 */
async function unlockStringField(fieldName: string): Promise<UnlockStats> {
  console.log(`\n🔓 Unlocking String field: ${fieldName}`);
  console.log('━'.repeat(60));

  // Find records where field is set to "NONE"
  const lockedCount = await prisma.medicalContent.count({
    where: {
      [fieldName]: "NONE",
    },
  });

  console.log(`   Found ${lockedCount} records with "NONE"`);

  let unlocked = 0;

  if (lockedCount > 0) {
    const result = await prisma.medicalContent.updateMany({
      where: {
        [fieldName]: "NONE",
      },
      data: {
        [fieldName]: null, // Reset to NULL
      },
    });

    unlocked = result.count;
    console.log(`   ✅ Unlocked ${unlocked} records for regeneration`);
  } else {
    console.log(`   ℹ️  No locked records found`);
  }

  return {
    field: fieldName,
    recordsUnlocked: unlocked,
  };
}

/**
 * Unlock a JSONB field by reverting "NONE" to Prisma.DbNull
 */
async function unlockJsonField(fieldName: string): Promise<UnlockStats> {
  console.log(`\n🔓 Unlocking JSONB field: ${fieldName}`);
  console.log('━'.repeat(60));

  // Find records where field is set to "NONE" (as JSON string)
  const lockedCount = await prisma.medicalContent.count({
    where: {
      [fieldName]: { equals: "NONE" },
    },
  });

  console.log(`   Found ${lockedCount} records with "NONE"`);

  let unlocked = 0;

  if (lockedCount > 0) {
    const result = await prisma.medicalContent.updateMany({
      where: {
        [fieldName]: { equals: "NONE" },
      },
      data: {
        [fieldName]: Prisma.DbNull, // Reset to SQL NULL
      },
    });

    unlocked = result.count;
    console.log(`   ✅ Unlocked ${unlocked} records for regeneration`);
  } else {
    console.log(`   ℹ️  No locked records found`);
  }

  return {
    field: fieldName,
    recordsUnlocked: unlocked,
  };
}

/**
 * Main execution function
 */
async function revertNoneToNull() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Database Unlock: Revert "NONE" to NULL                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const stats: UnlockStats[] = [];

  try {
    console.log('📋 Fields configured for unlocking:');
    FIELDS_TO_UNLOCK.forEach(field => {
      console.log(`   • ${field.name} (${field.type})`);
    });

    // Process each configured field
    for (const field of FIELDS_TO_UNLOCK) {
      const fieldStats = field.type === 'json'
        ? await unlockJsonField(field.name)
        : await unlockStringField(field.name);
      stats.push(fieldStats);
    }

    // Summary report
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   UNLOCK SUMMARY                                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('┌───────────────────────────┬───────────────────────────┐');
    console.log('│ Field                     │ Records Unlocked          │');
    console.log('├───────────────────────────┼───────────────────────────┤');

    let totalUnlocked = 0;

    stats.forEach(stat => {
      console.log(
        `│ ${stat.field.padEnd(25)} │ ${String(stat.recordsUnlocked).padStart(25)} │`
      );
      totalUnlocked += stat.recordsUnlocked;
    });

    console.log('├───────────────────────────┼───────────────────────────┤');
    console.log(
      `│ ${'TOTAL'.padEnd(25)} │ ${String(totalUnlocked).padStart(25)} │`
    );
    console.log('└───────────────────────────┴───────────────────────────┘');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Completed in ${duration}s`);

    if (totalUnlocked > 0) {
      console.log(`\n✅ Successfully unlocked ${totalUnlocked} field values`);
      console.log('   These records are now ready for AI regeneration.');
      console.log('\n💡 Next step: Run your generation script:');
      console.log('   npm run generate:clinical');
    } else {
      console.log('\n✨ No locked fields found! All records are already available for generation.');
    }

    // Verification
    console.log('\n🔍 Verification:');
    for (const field of FIELDS_TO_UNLOCK) {
      let remaining = 0;

      if (field.type === 'json') {
        remaining = await prisma.medicalContent.count({
          where: { [field.name]: { equals: "NONE" } },
        });
      } else {
        remaining = await prisma.medicalContent.count({
          where: { [field.name]: "NONE" },
        });
      }

      const status = remaining === 0 ? '✅' : '⚠️';
      console.log(`   ${status} ${field.name}: ${remaining} "NONE" values remaining`);
    }

  } catch (error) {
    console.error('\n❌ Error during unlock operation:', error);
    throw error;
  }
}

// Execute script
revertNoneToNull()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
