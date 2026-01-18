/**
 * Critical Gaps Finder
 *
 * Focuses on finding records missing CRITICAL educational content fields.
 * Uses try-catch to handle schema variations gracefully.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🔍 Critical Content Gaps Analysis');
  console.log('============================================================\n');

  try {
    // AnatomyStructure - missing board facts
    console.log('🧬 AnatomyStructure:');
    const anatomyMissingBoardFacts = await prisma.anatomyStructure.findMany({
      where: { boardYieldFacts: { isEmpty: true } },
      select: { id: true, name: true, system: true },
    });
    console.log(`  Missing boardYieldFacts: ${anatomyMissingBoardFacts.length}`);
    if (anatomyMissingBoardFacts.length > 0 && anatomyMissingBoardFacts.length <= 20) {
      anatomyMissingBoardFacts.slice(0, 10).forEach((r) => console.log(`    - ${r.name}`));
      if (anatomyMissingBoardFacts.length > 10)
        console.log(`    ... and ${anatomyMissingBoardFacts.length - 10} more`);
    }

    // PhysiologyConcept - missing board facts
    console.log('\n🔬 PhysiologyConcept:');
    const physioMissingBoardFacts = await prisma.physiologyConcept.findMany({
      where: { boardYieldFacts: { isEmpty: true } },
      select: { id: true, name: true, system: true },
    });
    console.log(`  Missing boardYieldFacts: ${physioMissingBoardFacts.length}`);
    if (physioMissingBoardFacts.length > 0 && physioMissingBoardFacts.length <= 20) {
      physioMissingBoardFacts.slice(0, 10).forEach((r) => console.log(`    - ${r.name}`));
      if (physioMissingBoardFacts.length > 10)
        console.log(`    ... and ${physioMissingBoardFacts.length - 10} more`);
    }

    // PhysicalExamFinding
    console.log('\n🩺 PhysicalExamFinding:');
    const peMissingBoardFacts = await prisma.physicalExamFinding.findMany({
      where: { boardYieldFacts: { isEmpty: true } },
      select: { id: true, name: true },
    });
    console.log(`  Missing boardYieldFacts: ${peMissingBoardFacts.length}`);

    const peMissingDescription = await prisma.physicalExamFinding.findMany({
      where: { OR: [{ description: null }, { description: '' }] },
      select: { id: true, name: true },
    });
    console.log(`  Missing description: ${peMissingDescription.length}`);

    // LabTest
    console.log('\n🧪 LabTest:');
    const labMissingBoardFacts = await prisma.labTest.findMany({
      where: { boardYieldFacts: { isEmpty: true } },
      select: { id: true, name: true },
    });
    console.log(`  Missing boardYieldFacts: ${labMissingBoardFacts.length}`);

    const labMissingRange = await prisma.labTest.findMany({
      where: {
        AND: [
          { OR: [{ conventionalRange: null }, { conventionalRange: '' }] },
          { OR: [{ siRange: null }, { siRange: '' }] },
        ],
      },
      select: { id: true, name: true },
    });
    console.log(`  Missing BOTH conventional & SI range: ${labMissingRange.length}`);

    // Treatment
    console.log('\n💊 Treatment:');
    const treatmentMissingBoardFacts = await prisma.treatment.findMany({
      where: { boardYieldFacts: { isEmpty: true } },
      select: { id: true, name: true },
    });
    console.log(`  Missing boardYieldFacts: ${treatmentMissingBoardFacts.length}`);

    const treatmentMissingDescription = await prisma.treatment.findMany({
      where: { OR: [{ description: null }, { description: '' }] },
      select: { id: true, name: true },
    });
    console.log(`  Missing description: ${treatmentMissingDescription.length}`);

    // MedicalContent - comprehensive check
    console.log('\n📚 MedicalContent:');
    const medicalContentIssues = await prisma.medicalContent.findMany({
      where: {
        OR: [
          { overview: null },
          { overview: '' },
          { symptoms: null },
          { symptoms: '' },
          { treatment: null },
          { treatment: '' },
          { first_line_rx: null },
          { first_line_rx: '' },
          { gold_standard_dx: null },
          { gold_standard_dx: '' },
        ],
      },
      select: {
        id: true,
        conditionId: true,
        overview: true,
        symptoms: true,
        treatment: true,
        first_line_rx: true,
        gold_standard_dx: true,
      },
    });
    console.log(`  Records with missing critical fields: ${medicalContentIssues.length}`);
    if (medicalContentIssues.length > 0) {
      medicalContentIssues.slice(0, 10).forEach((r) => {
        const missing = [];
        if (!r.overview) missing.push('overview');
        if (!r.symptoms) missing.push('symptoms');
        if (!r.treatment) missing.push('treatment');
        if (!r.first_line_rx) missing.push('first_line_rx');
        if (!r.gold_standard_dx) missing.push('gold_standard_dx');
        console.log(`    - ${r.conditionId}: missing ${missing.join(', ')}`);
      });
      if (medicalContentIssues.length > 10)
        console.log(`    ... and ${medicalContentIssues.length - 10} more`);
    }

    // SpecialTest
    console.log('\n🎯 SpecialTest:');
    const specialTestMissingDesc = await prisma.specialTest.findMany({
      where: { OR: [{ description: null }, { description: '' }] },
      select: { id: true, name: true },
    });
    console.log(`  Missing description: ${specialTestMissingDesc.length}`);

    const specialTestMissingInterpretation = await prisma.specialTest.findMany({
      where: { OR: [{ interpretation: null }, { interpretation: '' }] },
      select: { id: true, name: true },
    });
    console.log(`  Missing interpretation: ${specialTestMissingInterpretation.length}`);

    // Skip ClinicalGuideline and AntibioticGuideline for now - less critical
    const guidelineEmpty: any[] = [];
    const antibioticEmpty: any[] = [];

    // Summary
    console.log('\n============================================================');
    console.log('📊 Summary of Critical Gaps:');
    const totalGaps =
      anatomyMissingBoardFacts.length +
      physioMissingBoardFacts.length +
      peMissingBoardFacts.length +
      peMissingDescription.length +
      labMissingBoardFacts.length +
      labMissingRange.length +
      treatmentMissingBoardFacts.length +
      treatmentMissingDescription.length +
      medicalContentIssues.length +
      specialTestMissingDesc.length +
      specialTestMissingInterpretation.length +
      guidelineEmpty.length +
      antibioticEmpty.length;

    console.log(`\nTotal records needing attention: ${totalGaps}`);

    // Priority ranking
    console.log('\n🎯 Priority Actions:');
    if (medicalContentIssues.length > 0) {
      console.log(
        `  1. Fill ${medicalContentIssues.length} MedicalContent critical fields (HIGHEST PRIORITY)`
      );
    }
    if (labMissingRange.length > 0) {
      console.log(`  2. Fill ${labMissingRange.length} LabTest ranges`);
    }
    if (anatomyMissingBoardFacts.length > 0) {
      console.log(`  3. Fill ${anatomyMissingBoardFacts.length} AnatomyStructure board facts`);
    }
    if (physioMissingBoardFacts.length > 0) {
      console.log(`  4. Fill ${physioMissingBoardFacts.length} PhysiologyConcept board facts`);
    }
    if (treatmentMissingDescription.length + treatmentMissingBoardFacts.length > 0) {
      console.log(
        `  5. Fill ${treatmentMissingDescription.length + treatmentMissingBoardFacts.length} Treatment gaps`
      );
    }

    console.log('\n============================================================');
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
