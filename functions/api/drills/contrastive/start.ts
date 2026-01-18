import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ContrastiveStartSchema = z.object({
  body: z.object({
    setId: z.string().min(1, 'setId is required'),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(ContrastiveStartSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/contrastive/start');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { setId } = validated.body;

    // Fetch the contrastive set
    const set = await prisma.contrastiveSet.findUnique({
      where: { id: setId },
      include: {
        conditions: true,
      },
    });

    if (!set) {
      logger.warn('Contrastive set not found', { setId, userId: auth.userId });
      throw new Error('Contrastive set not found');
    }

    logger.info('Contrastive drill started', { setId, userId: auth.userId });
    return { data: { set } };
  } catch (error) {
    logger.error('Failed to start contrastive drill', { error: error instanceof Error ? error.message : String(error), userId: auth.userId });
    throw error;
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
