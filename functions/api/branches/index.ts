import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { validateRequired } from '../_shared/validation';
import { createBranch, listBranches } from '../_shared/content-branching';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context) => {

  const { request, env } = context;

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ success: true, branches: [] }), {
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

    const url = new URL(request.url);
    const includeArchived = url.searchParams.get('includeArchived') === 'true';

    const branches = await listBranches(prisma, includeArchived);

    return new Response(JSON.stringify({ success: true, branches }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to list branches:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to list branches' 
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

export const onRequestPost = async (context) => {

  const { request, env } = context;

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
    const missing = validateRequired(body, ['name', 'createdBy']);
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

    const { name, description, baseBranch, createdBy } = body;

    const branchId = await createBranch(prisma, {
      name,
      description,
      baseBranch,
      createdBy,
    });

    return new Response(JSON.stringify({ success: true, branchId }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to create branch:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Failed to create branch' 
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
