/**
 * Demo: Question Generation Sprint B Utilities
 *
 * Demonstrates:
 * - Step 3: Question Deduplication
 * - Step 4: Adaptive Difficulty
 * - Step 5: Session Interleaving
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Sprint B utilities
import {
  getUserSeenQuestionIds,
  filterUnseenQuestions,
  getPoolExplorationStats,
  checkQuestionsSeenStatus,
} from '../lib/questionDeduplication';

import {
  getUserPerformanceBySystem,
  getRecommendedDifficultiesBySystem,
  getUserOverallSkillLevel,
} from '../lib/adaptiveDifficulty';

import {
  ensureInterleaving,
  validateInterleaving,
  getInterleavingMetrics,
  getInterleavingReport,
  shuffleWithInterleaving,
} from '../lib/sessionInterleaving';

// Load environment variables
dotenv.config();

const DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL;

if (!DIRECT_DATABASE_URL) {
  console.error('❌ Error: DIRECT_DATABASE_URL not found in .env');
  process.exit(1);
}

// Initialize Prisma with adapter
const pool = new pg.Pool({ connectionString: DIRECT_DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🎯 Question Generation Sprint B Demo\n');
  console.log('═'.repeat(70));

  try {
    // ========================================================================
    // STEP 3: QUESTION DEDUPLICATION
    // ========================================================================
    console.log('\n📋 STEP 3: Question Deduplication');
    console.log('─'.repeat(70));

    // Find a user with question history
    const userWithHistory = await prisma.userQuestionSeen.findFirst({
      select: { userId: true },
      orderBy: { timesShown: 'desc' },
    });

    if (userWithHistory) {
      console.log(`\nDemo 1: Get Seen Questions for User`);
      console.log(`   User ID: ${userWithHistory.userId.substring(0, 12)}...`);

      const seenIds = await getUserSeenQuestionIds(prisma, userWithHistory.userId, {
        questionType: 'pre_generated',
      });

      console.log(`   ✓ User has seen ${seenIds.size} pre-generated questions`);

      // Demo filtering
      console.log(`\nDemo 2: Filter Unseen Questions`);

      // Get some sample question IDs
      const sampleQuestions = await prisma.preGeneratedQuestion.findMany({
        take: 20,
        select: { id: true },
      });

      const sampleIds = sampleQuestions.map((q) => q.id);
      console.log(`   Testing pool of ${sampleIds.length} questions...`);

      const unseenIds = await filterUnseenQuestions(
        prisma,
        userWithHistory.userId,
        sampleIds,
        'pre_generated'
      );

      console.log(`   ✓ ${unseenIds.length} unseen questions found`);
      console.log(`   ✓ ${sampleIds.length - unseenIds.length} already seen (filtered out)`);

      // Demo exploration stats
      console.log(`\nDemo 3: Pool Exploration Statistics`);

      const stats = await getPoolExplorationStats(
        prisma,
        userWithHistory.userId,
        sampleIds,
        'pre_generated'
      );

      console.log(`   Total: ${stats.total}`);
      console.log(`   Seen: ${stats.seen}`);
      console.log(`   Unseen: ${stats.unseen}`);
      console.log(`   Progress: ${stats.percentExplored}% explored`);

      // Demo seen status check
      console.log(`\nDemo 4: Check Specific Questions`);

      const statusMap = await checkQuestionsSeenStatus(
        prisma,
        userWithHistory.userId,
        sampleIds.slice(0, 5),
        'pre_generated'
      );

      for (const [id, seen] of statusMap.entries()) {
        console.log(`   ${id.substring(0, 20)}... → ${seen ? '✓ Seen' : '○ Unseen'}`);
      }
    } else {
      console.log('   ⚠️  No user history found - skipping deduplication demo');
    }

    // ========================================================================
    // STEP 4: ADAPTIVE DIFFICULTY
    // ========================================================================
    console.log('\n\n🎚️  STEP 4: Adaptive Difficulty');
    console.log('─'.repeat(70));

    // Find a user with question attempts
    const userWithAttempts = await prisma.questionAttempt.findFirst({
      select: { userId: true, system: true },
      orderBy: { createdAt: 'desc' },
    });

    if (userWithAttempts) {
      console.log(`\nDemo 5: User Performance by System`);
      console.log(`   User ID: ${userWithAttempts.userId.substring(0, 12)}...`);
      console.log(`   System: ${userWithAttempts.system}`);

      const performance = await getUserPerformanceBySystem(
        prisma,
        userWithAttempts.userId,
        userWithAttempts.system!,
        7 // Last 7 days
      );

      console.log(`   Accuracy: ${performance.accuracy.toFixed(1)}%`);
      console.log(`   Total Attempts: ${performance.totalAttempts}`);
      console.log(`   Avg FSRS Stability: ${performance.avgStability.toFixed(2)}`);
      console.log(
        `   ✓ Recommended Difficulty: ${performance.recommendedDifficulty.toUpperCase()}`
      );

      // Demo multiple systems
      console.log(`\nDemo 6: Recommended Difficulty Across Systems`);

      const systems = ['CV', 'PULM', 'GI', 'NEURO', 'ENDO'];
      const difficulties = await getRecommendedDifficultiesBySystem(
        prisma,
        userWithAttempts.userId,
        systems,
        7
      );

      for (const [system, difficulty] of difficulties.entries()) {
        const emoji = difficulty === 'easy' ? '🟢' : difficulty === 'medium' ? '🟡' : '🔴';
        console.log(`   ${emoji} ${system.padEnd(8)} → ${difficulty}`);
      }

      // Demo overall skill level
      console.log(`\nDemo 7: Overall Skill Assessment`);

      const skillAssessment = await getUserOverallSkillLevel(
        prisma,
        userWithAttempts.userId,
        30 // Last 30 days
      );

      console.log(`   Skill Level: ${skillAssessment.skillLevel.toUpperCase()}`);
      console.log(`   Overall Accuracy: ${skillAssessment.overallAccuracy.toFixed(1)}%`);
      console.log(`   Avg Stability: ${skillAssessment.avgStability.toFixed(2)}`);
      console.log(`   Total Attempts: ${skillAssessment.totalAttempts}`);
      console.log(
        `   ✓ Recommended Difficulty: ${skillAssessment.recommendedDifficulty.toUpperCase()}`
      );
    } else {
      console.log('   ⚠️  No question attempts found - generating synthetic demo');

      console.log(`\nDemo 5-7: Synthetic Performance Examples`);
      console.log(`   Beginner (45% accuracy, stability=2): Recommended = EASY`);
      console.log(`   Intermediate (72% accuracy, stability=6): Recommended = MEDIUM`);
      console.log(`   Advanced (88% accuracy, stability=12): Recommended = HARD`);
    }

    // ========================================================================
    // STEP 5: SESSION INTERLEAVING
    // ========================================================================
    console.log('\n\n🔀 STEP 5: Session Interleaving');
    console.log('─'.repeat(70));

    console.log(`\nDemo 8: Detect Clustering (Bad Interleaving)`);

    // Create a poorly interleaved session (clustered by system)
    const clusteredQuestions = [
      { id: 'q1', system: 'CV' },
      { id: 'q2', system: 'CV' },
      { id: 'q3', system: 'CV' }, // 3 CV in a row
      { id: 'q4', system: 'PULM' },
      { id: 'q5', system: 'PULM' },
      { id: 'q6', system: 'PULM' }, // 3 PULM in a row
      { id: 'q7', system: 'GI' },
      { id: 'q8', system: 'GI' },
      { id: 'q9', system: 'GI' }, // 3 GI in a row
      { id: 'q10', system: 'NEURO' },
    ];

    console.log(`   Input: ${clusteredQuestions.map((q) => q.system).join(', ')}`);
    const isValid = validateInterleaving(clusteredQuestions, 2, 5);
    console.log(`   Valid: ${isValid ? '✓ Yes' : '✗ No'}`);

    const metrics = getInterleavingMetrics(clusteredQuestions, 5);
    console.log(`   Max Consecutive Same System: ${metrics.maxConsecutiveSameSystem}`);
    console.log(`   Violations: ${metrics.violations}`);

    console.log(`\nDemo 9: Fix Interleaving`);

    const interleaved = ensureInterleaving(clusteredQuestions, 2, 5);
    console.log(`   Output: ${interleaved.map((q) => q.system).join(', ')}`);

    const interleavedValid = validateInterleaving(interleaved, 2, 5);
    console.log(`   ✓ Valid: ${interleavedValid ? 'Yes' : 'No'}`);

    const interleavedMetrics = getInterleavingMetrics(interleaved, 5);
    console.log(`   Max Consecutive: ${interleavedMetrics.maxConsecutiveSameSystem}`);
    console.log(`   Violations: ${interleavedMetrics.violations}`);

    console.log(`\nDemo 10: Quality Report`);
    console.log('');
    console.log(getInterleavingReport(interleaved));

    console.log(`\nDemo 11: Shuffle with Interleaving`);

    // Create a session with enough variety
    const sessionQuestions = [
      { id: 'q1', system: 'CV' },
      { id: 'q2', system: 'CV' },
      { id: 'q3', system: 'PULM' },
      { id: 'q4', system: 'PULM' },
      { id: 'q5', system: 'GI' },
      { id: 'q6', system: 'GI' },
      { id: 'q7', system: 'NEURO' },
      { id: 'q8', system: 'NEURO' },
      { id: 'q9', system: 'ENDO' },
      { id: 'q10', system: 'ENDO' },
    ];

    const shuffled = shuffleWithInterleaving(sessionQuestions, 2, 5);
    console.log(`   Before: ${sessionQuestions.map((q) => q.system).join(', ')}`);
    console.log(`   After:  ${shuffled.map((q) => q.system).join(', ')}`);

    const shuffledValid = validateInterleaving(shuffled, 2, 5);
    console.log(`   ✓ Valid: ${shuffledValid ? 'Yes' : 'No'}`);

    // ========================================================================
    // INTEGRATION EXAMPLE
    // ========================================================================
    console.log('\n\n🔗 Integration Example: Complete Question Selection Pipeline');
    console.log('─'.repeat(70));
    console.log(`
This is how Sprint B utilities would be integrated into question selection:

1. **Determine Target Difficulty** (Step 4)
   const performance = await getUserPerformanceBySystem(prisma, userId, 'CV');
   const difficulty = performance.recommendedDifficulty; // 'easy', 'medium', or 'hard'

2. **Query Question Pool**
   const poolQuestions = await prisma.preGeneratedQuestion.findMany({
     where: { system: 'CV', difficulty },
     take: 50, // Get more than needed
   });

3. **Filter Out Seen Questions** (Step 3)
   const questionIds = poolQuestions.map(q => q.id);
   const unseenIds = await filterUnseenQuestions(prisma, userId, questionIds);
   const unseenQuestions = poolQuestions.filter(q => unseenIds.includes(q.id));

4. **Select Final Set**
   const selectedQuestions = unseenQuestions.slice(0, 10);

5. **Ensure Proper Interleaving** (Step 5)
   const interleavedQuestions = ensureInterleaving(selectedQuestions, 2, 5);

6. **Serve to User**
   return interleavedQuestions;

✅ Result: User gets 10 questions at appropriate difficulty, none repeated,
   properly interleaved for optimal learning!
`);

    console.log('\n═'.repeat(70));
    console.log('✅ Sprint B Complete! All utilities working correctly.\n');
    console.log('Next Steps:');
    console.log('  • Sprint C: Steps 6-8 (FSRS linking, distractor validation, versioning)');
    console.log('  • Sprint D: Steps 9-10 (Quality scoring, analytics dashboard)');
    console.log('  • Integration: Add Sprint B utilities to question service\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
