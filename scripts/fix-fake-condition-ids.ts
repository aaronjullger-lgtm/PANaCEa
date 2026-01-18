/**
 * Fix Fake ConditionIds Job
 *
 * Scans PreGeneratedQuestion and Question tables for fake conditionIds
 * (generated from condition names like "atrial-fibrillation") and replaces
 * them with real conditionIds from MedicalContent using fuzzy matching.
 *
 * Run with: npm run fix:condition-ids
 */

import { config } from 'dotenv';
config(); // Load environment variables

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { resolveConditionId, resolveConditionIdBatch } from '../lib/conditionResolver';

// Use adapter pattern for proper database connection
const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface FixResult {
  total: number;
  fixed: number;
  alreadyValid: number;
  unresolved: number;
  errors: number;
}

/**
 * Check if a conditionId looks fake (dash-separated lowercase words)
 * Real conditionIds from DB have specific formats
 */
function isFakeConditionId(conditionId: string | null): boolean {
  if (!conditionId) return true;
  if (conditionId === 'unknown') return true;

  // Fake IDs are typically lowercase with dashes (e.g., "atrial-fibrillation")
  // Real IDs are more structured (e.g., "cv_afib", "PULM001")
  const fakePattern = /^[a-z]+(-[a-z]+)+$/;
  return fakePattern.test(conditionId);
}

/**
 * Fix conditionIds in PreGeneratedQuestion table
 */
async function fixPreGeneratedQuestions(): Promise<FixResult> {
  console.log('\n📊 Fixing PreGeneratedQuestion table...');

  const result: FixResult = {
    total: 0,
    fixed: 0,
    alreadyValid: 0,
    unresolved: 0,
    errors: 0,
  };

  try {
    // Get all questions with potentially fake conditionIds
    const questions = await prisma.preGeneratedQuestion.findMany({
      where: {
        OR: [{ conditionId: null }, { conditionId: 'unknown' }],
      },
      select: {
        id: true,
        conditionId: true,
        system: true,
        questionData: true, // Contains the question details
      },
      take: 1000, // Process in batches
    });

    result.total = questions.length;
    console.log(`   Found ${questions.length} questions to check`);

    // Batch resolve condition names
    const toResolve = questions
      .filter((q) => isFakeConditionId(q.conditionId))
      .map((q) => {
        // Extract condition from questionData JSON
        const qData = q.questionData as any;
        const conditionName = qData?.condition || qData?.topic || q.conditionId || 'unknown';
        return {
          name: conditionName,
          system: q.system,
        };
      });

    console.log(`   Resolving ${toResolve.length} condition names...`);

    const resolutions = await resolveConditionIdBatch(prisma, toResolve);

    // Update questions
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];

      if (!isFakeConditionId(question.conditionId)) {
        result.alreadyValid++;
        continue;
      }

      const qData = question.questionData as any;
      const conditionName = qData?.condition || qData?.topic || question.conditionId || 'unknown';
      const match = resolutions.get(conditionName);

      if (match && match.confidence >= 0.7) {
        try {
          await prisma.preGeneratedQuestion.update({
            where: { id: question.id },
            data: {
              conditionId: match.conditionId,
              // Note: We don't update questionData.condition here
              // as it might have the user-friendly name
            },
          });

          result.fixed++;

          if (result.fixed % 10 === 0) {
            console.log(`   Fixed ${result.fixed}/${toResolve.length}...`);
          }
        } catch (error) {
          console.error(`   ❌ Error updating question ${question.id}:`, error);
          result.errors++;
        }
      } else {
        result.unresolved++;
      }
    }

    console.log(`   ✅ Fixed ${result.fixed} questions`);
    console.log(`   ✓ Already valid: ${result.alreadyValid}`);
    console.log(`   ⚠️  Unresolved: ${result.unresolved}`);
    console.log(`   ❌ Errors: ${result.errors}`);
  } catch (error) {
    console.error('   ❌ Error fixing PreGeneratedQuestion:', error);
  }

  return result;
}

/**
 * Fix conditionIds in Question table
 */
async function fixMainQuestions(): Promise<FixResult> {
  console.log('\n📊 Fixing Question table...');

  const result: FixResult = {
    total: 0,
    fixed: 0,
    alreadyValid: 0,
    unresolved: 0,
    errors: 0,
  };

  try {
    // Get questions with null/unknown conditionId
    const questions = await prisma.question.findMany({
      where: {
        OR: [{ conditionId: null }, { conditionId: 'unknown' }],
      },
      select: {
        id: true,
        conditionId: true,
        system: true,
        difficulty: true,
        vignette: true,
        question: true,
      },
      take: 1000,
    });

    result.total = questions.length;
    console.log(`   Found ${questions.length} questions to check`);

    // Try to extract condition name from question text
    const toResolve = questions.map((q) => {
      // Try to extract condition from vignette (very basic)
      const text = q.vignette || q.question || '';
      const words = text.split(/\s+/).slice(0, 20); // First 20 words

      // This is a heuristic - in real use, might need AI to extract
      const possibleCondition = words.find((w) => w.length > 5 && /^[A-Z]/.test(w));

      return {
        name: possibleCondition || 'unknown',
        system: q.system,
      };
    });

    const resolutions = await resolveConditionIdBatch(prisma, toResolve);

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const conditionName = toResolve[i].name;
      const match = resolutions.get(conditionName);

      if (match && match.confidence >= 0.8) {
        try {
          await prisma.question.update({
            where: { id: question.id },
            data: {
              conditionId: match.conditionId,
            },
          });

          result.fixed++;
        } catch (error) {
          result.errors++;
        }
      } else {
        result.unresolved++;
      }
    }

    console.log(`   ✅ Fixed ${result.fixed} questions`);
    console.log(`   ⚠️  Unresolved: ${result.unresolved}`);
    console.log(`   ❌ Errors: ${result.errors}`);
  } catch (error) {
    console.error('   ❌ Error fixing Question:', error);
  }

  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fix Fake ConditionIds Job');
  console.log('================================\n');

  const startTime = Date.now();

  try {
    // Fix both tables
    const preGenResult = await fixPreGeneratedQuestions();
    const mainResult = await fixMainQuestions();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary');
    console.log('='.repeat(50));
    console.log(
      `PreGeneratedQuestion: ${preGenResult.fixed} fixed, ${preGenResult.unresolved} unresolved`
    );
    console.log(`Question: ${mainResult.fixed} fixed, ${mainResult.unresolved} unresolved`);
    console.log(`\nTotal fixed: ${preGenResult.fixed + mainResult.fixed}`);
    console.log(`Duration: ${duration}s`);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
