import { prisma, disconnect } from '../_shared/db';

async function main() {
  // Check a few MedicalContent records
  const sample = await prisma.medicalContent.findFirst({
    select: {
      condition: true,
      overview: true,
      gold_standard_dx: true,
      first_line_rx: true,
      best_initial_test: true,
    },
  });
  console.log('Sample MedicalContent:', JSON.stringify(sample, null, 2));

  // Count nulls
  const total = await prisma.medicalContent.count();
  const missingOverview = await prisma.medicalContent.count({ where: { overview: null } });
  const missingGold = await prisma.medicalContent.count({ where: { gold_standard_dx: null } });
  const missingFirstLine = await prisma.medicalContent.count({ where: { first_line_rx: null } });
  const missingBestTest = await prisma.medicalContent.count({ where: { best_initial_test: null } });

  console.log(`Total MedicalContent: ${total}`);
  console.log(`Missing overview: ${missingOverview}`);
  console.log(`Missing gold_standard_dx: ${missingGold}`);
  console.log(`Missing first_line_rx: ${missingFirstLine}`);
  console.log(`Missing best_initial_test: ${missingBestTest}`);

  // Check drugs
  const drugSample = await prisma.drug.findFirst({
    select: {
      genericName: true,
      mechanismOfAction: true,
      dosing: true,
      brandName: true,
      sideEffects: true,
      indications: true,
    },
  });
  console.log('Sample Drug:', JSON.stringify(drugSample, null, 2));

  const totalDrugs = await prisma.drug.count();
  const missingMoa = await prisma.drug.count({ where: { mechanismOfAction: null } });
  const missingDosing = await prisma.drug.count({ where: { dosing: null } });
  const missingBrand = await prisma.drug.count({ where: { brandName: null } });
  const emptySideEffects = await prisma.drug.count({ where: { sideEffects: { isEmpty: true } } });
  const emptyIndications = await prisma.drug.count({ where: { indications: { isEmpty: true } } });

  console.log(`Total Drugs: ${totalDrugs}`);
  console.log(`Missing mechanismOfAction: ${missingMoa}`);
  console.log(`Missing dosing: ${missingDosing}`);
  console.log(`Missing brandName: ${missingBrand}`);
  console.log(`Empty sideEffects array: ${emptySideEffects}`);
  console.log(`Empty indications array: ${emptyIndications}`);
}

main()
  .catch(console.error)
  .finally(() => disconnect());