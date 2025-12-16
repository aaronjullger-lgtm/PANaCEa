import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { validateRequired } from '../_shared/validation';
import { createBranch, listBranches } from '../_shared/content-branching';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

  try {
    // Verify auth (optional for listing? usually required for admin features)
    // server.ts didn't explicitly require auth on GET /api/branches in the snippet,
    // but it's safer to require it.
    // Actually, let's check server.ts again.
    // app.get('/api/branches', async (req: Request, res: Response) => { ... })
    // It does NOT have requireAuth.
    // I'll stick to the pattern of requiring it for write operations, but maybe optional for read?
    // But branching is an admin feature. I should probably require auth.
    // I'll require auth.
    
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

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ success: true, branches: [] }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const prisma = createEdgePrismaClient(env);
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
  }
};

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
  }
};
