#!/usr/bin/env tsx
/**
 * Monthly Deep Audit
 *
 * Scheduler owner: .github/workflows/sched-monthly-deep-audit.yml
 * Recommended cadence: 29 9 1 * * (monthly, UTC)
 *
 * Purpose:
 * - run long-horizon audit work that is too expensive or noisy for daily and weekly lanes
 * - keep the packet report-first and separate from unattended remediation
 * - emit machine-readable artifacts plus a human-readable summary
 *
 * Usage:
 * - tsx scripts/automation/monthlyGovernance.ts
 * - tsx scripts/automation/monthlyGovernance.ts --skip-ai-sample --skip-media-audit
 */

import { config } from 'dotenv';
import {
  appendWorkflowSummary,
  createLaneReport,
  finalizeLaneReport,
  printLaneConsoleSummary,
  recordLaneTask,
  writeLaneArtifacts,
} from './shared/reporting';
import { runCapturedCommand, tailLines } from './shared/commandRunner';

config();

const ARTIFACT_DIRECTORY = 'logs/monthly-deep-audit';

interface CliOptions {
  runDriftDetector: boolean;
  runSearchVectorAudit: boolean;
  runAiSample: boolean;
  runLinkageAudit: boolean;
  runMediaAudit: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  return {
    runDriftDetector: !argv.includes('--skip-drift-detector'),
    runSearchVectorAudit: !argv.includes('--skip-search-vector-audit'),
    runAiSample: !argv.includes('--skip-ai-sample'),
    runLinkageAudit: !argv.includes('--skip-linkage-audit'),
    runMediaAudit: !argv.includes('--skip-media-audit'),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = createLaneReport('Monthly Deep Audit', {
    runDriftDetector: options.runDriftDetector,
    runSearchVectorAudit: options.runSearchVectorAudit,
    runAiSample: options.runAiSample,
    runLinkageAudit: options.runLinkageAudit,
    runMediaAudit: options.runMediaAudit,
  });

  if (options.runDriftDetector) {
    await runDriftDetector(report);
  } else {
    recordSkipped(report, 'AI Content Drift Detector', 'Skipped via CLI flag.');
  }

  if (options.runSearchVectorAudit) {
    await runSearchVectorAudit(report);
  } else {
    recordSkipped(report, 'Search Vector Coverage Audit', 'Skipped via CLI flag.');
  }

  if (options.runAiSample) {
    await runAiSample(report);
  } else {
    recordSkipped(report, 'AI Content Sample Review', 'Skipped via CLI flag.');
  }

  if (options.runLinkageAudit) {
    await runLinkageAudit(report);
  } else {
    recordSkipped(report, 'Question-to-Condition Linkage Audit', 'Skipped via CLI flag.');
  }

  if (options.runMediaAudit) {
    await runMediaAudit(report);
  } else {
    recordSkipped(report, 'Media Coverage Backlog Audit', 'Skipped via CLI flag.');
  }

  finalizeLaneReport(report);
  const artifacts = writeLaneArtifacts({
    directory: ARTIFACT_DIRECTORY,
    slug: 'monthly-deep-audit',
    title: 'Monthly Deep Audit',
    report,
  });

  appendWorkflowSummary(artifacts.markdownPath);
  printLaneConsoleSummary(report);

  if (report.overallStatus === 'fail') {
    process.exit(1);
  }
}

function recordSkipped(
  report: ReturnType<typeof createLaneReport>,
  name: string,
  message: string
): void {
  recordLaneTask(report, {
    name,
    status: 'skipped',
    message,
  });
}

async function runDriftDetector(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npx',
    args: ['tsx', 'scripts/cron/drift-detector.ts'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'deep-audit-drift-detector',
  });

  if (result.exitCode !== 0) {
    recordLaneTask(report, {
      name: 'AI Content Drift Detector',
      status: 'failed',
      message: 'Drift detector failed to complete.',
      duration: result.durationMs,
      artifacts: [result.logPath],
      details: {
        exitCode: result.exitCode,
        tail: tailLines(result.combinedOutput),
      },
    });
    return;
  }

  const flagged = matchNumber(result.combinedOutput, /Total Flagged:\s+(\d+)/i);

  recordLaneTask(report, {
    name: 'AI Content Drift Detector',
    status: flagged > 0 ? 'warning' : 'completed',
    message:
      flagged > 0
        ? `Drift detector flagged ${flagged} items for manual review.`
        : 'Drift detector completed without flagged items.',
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      flagged,
      tail: tailLines(result.combinedOutput),
    },
  });
}

async function runSearchVectorAudit(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npx',
    args: ['tsx', 'scripts/db/audit-search-vector.ts'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'deep-audit-search-vector',
  });

  if (result.exitCode !== 0) {
    recordLaneTask(report, {
      name: 'Search Vector Coverage Audit',
      status: 'failed',
      message: 'Search vector audit failed to complete.',
      duration: result.durationMs,
      artifacts: [result.logPath],
      details: {
        exitCode: result.exitCode,
        tail: tailLines(result.combinedOutput),
      },
    });
    return;
  }

  const nullCount = matchNumber(result.combinedOutput, /(\d+)\s+with NULL search_vector/i);
  const total = matchNumber(result.combinedOutput, /MedicalContent:\s+(\d+)\s+total/i);

  recordLaneTask(report, {
    name: 'Search Vector Coverage Audit',
    status: nullCount > 0 ? 'warning' : 'completed',
    message:
      nullCount > 0
        ? `${nullCount} of ${total || 'unknown'} MedicalContent rows still have NULL search_vector.`
        : 'All MedicalContent rows passed the search_vector audit.',
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      total,
      nullCount,
      tail: tailLines(result.combinedOutput),
    },
  });
}

async function runAiSample(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npx',
    args: ['tsx', 'scripts/db/sample-ai-content.ts'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'deep-audit-ai-sample',
  });

  if (result.exitCode !== 0) {
    recordLaneTask(report, {
      name: 'AI Content Sample Review',
      status: 'failed',
      message: 'AI content sample audit failed to complete.',
      duration: result.durationMs,
      artifacts: [result.logPath],
      details: {
        exitCode: result.exitCode,
        tail: tailLines(result.combinedOutput),
      },
    });
    return;
  }

  const totalRecords = matchNumber(result.combinedOutput, /Total records:\s+(\d+)/i);
  const mnemonicCount = matchNumber(result.combinedOutput, /Mnemonics:\s+(\d+)/i);
  const guidelinesCount = matchNumber(result.combinedOutput, /Guidelines:\s+(\d+)/i);
  const triadCount = matchNumber(result.combinedOutput, /Classic Triads:\s+(\d+)/i);

  recordLaneTask(report, {
    name: 'AI Content Sample Review',
    status: 'completed',
    message: `Captured AI content sample packet across ${totalRecords || 'unknown'} records.`,
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      totalRecords,
      mnemonicCount,
      guidelinesCount,
      triadCount,
      tail: tailLines(result.combinedOutput),
    },
  });
}

async function runLinkageAudit(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npx',
    args: ['tsx', 'scripts/db/link-questions-to-conditions.ts', '--audit-only'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'deep-audit-linkage',
  });

  if (result.exitCode !== 0) {
    recordLaneTask(report, {
      name: 'Question-to-Condition Linkage Audit',
      status: 'failed',
      message: 'Question-to-condition linkage audit failed to complete.',
      duration: result.durationMs,
      artifacts: [result.logPath],
      details: {
        exitCode: result.exitCode,
        tail: tailLines(result.combinedOutput),
      },
    });
    return;
  }

  const questionsOrphaned = matchSectionNumber(
    result.combinedOutput,
    'Question Table',
    /Orphaned \(no links\):\s+(\d+)/i
  );
  const preGenOrphaned = matchSectionNumber(
    result.combinedOutput,
    'PreGeneratedQuestion Table',
    /Orphaned \(no links\):\s+(\d+)/i
  );
  const attemptsOrphaned = matchSectionNumber(
    result.combinedOutput,
    'QuestionAttempt Table',
    /Orphaned \(no links\):\s+(\d+)/i
  );

  const orphanedTotal = questionsOrphaned + preGenOrphaned + attemptsOrphaned;

  recordLaneTask(report, {
    name: 'Question-to-Condition Linkage Audit',
    status: orphanedTotal > 0 ? 'warning' : 'completed',
    message:
      orphanedTotal > 0
        ? `Found ${orphanedTotal} orphaned question, pre-generated, or attempt records across linkage surfaces.`
        : 'Question linkage audit completed without orphaned records.',
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      questionsOrphaned,
      preGenOrphaned,
      attemptsOrphaned,
      tail: tailLines(result.combinedOutput),
    },
  });
}

async function runMediaAudit(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npx',
    args: ['tsx', 'scripts/media/audit-media-needs.ts'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'deep-audit-media',
  });

  if (result.exitCode !== 0) {
    recordLaneTask(report, {
      name: 'Media Coverage Backlog Audit',
      status: 'failed',
      message: 'Media backlog audit failed to complete.',
      duration: result.durationMs,
      artifacts: [result.logPath],
      details: {
        exitCode: result.exitCode,
        tail: tailLines(result.combinedOutput),
      },
    });
    return;
  }

  const overallCoverage = matchDecimal(result.combinedOutput, /Overall Coverage:\s+([\d.]+)%/i);
  const totalConditions = matchNumber(result.combinedOutput, /Total Conditions:\s+(\d+)/i);
  const conditionsWithMedia = matchNumber(result.combinedOutput, /Conditions with Media:\s+(\d+)/i);

  recordLaneTask(report, {
    name: 'Media Coverage Backlog Audit',
    status: 'completed',
    message:
      overallCoverage !== null
        ? `Captured media coverage snapshot: ${conditionsWithMedia}/${totalConditions} conditions with media (${overallCoverage.toFixed(1)}%).`
        : 'Captured media backlog snapshot for manual review.',
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      overallCoverage,
      totalConditions,
      conditionsWithMedia,
      tail: tailLines(result.combinedOutput),
    },
  });
}

function matchNumber(content: string, pattern: RegExp): number {
  const match = content.match(pattern);
  return match ? Number(match[1]) : 0;
}

function matchDecimal(content: string, pattern: RegExp): number | null {
  const match = content.match(pattern);
  return match ? Number(match[1]) : null;
}

function matchSectionNumber(content: string, section: string, pattern: RegExp): number {
  const sectionMatch = content.match(
    new RegExp(`${escapeRegex(section)}:[\\s\\S]*?${pattern.source}`, 'i')
  );

  if (!sectionMatch) {
    return 0;
  }

  const numberMatch = sectionMatch[0].match(pattern);
  return numberMatch ? Number(numberMatch[1]) : 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error('Monthly deep audit failed:', error);
  process.exit(1);
});
