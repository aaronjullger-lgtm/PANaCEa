import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { validateRequired } from '../../_shared/validation';
import { saveToStaging } from '../../_shared/staging-questions';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

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

    const body = await request.json();
    const missing = validateRequired(body, ['questionData']);
    if (missing.length > 0) {
      return new Response(JSON.stringify({ 
        error: 'Validation failed', 
        missing 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const { questionData } = body;

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
    const question = await saveToStaging(prisma, questionData);

    return new Response(JSON.stringify({ success: true, stagingQuestion: question }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to save to staging:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to save to staging' 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } finally {
    await prisma.$disconnect();
  }
};
