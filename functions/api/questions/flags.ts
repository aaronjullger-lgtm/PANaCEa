import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context: { request: Request; env: { DATABASE_URL?: string; CLERK_SECRET_KEY: string } }) => {

  const { request, env } = context;
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

  try {
    // Verify auth
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

    // TODO: Add admin check here

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ success: true, flags: [] }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    prisma = createEdgePrismaClient(env);

    const flags = await prisma.questionFlag.findMany({
      where: {
        ...(status && { status: status }),
        ...(priority && { priority: priority }),
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return new Response(JSON.stringify({ success: true, flags }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Failed to get flags:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to get flags' 
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
