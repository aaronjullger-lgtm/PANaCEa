import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkDrugs() {
  const count = await prisma.drug.count();
  console.log('Drug count:', count);
  const sample = await prisma.drug.findFirst();
  console.log('Sample:', sample);
}
checkDrugs().finally(() => prisma.$disconnect());