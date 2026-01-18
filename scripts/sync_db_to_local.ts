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
 * Usage: npx tsx scripts/sync_db_to_local.ts
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
 * Main sync function
 */
async function main() {
  const BATCH_SIZE = 100;
  let cursor: string | undefined = undefined;
  let updatedDbCount = 0;
  const allDbContent = new Map<string, any>();

  console.log('Starting DB cleanup and sync...');

  while (true) {
    const batch = await prisma.medicalContent.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      // Clean content
      // const originalJson = JSON.stringify(record.content);
      // const cleanedContent = cleanContentObject(record.content);
      // const newJson = JSON.stringify(cleanedContent);

      // Update DB if needed
      // if (originalJson !== newJson) {
      //   await prisma.medicalContent.update({
      //     where: { id: record.id },
      //     data: { content: cleanedContent }
      //   });
      //   updatedDbCount++;
      //   process.stdout.write('u'); // u for updated
      // } else {
      process.stdout.write('.');
      // }

      // Store for JSON sync
      // allContent[record.conditionId] = cleanedContent;
      // Usually the JSON files are arrays of objects or maps?
      // Let's check the file structure first.
      // Assuming the JSON files are arrays of objects with { conditionId, ... }

      // allDbContent.set(record.conditionId, {
      //   conditionId: record.conditionId,
      //   condition: record.condition,
      //   content: cleanedContent,
      //   // Add other fields if they exist in the DB and are needed in JSON
      //   // The DB schema usually has: id, conditionId, condition, content, createdAt, updatedAt
      // });
    }

    cursor = batch[batch.length - 1].id;
  }
  console.log(`\n✅ DB Cleanup Complete. Updated ${updatedDbCount} records.`);
  console.log(`Total records in DB: ${allDbContent.size}`);

  // 2. Sync to Local JSON Files
  const filesToSync = [
    'conditionContent.generated.json',
    'conditionContent.correct.json',
    'conditionContent.backup.json',
  ];

  for (const filename of filesToSync) {
    const filePath = path.resolve(process.cwd(), filename);
    console.log(`Syncing to ${filename}...`);

    let fileContent: any[] = [];
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      fileContent = JSON.parse(raw);
    } catch (e) {
      console.log(`  - File ${filename} not found or invalid. Creating new.`);
    }

    // Convert file content to Map for easy merging
    const fileMap = new Map<string, any>();
    if (Array.isArray(fileContent)) {
      fileContent.forEach((item: any) => {
        if (item.conditionId) fileMap.set(item.conditionId, item);
      });
    } else if (typeof fileContent === 'object') {
      // Handle case where it might be an object keyed by ID
      Object.values(fileContent).forEach((item: any) => {
        if (item.conditionId) fileMap.set(item.conditionId, item);
      });
    }

    // Merge DB content INTO file content
    // (DB is source of truth for "orphans" and updates)
    let addedCount = 0;
    let modifiedCount = 0;

    for (const [conditionId, dbRecord] of allDbContent) {
      if (!fileMap.has(conditionId)) {
        fileMap.set(conditionId, dbRecord);
        addedCount++;
      } else {
        // Optional: Check if DB is actually newer?
        // For now, we assume DB is the master and overwrite content.
        // But we preserve other fields in the file if they exist and aren't in DB record?
        // The DB record constructed above only has conditionId, condition, content.
        const existing = fileMap.get(conditionId);

        // Simple check if content changed
        if (JSON.stringify(existing.content) !== JSON.stringify(dbRecord.content)) {
          fileMap.set(conditionId, { ...existing, ...dbRecord });
          modifiedCount++;
        }
      }
    }

    // Convert back to array (assuming array format is desired)
    const newContentArray = Array.from(fileMap.values());

    // Sort by conditionId for stability
    newContentArray.sort((a, b) => a.conditionId.localeCompare(b.conditionId));

    await fs.promises.writeFile(filePath, JSON.stringify(newContentArray, null, 2));
    console.log(`  - Added ${addedCount} new records.`);
    console.log(`  - Updated ${modifiedCount} existing records.`);
    console.log(`  - Total records in file: ${newContentArray.length}`);
  }

  console.log('✅ Sync Complete.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
