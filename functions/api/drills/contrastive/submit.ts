import { z } from 'zod';
import { authenticatedEndpoint } from '../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { createEndpointLogger } from '../../_shared/secureLogger';

const ContrastiveSubmitSchema = z.object({
  body: z.object({
    setId: z.string().min(1, 'setId is required'),
    selectedConditionId: z.string().min(1, 'selectedConditionId is required'),
    isCorrect: z.boolean(),
  }),
});

export const onRequestPost = authenticatedEndpoint(ContrastiveSubmitSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/drills/contrastive/submit');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { setId, selectedConditionId, isCorrect } = validated.body;

    // Record the attempt (you can extend this to store more analytics)
    // For now, just return success
    logger.info('Contrastive answer submitted', {
      userId: auth.userId,
      setId,
      selectedConditionId,
      isCorrect,
    });

    return {
      data: {
        success: true,
        correct: isCorrect,
      },
    };
  } catch (error) {
    logger.error('Failed to submit contrastive answer', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw error;
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
