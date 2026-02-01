/**
 * Seed Contrastive Sets Script
 *
 * Populates the ContrastiveSet table with pre-defined symptom→condition mappings
 * for contrastive learning drills.
 *
 * Run: npx tsx scripts/db/seed-contrastive-sets.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ContrastiveSetData {
  symptom: string;
  system: string;
  highYield: boolean;
  conditionNames: string[];
  distinguishers: Record<string, string[]>;
}

interface ContrastiveSetsFile {
  contrastiveSets: ContrastiveSetData[];
}

async function findConditionByName(name: string): Promise<string | null> {
  // Try exact match first
  let condition = await prisma.medicalContent.findFirst({
    where: {
      condition: {
        equals: name,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  if (condition) return condition.id;

  // Try partial match
  condition = await prisma.medicalContent.findFirst({
    where: {
      condition: {
        contains: name,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  });

  return condition?.id || null;
}

async function seedContrastiveSets() {
  console.log('🎯 Seeding Contrastive Sets\n');

  // Load contrastive sets data
  const dataPath = path.join(process.cwd(), 'data', 'contrastive-sets.json');
  const data: ContrastiveSetsFile = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const setData of data.contrastiveSets) {
    console.log(`\n📋 Processing: ${setData.symptom}`);

    // Find condition IDs for all conditions in this set
    const conditionIds: string[] = [];
    const missingConditions: string[] = [];

    for (const conditionName of setData.conditionNames) {
      const conditionId = await findConditionByName(conditionName);
      if (conditionId) {
        conditionIds.push(conditionId);
      } else {
        missingConditions.push(conditionName);
      }
    }

    // Check if we have at least 3 conditions (minimum for contrastive learning)
    if (conditionIds.length < 3) {
      console.log(
        `⚠️  Skipping "${setData.symptom}" - only found ${conditionIds.length}/5 conditions`
      );
      if (missingConditions.length > 0) {
        console.log(`   Missing: ${missingConditions.join(', ')}`);
      }
      totalSkipped++;
      continue;
    }

    // Check if this contrastive set already exists
    const existingSet = await prisma.contrastiveSet.findFirst({
      where: {
        symptom: setData.symptom,
      },
    });

    if (existingSet) {
      console.log(`✓ Already exists: ${setData.symptom}`);
      continue;
    }

    // Create contrastive set
    try {
      const newSet = await prisma.contrastiveSet.create({
        data: {
          symptom: setData.symptom,
          conditionIds,
          distinguishers: setData.distinguishers,
          system: setData.system,
          highYield: setData.highYield,
        },
      });

      console.log(`✓ Created: ${setData.symptom} (${conditionIds.length} conditions)`);
      totalCreated++;
    } catch (error) {
      console.error(`✗ Failed to create "${setData.symptom}":`, error);
    }
  }

  console.log(`\n✅ Seeding complete!`);
  console.log(`   Sets created: ${totalCreated}`);
  console.log(`   Sets skipped: ${totalSkipped}`);
}

seedContrastiveSets()
  .catch((error) => {
    console.error('❌ Error seeding contrastive sets:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
