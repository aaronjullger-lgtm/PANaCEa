import { Request, Response } from '@cloudflare/workers-types';
import {
  computeAllQuestionHealthScores,
  persistHealthScores,
  autoDemoteUnhealthyQuestions,
  getSystemHealthSummary,
} from '../_shared/contentHealthService';
import { prisma } from '../_shared/prisma-edge';

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
  _context: unknown
): Promise<Response> {
  const startTime = Date.now();

  try {
    // Verify request is from cron (check auth header if needed)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
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
