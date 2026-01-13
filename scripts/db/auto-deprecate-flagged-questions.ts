/**
 * Auto-deprecate Questions with High Flag Rate
 * 
 * Automatically rejects questions with flagRate > 0.1 (10%+)
 * Part of Step 7: Question Quality Pipeline
 * 
 * Run: npx tsx scripts/db/auto-deprecate-flagged-questions.ts [--dry-run]
 */

import { prisma, disconnectPrisma } from '../helpers/prisma-client.js';

const FLAG_RATE_THRESHOLD = 0.1; // 10%
const MIN_SERVES_FOR_DEPRECATION = 20; // Minimum times served before deprecating

interface DeprecationStats {
  evaluated: number;
  deprecated: number;
  skipped: number;
  errors: number;
}

async function autoDeprecateFlaggedQuestions(dryRun: boolean = false): Promise<DeprecationStats> {
  const stats: DeprecationStats = {
    evaluated: 0,
    deprecated: 0,
    skipped: 0,
    errors: 0
  };

  console.log('\n🔍 Finding questions with high flag rates...\n');
  console.log(`Threshold: flagRate > ${FLAG_RATE_THRESHOLD * 100}% with ≥${MIN_SERVES_FOR_DEPRECATION} serves`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will update database)'}\n`);

  try {
    // Find questions with high flag rates that are still approved or pending
    const flaggedQuestions = await prisma.preGeneratedQuestion.findMany({
      where: {
        flagRate: { gt: FLAG_RATE_THRESHOLD },
        timesServed: { gte: MIN_SERVES_FOR_DEPRECATION },
        validationStatus: {
          in: ['pending', 'approved']
        }
      },
      select: {
        id: true,
        system: true,
        questionType: true,
        difficulty: true,
        conditionId: true,
        flagCount: true,
        flagRate: true,
        timesServed: true,
        validationStatus: true,
        qualityScore: true,
        Condition: {
          select: {
            name: true
          }
        }
      },
      orderBy: { flagRate: 'desc' }
    });

    stats.evaluated = flaggedQuestions.length;

    if (flaggedQuestions.length === 0) {
      console.log('✅ No questions found with high flag rates. Database is healthy!\n');
      return stats;
    }

    console.log(`Found ${flaggedQuestions.length} questions to deprecate:\n`);

    for (const question of flaggedQuestions) {
      try {
        const flagPercent = (question.flagRate * 100).toFixed(1);
        const conditionName = question.Condition?.name || 'N/A';
        
        console.log(`📌 Question ID: ${question.id}`);
        console.log(`   System: ${question.system || 'N/A'}`);
        console.log(`   Condition: ${conditionName}`);
        console.log(`   Type: ${question.questionType}`);
        console.log(`   Difficulty: ${question.difficulty}`);
        console.log(`   Flag Rate: ${flagPercent}% (${question.flagCount}/${question.timesServed})`);
        console.log(`   Quality Score: ${question.qualityScore ?? 'N/A'}`);
        console.log(`   Current Status: ${question.validationStatus}`);

        if (!dryRun) {
          // Update to rejected status with automated note
          await prisma.preGeneratedQuestion.update({
            where: { id: question.id },
            data: {
              validationStatus: 'rejected',
              validatedAt: new Date(),
              validatedBy: 'system_auto_deprecation',
              validationNotes: `Auto-deprecated: Flag rate ${flagPercent}% exceeds threshold (${FLAG_RATE_THRESHOLD * 100}%) after ${question.timesServed} serves. Flagged ${question.flagCount} times by users.`
            }
          });
          console.log(`   ✅ Deprecated\n`);
          stats.deprecated++;
        } else {
          console.log(`   🔄 Would deprecate (dry run)\n`);
          stats.deprecated++;
        }

      } catch (error) {
        console.error(`   ❌ Error processing question ${question.id}:`, error);
        stats.errors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Deprecation Summary:');
    console.log('='.repeat(60));
    console.log(`Evaluated:       ${stats.evaluated}`);
    console.log(`Deprecated:      ${stats.deprecated}`);
    console.log(`Errors:          ${stats.errors}`);
    console.log('='.repeat(60) + '\n');

    if (dryRun) {
      console.log('⚠️  This was a DRY RUN. No changes were made.');
      console.log('   Run without --dry-run to apply deprecations.\n');
    } else {
      console.log('✅ Deprecation complete!\n');
    }

  } catch (error) {
    console.error('❌ Error during auto-deprecation:', error);
    throw error;
  }

  return stats;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    const stats = await autoDeprecateFlaggedQuestions(dryRun);
    
    if (stats.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await disconnectPrisma();
  }
}

main();
