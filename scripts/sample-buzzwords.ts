import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function sampleBuzzwords() {
  const samples = await prisma.medicalContent.findMany({
    where: {
      conditionId: {
        in: [
          'CV__pulmonary_vascular_disease__pulmonary_embolism_pe',
          'PULM__upper_airway_emergency__acute_epiglottitis',
          'GI__large_bowel_acute_abdomen__appendicitis',
          'ID__cardiovascular_infections__infective_endocarditis',
          'HEENT__eye_vision_systemic__giant_cell_arteritis_temporal_arteritis',
        ],
      },
    },
    select: {
      condition: true,
      buzzwords: true,
    },
  });

  console.log('\n🔑 Sample Buzzwords:\n');
  samples.forEach((s) => {
    console.log(`📋 ${s.condition}:`);
    s.buzzwords.forEach((bw: string) => console.log(`   • ${bw}`));
    console.log('');
  });

  await prisma.$disconnect();
}

sampleBuzzwords().catch(console.error);
