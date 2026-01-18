#!/usr/bin/env tsx
/**
 * Cleanup Old Jobs Script
 *
 * Removes completed and failed jobs older than the retention period
 * to prevent database bloat.
 *
 * Usage:
 *   tsx scripts/cleanupJobs.ts [--retention-days 30]
 *
 * Scheduled via cron:
 *   0 4 * * 0 cd /opt/PANaCEa && npx tsx scripts/cleanupJobs.ts
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

interface CleanupOptions {
  retentionDays: number;
  dryRun: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CleanupOptions {
  const args = process.argv.slice(2);
  const options: CleanupOptions = {
    retentionDays: 30,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--retention-days':
        options.retentionDays = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log('Usage: tsx scripts/cleanupJobs.ts [options]');
        console.log('Options:');
        console.log('  --retention-days N  Number of days to retain jobs (default: 30)');
        console.log('  --dry-run          Show what would be deleted without deleting');
        console.log('  --help             Show this help message');
        process.exit(0);
    }
  }

  return options;
}

/**
 * Clean up old jobs
 */
async function cleanupOldJobs(options: CleanupOptions): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('PANaCEa Job Cleanup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.retentionDays);

  console.log(`Retention Policy: ${options.retentionDays} days`);
  console.log(`Cutoff Date: ${cutoffDate.toLocaleString()}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  try {
    // Count jobs to be deleted
    const jobsToDelete = await prisma.backgroundJob.count({
      where: {
        status: { in: ['completed', 'failed'] },
        completedAt: { lt: cutoffDate },
      },
    });

    if (jobsToDelete === 0) {
      console.log('✓ No old jobs to clean up');
      return;
    }

    console.log(`Found ${jobsToDelete} old jobs to delete\n`);

    // Get breakdown by status
    const [completedCount, failedCount] = await Promise.all([
      prisma.backgroundJob.count({
        where: {
          status: 'completed',
          completedAt: { lt: cutoffDate },
        },
      }),
      prisma.backgroundJob.count({
        where: {
          status: 'failed',
          completedAt: { lt: cutoffDate },
        },
      }),
    ]);

    console.log('Breakdown:');
    console.log(`  Completed: ${completedCount}`);
    console.log(`  Failed:    ${failedCount}\n`);

    if (options.dryRun) {
      console.log('[DRY RUN] Would delete these jobs (not actually deleting)');

      // Show sample of jobs that would be deleted
      const sampleJobs = await prisma.backgroundJob.findMany({
        where: {
          status: { in: ['completed', 'failed'] },
          completedAt: { lt: cutoffDate },
        },
        take: 5,
        select: {
          id: true,
          jobType: true,
          status: true,
          completedAt: true,
        },
        orderBy: { completedAt: 'asc' },
      });

      console.log('Sample jobs (first 5):');
      sampleJobs.forEach((job, i) => {
        console.log(
          `  ${i + 1}. [${job.jobType}] ${job.status} - ${job.completedAt?.toLocaleString()}`
        );
      });
    } else {
      // Actually delete the jobs
      const result = await prisma.backgroundJob.deleteMany({
        where: {
          status: { in: ['completed', 'failed'] },
          completedAt: { lt: cutoffDate },
        },
      });

      console.log(`✓ Successfully deleted ${result.count} old jobs\n`);
    }

    // Show remaining job statistics
    const [pending, processing, remaining] = await Promise.all([
      prisma.backgroundJob.count({ where: { status: 'pending' } }),
      prisma.backgroundJob.count({ where: { status: 'processing' } }),
      prisma.backgroundJob.count({ where: { status: { in: ['completed', 'failed'] } } }),
    ]);

    console.log('Current Job Queue Status:');
    console.log(`  Pending:    ${pending}`);
    console.log(`  Processing: ${processing}`);
    console.log(`  Historical: ${remaining}`);
    console.log(`  Total:      ${pending + processing + remaining}\n`);
  } catch (error: any) {
    console.error('[ERROR] Cleanup failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();

  try {
    await cleanupOldJobs(options);
    process.exit(0);
  } catch (error: any) {
    console.error('[ERROR] Fatal error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { cleanupOldJobs };
