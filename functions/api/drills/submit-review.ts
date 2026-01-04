import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken } from '../_shared/auth';
import { calculateParTime } from '../../../lib/utils/questionComplexity';
import { updateReviewOutcome } from '../../../lib/services/srsService';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  const { request, env } = context;
  let prisma: ReturnType<typeof createEdgePrismaClient> | null = null;

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
    const { userId, questionId, selectedAnswer, timeSpentMs } = body || {};

    if (!userId || !questionId || typeof selectedAnswer === 'undefined') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, questionId, selectedAnswer' }),
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
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    prisma = createEdgePrismaClient(env.DATABASE_URL);
    const question = await prisma.preGeneratedQuestion.findUnique({ where: { id: questionId } });

    if (!question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const qData: any = (question as any).questionData || {};

    let correctAnswer: any =
      qData.correctAnswer ?? qData.answer ?? qData.correct_option ?? qData.correctChoice ?? null;

    if (correctAnswer === null && typeof qData.correctIndex === 'number') {
      const pool = Array.isArray(qData.options) ? qData.options : qData.choices;
      if (Array.isArray(pool) && pool[qData.correctIndex]) {
        const candidate = pool[qData.correctIndex];
        correctAnswer = candidate?.value ?? candidate?.text ?? candidate?.label ?? candidate;
      }
    }

    const isCorrect = correctAnswer !== null
      ? selectedAnswer === correctAnswer
      : Boolean((qData.options || qData.choices || []).some((opt: any) => {
          const val = opt?.value ?? opt?.text ?? opt?.label ?? opt;
          return val === selectedAnswer;
        }));

    const parTimeMs = calculateParTime({
      ...qData,
      stem: qData.stem || qData.question || qData.vignette || qData.text || '',
      choices: qData.choices || qData.options || [],
    });

    const numericTime = typeof timeSpentMs === 'number' ? timeSpentMs : Number(timeSpentMs) || 0;

    const quality = !isCorrect
      ? 1 // Again
      : numericTime < parTimeMs * 0.7
        ? 5 // Easy / Fast
        : numericTime < parTimeMs * 1.4
          ? 4 // Good / Normal
          : 2; // Hard / Slow

    // Feed into FSRS with dynamic baseline
    updateReviewOutcome(userId, questionId, {
      quality,
      timeToAnswer: numericTime,
      baselineTime: parTimeMs,
    });

    return new Response(
      JSON.stringify({
        success: true,
        isCorrect,
        quality,
        parTimeMs,
        timeSpentMs: numericTime,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('submit-review error:', error);
    return new Response(JSON.stringify({ error: 'Failed to submit review', details: error?.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } finally {
    if (prisma) {
      await prisma.$disconnect().catch(() => {});
    }
  }
};
