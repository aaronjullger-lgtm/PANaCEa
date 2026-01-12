/**
 * GET /api/ddx/related
 * 
 * Get related differential diagnoses for a condition
 * Leverages ConditionRelation and DifferentialConditionLink tables
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';

export async function onRequestGet(context: any) {
  const { request, env } = context;
  
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(request.url);
  const conditionId = url.searchParams.get('conditionId');
  const conditionName = url.searchParams.get('conditionName');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!conditionId && !conditionName) {
    return new Response(
      JSON.stringify({ error: 'conditionId or conditionName required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // First, resolve the condition
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
          ]
        },
        select: { id: true, name: true, system: true },
      });
    }

    if (!condition) {
      return new Response(
        JSON.stringify({ error: 'Condition not found', relatedConditions: [] }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
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
            select: {
              id: true,
              name: true,
              displayName: true,
              system: true,
              subcategory: true,
            },
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
            select: {
              id: true,
              name: true,
              displayName: true,
              system: true,
              subcategory: true,
            },
          },
        },
        take: limit,
      }),
    ]);

    // Get DifferentialDiagnosis entries that include this condition
    const differentialDiagnosis = await prisma.differentialDiagnosis.findFirst({
      where: {
        OR: [
          { differentialList: { has: condition.name } },
          { primaryConditionId: condition.id },
        ],
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

    // Get conditions in the same system/subcategory (fallback)
    const sameSystemConditions = await prisma.condition.findMany({
      where: {
        system: condition.system,
        id: { not: condition.id },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        system: true,
        subcategory: true,
      },
      take: Math.max(0, limit - relationsFrom.length - relationsTo.length),
    });

    // Combine and deduplicate
    const relatedMap = new Map<string, any>();
    
    // Priority 1: Direct differential relations
    relationsFrom.forEach(rel => {
      if (rel.Condition2 && !relatedMap.has(rel.Condition2.id)) {
        relatedMap.set(rel.Condition2.id, {
          ...rel.Condition2,
          relationshipType: rel.relationType,
          clinicalContext: rel.clinicalContext,
          source: 'direct_relation',
        });
      }
    });

    relationsTo.forEach(rel => {
      if (rel.Condition1 && !relatedMap.has(rel.Condition1.id)) {
        relatedMap.set(rel.Condition1.id, {
          ...rel.Condition1,
          relationshipType: rel.relationType,
          source: 'bidirectional_relation',
        });
      }
    });

    // Priority 2: Same system conditions
    sameSystemConditions.forEach(c => {
      if (!relatedMap.has(c.id)) {
        relatedMap.set(c.id, {
          ...c,
          relationshipType: 'same_system',
          source: 'system_match',
        });
      }
    });

    const relatedConditions = Array.from(relatedMap.values()).slice(0, limit);

    return new Response(
      JSON.stringify({
        condition: {
          id: condition.id,
          name: condition.name,
          system: condition.system,
        },
        relatedConditions,
        differentialContext: differentialDiagnosis ? {
          presentingComplaint: differentialDiagnosis.presentingComplaint,
          mustNotMiss: differentialDiagnosis.mustNotMiss,
          mostDangerous: differentialDiagnosis.mostDangerous,
          redFlags: differentialDiagnosis.redFlags,
          keyExamFindings: differentialDiagnosis.keyExamFindings,
          distinguishingFeatures: differentialDiagnosis.distinguishingFeatures,
        } : null,
        totalFound: relatedConditions.length,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching related conditions:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch related conditions' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await prisma.$disconnect();
  }
}
