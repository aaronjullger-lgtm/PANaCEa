/**
 * GET /api/content/context-widgets
 * 
 * Fetch related context for a condition (pharmacology, pathophysiology)
 * Used by ContextWidget component in Clinical Library
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: any) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  // Authenticate user
  const { user, error: authError } = await authenticateRequest(context);
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const url = new URL(context.request.url);
    const conditionId = url.searchParams.get('conditionId');
    const widgetType = url.searchParams.get('type'); // 'pharm' | 'physio'

    if (!conditionId || !widgetType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: conditionId, type' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Get condition details
    const condition = await prisma.medicalContent.findFirst({
      where: {
        OR: [
          { id: conditionId },
          { conditionId: conditionId },
        ],
      },
      select: {
        condition: true,
        system: true,
        treatment: true,
        pathophysiology: true,
      },
    });

    if (!condition) {
      return new Response(
        JSON.stringify({ error: 'Condition not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    let contextData: any = {};

    if (widgetType === 'pharm') {
      // Fetch pharmacology context
      // 1. Get treatment info from condition
      contextData.treatment = condition.treatment;

      // 2. Find related drugs from Drug registry
      const drugs = await prisma.medicalContent.findMany({
        where: {
          content_type: 'drug',
          // Match drugs mentioned in treatment or find by condition
          OR: [
            { associatedConditions: { has: condition.condition } },
            // Could also search treatment text for drug names, but that's complex
          ],
        },
        select: {
          id: true,
          name: true,
          drugClass: true,
          mechanism: true,
          indications: true,
          adverseEffects: true,
        },
        take: 5,
      });

      contextData.relatedDrugs = drugs;
    } else if (widgetType === 'physio') {
      // Fetch pathophysiology context
      contextData.pathophysiology = condition.pathophysiology;

      // Find related conditions with similar pathophysiology
      const relatedConditions = await prisma.medicalContent.findMany({
        where: {
          content_type: 'condition',
          system: condition.system,
          id: { not: conditionId },
          // Could add pathophysiology similarity search here
        },
        select: {
          id: true,
          condition: true,
          conditionId: true,
          pathophysiology: true,
        },
        take: 3,
      });

      contextData.relatedConditions = relatedConditions;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid widget type. Use "pharm" or "physio"' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    return new Response(JSON.stringify(contextData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=600', // Cache for 10 minutes
      },
    });
  } catch (error) {
    console.error('[context-widgets] Error fetching context:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch context',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
