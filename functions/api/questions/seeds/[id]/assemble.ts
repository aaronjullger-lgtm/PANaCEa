import { z } from 'zod';
import { adminEndpoint } from '../../../_shared/middleware';
import { createEndpointLogger } from '../../../_shared/secureLogger';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { assembleQuestionFromSeed } from '../../../_shared/question-seeds';

// Schema for path parameters - ID comes from URL
const AssembleSeedSchema = z.object({
  query: z.object({}).optional(),
});

export const onRequestOptions = (context: { request: Request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
};

export const onRequestGet = adminEndpoint(AssembleSeedSchema, async (context) => {
  const { env, params } = context;
  const { id } = params as { id: string };
  const logger = createEndpointLogger('questions/seeds/[id]/assemble');

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

  const prisma = createEdgePrismaClient(env);

  try {
    logger.info('Assembling question from seed', { seedId: id });

    const question = await assembleQuestionFromSeed(prisma, id);

    logger.info('Successfully assembled question from seed', { seedId: id });

    return new Response(JSON.stringify({ success: true, question }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error('Failed to assemble question from seed', {
      seedId: id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assemble question from seed',
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
});
