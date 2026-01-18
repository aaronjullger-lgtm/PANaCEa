import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { handleCorsOptions } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export async function onRequestGet(context: any) {
  const { env } = context;

  if (!env.DATABASE_URL) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const tests = await prisma.labTest.findMany({
      orderBy: { name: 'asc' },
    });

    return new Response(JSON.stringify(tests), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Error fetching lab tests:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch lab tests', details: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } finally {
    await safePrismaDisconnect(prisma);
  }
}