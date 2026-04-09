import { Request } from '@cloudflare/workers-types';
import { requireAuth } from '../../_shared/auth';
import { errorHandler } from '../../_shared/error-handler';
import { getExamReadinessBySystem } from '../../_shared/phenotypeService';
import { prisma } from '../../_shared/prisma-edge';

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
export async function onRequestGet(request: Request): Promise<Response> {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const examType = url.searchParams.get('examType') || 'PANCE';

    // Get user's phenotype
    const phenotype = await prisma.userStudyPhenotype.findUnique({
      where: { userId: user.id },
    });

    if (!phenotype) {
      return new Response(
        JSON.stringify({
          error: 'No phenotype available',
          message: 'User study profile has not been computed yet',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get exam readiness by system
    const readinessBySystem = await getExamReadinessBySystem(user.id, examType);

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

      // Get question count for system
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

    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return errorHandler(error);
  }
}
