import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { assembleQuestionsFromSeeds } from '../../_shared/question-seeds';
import { validateRequest } from '../../_shared/schemas';
import { z } from 'zod';

// Zod schema for assemble request
const AssembleRequestSchema = z.object({
  filter: z
    .object({
      system: z.string().optional(),
      difficulty: z.string().optional(),
      type: z.string().optional(),
    })
    .optional()
    .default({}),
  count: z.number().int().min(1).max(100).optional().default(10),
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
    const validation = await validateRequest(request, AssembleRequestSchema);
    if (validation.success === false) {
      return validation.response;
    }
    const { filter, count } = validation.data;

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
      const questions = await assembleQuestionsFromSeeds(prisma, filter || {}, count || 10);

      return new Response(JSON.stringify({ success: true, questions }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } finally {
      await safePrismaDisconnect(prisma);
    }
  } catch (error) {
    console.error('Failed to assemble questions from seeds:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to assemble questions from seeds',
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