#!/usr/bin/env tsx
/**
 * UNIFIED FORMATTING VERIFICATION
 * Verifies that MedicalContent and Drug tables have proper formatting
 *
 * Usage:
 *   npx tsx scripts/db/verify-formatting-unified.ts [options]
 *   --sample=N    Check N random records from each table (default: 10)
 *   --all         Check all records (slow)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMedicalContent(sampleSize: number, checkAll: boolean) {
  console.log('\n📋 Verifying MedicalContent table...\n');

  const total = await prisma.medicalContent.count();
  const samples = checkAll
    ? await prisma.medicalContent.findMany({
        select: {
          conditionId: true,
          relatedSystems: true,
          buzzwords: true,
          classic_triad: true,
          clinical_pearls: true,
          synonyms: true,
          differentials: true,
          age_demographic: true,
        },
      })
    : await prisma.medicalContent.findMany({
        take: sampleSize,
        select: {
          conditionId: true,
          relatedSystems: true,
          buzzwords: true,
          classic_triad: true,
          clinical_pearls: true,
          synonyms: true,
          differentials: true,
          age_demographic: true,
        },
      });

  let successes = 0;
  let failures = 0;
  const errorExamples: string[] = [];

  for (const record of samples) {
    for (const [field, value] of Object.entries(record)) {
      if (field === 'conditionId' || !value) continue;

      // Check if value is expected type based on schema
      // relatedSystems, buzzwords = String[]
      // classic_triad, clinical_pearls, synonyms, differentials, age_demographic = Json

      if (field === 'relatedSystems' || field === 'buzzwords') {
        // Should be actual JS arrays
        if (Array.isArray(value)) {
          successes++;
        } else if (typeof value === 'string') {
          // Try parsing if it's JSON
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              successes++; // Valid but could be optimized
            } else {
              failures++;
              errorExamples.push(`${record.conditionId}.${field}: Expected array, got non-array`);
            }
          } catch {
            failures++;
            const preview = value.substring(0, 50);
            errorExamples.push(`${record.conditionId}.${field}: Not parseable - "${preview}..."`);
          }
        } else {
          failures++;
          errorExamples.push(`${record.conditionId}.${field}: Wrong type ${typeof value}`);
        }
      } else {
        // Json fields - can be arrays or objects
        if (Array.isArray(value) || typeof value === 'object') {
          successes++;
        } else if (typeof value === 'string') {
          try {
            JSON.parse(value);
            successes++; // Valid JSON string
          } catch {
            failures++;
            const preview = value.substring(0, 50);
            errorExamples.push(`${record.conditionId}.${field}: Invalid JSON - "${preview}..."`);
          }
        } else {
          failures++;
          errorExamples.push(`${record.conditionId}.${field}: Unexpected type ${typeof value}`);
        }
      }
    }
  }

  console.log(`   Checked: ${samples.length} of ${total} records`);
  console.log(`   ✅ Valid fields: ${successes}`);
  console.log(`   ❌ Invalid fields: ${failures}`);

  if (errorExamples.length > 0) {
    console.log('\n   Error examples:');
    errorExamples.slice(0, 5).forEach((e) => console.log(`      • ${e}`));
    if (errorExamples.length > 5) {
      console.log(`      ... and ${errorExamples.length - 5} more`);
    }
  }

  return { successes, failures, total: samples.length };
}

async function verifyDrugs(sampleSize: number, checkAll: boolean) {
  console.log('\n💊 Verifying Drug table...\n');

  const total = await prisma.drug.count();
  const samples = checkAll
    ? await prisma.drug.findMany({
        select: {
          genericName: true,
          drugClass: true,
          indications: true,
          contraindications: true,
          sideEffects: true,
          interactions: true,
          aliases: true,
          tags: true,
          boardYieldFacts: true,
          blackBoxWarnings: true,
          monitoringParams: true,
          clinicalPearls: true,
        },
      })
    : await prisma.drug.findMany({
        take: sampleSize,
        select: {
          genericName: true,
          drugClass: true,
          indications: true,
          contraindications: true,
          sideEffects: true,
          interactions: true,
          aliases: true,
          tags: true,
          boardYieldFacts: true,
          blackBoxWarnings: true,
          monitoringParams: true,
          clinicalPearls: true,
        },
      });

  let successes = 0;
  let failures = 0;
  const errorExamples: string[] = [];

  for (const record of samples) {
    for (const [field, value] of Object.entries(record)) {
      if (field === 'genericName' || !value) continue;

      // Drug arrays should be actual JS arrays, not JSON strings
      if (Array.isArray(value)) {
        successes++;
      } else if (typeof value === 'string') {
        // Check if it's a stringified array (shouldn't be)
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            failures++;
            errorExamples.push(`${record.genericName}.${field}: Array stored as JSON string`);
          } else {
            failures++;
            errorExamples.push(`${record.genericName}.${field}: Expected array, got string`);
          }
        } catch {
          failures++;
          errorExamples.push(`${record.genericName}.${field}: Expected array, got string`);
        }
      } else {
        failures++;
        errorExamples.push(`${record.genericName}.${field}: Unexpected type`);
      }
    }
  }

  console.log(`   Checked: ${samples.length} of ${total} records`);
  console.log(`   ✅ Valid fields: ${successes}`);
  console.log(`   ❌ Invalid fields: ${failures}`);

  if (errorExamples.length > 0) {
    console.log('\n   Error examples:');
    errorExamples.slice(0, 5).forEach((e) => console.log(`      • ${e}`));
    if (errorExamples.length > 5) {
      console.log(`      ... and ${errorExamples.length - 5} more`);
    }
  }

  return { successes, failures, total: samples.length };
}

async function main() {
  const args = process.argv.slice(2);
  const checkAll = args.includes('--all');
  const sampleArg = args.find((a) => a.startsWith('--sample='));
  const sampleSize = sampleArg ? parseInt(sampleArg.split('=')[1]) : 10;

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   UNIFIED FORMATTING VERIFICATION                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n   Mode: ${checkAll ? 'Check ALL records' : `Sample ${sampleSize} records`}\n`);

  try {
    const mcResults = await verifyMedicalContent(sampleSize, checkAll);
    const drugResults = await verifyDrugs(sampleSize, checkAll);

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   VERIFICATION SUMMARY                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📋 MedicalContent:');
    console.log(`   • Checked: ${mcResults.total} records`);
    console.log(`   • Valid:   ${mcResults.successes} fields`);
    console.log(`   • Invalid: ${mcResults.failures} fields\n`);

    console.log('💊 Drug:');
    console.log(`   • Checked: ${drugResults.total} records`);
    console.log(`   • Valid:   ${drugResults.successes} fields`);
    console.log(`   • Invalid: ${drugResults.failures} fields\n`);

    const totalFailures = mcResults.failures + drugResults.failures;

    if (totalFailures === 0) {
      console.log('🎉 All data properly formatted!\n');
    } else {
      console.log(`⚠️  ${totalFailures} fields need formatting fixes`);
      console.log('   Run: npx tsx scripts/db/normalize-formatting-unified.ts\n');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
