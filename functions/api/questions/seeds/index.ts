import { createEdgePrismaClient, safePrismaDisconnect } from '../../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../../_shared/auth';
import { validateRequired } from '../../_shared/validation';
import { createQuestionSeed } from '../../_shared/question-seeds';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
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

    const body = await request.json();
    const missing = validateRequired(body, [
      'conditionId',
      'questionType',
      'corePathology',
      'variables',
      'template',
      'correctAnswer',
      'explanation',
      'distractors',
    ]);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation failed',
          missing,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
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

    const seed = await createQuestionSeed(prisma, body);

    return new Response(JSON.stringify({ success: true, seed }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to create question seed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create question seed',
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