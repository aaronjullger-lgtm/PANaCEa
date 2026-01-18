import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCounts() {
  const conditionCount = await prisma.condition.count();
  const medicalContentCount = await prisma.medicalContent.count();

  console.log(`Condition count: ${conditionCount}`);
  console.log(`MedicalContent count: ${medicalContentCount}`);

  if (conditionCount > 0) {
    const sample = await prisma.condition.findFirst();
    console.log('Sample Condition:', sample);
  }

  if (medicalContentCount > 0) {
    const sample = await prisma.medicalContent.findFirst();
    console.log('Sample MedicalContent:', sample);
  }
}

checkCounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
