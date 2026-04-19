#!/usr/bin/env tsx
/**
 * Runtime Sanity Tasks
 *
 * Scheduler owner: .github/workflows/sched-runtime-sanity.yml
 * Recommended cadence: 17 * * * * (hourly, UTC)
 *
 * Runs on a fixed hourly cadence to verify platform health via signals that
 * are meaningful from GitHub Actions:
 * - Database connection verification
 * - Gemini API reachability
 * - Failed background job monitoring
 * - Queue health visibility
 * - Published content availability
 *
 * Usage: tsx scripts/automation/hourlyTasks.ts
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';

// Load environment variables
config();

interface HourlyReport {
  timestamp: Date;
  overallStatus: 'pass' | 'fail' | 'warning';
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    duration?: number;
  }[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

const report: HourlyReport = {
  timestamp: new Date(),
  overallStatus: 'pass',
  checks: [],
  summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
};

const CHECK_TIMEOUT_MS = 15_000;

function getOverallStatus(): 'pass' | 'fail' | 'warning' {
  if (report.summary.failed > 0) {
    return 'fail';
  }

  if (report.summary.warnings > 0) {
    return 'warning';
  }

  return 'pass';
}

async function withTimeout<T>(
  promise: Promise<T>,
  operationName: string,
  timeoutMs: number = CHECK_TIMEOUT_MS
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

/**
 * Check database connectivity
 */
async function checkDatabaseConnection(): Promise<void> {
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 'Database connectivity check');
    report.checks.push({
      name: 'Database Connection',
      status: 'pass',
      message: 'Database is accessible',
      duration: Date.now() - start,
    });
    report.summary.passed++;
  } catch (error: any) {
    report.checks.push({
      name: 'Database Connection',
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check Gemini API connectivity
 */
async function checkGeminiAPI(): Promise<void> {
  const start = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    report.checks.push({
      name: 'Gemini API Configuration',
      status: 'fail',
      message: 'GEMINI_API_KEY not configured',
      duration: Date.now() - start,
    });
    report.summary.failed++;
    return;
  }

  try {
    // Simple connectivity test
    const response = await withTimeout(
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      }),
      'Gemini API connectivity check'
    );

    if (response.ok) {
      report.checks.push({
        name: 'Gemini API Connection',
        status: 'pass',
        message: 'Gemini API is accessible',
        duration: Date.now() - start,
      });
      report.summary.passed++;
    } else {
      report.checks.push({
        name: 'Gemini API Connection',
        status: 'fail',
        message: `Gemini API returned status ${response.status}`,
        duration: Date.now() - start,
      });
      report.summary.failed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Gemini API Connection',
      status: 'fail',
      message: `Failed to reach Gemini API: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Monitor failed background jobs
 */
async function monitorBackgroundJobs(): Promise<void> {
  const start = Date.now();
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const failedJobs = await withTimeout(
      prisma.backgroundJob.count({
        where: {
          status: 'failed',
          updatedAt: { gte: oneHourAgo },
        },
      }),
      'Failed background job monitor'
    );

    if (failedJobs === 0) {
      report.checks.push({
        name: 'Background Jobs',
        status: 'pass',
        message: 'No failed jobs in the last hour',
        duration: Date.now() - start,
      });
      report.summary.passed++;
    } else if (failedJobs < 5) {
      report.checks.push({
        name: 'Background Jobs',
        status: 'warning',
        message: `${failedJobs} jobs failed in the last hour`,
        duration: Date.now() - start,
      });
      report.summary.warnings++;
    } else {
      report.checks.push({
        name: 'Background Jobs',
        status: 'fail',
        message: `${failedJobs} jobs failed in the last hour - investigate immediately`,
        duration: Date.now() - start,
      });
      report.summary.failed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Background Jobs',
      status: 'fail',
      message: `Failed to check jobs: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check medical content availability
 */
async function checkContentAvailability(): Promise<void> {
  const start = Date.now();
  try {
    const contentCount = await withTimeout(
      prisma.medicalContent.count({
        where: { status: 'published' },
      }),
      'Published content availability check'
    );

    if (contentCount === 0) {
      report.checks.push({
        name: 'Content Availability',
        status: 'fail',
        message: 'No published content found - database may need seeding',
        duration: Date.now() - start,
      });
      report.summary.failed++;
    } else if (contentCount < 100) {
      report.checks.push({
        name: 'Content Availability',
        status: 'warning',
        message: `Only ${contentCount} published conditions - expected 500+`,
        duration: Date.now() - start,
      });
      report.summary.warnings++;
    } else {
      report.checks.push({
        name: 'Content Availability',
        status: 'pass',
        message: `${contentCount} published conditions available`,
        duration: Date.now() - start,
      });
      report.summary.passed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Content Availability',
      status: 'fail',
      message: `Failed to check content: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Check queue health using overdue pending and stale processing jobs.
 */
async function checkQueueHealth(): Promise<void> {
  const start = Date.now();
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [staleProcessingJobs, overduePendingJobs] = await withTimeout(
      Promise.all([
        prisma.backgroundJob.count({
          where: {
            status: 'processing',
            startedAt: { lte: thirtyMinutesAgo },
          },
        }),
        prisma.backgroundJob.count({
          where: {
            status: 'pending',
            scheduledFor: { lte: oneHourAgo },
          },
        }),
      ]),
      'Queue health check'
    );

    if (staleProcessingJobs === 0 && overduePendingJobs === 0) {
      report.checks.push({
        name: 'Queue Health',
        status: 'pass',
        message: 'No stale processing jobs or overdue pending jobs detected',
        duration: Date.now() - start,
      });
      report.summary.passed++;
    } else if (staleProcessingJobs + overduePendingJobs < 5) {
      report.checks.push({
        name: 'Queue Health',
        status: 'warning',
        message: `${staleProcessingJobs} stale processing jobs and ${overduePendingJobs} overdue pending jobs detected`,
        duration: Date.now() - start,
      });
      report.summary.warnings++;
    } else {
      report.checks.push({
        name: 'Queue Health',
        status: 'fail',
        message: `${staleProcessingJobs} stale processing jobs and ${overduePendingJobs} overdue pending jobs detected - investigate queue health`,
        duration: Date.now() - start,
      });
      report.summary.failed++;
    }
  } catch (error: any) {
    report.checks.push({
      name: 'Queue Health',
      status: 'fail',
      message: `Failed to check queue health: ${error.message}`,
      duration: Date.now() - start,
    });
    report.summary.failed++;
  }
}

/**
 * Print report to console
 */
function printReport(): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║    Runtime Sanity Report                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`⏰ Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`🧭 Overall Status: ${report.overallStatus}`);
  console.log(
    `📊 Summary: ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.warnings} warnings\n`
  );

  report.checks.forEach((check) => {
    const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
    const duration = check.duration ? ` (${check.duration}ms)` : '';
    console.log(`${icon} ${check.name}${duration}`);
    console.log(`   ${check.message}\n`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Build a markdown summary for GitHub Actions summaries and artifact review.
 */
function buildMarkdownSummary(jsonPath: string): string {
  const lines = [
    '### Runtime Sanity Report',
    '',
    `- Timestamp: ${report.timestamp.toISOString()}`,
    `- Overall status: ${report.overallStatus}`,
    `- Checks run: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Warnings: ${report.summary.warnings}`,
    `- JSON artifact: ${jsonPath}`,
    '',
    '| Check | Status | Duration (ms) | Message |',
    '| --- | --- | ---: | --- |',
  ];

  for (const check of report.checks) {
    lines.push(
      `| ${check.name} | ${check.status} | ${check.duration ?? 0} | ${check.message.replace(/\|/g, '\\|')} |`
    );
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Save report artifacts to disk for tracking.
 */
function saveReport(): { jsonPath: string; markdownPath: string } {
  const reportDir = path.join(process.cwd(), 'logs', 'hourly');

  // Create directory if it doesn't exist
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const filename = `hourly-${report.timestamp.toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = path.join(reportDir, filename);
  const markdownPath = filepath.replace(/\.json$/, '.md');

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, buildMarkdownSummary(filepath));
  console.log(`💾 Report saved to: ${filepath}\n`);
  console.log(`📝 Summary saved to: ${markdownPath}\n`);

  return {
    jsonPath: filepath,
    markdownPath,
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Starting runtime sanity checks...\n');

  const checks = [
    { name: 'Database Connection', run: checkDatabaseConnection },
    { name: 'Gemini API Connection', run: checkGeminiAPI },
    { name: 'Background Jobs', run: monitorBackgroundJobs },
    { name: 'Queue Health', run: checkQueueHealth },
    { name: 'Content Availability', run: checkContentAvailability },
  ];

  report.summary.total = checks.length;

  try {
    for (const check of checks) {
      console.log(`▶ Running ${check.name}...`);
      await check.run();
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error during runtime sanity checks:', error);
    report.checks.push({
      name: 'Runtime Sanity Execution',
      status: 'fail',
      message: `Fatal execution error: ${error.message}`,
    });
    report.summary.failed++;
  }

  report.overallStatus = getOverallStatus();
  printReport();
  saveReport();

  try {
    await disconnectPrisma();
  } catch (error: any) {
    console.error('Failed to disconnect Prisma cleanly:', error.message);
  }

  if (report.summary.failed > 0) {
    console.log('⚠️  One or more runtime sanity checks failed. Review the report above.');
    process.exit(1);
  }

  if (report.summary.warnings > 0) {
    console.log('⚠️  Runtime sanity checks completed with warnings.');
    process.exit(0);
  }

  console.log('✅ All runtime sanity checks passed!');
  process.exit(0);
}

const isDirectRun =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

// Run if executed directly
if (isDirectRun) {
  main().catch(async (err) => {
    console.error(err);
    await disconnectPrisma();
    process.exit(1);
  });
}

export { main as runHourlyTasks };
