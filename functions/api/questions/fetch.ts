import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, verifyAuthToken, type Env } from '../_shared/auth';
import type { CloudflareContext } from '../_shared/types';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context: CloudflareContext<Env>) => {

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
    const { userId, system, conditionId, difficulty, questionType, limit = 10 } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
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

    try {
      // 1. Get seen question IDs
      const historyWhere: {
        userId: string;
        system?: string;
        conditionId?: string;
        questionType?: string;
      } = { userId };
      if (system) historyWhere.system = system;
      if (conditionId) historyWhere.conditionId = conditionId;
      if (questionType) historyWhere.questionType = questionType;

      const history = await prisma.userQuestionHistory.findMany({
        where: historyWhere,
        select: { questionId: true },
      });
      const seenQuestionIds = history.map((h) => h.questionId);

      // 2. Build query for live questions
      // Do NOT filter by usedAt - questions remain available to all users
      // Per-user filtering happens via notIn seenQuestionIds
      const where: any = {};

      if (system) where.system = system;
      if (difficulty) where.difficulty = difficulty;
      if (questionType) where.questionType = questionType;
      if (conditionId) where.conditionId = conditionId;

      // 3. Fetch questions excluding user's history
      let questions = await prisma.preGeneratedQuestion.findMany({
        where: {
          ...where,
          id: {
            notIn: seenQuestionIds,
          },
        },
        take: limit,
        orderBy: [
          { generatedAt: "asc" }, // Use oldest first for fairness
        ],
      });

      // 4. If not enough questions, all questions for this user are exhausted
      // The pool remains available for other users

      // 5. Return results
      return new Response(JSON.stringify({
        success: true,
        questions: questions,
        source: "database",
        count: questions.length,
        needsGeneration: questions.length < limit,
        generationNeeded: limit - questions.length,
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } finally {
      await prisma.$disconnect();
    }

  } catch (error: any) {
    console.error('Error fetching questions:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch questions',
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