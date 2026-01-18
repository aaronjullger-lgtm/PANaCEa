import { PrismaClient } from '@prisma/client';
import { CONDITION_REGISTRY } from '../config/conditionRegistry';

const prisma = new PrismaClient();

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanText(text: string): string {
  if (!text) return text;

  // Remove "---" separators often found in AI output
  let cleaned = text.replace(/\n\s*---\s*\n/g, '\n\n');

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  // Fix double asterisks if they are just hanging around (e.g. "** " at start of line)
  // But keep them if they are used for bolding like **bold**
  // This is tricky, so maybe just focus on the "---" for now as requested.

  return cleaned;
}

function cleanContentObject(obj: any): any {
  if (typeof obj === 'string') {
    return cleanText(obj);
  } else if (Array.isArray(obj)) {
    return obj.map((item) => cleanContentObject(item));
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = cleanContentObject(obj[key]);
    }
    return newObj;
  }
  return obj;
}

async function main() {
  console.log('Starting Database Cleanup...');

  // 1. Identify Orphans
  const registryIds = new Set<string>();
  CONDITION_REGISTRY.forEach((c) => {
    const normSub = c.subcategory
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    const normCond = c.condition
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    const id = `${c.system}__${normSub}__${normCond}`;
    registryIds.add(id);
  });

  const allContent = await prisma.medicalContent.findMany({
    select: { id: true, conditionId: true, condition: true },
  });

  console.log(`Total DB records: ${allContent.length}`);
  console.log(`Total Registry entries: ${registryIds.size}`);

  const orphans = allContent.filter((c) => !registryIds.has(c.conditionId));

  if (orphans.length > 0) {
    console.log(`Found ${orphans.length} orphaned records (not in Registry). Deleting...`);
    // orphans.forEach(o => console.log(`- Deleting: ${o.condition} (${o.conditionId})`));

    const orphanIds = orphans.map((o) => o.id);
    await prisma.medicalContent.deleteMany({
      where: { id: { in: orphanIds } },
    });
    console.log('✅ Orphans deleted.');
  } else {
    console.log('✅ No orphans found.');
  }

  // 2. Clean Content Formatting
  console.log('Scanning for formatting issues (---)...');
  let updatedCount = 0;

  // Process in batches to avoid memory/size limits
  const BATCH_SIZE = 50;
  let cursor: string | undefined = undefined;

  while (true) {
    const batch = await prisma.medicalContent.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const record of batch) {
      // Content field no longer exists on MedicalContent model
      // const originalJson = JSON.stringify(record.content);
      // const cleanedContent = cleanContentObject(record.content);
      // const newJson = JSON.stringify(cleanedContent);
      // if (originalJson !== newJson) {
      //   await prisma.medicalContent.update({
      //     where: { id: record.id },
      //     data: { content: cleanedContent }
      //   });
      //   updatedCount++;
      // }
    }

    process.stdout.write('.');
    cursor = batch[batch.length - 1].id;
  }

  console.log(`\n✅ Cleaned formatting in ${updatedCount} records.`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
