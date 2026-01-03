/**
 * Gap Analysis Script for ECGPattern and DifferentialDiagnosis tables
 * Checks for missing/empty fields and data quality issues
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FieldIssue {
  field: string;
  count: number;
  examples: string[];
}

async function analyzeECGPattern(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('ECGPattern Gap Analysis');
  console.log('='.repeat(60));
  
  const records = await prisma.eCGPattern.findMany();
  console.log(`Total records: ${records.length}\n`);
  
  const fields = [
    'name', 'category', 'description', 'keyFeatures', 'clinicalSignificance',
    'associatedConditions', 'waveformCharacteristics', 'diagnosticCriteria',
    'differentialDiagnosis', 'clinicalPearls', 'emergencyFeatures', 'commonMistakes',
    'boardYieldFacts', 'patientEducation', 'referral', 'rhythm', 'rate', 'axis',
    'intervals', 'imageUrl'
  ];
  
  const issues: FieldIssue[] = [];
  
  for (const field of fields) {
    const emptyRecords: string[] = [];
    
    for (const record of records) {
      const val = (record as any)[field];
      const isEmpty = val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length === 0);
      
      if (isEmpty) {
        emptyRecords.push(record.name);
      }
    }
    
    if (emptyRecords.length > 0) {
      issues.push({
        field,
        count: emptyRecords.length,
        examples: emptyRecords.slice(0, 5)
      });
    }
  }
  
  if (issues.length === 0) {
    console.log('✅ All fields populated for all records!');
  } else {
    console.log('Fields with missing/empty values:\n');
    for (const issue of issues) {
      const pct = ((issue.count / records.length) * 100).toFixed(1);
      console.log(`  ❌ ${issue.field}: ${issue.count}/${records.length} (${pct}%)`);
      issue.examples.forEach(ex => console.log(`      - ${ex}`));
      if (issue.count > 5) {
        console.log(`      ... and ${issue.count - 5} more`);
      }
    }
  }
  
  // Check categories
  const categories = new Map<string, number>();
  records.forEach(r => {
    const cat = r.category || 'UNCATEGORIZED';
    categories.set(cat, (categories.get(cat) || 0) + 1);
  });
  
  console.log('\nCategories breakdown:');
  [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
}

async function analyzeDifferentialDiagnosis(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('DifferentialDiagnosis Gap Analysis');
  console.log('='.repeat(60));
  
  const records = await prisma.differentialDiagnosis.findMany();
  console.log(`Total records: ${records.length}\n`);
  
  const fields = [
    'presentingComplaint', 'category', 'mnemonic', 'differentials', 'mostDangerous',
    'oftenMissed', 'distinguishingFeatures', 'diagnosticAlgorithm', 'dispositionGuidance',
    'byAcuity', 'byAge', 'keyQuestions', 'physicalExamFindings', 'reassuringFeatures',
    'commonMistakes', 'clinicalPearls', 'relatedConditions'
  ];
  
  const issues: FieldIssue[] = [];
  
  for (const field of fields) {
    const emptyRecords: string[] = [];
    
    for (const record of records) {
      const val = (record as any)[field];
      const isEmpty = val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length === 0);
      
      if (isEmpty) {
        emptyRecords.push(record.presentingComplaint);
      }
    }
    
    if (emptyRecords.length > 0) {
      issues.push({
        field,
        count: emptyRecords.length,
        examples: emptyRecords.slice(0, 5)
      });
    }
  }
  
  if (issues.length === 0) {
    console.log('✅ All fields populated for all records!');
  } else {
    console.log('Fields with missing/empty values:\n');
    for (const issue of issues) {
      const pct = ((issue.count / records.length) * 100).toFixed(1);
      console.log(`  ❌ ${issue.field}: ${issue.count}/${records.length} (${pct}%)`);
      issue.examples.forEach(ex => console.log(`      - ${ex}`));
      if (issue.count > 5) {
        console.log(`      ... and ${issue.count - 5} more`);
      }
    }
  }
  
  // Check categories
  const categories = new Map<string, number>();
  records.forEach(r => {
    const cat = r.category || 'UNCATEGORIZED';
    categories.set(cat, (categories.get(cat) || 0) + 1);
  });
  
  console.log('\nCategories breakdown:');
  [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
  
  // Check mnemonic quality
  const withMnemonic = records.filter(r => r.mnemonics && r.mnemonics.length > 0);
  console.log(`\nMnemonics: ${withMnemonic.length}/${records.length} have mnemonics`);
  
  // Check differential counts
  const diffCounts = records.map(r => {
    const diffs = r.differentialList as any[];
    return { name: r.presentingComplaint, count: diffs?.length || 0 };
  });
  
  const avgDiffs = diffCounts.reduce((sum, d) => sum + d.count, 0) / diffCounts.length;
  const minDiffs = Math.min(...diffCounts.map(d => d.count));
  const maxDiffs = Math.max(...diffCounts.map(d => d.count));
  
  console.log(`\nDifferentials per record: min=${minDiffs}, max=${maxDiffs}, avg=${avgDiffs.toFixed(1)}`);
  
  // Find records with few differentials
  const lowDiffs = diffCounts.filter(d => d.count < 5);
  if (lowDiffs.length > 0) {
    console.log(`\n⚠️ Records with <5 differentials: ${lowDiffs.length}`);
    lowDiffs.slice(0, 5).forEach(d => console.log(`    - ${d.name}: ${d.count}`));
  }
}

async function main() {
  try {
    await analyzeECGPattern();
    await analyzeDifferentialDiagnosis();
    
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    
    const ecgCount = await prisma.eCGPattern.count();
    const ddxCount = await prisma.differentialDiagnosis.count();
    
    console.log(`ECGPattern: ${ecgCount} records`);
    console.log(`DifferentialDiagnosis: ${ddxCount} records`);
    
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
