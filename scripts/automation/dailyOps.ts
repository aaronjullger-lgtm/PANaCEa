#!/usr/bin/env tsx
/**
 * Daily Ops Tasks
 *
 * Scheduler owner: .github/workflows/sched-daily-ops.yml
 * Recommended cadence: 27 4 * * * (daily, UTC)
 *
 * Purpose:
 * - run repo-hosted daily operational rollups
 * - keep report-style analytics separate from content audit and learner-model refresh
 * - produce artifacts and a legible step summary for scheduled and manual runs
 *
 * This script intentionally excludes:
 * - push reminder delivery
 * - queue cleanup
 * - FSRS optimization enqueueing
 * - content health mutation or auto-repair
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { runPlatformStatisticsJob } from './jobs/platformStatistics';
import { runContentStatisticsJob } from './jobs/contentStatistics';
import {
  appendWorkflowSummary,
  createLaneReport,
  finalizeLaneReport,
  printLaneConsoleSummary,
  recordLaneTask,
  writeLaneArtifacts,
} from './shared/reporting';

config();

const report = createLaneReport('Daily Ops', {
  scheduler: '.github/workflows/sched-daily-ops.yml',
  cadence: '27 4 * * *',
  scope: 'repo-hosted daily rollups only',
});

interface CliOptions {
  reportOnly: boolean;
  skipPlatformRollup: boolean;
  skipContentRollup: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  return {
    reportOnly: argv.includes('--report-only') || argv.includes('--dry-run'),
    skipPlatformRollup: argv.includes('--skip-platform-rollup'),
    skipContentRollup: argv.includes('--skip-content-rollup'),
  };
}

async function runTask(
  name: string,
  operation: () => Promise<{ message: string; details?: unknown }>
): Promise<void> {
  const start = Date.now();

  try {
    const result = await operation();
    recordLaneTask(report, {
      name,
      status: 'completed',
      message: result.message,
      details: result.details,
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

async function runPlatformStatisticsTask(): Promise<{ message: string }> {
  await runPlatformStatisticsJob();
  return {
    message: 'Platform statistics rollup completed and stored in PlatformStatistics.',
  };
}

async function runContentStatisticsTask(): Promise<{ message: string }> {
  await runContentStatisticsJob();
  return {
    message: 'Content statistics rollup completed and stored in ContentStatistics.',
  };
}

async function aggregatePerformanceSnapshot(): Promise<{
  message: string;
  details: { totalAnswers: number; correctAnswers: number; accuracy: string };
}> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalAnswers, correctAnswers] = await Promise.all([
    prisma.performanceRecord.count({
      where: {
        timestamp: {
          gte: BigInt(yesterday.getTime()),
          lt: BigInt(today.getTime()),
        },
      },
    }),
    prisma.performanceRecord.count({
      where: {
        timestamp: {
          gte: BigInt(yesterday.getTime()),
          lt: BigInt(today.getTime()),
        },
        isCorrect: true,
      },
    }),
  ]);

  const accuracy = totalAnswers > 0 ? ((correctAnswers / totalAnswers) * 100).toFixed(2) : 'N/A';

  return {
    message: `Yesterday snapshot: ${totalAnswers} answers recorded, ${accuracy}% accuracy.`,
    details: { totalAnswers, correctAnswers, accuracy },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  report.metadata = {
    ...report.metadata,
    reportOnly: options.reportOnly,
    skipPlatformRollup: options.skipPlatformRollup,
    skipContentRollup: options.skipContentRollup,
  };

  if (options.reportOnly || options.skipPlatformRollup) {
    recordLaneTask(report, {
      name: 'Platform Statistics Rollup',
      status: 'skipped',
      message: options.reportOnly
        ? 'Skipped in report-only mode.'
        : 'Skipped via --skip-platform-rollup.',
    });
  } else {
    await runTask('Platform Statistics Rollup', runPlatformStatisticsTask);
  }

  if (options.reportOnly || options.skipContentRollup) {
    recordLaneTask(report, {
      name: 'Content Statistics Rollup',
      status: 'skipped',
      message: options.reportOnly
        ? 'Skipped in report-only mode.'
        : 'Skipped via --skip-content-rollup.',
    });
  } else {
    await runTask('Content Statistics Rollup', runContentStatisticsTask);
  }

  await runTask('Daily Performance Snapshot', aggregatePerformanceSnapshot);

  finalizeLaneReport(report);
  printLaneConsoleSummary(report);

  const artifacts = writeLaneArtifacts({
    directory: 'logs/daily-ops',
    slug: 'daily-ops',
    title: 'Daily Ops Report',
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

export { main as runDailyOpsTasks };
