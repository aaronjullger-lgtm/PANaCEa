import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../../_shared/auth';
import { runAdequacyCheck } from '../../../_shared/staging-questions';
import { validateRequest } from '../../../_shared/schemas';
import { z } from 'zod';

// Zod schema for check request (empty - ID from URL params)
const CheckRequestSchema = z
  .object({
    force: z.boolean().optional(), // Optional: force recheck
  })
  .optional()
  .default({});

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const { request, env, params } = context;
  const { id } = params;

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

    // Validate request body (optional)
    const validation = await validateRequest(request, CheckRequestSchema);
    if (validation.success === false) {
      return validation.response;
    }

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
      const result = await runAdequacyCheck(prisma, env, id as string);

      return new Response(JSON.stringify({ success: true, result }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  } catch (error) {
    console.error('Failed to run adequacy check:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to run adequacy check',
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