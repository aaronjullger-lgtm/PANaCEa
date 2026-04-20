import { Request, Response } from '@cloudflare/workers-types';
import {
  computeAllQuestionHealthScores,
  persistHealthScores,
  autoDemoteUnhealthyQuestions,
  getSystemHealthSummary,
} from '../_shared/contentHealthService';
import { prisma } from '../_shared/prisma-edge';
import { scoreSafetyCompleteness } from '@/lib/constants/safety-critical-fields';
import { getFreshnessState, FRESHNESS_SLA_DAYS, AGING_SLA_DAYS } from '@/lib/constants/content-freshness';

/**
 * Nightly cron job: Compute and persist content health scores
 * Runs daily to evaluate question quality based on:
 * - Miss rates
 * - FSRS difficulty vs actual performance
 * - QA approval status
 *
 * Also automatically demotes questions with critical issues
 */
export default async function computeContentHealth(
  request: Request,
  context: any
): Promise<Response> {
  const startTime = Date.now();
  const env = context.env;

  try {
    // Verify request is from cron with CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    console.log('[contentHealth] Starting nightly compute job');

    // Step 1: Compute health scores for all questions
    console.log('[contentHealth] Computing health scores...');
    const scores = await computeAllQuestionHealthScores();
    console.log(`[contentHealth] Computed scores for ${scores.length} questions`);

    // Step 2: Persist scores to database
    console.log('[contentHealth] Persisting scores...');
    await persistHealthScores(scores);

    // Step 3: Auto-demote unhealthy questions
    console.log('[contentHealth] Checking for auto-demotion candidates...');
    const demoted = await autoDemoteUnhealthyQuestions();
    if (demoted > 0) {
      console.log(`[contentHealth] Auto-demoted ${demoted} unhealthy questions`);
    }

    // Step 4: Generate and store health summary
    console.log('[contentHealth] Generating system health summary...');
    const systemHealth = await getSystemHealthSummary();

    // Step 5: MedicalContent safety-field completeness + freshness audit
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
      // Flatten scalar fields + content JSON for the completeness check
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
        if (filled < total - 2) {
          conditionsWithIncompleteSafety.push(record.condition ?? record.conditionId);
        }
      }
      for (const key of missing) {
        safetyMissingByField[key] = (safetyMissingByField[key] ?? 0) + 1;
      }

      // Freshness
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

    console.log(`[contentHealth] Content audit: ${safetyFullyComplete}/${contentRecords.length} fully complete, ${freshnessStale} stale`);

    const snapshot = await prisma.contentHealthReport.create({
      data: {
        id: `snapshot-${Date.now()}`,
        timestamp: new Date(),
        totalContent: scores.length,
        reportData: {
          computedAt: new Date().toISOString(),
          totalQuestionsScored: scores.length,
          averageScore:
            scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
          questionsBelow30: scores.filter((s) => s.score < 0.3).length,
          questionsBelow50: scores.filter((s) => s.score < 0.5).length,
          demotedCount: demoted,
          systemSummary: systemHealth,
          contentAudit,
        },
      },
    });

    console.log(
      `[contentHealth] Created health report snapshot: ${snapshot.id}`
    );

    // Log summary
    const avgScore =
      scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const criticalCount = scores.filter((s) => s.score < 0.3).length;
    const duration = Date.now() - startTime;

    const summary = {
      success: true,
      questionsProcessed: scores.length,
      averageHealthScore: avgScore.toFixed(2),
      criticalIssues: criticalCount,
      demoted,
      duration_ms: duration,
      systemHealthSnapshot: systemHealth.slice(0, 3), // Top 3 worst systems
      contentAudit,
    };

    console.log('[contentHealth] Completed successfully', summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error('[contentHealth] Error:', errorMessage);

    return new Response(
      JSON.stringify({
        error: 'Content health computation failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
