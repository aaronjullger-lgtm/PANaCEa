import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.medicalContent.count();
  console.log('MedicalContent count:', count);
}
main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());