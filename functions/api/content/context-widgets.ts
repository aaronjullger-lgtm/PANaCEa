/**
 * GET /api/content/context-widgets
 *
 * Fetch related context for a condition (pharmacology, pathophysiology)
 * Used by ContextWidget component in Clinical Library
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const ContextWidgetsSchema = z.object({
  query: z.object({
    conditionId: z.string(),
    type: z.enum(['pharm', 'physio']),
  }),
});

export const onRequestGet = authenticatedEndpoint(ContextWidgetsSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/content/context-widgets');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const conditionId = validated.query?.conditionId;
    const widgetType = validated.query?.type;

    const condition = await prisma.medicalContent.findFirst({
      where: { OR: [{ id: conditionId }, { conditionId: conditionId }] },
      select: { condition: true, system: true, treatment: true, pathophysiology: true },
    });

    if (!condition) {
      return { data: { error: 'Condition not found' }, status: 404 };
    }

    const contextData: any = {};

    if (widgetType === 'pharm') {
      contextData.treatment = condition.treatment;
      const drugs = await prisma.medicalContent.findMany({
        where: { system: condition.system, status: 'published' },
        select: {
          id: true,
          condition: true,
          conditionId: true,
          treatment: true,
        },
        take: 5,
      });
      contextData.relatedDrugs = drugs;
    } else if (widgetType === 'physio') {
      contextData.pathophysiology = condition.pathophysiology;
      const relatedConditions = await prisma.medicalContent.findMany({
        where: { system: condition.system, id: { not: conditionId } },
        select: { id: true, condition: true, conditionId: true, pathophysiology: true },
        take: 3,
      });
      contextData.relatedConditions = relatedConditions;
    }

    logger.info('Fetched context widgets', { conditionId, type: widgetType });
    return { data: contextData, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    logger.error('Error fetching context', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Failed to fetch context');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
