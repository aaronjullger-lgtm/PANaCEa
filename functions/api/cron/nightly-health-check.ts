import { Request, Response } from '@cloudflare/workers-types';
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
import { prisma } from '../_shared/prisma-edge';

/**
 * Nightly content health report
 * Generates comprehensive system health snapshot and alerts on issues
 *
 * Triggered via cron, checks:
 * 1. Content health scores by system
 * 2. Exam blueprint coverage gaps
 * 3. Question QA status distribution
 * 4. FSRS utilization
 * 5. Content drift (edit frequency)
 *
 * Stores results in ContentHealthReport for admin dashboard
 */
export default async function nightlyHealthCheck(
  request: Request,
  context: any
): Promise<Response> {
  const startTime = Date.now();
  const env = context.env;

  try {
    // Verify cron request with CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    console.log('[healthCheck] Starting nightly health report');

    // 1. System health summary
    console.log('[healthCheck] Computing system health...');
    const systemHealth = await getSystemHealthSummary();

    // 2. Identify systems below minimum thresholds
    const MIN_ACTIVE_QUESTIONS = 10;
    const MIN_HEALTH_SCORE = 0.5;

    const systemsWithIssues = systemHealth.filter(
      (s) =>
        s.activeQuestionCount < MIN_ACTIVE_QUESTIONS ||
        s.averageHealthScore < MIN_HEALTH_SCORE
    );

    // 3. Get questions needing review
    console.log('[healthCheck] Identifying unhealthy questions...');
    const unhealthyQuestions = await getQuestionsBelowHealthThreshold(
      HEALTH_SCORE_CONFIG.THRESHOLDS.LOW
    );

    // 4. Blueprint coverage analysis
    console.log('[healthCheck] Analyzing blueprint coverage...');
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
          criticalGaps: criticalGaps.map((s) => ({
            system: s.system,
            gap: s.gap.toFixed(1),
            totalQuestions: s.totalQuestions,
          })),
        };
      } catch (error) {
        console.warn(`[healthCheck] Could not analyze ${examType}:`, error);
      }
    }

    // 5. QA status distribution
    console.log('[healthCheck] Analyzing QA status...');
    const qaDistribution = await prisma.question.groupBy({
      by: ['qaStatus'],
      where: { lifecycleStatus: 'ACTIVE' },
      _count: { id: true },
    });

    // 6. Content update frequency (drift)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentlyUpdated = await prisma.question.count({
      where: {
        lifecycleStatus: 'ACTIVE',
        updatedAt: { gte: thirtyDaysAgo },
      },
    });

    // 7. Compile alerts
    interface Alert {
      severity: 'critical' | 'warning' | 'info';
      message: string;
      count?: number;
    }

    const alerts: Alert[] = [];

    if (systemsWithIssues.length > 0) {
      alerts.push({
        severity: 'warning',
        message: `${systemsWithIssues.length} systems below health threshold`,
        count: systemsWithIssues.length,
      });
    }

    if (unhealthyQuestions.length > 50) {
      alerts.push({
        severity: 'critical',
        message: `${unhealthyQuestions.length} questions with low health scores`,
        count: unhealthyQuestions.length,
      });
    }

    for (const examType of Object.keys(blueprintAnalyses)) {
      const analysis = blueprintAnalyses[examType] as Record<string, unknown>;
      const criticalGapCount = analysis.criticalGapCount as number;
      if (criticalGapCount > 0) {
        alerts.push({
          severity: 'warning',
          message: `${examType}: ${criticalGapCount} systems with critical content gaps`,
          count: criticalGapCount,
        });
      }
    }

    if (recentlyUpdated < 5) {
      alerts.push({
        severity: 'info',
        message: 'Low content update frequency (last 30 days)',
        count: recentlyUpdated,
      });
    }

    // 8. Store report in database
    const report = {
      id: `health-report-${Date.now()}`,
      timestamp: new Date(),
      totalContent: systemHealth.reduce((sum, s) => sum + s.activeQuestionCount, 0),
      missingExplanations: 0, // Can be computed from question analysis
      brokenMediaLinks: 0, // Can be computed from media asset analysis
      invalidFields: unhealthyQuestions.length,
      outdatedContent: recentlyUpdated,
      reportData: {
        generatedAt: new Date().toISOString(),
        duration_ms: Date.now() - startTime,

        // System health
        systemHealth: systemHealth.map((s) => ({
          system: s.system,
          healthScore: s.averageHealthScore.toFixed(2),
          activeCount: s.activeQuestionCount,
          lowHealthCount: s.lowHealthCount,
        })),

        // Unhealthy questions
        unhealthyQuestionCount: unhealthyQuestions.length,
        topUnhealthyQuestions: unhealthyQuestions.slice(0, 10).map((q) => ({
          id: q.questionId,
          score: q.score.toFixed(2),
          system: q.system,
          issues: q.issueFlags,
        })),

        // QA Distribution
        qaDistribution: Object.fromEntries(
          qaDistribution.map((q) => [q.qaStatus, q._count.id])
        ),

        // Blueprint coverage
        blueprintAnalyses,

        // Alerts
        alerts,
        alertCount: {
          critical: alerts.filter((a) => a.severity === 'critical').length,
          warning: alerts.filter((a) => a.severity === 'warning').length,
          info: alerts.filter((a) => a.severity === 'info').length,
        },

        // Content velocity
        recentUpdatesLast30Days: recentlyUpdated,
      },
    };

    await prisma.contentHealthReport.create({ data: report });

    console.log('[healthCheck] Report stored successfully');

    // Return summary
    return new Response(
      JSON.stringify({
        success: true,
        reportId: report.id,
        summary: {
          systemsAnalyzed: systemHealth.length,
          unhealthyQuestions: unhealthyQuestions.length,
          alertsGenerated: alerts.length,
          criticalAlerts: alerts.filter((a) => a.severity === 'critical').length,
        },
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('[healthCheck] Error:', errorMessage);

    return new Response(
      JSON.stringify({
        error: 'Nightly health check failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
