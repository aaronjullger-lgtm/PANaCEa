import { PrismaClient } from '@prisma/client';

async function main() {
  try {
    console.log('Attempting to connect to the database...');
    // Set DATABASE_URL before creating client
    if (process.env.DIRECT_DATABASE_URL) {
      process.env.DATABASE_URL = process.env.DIRECT_DATABASE_URL;
    }
    const prisma = new PrismaClient();
    await prisma.$connect();
    console.log('Database connection successful!');

    console.log('Testing a simple query...');
    const conditionCount = await prisma.medicalContent.count();
    console.log(`Successfully fetched condition count: ${conditionCount}`);

    await prisma.$disconnect();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

main();
