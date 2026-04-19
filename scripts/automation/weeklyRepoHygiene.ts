#!/usr/bin/env tsx
/**
 * Weekly Repo Hygiene
 *
 * Scheduler owner: .github/workflows/sched-weekly-repo-hygiene.yml
 * Recommended cadence: 23 8 * * 6 (weekly, UTC)
 *
 * Purpose:
 * - keep repo-only drift visible without touching production data
 * - combine dependency/audit snapshots with workflow policy checks
 * - emit machine-readable artifacts plus a human-readable summary
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  appendWorkflowSummary,
  createLaneReport,
  finalizeLaneReport,
  printLaneConsoleSummary,
  recordLaneTask,
  writeLaneArtifacts,
} from './shared/reporting';
import { runCapturedCommand, tailLines } from './shared/commandRunner';

const ARTIFACT_DIRECTORY = 'logs/repo-hygiene';

interface WorkflowPolicyDetails {
  totalWorkflows: number;
  scheduledWorkflows: number;
  issues: Array<{
    file: string;
    issue: string;
  }>;
}

interface CliOptions {
  policyOnly: boolean;
  skipDependencyAudit: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  return {
    policyOnly: argv.includes('--policy-only'),
    skipDependencyAudit: argv.includes('--skip-dependency-audit'),
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = createLaneReport('Weekly Repo Hygiene', {
    workflowDirectory: '.github/workflows',
    policyOnly: options.policyOnly,
    skipDependencyAudit: options.skipDependencyAudit,
  });

  if (options.policyOnly || options.skipDependencyAudit) {
    recordLaneTask(report, {
      name: 'Dependency Vulnerability Snapshot',
      status: 'skipped',
      message: options.policyOnly
        ? 'Skipped in policy-only mode.'
        : 'Skipped via --skip-dependency-audit.',
    });
  } else {
    await runDependencyAudit(report);
  }

  await runWorkflowPolicyAudit(report);

  if (options.policyOnly) {
    for (const taskName of [
      'Prisma Disconnect Audit',
      'Zod Validation Audit',
      'Service Consolidation Audit',
      'Component Organization Audit',
    ]) {
      recordLaneTask(report, {
        name: taskName,
        status: 'skipped',
        message: 'Skipped in policy-only mode.',
      });
    }
  } else {
    await runRepoAudit(report, 'Prisma Disconnect Audit', 'repo-hygiene-prisma-audit', [
      'run',
      'audit:prisma',
    ]);
    await runRepoAudit(report, 'Zod Validation Audit', 'repo-hygiene-zod-audit', [
      'run',
      'audit:zod',
    ]);
    await runRepoAudit(report, 'Service Consolidation Audit', 'repo-hygiene-service-audit', [
      'run',
      'audit:services',
    ]);
    await runRepoAudit(report, 'Component Organization Audit', 'repo-hygiene-component-audit', [
      'run',
      'audit:components',
    ]);
  }

  await runPrettierCheck(report);

  finalizeLaneReport(report);
  const artifacts = writeLaneArtifacts({
    directory: ARTIFACT_DIRECTORY,
    slug: 'weekly-repo-hygiene',
    title: 'Weekly Repo Hygiene',
    report,
  });

  appendWorkflowSummary(artifacts.markdownPath);
  printLaneConsoleSummary(report);

  if (report.overallStatus === 'fail') {
    process.exit(1);
  }
}

async function runDependencyAudit(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npm',
    args: ['audit', '--omit=dev', '--json'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'dependency-audit',
  });

  const payload = parseJson(result.stdout || result.stderr || '{}');
  const vulnerabilities = payload?.metadata?.vulnerabilities ?? {};
  const critical = Number(vulnerabilities.critical ?? 0);
  const high = Number(vulnerabilities.high ?? 0);
  const moderate = Number(vulnerabilities.moderate ?? 0);
  const low = Number(vulnerabilities.low ?? 0);

  recordLaneTask(report, {
    name: 'Dependency Vulnerability Snapshot',
    status: critical + high > 0 ? 'failed' : moderate > 0 ? 'warning' : 'completed',
    message:
      critical + high > 0
        ? `Found ${critical} critical and ${high} high production vulnerabilities.`
        : moderate > 0
          ? `No critical/high production vulnerabilities; ${moderate} moderate issues remain.`
          : 'No production vulnerabilities reported by npm audit.',
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      vulnerabilities: { critical, high, moderate, low },
      exitCode: result.exitCode,
      tail: tailLines(result.combinedOutput),
    },
  });
}

async function runWorkflowPolicyAudit(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const workflowDirectory = path.join(process.cwd(), '.github', 'workflows');
  const workflowFiles = fs
    .readdirSync(workflowDirectory)
    .filter((file) => file.endsWith('.yml'))
    .sort();

  const details: WorkflowPolicyDetails = {
    totalWorkflows: workflowFiles.length,
    scheduledWorkflows: 0,
    issues: [],
  };

  for (const workflowFile of workflowFiles) {
    const absolutePath = path.join(workflowDirectory, workflowFile);
    const relativePath = path.relative(process.cwd(), absolutePath);
    const content = fs.readFileSync(absolutePath, 'utf8');

    const hasPermissions = /^\s*permissions\s*:/m.test(content);
    if (!hasPermissions) {
      details.issues.push({
        file: relativePath,
        issue: 'Missing explicit permissions block.',
      });
    }

    const hasHeaderComment =
      content.startsWith('# purpose:') &&
      content.includes('\n# owner:') &&
      content.includes('\n#') &&
      content.includes('failure');
    if (!hasHeaderComment) {
      details.issues.push({
        file: relativePath,
        issue: 'Missing required workflow header metadata comments.',
      });
    }

    const usesReusableLane = /\.\/\.github\/workflows\/_automation-lane\.yml/.test(content);
    const hasSetupNode = /actions\/setup-node@v4/.test(content);
    if (workflowFile === '_automation-lane.yml') {
      if (!reusableLaneUsesNode22(content)) {
        details.issues.push({
          file: relativePath,
          issue: 'Reusable automation lane does not default Node.js to version 22.',
        });
      }
    } else if (hasSetupNode && !usesNode22(content)) {
      details.issues.push({
        file: relativePath,
        issue: 'Workflow configures Node.js without pinning to version 22.',
      });
    }

    const cronExpressions = extractCronExpressions(content);
    const isScheduled = cronExpressions.length > 0;

    if (!isScheduled) {
      continue;
    }

    details.scheduledWorkflows += 1;

    if (!/^\s*workflow_dispatch\s*:/m.test(content)) {
      details.issues.push({
        file: relativePath,
        issue: 'Scheduled workflow is missing workflow_dispatch.',
      });
    }

    if (!/^\s*concurrency\s*:/m.test(content)) {
      details.issues.push({
        file: relativePath,
        issue: 'Scheduled workflow is missing concurrency control.',
      });
    }

    const hasTimeout =
      /timeout-minutes\s*:/m.test(content) ||
      (usesReusableLane && /timeout_minutes\s*:/m.test(content));

    if (!hasTimeout) {
      details.issues.push({
        file: relativePath,
        issue: 'Scheduled workflow is missing timeout-minutes.',
      });
    }

    for (const cron of cronExpressions) {
      const [minute] = cron.trim().split(/\s+/);
      if (minute === '0') {
        details.issues.push({
          file: relativePath,
          issue: `Scheduled workflow uses top-of-hour cron (${cron}).`,
        });
      }
    }
  }

  const policyReportPath = path.join(
    process.cwd(),
    ARTIFACT_DIRECTORY,
    `workflow-policy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.mkdirSync(path.dirname(policyReportPath), { recursive: true });
  fs.writeFileSync(policyReportPath, JSON.stringify(details, null, 2));

  recordLaneTask(report, {
    name: 'Workflow Policy Audit',
    status: details.issues.length > 0 ? 'failed' : 'completed',
    message:
      details.issues.length > 0
        ? `Found ${details.issues.length} workflow policy issues across ${details.totalWorkflows} workflow files.`
        : `All ${details.totalWorkflows} workflow files passed the repo policy audit.`,
    artifacts: [policyReportPath],
    details,
  });
}

async function runRepoAudit(
  report: ReturnType<typeof createLaneReport>,
  taskName: string,
  logSlug: string,
  npmArgs: string[]
): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npm',
    args: npmArgs,
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug,
  });

  const status = classifyRepoAudit(taskName, result);
  const tail = tailLines(result.combinedOutput);

  recordLaneTask(report, {
    name: taskName,
    status,
    message: buildRepoAuditMessage(taskName, status, result),
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      exitCode: result.exitCode,
      tail,
    },
  });
}

async function runPrettierCheck(report: ReturnType<typeof createLaneReport>): Promise<void> {
  const result = await runCapturedCommand({
    command: 'npx',
    args: ['prettier', '--check', '.github/workflows/*.yml', 'docs/automation/*.md'],
    logDirectory: ARTIFACT_DIRECTORY,
    logSlug: 'repo-hygiene-prettier',
  });

  recordLaneTask(report, {
    name: 'Automation Doc and Workflow Formatting Check',
    status: result.exitCode === 0 ? 'completed' : 'failed',
    message:
      result.exitCode === 0
        ? 'Prettier formatting check passed for workflow and automation docs.'
        : 'Prettier formatting drift detected in workflow or automation docs.',
    duration: result.durationMs,
    artifacts: [result.logPath],
    details: {
      exitCode: result.exitCode,
      tail: tailLines(result.combinedOutput),
    },
  });
}

function classifyRepoAudit(
  taskName: string,
  result: Awaited<ReturnType<typeof runCapturedCommand>>
): 'completed' | 'warning' | 'failed' {
  if (result.exitCode !== 0) {
    return 'failed';
  }

  if (taskName === 'Prisma Disconnect Audit') {
    const missingDisconnect = matchNumber(result.combinedOutput, /Missing disconnect\):\s+(\d+)/i);
    const missingFinally = matchNumber(result.combinedOutput, /Not in finally block\):\s+(\d+)/i);

    if (missingDisconnect > 0 || missingFinally > 0) {
      return 'failed';
    }
  }

  if (taskName === 'Zod Validation Audit') {
    const missingValidation = matchNumber(result.combinedOutput, /No validation\):\s+(\d+)/i);
    const manualOnly = matchNumber(result.combinedOutput, /Manual validation only\):\s+(\d+)/i);

    if (missingValidation > 0) {
      return 'failed';
    }

    if (manualOnly > 0) {
      return 'warning';
    }
  }

  return 'completed';
}

function buildRepoAuditMessage(
  taskName: string,
  status: 'completed' | 'warning' | 'failed',
  result: Awaited<ReturnType<typeof runCapturedCommand>>
): string {
  if (taskName === 'Prisma Disconnect Audit') {
    const missingDisconnect = matchNumber(result.combinedOutput, /Missing disconnect\):\s+(\d+)/i);
    const missingFinally = matchNumber(result.combinedOutput, /Not in finally block\):\s+(\d+)/i);

    if (status === 'completed') {
      return 'All Prisma-using API endpoints passed disconnect safety checks.';
    }

    return `${missingDisconnect} files are missing disconnect cleanup and ${missingFinally} files do not disconnect in finally blocks.`;
  }

  if (taskName === 'Zod Validation Audit') {
    const missingValidation = matchNumber(result.combinedOutput, /No validation\):\s+(\d+)/i);
    const manualOnly = matchNumber(result.combinedOutput, /Manual validation only\):\s+(\d+)/i);

    if (status === 'completed') {
      return 'All write-capable API endpoints passed runtime validation checks.';
    }

    if (status === 'warning') {
      return `${manualOnly} write endpoints still rely on manual validation patterns.`;
    }

    return `${missingValidation} write endpoints are missing runtime validation.`;
  }

  if (taskName === 'Service Consolidation Audit') {
    return 'Service consolidation report captured for maintainer review.';
  }

  if (taskName === 'Component Organization Audit') {
    return 'Component organization report captured for maintainer review.';
  }

  return result.exitCode === 0 ? 'Audit completed.' : 'Audit command failed.';
}

function extractCronExpressions(content: string): string[] {
  const expressions: string[] = [];
  const patterns = [/cron:\s*"([^"]+)"/g, /cron:\s*'([^']+)'/g];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      expressions.push(match[1]);
    }
  }

  return expressions;
}

function usesNode22(content: string): boolean {
  const hasNodeVersion22 =
    /node-version:\s*["']?22["']?/m.test(content) ||
    (/node-version:\s*\$\{\{\s*env\.NODE_VERSION\s*\}\}/m.test(content) &&
      /NODE_VERSION:\s*["']?22["']?/m.test(content));

  return hasNodeVersion22;
}

function reusableLaneUsesNode22(content: string): boolean {
  return (
    /node_version:[\s\S]*?default:\s*"22"/m.test(content) &&
    /node-version:\s*\$\{\{\s*inputs\.node_version\s*\}\}/m.test(content)
  );
}

function matchNumber(content: string, pattern: RegExp): number {
  const match = content.match(pattern);
  return match ? Number(match[1]) : 0;
}

function parseJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

main().catch((error) => {
  console.error('Weekly repo hygiene failed:', error);
  process.exit(1);
});
