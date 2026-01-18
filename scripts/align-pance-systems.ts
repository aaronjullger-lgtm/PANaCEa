#!/usr/bin/env npx tsx
/**
 * Align Database Systems with PANCE Blueprint
 *
 * Migrates all conditions to use official PANCE system names:
 * - Cardiovascular System (11%)
 * - Dermatologic System (4%)
 * - Endocrine System (6%)
 * - Eyes, Ears, Nose, and Throat (6%)
 * - Gastrointestinal System/Nutrition (8%)
 * - Genitourinary System (4%)
 * - Hematologic System (5%)
 * - Infectious Diseases (7%)
 * - Musculoskeletal System (8%)
 * - Neurologic System (7%)
 * - Psychiatry/Behavioral Science (7%)
 * - Pulmonary System (9%)
 * - Renal System (5%)
 * - Reproductive System (7%)
 */

import { prisma } from './helpers/prisma-client';

// System mapping: current name → PANCE blueprint name
const SYSTEM_MAPPING: Record<string, string> = {
  Cardiovascular: 'Cardiovascular System',
  Dermatology: 'Dermatologic System',
  Endocrine: 'Endocrine System',
  HEENT: 'Eyes, Ears, Nose, and Throat',
  Gastrointestinal: 'Gastrointestinal System/Nutrition',
  Genitourinary: 'Genitourinary System',
  Hematology: 'Hematologic System',
  'Infectious Disease': 'Infectious Diseases',
  Musculoskeletal: 'Musculoskeletal System',
  Neurological: 'Neurologic System',
  Psychiatry: 'Psychiatry/Behavioral Science',
  Pulmonary: 'Pulmonary System',
  Renal: 'Renal System',
  Reproductive: 'Reproductive System',
};

// Special handling for PEDS and OTHER conditions
// These need to be reassigned to appropriate PANCE systems
const PEDIATRIC_CONDITIONS_MAPPING: Record<string, string> = {
  // PEDS conditions go to their primary system, maintain pediatric tag via subcategory
  PEDS: 'Pediatric', // Will need manual review per condition
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🏥 Aligning Systems with PANCE Blueprint\n');
  console.log(
    dryRun
      ? '⚠️  DRY RUN MODE - No changes will be made\n'
      : '✅ LIVE MODE - Changes will be applied\n'
  );
  console.log('='.repeat(80) + '\n');

  // 1. Migrate standard system names
  await migrateStandardSystems(dryRun);

  // 2. Handle PEDS conditions
  await handlePediatricConditions(dryRun);

  // 3. Handle OTHER conditions
  await handleOtherConditions(dryRun);

  // 4. Verify final state
  await verifySystemAlignment(dryRun);

  console.log('\n' + '='.repeat(80));
  console.log(
    dryRun
      ? '\n✅ Dry run complete - run without --dry-run to apply changes'
      : '\n✅ System alignment complete!'
  );
}

async function migrateStandardSystems(dryRun: boolean) {
  console.log('📊 MIGRATING STANDARD SYSTEMS\n');

  let totalUpdated = 0;

  for (const [oldSystem, newSystem] of Object.entries(SYSTEM_MAPPING)) {
    const conditions = await prisma.condition.findMany({
      where: { system: oldSystem },
      select: { id: true },
    });

    if (conditions.length > 0) {
      console.log(`  ${oldSystem} → "${newSystem}" (${conditions.length} conditions)`);

      if (!dryRun) {
        // Update Condition table
        await prisma.condition.updateMany({
          where: { system: oldSystem },
          data: { system: newSystem },
        });

        // Update MedicalContent table
        await prisma.medicalContent.updateMany({
          where: { system: oldSystem },
          data: { system: newSystem },
        });

        totalUpdated += conditions.length;
      }
    }
  }

  console.log(`\n✅ ${dryRun ? 'Would update' : 'Updated'} ${totalUpdated} conditions`);
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function handlePediatricConditions(dryRun: boolean) {
  console.log('👶 HANDLING PEDIATRIC CONDITIONS\n');

  const pedsConditions = await prisma.condition.findMany({
    where: { system: 'PEDS' },
    select: { id: true, name: true, subcategory: true },
  });

  if (pedsConditions.length === 0) {
    console.log('✅ No PEDS conditions found');
    console.log('\n' + '-'.repeat(80) + '\n');
    return;
  }

  console.log(`Found ${pedsConditions.length} pediatric conditions:\n`);

  // Map pediatric conditions to appropriate PANCE systems based on their nature
  const pedsMapping: Record<string, { system: string; subcategory: string }> = {};

  for (const condition of pedsConditions) {
    let targetSystem = 'Pediatric Medicine'; // Default
    let targetSubcategory = condition.subcategory || 'Pediatric';

    // Determine appropriate system based on condition name/subcategory
    if (
      condition.subcategory?.includes('Cardiac') ||
      condition.name.toLowerCase().includes('heart')
    ) {
      targetSystem = 'Cardiovascular System';
      targetSubcategory = 'Congenital Heart Disease';
    } else if (
      condition.subcategory?.includes('Oncology') ||
      condition.name.toLowerCase().includes('cancer')
    ) {
      targetSystem = 'Hematologic System';
      targetSubcategory = 'Pediatric Oncology';
    } else if (condition.subcategory?.includes('Congenital')) {
      targetSystem = 'Musculoskeletal System'; // May need adjustment
      targetSubcategory = 'Congenital Disorders';
    } else if (condition.subcategory?.includes('Newborn')) {
      targetSystem = 'Reproductive System'; // Neonatal care
      targetSubcategory = 'Neonatal Disorders';
    }

    pedsMapping[condition.id] = { system: targetSystem, subcategory: targetSubcategory };
    console.log(`  • ${condition.name}`);
    console.log(`    Current: PEDS / ${condition.subcategory}`);
    console.log(`    Target: ${targetSystem} / ${targetSubcategory}`);
  }

  if (!dryRun) {
    for (const [conditionId, mapping] of Object.entries(pedsMapping)) {
      await prisma.condition.update({
        where: { id: conditionId },
        data: {
          system: mapping.system,
          subcategory: mapping.subcategory,
        },
      });

      // Update MedicalContent if exists
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { conditionId },
      });

      if (medicalContent) {
        await prisma.medicalContent.update({
          where: { conditionId },
          data: {
            system: mapping.system,
            subcategory: mapping.subcategory,
          },
        });
      }
    }
  }

  console.log(
    `\n✅ ${dryRun ? 'Would reassign' : 'Reassigned'} ${pedsConditions.length} pediatric conditions`
  );
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function handleOtherConditions(dryRun: boolean) {
  console.log('📋 HANDLING "OTHER" CONDITIONS\n');

  const otherConditions = await prisma.condition.findMany({
    where: { system: 'OTHER' },
    select: { id: true, name: true, subcategory: true },
  });

  if (otherConditions.length === 0) {
    console.log('✅ No OTHER conditions found');
    console.log('\n' + '-'.repeat(80) + '\n');
    return;
  }

  console.log(`Found ${otherConditions.length} "OTHER" conditions:\n`);

  // Map OTHER conditions to appropriate PANCE systems
  const otherMapping: Record<string, { system: string; subcategory: string }> = {};

  for (const condition of otherConditions) {
    let targetSystem = 'Gastrointestinal System/Nutrition'; // Default
    let targetSubcategory = 'General Medicine';

    const nameLower = condition.name.toLowerCase();

    // Toxicology/Poisoning → Gastrointestinal System/Nutrition
    if (
      nameLower.includes('toxicity') ||
      nameLower.includes('poisoning') ||
      nameLower.includes('overdose') ||
      nameLower.includes('ingestion')
    ) {
      targetSystem = 'Gastrointestinal System/Nutrition';
      targetSubcategory = 'Toxicology';
    }
    // Genetic/Congenital Syndromes
    else if (
      nameLower.includes('syndrome') &&
      (nameLower.includes('noonan') ||
        nameLower.includes('prader') ||
        nameLower.includes('angelman') ||
        nameLower.includes('digeorge') ||
        nameLower.includes('fragile x') ||
        nameLower.includes('klinefelter') ||
        nameLower.includes('trisomy') ||
        nameLower.includes('edwards') ||
        nameLower.includes('marfan') ||
        nameLower.includes('ehlers') ||
        nameLower.includes('sturge-weber') ||
        nameLower.includes('tuberous'))
    ) {
      targetSystem = 'Endocrine System';
      targetSubcategory = 'Genetic Disorders';
    }
    // Neurofibromatosis → Neurologic
    else if (nameLower.includes('neurofibromatosis')) {
      targetSystem = 'Neurologic System';
      targetSubcategory = 'Neurocutaneous Disorders';
    }
    // Osteogenesis Imperfecta → Musculoskeletal
    else if (nameLower.includes('osteogenesis')) {
      targetSystem = 'Musculoskeletal System';
      targetSubcategory = 'Genetic Bone Disorders';
    }
    // Neonatal conditions → Reproductive
    else if (
      nameLower.includes('hyaline membrane') ||
      nameLower.includes('meconium') ||
      nameLower.includes('necrotizing enterocolitis') ||
      nameLower.includes('sids')
    ) {
      targetSystem = 'Reproductive System';
      targetSubcategory = 'Neonatal Disorders';
    }
    // GI conditions
    else if (
      nameLower.includes('colic') ||
      nameLower.includes('encopresis') ||
      nameLower.includes('hirschsprung') ||
      nameLower.includes('dehydration')
    ) {
      targetSystem = 'Gastrointestinal System/Nutrition';
      targetSubcategory = 'Pediatric GI Disorders';
    }
    // Environmental injuries → Pulmonary or Cardiovascular
    else if (nameLower.includes('carbon monoxide')) {
      targetSystem = 'Pulmonary System';
      targetSubcategory = 'Toxicology';
    } else if (
      nameLower.includes('heat stroke') ||
      nameLower.includes('heat exhaustion') ||
      nameLower.includes('hypothermia') ||
      nameLower.includes('drowning')
    ) {
      targetSystem = 'Cardiovascular System';
      targetSubcategory = 'Environmental Emergencies';
    } else if (
      nameLower.includes('altitude') ||
      nameLower.includes('electrical') ||
      nameLower.includes('snake bite')
    ) {
      targetSystem = 'Cardiovascular System';
      targetSubcategory = 'Environmental Emergencies';
    }
    // Tuberous Sclerosis → Neurologic
    else if (nameLower.includes('tuberous sclerosis')) {
      targetSystem = 'Neurologic System';
      targetSubcategory = 'Neurocutaneous Disorders';
    }
    // Anaphylaxis → Hematologic (Immune)
    else if (nameLower.includes('anaphylaxis')) {
      targetSystem = 'Hematologic System';
      targetSubcategory = 'Immune Disorders';
    }
    // Mass Casualty → Cardiovascular (Emergency Medicine)
    else if (nameLower.includes('mass casualty') || nameLower.includes('triage')) {
      targetSystem = 'Cardiovascular System';
      targetSubcategory = 'Emergency Medicine';
    }
    // Tumor Lysis → Hematologic
    else if (nameLower.includes('tumor lysis')) {
      targetSystem = 'Hematologic System';
      targetSubcategory = 'Oncologic Complications';
    }
    // ADHD → Psychiatry
    else if (nameLower.includes('adhd') || nameLower.includes('attention deficit')) {
      targetSystem = 'Psychiatry/Behavioral Science';
      targetSubcategory = 'Neurodevelopmental Disorders';
    }
    // Failure to Thrive → GI/Nutrition
    else if (nameLower.includes('failure to thrive')) {
      targetSystem = 'Gastrointestinal System/Nutrition';
      targetSubcategory = 'Nutritional Disorders';
    }
    // Fatigue/Weakness → Endocrine (symptoms, could be many systems)
    else if (nameLower.includes('fatigue') || nameLower.includes('weakness')) {
      targetSystem = 'Endocrine System';
      targetSubcategory = 'General Symptoms';
    }
    // Psoriasis Vulva → Dermatologic
    else if (nameLower.includes('psoriasis')) {
      targetSystem = 'Dermatologic System';
      targetSubcategory = 'Papulosquamous Disorders';
    }

    otherMapping[condition.id] = { system: targetSystem, subcategory: targetSubcategory };
    console.log(`  • ${condition.name}`);
    console.log(`    Current: OTHER / ${condition.subcategory}`);
    console.log(`    Target: ${targetSystem} / ${targetSubcategory}`);
  }

  if (!dryRun) {
    for (const [conditionId, mapping] of Object.entries(otherMapping)) {
      await prisma.condition.update({
        where: { id: conditionId },
        data: {
          system: mapping.system,
          subcategory: mapping.subcategory,
        },
      });

      // Update MedicalContent if exists
      const medicalContent = await prisma.medicalContent.findUnique({
        where: { conditionId },
      });

      if (medicalContent) {
        await prisma.medicalContent.update({
          where: { conditionId },
          data: {
            system: mapping.system,
            subcategory: mapping.subcategory,
          },
        });
      }
    }
  }

  console.log(
    `\n✅ ${dryRun ? 'Would reassign' : 'Reassigned'} ${otherConditions.length} "OTHER" conditions`
  );
  console.log('\n' + '-'.repeat(80) + '\n');
}

async function verifySystemAlignment(dryRun: boolean) {
  console.log('✅ VERIFICATION\n');

  const systems = await prisma.condition.groupBy({
    by: ['system'],
    _count: true,
    orderBy: { system: 'asc' },
  });

  const panceBlueprint = [
    'Cardiovascular System',
    'Dermatologic System',
    'Endocrine System',
    'Eyes, Ears, Nose, and Throat',
    'Gastrointestinal System/Nutrition',
    'Genitourinary System',
    'Hematologic System',
    'Infectious Diseases',
    'Musculoskeletal System',
    'Neurologic System',
    'Psychiatry/Behavioral Science',
    'Pulmonary System',
    'Renal System',
    'Reproductive System',
  ];

  console.log(dryRun ? 'Current systems:' : 'Final systems:\n');

  const systemSet = new Set(systems.map((s) => s.system));
  const alignedSystems = systems.filter((s) => panceBlueprint.includes(s.system));
  const nonAlignedSystems = systems.filter((s) => !panceBlueprint.includes(s.system));

  if (alignedSystems.length > 0) {
    console.log('✅ PANCE-Aligned Systems:');
    alignedSystems.forEach((s) => {
      console.log(`  • ${s.system}: ${s._count} conditions`);
    });
  }

  if (nonAlignedSystems.length > 0) {
    console.log('\n⚠️  Non-PANCE Systems:');
    nonAlignedSystems.forEach((s) => {
      console.log(`  • ${s.system}: ${s._count} conditions`);
    });
  }

  console.log(
    `\n📊 Total: ${systems.reduce((sum, s) => sum + s._count, 0)} conditions across ${systems.length} systems`
  );
  console.log(
    `✅ PANCE-aligned: ${alignedSystems.reduce((sum, s) => sum + s._count, 0)} conditions`
  );

  if (nonAlignedSystems.length > 0) {
    console.log(
      `⚠️  Non-aligned: ${nonAlignedSystems.reduce((sum, s) => sum + s._count, 0)} conditions`
    );
  }

  console.log('\n' + '-'.repeat(80) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
