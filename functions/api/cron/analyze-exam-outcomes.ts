import { Request, Response } from '@cloudflare/workers-types';
import { computeSystemPredictiveness } from '../_shared/outcomeOptimizationService';
import { prisma } from '../_shared/prisma-edge';

/**
 * Weekly cron job: Analyze exam outcomes and content effectiveness
 *
 * Processes recent ExamOutcome records to:
 * 1. Compute SystemPredictiveness metrics (correlation with exam success)
 * 2. Identify which systems/content predict exam performance
 * 3. Update content weighting for question selection
 * 4. Generate alerts about effectiveness patterns
 *
 * Runs weekly (or after significant exam activity)
 */
export default async function analyzeExamOutcomes(
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

    console.log('[outcomeAnalysis] Starting weekly exam outcome analysis');

    // Get all exam types with recent outcomes
    const recentOutcomes = await prisma.examOutcome.findMany({
      where: {
        examDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: { examType: true },
      distinct: ['examType'],
    });

    const examTypes = recentOutcomes.map(o => o.examType);

    console.log(`[outcomeAnalysis] Found ${examTypes.length} exam types with recent outcomes`);

    // Compute predictiveness for each exam type
    const analysisResults: Record<string, unknown> = {};

    for (const examType of examTypes) {
      try {
        console.log(`[outcomeAnalysis] Computing predictiveness for ${examType}`);
        await computeSystemPredictiveness(examType);

        // Get the results
        const predictiveness = await prisma.systemPredictiveness.findMany({
          where: { examType },
          orderBy: { correlation: 'desc' },
        });

        // Find systems with strong predictiveness
        const strongPredictors = predictiveness.filter(p => p.correlation > 0.6);
        const weakPredictors = predictiveness.filter(p => p.correlation < 0.2);
        const unknownPredictors = predictiveness.filter(
          p => p.sampleSize < 3 || p.confidenceLevel < 0.5
        );

        analysisResults[examType] = {
          systemsAnalyzed: predictiveness.length,
          strongPredictors: strongPredictors.map(p => ({
            system: p.system,
            correlation: parseFloat(p.correlation.toFixed(2)),
            confidence: parseFloat(p.confidenceLevel.toFixed(2)),
          })),
          weakPredictors: weakPredictors.slice(0, 3).map(p => p.system),
          unknownPredictors: unknownPredictors.length,
          contentQualityDiff:
            strongPredictors.length > 0
              ? parseFloat(
                  (strongPredictors[0]!.highHealthQuestionsScore -
                    strongPredictors[0]!.lowHealthQuestionsScore).toFixed(1)
                )
              : 0,
        };
      } catch (error) {
        console.warn(`[outcomeAnalysis] Error analyzing ${examType}:`, error);
        analysisResults[examType] = { error: 'Analysis failed' };
      }
    }

    // Generate alerts for low-predictiveness systems
    interface Alert {
      severity: 'critical' | 'warning' | 'info';
      examType: string;
      message: string;
    }

    const alerts: Alert[] = [];

    for (const examType of examTypes) {
      const predictiveness = await prisma.systemPredictiveness.findMany({
        where: { examType },
      });

      const unknownCount = predictiveness.filter(
        p => p.sampleSize < 3 || p.confidenceLevel < 0.5
      ).length;

      if (unknownCount > predictiveness.length / 2) {
        alerts.push({
          severity: 'warning',
          examType,
          message: `${unknownCount}/${predictiveness.length} systems have insufficient outcome data`,
        });
      }

      const negativePredictors = predictiveness.filter(p => p.correlation < -0.3);
      if (negativePredictors.length > 0) {
        alerts.push({
          severity: 'warning',
          examType,
          message: `${negativePredictors.length} systems show inverse correlation with exam performance`,
        });
      }
    }

    // Log summary
    const summary = {
      timestamp: new Date().toISOString(),
      examTypesAnalyzed: examTypes.length,
      systemsAnalyzed: Object.values(analysisResults).reduce<number>(
        (sum, result) => sum + ((result as Record<string, number>).systemsAnalyzed || 0),
        0
      ),
      alertsGenerated: alerts.length,
      durationMs: Date.now() - startTime,
    };

    console.log('[outcomeAnalysis] Analysis complete:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results: analysisResults,
        alerts,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[outcomeAnalysis] Error:', errorMessage);

    return new Response(
      JSON.stringify({
        error: 'Outcome analysis failed',
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
