import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.condition.count();
    console.log(`Condition count: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.condition.findFirst();
      console.log('Sample condition:', JSON.stringify(sample, null, 2));
    }
  } catch (error) {
    console.error('Error checking Condition table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
