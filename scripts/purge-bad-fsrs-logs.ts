/**
 * FSRS Data Hygiene: Purge "poisoned" ReviewLog entries before enabling v6 Optimizer.
 *
 * Identifies rows that were incorrectly marked as review_type = 'real' (FSRS-active) but
 * originated from OSCE, Cram, Rapid Recall, or other non-MAIN sources. Downgrades them
 * to review_type = 'cram' (soft delete from algorithm) and tags with fsrsVersion for audit.
 *
 * Usage: npx ts-node scripts/purge-bad-fsrs-logs.ts [--dry-run] [--delete]
 *   --dry-run  Log what would be changed without writing.
 *   --delete  Delete bad rows instead of downgrading to cram (default: downgrade).
 *
 * Data isolation: FSRS scheduler/optimizer must only see review_type = 'real' and
 * sessionType = 'MAIN'. Run scripts/verify-fsrs-health.ts after purge to confirm.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_INSTEAD = process.argv.includes('--delete');

async function purgeBadFsrsData() {
  console.log('🛡️  FSRS Data Hygiene Audit...');
  if (DRY_RUN) console.log('   (dry run – no writes)');
  if (DELETE_INSTEAD) console.log('   (will DELETE bad rows instead of downgrading)');

  // 1. Identify "poisoned" rows: marked real but from excluded modes or invalid for algorithm
  const badLogs = await prisma.reviewLog.findMany({
    where: {
      review_type: 'real',
      OR: [
        { sessionType: { in: ['CRAM', 'RAPID_RECALL'] } },
        {
          questionType: {
            in: ['osce', 'wordle', 'patient_encounter', 'tutorial'],
          },
        },
        { duration: null },
        { stability: 0 },
      ],
    },
    select: { id: true, userId: true, questionFkId: true, sessionType: true, questionType: true },
  });

  console.log(`\n🚨 Found ${badLogs.length} corrupted FSRS log(s).`);

  if (badLogs.length === 0) {
    console.log('✨ FSRS history is clean. No purge needed.');
    return;
  }

  const ids = badLogs.map((l) => l.id);
  const affectedUserIds = [...new Set(badLogs.map((l) => l.userId))];

  if (DRY_RUN) {
    console.log('\nWould affect log ids (sample):', ids.slice(0, 5));
    console.log('Affected user ids:', affectedUserIds);
    return;
  }

  if (DELETE_INSTEAD) {
    const result = await prisma.reviewLog.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(`\n✅ Deleted ${result.count} log(s).`);
  } else {
    const result = await prisma.reviewLog.updateMany({
      where: { id: { in: ids } },
      data: {
        review_type: 'cram',
        fsrsVersion: 'archived_purge',
      },
    });
    console.log(`\n✅ Sanitized ${result.count} log(s) → review_type = 'cram', fsrsVersion = 'archived_purge'.`);
  }

  console.log('\nAffected user ids (for optional Card recalc):', affectedUserIds);
  console.log(
    '  → Recalculating Card stability/difficulty from remaining real logs is not run here.'
  );
  console.log('  → Run scripts/verify-fsrs-health.ts to confirm isolation.');
}

purgeBadFsrsData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
