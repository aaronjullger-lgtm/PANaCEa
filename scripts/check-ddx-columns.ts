#!/usr/bin/env npx tsx
/**
 * Check which DifferentialDiagnosis columns are empty across all records
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const records = await prisma.differentialDiagnosis.findMany();
  console.log('Total records:', records.length);

  const arrayFields = [
    'testQuestionTips',
    'boardYieldFacts',
    'commonMistakes',
    'aliases',
    'advancedWorkup',
    'applicableRules',
    'mostDangerous',
    'oftenMissed',
    'reassuringFeatures',
    'mnemonics',
  ];

  console.log('\n=== Array Fields (empty = 0 items) ===');
  for (const field of arrayFields) {
    const emptyCount = records.filter((r: any) => !r[field] || r[field].length === 0).length;
    const status =
      emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? '⚡ PARTIAL' : '✅ FILLED';
    console.log(`${field}: ${emptyCount}/${records.length} empty ${status}`);
  }

  // Check JSON fields
  const jsonFields = ['byAcuity', 'byAge', 'distinguishingFeatures'];
  console.log('\n=== JSON Fields (null = empty) ===');
  for (const field of jsonFields) {
    const emptyCount = records.filter((r: any) => !r[field]).length;
    const status =
      emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? '⚡ PARTIAL' : '✅ FILLED';
    console.log(`${field}: ${emptyCount}/${records.length} empty ${status}`);
  }

  // Check optional string fields
  const stringFields = ['diagnosticAlgorithm', 'dispositionGuidance', 'pearls'];
  console.log('\n=== String Fields (null/empty = empty) ===');
  for (const field of stringFields) {
    const emptyCount = records.filter((r: any) => !r[field]).length;
    const status =
      emptyCount === records.length ? '⚠️ ALL EMPTY' : emptyCount > 0 ? '⚡ PARTIAL' : '✅ FILLED';
    console.log(`${field}: ${emptyCount}/${records.length} empty ${status}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
