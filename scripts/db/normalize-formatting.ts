/**
 * Database Normalization Script: Fix Formatting Issues
 * 
 * PURPOSE:
 * Comprehensively fixes data formatting issues in the MedicalContent table:
 * 1. Converts Postgres array syntax to proper JSON arrays
 * 2. Fixes escaped newlines (\\n → \n)
 * 3. Normalizes sentinel values ("NONE", "N/A", etc.)
 * 
 * USAGE:
 * npx ts-node scripts/db/normalize-formatting.ts
 * 
 * BATCH SIZE:
 * Processes records in batches to avoid memory issues with large datasets.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 100; // Process 100 records at a time

interface NormalizationStats {
  totalProcessed: number;
  totalUpdated: number;
  postgresArraysFix: number;
  newlinesFix: number;
  sentinelsFix: number;
  errors: number;
}

/**
 * Fix Postgres array syntax and convert to proper JSON
 * Example: `{""Item 1"", ""Item 2""}` → `["Item 1", "Item 2"]`
 */
function fixPostgresArray(value: any): any {
  // If already a proper array/object, return as-is
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return value;
  }

  // If not a string, return as-is
  if (typeof value !== 'string') {
    return value;
  }

  // Check if it looks like Postgres array syntax
  if (value.startsWith('{') && value.endsWith('}')) {
    try {
      // Remove outer braces and replace with brackets
      let jsonString = value.slice(1, -1);
      
      // Handle empty arrays
      if (jsonString.trim() === '') {
        return [];
      }

      // Split by commas (but not commas inside quoted strings)
      // This regex splits on commas not inside quotes
      const items = jsonString.match(/(?:[^,"]+|"[^"]*")+/g) || [];
      
      // Clean up each item
      const cleanedItems = items.map(item => {
        item = item.trim();
        // Remove surrounding quotes if present
        if (item.startsWith('"') && item.endsWith('"')) {
          item = item.slice(1, -1);
        }
        // Unescape internal quotes
        item = item.replace(/""/g, '"');
        return item;
      }).filter(item => item.length > 0);

      return cleanedItems;
    } catch (error) {
      console.warn(`Failed to parse Postgres array: ${value}`, error);
      return value; // Return original on error
    }
  }

  return value;
}

/**
 * Normalize text by fixing escaped newlines and carriage returns
 */
function normalizeText(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') {
    return text || null;
  }

  let normalized = text;

  // Replace literal \\n with actual newlines
  normalized = normalized.replace(/\\n/g, '\n');
  
  // Replace \r\n with \n
  normalized = normalized.replace(/\r\n/g, '\n');
  
  // Remove multiple consecutive newlines (keep max 2)
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  normalized = normalized.trim();

  return normalized;
}

/**
 * Normalize sentinel values to consistent "NONE" or null
 */
function normalizeSentinel(value: any, recordHasContent: boolean): string | null {
  // If value is already null or undefined, keep it null
  if (value === null || value === undefined) {
    return null;
  }

  // Convert to string for comparison
  const strValue = String(value).trim().toLowerCase();

  // List of sentinel values to normalize
  const sentinelValues = ['none', 'n/a', 'na', 'not applicable', ''];

  if (sentinelValues.includes(strValue)) {
    // If record has other content, use "NONE" sentinel
    // Otherwise use null to allow regeneration
    return recordHasContent ? "NONE" : null;
  }

  // If it's a meaningful value, return original (but trimmed if string)
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Check if a record has meaningful content (not empty)
 */
function recordHasContent(record: any): boolean {
  // Check if any of these key fields have content
  const keyFields = [
    'overview',
    'etiology',
    'pathophysiology',
    'symptoms',
    'treatment',
    'clinical_pearls',
  ];

  return keyFields.some(field => {
    const value = record[field];
    if (!value) return false;
    if (typeof value === 'string' && value.trim().length > 0) return true;
    if (Array.isArray(value) && value.length > 0) return true;
    if (typeof value === 'object' && Object.keys(value).length > 0) return true;
    return false;
  });
}

/**
 * Normalize a single record
 */
function normalizeRecord(record: any): { normalized: any; changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;
  const hasContent = recordHasContent(record);

  // Create normalized copy
  const normalized = { ...record };

  // Fields to check for Postgres array syntax
  const arrayFields = ['symptoms', 'complications', 'riskFactors', 'buzzwords', 'relatedSystems'];
  
  arrayFields.forEach(field => {
    if (record[field]) {
      const fixed = fixPostgresArray(record[field]);
      if (JSON.stringify(fixed) !== JSON.stringify(record[field])) {
        normalized[field] = fixed;
        fixes.push(`Fixed Postgres array in ${field}`);
        changed = true;
      }
    }
  });

  // Fields to normalize text (remove escaped newlines)
  const textFields = ['overview', 'etiology', 'pathophysiology', 'symptoms', 'physicalExam',
                      'diagnostics', 'treatment', 'prognosis', 'differentialDiagnosis'];
  
  textFields.forEach(field => {
    if (record[field] && typeof record[field] === 'string') {
      const fixed = normalizeText(record[field]);
      if (fixed !== record[field]) {
        normalized[field] = fixed;
        fixes.push(`Normalized text in ${field}`);
        changed = true;
      }
    }
  });

  // Handle clinical_pearls (might be array of strings)
  if (record.clinical_pearls) {
    if (Array.isArray(record.clinical_pearls)) {
      const fixedPearls = record.clinical_pearls.map((pearl: any) => {
        if (typeof pearl === 'string') {
          return normalizeText(pearl);
        }
        return pearl;
      });
      if (JSON.stringify(fixedPearls) !== JSON.stringify(record.clinical_pearls)) {
        normalized.clinical_pearls = fixedPearls;
        fixes.push('Normalized text in clinical_pearls array');
        changed = true;
      }
    } else if (typeof record.clinical_pearls === 'string') {
      const fixed = normalizeText(record.clinical_pearls);
      if (fixed !== record.clinical_pearls) {
        normalized.clinical_pearls = fixed;
        fixes.push('Normalized text in clinical_pearls');
        changed = true;
      }
    }
  }

  // Normalize sentinel fields
  const sentinelFields = ['classic_triad', 'mnemonic', 'guidelines'];
  
  sentinelFields.forEach(field => {
    if (record[field] !== undefined) {
      const fixed = normalizeSentinel(record[field], hasContent);
      const originalIsNull = record[field] === null || record[field] === Prisma.DbNull;
      const fixedIsNull = fixed === null;
      
      // Only mark as changed if the semantic value changed
      if (originalIsNull !== fixedIsNull || (!originalIsNull && fixed !== record[field])) {
        normalized[field] = fixed === null ? Prisma.DbNull : fixed;
        fixes.push(`Normalized sentinel in ${field}`);
        changed = true;
      }
    }
  });

  return { normalized, changed, fixes };
}

/**
 * Main normalization function with batching
 */
async function normalizeFormatting() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Database Normalization: Fix Formatting Issues          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const stats: NormalizationStats = {
    totalProcessed: 0,
    totalUpdated: 0,
    postgresArraysFix: 0,
    newlinesFix: 0,
    sentinelsFix: 0,
    errors: 0,
  };

  try {
    // Get total count
    const totalRecords = await prisma.medicalContent.count();
    console.log(`📊 Total records to process: ${totalRecords}`);
    console.log(`📦 Batch size: ${BATCH_SIZE}\n`);

    let offset = 0;
    let batchNumber = 1;

    while (offset < totalRecords) {
      console.log(`\n🔄 Processing batch ${batchNumber} (${offset + 1}-${Math.min(offset + BATCH_SIZE, totalRecords)} of ${totalRecords})...`);

      // Fetch batch
      const records = await prisma.medicalContent.findMany({
        take: BATCH_SIZE,
        skip: offset,
      });

      // Process each record in batch
      for (const record of records) {
        stats.totalProcessed++;

        try {
          const { normalized, changed, fixes } = normalizeRecord(record);

          if (changed) {
            // Remove id and conditionId from normalized data to avoid validation error
            const { id, conditionId, ...updateData } = normalized as any;
            
            // Update the record
            await prisma.medicalContent.update({
              where: { id: record.id },
              data: {
                ...updateData,
                updatedAt: new Date(),
              },
            });

            stats.totalUpdated++;

            // Count specific fix types
            if (fixes.some(f => f.includes('Postgres array'))) stats.postgresArraysFix++;
            if (fixes.some(f => f.includes('text'))) stats.newlinesFix++;
            if (fixes.some(f => f.includes('sentinel'))) stats.sentinelsFix++;

            console.log(`   ✅ Updated ${record.conditionId}: ${fixes.join(', ')}`);
          }
        } catch (error) {
          stats.errors++;
          console.error(`   ❌ Error processing ${record.conditionId}:`, error);
        }
      }

      offset += BATCH_SIZE;
      batchNumber++;

      // Progress indicator
      const progress = Math.min(100, (offset / totalRecords) * 100).toFixed(1);
      console.log(`   Progress: ${progress}%`);
    }

    // Summary report
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║   NORMALIZATION SUMMARY                                   ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('┌────────────────────────────────┬──────────────────────┐');
    console.log('│ Metric                         │ Count                │');
    console.log('├────────────────────────────────┼──────────────────────┤');
    console.log(`│ Total records processed        │ ${String(stats.totalProcessed).padStart(20)} │`);
    console.log(`│ Records updated                │ ${String(stats.totalUpdated).padStart(20)} │`);
    console.log(`│ Postgres arrays fixed          │ ${String(stats.postgresArraysFix).padStart(20)} │`);
    console.log(`│ Text/newlines normalized       │ ${String(stats.newlinesFix).padStart(20)} │`);
    console.log(`│ Sentinels normalized           │ ${String(stats.sentinelsFix).padStart(20)} │`);
    console.log(`│ Errors encountered             │ ${String(stats.errors).padStart(20)} │`);
    console.log('└────────────────────────────────┴──────────────────────┘');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Completed in ${duration}s`);

    if (stats.totalUpdated > 0) {
      console.log(`\n✅ Successfully normalized ${stats.totalUpdated} records`);
      console.log('   Database formatting is now consistent and clean.');
    } else {
      console.log('\n✨ Database already normalized! No changes needed.');
    }

    if (stats.errors > 0) {
      console.log(`\n⚠️  ${stats.errors} errors encountered. Check logs above for details.`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error during normalization:', error);
    throw error;
  }
}

// Execute script
normalizeFormatting()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
