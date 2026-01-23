import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ContrastiveSetsSchema = z.object({
  query: z.object({
    symptom: z.string().optional(),
    system: z.string().optional(),
    highYield: z.enum(['true', 'false']).optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestGet = authenticatedEndpoint(ContrastiveSetsSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/contrastive/sets');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { symptom, system, highYield } = validated.query;

    const where: any = {};
    if (symptom) where.symptom = symptom;
    if (system) where.system = system;
    if (highYield === 'true') where.highYield = true;

    const sets = await prisma.contrastiveSet.findMany({
      where,
      orderBy: { symptom: 'asc' },
    });

    logger.info(`Fetched ${sets.length} contrastive sets`, {
      userId: auth.userId,
      symptom,
      system,
      highYield,
    });
    return { data: { sets, total: sets.length } };
  } catch (error) {
    logger.error('Failed to fetch contrastive sets', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to fetch contrastive sets');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
