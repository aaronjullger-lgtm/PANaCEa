/**
 * GET /api/drugs/:drugId
 *
 * Fetch complete drug details by ID, including related conditions
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

const DrugDetailSchema = z.object({
  params: z.object({
    drugId: z.string().min(1),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(DrugDetailSchema, async (context) => {
  const { env, validated } = context;
  const logger = createEndpointLogger('/api/drugs/[drugId]');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const drugId = validated.params?.drugId;
    if (!drugId) {
      return { data: { error: 'Drug ID is required' }, status: 400 };
    }

    const drug = await prisma.drug.findUnique({
      where: { id: drugId },
      include: {
        DrugConditionLink: {
          include: {
            Condition: {
              select: { id: true, condition: true, system: true },
            },
          },
        },
      },
    });

    if (!drug) {
      return { data: { error: 'Drug not found' }, status: 404 };
    }

    logger.info('Fetched drug detail', { drugId });
    return { data: drug, headers: { 'Cache-Control': 'public, max-age=3600' } };
  } catch (error) {
    logger.error('Failed to fetch drug', { error: error instanceof Error ? error.message : String(error) });
    throw new Error('Failed to fetch drug');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
