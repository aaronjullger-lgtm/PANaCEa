/**
 * Grand Rounds Challenge Generator
 * Creates daily challenge sets by grouping high-yield questions
 * 
 * GrandRoundsChallenge consists of:
 * - date: unique date for the challenge
 * - questionIds: array of question IDs for that day's challenge
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Configuration
const QUESTIONS_PER_CHALLENGE = 5;
const DAYS_TO_GENERATE = 30; // Generate 30 days of challenges

async function main() {
  console.log('🏆 Grand Rounds Challenge Generator');
  console.log('='.repeat(60));
  
  // Get all questions
  const questions = await prisma.question.findMany({
    select: { id: true, system: true, difficulty: true }
  });
  
  console.log(`\n📊 Found ${questions.length} questions in database`);
  
  if (questions.length < QUESTIONS_PER_CHALLENGE) {
    console.log(`\n⚠️  Not enough questions (need at least ${QUESTIONS_PER_CHALLENGE})`);
    console.log('   Run question generators first to populate the Question table.');
    await prisma.$disconnect();
    return;
  }
  
  // Get existing challenges
  const existing = await prisma.grandRoundsChallenge.findMany({
    select: { date: true }
  });
  const existingDates = new Set(existing.map(c => c.date.toISOString().split('T')[0]));
  console.log(`  Found ${existing.length} existing challenges`);
  
  // Generate challenges for the next N days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let created = 0;
  let skipped = 0;
  
  // Group questions by system for variety
  const questionsBySystem: Record<string, string[]> = {};
  for (const q of questions) {
    if (!questionsBySystem[q.system]) {
      questionsBySystem[q.system] = [];
    }
    questionsBySystem[q.system].push(q.id);
  }
  
  const systems = Object.keys(questionsBySystem);
  console.log(`  Systems available: ${systems.join(', ')}`);
  
  console.log(`\nGenerating challenges for ${DAYS_TO_GENERATE} days...\n`);
  
  for (let i = 0; i < DAYS_TO_GENERATE; i++) {
    const challengeDate = new Date(today);
    challengeDate.setDate(today.getDate() + i);
    const dateStr = challengeDate.toISOString().split('T')[0];
    
    if (existingDates.has(dateStr)) {
      console.log(`  ⏭️  Skipped: ${dateStr} (exists)`);
      skipped++;
      continue;
    }
    
    // Select questions with variety across systems
    const selectedIds: string[] = [];
    const usedSystems = new Set<string>();
    
    // Try to get questions from different systems
    for (let j = 0; j < QUESTIONS_PER_CHALLENGE && systems.length > 0; j++) {
      // Pick a system we haven't used yet, or any system if we've used them all
      const availableSystems = systems.filter(s => 
        !usedSystems.has(s) && questionsBySystem[s].length > 0
      );
      const systemPool = availableSystems.length > 0 ? availableSystems : systems.filter(s => questionsBySystem[s].length > 0);
      
      if (systemPool.length === 0) break;
      
      const system = systemPool[Math.floor(Math.random() * systemPool.length)];
      const systemQuestions = questionsBySystem[system];
      
      // Pick a random question from this system that we haven't used
      const availableQuestions = systemQuestions.filter(id => !selectedIds.includes(id));
      if (availableQuestions.length === 0) continue;
      
      const questionId = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
      selectedIds.push(questionId);
      usedSystems.add(system);
    }
    
    // Fill remaining slots with any questions if needed
    while (selectedIds.length < QUESTIONS_PER_CHALLENGE) {
      const allQuestionIds = questions.map(q => q.id).filter(id => !selectedIds.includes(id));
      if (allQuestionIds.length === 0) break;
      selectedIds.push(allQuestionIds[Math.floor(Math.random() * allQuestionIds.length)]);
    }
    
    if (selectedIds.length < QUESTIONS_PER_CHALLENGE) {
      console.log(`  ⚠️  ${dateStr}: Only ${selectedIds.length} questions available`);
    }
    
    try {
      await prisma.grandRoundsChallenge.create({
        data: {
          id: crypto.randomUUID(),
          date: challengeDate,
          questionIds: selectedIds
        }
      });
      
      console.log(`  ✅ Created: ${dateStr} (${selectedIds.length} questions)`);
      created++;
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`  ⏭️  Skipped: ${dateStr} (duplicate)`);
        skipped++;
      } else {
        console.log(`  ❌ Failed: ${dateStr} - ${error.message}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total in database: ${await prisma.grandRoundsChallenge.count()}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
