import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

// Fields that contain Postgres Array strings "{...}" that need conversion to JSON arrays ["..."]
const JSON_ARRAY_FIELDS = [
  'symptoms',
  'complications',
  'riskFactors',
  'diagnostics',
  'treatment',
  'clinical_pearls',
  'relatedSystems',
  'buzzwords'
] as const;

// Fields that are simple strings needing newline cleanup
const STRING_FIELDS = [
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
  'guidelines'
] as const;

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
    // This regex matches: "quoted string" OR unquoted_string
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

  return null; // Not a recognized array format
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
  // e.g., """### Header""" -> "### Header"
  if (cleaned.startsWith('""') && cleaned.endsWith('""')) {
    cleaned = cleaned.slice(2, -2);
  }

  return cleaned;
}

/**
 * Process a single record and return normalized data
 */
function normalizeRecord(record: any): { data: any; needsUpdate: boolean; fixes: string[] } {
  const data: any = {};
  let needsUpdate = false;
  const fixes: string[] = [];

  // 1. Process JSON Array Fields (Postgres -> JSON)
  for (const field of JSON_ARRAY_FIELDS) {
    const original = (record as any)[field];
    if (!original) continue;

    // Try to parse if it looks like a string but should be an object/array
    let cleaned = original;
    if (typeof original === 'string') {
      const parsed = parsePostgresArray(original);
      if (parsed) {
        // Convert to JSON string for storage (schema expects String, not Array)
        cleaned = JSON.stringify(parsed);
        fixes.push(`Converted Postgres array to JSON in ${field}`);
      }
    }

    // Compare (original vs cleaned strings)
    if (cleaned !== original) {
      data[field] = cleaned;
      needsUpdate = true;
    }
  }

  // 2. Process String Fields (Newline cleanup)
  for (const field of STRING_FIELDS) {
    const original = (record as any)[field];
    if (!original) continue;

    const cleaned = cleanText(original);
    
    if (cleaned !== original) {
      data[field] = cleaned;
      fixes.push(`Cleaned text formatting in ${field}`);
      needsUpdate = true;
    }
  }

  return { data, needsUpdate, fixes };
}

/**
 * Main normalization function with batching
 */
async function normalizeFormatting() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Database Normalization: Fix CSV Import Issues          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log('🔍 Fixing:');
  console.log('   • Postgres arrays {""A"", ""B""} → JSON arrays ["A", "B"]');
  console.log('   • Literal \\n → actual newlines');
  console.log('   • CSV quote artifacts ("""text""" → "text")');
  console.log('');

  const startTime = Date.now();
  let totalProcessed = 0;
  let totalUpdated = 0;
  let arraysFix = 0;
  let textFix = 0;
  let errors = 0;

  try {
    let hasMore = true;
    let cursor: string | undefined;
    let batchNumber = 1;

    while (hasMore) {
      console.log(`\n🔄 Processing batch ${batchNumber}...`);

      const batch = await prisma.medicalContent.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
      });

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      const updates = [];

      for (const record of batch) {
        const { data, needsUpdate, fixes } = normalizeRecord(record);

        if (needsUpdate) {
          updates.push(
            prisma.medicalContent.update({
              where: { id: record.id },
              data: {
                ...data,
                updatedAt: new Date(),
              },
            })
          );
          
          totalUpdated++;
          
          // Count fix types
          if (fixes.some(f => f.includes('Postgres array'))) arraysFix++;
          if (fixes.some(f => f.includes('text'))) textFix++;
          
          console.log(`   ✅ ${record.conditionId}: ${fixes.join(', ')}`);
        }

        cursor = record.id;
      }

      // Execute batch updates in transaction
      if (updates.length > 0) {
        try {
          await prisma.$transaction(updates);
          console.log(`   💾 Committed ${updates.length} updates to database`);
        } catch (error) {
          console.error(`   ❌ Transaction failed for batch ${batchNumber}:`, error);
          errors += updates.length;
        }
      }

      totalProcessed += batch.length;
      batchNumber++;
    }

    // Print summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   NORMALIZATION SUMMARY                                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('┌────────────────────────────────┬──────────────────────┐');
    console.log('│ Metric                         │ Count                │');
    console.log('├────────────────────────────────┼──────────────────────┤');
    console.log(`│ Total records scanned          │ ${totalProcessed.toString().padStart(20)} │`);
    console.log(`│ Records updated                │ ${totalUpdated.toString().padStart(20)} │`);
    console.log(`│ Postgres arrays fixed          │ ${arraysFix.toString().padStart(20)} │`);
    console.log(`│ Text formatting cleaned        │ ${textFix.toString().padStart(20)} │`);
    console.log(`│ Errors encountered             │ ${errors.toString().padStart(20)} │`);
    console.log('└────────────────────────────────┴──────────────────────┘');

    console.log(`\n⏱️  Completed in ${elapsed}s\n`);

    if (totalUpdated === 0) {
      console.log('✨ Database already normalized! No changes needed.\n');
    } else {
      console.log(`🎉 Successfully normalized ${totalUpdated} records!\n`);
      console.log('📋 Changes applied:');
      console.log(`   • Converted ${arraysFix} Postgres arrays to JSON format`);
      console.log(`   • Cleaned text formatting in ${textFix} fields`);
      console.log('');
      console.log('✅ Your frontend can now safely JSON.parse() these fields!\n');
    }

    if (errors > 0) {
      console.warn(`⚠️  ${errors} errors encountered. Check logs above for details.\n`);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
normalizeFormatting()
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
