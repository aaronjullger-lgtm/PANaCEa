#!/usr/bin/env tsx
/**
 * Weekly Maintenance
 *
 * Scheduler owner: .github/workflows/sched-weekly-maintenance.yml
 * Recommended cadence: 47 7 * * 0 (weekly, UTC)
 *
 * Purpose:
 * - run bounded weekly housekeeping only
 * - keep maintenance rerun-safe and explicit
 * - avoid operator-grade AI/content mutation in unattended cron
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { backup } from '../emergency_backup';
import {
  appendWorkflowSummary,
  createLaneReport,
  finalizeLaneReport,
  printLaneConsoleSummary,
  recordLaneTask,
  writeLaneArtifacts,
} from './shared/reporting';

config();

interface CliOptions {
  dryRun: boolean;
  retentionDays: number;
  skipBackup: boolean;
  skipRetentionCleanup: boolean;
}

const DEFAULT_RETENTION_DAYS = 30;

function parseArgs(argv: string[]): CliOptions {
  let retentionDays = DEFAULT_RETENTION_DAYS;
  const dryRun = argv.includes('--dry-run');
  const skipBackup = argv.includes('--skip-backup');
  const skipRetentionCleanup = argv.includes('--skip-retention-cleanup');

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--retention-days' && argv[index + 1]) {
      retentionDays = Number(argv[index + 1]);
      index += 1;
    }
  }

  return {
    dryRun,
    retentionDays:
      Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : DEFAULT_RETENTION_DAYS,
    skipBackup,
    skipRetentionCleanup,
  };
}

async function runTask(
  report: ReturnType<typeof createLaneReport>,
  name: string,
  operation: () => Promise<{ message: string; details?: unknown; artifacts?: string[] }>
): Promise<void> {
  const start = Date.now();

  try {
    const result = await operation();
    recordLaneTask(report, {
      name,
      status: 'completed',
      message: result.message,
      details: result.details,
      artifacts: result.artifacts,
      duration: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    recordLaneTask(report, {
      name,
      status: 'failed',
      message,
      duration: Date.now() - start,
    });
  }
}

async function createBackupSnapshot(): Promise<{
  message: string;
  details: Awaited<ReturnType<typeof backup>>;
  artifacts: string[];
}> {
  const result = await backup();

  if (result.skippedTables.length > 0) {
    throw new Error(`Backup completed with skipped tables: ${result.skippedTables.join(', ')}`);
  }

  return {
    message: `Created backup snapshot at ${result.backupDir} with ${result.tablesSaved}/${result.tablesAttempted} table exports.`,
    details: result,
    artifacts: [result.backupDir],
  };
}

async function cleanupHistoricalBackgroundJobs(options: CliOptions): Promise<{
  message: string;
  details: {
    dryRun: boolean;
    retentionDays: number;
    cutoffDate: string;
    candidates: { total: number; completed: number; failed: number };
    deletedCount: number;
    currentQueue: { pending: number; processing: number; historical: number };
    sampleJobs: Array<{ id: string; jobType: string; status: string; completedAt: string | null }>;
  };
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.retentionDays);

  const where = {
    status: { in: ['completed', 'failed'] },
    completedAt: { lt: cutoffDate },
  } as const;

  const [totalCandidates, completedCandidates, failedCandidates, sampleJobs] = await Promise.all([
    prisma.backgroundJob.count({ where }),
    prisma.backgroundJob.count({
      where: { status: 'completed', completedAt: { lt: cutoffDate } },
    }),
    prisma.backgroundJob.count({
      where: { status: 'failed', completedAt: { lt: cutoffDate } },
    }),
    prisma.backgroundJob.findMany({
      where,
      take: 10,
      orderBy: { completedAt: 'asc' },
      select: {
        id: true,
        jobType: true,
        status: true,
        completedAt: true,
      },
    }),
  ]);

  let deletedCount = 0;
  if (!options.dryRun && totalCandidates > 0) {
    const result = await prisma.backgroundJob.deleteMany({ where });
    deletedCount = result.count;
  }

  const [pending, processing, historical] = await Promise.all([
    prisma.backgroundJob.count({ where: { status: 'pending' } }),
    prisma.backgroundJob.count({ where: { status: 'processing' } }),
    prisma.backgroundJob.count({ where: { status: { in: ['completed', 'failed'] } } }),
  ]);

  const message = options.dryRun
    ? `Dry run found ${totalCandidates} historical background jobs older than ${options.retentionDays} days.`
    : totalCandidates === 0
      ? `No historical background jobs older than ${options.retentionDays} days required cleanup.`
      : `Deleted ${deletedCount} historical background jobs older than ${options.retentionDays} days.`;

  return {
    message,
    details: {
      dryRun: options.dryRun,
      retentionDays: options.retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      candidates: {
        total: totalCandidates,
        completed: completedCandidates,
        failed: failedCandidates,
      },
      deletedCount,
      currentQueue: {
        pending,
        processing,
        historical,
      },
      sampleJobs: sampleJobs.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        status: job.status,
        completedAt: job.completedAt?.toISOString() ?? null,
      })),
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createLaneReport('Weekly Maintenance', {
    scheduler: '.github/workflows/sched-weekly-maintenance.yml',
    cadence: '47 7 * * 0',
    dryRun: options.dryRun,
    retentionDays: options.retentionDays,
    skipBackup: options.skipBackup,
    skipRetentionCleanup: options.skipRetentionCleanup,
    scope: 'bounded weekly housekeeping only',
  });

  if (options.skipBackup) {
    recordLaneTask(report, {
      name: 'Backup Snapshot',
      status: 'skipped',
      message: 'Skipped via --skip-backup.',
    });
  } else {
    await runTask(report, 'Backup Snapshot', createBackupSnapshot);
  }

  if (options.skipRetentionCleanup) {
    recordLaneTask(report, {
      name: 'Historical Background Job Retention',
      status: 'skipped',
      message: 'Skipped via --skip-retention-cleanup.',
    });
  } else {
    await runTask(report, 'Historical Background Job Retention', () =>
      cleanupHistoricalBackgroundJobs(options)
    );
  }

  finalizeLaneReport(report);
  printLaneConsoleSummary(report);

  const artifacts = writeLaneArtifacts({
    directory: 'logs/weekly-maintenance',
    slug: 'weekly-maintenance',
    title: 'Weekly Maintenance Report',
    report,
  });

  console.log(`JSON report: ${artifacts.jsonPath}`);
  console.log(`Markdown report: ${artifacts.markdownPath}`);
  appendWorkflowSummary(artifacts.markdownPath);

  if (report.summary.failed > 0) {
    process.exit(1);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}

export { main as runWeeklyMaintenanceTasks };
