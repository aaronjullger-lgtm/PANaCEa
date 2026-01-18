import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { getSeedStats } from '../../_shared/question-seeds';

export const onRequestOptions = handleCorsOptions;

export const onRequestGet = async (context) => {
  const { request, env } = context;

  let prisma;

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

    prisma = createEdgePrismaClient(env);

    const stats = await getSeedStats(prisma);

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to get seed stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to get seed stats',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } finally {
    if (prisma) await safePrismaDisconnect(prisma);
  }
};