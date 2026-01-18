import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { LAB_TEST_DATABASE } from '../src/data/labTests';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function migrateLabTests() {
  console.log('Migrating Lab Tests...');
  let count = 0;

  for (const test of LAB_TEST_DATABASE) {
    try {
      await prisma.labTest.upsert({
        where: { name: test.name },
        update: {
          category: test.category,
          commonAbnormalities: test.commonAbnormalities || [],
          typicalUse: test.typicalUse,
        },
        create: {
          name: test.name,
          category: test.category,
          commonAbnormalities: test.commonAbnormalities || [],
          typicalUse: test.typicalUse,
        },
      });
      count++;
    } catch (error) {
      console.error(`Failed to migrate test ${test.name}:`, error);
    }
  }
  console.log(`Successfully migrated ${count} lab tests.`);
}

async function migrateLabCases() {
  console.log('Migrating Lab Cases...');
  const labCasesPath = path.resolve(process.cwd(), 'src/data/labCases.json');

  if (!fs.existsSync(labCasesPath)) {
    console.warn('Lab cases file not found at:', labCasesPath);
    return;
  }

  const labCases = JSON.parse(fs.readFileSync(labCasesPath, 'utf-8'));
  let count = 0;

  for (const caseItem of labCases) {
    try {
      // We don't have a unique constraint on correctDiagnosis + vignette, so we'll just create
      // Or we could try to find existing one to avoid duplicates if run multiple times
      // For now, let's check if one exists with same diagnosis and vignette start

      const existing = await prisma.labCase.findFirst({
        where: {
          correctDiagnosis: caseItem.correctDiagnosis,
          clinicalVignette: caseItem.clinicalVignette,
        },
      });

      if (existing) {
        await prisma.labCase.update({
          where: { id: existing.id },
          data: {
            labs: caseItem.labs,
          },
        });
      } else {
        await prisma.labCase.create({
          data: {
            id: uuidv4(),
            correctDiagnosis: caseItem.correctDiagnosis,
            clinicalVignette: caseItem.clinicalVignette,
            labs: caseItem.labs,
            updatedAt: new Date(),
          },
        });
      }
      count++;
    } catch (error) {
      console.error(`Failed to migrate case ${caseItem.id}:`, error);
    }
  }
  console.log(`Successfully migrated ${count} lab cases.`);
}

async function main() {
  try {
    await migrateLabTests();
    await migrateLabCases();
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
