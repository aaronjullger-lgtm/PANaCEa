#!/usr/bin/env tsx
/**
 * Fix Missing UserProgress Records
 *
 * Creates UserProgress records for user-condition pairs that have QuestionAttempts
 * but no corresponding UserProgress records.
 *
 * Run: npx tsx scripts/fix-missing-user-progress.ts
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client.js';

async function fixMissingUserProgress() {
  console.log('🔧 Fixing missing UserProgress records...\n');

  try {
    // 1. Find user-condition pairs with QuestionAttempts but no UserProgress
    console.log('1️⃣  Finding missing UserProgress records...');

    const missingPairs = await prisma.$queryRaw<
      Array<{
        userId: string;
        conditionId: string;
        attemptCount: number;
        lastAttemptAt: Date;
      }>
    >`
      SELECT 
        qa."userId",
        qa."conditionId",
        COUNT(*) as "attemptCount",
        MAX(qa."createdAt") as "lastAttemptAt"
      FROM "QuestionAttempt" qa
      LEFT JOIN "UserProgress" up
        ON qa."userId" = up."userId" 
        AND qa."conditionId" = up."conditionId"
      WHERE up.id IS NULL
      GROUP BY qa."userId", qa."conditionId"
      ORDER BY "attemptCount" DESC
    `;

    console.log(`   Found ${missingPairs.length} user-condition pairs with missing UserProgress`);

    if (missingPairs.length === 0) {
      console.log('   ✅ No missing UserProgress records found');
      return;
    }

    // 2. Create UserProgress records for each missing pair
    console.log('2️⃣  Creating missing UserProgress records...');

    let createdCount = 0;
    let skippedCount = 0;

    for (const pair of missingPairs) {
      try {
        // Check if MedicalContent exists for this condition
        // Note: MedicalContent.id is the conditionId, not a separate conditionId field
        const medicalContent = await prisma.medicalContent.findUnique({
          where: { id: pair.conditionId },
          select: { id: true, condition: true, system: true },
        });

        if (!medicalContent) {
          console.log(`   ⚠️  Skipping ${pair.conditionId}: MedicalContent not found`);
          skippedCount++;
          continue;
        }

        // Create initial FSRS card state
        const initialFsrsCard = {
          stability: 1.0,
          difficulty: 5.0,
          state: 'New',
          elapsed_days: 0,
          scheduled_days: 1,
          reps: 0,
          lapses: 0,
          last_review: pair.lastAttemptAt.toISOString(),
        };

        // Create UserProgress record
        await prisma.userProgress.create({
          data: {
            id: crypto.randomUUID(),
            userId: pair.userId,
            conditionId: pair.conditionId,
            system: medicalContent.system || null,
            fsrsCard: initialFsrsCard,
            reviewHistory: [],
            totalAttempts: Number(pair.attemptCount),
            correctCount: 0, // We don't have accuracy data from QuestionAttempt
            accuracy: 0,
            lastReviewAt: pair.lastAttemptAt,
            nextReviewAt: new Date(pair.lastAttemptAt.getTime() + 24 * 60 * 60 * 1000), // 1 day later
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        createdCount++;
        console.log(
          `   ✅ Created UserProgress for ${pair.conditionId} (${pair.attemptCount} attempts)`
        );
      } catch (error) {
        console.log(
          `   ❌ Failed to create UserProgress for ${pair.conditionId}:`,
          error instanceof Error ? error.message : String(error)
        );
        skippedCount++;
      }
    }

    // 3. Verify the fix
    console.log('\n3️⃣  Verifying fix...');

    const remainingMissing = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*) as count
      FROM (
        SELECT DISTINCT qa."userId", qa."conditionId"
        FROM "QuestionAttempt" qa
        LEFT JOIN "UserProgress" up
          ON qa."userId" = up."userId" 
          AND qa."conditionId" = up."conditionId"
        WHERE up.id IS NULL
      ) as missing
    `;

    const remainingCount = Number(remainingMissing[0]?.count || 0);

    console.log('\n📊 FIX SUMMARY');
    console.log('='.repeat(40));
    console.log(`Total missing pairs found:    ${missingPairs.length}`);
    console.log(`UserProgress records created: ${createdCount}`);
    console.log(`Skipped (no MedicalContent):  ${skippedCount}`);
    console.log(`Remaining missing pairs:      ${remainingCount}`);
    console.log('='.repeat(40));

    if (remainingCount === 0) {
      console.log('🎉 All missing UserProgress records have been fixed!');
    } else {
      console.log('⚠️  Some missing UserProgress records could not be fixed');
      console.log('   These may be due to missing MedicalContent or other data issues');
    }
  } catch (error) {
    console.error('❌ Error fixing missing UserProgress:', error);
    throw error;
  } finally {
    await disconnectPrisma();
  }
}

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
  fixMissingUserProgress().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { fixMissingUserProgress };
