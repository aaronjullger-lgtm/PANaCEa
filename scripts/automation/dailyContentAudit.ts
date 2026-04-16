#!/usr/bin/env tsx
/**
 * Daily Content Audit Tasks
 *
 * Scheduler owner: .github/workflows/sched-content-audit.yml
 * Recommended cadence: 41 5 * * * (daily, UTC)
 *
 * Purpose:
 * - keep read-only content and data audits separate from operational rollups
 * - surface content integrity drift without bundling cleanup or auto-repair
 * - preserve artifacts that make reruns and failures legible
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';
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
  skipDbAudits: boolean;
  skipCompletenessCsv: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  return {
    skipDbAudits: argv.includes('--skip-db-audits'),
    skipCompletenessCsv: argv.includes('--skip-completeness-csv'),
  };
}

async function validateContentAccuracy(): Promise<{
  status: 'completed' | 'warning';
  message: string;
  details: { totalConditions: number; issuesFound: number; issues: string[] };
}> {
  const content = await prisma.medicalContent.findMany({
    where: { status: 'published' },
    select: { condition: true, overview: true, treatment: true },
  });

  const issues: string[] = [];

  for (const item of content) {
    if (item.overview && /\[NO CONTENT PROVIDED\]/i.test(item.overview)) {
      issues.push(`${item.condition}: placeholder overview`);
    }

    if (!item.treatment) {
      issues.push(`${item.condition}: missing treatment`);
    }
  }

  return {
    status: issues.length > 0 ? 'warning' : 'completed',
    message:
      issues.length > 0
        ? `Validated ${content.length} conditions and found ${issues.length} content issues.`
        : `Validated ${content.length} published conditions with no placeholder or missing-treatment issues.`,
    details: {
      totalConditions: content.length,
      issuesFound: issues.length,
      issues: issues.slice(0, 20),
    },
  };
}

async function identifyContentGaps(): Promise<{
  status: 'completed' | 'warning';
  message: string;
  details: { gapSystems: string[] };
}> {
  const systemCounts = await prisma.medicalContent.groupBy({
    by: ['system'],
    where: { status: 'published' },
    _count: { system: true },
  });

  const gaps = systemCounts.filter((entry) => entry._count.system < 10);

  return {
    status: gaps.length > 0 ? 'warning' : 'completed',
    message:
      gaps.length > 0
        ? `Found ${gaps.length} systems with fewer than 10 published conditions.`
        : 'No low-coverage systems detected in published content.',
    details: { gapSystems: gaps.map((entry) => entry.system) },
  };
}

async function checkMediaAssetQuality(): Promise<{
  status: 'completed' | 'warning';
  message: string;
  details: {
    missingQuality: number;
    lowQuality: number;
    missingUrl: number;
    totalFlagged: number;
  };
}> {
  const mediaAssets = await prisma.mediaAsset.findMany({
    where: {
      OR: [{ qualityScore: null }, { qualityScore: { lt: 50 } }, { originalUrl: null }],
    },
    select: { qualityScore: true, originalUrl: true },
  });

  const missingQuality = mediaAssets.filter((asset) => asset.qualityScore === null).length;
  const lowQuality = mediaAssets.filter(
    (asset) => asset.qualityScore !== null && asset.qualityScore < 50
  ).length;
  const missingUrl = mediaAssets.filter((asset) => !asset.originalUrl).length;

  const status = missingQuality > 0 || lowQuality > 0 || missingUrl > 0 ? 'warning' : 'completed';

  return {
    status,
    message:
      status === 'warning'
        ? `Flagged ${mediaAssets.length} media assets for missing score, low quality, or missing source URL.`
        : 'No media asset quality issues were flagged.',
    details: {
      missingQuality,
      lowQuality,
      missingUrl,
      totalFlagged: mediaAssets.length,
    },
  };
}

function runNpmCommand(
  name: string,
  args: string[],
  logFile: string
): { status: 'completed' | 'failed'; message: string; artifacts: string[] } {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCommand, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  });

  const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join('\n');
  fs.writeFileSync(logFile, combinedOutput);

  if (result.status !== 0) {
    return {
      status: 'failed',
      message: `${name} failed with exit code ${result.status}. See ${logFile}.`,
      artifacts: [logFile],
    };
  }

  return {
    status: 'completed',
    message: `${name} completed successfully. See ${logFile}.`,
    artifacts: [logFile],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = createLaneReport('Daily Content Audit', {
    scheduler: '.github/workflows/sched-content-audit.yml',
    cadence: '41 5 * * *',
    dbAudits: options.skipDbAudits ? 'skipped' : 'enabled',
    completenessCsv: options.skipCompletenessCsv ? 'disabled' : 'enabled',
  });

  const artifactDirectory = path.join(process.cwd(), 'logs', 'content-audit');
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const taskDefinitions = [
    {
      name: 'Content Accuracy Validation',
      run: validateContentAccuracy,
    },
    {
      name: 'Content Gap Identification',
      run: identifyContentGaps,
    },
    {
      name: 'Media Asset Quality Audit',
      run: checkMediaAssetQuality,
    },
  ] as const;

  for (const task of taskDefinitions) {
    const start = Date.now();
    try {
      const result = await task.run();
      recordLaneTask(report, {
        name: task.name,
        status: result.status,
        message: result.message,
        details: result.details,
        duration: Date.now() - start,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      recordLaneTask(report, {
        name: task.name,
        status: 'failed',
        message,
        duration: Date.now() - start,
      });
    }
  }

  if (options.skipDbAudits) {
    recordLaneTask(report, {
      name: 'Data Integrity Monitor',
      status: 'skipped',
      message: 'Skipped via --skip-db-audits.',
    });
    recordLaneTask(report, {
      name: 'Content Completeness Dashboard',
      status: 'skipped',
      message: 'Skipped via --skip-db-audits.',
    });
  } else {
    const dataIntegrityStart = Date.now();
    const dataIntegrityLog = path.join(artifactDirectory, `data-integrity-${stamp}.log`);
    const dataIntegrity = runNpmCommand('db:health', ['run', 'db:health'], dataIntegrityLog);
    recordLaneTask(report, {
      name: 'Data Integrity Monitor',
      status: dataIntegrity.status,
      message: dataIntegrity.message,
      artifacts: dataIntegrity.artifacts,
      duration: Date.now() - dataIntegrityStart,
    });

    const completenessStart = Date.now();
    const completenessLog = path.join(artifactDirectory, `content-completeness-${stamp}.log`);
    const completenessArgs = ['run', 'db:completeness', '--'];

    if (options.skipCompletenessCsv) {
      completenessArgs.push('--file=content-completeness.csv');
    } else {
      const csvPath = path.join(artifactDirectory, `content-completeness-${stamp}.csv`);
      completenessArgs.push('--csv', `--file=${csvPath}`);
    }

    const completeness = runNpmCommand('db:completeness', completenessArgs, completenessLog);

    const completenessArtifacts = [...completeness.artifacts];
    if (!options.skipCompletenessCsv) {
      completenessArtifacts.push(path.join(artifactDirectory, `content-completeness-${stamp}.csv`));
    }

    recordLaneTask(report, {
      name: 'Content Completeness Dashboard',
      status: completeness.status,
      message: completeness.message,
      artifacts: completenessArtifacts,
      duration: Date.now() - completenessStart,
    });
  }

  finalizeLaneReport(report);
  printLaneConsoleSummary(report);

  const artifacts = writeLaneArtifacts({
    directory: 'logs/content-audit',
    slug: 'content-audit',
    title: 'Daily Content Audit Report',
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

export { main as runDailyContentAuditTasks };
