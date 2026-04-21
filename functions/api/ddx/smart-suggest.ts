/**
 * GET /api/ddx/smart-suggest
 *
 * AI-powered intelligent DDx suggestions based on:
 * - User's mastery levels (FSRS data)
 * - User's confusion patterns
 * - PANCE yield ratings
 * - Symptom/finding overlap
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { authenticateRequest } from '../_shared/auth';

const SmartSuggestSchema = z.object({
  query: z.object({
    conditionId: z.string(),
    limit: z.string().optional(),
  }),
});

interface SmartSuggestion {
  conditionId: string;
  conditionName: string;
  system: string;
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  context: {
    type: 'weakness' | 'confusion' | 'similar' | 'complication' | 'mastery_gap';
    details: string;
    actionable: string;
  };
  relatedConditionId?: string;
  panceYield?: number;
  masteryLevel?: string;
}

export const onRequestGet = publicEndpoint(SmartSuggestSchema, async (context) => {
  const { request, env, validated } = context;
  const logger = createEndpointLogger('/api/ddx/smart-suggest');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  // Try to authenticate (optional - enriches suggestions if logged in)
  const auth = await authenticateRequest(request, env);
  const userId = auth?.userId;

  try {
    const conditionId = validated.query?.conditionId;
    const limit = Math.min(parseInt(validated.query?.limit || '10'), 50);

    if (!conditionId) {
      return { data: { error: 'conditionId required' }, status: 400 };
    }

    const condition = await prisma.medicalContent.findUnique({
      where: { id: conditionId },
      select: {
        id: true,
        conditionId: true,
        condition: true,
        system: true,
        subcategory: true,
        buzzwords: true,
        symptoms: true,
        gold_standard_dx: true,
        first_line_rx: true,
        pance_yield: true,
        classic_patient: true,
        riskFactors: true,
      },
    });

    if (!condition) {
      return { data: { error: 'Condition not found' }, status: 404 };
    }

    const suggestions: SmartSuggestion[] = [];
    const userMastery: Map<string, { stability: number; difficulty: number; state: number }> =
      new Map();

    // 1. Get user-specific data if authenticated
    if (userId) {
      const masteryRecords = await prisma.userProgress.findMany({
        where: { userId },
        select: { conditionId: true, fsrsCard: true },
        take: 500,
      });
      masteryRecords.forEach((record: { conditionId: string; fsrsCard: unknown }) => {
        const card = record.fsrsCard as {
          stability?: number;
          difficulty?: number;
          state?: number;
        } | null;
        if (card)
          userMastery.set(record.conditionId, {
            stability: card.stability || 0,
            difficulty: card.difficulty || 5,
            state: card.state || 0,
          });
      });

      const confusions = await prisma.confusionPair.findMany({
        where: {
          userId,
          OR: [{ realConditionId: conditionId }, { mistakenForId: conditionId }],
          count: { gte: 2 },
        },
        include: {
          RealCondition: { select: { id: true, name: true } },
          MistakenCondition: { select: { id: true, name: true } },
        },
        orderBy: { count: 'desc' },
        take: 5,
      });

      type ConfusionResult = {
        realConditionId: string | null;
        mistakenForId: string | null;
        count: number;
        RealCondition: { id: string; name: string } | null;
        MistakenCondition: { id: string; name: string } | null;
      };
      confusions.forEach((cp: ConfusionResult) => {
        if (cp.realConditionId == null) return;
        const isRealCondition = cp.realConditionId === conditionId;
        const otherCondition = isRealCondition ? cp.MistakenCondition : cp.RealCondition;
        if (otherCondition) {
          suggestions.push({
            conditionId: otherCondition.id,
            conditionName: otherCondition.name,
            system: condition.system,
            reason: `You've confused ${condition.condition} with this ${cp.count} times`,
            priority: cp.count >= 5 ? 'critical' : 'high',
            context: {
              type: 'confusion',
              details: `${cp.count} confusion events recorded`,
              actionable: 'Review distinguishing features side-by-side',
            },
            relatedConditionId: conditionId,
            panceYield: condition.pance_yield || undefined,
          });
        }
      });
    }

    // 2. Get direct differential relations
    const directRelations = await prisma.conditionRelation.findMany({
      where: {
        OR: [
          { conditionId1: condition.conditionId, relationType: 'differential' },
          {
            conditionId2: condition.conditionId,
            relationType: 'differential',
            bidirectional: true,
          },
        ],
      },
      include: {
        Condition1: { select: { id: true, name: true, system: true } },
        Condition2: { select: { id: true, name: true, system: true } },
      },
      take: 10,
    });

    type RelationResult = {
      conditionId1: string;
      conditionId2: string;
      clinicalContext: string | null;
      Condition1: { id: string; name: string; system: string } | null;
      Condition2: { id: string; name: string; system: string } | null;
    };
    directRelations.forEach((rel: RelationResult) => {
      const otherCondition =
        rel.conditionId1 === condition.conditionId ? rel.Condition2 : rel.Condition1;
      if (otherCondition && !suggestions.some((s) => s.conditionId === otherCondition.id)) {
        suggestions.push({
          conditionId: otherCondition.id,
          conditionName: otherCondition.name,
          system: otherCondition.system,
          reason: 'Direct differential diagnosis relationship',
          priority: 'high',
          context: {
            type: 'similar',
            details: rel.clinicalContext || 'Commonly confused on exams',
            actionable: 'Learn key distinguishing features',
          },
          relatedConditionId: conditionId,
        });
      }
    });

    // 3. Get conditions with similar buzzwords
    if (condition.buzzwords && condition.buzzwords.length > 0) {
      const similarByBuzzword = await prisma.medicalContent.findMany({
        where: { id: { not: conditionId }, buzzwords: { hasSome: condition.buzzwords } },
        select: { id: true, condition: true, system: true, buzzwords: true, pance_yield: true },
        take: 10,
      });

      type SimilarBuzzwordResult = {
        id: string;
        condition: string;
        system: string;
        buzzwords: string[];
        pance_yield: number | null;
      };
      similarByBuzzword.forEach((similar: SimilarBuzzwordResult) => {
        if (!suggestions.some((s) => s.conditionId === similar.id)) {
          const overlap = condition.buzzwords.filter((b: string) => similar.buzzwords.includes(b));
          suggestions.push({
            conditionId: similar.id,
            conditionName: similar.condition,
            system: similar.system,
            reason: `Shares ${overlap.length} buzzwords: ${overlap.slice(0, 3).join(', ')}`,
            priority: overlap.length >= 3 ? 'high' : 'medium',
            context: {
              type: 'similar',
              details: 'Overlapping buzzwords indicate similar presentations',
              actionable: 'Focus on unique buzzwords for each condition',
            },
            relatedConditionId: conditionId,
            panceYield: similar.pance_yield || undefined,
          });
        }
      });
    }

    // 4. Get complication relationships
    const complications = await prisma.conditionRelation.findMany({
      where: { conditionId1: condition.conditionId, relationType: 'complication' },
      include: { Condition2: { select: { id: true, name: true, system: true } } },
      take: 5,
    });

    type ComplicationResult = { Condition2: { id: string; name: string; system: string } | null };
    complications.forEach((rel: ComplicationResult) => {
      if (rel.Condition2 && !suggestions.some((s) => s.conditionId === rel.Condition2!.id)) {
        suggestions.push({
          conditionId: rel.Condition2.id,
          conditionName: rel.Condition2.name,
          system: rel.Condition2.system,
          reason: `Complication of ${condition.condition}`,
          priority: 'medium',
          context: {
            type: 'complication',
            details: 'Understanding complications improves clinical reasoning',
            actionable: 'Learn when this complication develops',
          },
          relatedConditionId: conditionId,
        });
      }
    });

    // 5. Find mastery gaps in same system (if authenticated)
    if (userId) {
      const sameSystemConditions = await prisma.medicalContent.findMany({
        where: { system: condition.system, id: { not: conditionId }, pance_yield: { gte: 2 } },
        select: { id: true, condition: true, system: true, pance_yield: true },
        orderBy: { pance_yield: 'desc' },
        take: 20,
      });

      type SystemConditionResult = {
        id: string;
        condition: string;
        system: string;
        pance_yield: number | null;
      };
      sameSystemConditions.forEach((ssc: SystemConditionResult) => {
        const mastery = userMastery.get(ssc.id);
        const isWeakArea = !mastery || mastery.stability < 1 || mastery.state === 0;
        if (isWeakArea && !suggestions.some((s) => s.conditionId === ssc.id)) {
          suggestions.push({
            conditionId: ssc.id,
            conditionName: ssc.condition,
            system: ssc.system,
            reason: `Low mastery in same system (${condition.system})`,
            priority: ssc.pance_yield && ssc.pance_yield >= 3 ? 'high' : 'low',
            context: {
              type: 'mastery_gap',
              details: mastery ? `Stability: ${mastery.stability.toFixed(1)}` : 'Not yet studied',
              actionable: 'Review this high-yield condition in the same system',
            },
            panceYield: ssc.pance_yield || undefined,
            masteryLevel: mastery ? getMasteryLevel(mastery) : 'new',
          });
        }
      });
    }

    // Sort by priority and limit
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    const finalSuggestions = suggestions.slice(0, limit);
    const studyRecommendation = generateStudyRecommendation(finalSuggestions, condition);

    logger.info('Generated smart suggestions', {
      conditionId,
      userId: userId || 'anonymous',
      count: finalSuggestions.length,
    });

    return {
      data: {
        targetCondition: {
          id: condition.id,
          name: condition.condition,
          system: condition.system,
          panceYield: condition.pance_yield,
        },
        suggestions: finalSuggestions,
        studyRecommendation,
        summary: {
          totalSuggestions: finalSuggestions.length,
          criticalCount: finalSuggestions.filter((s) => s.priority === 'critical').length,
          confusionBasedCount: finalSuggestions.filter((s) => s.context.type === 'confusion')
            .length,
          masteryGapCount: finalSuggestions.filter((s) => s.context.type === 'mastery_gap').length,
        },
        isAuthenticated: !!userId,
      },
    };
  } catch (error) {
    logger.error('Error generating smart suggestions', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to generate suggestions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});

function getMasteryLevel(mastery: {
  stability: number;
  difficulty: number;
  state: number;
}): string {
  if (mastery.state === 0) return 'new';
  if (mastery.stability >= 30) return 'mastered';
  if (mastery.stability >= 7) return 'proficient';
  if (mastery.stability >= 1) return 'learning';
  return 'struggling';
}

function generateStudyRecommendation(suggestions: SmartSuggestion[], condition: any): string {
  const confusionSuggestions = suggestions.filter((s) => s.context.type === 'confusion');
  const criticalSuggestions = suggestions.filter((s) => s.priority === 'critical');

  if (criticalSuggestions.length > 0)
    return `PRIORITY: Focus on distinguishing ${condition.condition} from ${criticalSuggestions[0]?.conditionName ?? 'this condition'}. You frequently confuse these conditions.`;
  if (confusionSuggestions.length > 0)
    return `Create a comparison table between ${condition.condition} and ${confusionSuggestions.map((s) => s.conditionName).join(', ')}.`;

  const highYieldSuggestions = suggestions.filter((s) => s.panceYield && s.panceYield >= 3);
  if (highYieldSuggestions.length > 0)
    return `Study ${condition.condition} alongside these high-yield differentials: ${highYieldSuggestions
      .slice(0, 3)
      .map((s) => s.conditionName)
      .join(', ')}.`;

  return `Review ${condition.condition} and its key differentials to strengthen your diagnostic reasoning.`;
}
