import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL for guideline verification.');
}

const adapter = new PrismaPg(new Pool({ connectionString }));
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Querying Guidelines table...\n');
  
  const guidelines = await prisma.guideline.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      organization: true,
      grade: true,
      panceYield: true,
      frequency: true,
      targetPopulation: true,
      criteria: true
    }
  });
  
  console.log(`Found ${guidelines.length} guidelines:\n`);
  
  guidelines.forEach((guideline, index) => {
    console.log(`${index + 1}. ${guideline.name}`);
    console.log(`   Type: ${guideline.type}`);
    console.log(`   Organization: ${guideline.organization}`);
    console.log(`   Grade: ${guideline.grade}`);
    console.log(`   PANCE Yield: ${guideline.panceYield}`);
    console.log(`   Target Population: ${guideline.targetPopulation}`);
    console.log(`   Frequency: ${guideline.frequency}`);
    console.log('');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
