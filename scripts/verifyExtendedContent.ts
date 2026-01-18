import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyContent() {
  try {
    // Find a condition that is likely to have both
    const condition = await prisma.condition.findFirst({
      where: {
        name: {
          contains: 'inguinal_hernia',
          mode: 'insensitive',
        },
      },
      include: {
        AnatomyStructure: true,
        SpecialTest: true,
      },
    });

    if (!condition) {
      console.log('Condition "Appendicitis" not found.');
      return;
    }

    console.log(`\nVerifying content for: ${condition.name} (${condition.id})`);

    console.log('\n--- Anatomy ---');
    if (condition.AnatomyStructure.length > 0) {
      condition.AnatomyStructure.forEach((a) => {
        console.log(`- Structure: ${a.name}`);
        console.log(`  Description: ${a.description ? a.description.substring(0, 100) : 'N/A'}...`);
        // console.log(`  Label: ${a.label}`);
      });
    } else {
      console.log('No anatomy found.');
    }

    console.log('\n--- Special Tests ---');
    if (condition.SpecialTest.length > 0) {
      condition.SpecialTest.forEach((t) => {
        console.log(`- Test: ${t.name}`);
        console.log(`  Description: ${t.description ? t.description.substring(0, 100) : 'N/A'}...`);
        console.log(`  Findings: ${t.interpretation}`);
      });
    } else {
      console.log('No special tests found.');
    }
  } catch (error) {
    console.error('Error verifying content:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyContent();
