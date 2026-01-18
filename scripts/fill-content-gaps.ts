/**
 * Fill Content Gaps Script
 *
 * Fills all null/empty MedicalContent fields with appropriate placeholders
 * so that all fields are at 100% coverage.
 *
 * Usage:
 *   npx tsx scripts/fill-content-gaps.ts
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

// Placeholder text for fields that have no pertinent information
const PLACEHOLDER = 'Information not yet available for this condition.';

// Fields to fill and their placeholder values
const FIELDS_TO_FILL = {
  // String fields
  pathophysiology: PLACEHOLDER,
  epidemiology: PLACEHOLDER,
  etiology: PLACEHOLDER,
  physicalExam: PLACEHOLDER,
  complications: PLACEHOLDER,
  prognosis: PLACEHOLDER,
  differentialDiagnosis: PLACEHOLDER,
  classic_patient: PLACEHOLDER,
  gold_standard_dx: PLACEHOLDER,
  first_line_rx: PLACEHOLDER,
  riskFactors: PLACEHOLDER,
  overview: PLACEHOLDER,
  symptoms: PLACEHOLDER,
  diagnostics: PLACEHOLDER,
  treatment: PLACEHOLDER,
};

async function fillContentGaps() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║     Fill Content Gaps Script         ║');
  console.log('╚══════════════════════════════════════╝\n');

  const total = await prisma.medicalContent.count();
  console.log(`Total MedicalContent records: ${total}\n`);

  let totalUpdated = 0;

  for (const [field, placeholder] of Object.entries(FIELDS_TO_FILL)) {
    console.log(`\n📝 Processing field: ${field}`);

    try {
      // Count null values
      const nullCount = await prisma.medicalContent.count({
        where: { [field]: null },
      });

      // Count empty strings
      let emptyCount = 0;
      try {
        emptyCount = await prisma.medicalContent.count({
          where: { [field]: '' },
        });
      } catch {
        // Field might not support empty string check
      }

      const totalMissing = nullCount + emptyCount;

      if (totalMissing === 0) {
        console.log(`   ✓ Already complete (${total}/${total})`);
        continue;
      }

      console.log(
        `   Found ${totalMissing} missing values (${nullCount} null, ${emptyCount} empty)`
      );

      // Update null values
      if (nullCount > 0) {
        const result = await prisma.medicalContent.updateMany({
          where: { [field]: null },
          data: { [field]: placeholder },
        });
        console.log(`   → Updated ${result.count} null values`);
        totalUpdated += result.count;
      }

      // Update empty string values
      if (emptyCount > 0) {
        const result = await prisma.medicalContent.updateMany({
          where: { [field]: '' },
          data: { [field]: placeholder },
        });
        console.log(`   → Updated ${result.count} empty values`);
        totalUpdated += result.count;
      }

      // Verify
      const remainingNull = await prisma.medicalContent.count({
        where: { [field]: null },
      });
      let remainingEmpty = 0;
      try {
        remainingEmpty = await prisma.medicalContent.count({
          where: { [field]: '' },
        });
      } catch {
        // ignore
      }

      if (remainingNull === 0 && remainingEmpty === 0) {
        console.log(`   ✓ Field now at 100% coverage`);
      } else {
        console.log(`   ⚠ Still ${remainingNull + remainingEmpty} missing after update`);
      }
    } catch (e) {
      console.log(`   ⚠ Error processing field: ${(e as Error).message}`);
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`Total field values updated: ${totalUpdated}`);
  console.log('─────────────────────────────────────\n');

  console.log('✓ Content gap filling complete!');
}

async function main() {
  try {
    await fillContentGaps();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await disconnectPrisma();
  }
}

main();
