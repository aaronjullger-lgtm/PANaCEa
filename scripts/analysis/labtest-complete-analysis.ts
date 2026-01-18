/**
 * Complete LabTest Table Analysis
 *
 * Analyzes EVERY field in LabTest table for completeness
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🧪 Complete LabTest Table Analysis');
  console.log('============================================================\n');

  const total = await prisma.labTest.count();
  console.log(`Total LabTest records: ${total}\n`);

  // String fields that should be filled
  console.log('📝 String Fields:');
  const missingTypicalUse = await prisma.labTest.count({
    where: { OR: [{ typicalUse: null }, { typicalUse: '' }] },
  });
  console.log(
    `  typicalUse: ${missingTypicalUse}/${total} missing (${((missingTypicalUse / total) * 100).toFixed(1)}%)`
  );

  const missingConventionalRange = await prisma.labTest.count({
    where: { OR: [{ conventionalRange: null }, { conventionalRange: '' }] },
  });
  console.log(
    `  conventionalRange: ${missingConventionalRange}/${total} missing (${((missingConventionalRange / total) * 100).toFixed(1)}%)`
  );

  const missingSiRange = await prisma.labTest.count({
    where: { OR: [{ siRange: null }, { siRange: '' }] },
  });
  console.log(
    `  siRange: ${missingSiRange}/${total} missing (${((missingSiRange / total) * 100).toFixed(1)}%)`
  );

  const missingUnits = await prisma.labTest.count({
    where: { OR: [{ units: null }, { units: '' }] },
  });
  console.log(
    `  units: ${missingUnits}/${total} missing (${((missingUnits / total) * 100).toFixed(1)}%)`
  );

  const missingSiUnits = await prisma.labTest.count({
    where: { OR: [{ siUnits: null }, { siUnits: '' }] },
  });
  console.log(
    `  siUnits: ${missingSiUnits}/${total} missing (${((missingSiUnits / total) * 100).toFixed(1)}%)`
  );

  const missingCollectionTube = await prisma.labTest.count({
    where: { OR: [{ collectionTube: null }, { collectionTube: '' }] },
  });
  console.log(
    `  collectionTube: ${missingCollectionTube}/${total} missing (${((missingCollectionTube / total) * 100).toFixed(1)}%)`
  );

  const missingSampleType = await prisma.labTest.count({
    where: { OR: [{ sampleType: null }, { sampleType: '' }] },
  });
  console.log(
    `  sampleType: ${missingSampleType}/${total} missing (${((missingSampleType / total) * 100).toFixed(1)}%)`
  );

  const missingInterpretationSteps = await prisma.labTest.count({
    where: { OR: [{ interpretationSteps: null }, { interpretationSteps: '' }] },
  });
  console.log(
    `  interpretationSteps: ${missingInterpretationSteps}/${total} missing (${((missingInterpretationSteps / total) * 100).toFixed(1)}%)`
  );

  const missingFalsePosNeg = await prisma.labTest.count({
    where: { OR: [{ falsePosNeg: null }, { falsePosNeg: '' }] },
  });
  console.log(
    `  falsePosNeg: ${missingFalsePosNeg}/${total} missing (${((missingFalsePosNeg / total) * 100).toFixed(1)}%)`
  );

  // Array fields
  console.log('\n📚 Array Fields:');
  const missingCommonAbnormalities = await prisma.labTest.count({
    where: { commonAbnormalities: { isEmpty: true } },
  });
  console.log(
    `  commonAbnormalities: ${missingCommonAbnormalities}/${total} missing (${((missingCommonAbnormalities / total) * 100).toFixed(1)}%)`
  );

  const missingIncreaseIndicates = await prisma.labTest.count({
    where: { increaseIndicates: { isEmpty: true } },
  });
  console.log(
    `  increaseIndicates: ${missingIncreaseIndicates}/${total} missing (${((missingIncreaseIndicates / total) * 100).toFixed(1)}%)`
  );

  const missingDecreaseIndicates = await prisma.labTest.count({
    where: { decreaseIndicates: { isEmpty: true } },
  });
  console.log(
    `  decreaseIndicates: ${missingDecreaseIndicates}/${total} missing (${((missingDecreaseIndicates / total) * 100).toFixed(1)}%)`
  );

  const missingClinicalPearls = await prisma.labTest.count({
    where: { clinicalPearls: { isEmpty: true } },
  });
  console.log(
    `  clinicalPearls: ${missingClinicalPearls}/${total} missing (${((missingClinicalPearls / total) * 100).toFixed(1)}%)`
  );

  const missingBoardYieldFacts = await prisma.labTest.count({
    where: { boardYieldFacts: { isEmpty: true } },
  });
  console.log(
    `  boardYieldFacts: ${missingBoardYieldFacts}/${total} missing (${((missingBoardYieldFacts / total) * 100).toFixed(1)}%)`
  );

  const missingTestQuestionTips = await prisma.labTest.count({
    where: { testQuestionTips: { isEmpty: true } },
  });
  console.log(
    `  testQuestionTips: ${missingTestQuestionTips}/${total} missing (${((missingTestQuestionTips / total) * 100).toFixed(1)}%)`
  );

  const missingCommonMistakes = await prisma.labTest.count({
    where: { commonMistakes: { isEmpty: true } },
  });
  console.log(
    `  commonMistakes: ${missingCommonMistakes}/${total} missing (${((missingCommonMistakes / total) * 100).toFixed(1)}%)`
  );

  const missingMnemonics = await prisma.labTest.count({ where: { mnemonics: { isEmpty: true } } });
  console.log(
    `  mnemonics: ${missingMnemonics}/${total} missing (${((missingMnemonics / total) * 100).toFixed(1)}%)`
  );

  const missingWhenToOrder = await prisma.labTest.count({
    where: { whenToOrder: { isEmpty: true } },
  });
  console.log(
    `  whenToOrder: ${missingWhenToOrder}/${total} missing (${((missingWhenToOrder / total) * 100).toFixed(1)}%)`
  );

  const missingInterferingFactors = await prisma.labTest.count({
    where: { interferingFactors: { isEmpty: true } },
  });
  console.log(
    `  interferingFactors: ${missingInterferingFactors}/${total} missing (${((missingInterferingFactors / total) * 100).toFixed(1)}%)`
  );

  const missingRelatedTests = await prisma.labTest.count({
    where: { relatedTests: { isEmpty: true } },
  });
  console.log(
    `  relatedTests: ${missingRelatedTests}/${total} missing (${((missingRelatedTests / total) * 100).toFixed(1)}%)`
  );

  const missingFollowUpTests = await prisma.labTest.count({
    where: { followUpTests: { isEmpty: true } },
  });
  console.log(
    `  followUpTests: ${missingFollowUpTests}/${total} missing (${((missingFollowUpTests / total) * 100).toFixed(1)}%)`
  );

  // Numeric fields
  console.log('\n🔢 Numeric Fields:');
  const missingConversionFactor = await prisma.labTest.count({ where: { conversionFactor: null } });
  console.log(
    `  conversionFactor: ${missingConversionFactor}/${total} missing (${((missingConversionFactor / total) * 100).toFixed(1)}%)`
  );

  const missingPanceYield = await prisma.labTest.count({ where: { panceYield: null } });
  console.log(
    `  panceYield: ${missingPanceYield}/${total} missing (${((missingPanceYield / total) * 100).toFixed(1)}%)`
  );

  // Summary
  console.log('\n============================================================');
  console.log('🎯 Priority Gaps to Fill (>50% missing):');

  const gaps = [
    { field: 'boardYieldFacts', count: missingBoardYieldFacts, type: 'array' },
    { field: 'conventionalRange', count: missingConventionalRange, type: 'string' },
    { field: 'siRange', count: missingSiRange, type: 'string' },
    { field: 'units', count: missingUnits, type: 'string' },
    { field: 'siUnits', count: missingSiUnits, type: 'string' },
    { field: 'testQuestionTips', count: missingTestQuestionTips, type: 'array' },
    { field: 'commonMistakes', count: missingCommonMistakes, type: 'array' },
    { field: 'interpretationSteps', count: missingInterpretationSteps, type: 'string' },
    { field: 'whenToOrder', count: missingWhenToOrder, type: 'array' },
    { field: 'interferingFactors', count: missingInterferingFactors, type: 'array' },
  ];

  const criticalGaps = gaps.filter((g) => g.count / total > 0.5).sort((a, b) => b.count - a.count);

  if (criticalGaps.length > 0) {
    criticalGaps.forEach((gap) => {
      console.log(
        `  ${gap.field}: ${gap.count} (${((gap.count / total) * 100).toFixed(1)}%) [${gap.type}]`
      );
    });
  }

  await prisma.$disconnect();
}

main();
