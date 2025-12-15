import { PrismaClient } from '@prisma/client';
import { ANATOMY_REGISTRY } from '../anatomyRegistry.ts';
import { SPECIAL_TEST_REGISTRY } from '../specialTestRegistry.ts';
import { PHYSIOLOGY_CONCEPT_REGISTRY } from '../physiologyRegistry.ts';
import { TREATMENT_REGISTRY } from '../treatmentRegistry.ts';
import { DIFFERENTIAL_REGISTRY } from '../differentialRegistry.ts';
import { IMAGING_REGISTRY } from '../imagingRegistry.ts';
import { FINDING_REGISTRY } from '../findingRegistry.ts';
import { GUIDELINE_REGISTRY } from '../guidelineRegistry.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting registry migration...');

  // Fetch all valid condition IDs to ensure we only connect to existing conditions
  const allConditionIds = new Set((await prisma.condition.findMany({ select: { id: true } })).map(c => c.id));
  console.log(`Found ${allConditionIds.size} existing conditions.`);

  // 1. Anatomy
  console.log(`Migrating ${ANATOMY_REGISTRY.length} anatomy structures...`);
  for (const item of ANATOMY_REGISTRY) {
    const validConditions = item.relatedConditions?.filter(id => allConditionIds.has(id)) || [];
    
    await prisma.anatomyStructure.upsert({
      where: { name: item.name },
      update: {
        system: item.system,
        region: item.region,
        type: item.type,
        description: item.description,
        function: item.function,
        innervation: item.innervation,
        bloodSupply: item.bloodSupply,
        clinicalSignificance: item.clinicalSignificance,
        conditions: {
          set: validConditions.map(id => ({ id }))
        }
      },
      create: {
        name: item.name,
        system: item.system,
        region: item.region,
        type: item.type,
        description: item.description,
        function: item.function,
        innervation: item.innervation,
        bloodSupply: item.bloodSupply,
        clinicalSignificance: item.clinicalSignificance,
        conditions: {
          connect: validConditions.map(id => ({ id }))
        }
      }
    });
  }

  // 2. Special Tests
  console.log(`Migrating ${SPECIAL_TEST_REGISTRY.length} special tests...`);
  for (const item of SPECIAL_TEST_REGISTRY) {
    const validConditions = item.relatedConditions?.filter(id => allConditionIds.has(id)) || [];

    await prisma.specialTest.upsert({
      where: { name: item.name },
      update: {
        displayName: item.displayName,
        aliases: item.aliases || [],
        system: item.system,
        region: item.region,
        description: item.description,
        sensitivity: item.sensitivity,
        specificity: item.specificity,
        technique: item.technique,
        positiveTest: item.positiveTest,
        interpretation: item.interpretation,
        conditions: {
          set: validConditions.map(id => ({ id }))
        }
      },
      create: {
        name: item.name,
        displayName: item.displayName,
        aliases: item.aliases || [],
        system: item.system,
        region: item.region,
        description: item.description,
        sensitivity: item.sensitivity,
        specificity: item.specificity,
        technique: item.technique,
        positiveTest: item.positiveTest,
        interpretation: item.interpretation,
        conditions: {
          connect: validConditions.map(id => ({ id }))
        }
      }
    });
  }

  // 3. Physiology Concepts
  console.log(`Migrating ${PHYSIOLOGY_CONCEPT_REGISTRY.length} physiology concepts...`);
  for (const item of PHYSIOLOGY_CONCEPT_REGISTRY) {
    await prisma.physiologyConcept.upsert({
      where: { name: item.name },
      update: {
        displayName: item.displayName,
        aliases: item.aliases || [],
        category: item.category,
        description: item.description,
        relatedConditions: item.relatedConditions || [],
        relatedDrugs: item.relatedDrugs || []
      },
      create: {
        name: item.name,
        displayName: item.displayName,
        aliases: item.aliases || [],
        category: item.category,
        description: item.description,
        relatedConditions: item.relatedConditions || [],
        relatedDrugs: item.relatedDrugs || []
      }
    });
  }

  // 4. Treatments
  console.log(`Migrating ${TREATMENT_REGISTRY.length} treatments...`);
  for (const item of TREATMENT_REGISTRY) {
    await prisma.treatment.upsert({
      where: { name: item.name },
      update: {
        displayName: item.displayName,
        aliases: item.aliases || [],
        category: item.category,
      },
      create: {
        name: item.name,
        displayName: item.displayName,
        aliases: item.aliases || [],
        category: item.category,
      }
    });
  }

  // 5. Differentials
  console.log(`Migrating ${DIFFERENTIAL_REGISTRY.length} differentials...`);
  for (const item of DIFFERENTIAL_REGISTRY) {
    await prisma.differentialDiagnosis.upsert({
      where: { presentingComplaint: item.presentingComplaint },
      update: {
        category: item.category,
        isEmergency: item.isEmergency || false,
      },
      create: {
        presentingComplaint: item.presentingComplaint,
        category: item.category,
        isEmergency: item.isEmergency || false,
      }
    });
  }

  // 6. Imaging
  console.log(`Migrating ${IMAGING_REGISTRY.length} imaging studies...`);
  for (const item of IMAGING_REGISTRY) {
    await prisma.imagingStudy.upsert({
      where: { name: item.name },
      update: {
        modality: item.modality,
        bodyRegion: item.bodyRegion,
        usesContrast: item.usesContrast || false,
        usesRadiation: item.usesRadiation || false,
      },
      create: {
        name: item.name,
        modality: item.modality,
        bodyRegion: item.bodyRegion,
        usesContrast: item.usesContrast || false,
        usesRadiation: item.usesRadiation || false,
      }
    });
  }

  // 7. Findings
  console.log(`Migrating ${FINDING_REGISTRY.length} findings...`);
  for (const item of FINDING_REGISTRY) {
    await prisma.physicalExamFinding.upsert({
      where: { name: item.name },
      update: {
        system: item.system,
      },
      create: {
        name: item.name,
        system: item.system,
      }
    });
  }

  // 8. Guidelines
  console.log(`Migrating ${GUIDELINE_REGISTRY.length} guidelines...`);
  for (const item of GUIDELINE_REGISTRY) {
    await prisma.practiceGuideline.upsert({
      where: { name: item.name },
      update: {
        organization: item.organization,
        category: item.category,
        year: item.year,
      },
      create: {
        name: item.name,
        organization: item.organization,
        category: item.category,
        year: item.year,
      }
    });
  }

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
