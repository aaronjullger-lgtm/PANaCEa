import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting check...');
  const pharmContent = await prisma.medicalContent.count({
    where: { system: 'PHARM' },
  });
  console.log(`Found ${pharmContent} PHARM items in MedicalContent`);

  const pharmConditions = await prisma.condition.count({
    where: { system: 'PHARM' },
  });
  console.log(`Found ${pharmConditions} PHARM items in Condition`);

  // Also check for "Biologics" specifically to see its system
  const biologics = await prisma.condition.findFirst({
    where: { name: 'Biologics' },
  });
  if (biologics) {
    console.log(`Biologics condition found:`, biologics);
  } else {
    console.log('Biologics condition NOT found');
  }

  // Check for Croup by ID
  const croupId = await prisma.medicalContent.findUnique({
    where: { conditionId: 'HEENT__larynx__upper_airway__croup_laryngotracheobronchitis' },
  });
  console.log(`Croup by ID found:`, croupId);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
