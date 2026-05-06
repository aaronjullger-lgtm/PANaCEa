import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { getExamReadinessBySystem } from '../../_shared/phenotypeService';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';

const ExamReadinessQuerySchema = z.object({
  examType: z.enum(['PANCE', 'PANRE', 'EOR']).optional(),
});

/**
 * GET /api/users/me/exam-readiness
 * Get exam readiness assessment by system
 *
 * Query params:
 * - examType: "PANCE", "PANRE", "EOR" (default: PANCE)
 *
 * Returns:
 * - System-by-system readiness scores
 * - Blueprint targets vs current coverage
 * - Critical gaps needing focus
 * - Days until exam
 */
export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(
  ExamReadinessQuerySchema,
  async (context) => {
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);
    const examType = context.validated.examType ?? 'PANCE';
    const userId = context.auth.userId;

    try {
      // Look up internal user ID from Clerk ID
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { id: true },
      });
      if (!user) {
        return { status: 404, error: 'User not found' };
      }

      // Get user's phenotype
      const phenotype = await prisma.userStudyPhenotype.findUnique({
        where: { userId: user.id },
      });

      if (!phenotype) {
        return {
          status: 404,
          error: 'No phenotype available',
          data: { message: 'User study profile has not been computed yet' },
        };
      }
      // Get exam readiness by system
      const readinessBySystem = await getExamReadinessBySystem(user.id, examType, prisma);

      // Get blueprint targets
      const blueprintTargets = await prisma.examBlueprintSystem.findMany({
        where: { examType },
      });

      const blueprintMap = new Map(
        blueprintTargets.map(b => [b.system, { targetPercentage: b.targetPercentage }])
      );

      // Calculate coverage for each system
      const systemCoverage: Record<string, unknown>[] = [];
      for (const { system, readiness } of readinessBySystem) {
        const target = blueprintMap.get(system)?.targetPercentage || 10;

        const questionCount = await prisma.question.count({
          where: {
            system,
            lifecycleStatus: 'ACTIVE',
            qaStatus: 'APPROVED',
          },
        });

        systemCoverage.push({
          system,
          readiness: parseFloat((readiness * 100).toFixed(1)),
          targetCoverage: target,
          questionCount,
          status:
            readiness > 0.8 ? 'strong' : readiness > 0.6 ? 'good' : readiness > 0.4 ? 'weak' : 'critical',
        });
      }
      // Sort by readiness (weakest first)
      systemCoverage.sort((a, b) => (a.readiness as number) - (b.readiness as number));

      // Identify gaps
      const criticalGaps = systemCoverage.filter(
        s => (s.readiness as number) < 40 || phenotype.criticalGapsForExam.includes(s.system as string)
      );

      return {
        status: 200,
        data: {
          examType,
          overallReadiness: phenotype.estimatedReadiness,
          readinessPercentage: parseFloat((phenotype.estimatedReadiness * 100).toFixed(1)),
          daysUntilExam: phenotype.daysToExam,

          systemCoverage,

          gaps: {
            critical: criticalGaps.slice(0, 5).map(s => ({
              system: s.system,
              readiness: s.readiness,
              targetCoverage: s.targetCoverage,
            })),
            totalCriticalSystems: criticalGaps.length,
          },

          summary: {
            strongSystems: phenotype.strongSystems.length,
            weakSystems: phenotype.weakSystems.length,
            improvingAreas: phenotype.improvingAreas.length,
            totalSystemsAnalyzed: systemCoverage.length,
          },

          metadata: {
            lastComputedAt: phenotype.lastComputedAt?.toISOString(),
            computedAtDaysBeforeExam: phenotype.lastComputedAt
              ? Math.round(
                  (phenotype.daysToExam || 365) -
                  (new Date().getTime() - phenotype.lastComputedAt.getTime()) / (1000 * 60 * 60 * 24)
                )
              : null,
          },
        },
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'query', requestsPerMinute: 60 }
);
