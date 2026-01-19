import { z } from 'zod';
import { adminEndpoint } from '../../../_shared/middleware';
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

export const onRequestOptions = (context: { request: Request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const onRequestPost = adminEndpoint(
  CheckRequestSchema,
  async (data, context) => {
    const { env, params } = context;
    const { id } = params as { id: string };
    const logger = createEndpointLogger('questions/staging/[id]/check');

    if (!env.DATABASE_URL) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database not configured',
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      logger.info('Running adequacy check on staging question', {
        stagingId: id,
        force: data.body?.force,
      });

      const result = await runAdequacyCheck(prisma, env, id);

      logger.info('Adequacy check completed', {
        stagingId: id,
        result: result ? 'passed' : 'failed',
      });

      return new Response(JSON.stringify({ success: true, result }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      logger.error('Failed to run adequacy check', {
        stagingId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run adequacy check',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);