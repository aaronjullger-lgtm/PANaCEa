import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { processStagingQueue } from '../../_shared/staging-questions';
import { validateRequest } from '../../_shared/schemas';
import { z } from 'zod';

// Zod schema for process request
const ProcessRequestSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const { request, env } = context;

  try {
    const authResult = await verifyAuthToken(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Validate request body
    const validation = await validateRequest(request, ProcessRequestSchema);
    if (validation.success === false) {
      return validation.response;
    }
    const { limit } = validation.data;

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
      const results = await processStagingQueue(prisma, env, limit);

      return new Response(JSON.stringify({ success: true, results }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  } catch (error) {
    console.error('Failed to process staging queue:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to process staging queue',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};