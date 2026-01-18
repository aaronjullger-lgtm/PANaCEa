/**
 * Comprehensive Table Analyzer
 *
 * Analyzes each medical content table completely - checking ALL fields for:
 * - NULL values
 * - Empty strings
 * - Empty arrays
 * - Records with minimal/incomplete data
 *
 * Goes table-by-table for thorough analysis.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TableStats {
  totalRecords: number;
  emptyFields: { [field: string]: number };
  recordsWithIssues: number;
}

async function analyzeAnatomyStructure(): Promise<TableStats> {
  console.log('\n🧬 Analyzing AnatomyStructure...');

  const total = await prisma.anatomyStructure.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  // Check each optional/array field that exists in schema
  stats.emptyFields.function = await prisma.anatomyStructure.count({
    where: { OR: [{ function: null }, { function: '' }] },
  });
  stats.emptyFields.innervation = await prisma.anatomyStructure.count({
    where: { OR: [{ innervation: null }, { innervation: '' }] },
  });
  stats.emptyFields.bloodSupply = await prisma.anatomyStructure.count({
    where: { OR: [{ bloodSupply: null }, { bloodSupply: '' }] },
  });
  stats.emptyFields.clinicalSignificance = await prisma.anatomyStructure.count({
    where: { OR: [{ clinicalSignificance: null }, { clinicalSignificance: '' }] },
  });
  stats.emptyFields.description = await prisma.anatomyStructure.count({
    where: { OR: [{ description: null }, { description: '' }] },
  });
  stats.emptyFields.clinicalPearls = await prisma.anatomyStructure.count({
    where: { clinicalPearls: { isEmpty: true } },
  });
  stats.emptyFields.mnemonics = await prisma.anatomyStructure.count({
    where: { mnemonics: { isEmpty: true } },
  });
  stats.emptyFields.boardYieldFacts = await prisma.anatomyStructure.count({
    where: { boardYieldFacts: { isEmpty: true } },
  });
  stats.emptyFields.testQuestionTips = await prisma.anatomyStructure.count({
    where: { testQuestionTips: { isEmpty: true } },
  });
  stats.emptyFields.commonMistakes = await prisma.anatomyStructure.count({
    where: { commonMistakes: { isEmpty: true } },
  });
  stats.emptyFields.origin = await prisma.anatomyStructure.count({
    where: { OR: [{ origin: null }, { origin: '' }] },
  });
  stats.emptyFields.insertion = await prisma.anatomyStructure.count({
    where: { OR: [{ insertion: null }, { insertion: '' }] },
  });
  stats.emptyFields.motorFunction = await prisma.anatomyStructure.count({
    where: { OR: [{ motorFunction: null }, { motorFunction: '' }] },
  });

  stats.recordsWithIssues = await prisma.anatomyStructure.count({
    where: {
      OR: [
        { function: null },
        { function: '' },
        { description: null },
        { description: '' },
        { clinicalSignificance: null },
        { clinicalSignificance: '' },
        { clinicalPearls: { isEmpty: true } },
        { boardYieldFacts: { isEmpty: true } },
      ],
    },
  });

  return stats;
}

async function analyzePhysiologyConcept(): Promise<TableStats> {
  console.log('\n🔬 Analyzing PhysiologyConcept...');

  const total = await prisma.physiologyConcept.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  stats.emptyFields.mechanism = await prisma.physiologyConcept.count({
    where: { OR: [{ mechanism: null }, { mechanism: '' }] },
  });
  stats.emptyFields.clinicalSignificance = await prisma.physiologyConcept.count({
    where: { OR: [{ clinicalSignificance: null }, { clinicalSignificance: '' }] },
  });
  stats.emptyFields.normalValues = await prisma.physiologyConcept.count({
    where: { OR: [{ normalValues: null }, { normalValues: '' }] },
  });
  stats.emptyFields.pathophysiology = await prisma.physiologyConcept.count({
    where: { OR: [{ pathophysiology: null }, { pathophysiology: '' }] },
  });
  stats.emptyFields.clinicalPearls = await prisma.physiologyConcept.count({
    where: { clinicalPearls: { isEmpty: true } },
  });
  stats.emptyFields.mnemonics = await prisma.physiologyConcept.count({
    where: { mnemonics: { isEmpty: true } },
  });
  stats.emptyFields.relatedConditions = await prisma.physiologyConcept.count({
    where: { relatedConditions: { isEmpty: true } },
  });
  stats.emptyFields.relatedDrugs = await prisma.physiologyConcept.count({
    where: { relatedDrugs: { isEmpty: true } },
  });
  stats.emptyFields.boardYieldFacts = await prisma.physiologyConcept.count({
    where: { boardYieldFacts: { isEmpty: true } },
  });
  stats.emptyFields.testQuestionTips = await prisma.physiologyConcept.count({
    where: { testQuestionTips: { isEmpty: true } },
  });
  stats.emptyFields.commonMistakes = await prisma.physiologyConcept.count({
    where: { commonMistakes: { isEmpty: true } },
  });

  stats.recordsWithIssues = await prisma.physiologyConcept.count({
    where: {
      OR: [
        { mechanism: null },
        { mechanism: '' },
        { clinicalSignificance: null },
        { clinicalSignificance: '' },
        { clinicalPearls: { isEmpty: true } },
        { boardYieldFacts: { isEmpty: true } },
      ],
    },
  });

  return stats;
}

async function analyzePhysicalExamFinding(): Promise<TableStats> {
  console.log('\n🩺 Analyzing PhysicalExamFinding...');

  const total = await prisma.physicalExamFinding.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  stats.emptyFields.description = await prisma.physicalExamFinding.count({
    where: { OR: [{ description: null }, { description: '' }] },
  });
  stats.emptyFields.howToElicit = await prisma.physicalExamFinding.count({
    where: { OR: [{ howToElicit: null }, { howToElicit: '' }] },
  });
  stats.emptyFields.clinicalSignificance = await prisma.physicalExamFinding.count({
    where: { OR: [{ clinicalSignificance: null }, { clinicalSignificance: '' }] },
  });
  stats.emptyFields.sensitivity = await prisma.physicalExamFinding.count({
    where: { sensitivity: null },
  });
  stats.emptyFields.specificity = await prisma.physicalExamFinding.count({
    where: { specificity: null },
  });
  stats.emptyFields.positiveIndicates = await prisma.physicalExamFinding.count({
    where: { positiveIndicates: { isEmpty: true } },
  });
  stats.emptyFields.clinicalPearls = await prisma.physicalExamFinding.count({
    where: { clinicalPearls: { isEmpty: true } },
  });
  stats.emptyFields.mnemonics = await prisma.physicalExamFinding.count({
    where: { mnemonics: { isEmpty: true } },
  });
  stats.emptyFields.boardYieldFacts = await prisma.physicalExamFinding.count({
    where: { boardYieldFacts: { isEmpty: true } },
  });
  stats.emptyFields.testQuestionTips = await prisma.physicalExamFinding.count({
    where: { testQuestionTips: { isEmpty: true } },
  });
  stats.emptyFields.commonMistakes = await prisma.physicalExamFinding.count({
    where: { commonMistakes: { isEmpty: true } },
  });

  stats.recordsWithIssues = await prisma.physicalExamFinding.count({
    where: {
      OR: [
        { description: null },
        { description: '' },
        { howToElicit: null },
        { howToElicit: '' },
        { clinicalPearls: { isEmpty: true } },
        { boardYieldFacts: { isEmpty: true } },
      ],
    },
  });

  return stats;
}

async function analyzeLabTest(): Promise<TableStats> {
  console.log('\n🧪 Analyzing LabTest...');

  const total = await prisma.labTest.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  // Check valid fields that exist on LabTest model
  stats.emptyFields.typicalUse = await prisma.labTest.count({
    where: { OR: [{ typicalUse: null }, { typicalUse: '' }] },
  });
  stats.emptyFields.units = await prisma.labTest.count({
    where: { OR: [{ units: null }, { units: '' }] },
  });
  stats.emptyFields.clinicalPearls = await prisma.labTest.count({
    where: { clinicalPearls: { isEmpty: true } },
  });
  stats.emptyFields.boardYieldFacts = await prisma.labTest.count({
    where: { boardYieldFacts: { isEmpty: true } },
  });
  stats.emptyFields.testQuestionTips = await prisma.labTest.count({
    where: { testQuestionTips: { isEmpty: true } },
  });
  stats.emptyFields.commonMistakes = await prisma.labTest.count({
    where: { commonMistakes: { isEmpty: true } },
  });
  stats.emptyFields.increaseIndicates = await prisma.labTest.count({
    where: { increaseIndicates: { isEmpty: true } },
  });
  stats.emptyFields.decreaseIndicates = await prisma.labTest.count({
    where: { decreaseIndicates: { isEmpty: true } },
  });

  stats.recordsWithIssues = await prisma.labTest.count({
    where: {
      OR: [
        { typicalUse: null },
        { typicalUse: '' },
        { clinicalPearls: { isEmpty: true } },
        { boardYieldFacts: { isEmpty: true } },
      ],
    },
  });

  return stats;
}

async function analyzeTreatment(): Promise<TableStats> {
  console.log('\n💊 Analyzing Treatment...');

  const total = await prisma.treatment.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  // Check valid fields that exist on Treatment model
  stats.emptyFields.description = await prisma.treatment.count({
    where: { OR: [{ description: null }, { description: '' }] },
  });
  stats.emptyFields.recommendation = await prisma.treatment.count({
    where: { OR: [{ recommendation: null }, { recommendation: '' }] },
  });
  stats.emptyFields.duration = await prisma.treatment.count({
    where: { OR: [{ duration: null }, { duration: '' }] },
  });
  stats.emptyFields.contraindications = await prisma.treatment.count({
    where: { contraindications: { isEmpty: true } },
  });
  stats.emptyFields.complications = await prisma.treatment.count({
    where: { complications: { isEmpty: true } },
  });
  stats.emptyFields.clinicalPearls = await prisma.treatment.count({
    where: { clinicalPearls: { isEmpty: true } },
  });
  stats.emptyFields.boardYieldFacts = await prisma.treatment.count({
    where: { boardYieldFacts: { isEmpty: true } },
  });
  stats.emptyFields.commonMistakes = await prisma.treatment.count({
    where: { commonMistakes: { isEmpty: true } },
  });

  stats.recordsWithIssues = await prisma.treatment.count({
    where: {
      OR: [
        { description: null },
        { description: '' },
        { clinicalPearls: { isEmpty: true } },
        { boardYieldFacts: { isEmpty: true } },
      ],
    },
  });

  return stats;
}

async function analyzeMedicalContent(): Promise<TableStats> {
  console.log('\n📚 Analyzing MedicalContent...');

  const total = await prisma.medicalContent.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  stats.emptyFields.overview = await prisma.medicalContent.count({
    where: { OR: [{ overview: null }, { overview: '' }] },
  });
  stats.emptyFields.epidemiology = await prisma.medicalContent.count({
    where: { OR: [{ epidemiology: null }, { epidemiology: '' }] },
  });
  stats.emptyFields.etiology = await prisma.medicalContent.count({
    where: { OR: [{ etiology: null }, { etiology: '' }] },
  });
  stats.emptyFields.pathophysiology = await prisma.medicalContent.count({
    where: { OR: [{ pathophysiology: null }, { pathophysiology: '' }] },
  });
  stats.emptyFields.symptoms = await prisma.medicalContent.count({
    where: { OR: [{ symptoms: null }, { symptoms: '' }] },
  });
  stats.emptyFields.physicalExam = await prisma.medicalContent.count({
    where: { OR: [{ physicalExam: null }, { physicalExam: '' }] },
  });
  stats.emptyFields.diagnostics = await prisma.medicalContent.count({
    where: { OR: [{ diagnostics: null }, { diagnostics: '' }] },
  });
  stats.emptyFields.treatment = await prisma.medicalContent.count({
    where: { OR: [{ treatment: null }, { treatment: '' }] },
  });
  stats.emptyFields.complications = await prisma.medicalContent.count({
    where: { OR: [{ complications: null }, { complications: '' }] },
  });
  stats.emptyFields.prognosis = await prisma.medicalContent.count({
    where: { OR: [{ prognosis: null }, { prognosis: '' }] },
  });
  stats.emptyFields.mnemonic = await prisma.medicalContent.count({
    where: { OR: [{ mnemonic: null }, { mnemonic: '' }] },
  });
  stats.emptyFields.clinical_pearls = await prisma.medicalContent.count({
    where: { clinical_pearls: { equals: null } },
  });
  stats.emptyFields.differentials = await prisma.medicalContent.count({
    where: { differentials: { equals: null } },
  });
  stats.emptyFields.classic_triad = await prisma.medicalContent.count({
    where: { classic_triad: { equals: null } },
  });
  stats.emptyFields.first_line_rx = await prisma.medicalContent.count({
    where: { OR: [{ first_line_rx: null }, { first_line_rx: '' }] },
  });
  stats.emptyFields.gold_standard_dx = await prisma.medicalContent.count({
    where: { OR: [{ gold_standard_dx: null }, { gold_standard_dx: '' }] },
  });
  stats.emptyFields.best_initial_test = await prisma.medicalContent.count({
    where: { OR: [{ best_initial_test: null }, { best_initial_test: '' }] },
  });

  stats.recordsWithIssues = await prisma.medicalContent.count({
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
      ],
    },
  });

  return stats;
}

async function analyzeSpecialTest(): Promise<TableStats> {
  console.log('\n🎯 Analyzing SpecialTest...');

  const total = await prisma.specialTest.count();
  const stats: TableStats = { totalRecords: total, emptyFields: {}, recordsWithIssues: 0 };

  // Check valid fields that exist on SpecialTest model
  stats.emptyFields.description = await prisma.specialTest.count({
    where: { OR: [{ description: null }, { description: '' }] },
  });
  stats.emptyFields.technique = await prisma.specialTest.count({
    where: { OR: [{ technique: null }, { technique: '' }] },
  });
  stats.emptyFields.interpretation = await prisma.specialTest.count({
    where: { OR: [{ interpretation: null }, { interpretation: '' }] },
  });
  stats.emptyFields.sensitivity = await prisma.specialTest.count({ where: { sensitivity: null } });
  stats.emptyFields.specificity = await prisma.specialTest.count({ where: { specificity: null } });

  stats.recordsWithIssues = await prisma.specialTest.count({
    where: {
      OR: [
        { description: null },
        { description: '' },
        { technique: null },
        { technique: '' },
        { interpretation: null },
        { interpretation: '' },
      ],
    },
  });

  return stats;
}

function printTableStats(tableName: string, stats: TableStats) {
  console.log(`\n📊 ${tableName} Summary:`);
  console.log(`  Total Records: ${stats.totalRecords}`);
  console.log(
    `  Records with Issues: ${stats.recordsWithIssues} (${((stats.recordsWithIssues / stats.totalRecords) * 100).toFixed(1)}%)`
  );

  const emptyFieldEntries = Object.entries(stats.emptyFields).filter(([_, count]) => count > 0);
  if (emptyFieldEntries.length > 0) {
    console.log(`\n  Empty/Missing Fields:`);
    emptyFieldEntries
      .sort((a, b) => b[1] - a[1])
      .forEach(([field, count]) => {
        const percentage = ((count / stats.totalRecords) * 100).toFixed(1);
        console.log(`    ${field}: ${count}/${stats.totalRecords} (${percentage}%)`);
      });
  } else {
    console.log(`  ✅ All fields populated!`);
  }
}

async function main() {
  console.log('🔍 Comprehensive Table-by-Table Analysis');
  console.log('============================================================\n');

  try {
    // Analyze each table completely
    const anatomyStats = await analyzeAnatomyStructure();
    printTableStats('AnatomyStructure', anatomyStats);

    const physiologyStats = await analyzePhysiologyConcept();
    printTableStats('PhysiologyConcept', physiologyStats);

    const peStats = await analyzePhysicalExamFinding();
    printTableStats('PhysicalExamFinding', peStats);

    const labStats = await analyzeLabTest();
    printTableStats('LabTest', labStats);

    const treatmentStats = await analyzeTreatment();
    printTableStats('Treatment', treatmentStats);

    const medicalContentStats = await analyzeMedicalContent();
    printTableStats('MedicalContent', medicalContentStats);

    const specialTestStats = await analyzeSpecialTest();
    printTableStats('SpecialTest', specialTestStats);

    console.log('\n============================================================');
    console.log('✅ Comprehensive analysis complete');
  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
