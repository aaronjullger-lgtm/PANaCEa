/**
 * POST /api/cron/nightly-health-check
 *
 * Nightly content health report.
 * Generates comprehensive system health snapshot and alerts on issues.
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  getSystemHealthSummary,
  getQuestionsBelowHealthThreshold,
  HEALTH_SCORE_CONFIG,
} from '../_shared/contentHealthService';
import {
  analyzeBlueprintCoverage,
  getAvailableExamTypes,
  getCriticalGapSystems,
} from '../_shared/blueprintCoverageService';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    try {
      console.log('[healthCheck] Starting nightly health report');

      const systemHealth = await getSystemHealthSummary();

      const MIN_ACTIVE_QUESTIONS = 10;
      const MIN_HEALTH_SCORE = 0.5;
      const systemsWithIssues = systemHealth.filter(
        (s) => s.activeQuestionCount < MIN_ACTIVE_QUESTIONS || s.averageHealthScore < MIN_HEALTH_SCORE
      );

      const unhealthyQuestions = await getQuestionsBelowHealthThreshold(HEALTH_SCORE_CONFIG.THRESHOLDS.LOW);

      const examTypes = await getAvailableExamTypes();
      const blueprintAnalyses: Record<string, unknown> = {};
      for (const examType of examTypes) {
        try {
          const coverage = await analyzeBlueprintCoverage(examType);
          const criticalGaps = await getCriticalGapSystems(examType, 10);
          blueprintAnalyses[examType] = {
            totalApproved: coverage.totalApproved,
            gapsByPriority: coverage.gapsByPriority,
            criticalGapCount: criticalGaps.length,
            criticalGaps: criticalGaps.map((s) => ({ system: s.system, gap: s.gap.toFixed(1), totalQuestions: s.totalQuestions })),
          };
        } catch (error) {
          console.warn(`[healthCheck] Could not analyze ${examType}:`, error);
        }
      }

      const qaDistribution = await prisma.question.groupBy({
        by: ['qaStatus'],
        where: { lifecycleStatus: 'ACTIVE' },
        _count: { id: true },
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentlyUpdated = await prisma.question.count({
        where: { lifecycleStatus: 'ACTIVE', updatedAt: { gte: thirtyDaysAgo } },
      });

      interface Alert { severity: 'critical' | 'warning' | 'info'; message: string; count?: number; }
      const alerts: Alert[] = [];

      if (systemsWithIssues.length > 0) {
        alerts.push({ severity: 'warning', message: `${systemsWithIssues.length} systems below health threshold`, count: systemsWithIssues.length });
      }
      if (unhealthyQuestions.length > 50) {
        alerts.push({ severity: 'critical', message: `${unhealthyQuestions.length} questions with low health scores`, count: unhealthyQuestions.length });
      }
      for (const examType of Object.keys(blueprintAnalyses)) {
        const analysis = blueprintAnalyses[examType] as Record<string, unknown>;
        const criticalGapCount = analysis.criticalGapCount as number;
        if (criticalGapCount > 0) {
          alerts.push({ severity: 'warning', message: `${examType}: ${criticalGapCount} systems with critical content gaps`, count: criticalGapCount });
        }
      }
      if (recentlyUpdated < 5) {
        alerts.push({ severity: 'info', message: 'Low content update frequency (last 30 days)', count: recentlyUpdated });
      }

      const reportId = `health-report-${Date.now()}`;
      await prisma.contentHealthReport.create({
        data: {
          id: reportId,
          timestamp: new Date(),
          totalContent: systemHealth.reduce((sum, s) => sum + s.activeQuestionCount, 0),
          missingExplanations: 0,
          brokenMediaLinks: 0,
          invalidFields: unhealthyQuestions.length,
          outdatedContent: recentlyUpdated,
          reportData: {
            generatedAt: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            systemHealth: systemHealth.map((s) => ({ system: s.system, healthScore: s.averageHealthScore.toFixed(2), activeCount: s.activeQuestionCount, lowHealthCount: s.lowHealthCount })),
            unhealthyQuestionCount: unhealthyQuestions.length,
            topUnhealthyQuestions: unhealthyQuestions.slice(0, 10).map((q) => ({ id: q.questionId, score: q.score.toFixed(2), system: q.system, issues: q.issueFlags })),
            qaDistribution: Object.fromEntries(qaDistribution.map((q) => [q.qaStatus, q._count.id])),
            blueprintAnalyses,
            alerts,
            alertCount: {
              critical: alerts.filter((a) => a.severity === 'critical').length,
              warning: alerts.filter((a) => a.severity === 'warning').length,
              info: alerts.filter((a) => a.severity === 'info').length,
            },
            recentUpdatesLast30Days: recentlyUpdated,
          },
        },
      });

      console.log('[healthCheck] Report stored successfully');

      return ok({
        reportId,
        summary: {
          systemsAnalyzed: systemHealth.length,
          unhealthyQuestions: unhealthyQuestions.length,
          alertsGenerated: alerts.length,
          criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
        },
        duration_ms: Date.now() - startTime,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
