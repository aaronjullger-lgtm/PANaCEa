#!/usr/bin/env tsx
/**
 * Weekly Platform Report
 *
 * Scheduler owner: .github/workflows/sched-weekly-platform-report.yml
 * Recommended cadence: 18 6 * * 0 (weekly, UTC)
 *
 * Purpose:
 * - produce a read-heavy weekly operator report
 * - keep weekly reporting separate from backup, cleanup, and AI-driven mutation
 * - emit machine-readable artifacts plus a human-readable summary
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { prisma, disconnectPrisma } from '../helpers/prisma-client';
import { auditUserProgress } from '../db/audit-user-progress';
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
  includeProgressCsv: boolean;
}

interface WeeklyDatabaseAudit {
  content: { total: number; published: number; draft: number };
  media: { total: number; approved: number; pending: number };
  users: { total: number; activeLastWeek: number };
  questions: { golden: number; staging: number };
}

interface WeeklyContentSnapshot {
  totalChecked: number;
  affectedConditions: number;
  healthScore: string;
  issues: {
    missingTreatment: number;
    missingDiagnostics: number;
    placeholderContent: number;
    outdatedUpdates: number;
  };
  outdatedConditions: Array<{
    condition: string;
    system: string | null;
    lastUpdated: string;
    daysOld: number;
  }>;
}

interface WeeklyPerformanceMetrics {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: string;
  systemBreakdown: Array<{ system: string; total: number; accuracy: string }>;
}

interface WeeklyRecommendationSnapshot {
  improvementSuggestions: string[];
  automationSuggestions: string[];
}

interface WeeklyReportContext {
  databaseAudit?: WeeklyDatabaseAudit;
  contentSnapshot?: WeeklyContentSnapshot;
  performanceMetrics?: WeeklyPerformanceMetrics;
  userProgressSummary?: {
    totalUserProgress: number;
    orphanedCount: number;
    missingProgressCount: number;
    staleCount: number;
    healthyCount: number;
  };
  recommendations?: WeeklyRecommendationSnapshot;
}

const ARTIFACT_DIRECTORY = path.join(process.cwd(), 'logs', 'weekly-platform-report');

function parseArgs(argv: string[]): CliOptions {
  return {
    includeProgressCsv: !argv.includes('--skip-progress-csv'),
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

async function collectDatabaseAudit(
  context: WeeklyReportContext
): Promise<{ message: string; details: WeeklyDatabaseAudit }> {
  const [totalContent, publishedContent, draftContent, totalMedia, approvedMedia, pendingMedia] =
    await Promise.all([
      prisma.medicalContent.count(),
      prisma.medicalContent.count({ where: { status: 'published' } }),
      prisma.medicalContent.count({ where: { status: 'draft' } }),
      prisma.mediaAsset.count(),
      prisma.mediaAsset.count({ where: { approvalStatus: 'approved' } }),
      prisma.mediaAsset.count({ where: { approvalStatus: 'pending' } }),
    ]);

  const [totalUsers, activeUsers, goldenQuestions, stagingQuestions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        PerformanceRecord: {
          some: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    }),
    prisma.question.count(),
    prisma.stagingQuestion.count(),
  ]);

  const details: WeeklyDatabaseAudit = {
    content: { total: totalContent, published: publishedContent, draft: draftContent },
    media: { total: totalMedia, approved: approvedMedia, pending: pendingMedia },
    users: { total: totalUsers, activeLastWeek: activeUsers },
    questions: { golden: goldenQuestions, staging: stagingQuestions },
  };

  context.databaseAudit = details;

  return {
    message: `${publishedContent} published conditions, ${approvedMedia} approved media assets, and ${activeUsers}/${totalUsers} active users in the last week.`,
    details,
  };
}

async function collectContentSnapshot(
  context: WeeklyReportContext
): Promise<{ message: string; details: WeeklyContentSnapshot }> {
  const publishedContent = await prisma.medicalContent.findMany({
    where: { status: 'published' },
    select: {
      condition: true,
      overview: true,
      treatment: true,
      diagnostics: true,
      system: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'asc' },
  });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const issues = {
    missingTreatment: 0,
    missingDiagnostics: 0,
    placeholderContent: 0,
    outdatedUpdates: 0,
  };

  let affectedConditions = 0;

  const outdatedConditions = publishedContent
    .filter((item) => item.updatedAt < oneYearAgo)
    .slice(0, 25)
    .map((item) => ({
      condition: item.condition,
      system: item.system,
      lastUpdated: item.updatedAt.toISOString().split('T')[0],
      daysOld: Math.floor((Date.now() - item.updatedAt.getTime()) / (1000 * 60 * 60 * 24)),
    }));

  for (const item of publishedContent) {
    let hasIssue = false;

    if (!item.treatment) {
      issues.missingTreatment += 1;
      hasIssue = true;
    }

    if (!item.diagnostics) {
      issues.missingDiagnostics += 1;
      hasIssue = true;
    }

    if (/\[NO CONTENT PROVIDED\]/i.test(item.overview || '')) {
      issues.placeholderContent += 1;
      hasIssue = true;
    }

    if (item.updatedAt < sixMonthsAgo) {
      issues.outdatedUpdates += 1;
      hasIssue = true;
    }

    if (hasIssue) {
      affectedConditions += 1;
    }
  }

  const healthScore =
    publishedContent.length > 0
      ? (((publishedContent.length - affectedConditions) / publishedContent.length) * 100).toFixed(
          2
        )
      : 'N/A';

  const details: WeeklyContentSnapshot = {
    totalChecked: publishedContent.length,
    affectedConditions,
    healthScore,
    issues,
    outdatedConditions,
  };

  context.contentSnapshot = details;

  return {
    message: `Checked ${publishedContent.length} published conditions; ${affectedConditions} need attention and ${outdatedConditions.length} are older than one year in the oldest 25 sample.`,
    details,
  };
}

async function collectWeeklyPerformanceMetrics(
  context: WeeklyReportContext
): Promise<{ message: string; details: WeeklyPerformanceMetrics }> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const perfRecords = await prisma.performanceRecord.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
    },
    select: {
      isCorrect: true,
      system: true,
    },
  });

  const totalQuestions = perfRecords.length;
  const correctAnswers = perfRecords.filter((record) => record.isCorrect).length;
  const accuracy =
    totalQuestions > 0 ? ((correctAnswers / totalQuestions) * 100).toFixed(2) : 'N/A';

  const systemStats: Record<string, { total: number; correct: number }> = {};
  for (const record of perfRecords) {
    const system = record.system || 'UNKNOWN';
    if (!systemStats[system]) {
      systemStats[system] = { total: 0, correct: 0 };
    }
    systemStats[system].total += 1;
    if (record.isCorrect) {
      systemStats[system].correct += 1;
    }
  }

  const details: WeeklyPerformanceMetrics = {
    totalQuestions,
    correctAnswers,
    accuracy,
    systemBreakdown: Object.entries(systemStats)
      .map(([system, stats]) => ({
        system,
        total: stats.total,
        accuracy: ((stats.correct / stats.total) * 100).toFixed(2),
      }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 15),
  };

  context.performanceMetrics = details;

  return {
    message:
      totalQuestions > 0
        ? `${totalQuestions} weekly answers recorded at ${accuracy}% accuracy across ${details.systemBreakdown.length} systems in the report sample.`
        : 'No weekly performance records were found for the last 7-day window.',
    details,
  };
}

async function collectUserProgressAudit(
  context: WeeklyReportContext,
  includeProgressCsv: boolean
): Promise<{ message: string; details: unknown; artifacts?: string[] }> {
  const audit = await auditUserProgress(includeProgressCsv, false, ARTIFACT_DIRECTORY);

  context.userProgressSummary = audit.summary;

  return {
    message: `UserProgress audit found ${audit.summary.orphanedCount} orphaned rows, ${audit.summary.missingProgressCount} missing-progress pairs, and ${audit.summary.staleCount} stale progress records.`,
    details: {
      summary: audit.summary,
      csvExportsEnabled: includeProgressCsv,
    },
    artifacts: audit.artifacts,
  };
}

async function collectRecommendationSnapshot(
  context: WeeklyReportContext
): Promise<{ message: string; details: WeeklyRecommendationSnapshot }> {
  const suggestions: string[] = [];
  const automationSuggestions: string[] = [];

  const healthScore = Number(context.contentSnapshot?.healthScore ?? 0);
  if (context.contentSnapshot && healthScore < 90) {
    suggestions.push(
      `Content health score is ${context.contentSnapshot.healthScore}%. Review the affected-condition sample before any automated repair is considered.`
    );
  }

  const outdatedCount = context.contentSnapshot?.outdatedConditions.length ?? 0;
  if (outdatedCount > 10) {
    suggestions.push(
      `${outdatedCount} conditions in the weekly sample are older than one year. Build a manual review queue instead of folding this into broad weekly mutation.`
    );
  }

  const pendingMedia = context.databaseAudit?.media.pending ?? 0;
  if (pendingMedia > 50) {
    suggestions.push(
      `${pendingMedia} media assets are pending review. Treat this as an operator queue problem, not a candidate for blind weekly cleanup.`
    );
  }

  const totalUsers = context.databaseAudit?.users.total ?? 0;
  const activeUsers = context.databaseAudit?.users.activeLastWeek ?? 0;
  const activeRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
  if (totalUsers > 0 && activeRate < 20) {
    suggestions.push(
      `Only ${activeRate.toFixed(1)}% of users were active last week. Prioritize operator-visible engagement diagnostics over new automated mutation.`
    );
  }

  automationSuggestions.push(
    'Add restore verification for weekly backups before expanding maintenance scope.'
  );
  automationSuggestions.push(
    'Keep psychometric snapshots read-heavy unless a dedicated learning-model lane is ready for incremental writes.'
  );
  automationSuggestions.push(
    'Fix analyze-exam-outcomes handler wiring before adding it to recurring weekly reporting.'
  );

  const details: WeeklyRecommendationSnapshot = {
    improvementSuggestions: suggestions,
    automationSuggestions,
  };

  context.recommendations = details;

  return {
    message: `Generated ${suggestions.length} operator recommendations and ${automationSuggestions.length} automation follow-ups.`,
    details,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const context: WeeklyReportContext = {};
  const report = createLaneReport('Weekly Platform Report', {
    scheduler: '.github/workflows/sched-weekly-platform-report.yml',
    cadence: '18 6 * * 0',
    includeProgressCsv: options.includeProgressCsv,
    scope: 'report-only weekly operator snapshot',
  });

  await runTask(report, 'Weekly Database Audit', () => collectDatabaseAudit(context));
  await runTask(report, 'Content Freshness and Integrity Snapshot', () =>
    collectContentSnapshot(context)
  );
  await runTask(report, 'Weekly Performance Metrics', () =>
    collectWeeklyPerformanceMetrics(context)
  );
  await runTask(report, 'User Progress Consistency Audit', () =>
    collectUserProgressAudit(context, options.includeProgressCsv)
  );
  await runTask(report, 'Operator Recommendation Snapshot', () =>
    collectRecommendationSnapshot(context)
  );

  report.metadata = {
    ...report.metadata,
    publishedContent: context.databaseAudit?.content.published ?? 'n/a',
    weeklyAnswers: context.performanceMetrics?.totalQuestions ?? 'n/a',
    staleUserProgress: context.userProgressSummary?.staleCount ?? 'n/a',
  };

  finalizeLaneReport(report);
  printLaneConsoleSummary(report);

  const artifacts = writeLaneArtifacts({
    directory: 'logs/weekly-platform-report',
    slug: 'weekly-platform-report',
    title: 'Weekly Platform Report',
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

export { main as runWeeklyPlatformReport };
