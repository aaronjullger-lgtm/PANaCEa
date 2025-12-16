import { createEdgePrismaClient } from '../../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../../_shared/auth';
import { assembleQuestionFromSeed } from '../../../_shared/question-seeds';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env, params } = context;
  const { id } = params;

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
    const question = await assembleQuestionFromSeed(prisma, id as string);

    return new Response(JSON.stringify({ success: true, question }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to assemble question from seed:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to assemble question from seed' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
