import { prisma, disconnectPrisma } from './helpers/prisma-client.js';

async function main() {
  const conditions = await prisma.medicalContent.findMany({
    where: {
      condition: { in: ['Patent Foramen Ovale', 'Cardiogenic Shock', 'Cellulitis'] }
    },
    select: {
      condition: true,
      overview: true,
      symptoms: true,
      treatment: true,
      diagnostics: true,
    }
  });

  conditions.forEach(c => {
    console.log(`\n${c.condition}:`);
    console.log(`  overview: ${c.overview ? 'HAS (' + c.overview.substring(0, 50) + '...)' : 'MISSING'}`);
    console.log(`  symptoms: ${c.symptoms ? JSON.stringify(c.symptoms).substring(0, 80) : 'MISSING'}`);
    console.log(`  treatment: ${c.treatment ? 'HAS (' + c.treatment.substring(0, 50) + '...)' : 'MISSING'}`);
    console.log(`  diagnostics: ${c.diagnostics ? JSON.stringify(c.diagnostics).substring(0, 80) : 'MISSING'}`);
  });
}

main().finally(() => disconnectPrisma());
