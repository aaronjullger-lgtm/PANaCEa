#!/usr/bin/env node
/**
 * Backfill isMainSession Flag
 *
 * One-time script to set isMainSession = true for existing QuestionAttempt rows
 * where mode = 'session' (i.e., main session attempts) but the flag is currently false.
 *
 * Usage:
 *   npx tsx scripts/backfill-main-session-flag.ts [--dry-run] [--batch-size N]
 *
 * Safety:
 *   - Defaults to dry‑run mode (only logs what would be updated).
 *   - Pass --dry-run=false (or --apply) to actually write changes.
 *   - Processes rows in batches to avoid locking the table.
 *   - Prints progress and final summary.
 */

import { prisma, disconnectPrisma } from './helpers/prisma-client';

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '1000', 10);

async function main() {
  console.log('🔍 Backfilling isMainSession flag...');
  console.log(`   Dry‑run: ${DRY_RUN ? 'YES (no changes will be written)' : 'NO (changes will be applied)'}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  let updatedCount = 0;
  let processed = 0;
  let hasMore = true;
  let cursor: string | undefined = undefined;

  while (hasMore) {
    // Find rows where mode = 'session' AND isMainSession = false
    const rows = await prisma.questionAttempt.findMany({
      where: {
        mode: 'session',
        isMainSession: false,
      },
      select: {
        id: true,
        userId: true,
        questionId: true,
        mode: true,
        isMainSession: true,
        createdAt: true,
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (rows.length === 0) {
      hasMore = false;
      break;
    }

    const ids = rows.map(r => r.id);
    console.log(`   Batch ${processed + 1} – ${ids.length} rows to update`);

    if (!DRY_RUN) {
      // Perform the update
      const result = await prisma.questionAttempt.updateMany({
        where: { id: { in: ids } },
        data: { isMainSession: true },
      });
      updatedCount += result.count;
      console.log(`      ✅ Updated ${result.count} rows`);
    } else {
      console.log(`      📝 Would update ${ids.length} rows (dry‑run)`);
      updatedCount += ids.length;
    }

    processed += rows.length;
    cursor = rows[rows.length - 1].id;

    // Small pause to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log('\n📊 Summary');
  console.log(`   Total rows processed: ${processed}`);
  console.log(`   Total rows to update: ${updatedCount}`);
  if (DRY_RUN) {
    console.log('\n💡 To apply these changes, run:');
    console.log('   npx tsx scripts/backfill-main-session-flag.ts --apply');
  } else {
    console.log('\n✅ Backfill completed successfully.');
  }
}

main()
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });