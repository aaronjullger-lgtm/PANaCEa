#!/usr/bin/env npx tsx
/**
 * Check empty fields in ImagingStudy and ECGPattern tables
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkImagingStudy() {
  const records = await prisma.imagingStudy.findMany();
  console.log('\n=== ImagingStudy ===');
  console.log('Total records:', records.length);
  
  const fields = [
    'description', 'bodyRegion', 'allergyProtocol', 'contrastAgent', 'contrastType',
    'normalFindings', 'pregnancySafety', 'preparation', 'protocol', 'radiationDose',
    'renalConsiderations', 'reportTemplate', 'scanDuration'
  ];
  
  const arrayFields = [
    'indications', 'contraindications', 'advantages', 'alternativeTo', 'boardYieldFacts',
    'classicSigns', 'clinicalPearls', 'commonMistakes', 'firstLineFor', 'limitations',
    'testQuestionTips', 'whenToAvoid'
  ];
  
  console.log('\n--- String Fields ---');
  for (const field of fields) {
    const emptyCount = records.filter((r: any) => !r[field]).length;
    const status = emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? `⚡ ${emptyCount} EMPTY` : '✅ FILLED';
    console.log(`${field}: ${status}`);
  }
  
  console.log('\n--- Array Fields ---');
  for (const field of arrayFields) {
    const emptyCount = records.filter((r: any) => !r[field] || r[field].length === 0).length;
    const status = emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? `⚡ ${emptyCount} EMPTY` : '✅ FILLED';
    console.log(`${field}: ${status}`);
  }
  
  // Check keyFindings JSON field
  const emptyKeyFindings = records.filter((r: any) => !r.keyFindings).length;
  console.log(`keyFindings: ${emptyKeyFindings === records.length ? '⚠️ ALL EMPTY' : emptyKeyFindings > 0 ? `⚡ ${emptyKeyFindings} EMPTY` : '✅ FILLED'}`);
}

async function checkECGPattern() {
  const records = await prisma.eCGPattern.findMany();
  console.log('\n\n=== ECGPattern ===');
  console.log('Total records:', records.length);
  
  const fields = [
    'displayName', 'subcategory', 'rate', 'rhythm', 'pWave', 'prInterval', 'qrsComplex',
    'qtInterval', 'stSegment', 'tWave', 'pathognomonic', 'hemodynamicEffect',
    'acuteManagement', 'cardioversion', 'pacing', 'referral', 'exampleEcgUrl', 'annotatedEcgUrl'
  ];
  
  const arrayFields = [
    'aliases', 'boardYieldFacts', 'diagnosticCriteria', 'etiology', 'symptoms',
    'associatedConditions', 'medications', 'mimics', 'clinicalPearls', 'commonMistakes',
    'testQuestionTips', 'mnemonics', 'exampleImageUrls', 'annotatedImageUrls'
  ];
  
  console.log('\n--- String Fields ---');
  for (const field of fields) {
    const emptyCount = records.filter((r: any) => !r[field]).length;
    const status = emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? `⚡ ${emptyCount} EMPTY` : '✅ FILLED';
    console.log(`${field}: ${status}`);
  }
  
  console.log('\n--- Array Fields ---');
  for (const field of arrayFields) {
    const emptyCount = records.filter((r: any) => !r[field] || r[field].length === 0).length;
    const status = emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? `⚡ ${emptyCount} EMPTY` : '✅ FILLED';
    console.log(`${field}: ${status}`);
  }
  
  // Check distinguishingFeatures JSON field
  const emptyDistinguishing = records.filter((r: any) => !r.distinguishingFeatures).length;
  console.log(`distinguishingFeatures: ${emptyDistinguishing === records.length ? '⚠️ ALL EMPTY' : emptyDistinguishing > 0 ? `⚡ ${emptyDistinguishing} EMPTY` : '✅ FILLED'}`);
}

async function main() {
  await checkImagingStudy();
  await checkECGPattern();
  
  // Check link tables
  const imgLinks = await prisma.imagingConditionLink.count();
  const ecgLinks = await (prisma as any).eCGConditionLink?.count?.() || 0;
  
  console.log('\n\n=== Link Tables ===');
  console.log('ImagingConditionLink:', imgLinks);
  console.log('ECGConditionLink:', ecgLinks);
  
  await prisma.$disconnect();
}

main().catch(console.error);
