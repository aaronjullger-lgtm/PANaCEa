/**
 * Data Migration Script: Media Manifest → Database
 * 
 * Migrates photo manifest data to the MediaAsset table.
 * Links media to existing Conditions in the database.
 * 
 * Run with: npx tsx scripts/migrateMediaManifestToDb.ts
 */

import { PrismaClient } from '@prisma/client';
import { ECG_MANIFEST, DERM_MANIFEST, RADIOLOGY_MANIFEST } from '../data/photoManifest';

const prisma = new PrismaClient();

async function migrateMediaManifest() {
  console.log('🖼️  Migrating Media Manifest...');

  const allManifests = [
    ...ECG_MANIFEST,
    ...DERM_MANIFEST,
    ...RADIOLOGY_MANIFEST
  ];

  console.log(`Found ${allManifests.length} media entries to migrate.`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Cache conditions for faster lookup
  const conditions = await prisma.condition.findMany({
    select: { id: true, name: true }
  });
  
  function toSlug(text: string): string {
    return text.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  // Create a lookup map (normalize names for better matching)
  // The DB 'name' is already a slug (e.g., 'atrial_fibrillation')
  const conditionMap = new Map(
    conditions.map(c => [toSlug(c.name), c.id])
  );

  for (const entry of allManifests) {
    try {
      // Try to match by slugifying the manifest name
      // e.g. "Atrial Fibrillation" -> "atrial_fibrillation"
      const slug = toSlug(entry.condition);
      let conditionId = conditionMap.get(slug);

      // Fallback: Try to find partial match if exact slug fails
      if (!conditionId) {
        // Some slugs might have extra info or be slightly different
        // e.g. "Normal Sinus Rhythm (NSR)" -> "normal_sinus_rhythm_nsr"
        // manifest might just say "Normal Sinus Rhythm"
        const partialMatch = conditions.find(c => c.name.includes(slug) || slug.includes(c.name));
        if (partialMatch) {
            conditionId = partialMatch.id;
        }
      }

      if (!conditionId) {
        console.log(`⚠️  Condition not found for: "${entry.condition}" (slug: ${slug}) - Skipping linkage`);
        // We can still create the asset, just unlinked, or skip it. 
        // For now, let's skip to avoid orphaned assets unless we want them.
        // Actually, let's create them but leave conditionId null so we can fix later.
      }

      for (const imagePath of entry.images) {
        const filename = imagePath.split('/').pop() || imagePath;
        
        await prisma.mediaAsset.create({
          data: {
            conditionId: conditionId || null,
            type: entry.category,
            filename: filename,
            originalUrl: `/images/photo-drill/${entry.category}/${filename}`, // Assuming local path for now
            thumbnailUrl: `/images/photo-drill/${entry.category}/${filename}`,
            description: entry.educationalCaption,
            tags: entry.keyFindings,
            status: 'approved',
            approvalStatus: 'approved',
            isClinical: true,
            folder: 'clinical_verified',
            uploadedBy: 'system_migration',
          }
        });
      }

      // If no images, we might still want to store the metadata? 
      // The manifest is mostly about images. If images array is empty, nothing to store in MediaAsset.
      if (entry.images.length === 0) {
        skippedCount++;
      } else {
        successCount++;
        process.stdout.write('.');
      }

    } catch (error) {
      console.error(`\n❌ Failed to migrate media for ${entry.condition}:`, error);
      errorCount++;
    }
  }

  console.log('\n\n============================================================');
  console.log('📊 MEDIA MIGRATION REPORT');
  console.log('============================================================');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⏭️  Skipped:    ${skippedCount}`);
  console.log(`❌ Failed:     ${errorCount}`);
  console.log('============================================================');
}

migrateMediaManifest()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
