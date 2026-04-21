import { z } from 'zod';
import { adminEndpoint } from '../../../_shared/middleware';
import { ok, fail, ErrorCode } from '../../../_shared/endpoint';
import { createEndpointLogger } from '../../../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { runAdequacyCheck } from '../../../_shared/staging-questions';

// Schema for check request
const CheckRequestSchema = z.object({
  body: z
    .object({
      force: z.boolean().optional(), // Optional: force recheck
    })
    .optional()
    .default({}),
});

export const onRequestPost = adminEndpoint(CheckRequestSchema, async (context) => {
  const { env, params, validated } = context;
  const { id } = params as { id: string };
  const logger = createEndpointLogger('questions/staging/[id]/check');

  if (!env.DATABASE_URL) {
    return fail(ErrorCode.ENV_MISCONFIGURED, { message: 'Database not configured' });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    logger.info('Running adequacy check on staging question', {
      stagingId: id,
      force: validated?.body?.force,
    });

    const result = await runAdequacyCheck(prisma, env, id);

    logger.info('Adequacy check completed', {
      stagingId: id,
      result: result ? 'passed' : 'failed',
    });

    return ok({ result });
  } catch (error) {
    logger.error('Failed to run adequacy check', {
      stagingId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return fail(ErrorCode.INTERNAL_ERROR, {
      message: error instanceof Error ? error.message : 'Failed to run adequacy check',
    });
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
