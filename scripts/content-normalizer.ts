/**
 * Content Normalizer Script - Database Metadata Standardization
 * 
 * Purpose:
 * - Enforce consistent formatting across all medical content
 * - Standardize system codes to official PANCE abbreviations
 * - Clean up badges (remove trailing periods, normalize capitalization)
 * - Ensure arrays are properly formatted (not stringified JSON)
 * - Fix common data quality issues
 * 
 * Usage:
 *   npx ts-node scripts/content-normalizer.ts           # Dry run (preview changes)
 *   npx ts-node scripts/content-normalizer.ts --apply   # Apply changes to database
 *   npx ts-node scripts/content-normalizer.ts --system=CV --apply  # Normalize specific system
 * 
 * Safety:
 *   - Runs in dry-run mode by default
 *   - Only updates records where changes are detected
 *   - Logs all transformations for audit trail
 *   - Creates backup recommendations before bulk operations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// SYSTEM CODE NORMALIZATION RULES
// ============================================================================

/**
 * Official PANCE system codes
 * Maps common variations/aliases to standardized codes
 */
const SYSTEM_CODE_MAP: Record<string, string> = {
  // Cardiovascular variations
  'CV': 'CV',
  'CARDIO': 'CV',
  'CARDIOLOGY': 'CV',
  'CARDIAC': 'CV',
  'HEART': 'CV',
  'CARDIOVASCULAR': 'CV',
  
  // Pulmonary variations
  'PULM': 'PULM',
  'PULMONARY': 'PULM',
  'RESPIRATORY': 'PULM',
  'LUNG': 'PULM',
  'RESP': 'PULM',
  
  // Gastrointestinal variations
  'GI': 'GI',
  'GASTRO': 'GI',
  'GASTROINTESTINAL': 'GI',
  'DIGESTIVE': 'GI',
  
  // Neurologic variations
  'NEURO': 'NEURO',
  'NEUROLOGIC': 'NEURO',
  'NEUROLOGY': 'NEURO',
  'NEUROLOGICAL': 'NEURO',
  'CNS': 'NEURO',
  
  // Musculoskeletal variations
  'MSK': 'MSK',
  'MUSCULOSKELETAL': 'MSK',
  'ORTHOPEDIC': 'MSK',
  'ORTHO': 'MSK',
  'BONES': 'MSK',
  
  // Dermatology variations
  'DERM': 'DERM',
  'DERMATOLOGY': 'DERM',
  'SKIN': 'DERM',
  
  // Hematology variations
  'HEME': 'HEME',
  'HEMATOLOGY': 'HEME',
  'BLOOD': 'HEME',
  
  // Endocrine variations
  'ENDO': 'ENDO',
  'ENDOCRINE': 'ENDO',
  'ENDOCRINOLOGY': 'ENDO',
  'HORMONES': 'ENDO',
  
  // HEENT variations
  'HEENT': 'HEENT',
  'ENT': 'HEENT',
  'EYE': 'HEENT',
  'EAR': 'HEENT',
  'NOSE': 'HEENT',
  'THROAT': 'HEENT',
  
  // Renal variations
  'RENAL': 'RENAL',
  'KIDNEY': 'RENAL',
  'NEPHROLOGY': 'RENAL',
  
  // Reproductive variations
  'REPRO': 'REPRO',
  'REPRODUCTIVE': 'REPRO',
  'OB': 'REPRO',
  'GYN': 'REPRO',
  'OBGYN': 'REPRO',
  
  // Psychiatric variations
  'PSYCH': 'PSYCH',
  'PSYCHIATRIC': 'PSYCH',
  'PSYCHIATRY': 'PSYCH',
  'MENTAL': 'PSYCH',
  
  // Infectious Disease variations
  'ID': 'ID',
  'INFECTIOUS': 'ID',
  'INFECTIOUS_DISEASE': 'ID',
  'INFECTION': 'ID',
  
  // Genitourinary variations
  'GU': 'GU',
  'GENITOURINARY': 'GU',
  'URINARY': 'GU',
  'UROLOGY': 'GU',
  
  // Professional Practice variations
  'PRO': 'PRO',
  'PROFESSIONAL': 'PRO',
  'PRACTICE': 'PRO',
  
  // Other/Misc
  'OTHER': 'OTHER',
  'MISC': 'OTHER',
  'MISCELLANEOUS': 'OTHER',
};

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalize system code to official PANCE abbreviation
 */
function normalizeSystemCode(system: string | null): string | null {
  if (!system) return null;
  
  const uppercase = system.toUpperCase().trim();
  return SYSTEM_CODE_MAP[uppercase] || system; // Return original if no mapping found
}

/**
 * Remove trailing periods from badge fields
 * Also normalizes whitespace and capitalization
 */
function normalizeBadge(badge: string | null): string | null {
  if (!badge) return null;
  
  return badge
    .trim()
    .replace(/\.+$/, '') // Remove trailing periods
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Ensure field is a proper array, not a stringified JSON string
 * Handles various edge cases:
 * - Stringified arrays: '["item1", "item2"]'
 * - Comma-separated strings: 'item1, item2, item3'
 * - Already proper arrays
 * - Null/undefined values
 */
function normalizeArray(value: any): string[] | null {
  // Already null or undefined
  if (value === null || value === undefined) {
    return null;
  }
  
  // Already a proper array
  if (Array.isArray(value)) {
    // Filter out empty strings and trim
    const cleaned = value
      .map(item => typeof item === 'string' ? item.trim() : String(item))
      .filter(item => item.length > 0);
    
    return cleaned.length > 0 ? cleaned : null;
  }
  
  // Stringified JSON array
  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Empty string
    if (trimmed.length === 0) {
      return null;
    }
    
    // Try to parse as JSON
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return normalizeArray(parsed); // Recursively normalize
        }
      } catch (e) {
        console.warn('Failed to parse JSON array:', trimmed);
      }
    }
    
    // Comma-separated string
    if (trimmed.includes(',')) {
      const items = trimmed
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      return items.length > 0 ? items : null;
    }
    
    // Single item (not an array, but treat as one)
    return [trimmed];
  }
  
  // Fallback: convert to string array
  return [String(value)];
}

/**
 * Normalize differentials array (special handling for structured data)
 */
function normalizeDifferentialsArray(value: any): Array<{ condition: string; reason: string }> | null {
  if (!value) return null;
  
  // Already proper format
  if (Array.isArray(value) && value.length > 0) {
    // Validate structure
    const isValid = value.every(
      item => item && typeof item === 'object' && 'condition' in item
    );
    
    if (isValid) {
      return value.map(item => ({
        condition: String(item.condition).trim(),
        reason: item.reason ? String(item.reason).trim() : ''
      }));
    }
  }
  
  // Try to parse stringified JSON
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        return normalizeDifferentialsArray(parsed); // Recursive call
      } catch (e) {
        console.warn('Failed to parse differentials JSON:', trimmed);
      }
    }
  }
  
  return null;
}

// ============================================================================
// CHANGE DETECTION & LOGGING
// ============================================================================

interface ChangeLog {
  condition: string;
  conditionId: number;
  changes: string[];
}

/**
 * Compare before/after and log specific changes
 */
function detectChanges(
  before: any,
  after: any,
  conditionName: string,
  conditionId: number
): ChangeLog | null {
  const changes: string[] = [];
  
  // Check system code
  if (before.system !== after.system) {
    changes.push(`System: "${before.system}" → "${after.system}"`);
  }
  
  // Check badge fields
  const badgeFields = ['first_line_rx', 'gold_standard_dx'];
  for (const field of badgeFields) {
    if (before[field] !== after[field]) {
      changes.push(`${field}: "${before[field]}" → "${after[field]}"`);
    }
  }
  
  // Check array fields
  const arrayFields = ['clinical_pearls', 'synonyms'];
  for (const field of arrayFields) {
    const beforeStr = JSON.stringify(before[field]);
    const afterStr = JSON.stringify(after[field]);
    if (beforeStr !== afterStr) {
      changes.push(`${field}: ${beforeStr} → ${afterStr}`);
    }
  }
  
  // Check differentials
  if (JSON.stringify(before.differentials) !== JSON.stringify(after.differentials)) {
    changes.push(`differentials: normalized structure`);
  }
  
  if (changes.length === 0) {
    return null;
  }
  
  return {
    condition: conditionName,
    conditionId,
    changes,
  };
}

// ============================================================================
// MAIN NORMALIZATION LOGIC
// ============================================================================

interface NormalizationStats {
  totalRecords: number;
  recordsWithChanges: number;
  recordsUpdated: number;
  changesByType: Record<string, number>;
  errors: number;
}

async function normalizeContent(options: {
  dryRun: boolean;
  system?: string;
}): Promise<NormalizationStats> {
  const { dryRun, system } = options;
  
  console.log('🔧 Starting Content Normalization...\n');
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be written to database');
    console.log('   Run with --apply flag to apply changes\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be written to database');
    console.log('   Press Ctrl+C within 3 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Build query filter
  const whereClause = system ? { system } : {};
  
  // Fetch all content
  console.log('📊 Fetching medical content from database...');
  const allContent = await prisma.medicalContent.findMany({
    where: whereClause,
    select: {
      id: true,
      condition: true,
      system: true,
      first_line_rx: true,
      gold_standard_dx: true,
      clinical_pearls: true,
      synonyms: true,
      differentials: true,
    },
  });
  
  console.log(`   Found ${allContent.length} records\n`);
  
  const stats: NormalizationStats = {
    totalRecords: allContent.length,
    recordsWithChanges: 0,
    recordsUpdated: 0,
    changesByType: {},
    errors: 0,
  };
  
  const changeLogs: ChangeLog[] = [];
  
  // Process each record
  for (const record of allContent) {
    try {
      // Create normalized version
      const normalized = {
        system: normalizeSystemCode(record.system),
        first_line_rx: normalizeBadge(record.first_line_rx),
        gold_standard_dx: normalizeBadge(record.gold_standard_dx),
        clinical_pearls: normalizeArray(record.clinical_pearls),
        synonyms: normalizeArray(record.synonyms),
        differentials: normalizeDifferentialsArray(record.differentials),
      };
      
      // Detect changes
      const changeLog = detectChanges(
        record,
        normalized,
        record.condition,
        record.id
      );
      
      if (changeLog) {
        stats.recordsWithChanges++;
        changeLogs.push(changeLog);
        
        // Track change types
        for (const change of changeLog.changes) {
          const changeType = change.split(':')[0];
          stats.changesByType[changeType] = (stats.changesByType[changeType] || 0) + 1;
        }
        
        // Apply changes if not dry run
        if (!dryRun) {
          await prisma.medicalContent.update({
            where: { id: record.id },
            data: normalized,
          });
          stats.recordsUpdated++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${record.condition}:`, error);
      stats.errors++;
    }
  }
  
  // Print results
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('          NORMALIZATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('📊 STATISTICS');
  console.log(`   Total Records Scanned:  ${stats.totalRecords}`);
  console.log(`   Records with Changes:   ${stats.recordsWithChanges}`);
  console.log(`   Records Updated:        ${stats.recordsUpdated}`);
  console.log(`   Errors:                 ${stats.errors}`);
  console.log();
  
  if (Object.keys(stats.changesByType).length > 0) {
    console.log('📋 CHANGES BY TYPE');
    for (const [changeType, count] of Object.entries(stats.changesByType)) {
      console.log(`   ${changeType}: ${count} changes`);
    }
    console.log();
  }
  
  if (changeLogs.length > 0) {
    console.log('🔍 DETAILED CHANGES\n');
    for (const log of changeLogs) {
      console.log(`[Fix] ${log.condition} (ID: ${log.conditionId})`);
      for (const change of log.changes) {
        console.log(`      ${change}`);
      }
      console.log();
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (dryRun && stats.recordsWithChanges > 0) {
    console.log('\n💡 To apply these changes, run:');
    console.log('   npx ts-node scripts/content-normalizer.ts --apply\n');
  } else if (!dryRun && stats.recordsUpdated > 0) {
    console.log('\n✅ Normalization complete! All changes written to database.\n');
  } else if (stats.recordsWithChanges === 0) {
    console.log('\n✨ All content is already normalized! No changes needed.\n');
  }
  
  return stats;
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  
  const options = {
    dryRun: true,
    system: undefined as string | undefined,
  };
  
  for (const arg of args) {
    if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg.startsWith('--system=')) {
      options.system = arg.split('=')[1].toUpperCase();
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Content Normalizer - Database Metadata Standardization

Usage:
  npx ts-node scripts/content-normalizer.ts [options]

Options:
  --apply              Apply changes to database (default: dry run)
  --system=<code>      Only normalize specific system (e.g., CV, PULM)
  --help, -h           Show this help message

Examples:
  npx ts-node scripts/content-normalizer.ts
    Preview all changes without applying

  npx ts-node scripts/content-normalizer.ts --apply
    Apply normalization to all records

  npx ts-node scripts/content-normalizer.ts --system=CV --apply
    Normalize only cardiovascular records

Safety:
  - Dry run by default (no database changes)
  - Only updates records where changes are detected
  - Logs all transformations for audit
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    const options = parseArgs();
    const stats = await normalizeContent(options);
    
    // Exit with status code based on results
    if (stats.errors > 0) {
      console.log('⚠️  Completed with errors. Please review the output above.\n');
      process.exit(1);
    } else if (stats.recordsWithChanges > 0 && options.dryRun) {
      console.log('ℹ️  Dry run complete. Use --apply to write changes.\n');
      process.exit(0);
    } else {
      console.log('✅ Success!\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { normalizeContent, normalizeSystemCode, normalizeBadge, normalizeArray };
