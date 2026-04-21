/**
 * POST /api/cron/analyze-exam-outcomes
 *
 * Weekly cron job: Analyze exam outcomes and content effectiveness.
 * Processes ExamOutcome records to compute SystemPredictiveness metrics.
 *
 * Auth: Requires CRON_SECRET bearer token (via cronEndpoint timing-safe check).
 */

import { cronEndpoint, ok } from '../_shared/endpoint';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { computeSystemPredictiveness } from '../_shared/outcomeOptimizationService';

export const onRequestPost = cronEndpoint({
  handler: async (context) => {
    const { env } = context;
    const prisma = createEdgePrismaClient(env.DATABASE_URL);
    const startTime = Date.now();

    try {
      console.log('[outcomeAnalysis] Starting weekly exam outcome analysis');

      const recentOutcomes = await prisma.examOutcome.findMany({
        where: { examDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { examType: true },
        distinct: ['examType'],
      });

      const examTypes = recentOutcomes.map((o) => o.examType);
      console.log(`[outcomeAnalysis] Found ${examTypes.length} exam types with recent outcomes`);

      const analysisResults: Record<string, unknown> = {};

      for (const examType of examTypes) {
        try {
          await computeSystemPredictiveness(examType);

          const predictiveness = await prisma.systemPredictiveness.findMany({
            where: { examType },
            orderBy: { correlation: 'desc' },
          });

          const strongPredictors = predictiveness.filter((p) => p.correlation > 0.6);
          const weakPredictors = predictiveness.filter((p) => p.correlation < 0.2);
          const unknownPredictors = predictiveness.filter((p) => p.sampleSize < 3 || p.confidenceLevel < 0.5);

          analysisResults[examType] = {
            systemsAnalyzed: predictiveness.length,
            strongPredictors: strongPredictors.map((p) => ({
              system: p.system,
              correlation: parseFloat(p.correlation.toFixed(2)),
              confidence: parseFloat(p.confidenceLevel.toFixed(2)),
            })),
            weakPredictors: weakPredictors.slice(0, 3).map((p) => p.system),
            unknownPredictors: unknownPredictors.length,
            contentQualityDiff:
              strongPredictors.length > 0
                ? parseFloat(
                    (strongPredictors[0]!.highHealthQuestionsScore - strongPredictors[0]!.lowHealthQuestionsScore).toFixed(1)
                  )
                : 0,
          };
        } catch (error) {
          console.warn(`[outcomeAnalysis] Error analyzing ${examType}:`, error);
          analysisResults[examType] = { error: 'Analysis failed' };
        }
      }

      interface Alert { severity: 'critical' | 'warning' | 'info'; examType: string; message: string; }
      const alerts: Alert[] = [];

      for (const examType of examTypes) {
        const predictiveness = await prisma.systemPredictiveness.findMany({ where: { examType } });

        const unknownCount = predictiveness.filter((p) => p.sampleSize < 3 || p.confidenceLevel < 0.5).length;
        if (unknownCount > predictiveness.length / 2) {
          alerts.push({ severity: 'warning', examType, message: `${unknownCount}/${predictiveness.length} systems have insufficient outcome data` });
        }
        const negativePredictors = predictiveness.filter((p) => p.correlation < -0.3);
        if (negativePredictors.length > 0) {
          alerts.push({ severity: 'warning', examType, message: `${negativePredictors.length} systems show inverse correlation with exam performance` });
        }
      }

      const summary = {
        examTypesAnalyzed: examTypes.length,
        systemsAnalyzed: Object.values(analysisResults).reduce<number>((sum, r) => sum + (((r as Record<string, number>).systemsAnalyzed) || 0), 0),
        alertsGenerated: alerts.length,
        durationMs: Date.now() - startTime,
      };

      console.log('[outcomeAnalysis] Analysis complete:', summary);

      return ok({ summary, results: analysisResults, alerts });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
});
