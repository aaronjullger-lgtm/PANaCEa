/**
 * GET /api/ddx/related
 *
 * Get related differential diagnoses for a condition
 * Leverages ConditionRelation and DifferentialConditionLink tables
 */

import { z } from 'zod';
import { publicEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const RelatedSchema = z.object({
  query: z.object({
    conditionId: z.string().optional(),
    conditionName: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const onRequestGet = publicEndpoint(RelatedSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/ddx/related');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const conditionId = validated.query?.conditionId;
    const conditionName = validated.query?.conditionName;
    const limit = Math.min(parseInt(validated.query?.limit || '10'), 50);

    if (!conditionId && !conditionName) {
      return { data: { error: 'conditionId or conditionName required' }, status: 400 };
    }

    // Resolve the condition
    let condition;
    if (conditionId) {
      condition = await prisma.condition.findUnique({
        where: { id: conditionId },
        select: { id: true, name: true, system: true },
      });
    } else if (conditionName) {
      condition = await prisma.condition.findFirst({
        where: {
          OR: [
            { name: { contains: conditionName, mode: 'insensitive' } },
            { displayName: { contains: conditionName, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, system: true },
      });
    }

    if (!condition) {
      return { data: { error: 'Condition not found', relatedConditions: [] }, status: 404 };
    }

    // Get related conditions from ConditionRelation table
    const [relationsFrom, relationsTo] = await Promise.all([
      prisma.conditionRelation.findMany({
        where: {
          conditionId1: condition.id,
          relationType: { in: ['differential', 'associated', 'complication'] },
        },
        include: {
          Condition2: {
            select: { id: true, name: true, displayName: true, system: true, subcategory: true },
          },
        },
        take: limit,
      }),
      prisma.conditionRelation.findMany({
        where: {
          conditionId2: condition.id,
          relationType: { in: ['differential', 'associated'] },
          bidirectional: true,
        },
        include: {
          Condition1: {
            select: { id: true, name: true, displayName: true, system: true, subcategory: true },
          },
        },
        take: limit,
      }),
    ]);

    // Get DifferentialDiagnosis entries
    const differentialDiagnosis = await prisma.differentialDiagnosis.findFirst({
      where: {
        OR: [{ differentialList: { has: condition.name } }, { primaryConditionId: condition.id }],
      },
      select: {
        presentingComplaint: true,
        differentialList: true,
        mustNotMiss: true,
        distinguishingFeatures: true,
        mostCommon: true,
        mostDangerous: true,
        redFlags: true,
        keyExamFindings: true,
        keyQuestions: true,
      },
    });

    // Get conditions in the same system (fallback)
    const sameSystemConditions = await prisma.condition.findMany({
      where: { system: condition.system, id: { not: condition.id } },
      select: { id: true, name: true, displayName: true, system: true, subcategory: true },
      take: Math.max(0, limit - relationsFrom.length - relationsTo.length),
    });

    // Define types for Prisma query results
    type ConditionSelect = {
      id: string;
      name: string;
      displayName: string | null;
      system: string;
      subcategory: string | null;
    };
    type RelationFromResult = {
      relationType: string;
      clinicalContext: string | null;
      Condition2: ConditionSelect | null;
    };
    type RelationToResult = { relationType: string; Condition1: ConditionSelect | null };

    // Combine and deduplicate
    const relatedMap = new Map<
      string,
      ConditionSelect & {
        relationshipType: string;
        clinicalContext?: string | null;
        source: string;
      }
    >();

    relationsFrom.forEach((rel: RelationFromResult) => {
      if (rel.Condition2 && !relatedMap.has(rel.Condition2.id)) {
        relatedMap.set(rel.Condition2.id, {
          ...rel.Condition2,
          relationshipType: rel.relationType,
          clinicalContext: rel.clinicalContext,
          source: 'direct_relation',
        });
      }
    });

    relationsTo.forEach((rel: RelationToResult) => {
      if (rel.Condition1 && !relatedMap.has(rel.Condition1.id)) {
        relatedMap.set(rel.Condition1.id, {
          ...rel.Condition1,
          relationshipType: rel.relationType,
          source: 'bidirectional_relation',
        });
      }
    });

    sameSystemConditions.forEach((c: ConditionSelect) => {
      if (!relatedMap.has(c.id)) {
        relatedMap.set(c.id, { ...c, relationshipType: 'same_system', source: 'system_match' });
      }
    });

    const relatedConditions = Array.from(relatedMap.values()).slice(0, limit);

    logger.info('Fetched related conditions', {
      conditionId: condition.id,
      count: relatedConditions.length,
    });

    return {
      data: {
        condition: { id: condition.id, name: condition.name, system: condition.system },
        relatedConditions,
        differentialContext: differentialDiagnosis
          ? {
              presentingComplaint: differentialDiagnosis.presentingComplaint,
              mustNotMiss: differentialDiagnosis.mustNotMiss,
              mostDangerous: differentialDiagnosis.mostDangerous,
              redFlags: differentialDiagnosis.redFlags,
              keyExamFindings: differentialDiagnosis.keyExamFindings,
              distinguishingFeatures: differentialDiagnosis.distinguishingFeatures,
            }
          : null,
        totalFound: relatedConditions.length,
      },
    };
  } catch (error) {
    logger.error('Error fetching related conditions', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch related conditions');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
