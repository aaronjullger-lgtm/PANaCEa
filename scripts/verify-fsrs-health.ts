/**
 * FSRS Data Isolation Health Check
 *
 * Verifies that no non-MAIN session data is present in FSRS-active history.
 * Should return 0 bad count after purge and with correct write protection in place.
 *
 * Usage: npx ts-node scripts/verify-fsrs-health.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('🔍 FSRS isolation health check...\n');

  const badCount = await prisma.reviewLog.count({
    where: {
      review_type: 'real',
      sessionType: { not: 'MAIN' },
    },
  });

  const badByQuestionType = await prisma.reviewLog.count({
    where: {
      review_type: 'real',
      questionType: { in: ['osce', 'wordle', 'patient_encounter', 'tutorial'] },
    },
  });

  const totalReal = await prisma.reviewLog.count({
    where: { review_type: 'real' },
  });

  const totalMain = await prisma.reviewLog.count({
    where: { sessionType: 'MAIN' },
  });

  console.log('  review_type = "real" AND sessionType != "MAIN":', badCount);
  console.log('  review_type = "real" AND questionType in (osce, wordle, ...):', badByQuestionType);
  console.log('  Total review_type = "real":', totalReal);
  console.log('  Total sessionType = "MAIN":', totalMain);

  if (badCount > 0 || badByQuestionType > 0) {
    console.error('\n❌ CRITICAL: Non-MAIN or non-eligible logs found in FSRS history. Run scripts/purge-bad-fsrs-logs.ts.');
    process.exit(1);
  }

  console.log('\n✅ Health check passed: FSRS data isolation OK.');
}

verify()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
