/**
 * Apply Enrichment from JSON
 *
 * Applies content from a completed enrichment template JSON file
 * to the database.
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';
import { readFileSync } from 'fs';
import { join } from 'path';

interface EnrichedCondition {
  id: string;
  condition: string;
  content: {
    overview?: string;
    symptoms?: string[];
    treatment?: string;
    diagnostics?: string[];
  };
}

async function applyEnrichment(filePath: string, dryRun: boolean = false): Promise<void> {
  console.log('🏥 PANaCEa Database: Applying Enrichment\n');

  const fullPath = join(process.cwd(), filePath);
  console.log(`Reading from: ${fullPath}\n`);

  let data: any[];
  try {
    const fileContent = readFileSync(fullPath, 'utf-8');
    data = JSON.parse(fileContent);
  } catch (error: any) {
    console.error('❌ Error reading file:', error.message);
    process.exit(1);
  }

  // Detect format: array of {id, condition, content} or enrichment template
  const enriched: EnrichedCondition[] = data.map((item) => {
    if (item.content) {
      return item; // Already in correct format
    } else if (item.toGenerate) {
      // Convert from template format
      return {
        id: item.id,
        condition: item.condition,
        content: item.toGenerate,
      };
    } else {
      throw new Error(`Invalid format for condition: ${JSON.stringify(item)}`);
    }
  });

  console.log(`Found ${enriched.length} conditions to process\n`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const item of enriched) {
    try {
      // Skip if content contains placeholder text
      const hasPlaceholder =
        item.content.overview?.includes('[GENERATE:') ||
        item.content.symptoms?.some((s) => s.includes('[GENERATE:')) ||
        item.content.treatment?.includes('[GENERATE:') ||
        item.content.diagnostics?.some((d) => d.includes('[GENERATE:'));

      if (hasPlaceholder) {
        console.log(`⏭️  Skipping ${item.condition} (contains placeholders)`);
        skippedCount++;
        continue;
      }

      const updateData: any = { updatedAt: new Date() };

      if (item.content.overview) updateData.overview = item.content.overview;
      if (item.content.symptoms && item.content.symptoms.length > 0)
        updateData.symptoms = item.content.symptoms;
      if (item.content.treatment) updateData.treatment = item.content.treatment;
      if (item.content.diagnostics && item.content.diagnostics.length > 0)
        updateData.diagnostics = item.content.diagnostics;

      if (Object.keys(updateData).length === 1) {
        console.log(`⏭️  Skipping ${item.condition} (no valid updates)`);
        skippedCount++;
        continue;
      }

      if (dryRun) {
        console.log(`✅ DRY RUN - Would update ${item.condition}`);
        console.log(
          `   Fields: ${Object.keys(updateData)
            .filter((k) => k !== 'updatedAt')
            .join(', ')}`
        );
      } else {
        await prisma.medicalContent.update({
          where: { id: item.id },
          data: updateData,
        });
        console.log(`✅ Updated ${item.condition}`);
      }

      successCount++;
    } catch (error: any) {
      console.error(`❌ Error updating ${item.condition}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 APPLICATION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total conditions:        ${enriched.length}`);
  console.log(`Successfully applied:    ${successCount} ✅`);
  console.log(`Skipped (placeholders):  ${skippedCount} ⏭️`);
  console.log(`Errors:                  ${errorCount} ❌`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No database changes were made');
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Database updated successfully');
  }

  console.log('='.repeat(80) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filePath = args.find((arg) => !arg.startsWith('--')) || 'enrichment-template.json';

  await applyEnrichment(filePath, dryRun);
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
