#!/usr/bin/env tsx
/**
 * UNIFIED DATABASE NORMALIZATION
 * Fixes CSV/import formatting issues across MedicalContent and Drug tables
 * 
 * Fixes:
 * • Postgres arrays {""A"", ""B""} → JSON arrays ["A", "B"]
 * • Literal \n → actual newlines
 * • CSV quote artifacts ("""text""" → "text")
 * • Whitespace trimming
 * 
 * Usage:
 *   npx tsx scripts/db/normalize-formatting-unified.ts [options]
 *   --medical-content    Process MedicalContent only
 *   --drugs              Process Drug only
 *   --dry-run            Preview changes without applying
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

// ==================== MedicalContent Field Definitions ====================

const MC_JSON_ARRAY_FIELDS = [
  'symptoms',
  'complications',
  'riskFactors',
  'diagnostics',
  'treatment',
  'clinical_pearls',
  'relatedSystems',
  'buzzwords'
] as const;

const MC_STRING_FIELDS = [
  'vignette',
  'best_initial_test',
  'gold_standard_dx',
  'classic_patient',
  'overview',
  'pathophysiology',
  'epidemiology',
  'etiology',
  'prognosis',
  'physicalExam',
  'patient_education',
  'prevention',
  'rx_mechanism',
  'rx_side_effects',
  'disposition',
  'mnemonic',
  'guidelines',
  'first_line_rx'
] as const;

// ==================== Drug Field Definitions ====================

const DRUG_JSON_ARRAY_FIELDS = [
  'drugClass',
  'indications',
  'contraindications',
  'sideEffects',
  'interactions',
  'aliases',
  'tags',
  'boardYieldFacts',
  'blackBoxWarnings',
  'riskStrategies',
  'monitoringParams',
  'clinicalPearls',
  'commonMistakes',
  'mnemonics',
  'testQuestionTips',
  'foodInteractions',
  'routesOfAdmin',
  'formulations'
] as const;

const DRUG_STRING_FIELDS = [
  'mechanismOfAction',
  'dosing',
  'clinicalNotes',
  'antidote',
  'metabolism',
  'elimination',
  'mechanismDetailed',
  'absorption',
  'distribution',
  'metabolismDetail',
  'eliminationRoute',
  'halfLife',
  'onsetOfAction',
  'peakEffect',
  'duration',
  'bioavailability',
  'pregnancyCategory',
  'pregnancyNotes',
  'lactationSafety',
  'lactationNotes',
  'pediatricDosing',
  'pediatricNotes',
  'geriatricDosing',
  'geriatricNotes',
  'renalDosing',
  'hepaticDosing',
  'reversalAgent',
  'toxicity',
  'maxDailyDose',
  'administrationTips',
  'storageRequirements',
  'typicalCost'
] as const;

// ==================== Parsing Functions ====================

/**
 * Converts a Postgres Array String "{ 'A', 'B' }" into a JavaScript Array ["A", "B"]
 * Also handles JSON arrays that are already correctly formatted
 */
function parsePostgresArray(raw: any): any[] | null {
  if (typeof raw !== 'string') return raw;

  const trimmed = raw.trim();
  
  // If it's already a JSON array string, parse it
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  // If it is a Postgres Array "{ ... }"
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // Remove braces
    const content = trimmed.substring(1, trimmed.length - 1);
    if (!content) return [];

    // Split by comma, but respect quoted strings
    const matches = content.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    
    if (!matches) return [];

    return matches.map(m => {
      // Remove wrapping double quotes if present and unescape inner quotes
      if (m.startsWith('"') && m.endsWith('"')) {
        return m.slice(1, -1).replace(/""/g, '"');
      }
      return m;
    });
  }

  return null;
}

/**
 * Cleans text formatting: fixes newlines, trims whitespace
 */
function cleanText(text: any): string | null {
  if (typeof text !== 'string') return text;
  if (!text) return null;

  let cleaned = text
    .replace(/\\n/g, '\n')     // Fix literal escaped newlines
    .replace(/\r\n/g, '\n')    // Fix Windows line endings
    .trim();

  // Fix common CSV import artifact: Double quotes around headers
  if (cleaned.startsWith('""') && cleaned.endsWith('""')) {
    cleaned = cleaned.slice(2, -2);
  }

  return cleaned;
}

// ==================== Record Normalization ====================

/**
 * Process a single MedicalContent record
 */
function normalizeMedicalContent(record: any): { data: any; needsUpdate: boolean; fixes: string[] } {
  const data: any = {};
  let needsUpdate = false;
  const fixes: string[] = [];

  // Process JSON Array Fields
  for (const field of MC_JSON_ARRAY_FIELDS) {
    const original = record[field];
    if (!original) continue;

    let cleaned = original;
    if (typeof original === 'string') {
      const parsed = parsePostgresArray(original);
      if (parsed) {
        cleaned = JSON.stringify(parsed);
        fixes.push(`Array: ${field}`);
      }
    }

    if (cleaned !== original) {
      data[field] = cleaned;
      needsUpdate = true;
    }
  }

  // Process String Fields
  for (const field of MC_STRING_FIELDS) {
    const original = record[field];
    if (!original) continue;

    const cleaned = cleanText(original);
    
    if (cleaned !== original) {
      data[field] = cleaned;
      fixes.push(`Text: ${field}`);
      needsUpdate = true;
    }
  }

  return { data, needsUpdate, fixes };
}

/**
 * Process a single Drug record
 */
function normalizeDrug(record: any): { data: any; needsUpdate: boolean; fixes: string[] } {
  const data: any = {};
  let needsUpdate = false;
  const fixes: string[] = [];

  // Process JSON Array Fields
  for (const field of DRUG_JSON_ARRAY_FIELDS) {
    const original = record[field];
    if (!original) continue;

    let cleaned = original;
    if (typeof original === 'string') {
      const parsed = parsePostgresArray(original);
      if (parsed) {
        cleaned = parsed; // Drug schema expects actual arrays, not JSON strings
        fixes.push(`Array: ${field}`);
      }
    }

    if (JSON.stringify(cleaned) !== JSON.stringify(original)) {
      data[field] = cleaned;
      needsUpdate = true;
    }
  }

  // Process String Fields
  for (const field of DRUG_STRING_FIELDS) {
    const original = record[field];
    if (!original) continue;

    const cleaned = cleanText(original);
    
    if (cleaned !== original) {
      data[field] = cleaned;
      fixes.push(`Text: ${field}`);
      needsUpdate = true;
    }
  }

  return { data, needsUpdate, fixes };
}

// ==================== Table Processing ====================

async function processMedicalContent(dryRun: boolean) {
  console.log('\n📋 Processing MedicalContent table...\n');

  let totalProcessed = 0;
  let totalUpdated = 0;
  let arraysFix = 0;
  let textFix = 0;
  let errors = 0;

  let hasMore = true;
  let cursor: string | undefined;
  let batchNumber = 1;

  while (hasMore) {
    const batch = await prisma.medicalContent.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    const updates = [];

    for (const record of batch) {
      const { data, needsUpdate, fixes } = normalizeMedicalContent(record);

      if (needsUpdate) {
        if (!dryRun) {
          updates.push(
            prisma.medicalContent.update({
              where: { id: record.id },
              data: { ...data, updatedAt: new Date() },
            })
          );
        }
        
        totalUpdated++;
        if (fixes.some(f => f.includes('Array'))) arraysFix++;
        if (fixes.some(f => f.includes('Text'))) textFix++;
        
        const icon = dryRun ? '🔍' : '✅';
        console.log(`   ${icon} ${record.conditionId}: ${fixes.join(', ')}`);
      }

      cursor = record.id;
    }

    if (!dryRun && updates.length > 0) {
      try {
        await prisma.$transaction(updates);
      } catch (error) {
        console.error(`   ❌ Batch ${batchNumber} failed:`, error);
        errors += updates.length;
      }
    }

    totalProcessed += batch.length;
    batchNumber++;
  }

  return { totalProcessed, totalUpdated, arraysFix, textFix, errors };
}

async function processDrugs(dryRun: boolean) {
  console.log('\n💊 Processing Drug table...\n');

  let totalProcessed = 0;
  let totalUpdated = 0;
  let arraysFix = 0;
  let textFix = 0;
  let errors = 0;

  let hasMore = true;
  let cursor: string | undefined;
  let batchNumber = 1;

  while (hasMore) {
    const batch = await prisma.drug.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    const updates = [];

    for (const record of batch) {
      const { data, needsUpdate, fixes } = normalizeDrug(record);

      if (needsUpdate) {
        if (!dryRun) {
          updates.push(
            prisma.drug.update({
              where: { id: record.id },
              data: { ...data, updatedAt: new Date() },
            })
          );
        }
        
        totalUpdated++;
        if (fixes.some(f => f.includes('Array'))) arraysFix++;
        if (fixes.some(f => f.includes('Text'))) textFix++;
        
        const icon = dryRun ? '🔍' : '✅';
        console.log(`   ${icon} ${record.genericName}: ${fixes.join(', ')}`);
      }

      cursor = record.id;
    }

    if (!dryRun && updates.length > 0) {
      try {
        await prisma.$transaction(updates);
      } catch (error) {
        console.error(`   ❌ Batch ${batchNumber} failed:`, error);
        errors += updates.length;
      }
    }

    totalProcessed += batch.length;
    batchNumber++;
  }

  return { totalProcessed, totalUpdated, arraysFix, textFix, errors };
}

// ==================== Main ====================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const medicalContentOnly = args.includes('--medical-content');
  const drugsOnly = args.includes('--drugs');

  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   UNIFIED DATABASE NORMALIZATION                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\n   Mode: ${dryRun ? '🔍 DRY RUN (preview only)' : '💾 LIVE'}`);
  console.log(`   Tables: ${medicalContentOnly ? 'MedicalContent' : drugsOnly ? 'Drug' : 'Both'}\n`);

  const startTime = Date.now();
  const results = {
    medicalContent: { totalProcessed: 0, totalUpdated: 0, arraysFix: 0, textFix: 0, errors: 0 },
    drugs: { totalProcessed: 0, totalUpdated: 0, arraysFix: 0, textFix: 0, errors: 0 }
  };

  try {
    if (!drugsOnly) {
      results.medicalContent = await processMedicalContent(dryRun);
    }

    if (!medicalContentOnly) {
      results.drugs = await processDrugs(dryRun);
    }

    // Print summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   NORMALIZATION SUMMARY                                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    if (!drugsOnly) {
      console.log('📋 MedicalContent:');
      console.log(`   • Records scanned:    ${results.medicalContent.totalProcessed}`);
      console.log(`   • Records updated:    ${results.medicalContent.totalUpdated}`);
      console.log(`   • Arrays fixed:       ${results.medicalContent.arraysFix}`);
      console.log(`   • Text cleaned:       ${results.medicalContent.textFix}`);
      console.log(`   • Errors:             ${results.medicalContent.errors}\n`);
    }

    if (!medicalContentOnly) {
      console.log('💊 Drug:');
      console.log(`   • Records scanned:    ${results.drugs.totalProcessed}`);
      console.log(`   • Records updated:    ${results.drugs.totalUpdated}`);
      console.log(`   • Arrays fixed:       ${results.drugs.arraysFix}`);
      console.log(`   • Text cleaned:       ${results.drugs.textFix}`);
      console.log(`   • Errors:             ${results.drugs.errors}\n`);
    }

    console.log(`⏱️  Completed in ${elapsed}s\n`);

    const totalUpdated = results.medicalContent.totalUpdated + results.drugs.totalUpdated;
    const totalErrors = results.medicalContent.errors + results.drugs.errors;

    if (dryRun) {
      console.log(`🔍 DRY RUN: Would update ${totalUpdated} records`);
      console.log('   Run without --dry-run to apply changes\n');
    } else if (totalUpdated === 0) {
      console.log('✨ Database already normalized! No changes needed.\n');
    } else {
      console.log(`🎉 Successfully normalized ${totalUpdated} records!\n`);
    }

    if (totalErrors > 0) {
      console.warn(`⚠️  ${totalErrors} errors encountered. Check logs above.\n`);
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
