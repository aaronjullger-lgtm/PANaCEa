import { createEdgePrismaClient } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { validateRequired } from '../../_shared/validation';
import { mergeBranch } from '../../_shared/content-branching';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env, params } = context;
  const { branchName } = params;

  // Early return if no database configured
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
    const missing = validateRequired(body, ['mergedBy']);
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

    const { mergedBy, targetBranch } = body;

    const result = await mergeBranch(prisma, branchName as string, mergedBy, targetBranch);

    return new Response(JSON.stringify({ success: result.success, ...result }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to merge branch:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to merge branch' 
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
