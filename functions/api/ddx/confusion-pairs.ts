/**
 * GET /api/ddx/confusion-pairs
 * 
 * Get user's personal confusion patterns - conditions they frequently confuse
 * Leverages the ConfusionPair table to provide personalized DDx insights
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { authenticateRequest } from '../_shared/auth';

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

  // Authenticate user
  const auth = await authenticateRequest(request, env);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const minCount = parseInt(url.searchParams.get('minCount') || '2');
  const conditionId = url.searchParams.get('conditionId'); // Optional: filter by specific condition

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Get user's confusion pairs
    const whereClause: any = {
      userId: auth.userId,
      count: { gte: minCount },
    };

    if (conditionId) {
      // Get confusion pairs involving this specific condition
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
        RealCondition: {
          select: {
            id: true,
            name: true,
            displayName: true,
            system: true,
          },
        },
        MistakenCondition: {
          select: {
            id: true,
            name: true,
            displayName: true,
            system: true,
          },
        },
        CorrectCondition: {
          select: {
            id: true,
            condition: true,
            system: true,
          },
        },
        SelectedCondition: {
          select: {
            id: true,
            condition: true,
            system: true,
          },
        },
      },
      orderBy: [
        { count: 'desc' },
        { lastOccurrence: 'desc' },
      ],
      take: limit,
    });

    // Enrich with distinguishing features
    const enrichedPairs = await Promise.all(
      confusionPairs.map(async (pair) => {
        // Try to get distinguishing features from ConditionRelation
        let distinguishingFeatures: string | null = null;
        
        if (pair.CorrectCondition && pair.SelectedCondition) {
          const relation = await prisma.conditionRelation.findFirst({
            where: {
              OR: [
                {
                  conditionId1: pair.CorrectCondition.id,
                  conditionId2: pair.SelectedCondition.id,
                  relationType: 'differential',
                },
                {
                  conditionId1: pair.SelectedCondition.id,
                  conditionId2: pair.CorrectCondition.id,
                  relationType: 'differential',
                },
              ],
            },
            select: {
              clinicalContext: true,
            },
          });
          distinguishingFeatures = relation?.clinicalContext || null;
        } else if (pair.RealCondition && pair.MistakenCondition) {
          const relation = await prisma.conditionRelation.findFirst({
            where: {
              OR: [
                { 
                  conditionId1: pair.RealCondition.id, 
                  conditionId2: pair.MistakenCondition.id,
                  relationType: 'differential',
                },
                { 
                  conditionId1: pair.MistakenCondition.id, 
                  conditionId2: pair.RealCondition.id,
                  relationType: 'differential',
                },
              ],
            },
            select: {
              clinicalContext: true,
            },
          });
          distinguishingFeatures = relation?.clinicalContext || null;
        }

        // Get MedicalContent for both conditions to extract key differences
        let keyDifferences: Record<string, { real: string | null; mistaken: string | null }> = {};
        
        if ((pair.correctConditionId || pair.realConditionId) && (pair.selectedConditionId || pair.mistakenForId)) {
          const [realContent, mistakenContent] = await Promise.all([
            prisma.medicalContent.findFirst({
              where: {
                OR: [
                  pair.correctConditionId ? { id: pair.correctConditionId } : undefined,
                  pair.realConditionId ? { conditionId: pair.realConditionId } : undefined,
                  pair.realCondition ? { condition: { equals: pair.realCondition, mode: 'insensitive' } } : undefined,
                ].filter(Boolean) as any,
              },
              select: {
                id: true,
                condition: true,
                system: true,
                gold_standard_dx: true,
                best_initial_test: true,
                first_line_rx: true,
                classic_patient: true,
                buzzwords: true,
              },
            }),
            prisma.medicalContent.findFirst({
              where: {
                OR: [
                  pair.selectedConditionId ? { id: pair.selectedConditionId } : undefined,
                  pair.mistakenForId ? { conditionId: pair.mistakenForId } : undefined,
                  pair.mistakenFor ? { condition: { equals: pair.mistakenFor, mode: 'insensitive' } } : undefined,
                ].filter(Boolean) as any,
              },
              select: {
                id: true,
                condition: true,
                system: true,
                gold_standard_dx: true,
                best_initial_test: true,
                first_line_rx: true,
                classic_patient: true,
                buzzwords: true,
              },
            }),
          ]);

          if (realContent && mistakenContent) {
            keyDifferences = {
              goldStandardDx: {
                real: realContent.gold_standard_dx,
                mistaken: mistakenContent.gold_standard_dx,
              },
              bestInitialTest: {
                real: realContent.best_initial_test,
                mistaken: mistakenContent.best_initial_test,
              },
              firstLineRx: {
                real: realContent.first_line_rx,
                mistaken: mistakenContent.first_line_rx,
              },
              classicPatient: {
                real: realContent.classic_patient,
                mistaken: mistakenContent.classic_patient,
              },
            };
          }
        } else if (pair.realCondition && pair.mistakenFor) {
          const [realContent, mistakenContent] = await Promise.all([
            prisma.medicalContent.findFirst({
              where: { condition: { contains: pair.realCondition, mode: 'insensitive' } },
              select: {
                gold_standard_dx: true,
                best_initial_test: true,
                first_line_rx: true,
                classic_patient: true,
                buzzwords: true,
              },
            }),
            prisma.medicalContent.findFirst({
              where: { condition: { contains: pair.mistakenFor, mode: 'insensitive' } },
              select: {
                gold_standard_dx: true,
                best_initial_test: true,
                first_line_rx: true,
                classic_patient: true,
                buzzwords: true,
              },
            }),
          ]);

          if (realContent && mistakenContent) {
            keyDifferences = {
              goldStandardDx: {
                real: realContent.gold_standard_dx,
                mistaken: mistakenContent.gold_standard_dx,
              },
              bestInitialTest: {
                real: realContent.best_initial_test,
                mistaken: mistakenContent.best_initial_test,
              },
              firstLineRx: {
                real: realContent.first_line_rx,
                mistaken: mistakenContent.first_line_rx,
              },
              classicPatient: {
                real: realContent.classic_patient,
                mistaken: mistakenContent.classic_patient,
              },
            };
          }
        }

        const realConditionName = pair.CorrectCondition?.condition || pair.realCondition;
        const mistakenConditionName = pair.SelectedCondition?.condition || pair.mistakenFor;

        return {
          id: pair.id,
          realCondition: realConditionName,
          mistakenFor: mistakenConditionName,
          correctConditionId: pair.correctConditionId ?? pair.CorrectCondition?.id ?? pair.realConditionId,
          selectedConditionId: pair.selectedConditionId ?? pair.SelectedCondition?.id ?? pair.mistakenForId,
          count: pair.count,
          lastOccurrence: pair.lastOccurrence,
          realConditionData: pair.CorrectCondition ?? pair.RealCondition,
          mistakenConditionData: pair.SelectedCondition ?? pair.MistakenCondition,
          distinguishingFeatures,
          keyDifferences,
          severity: pair.count >= 5 ? 'high' : pair.count >= 3 ? 'medium' : 'low',
        };
      })
    );

    // Group by system for summary
    const systemSummary = enrichedPairs.reduce((acc, pair) => {
      const system = pair.realConditionData?.system || 'Unknown';
      if (!acc[system]) {
        acc[system] = { count: 0, pairs: [] };
      }
      acc[system].count += pair.count;
      acc[system].pairs.push({
        real: pair.realCondition,
        mistaken: pair.mistakenFor,
        count: pair.count,
      });
      return acc;
    }, {} as Record<string, { count: number; pairs: Array<{ real: string; mistaken: string; count: number }> }>);

    // Calculate confusion score (higher = more confusion issues)
    const confusionScore = enrichedPairs.reduce((sum, p) => sum + p.count * (p.severity === 'high' ? 3 : p.severity === 'medium' ? 2 : 1), 0);

    return new Response(
      JSON.stringify({
        userId: auth.userId,
        confusionPairs: enrichedPairs,
        totalPairs: enrichedPairs.length,
        confusionScore,
        systemSummary,
        recommendations: generateRecommendations(enrichedPairs),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching confusion pairs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch confusion pairs' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate personalized study recommendations based on confusion patterns
 */
function generateRecommendations(pairs: Array<{ realCondition: string; mistakenFor: string; count: number; severity: string }>): string[] {
  const recommendations: string[] = [];
  
  const highSeverity = pairs.filter(p => p.severity === 'high');
  const mediumSeverity = pairs.filter(p => p.severity === 'medium');
  
  if (highSeverity.length > 0) {
    recommendations.push(
      `Focus on distinguishing ${highSeverity[0].realCondition} from ${highSeverity[0].mistakenFor} - you've confused these ${highSeverity[0].count} times.`
    );
  }
  
  if (pairs.length > 3) {
    recommendations.push(
      'Consider creating a comparison table for your most confused conditions.'
    );
  }
  
  if (mediumSeverity.length > 2) {
    recommendations.push(
      'Use the DDx Compare feature to study the key differences between similar conditions.'
    );
  }
  
  if (pairs.length === 0) {
    recommendations.push(
      'Great job! You don\'t have significant confusion patterns. Keep practicing!'
    );
  }
  
  return recommendations;
}
