
import { PrismaClient } from "@prisma/client";

async function main() {
  try {
    console.log("Attempting to connect to the database...");
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DIRECT_DATABASE_URL,
        },
      },
    });
    await prisma.$connect();
    console.log("Database connection successful!");
    
    console.log("Testing a simple query...");
    const conditionCount = await prisma.medicalContent.count();
    console.log(`Successfully fetched condition count: ${conditionCount}`);
    
    await prisma.$disconnect();
    console.log("Database connection closed.");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

main();
