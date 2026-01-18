/**
 * COMPLETE Database Gap Analysis
 * All medical content tables - Schema-verified field names
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldGap {
  fieldName: string;
  missingCount: number;
  totalCount: number;
  percentage: string;
}

interface TableAnalysis {
  tableName: string;
  totalRecords: number;
  fieldGaps: FieldGap[];
}

// Schema-verified field definitions for ALL medical content tables
const SCHEMA_FIELDS: Record<
  string,
  { stringFields?: string[]; arrayFields?: string[]; jsonFields?: string[]; floatFields?: string[] }
> = {
  LabTest: {
    stringFields: [
      'conventionalRange',
      'clinicalScenarios',
      'typicalUse',
      'collectionTube',
      'sampleType',
      'siRange',
      'siUnits',
      'units',
      'turnaroundTime',
      'stability',
      'specialInstructions',
      'interpretationSteps',
    ],
    arrayFields: [
      'boardYieldFacts',
      'clinicalPearls',
      'commonMistakes',
      'mnemonics',
      'testQuestionTips',
      'whenToOrder',
      'increaseIndicates',
      'decreaseIndicates',
      'falsePosNeg',
      'interferingFactors',
      'followUpTests',
      'relatedTests',
      'criticalValues',
    ],
    jsonFields: ['referenceRanges'],
  },
  Drug: {
    stringFields: [
      'brandName',
      'mechanismOfAction',
      'dosing',
      'antidote',
      'clinicalNotes',
      'displayName',
      'elimination',
      'metabolism',
      'absorption',
      'administrationTips',
      'bioavailability',
      'distribution',
      'duration',
      'eliminationRoute',
      'geriatricDosing',
      'geriatricNotes',
      'halfLife',
      'hepaticDosing',
      'lactationNotes',
      'lactationSafety',
      'maxDailyDose',
      'mechanismDetailed',
      'metabolismDetail',
      'onsetOfAction',
      'peakEffect',
      'pediatricDosing',
      'pediatricNotes',
      'pregnancyCategory',
      'pregnancyNotes',
      'renalDosing',
      'reversalAgent',
      'storageRequirements',
      'toxicity',
      'typicalCost',
    ],
    arrayFields: [
      'drugClass',
      'indications',
      'contraindications',
      'tags',
      'aliases',
      'sideEffects',
      'interactions',
      'blackBoxWarnings',
      'boardYieldFacts',
      'clinicalPearls',
      'commonMistakes',
      'foodInteractions',
      'formulations',
      'mnemonics',
      'monitoringParams',
      'riskStrategies',
      'routesOfAdmin',
      'testQuestionTips',
    ],
    jsonFields: ['cyp450Effects', 'majorInteractions', 'pharmacokinetics'],
  },
  ImagingStudy: {
    stringFields: [
      'bodyRegion',
      'description',
      'allergyProtocol',
      'contrastAgent',
      'contrastType',
      'normalFindings',
      'pregnancySafety',
      'preparation',
      'protocol',
      'radiationDose',
      'renalConsiderations',
      'reportTemplate',
      'scanDuration',
    ],
    arrayFields: [
      'indications',
      'contraindications',
      'advantages',
      'alternativeTo',
      'boardYieldFacts',
      'classicSigns',
      'clinicalPearls',
      'commonMistakes',
      'firstLineFor',
      'limitations',
      'testQuestionTips',
      'whenToAvoid',
    ],
    jsonFields: ['keyFindings'],
  },
  PhysicalExamFinding: {
    stringFields: [
      'description',
      'clinicalSignificance',
      'category',
      'eponymousName',
      'evidenceQuality',
      'findingType',
      'gradingScale',
      'howToDocument',
      'howToElicit',
      'imageUrl',
      'patientPosition',
      'videoUrl',
    ],
    arrayFields: [
      'aliases',
      'associatedFindings',
      'boardYieldFacts',
      'clinicalPearls',
      'commonMistakes',
      'differentialFor',
      'equipmentNeeded',
      'mnemonics',
      'negativeIndicates',
      'normalVariants',
      'positiveIndicates',
      'testQuestionTips',
    ],
    floatFields: ['negativeLR', 'positiveLR', 'sensitivity', 'specificity'],
  },
  AnatomyStructure: {
    stringFields: [
      'region',
      'type',
      'description',
      'function',
      'innervation',
      'bloodSupply',
      'clinicalSignificance',
      'imageUrl',
      'abbreviation',
      'autonomicFunction',
      'borders',
      'dermatome',
      'diagramUrl',
      'injuryMechanism',
      'insertion',
      'latinName',
      'modelUrl',
      'motorFunction',
      'myotome',
      'nervePath',
      'nerveRoots',
      'origin',
      'palpationTips',
      'relations',
      'sensoryFunction',
      'surgicalApproach',
      'vesselPath',
      'videoUrl',
    ],
    arrayFields: [
      'aliases',
      'anastomoses',
      'attachments',
      'boardYieldFacts',
      'branches',
      'clinicalPearls',
      'commonMistakes',
      'commonPathology',
      'contents',
      'examFindings',
      'imagingFindings',
      'layers',
      'mnemonics',
      'surfaceLandmarks',
      'testQuestionTips',
      'tributaries',
    ],
  },
  DifferentialDiagnosis: {
    stringFields: ['workup', 'diagnosticAlgorithm', 'dispositionGuidance', 'typicalPresentation'],
    arrayFields: [
      'differentialList',
      'mustNotMiss',
      'clinicalPearls',
      'commonMistakes',
      'initialWorkup',
      'keyExamFindings',
      'keyQuestions',
      'mnemonics',
      'mostCommon',
      'mostDangerous',
      'oftenMissed',
      'reassuringFeatures',
      'redFlags',
    ],
    jsonFields: ['byAcuity', 'byAge', 'distinguishingFeatures'],
  },
  ECGPattern: {
    stringFields: [
      'displayName',
      'rate',
      'rhythm',
      'pWave',
      'prInterval',
      'qrsComplex',
      'qtInterval',
      'stSegment',
      'tWave',
      'pathognomonic',
      'hemodynamicEffect',
      'acuteManagement',
      'cardioversion',
      'pacing',
      'referral',
      'exampleEcgUrl',
      'annotatedEcgUrl',
    ],
    arrayFields: [
      'aliases',
      'boardYieldFacts',
      'diagnosticCriteria',
      'etiology',
      'symptoms',
      'associatedConditions',
      'medications',
      'mimics',
      'clinicalPearls',
      'commonMistakes',
      'testQuestionTips',
      'mnemonics',
      'exampleImageUrls',
      'annotatedImageUrls',
    ],
    jsonFields: ['distinguishingFeatures'],
  },
  Procedure: {
    stringFields: [
      'displayName',
      'type',
      'system',
      'description',
      'preparation',
      'technique',
      'positioning',
      'anesthesia',
      'duration',
      'emergencyManagement',
      'postProcedureCare',
      'expectedFindings',
      'followUp',
      'recovery',
      'videoUrl',
    ],
    arrayFields: [
      'aliases',
      'boardYieldFacts',
      'indications',
      'absoluteContraindications',
      'relativeContraindications',
      'equipment',
      'anatomicLandmarks',
      'complications',
      'safetyChecklist',
      'abnormalFindings',
      'consentPoints',
      'documentationRequirements',
      'clinicalPearls',
      'commonMistakes',
      'testQuestionTips',
      'mnemonics',
    ],
    jsonFields: ['complicationRates'],
  },
  PhysiologyConcept: {
    stringFields: [
      'displayName',
      'system',
      'description',
      'mechanism',
      'clinicalSignificance',
      'curveDescription',
      'curveType',
      'feedbackLoops',
      'graphUrl',
      'molecularBasis',
      'normalValues',
      'pathophysiology',
      'signalTransduction',
    ],
    arrayFields: [
      'aliases',
      'relatedConditions',
      'relatedDrugs',
      'associatedLabs',
      'boardYieldFacts',
      'clinicalPearls',
      'commonMistakes',
      'compensatoryMechanisms',
      'decompensationSigns',
      'drugTargets',
      'mnemonics',
      'regulatoryFactors',
      'testQuestionTips',
    ],
    jsonFields: ['compareContrast', 'curveShifts', 'drugEffects', 'keyEquations', 'labChanges'],
  },
  ScoringSystem: {
    stringFields: ['displayName', 'condition', 'whenToUse', 'clinicalContext', 'calculatorUrl'],
    arrayFields: [
      'aliases',
      'boardYieldFacts',
      'validationStudies',
      'limitations',
      'whenNotToUse',
      'clinicalPearls',
      'commonMistakes',
      'testQuestionTips',
      'mnemonics',
    ],
    jsonFields: ['components', 'interpretation', 'actionThresholds'],
    floatFields: ['sensitivity', 'specificity'],
  },
  SpecialTest: {
    stringFields: [
      'displayName',
      'system',
      'region',
      'description',
      'technique',
      'positiveTest',
      'interpretation',
      'imageUrl',
      'videoUrl',
    ],
    arrayFields: ['aliases'],
    floatFields: ['sensitivity', 'specificity'],
  },
  Buzzword: {
    stringFields: ['explanation'],
  },
};

// Helper to fetch records in batches
async function fetchInBatches<T>(model: any, batchSize = 200): Promise<T[]> {
  const allRecords: T[] = [];
  let skip = 0;
  while (true) {
    const batch = await model.findMany({ take: batchSize, skip });
    if (batch.length === 0) break;
    allRecords.push(...batch);
    skip += batchSize;
    if (batch.length < batchSize) break;
  }
  return allRecords;
}

async function analyzeTable(
  tableName: string,
  records: any[],
  fieldConfig: (typeof SCHEMA_FIELDS)[string]
): Promise<TableAnalysis> {
  const fieldGaps: FieldGap[] = [];
  const totalCount = records.length;
  if (totalCount === 0) return { tableName, totalRecords: 0, fieldGaps: [] };

  // Check string fields
  for (const field of fieldConfig.stringFields || []) {
    const missing = records.filter((r) => {
      const val = r[field];
      if (val === null || val === undefined) return true;
      if (typeof val === 'string' && val.trim() === '') return true;
      return false;
    });
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
      });
    }
  }

  // Check array fields
  for (const field of fieldConfig.arrayFields || []) {
    const missing = records.filter((r) => !r[field] || r[field].length === 0);
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
      });
    }
  }

  // Check JSON fields
  for (const field of fieldConfig.jsonFields || []) {
    const missing = records.filter((r) => !r[field]);
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
      });
    }
  }

  // Check float fields
  for (const field of fieldConfig.floatFields || []) {
    const missing = records.filter((r) => r[field] === null || r[field] === undefined);
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
      });
    }
  }

  fieldGaps.sort((a, b) => b.missingCount - a.missingCount);
  return { tableName, totalRecords: totalCount, fieldGaps };
}

async function main() {
  console.log('='.repeat(80));
  console.log('COMPLETE DATABASE GAP ANALYSIS - ALL MEDICAL CONTENT TABLES');
  console.log('='.repeat(80));
  console.log();

  const results: TableAnalysis[] = [];

  // Analyze all tables
  const tables = [
    { name: 'LabTest', model: prisma.labTest },
    { name: 'Drug', model: prisma.drug },
    { name: 'ImagingStudy', model: prisma.imagingStudy },
    { name: 'PhysicalExamFinding', model: prisma.physicalExamFinding },
    { name: 'AnatomyStructure', model: prisma.anatomyStructure },
    { name: 'DifferentialDiagnosis', model: prisma.differentialDiagnosis },
    { name: 'ECGPattern', model: prisma.eCGPattern },
    { name: 'Procedure', model: prisma.procedure },
    { name: 'PhysiologyConcept', model: prisma.physiologyConcept },
    { name: 'ScoringSystem', model: prisma.scoringSystem },
    { name: 'SpecialTest', model: prisma.specialTest },
    { name: 'Buzzword', model: prisma.buzzword },
  ];

  for (const { name, model } of tables) {
    console.log(`Analyzing ${name}...`);
    const records = await fetchInBatches(model);
    const config = SCHEMA_FIELDS[name];
    if (config) {
      results.push(await analyzeTable(name, records, config));
    } else {
      console.log(`  ⚠️ No schema config for ${name}`);
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('RESULTS BY TABLE');
  console.log('='.repeat(80));

  let totalCritical = 0;
  let totalModerate = 0;

  for (const result of results) {
    console.log();
    console.log(`${'─'.repeat(60)}`);
    console.log(`📊 ${result.tableName} (${result.totalRecords} records)`);
    console.log(`${'─'.repeat(60)}`);

    if (result.fieldGaps.length === 0) {
      console.log('  ✅ All fields complete!');
      continue;
    }

    const critical = result.fieldGaps.filter((g) => parseFloat(g.percentage) > 50);
    const moderate = result.fieldGaps.filter(
      (g) => parseFloat(g.percentage) > 10 && parseFloat(g.percentage) <= 50
    );
    const low = result.fieldGaps.filter((g) => parseFloat(g.percentage) <= 10);

    if (critical.length > 0) {
      console.log('  🔴 CRITICAL (>50% missing):');
      for (const gap of critical.slice(0, 10)) {
        console.log(
          `     ${gap.fieldName}: ${gap.missingCount}/${gap.totalCount} (${gap.percentage}%)`
        );
        totalCritical += gap.missingCount;
      }
      if (critical.length > 10)
        console.log(`     ... and ${critical.length - 10} more critical fields`);
    }

    if (moderate.length > 0) {
      console.log('  🟡 MODERATE (10-50% missing):');
      for (const gap of moderate.slice(0, 8)) {
        console.log(
          `     ${gap.fieldName}: ${gap.missingCount}/${gap.totalCount} (${gap.percentage}%)`
        );
        totalModerate += gap.missingCount;
      }
      if (moderate.length > 8)
        console.log(`     ... and ${moderate.length - 8} more moderate fields`);
    }

    if (low.length > 0) {
      console.log(`  🟢 LOW (<10% missing): ${low.length} fields`);
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('PRIORITY SUMMARY');
  console.log('='.repeat(80));

  const allCritical: { table: string; field: string; count: number; pct: string }[] = [];
  for (const result of results) {
    for (const gap of result.fieldGaps) {
      if (parseFloat(gap.percentage) > 50) {
        allCritical.push({
          table: result.tableName,
          field: gap.fieldName,
          count: gap.missingCount,
          pct: gap.percentage,
        });
      }
    }
  }

  if (allCritical.length > 0) {
    console.log('\n🚨 TOP 20 CRITICAL GAPS (>50% missing):');
    allCritical.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
    for (const c of allCritical.slice(0, 20)) {
      console.log(`   ${c.table}.${c.field}: ${c.count} records (${c.pct}%)`);
    }
  }

  console.log(`\n📈 Total critical field values: ${totalCritical}`);
  console.log(`📈 Total moderate field values: ${totalModerate}`);

  await prisma.$disconnect();
}

main().catch(console.error);
