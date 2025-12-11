/**
 * Data Migration Script: Buzzwords → Database
 * 
 * Migrates buzzword data to the MedicalContent table.
 * Adds a 'buzzwords' array to the content JSON of the matched condition.
 * 
 * Run with: npm run migrate:buzzwords
 */

import { PrismaClient } from '@prisma/client';
import { BUZZWORD_BANK } from '../data/buzzwordBank';
import { findConditionMeta } from '../conditionRegistry';

const prisma = new PrismaClient();

function toSlug(text: string): string {
  return text.toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function migrateBuzzwords() {
  console.log('🐝 Migrating Buzzwords...');
  console.log(`Found ${BUZZWORD_BANK.length} buzzwords to migrate.`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Cache conditions for faster lookup (only IDs and slugs)
  const conditions = await prisma.medicalContent.findMany({
    select: { id: true, condition: true }
  });
  
  // Create a lookup map: slug -> MedicalContent ID
  const conditionIdMap = new Map(
    conditions.map(c => [toSlug(c.condition), c.id])
  );

  // Group buzzwords by condition to minimize DB writes
  const buzzwordsByCondition = new Map<string, typeof BUZZWORD_BANK>();

  for (const entry of BUZZWORD_BANK) {
    // 1. Try direct slug match first (fastest)
    let slug = toSlug(entry.condition);
    let matchedSlug = conditionIdMap.has(slug) ? slug : undefined;

    // 2. If no match, try fuzzy/alias matching via registry
    if (!matchedSlug) {
      const meta = findConditionMeta(entry.condition);
      if (meta) {
        const canonicalSlug = toSlug(meta.condition);
        if (conditionIdMap.has(canonicalSlug)) {
          matchedSlug = canonicalSlug;
          // console.log(`✨ Fuzzy matched: "${entry.condition}" -> "${meta.condition}"`);
        }
      }
    }

    if (matchedSlug) {
      if (!buzzwordsByCondition.has(matchedSlug)) {
        buzzwordsByCondition.set(matchedSlug, []);
      }
      buzzwordsByCondition.get(matchedSlug)?.push(entry);
    } else {
      console.log(`⚠️  Condition not found for buzzword: "${entry.buzzword}" (Condition: "${entry.condition}")`);
      skippedCount++;
    }
  }

  console.log(`\nProcessing ${buzzwordsByCondition.size} conditions...`);

  for (const [slug, entries] of buzzwordsByCondition) {
    try {
      const medicalContentId = conditionIdMap.get(slug);
      if (!medicalContentId) continue;

      // Fetch content for this specific condition
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { id: medicalContentId },
        select: { content: true }
      });

      if (!medicalContent) continue;

      const currentContent = medicalContent.content as any;
      const existingBuzzwords = Array.isArray(currentContent.buzzwords) ? currentContent.buzzwords : [];

      // Create new buzzword objects
      const newBuzzwords = entries.map(e => ({
        buzzword: e.buzzword,
        explanation: e.explanation,
        subcategory: e.subcategory
      }));

      // Merge avoiding duplicates (by buzzword text)
      const mergedBuzzwords = [...existingBuzzwords];
      for (const nb of newBuzzwords) {
        if (!mergedBuzzwords.some((eb: any) => eb.buzzword === nb.buzzword)) {
          mergedBuzzwords.push(nb);
        }
      }

      // Update DB
      await prisma.medicalContent.update({
        where: { id: medicalContentId },
        data: {
          content: {
            ...currentContent,
            buzzwords: mergedBuzzwords
          }
        }
      });

      successCount += entries.length;
      process.stdout.write('.');

    } catch (error) {
      console.error(`\n❌ Failed to update condition ${slug}:`, error);
      errorCount += entries.length;
    }
  }

  console.log('\n\n============================================================');
  console.log('📊 BUZZWORD MIGRATION REPORT');
  console.log('============================================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⏭️  Skipped:    ${skippedCount}`);
  console.log(`❌ Failed:     ${errorCount}`);
  console.log('============================================================');
}

migrateBuzzwords()
  .ca