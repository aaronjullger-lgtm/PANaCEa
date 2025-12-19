#!/usr/bin/env tsx
/**
 * Back-Sync Agent: DB → Local Registry Files
 * 
 * Ensures that new records created in the database (e.g., by AI or Admin Panel)
 * get written back to the local TypeScript registry files so they aren't lost.
 * 
 * Logic:
 * 1. Load all Conditions and Drugs from Prisma
 * 2. Read local registry files as raw text
 * 3. Find DB records not present in local files
 * 4. Inject missing entries before the closing `];` bracket
 * 5. Create .bak backup before writing
 * 
 * Usage: npx tsx scripts/sync_db_to_registry.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const CONDITION_REGISTRY_PATH = path.join(__dirname, '../conditionRegistry.ts');
const DRUG_REGISTRY_PATH = path.join(__dirname, '../drugRegistry.ts');

/**
 * Normalize a name for comparison (lowercase, remove special chars)
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Check if a condition name exists in the file text
 */
function conditionExistsInFile(fileText: string, conditionName: string): boolean {
  const normalized = normalizeName(conditionName);
  const lines = fileText.split('\n');
  
  for (const line of lines) {
    // Look for: condition: "..."
    const match = line.match(/condition:\s*["']([^"']+)["']/);
    if (match && normalizeName(match[1]) === normalized) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a drug name exists in the file text
 */
function drugExistsInFile(fileText: string, genericName: string): boolean {
  const normalized = normalizeName(genericName);
  const lines = fileText.split('\n');
  
  for (const line of lines) {
    // Look for: genericName: "..."
    const match = line.match(/genericName:\s*["']([^"']+)["']/);
    if (match && normalizeName(match[1]) === normalized) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate TypeScript code for a new condition entry
 */
function generateConditionEntry(condition: any): string {
  const escapeName = (s: string) => s.replace(/"/g, '\\"');
  const aliases = condition.aliases && condition.aliases.length > 0
    ? `, aliases: [${condition.aliases.map((a: string) => `"${escapeName(a)}"`).join(', ')}]`
    : '';
  
  return `  { system: "${condition.system}", subcategory: "AI Generated", condition: "${escapeName(condition.name)}"${aliases} },`;
}

/**
 * Generate TypeScript code for a new drug entry
 */
function generateDrugEntry(drug: any): string {
  const escapeName = (s: string) => s.replace(/"/g, '\\"');
  const brandName = drug.brandName ? `\n    brandName: "${escapeName(drug.brandName)}",` : '';
  const aliases = drug.aliases && drug.aliases.length > 0
    ? `\n    aliases: [${drug.aliases.map((a: string) => `"${escapeName(a)}"`).join(', ')}],`
    : '';
  const drugClass = drug.drugClass && drug.drugClass.length > 0
    ? `\n    drugClass: [${drug.drugClass.map((c: string) => `"${escapeName(c)}"`).join(', ')}],`
    : '';
  
  return `  {
    genericName: "${escapeName(drug.genericName)}",${brandName}${aliases}${drugClass}
    isHighYield: false,
    fdaApproved: true,
  },`;
}

/**
 * Find the best insertion point in the registry file
 * Returns the position right before the export of CONDITION_REGISTRY_ADDITIONAL or CONDITION_REGISTRY
 */
function findInsertionPoint(fileText: string, forConditions: boolean): number {
  if (forConditions) {
    // Try to insert before CONDITION_REGISTRY_ADDITIONAL
    const additionalMatch = fileText.indexOf('export const CONDITION_REGISTRY_ADDITIONAL');
    if (additionalMatch !== -1) {
      // Find the line before this export
      const lines = fileText.substring(0, additionalMatch).split('\n');
      const beforeExport = lines.slice(0, -1).join('\n');
      return beforeExport.length;
    }
    
    // Otherwise, insert before the main CONDITION_REGISTRY export
    const registryMatch = fileText.indexOf('export const CONDITION_REGISTRY: ConditionMeta[]');
    if (registryMatch !== -1) {
      const lines = fileText.substring(0, registryMatch).split('\n');
      const beforeExport = lines.slice(0, -1).join('\n');
      return beforeExport.length;
    }
  } else {
    // For drugs, insert before DRUG_REGISTRY export
    const registryMatch = fileText.indexOf('export const DRUG_REGISTRY: DrugMeta[]');
    if (registryMatch !== -1) {
      const lines = fileText.substring(0, registryMatch).split('\n');
      const beforeExport = lines.slice(0, -1).join('\n');
      return beforeExport.length;
    }
  }
  
  // Fallback: append before the last line
  const lines = fileText.split('\n');
  return lines.slice(0, -1).join('\n').length;
}

/**
 * Inject new array into the file
 */
function injectNewArray(fileText: string, arrayName: string, entries: string[], forConditions: boolean): string {
  if (entries.length === 0) return fileText;
  
  const insertionPoint = findInsertionPoint(fileText, forConditions);
  
  const newArrayText = `\n// ================================================
// DB-SYNCED ENTRIES (Auto-generated from database)
// ================================================

export const ${arrayName}: ${forConditions ? 'ConditionMeta' : 'DrugMeta'}[] = [
${entries.join('\n')}
];\n\n`;
  
  const before = fileText.substring(0, insertionPoint);
  const after = fileText.substring(insertionPoint);
  
  return before + newArrayText + after;
}

/**
 * Update the main registry export to include the new array
 */
function updateMainExport(fileText: string, newArrayName: string, isCondition: boolean): string {
  const exportName = isCondition ? 'CONDITION_REGISTRY' : 'DRUG_REGISTRY';
  const exportRegex = new RegExp(
    `export const ${exportName}.*?=\\s*\\[([\\s\\S]*?)\\];`,
    ''
  );
  
  const match = fileText.match(exportRegex);
  if (!match) {
    console.warn(`⚠️  Could not find export for ${exportName}`);
    return fileText;
  }
  
  // Check if the new array is already included
  if (match[1].includes(newArrayName)) {
    return fileText; // Already included
  }
  
  // Add the new array to the export
  const replacement = `export const ${exportName} = [
${match[1].trim()},
  ...${newArrayName},
];`;
  
  return fileText.replace(exportRegex, replacement);
}

/**
 * Back-sync conditions from DB to local file
 */
async function backSyncConditions(): Promise<number> {
  console.log('\n🔍 Checking conditions in database vs local registry...');
  
  const dbConditions = await prisma.condition.findMany({
    select: {
      name: true,
      system: true,
      aliases: true,
    },
  });
  
  console.log(`📊 Found ${dbConditions.length} conditions in database`);
  
  // Read local file
  let fileText = fs.readFileSync(CONDITION_REGISTRY_PATH, 'utf-8');
  
  // Find missing conditions
  const missing = dbConditions.filter(cond => !conditionExistsInFile(fileText, cond.name));
  
  if (missing.length === 0) {
    console.log('✅ All database conditions already exist in local registry');
    return 0;
  }
  
  console.log(`📝 Found ${missing.length} conditions to add to local registry`);
  
  // Create backup
  const backupPath = CONDITION_REGISTRY_PATH + '.bak';
  fs.writeFileSync(backupPath, fileText);
  console.log(`💾 Created backup: ${path.basename(backupPath)}`);
  
  // Group by system
  const bySystem = missing.reduce((acc, cond) => {
    if (!acc[cond.system]) acc[cond.system] = [];
    acc[cond.system].push(cond);
    return acc;
  }, {} as Record<string, typeof missing>);
  
  // Generate entries
  const newEntries = missing.map(generateConditionEntry);
  
  // Inject new array
  fileText = injectNewArray(fileText, 'CONDITION_REGISTRY_DB_SYNCED', newEntries, true);
  
  // Update main export
  fileText = updateMainExport(fileText, 'CONDITION_REGISTRY_DB_SYNCED', true);
  
  // Write updated file
  fs.writeFileSync(CONDITION_REGISTRY_PATH, fileText);
  console.log(`✅ Added ${missing.length} conditions to conditionRegistry.ts`);
  
  // Log what was added
  for (const [system, conds] of Object.entries(bySystem)) {
    console.log(`   ${system}: ${conds.map(c => c.name).join(', ')}`);
  }
  
  return missing.length;
}

/**
 * Back-sync drugs from DB to local file
 */
async function backSyncDrugs(): Promise<number> {
  console.log('\n🔍 Checking drugs in database vs local registry...');
  
  const dbDrugs = await prisma.drug.findMany({
    select: {
      genericName: true,
      brandName: true,
      aliases: true,
      drugClass: true,
    },
  });
  
  console.log(`📊 Found ${dbDrugs.length} drugs in database`);
  
  // Read local file
  let fileText = fs.readFileSync(DRUG_REGISTRY_PATH, 'utf-8');
  
  // Find missing drugs
  const missing = dbDrugs.filter(drug => !drugExistsInFile(fileText, drug.genericName));
  
  if (missing.length === 0) {
    console.log('✅ All database drugs already exist in local registry');
    return 0;
  }
  
  console.log(`📝 Found ${missing.length} drugs to add to local registry`);
  
  // Create backup
  const backupPath = DRUG_REGISTRY_PATH + '.bak';
  fs.writeFileSync(backupPath, fileText);
  console.log(`💾 Created backup: ${path.basename(backupPath)}`);
  
  // Generate entries
  const newEntries = missing.map(generateDrugEntry);
  
  // Inject new array
  fileText = injectNewArray(fileText, 'DRUG_REGISTRY_DB_SYNCED', newEntries, false);
  
  // Update main export
  fileText = updateMainExport(fileText, 'DRUG_REGISTRY_DB_SYNCED', false);
  
  // Write updated file
  fs.writeFileSync(DRUG_REGISTRY_PATH, fileText);
  console.log(`✅ Added ${missing.length} drugs to drugRegistry.ts`);
  
  // Log what was added
  for (const drug of missing) {
    console.log(`   ${drug.genericName}${drug.brandName ? ` (${drug.brandName})` : ''}`);
  }
  
  return missing.length;
}

/**
 * Main execution
 */
async function main() {
  console.log('💾 BACK-SYNC AGENT: Database → Local Registry Files');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}\n`);
  
  try {
    const conditionsAdded = await backSyncConditions();
    const drugsAdded = await backSyncDrugs();
    
    console.log('\n' + '='.repeat(60));
    console.log('SYNC SUMMARY');
    console.log('='.repeat(60));
    console.log(`📝 Conditions Added: ${conditionsAdded}`);
    console.log(`💊 Drugs Added: ${drugsAdded}`);
    console.log('='.repeat(60) + '\n');
    
    if (conditionsAdded > 0 || drugsAdded > 0) {
      console.log('✅ Back-sync complete! Local registry files updated.');
      console.log('💡 Tip: Review the changes and commit to version control.\n');
    } else {
      console.log('✅ No changes needed. Database and local registries are in sync.\n');
    }
  } catch (error) {
    console.error('❌ Back-sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
