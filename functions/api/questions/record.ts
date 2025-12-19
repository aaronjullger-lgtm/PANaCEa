import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { isRankedMode } from '../../../config/training-modes';
import { updateGlobalAccuracy } from '../../../lib/services/userStatsService';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;

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

    const body = await request.json();
    const { userId, questionId, questionType, system, conditionId, wasCorrect, mode } = body;

    const isRankedAttempt = isRankedMode(mode);

    // Validate required fields
    if (!userId || !questionId || !questionType) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId, questionId, and questionType are required' 
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    // Record the question as seen (no-repeat guard)
    await prisma.userQuestionHistory.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId,
        },
      },
      update: {
        isCorrect: wasCorrect || false,
      },
      create: {
        userId,
        questionId,
        isCorrect: wasCorrect || false,
      },
    });

    // Always log attempts for drill history / analytics
    await prisma.questionAttempt.create({
      data: {
        userId,
        questionId,
        questionType: questionType || null,
        system: system || null,
        conditionId: conditionId || null,
        mode: mode || null,
        wasCorrect: Boolean(wasCorrect),
        isRankedAttempt,
      },
    });

    // Only ranked attempts should feed FSRS/Global stats pipelines
    if (isRankedAttempt) {
      try {
        await updateGlobalAccuracy(prisma as any, userId);
      } catch (statsError) {
        console.warn('Failed to update ranked stats', statsError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Question recorded successfully',
      isRankedAttempt,
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Error recording question:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to record question',
      details: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};