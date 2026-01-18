import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up bad migration data...');

  // Delete MedicalContent where conditionId is a number (stringified)
  // We can check if it matches regex ^\d+$

  const allContent = await prisma.medicalContent.findMany({
    select: { conditionId: true },
  });

  const badIds = allContent.filter((c) => /^\d+$/.test(c.conditionId)).map((c) => c.conditionId);

  console.log(`Found ${badIds.length} bad MedicalContent records.`);

  if (badIds.length > 0) {
    const result = await prisma.medicalContent.deleteMany({
      where: {
        conditionId: { in: badIds },
      },
    });
    console.log(`Deleted ${result.count} bad MedicalContent records.`);
  }

  // Also clean up Conditions that were created from these bad records
  // They likely have names like "0", "1", "29"...
  const allConditions = await prisma.condition.findMany({
    select: { id: true, name: true },
  });

  const badConditions = allConditions.filter((c) => /^\d+$/.test(c.name)).map((c) => c.id);

  console.log(`Found ${badConditions.length} bad Condition records.`);

  if (badConditions.length > 0) {
    const result = await prisma.condition.deleteMany({
      where: {
        id: { in: badConditions },
      },
    });
    console.log(`Deleted ${result.count} bad Condition records.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
