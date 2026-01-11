#!/usr/bin/env tsx
/**
 * Standardize Question Difficulty Script
 * 
 * This script:
 * 1. Updates ALL existing pooled questions to "PANCE-level" difficulty
 * 2. Updates ALL questions in the main Question table to "PANCE-level"
 * 3. Updates ALL question seeds to "PANCE-level"
 * 
 * Run with: npx tsx scripts/standardize-question-difficulty.ts
 */

import { prisma, runScript } from './_shared/db';

const PANCE_LEVEL = 'PANCE-level';

async function standardizeAllQuestionDifficulty() {
  console.log('🔄 Starting difficulty standardization...\n');

  // 1. Update PreGeneratedQuestion table
  const pooledBefore = await prisma.preGeneratedQuestion.count();
  const pooledUpdated = await prisma.preGeneratedQuestion.updateMany({
    where: {
      difficulty: { not: PANCE_LEVEL },
    },
    data: {
      difficulty: PANCE_LEVEL,
    },
  });
  console.log(`✅ PreGeneratedQuestion: ${pooledUpdated.count}/${pooledBefore} updated to ${PANCE_LEVEL}`);

  // 2. Update Question table
  const mainBefore = await prisma.question.count();
  const mainUpdated = await prisma.question.updateMany({
    where: {
      difficulty: { not: PANCE_LEVEL },
    },
    data: {
      difficulty: PANCE_LEVEL,
    },
  });
  console.log(`✅ Question: ${mainUpdated.count}/${mainBefore} updated to ${PANCE_LEVEL}`);

  // 3. Update QuestionSeed table
  const seedsBefore = await prisma.questionSeed.count();
  const seedsUpdated = await prisma.questionSeed.updateMany({
    where: {
      difficulty: { not: PANCE_LEVEL },
    },
    data: {
      difficulty: PANCE_LEVEL,
    },
  });
  console.log(`✅ QuestionSeed: ${seedsUpdated.count}/${seedsBefore} updated to ${PANCE_LEVEL}`);

  // 4. Show distribution after update
  console.log('\n📊 Final Distribution:');
  
  const pooledDistribution = await prisma.preGeneratedQuestion.groupBy({
    by: ['difficulty'],
    _count: { difficulty: true },
  });
  console.log('PreGeneratedQuestion:', pooledDistribution);

  const mainDistribution = await prisma.question.groupBy({
    by: ['difficulty'],
    _count: { difficulty: true },
  });
  console.log('Question:', mainDistribution);

  const seedsDistribution = await prisma.questionSeed.groupBy({
    by: ['difficulty'],
    _count: { difficulty: true },
  });
  console.log('QuestionSeed:', seedsDistribution);

  console.log('\n✅ Difficulty standardization complete!');
  console.log('All questions are now PANCE-level difficulty.');
}

// Run the script with automatic cleanup
runScript(standardizeAllQuestionDifficulty);
