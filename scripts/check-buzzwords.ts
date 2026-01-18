import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBuzzwords() {
  const total = await prisma.medicalContent.count();
  const withBuzzwords = await prisma.medicalContent.count({
    where: {
      buzzwords: {
        isEmpty: false,
      },
    },
  });

  const conditions = await prisma.medicalContent.findMany({
    where: {
      OR: [{ buzzwords: { isEmpty: true } }, { buzzwords: { has: 'NONE' } }],
    },
    select: {
      conditionId: true,
      condition: true,
      system: true,
      buzzwords: true,
    },
  });

  console.log('\n📊 Buzzwords Coverage:');
  console.log(`  Total conditions: ${total}`);
  console.log(`  With buzzwords: ${withBuzzwords} (${Math.round((withBuzzwords / total) * 100)}%)`);
  console.log(`\nFound ${conditions.length} conditions missing buzzwords:\n`);

  if (conditions.length > 0) {
    conditions.slice(0, 20).forEach((c) => {
      console.log(`  • ${c.system}::${c.conditionId}`);
    });
    if (conditions.length > 20) {
      console.log(`  ... and ${conditions.length - 20} more`);
    }
  }

  await prisma.$disconnect();
}

checkBuzzwords().catch(console.error);
