/**
 * POST /api/cron/compute-content-health
 *
 * Nightly cron job: Compute and persist content health scores.
 * Also auto-demotes unhealthy questions and audits safety-field completeness.
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import {
  computeAllQuestionHealthScores,
  persistHealthScores,
  autoDemoteUnhealthyQuestions,
  getSystemHealthSummary,
} from '../_shared/contentHealthService';
import { scoreSafetyCompleteness } from '@/lib/constants/safety-critical-fields';
import { getFreshnessState, FRESHNESS_SLA_DAYS, AGING_SLA_DAYS } from '@/lib/constants/content-freshness';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    try {
      console.log('[contentHealth] Starting nightly compute job');

      const scores = await computeAllQuestionHealthScores();
      console.log(`[contentHealth] Computed scores for ${scores.length} questions`);

      await persistHealthScores(scores);

      const demoted = await autoDemoteUnhealthyQuestions();
      if (demoted > 0) console.log(`[contentHealth] Auto-demoted ${demoted} unhealthy questions`);

      const systemHealth = await getSystemHealthSummary();

      console.log('[contentHealth] Auditing MedicalContent safety completeness and freshness...');
      const contentRecords = await prisma.medicalContent.findMany({
        where: { status: 'published' },
        select: {
          id: true,
          conditionId: true,
          condition: true,
          system: true,
          complications: true,
          first_line_rx: true,
          best_initial_test: true,
          gold_standard_dx: true,
          differentialDiagnosis: true,
          riskFactors: true,
          content: true,
          lastClinicalReviewAt: true,
        },
      });

      let safetyFullyComplete = 0;
      let safetyPartiallyComplete = 0;
      let safetyMissingAll = 0;
      const safetyMissingByField: Record<string, number> = {};
      let freshnessStale = 0;
      let freshnessAging = 0;
      let freshnessFresh = 0;
      let freshnessUnknown = 0;
      const conditionsWithIncompleteSafety: string[] = [];

      for (const record of contentRecords) {
        const contentJson = (record.content && typeof record.content === 'object' && !Array.isArray(record.content))
          ? record.content as Record<string, unknown>
          : {};
        const flattened: Record<string, unknown> = {
          complications: record.complications,
          first_line_rx: record.first_line_rx,
          best_initial_test: record.best_initial_test,
          gold_standard_dx: record.gold_standard_dx,
          differentialDiagnosis: record.differentialDiagnosis,
          riskFactors: record.riskFactors,
          rx_side_effects: contentJson['rx_side_effects'] ?? null,
        };
        const { filled, total, missing } = scoreSafetyCompleteness(flattened);
        if (filled === total) {
          safetyFullyComplete++;
        } else if (filled === 0) {
          safetyMissingAll++;
          conditionsWithIncompleteSafety.push(record.condition ?? record.conditionId);
        } else {
          safetyPartiallyComplete++;
          if (filled < total - 2) conditionsWithIncompleteSafety.push(record.condition ?? record.conditionId);
        }
        for (const key of missing) {
          safetyMissingByField[key] = (safetyMissingByField[key] ?? 0) + 1;
        }
        const freshness = getFreshnessState(record.lastClinicalReviewAt ?? null);
        if (freshness.state === 'fresh') freshnessFresh++;
        else if (freshness.state === 'aging') freshnessAging++;
        else if (freshness.state === 'stale') freshnessStale++;
        else freshnessUnknown++;
      }

      const contentAudit = {
        totalPublished: contentRecords.length,
        safety: {
          fullyComplete: safetyFullyComplete,
          partiallyComplete: safetyPartiallyComplete,
          missingAll: safetyMissingAll,
          missingByField: safetyMissingByField,
          incompleteConditions: conditionsWithIncompleteSafety.slice(0, 20),
        },
        freshness: {
          fresh: freshnessFresh,
          aging: freshnessAging,
          stale: freshnessStale,
          unknown: freshnessUnknown,
          freshSladays: FRESHNESS_SLA_DAYS,
          agingSladays: AGING_SLA_DAYS,
        },
      };

      const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / (scores.length || 1);
      const snapshot = await prisma.contentHealthReport.create({
        data: {
          id: `snapshot-${Date.now()}`,
          timestamp: new Date(),
          totalContent: scores.length,
          reportData: {
            computedAt: new Date().toISOString(),
            totalQuestionsScored: scores.length,
            averageScore: avgScore,
            questionsBelow30: scores.filter((s) => s.score < 0.3).length,
            questionsBelow50: scores.filter((s) => s.score < 0.5).length,
            demotedCount: demoted,
            systemSummary: systemHealth,
            contentAudit,
          },
        },
      });

      console.log(`[contentHealth] Created health report snapshot: ${snapshot.id}`);

      return ok({
        questionsProcessed: scores.length,
        averageHealthScore: avgScore.toFixed(2),
        criticalIssues: scores.filter((s) => s.score < 0.3).length,
        demoted,
        duration_ms: Date.now() - startTime,
        systemHealthSnapshot: systemHealth.slice(0, 3),
        contentAudit,
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
