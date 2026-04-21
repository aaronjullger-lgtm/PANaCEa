import { z } from 'zod';
import { adminEndpoint } from '../../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../../_shared/endpoint';
import { createEndpointLogger } from '../../../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { assembleQuestionFromSeed } from '../../../_shared/question-seeds';

// Schema for path parameters - ID comes from URL
const AssembleSeedSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestGet = adminEndpoint(AssembleSeedSchema, async (context) => {
  const { env, params } = context;
  const { id } = params as { id: string };
  const logger = createEndpointLogger('questions/seeds/[id]/assemble');

  if (!env.DATABASE_URL) {
    return fail(ErrorCode.ENV_MISCONFIGURED, { message: 'Database not configured' });
  }

  const prisma = createEdgePrismaClient(env);

  try {
    logger.info('Assembling question from seed', { seedId: id });

    const question = await assembleQuestionFromSeed(prisma, id);

    logger.info('Successfully assembled question from seed', { seedId: id });

    return ok({ question });
  } catch (error) {
    logger.error('Failed to assemble question from seed', {
      seedId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return fail(ErrorCode.INTERNAL_ERROR, {
      message: error instanceof Error ? error.message : 'Failed to assemble question from seed',
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
