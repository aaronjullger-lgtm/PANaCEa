
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// --- Cleaning Logic ---

function cleanText(text: string): string {
  if (!text) return text;
  // Remove "---" separators often found in AI output
  let cleaned = text.replace(/\n\s*---\s*\n/g, '\n\n');
  cleaned = cleaned.trim();
  return cleaned;
}

function cleanContentObject(obj: any): any {
  if (typeof obj === 'string') {
    return cleanText(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => cleanContentObject(item));
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = cleanContentObject(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// --- Main Sync Logic ---

async function main() {
  console.log('Starting DB -> Local JSON Sync & Cleanup...');

  // 1. Fetch all content from DB
  // We use a cursor-based approach or just fetch all if it fits in memory. 
  // The previous error was 11MB, which is large but manageable if we don't select everything or increase limits.
  // However, for the JSON files, we need the full content. 
  // Let's fetch in batches to be safe, but build the full map in memory (Node can handle 11MB easily).
  
  const allDbContent = new Map<string, any>();
  let updatedDbCount = 0;
  
  console.log('Fetching and cleaning DB records...');
  
  let cursor: string | undefined = undefined;
  const BATCH_SIZE = 50;
  
  while (true) {
    const batch = await prisma.medicalContent.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' }
    });
    
    if (batch.length === 0) break;
    
    for (const record of batch) {
      // Clean content
      const originalJson = JSON.stringify(record.content);
      const cleanedContent = cleanContentObject(record.content);
      const newJson = JSON.stringify(cleanedContent);
      
      // Update DB if needed
      if (originalJson !== newJson) {
        await prisma.medicalContent.update({
          where: { id: record.id },
          data: { content: cleanedContent }
        });
        updatedDbCount++;
        process.stdout.write('u'); // u for updated
      } else {
        process.stdout.write('.');
      }

      // Store for JSON sync
      // We need the structure that matches the JSON files.
      // Usually the JSON files are arrays of objects or maps?
      // Let's check the file structure first.
      // Assuming the JSON files are arrays of objects with { conditionId, ... }
      
      allDbContent.set(record.conditionId, {
        conditionId: record.conditionId,
        condition: record.condition,
        content: cleanedContent,
        // Add other fields if they exist in the DB and are needed in JSON
        // The DB schema usually has: id, conditionId, condition, content, createdAt, updatedAt
      });
    }
    
    cursor = batch[batch.length - 1].id;
  }
  console.log(`\n✅ DB Cleanup Complete. Updated ${updatedDbCount} records.`);
  console.log(`Total records in DB: ${allDbContent.size}`);

  // 2. Sync to Local JSON Files
  const filesToSync = [
    'conditionContent.generated.json',
    'conditionContent.correct.json',
    'conditionContent.backup.json'
  ];

  for (const filename of filesToSync) {
    const filePath = path.resolve(process.cwd(), filename);
    console.log(`Syncing to ${filename}...`);
    
    let fileContent: any[] = [];
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
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

    await fs.writeFile(filePath, JSON.stringify(newContentArray, null, 2));
    console.log(`  - Added ${addedCount} new records.`);
    console.log(`  - Updated ${modifiedCount} existing records.`);
    console.log(`  - Total records in file: ${newContentArray.length}`);
  }

  console.log('✅ Sync Complete.');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
