import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { fetchUnseenQuestions } from '../_shared/no-repeat';
import { validateRequest } from '../_shared/schemas';
import { z } from 'zod';

// Zod schema for no-repeat request
const NoRepeatSchema = z.object({
  filter: z.object({
    system: z.string().max(100).optional(),
    systems: z.array(z.string().max(100)).max(15).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    conditionId: z.string().max(100).optional(),
  }).optional().default({}),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {

  const { request, env } = context;
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    const authResult = await verifyAuthToken(request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Validate input with Zod schema
    const validation = await validateRequest(request.clone(), NoRepeatSchema);
    if (!validation.success) {
      return (validation as { success: false; response: Response }).response;
    }
    const { filter, limit } = (validation as { success: true; data: any }).data;
    const userId = authResult;

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Database not configured' 
      }), {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const prisma = createEdgePrismaClient(env);
    const questions = await fetchUnseenQuestions(prisma, userId, filter || {}, limit || 10);

    return new Response(JSON.stringify({ success: true, questions }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to fetch unseen questions:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to fetch unseen questions' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
};
