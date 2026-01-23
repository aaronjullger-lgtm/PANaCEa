/**
 * GET /api/ddx/confusion-pairs
 *
 * Get user's personal confusion patterns - conditions they frequently confuse
 * Leverages the ConfusionPair table to provide personalized DDx insights
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ConfusionPairsSchema = z.object({
  query: z.object({
    limit: z.string().optional(),
    minCount: z.string().optional(),
    conditionId: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ConfusionPairsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/ddx/confusion-pairs');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const limit = Math.min(parseInt(validated.query?.limit || '10'), 50);
    const minCount = parseInt(validated.query?.minCount || '2');
    const conditionId = validated.query?.conditionId;

    const whereClause: any = { userId: auth.userId, count: { gte: minCount } };
    if (conditionId) {
      whereClause.OR = [
        { realConditionId: conditionId },
        { mistakenForId: conditionId },
        { correctConditionId: conditionId },
        { selectedConditionId: conditionId },
      ];
    }

    const confusionPairs = await prisma.confusionPair.findMany({
      where: whereClause,
      include: {
        RealCondition: { select: { id: true, name: true, displayName: true, system: true } },
        MistakenCondition: { select: { id: true, name: true, displayName: true, system: true } },
        CorrectCondition: { select: { id: true, condition: true, system: true } },
        SelectedCondition: { select: { id: true, condition: true, system: true } },
      },
      orderBy: [{ count: 'desc' }, { lastOccurrence: 'desc' }],
      take: limit,
    });

    // Define type for Prisma query result
    type ConfusionPairResult = {
      id: string;
      realCondition: string;
      mistakenFor: string;
      count: number;
      lastOccurrence: Date;
      realConditionId: string | null;
      mistakenForId: string | null;
      correctConditionId: string | null;
      selectedConditionId: string | null;
      RealCondition: {
        id: string;
        name: string;
        displayName: string | null;
        system: string;
      } | null;
      MistakenCondition: {
        id: string;
        name: string;
        displayName: string | null;
        system: string;
      } | null;
      CorrectCondition: { id: string; condition: string; system: string } | null;
      SelectedCondition: { id: string; condition: string; system: string } | null;
    };

    // Define type for enriched pair
    type EnrichedPair = {
      id: string;
      realCondition: string;
      mistakenFor: string;
      correctConditionId: string | null | undefined;
      selectedConditionId: string | null | undefined;
      count: number;
      lastOccurrence: Date;
      realConditionData: {
        id: string;
        condition?: string;
        name?: string;
        displayName?: string | null;
        system: string;
      } | null;
      mistakenConditionData: {
        id: string;
        condition?: string;
        name?: string;
        displayName?: string | null;
        system: string;
      } | null;
      severity: 'high' | 'medium' | 'low';
    };

    const enrichedPairs: EnrichedPair[] = confusionPairs.map((pair: ConfusionPairResult) => {
      const realConditionName = pair.CorrectCondition?.condition || pair.realCondition;
      const mistakenConditionName = pair.SelectedCondition?.condition || pair.mistakenFor;
      const severity: 'high' | 'medium' | 'low' =
        pair.count >= 5 ? 'high' : pair.count >= 3 ? 'medium' : 'low';

      return {
        id: pair.id,
        realCondition: realConditionName,
        mistakenFor: mistakenConditionName,
        correctConditionId:
          pair.correctConditionId ?? pair.CorrectCondition?.id ?? pair.realConditionId,
        selectedConditionId:
          pair.selectedConditionId ?? pair.SelectedCondition?.id ?? pair.mistakenForId,
        count: pair.count,
        lastOccurrence: pair.lastOccurrence,
        realConditionData: pair.CorrectCondition ?? pair.RealCondition,
        mistakenConditionData: pair.SelectedCondition ?? pair.MistakenCondition,
        severity,
      };
    });

    // Group by system for summary
    type SystemSummaryValue = {
      count: number;
      pairs: Array<{ real: string; mistaken: string; count: number }>;
    };
    const systemSummary = enrichedPairs.reduce(
      (acc: Record<string, SystemSummaryValue>, pair: EnrichedPair) => {
        const system = pair.realConditionData?.system || 'Unknown';
        if (!acc[system]) acc[system] = { count: 0, pairs: [] };
        acc[system].count += pair.count;
        acc[system].pairs.push({
          real: pair.realCondition,
          mistaken: pair.mistakenFor,
          count: pair.count,
        });
        return acc;
      },
      {} as Record<string, SystemSummaryValue>
    );

    const confusionScore = enrichedPairs.reduce(
      (sum: number, p: EnrichedPair) =>
        sum + p.count * (p.severity === 'high' ? 3 : p.severity === 'medium' ? 2 : 1),
      0
    );

    logger.info('Fetched confusion pairs', { userId: auth.userId, count: enrichedPairs.length });

    return {
      data: {
        userId: auth.userId,
        confusionPairs: enrichedPairs,
        totalPairs: enrichedPairs.length,
        confusionScore,
        systemSummary,
        recommendations: generateRecommendations(enrichedPairs),
      },
    };
  } catch (error) {
    logger.error('Error fetching confusion pairs', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch confusion pairs');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

function generateRecommendations(
  pairs: Array<{ realCondition: string; mistakenFor: string; count: number; severity: string }>
): string[] {
  const recommendations: string[] = [];
  const highSeverity = pairs.filter((p) => p.severity === 'high');
  const mediumSeverity = pairs.filter((p) => p.severity === 'medium');

  if (highSeverity.length > 0) {
    const topPair = highSeverity[0];
    if (topPair) {
      recommendations.push(
        `Focus on distinguishing ${topPair.realCondition} from ${topPair.mistakenFor} - you've confused these ${topPair.count} times.`
      );
    }
  }
  if (pairs.length > 3)
    recommendations.push('Consider creating a comparison table for your most confused conditions.');
  if (mediumSeverity.length > 2)
    recommendations.push(
      'Use the DDx Compare feature to study the key differences between similar conditions.'
    );
  if (pairs.length === 0)
    recommendations.push(
      "Great job! You don't have significant confusion patterns. Keep practicing!"
    );

  return recommendations;
}
