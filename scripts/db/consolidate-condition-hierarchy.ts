/**
 * Consolidate Condition Hierarchy Script
 *
 * Links related medical conditions into parent-child hierarchies
 * based on condition-families.json configuration.
 *
 * Run: npx tsx scripts/db/consolidate-condition-hierarchy.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ConditionFamily {
  canonicalName: string;
  parent: string;
  subtypes?: string[];
  complications?: string[];
  manifestations?: string[];
}

interface ConditionFamiliesData {
  conditionFamilies: ConditionFamily[];
}

async function findConditionByName(name: string) {
  // Try exact match first
  let condition = await prisma.medicalContent.findFirst({
    where: {
      condition: {
        equals: name,
        mode: 'insensitive',
      },
    },
    select: { id: true, condition: true, conditionId: true },
  });

  if (condition) return condition;

  // Try partial match
  condition = await prisma.medicalContent.findFirst({
    where: {
      condition: {
        contains: name,
        mode: 'insensitive',
      },
    },
    select: { id: true, condition: true, conditionId: true },
  });

  return condition;
}

async function linkCondition(
  childName: string,
  parentId: string,
  relationshipType: string,
  canonicalName: string
) {
  const child = await findConditionByName(childName);

  if (!child) {
    console.log(`⚠️  Child condition not found: ${childName}`);
    return false;
  }

  try {
    await prisma.medicalContent.update({
      where: { id: child.id },
      data: {
        parentId,
        relationshipType,
        canonicalName,
      },
    });
    console.log(`✓ Linked ${childName} → parent (${relationshipType})`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to link ${childName}:`, error);
    return false;
  }
}

async function consolidateHierarchy() {
  console.log('🏥 Consolidating Condition Hierarchies\n');

  // Load condition families
  const dataPath = path.join(process.cwd(), 'data', 'condition-families.json');
  const data: ConditionFamiliesData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  let totalLinked = 0;
  let totalFamilies = 0;

  for (const family of data.conditionFamilies) {
    console.log(`\n📋 Processing family: ${family.canonicalName}`);
    totalFamilies++;

    // Find or create parent condition
    const parent = await findConditionByName(family.parent);

    if (!parent) {
      console.log(`⚠️  Parent condition "${family.parent}" not found, skipping family`);
      continue;
    }

    // Update parent with canonical name
    await prisma.medicalContent.update({
      where: { id: parent.id },
      data: {
        canonicalName: family.canonicalName,
        relationshipType: null, // Parent has no relationship type
      },
    });

    console.log(`✓ Parent: ${parent.condition} (${parent.id})`);

    // Link subtypes
    if (family.subtypes) {
      console.log(`  Linking ${family.subtypes.length} subtypes...`);
      for (const subtype of family.subtypes) {
        const linked = await linkCondition(subtype, parent.id, 'subtype', family.canonicalName);
        if (linked) totalLinked++;
      }
    }

    // Link complications
    if (family.complications) {
      console.log(`  Linking ${family.complications.length} complications...`);
      for (const complication of family.complications) {
        const linked = await linkCondition(
          complication,
          parent.id,
          'complication',
          family.canonicalName
        );
        if (linked) totalLinked++;
      }
    }

    // Link manifestations
    if (family.manifestations) {
      console.log(`  Linking ${family.manifestations.length} manifestations...`);
      for (const manifestation of family.manifestations) {
        const linked = await linkCondition(
          manifestation,
          parent.id,
          'manifestation',
          family.canonicalName
        );
        if (linked) totalLinked++;
      }
    }
  }

  console.log(`\n✅ Consolidation complete!`);
  console.log(`   Families processed: ${totalFamilies}`);
  console.log(`   Conditions linked: ${totalLinked}`);
}

consolidateHierarchy()
  .catch((error) => {
    console.error('❌ Error consolidating hierarchies:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
