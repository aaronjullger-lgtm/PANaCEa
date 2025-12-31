/**
 * Accurate Database Gap Analysis
 * Cross-checked against prisma/schema.prisma field names
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldGap {
  fieldName: string;
  missingCount: number;
  totalCount: number;
  percentage: string;
  sampleIds: string[];
}

interface TableAnalysis {
  tableName: string;
  totalRecords: number;
  fieldGaps: FieldGap[];
}

// Schema-verified field definitions for each table
const SCHEMA_FIELDS = {
  LabTest: {
    stringFields: [
      'conventionalRange', 'clinicalScenarios', 'typicalUse', 'collectionTube',
      'sampleType', 'siRange', 'siUnits', 'units', 'turnaroundTime',
      'stability', 'specialInstructions', 'interpretationSteps'
    ],
    arrayFields: [
      'boardYieldFacts', 'clinicalPearls', 'commonMistakes', 'mnemonics',
      'testQuestionTips', 'whenToOrder', 'increaseIndicates', 'decreaseIndicates',
      'falsePosNeg', 'interferingFactors', 'followUpTests', 'relatedTests',
      'criticalValues'
    ],
    jsonFields: ['referenceRanges']
  },
  Drug: {
    stringFields: [
      'brandName', 'mechanismOfAction', 'dosing', 'antidote', 'clinicalNotes',
      'displayName', 'elimination', 'metabolism', 'absorption', 'administrationTips',
      'bioavailability', 'distribution', 'duration', 'eliminationRoute',
      'geriatricDosing', 'geriatricNotes', 'halfLife', 'hepaticDosing',
      'lactationNotes', 'lactationSafety', 'maxDailyDose', 'mechanismDetailed',
      'metabolismDetail', 'onsetOfAction', 'peakEffect', 'pediatricDosing',
      'pediatricNotes', 'pregnancyCategory', 'pregnancyNotes', 'renalDosing',
      'reversalAgent', 'storageRequirements', 'toxicity', 'typicalCost'
    ],
    arrayFields: [
      'drugClass', 'indications', 'contraindications', 'tags', 'aliases',
      'sideEffects', 'interactions', 'blackBoxWarnings', 'boardYieldFacts',
      'clinicalPearls', 'commonMistakes', 'foodInteractions', 'formulations',
      'mnemonics', 'monitoringParams', 'riskStrategies', 'routesOfAdmin',
      'testQuestionTips'
    ],
    jsonFields: ['cyp450Effects', 'majorInteractions', 'pharmacokinetics']
  },
  ImagingStudy: {
    stringFields: [
      'bodyRegion', 'description', 'allergyProtocol', 'contrastAgent',
      'contrastType', 'normalFindings', 'pregnancySafety', 'preparation',
      'protocol', 'radiationDose', 'renalConsiderations', 'reportTemplate',
      'scanDuration'
    ],
    arrayFields: [
      'indications', 'contraindications', 'advantages', 'alternativeTo',
      'boardYieldFacts', 'classicSigns', 'clinicalPearls', 'commonMistakes',
      'firstLineFor', 'limitations', 'testQuestionTips', 'whenToAvoid'
    ],
    jsonFields: ['keyFindings']
  },
  PhysicalExamFinding: {
    stringFields: [
      'description', 'clinicalSignificance', 'category', 'eponymousName',
      'evidenceQuality', 'findingType', 'gradingScale', 'howToDocument',
      'howToElicit', 'imageUrl', 'patientPosition', 'videoUrl'
    ],
    arrayFields: [
      'aliases', 'associatedFindings', 'boardYieldFacts', 'clinicalPearls',
      'commonMistakes', 'differentialFor', 'equipmentNeeded', 'mnemonics',
      'negativeIndicates', 'normalVariants', 'positiveIndicates', 'testQuestionTips'
    ],
    floatFields: ['negativeLR', 'positiveLR', 'sensitivity', 'specificity']
  },
  AnatomyStructure: {
    stringFields: [
      'region', 'type', 'description', 'function', 'innervation', 'bloodSupply',
      'clinicalSignificance', 'imageUrl', 'abbreviation', 'autonomicFunction',
      'borders', 'dermatome', 'diagramUrl', 'injuryMechanism', 'insertion',
      'latinName', 'modelUrl', 'motorFunction', 'myotome', 'nervePath',
      'nerveRoots', 'origin', 'palpationTips', 'relations', 'sensoryFunction',
      'surgicalApproach', 'vesselPath', 'videoUrl'
    ],
    arrayFields: [
      'aliases', 'anastomoses', 'attachments', 'boardYieldFacts', 'branches',
      'clinicalPearls', 'commonMistakes', 'commonPathology', 'contents',
      'examFindings', 'imagingFindings', 'layers', 'mnemonics', 'surfaceLandmarks',
      'testQuestionTips', 'tributaries'
    ]
  }
};

async function analyzeTable(
  tableName: string,
  records: any[],
  fieldConfig: { stringFields?: string[], arrayFields?: string[], jsonFields?: string[], floatFields?: string[] }
): Promise<TableAnalysis> {
  const fieldGaps: FieldGap[] = [];
  const totalCount = records.length;

  // Check string fields (null or empty string)
  for (const field of fieldConfig.stringFields || []) {
    const missing = records.filter(r => {
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
        sampleIds: missing.slice(0, 3).map(r => r.id || r.name)
      });
    }
  }

  // Check array fields (null or empty array)
  for (const field of fieldConfig.arrayFields || []) {
    const missing = records.filter(r => !r[field] || r[field].length === 0);
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
        sampleIds: missing.slice(0, 3).map(r => r.id || r.name)
      });
    }
  }

  // Check JSON fields (null)
  for (const field of fieldConfig.jsonFields || []) {
    const missing = records.filter(r => !r[field]);
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
        sampleIds: missing.slice(0, 3).map(r => r.id || r.name)
      });
    }
  }

  // Check float fields (null)
  for (const field of fieldConfig.floatFields || []) {
    const missing = records.filter(r => r[field] === null || r[field] === undefined);
    if (missing.length > 0) {
      fieldGaps.push({
        fieldName: field,
        missingCount: missing.length,
        totalCount,
        percentage: ((missing.length / totalCount) * 100).toFixed(1),
        sampleIds: missing.slice(0, 3).map(r => r.id || r.name)
      });
    }
  }

  // Sort by missing count (highest first)
  fieldGaps.sort((a, b) => b.missingCount - a.missingCount);

  return { tableName, totalRecords: totalCount, fieldGaps };
}

// Helper to fetch records in batches
async function fetchInBatches<T>(
  model: any,
  batchSize = 200
): Promise<T[]> {
  const allRecords: T[] = [];
  let skip = 0;
  
  while (true) {
    const batch = await model.findMany({
      take: batchSize,
      skip,
    });
    
    if (batch.length === 0) break;
    allRecords.push(...batch);
    skip += batchSize;
    
    if (batch.length < batchSize) break;
  }
  
  return allRecords;
}

async function main() {
  console.log('='.repeat(80));
  console.log('ACCURATE DATABASE GAP ANALYSIS');
  console.log('Schema-verified field names from prisma/schema.prisma');
  console.log('='.repeat(80));
  console.log();

  const results: TableAnalysis[] = [];

  // Analyze LabTest
  console.log('Analyzing LabTest...');
  const labTests = await fetchInBatches(prisma.labTest);
  results.push(await analyzeTable('LabTest', labTests, SCHEMA_FIELDS.LabTest));

  // Analyze Drug (large table, use batches)
  console.log('Analyzing Drug (1000 records, fetching in batches)...');
  const drugs = await fetchInBatches(prisma.drug);
  results.push(await analyzeTable('Drug', drugs, SCHEMA_FIELDS.Drug));

  // Analyze ImagingStudy
  console.log('Analyzing ImagingStudy...');
  const imagingStudies = await fetchInBatches(prisma.imagingStudy);
  results.push(await analyzeTable('ImagingStudy', imagingStudies, SCHEMA_FIELDS.ImagingStudy));

  // Analyze PhysicalExamFinding
  console.log('Analyzing PhysicalExamFinding...');
  const findings = await fetchInBatches(prisma.physicalExamFinding);
  results.push(await analyzeTable('PhysicalExamFinding', findings, SCHEMA_FIELDS.PhysicalExamFinding));

  // Analyze AnatomyStructure
  console.log('Analyzing AnatomyStructure...');
  const anatomy = await fetchInBatches(prisma.anatomyStructure);
  results.push(await analyzeTable('AnatomyStructure', anatomy, SCHEMA_FIELDS.AnatomyStructure));

  console.log();
  console.log('='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));

  for (const result of results) {
    console.log();
    console.log(`${'─'.repeat(60)}`);
    console.log(`📊 ${result.tableName} (${result.totalRecords} records)`);
    console.log(`${'─'.repeat(60)}`);

    if (result.fieldGaps.length === 0) {
      console.log('  ✅ All fields complete!');
      continue;
    }

    // Group by severity
    const critical = result.fieldGaps.filter(g => parseFloat(g.percentage) > 50);
    const moderate = result.fieldGaps.filter(g => parseFloat(g.percentage) > 10 && parseFloat(g.percentage) <= 50);
    const low = result.fieldGaps.filter(g => parseFloat(g.percentage) <= 10);

    if (critical.length > 0) {
      console.log('  🔴 CRITICAL (>50% missing):');
      for (const gap of critical) {
        console.log(`     ${gap.fieldName}: ${gap.missingCount}/${gap.totalCount} (${gap.percentage}%)`);
      }
    }

    if (moderate.length > 0) {
      console.log('  🟡 MODERATE (10-50% missing):');
      for (const gap of moderate) {
        console.log(`     ${gap.fieldName}: ${gap.missingCount}/${gap.totalCount} (${gap.percentage}%)`);
      }
    }

    if (low.length > 0) {
      console.log('  🟢 LOW (<10% missing):');
      for (const gap of low) {
        console.log(`     ${gap.fieldName}: ${gap.missingCount}/${gap.totalCount} (${gap.percentage}%)`);
      }
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(80));
  console.log('PRIORITY SUMMARY');
  console.log('='.repeat(80));
  
  const allCritical: { table: string, field: string, count: number, pct: string }[] = [];
  for (const result of results) {
    for (const gap of result.fieldGaps) {
      if (parseFloat(gap.percentage) > 50) {
        allCritical.push({
          table: result.tableName,
          field: gap.fieldName,
          count: gap.missingCount,
          pct: gap.percentage
        });
      }
    }
  }

  if (allCritical.length > 0) {
    console.log('\n🚨 CRITICAL GAPS (>50% missing across all tables):');
    allCritical.sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct));
    for (const c of allCritical) {
      console.log(`   ${c.table}.${c.field}: ${c.count} records (${c.pct}%)`);
    }
  } else {
    console.log('\n✅ No critical gaps (>50%) found!');
  }

  // Count high-priority fields to fill
  let totalHighPriority = 0;
  for (const result of results) {
    for (const gap of result.fieldGaps) {
      if (parseFloat(gap.percentage) > 20) {
        totalHighPriority += gap.missingCount;
      }
    }
  }
  
  console.log(`\n📈 Total high-priority field values to fill (>20% gap): ${totalHighPriority}`);

  await prisma.$disconnect();
}

main().catch(console.error);
