import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.medicalContent.count();
    console.log(`MedicalContent count: ${count}`);

    if (count > 0) {
      const sample = await prisma.medicalContent.findFirst();
      console.log('Sample content:', JSON.stringify(sample, null, 2));
    } else {
      console.log('MedicalContent table is empty.');
    }
  } catch (error) {
    console.error('Error checking content:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
