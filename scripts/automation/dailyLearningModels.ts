#!/usr/bin/env tsx
/**
 * Daily Learning Model Tasks
 *
 * Scheduler owner: .github/workflows/sched-daily-learning-models.yml
 * Recommended cadence: 13 3 * * * (daily, UTC)
 *
 * Purpose:
 * - refresh learner-profile derived state before daily prescriptions and insights
 * - keep model refresh separate from user-visible reminders and analytics rollups
 * - keep the scheduled surface idempotent and bounded
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { enrichAllUserProfiles } from './jobs/userProfileEnrichment';
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
  limit?: number;
  batchSize?: number;
  lookbackDays?: number;
  reportOnly: boolean;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_LOOKBACK_DAYS = 90;

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    reportOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit' && argv[i + 1]) {
      options.limit = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--batch-size' && argv[i + 1]) {
      options.batchSize = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--lookback-days' && argv[i + 1]) {
      options.lookbackDays = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--report-only' || arg === '--dry-run') {
      options.reportOnly = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createLaneReport('Daily Learning Models', {
    scheduler: '.github/workflows/sched-daily-learning-models.yml',
    cadence: '13 3 * * *',
    limit: options.limit ?? 'all active users',
    batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    lookbackDays: options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
    reportOnly: options.reportOnly,
  });

  const start = Date.now();

  try {
    const result = await enrichAllUserProfiles({
      limit: options.limit,
      batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
      lookbackDays: options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS,
      dryRun: options.reportOnly,
    });

    recordLaneTask(report, {
      name: 'User Profile Enrichment',
      status:
        options.reportOnly || result.processedUsers > 0
          ? 'completed'
          : result.activeUsersFound > 0
            ? 'warning'
            : 'completed',
      message: options.reportOnly
        ? result.wouldProcessUsers > 0
          ? `Report-only preview: would enrich ${result.wouldProcessUsers} active user profiles in ${result.batches} batch(es).`
          : 'Report-only preview found no active users eligible for enrichment.'
        : result.processedUsers > 0
          ? `Enriched ${result.processedUsers} active user profiles in ${result.batches} batch(es).`
          : 'No active users were eligible for profile enrichment in this run.',
      details: result,
      duration: Date.now() - start,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    recordLaneTask(report, {
      name: 'User Profile Enrichment',
      status: 'failed',
      message,
      duration: Date.now() - start,
    });
  }

  finalizeLaneReport(report);
  printLaneConsoleSummary(report);

  const artifacts = writeLaneArtifacts({
    directory: 'logs/daily-learning-models',
    slug: 'daily-learning-models',
    title: 'Daily Learning Models Report',
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
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { main as runDailyLearningModelTasks };
