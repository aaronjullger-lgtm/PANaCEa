#!/usr/bin/env tsx
/**
 * SPRINT 4: Hierarchy Update Script
 *
 * Applies category mappings to database with dry-run mode.
 * Updates parent_category field based on Sprint 3 analysis.
 */

import { prisma } from './helpers/prisma-client';
import fs from 'fs';
import path from 'path';

interface CategoryMapping {
  conditionId: string;
  conditionName: string;
  currentSystem: string;
  currentSubcategory: string | null;
  proposedSubcategory: string;
  proposedParentCategory: string | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`🔄 SPRINT 4: Hierarchy Update ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}\n`);

  // Load mappings
  const mappingsPath = path.join(process.cwd(), 'data', 'condition-category-mappings.json');

  if (!fs.existsSync(mappingsPath)) {
    console.error('❌ Error: condition-category-mappings.json not found');
    console.error(
      '   Run Sprint 3 script first: npx tsx scripts/categorize-existing-conditions.ts'
    );
    process.exit(1);
  }

  const mappings: CategoryMapping[] = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

  console.log(`📊 Loaded ${mappings.length} condition mappings\n`);

  const stats = {
    total: mappings.length,
    withParentCategory: 0,
    subcategoryChanges: 0,
    noChanges: 0,
    errors: 0,
  };

  const changes: Array<{
    id: string;
    name: string;
    before: { subcategory: string | null; parent: string | null };
    after: { subcategory: string; parent: string | null };
  }> = [];

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  for (const mapping of mappings) {
    try {
      const condition = await prisma.condition.findUnique({
        where: { id: mapping.conditionId },
        select: {
          id: true,
          name: true,
          subcategory: true,
          parent_category: true,
        },
      });

      if (!condition) {
        console.error(`⚠️  Condition not found: ${mapping.conditionId}`);
        stats.errors++;
        continue;
      }

      const needsUpdate =
        condition.subcategory !== mapping.proposedSubcategory ||
        condition.parent_category !== mapping.proposedParentCategory;

      if (!needsUpdate) {
        stats.noChanges++;
        continue;
      }

      if (condition.subcategory !== mapping.proposedSubcategory) {
        stats.subcategoryChanges++;
      }

      if (mapping.proposedParentCategory) {
        stats.withParentCategory++;
      }

      changes.push({
        id: condition.id,
        name: condition.name,
        before: {
          subcategory: condition.subcategory,
          parent: condition.parent_category,
        },
        after: {
          subcategory: mapping.proposedSubcategory,
          parent: mapping.proposedParentCategory,
        },
      });

      if (!DRY_RUN) {
        // Update Condition table
        await prisma.condition.update({
          where: { id: condition.id },
          data: {
            subcategory: mapping.proposedSubcategory,
            parent_category: mapping.proposedParentCategory,
          },
        });

        // Update MedicalContent table if exists
        const medicalContent = await prisma.medicalContent.findUnique({
          where: { conditionId: condition.id },
        });

        if (medicalContent) {
          await prisma.medicalContent.update({
            where: { id: medicalContent.id },
            data: {
              subcategory: mapping.proposedSubcategory,
              parent_category: mapping.proposedParentCategory,
            },
          });
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${mapping.conditionName}:`, error);
      stats.errors++;
    }
  }

  // Report
  console.log('📊 Update Summary:\n');
  console.log(`  Total Conditions: ${stats.total}`);
  console.log(`  Updates Needed: ${changes.length}`);
  console.log(`  No Changes: ${stats.noChanges}`);
  console.log(`  Subcategory Changes: ${stats.subcategoryChanges}`);
  console.log(`  With Parent Category: ${stats.withParentCategory}`);
  console.log(`  Errors: ${stats.errors}\n`);

  if (changes.length > 0) {
    console.log('📝 Sample Changes:\n');
    changes.slice(0, 10).forEach((change) => {
      console.log(`  ${change.name}`);
      console.log(
        `    Before: ${change.before.parent ? change.before.parent + ' → ' : ''}${change.before.subcategory || 'none'}`
      );
      console.log(
        `    After:  ${change.after.parent ? change.after.parent + ' → ' : ''}${change.after.subcategory}\n`
      );
    });

    if (changes.length > 10) {
      console.log(`  ... and ${changes.length - 10} more changes\n`);
    }
  }

  if (DRY_RUN) {
    console.log('✅ Dry run complete - no changes applied');
    console.log('\n📋 To apply changes, run:');
    console.log('   npx tsx scripts/apply-hierarchy-updates.ts');
  } else {
    console.log(`✅ Applied ${changes.length} hierarchy updates`);

    // Verify updates
    console.log('\n🔍 Verifying updates...');
    const withParent = await prisma.condition.count({
      where: { parent_category: { not: null } },
    });
    console.log(`  Conditions with parent_category: ${withParent}`);

    // Show hierarchy distribution
    const hierarchyStats = await prisma.condition.groupBy({
      by: ['system', 'parent_category'],
      _count: true,
      where: { parent_category: { not: null } },
    });

    if (hierarchyStats.length > 0) {
      console.log('\n📊 3-Level Hierarchy Distribution:');
      hierarchyStats
        .sort((a, b) => b._count - a._count)
        .slice(0, 10)
        .forEach((stat) => {
          console.log(`  ${stat.system} → ${stat.parent_category}: ${stat._count} conditions`);
        });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
