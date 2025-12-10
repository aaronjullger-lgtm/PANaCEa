
import fs from 'fs';
import path from 'path';
import { CONDITION_REGISTRY } from '../conditionRegistry';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONTENT_FILE = path.join(process.cwd(), 'conditionContent.generated.json');

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

async function verifyCompleteness() {
  console.log('--- Verifying Condition Completeness ---');

  // 1. Load Registry
  const registryConditions = new Set(CONDITION_REGISTRY.map(c => c.condition));
  const registryNorm = new Set(CONDITION_REGISTRY.map(c => normalize(c.condition)));
  console.log(`Registry count: ${registryConditions.size}`);

  // 2. Load Content File
  const contentMap = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf-8'));
  const contentKeys = Object.keys(contentMap);
  console.log(`Content file count: ${contentKeys.length}`);

  // 3. Check for Content in File NOT in Registry
  // We need to map content keys (IDs) to condition names using the same logic as migration
  // But simpler: we just want to know if the Registry covers these IDs.
  
  // Build a map of Registry ID -> Condition Name
  const registryIdMap = new Set<string>();
  const registryNameMap = new Set<string>();
  
  CONDITION_REGISTRY.forEach(c => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const id = `${c.system}__${norm(c.subcategory)}__${norm(c.condition)}`;
    registryIdMap.add(id);
    registryNameMap.add(normalize(c.condition));
  });

  const orphanedContent: string[] = [];
  
  contentKeys.forEach(key => {
    // Check if key matches a registry ID
    if (!registryIdMap.has(key)) {
        // If key doesn't match, maybe the content has a name we can check?
        const val = contentMap[key];
        if (val.condition && registryNameMap.has(normalize(val.condition))) {
            // It's fine, name matches
        } else {
            orphanedContent.push(key);
        }
    }
  });

  if (orphanedContent.length > 0) {
    console.log(`\n⚠️  Found ${orphanedContent.length} keys in Content File but NOT in Registry:`);
    orphanedContent.slice(0, 10).forEach(c => console.log(`- ${c}`));
    if (orphanedContent.length > 10) console.log(`... and ${orphanedContent.length - 10} more.`);
  } else {
    console.log('\n✅ All content file keys map to the Registry.');
  }

  // 4. Check Database
  const dbConditions = await prisma.medicalContent.findMany({
    select: { condition: true }
  });
  const dbSet = new Set(dbConditions.map(c => normalize(c.condition)));
  console.log(`Database count: ${dbSet.size}`);

  // 5. Check for Registry items NOT in DB
  const missingFromDb: string[] = [];
  CONDITION_REGISTRY.forEach(c => {
    if (!dbSet.has(normalize(c.condition))) {
      missingFromDb.push(c.condition);
    }
  });

  if (missingFromDb.length > 0) {
    console.log(`\n⚠️  Found ${missingFromDb.length} conditions in Registry but NOT in Database:`);
    missingFromDb.forEach(c => console.log(`- ${c}`));
  } else {
    console.log('\n✅ All Registry conditions are in the Database.');
  }

  // 6. Check for DB items NOT in Registry (Ghost records?)
  const ghosts: string[] = [];
  dbConditions.forEach(c => {
    if (!registryNorm.has(normalize(c.condition))) {
      ghosts.push(c.condition);
    }
  });

  if (ghosts.length > 0) {
    console.log(`\n⚠️  Found ${ghosts.length} conditions in Database but NOT in Registry (Potential ghosts/renames):`);
    ghosts.slice(0, 20).forEach(c => console.log(`- ${c}`));
    if (ghosts.length > 20) console.log(`... and ${ghosts.length - 20} more.`);
  } else {
    console.log('\n✅ All Database conditions are in the Registry.');
  }

}

verifyCompleteness()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
