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
      const where: any = {
        usedAt: null, // Prefer unused questions first
      };

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
          { usedAt: "asc" }, // Prioritize never-used questions
          { generatedAt: "desc" }, // Then newer questions
        ],
      });

      // 4. Fallback: If not enough questions, try used questions that user hasn't seen
      if (questions.length < limit) {
          // Remove usedAt: null constraint
          const fallbackWhere = { ...where };
          delete fallbackWhere.usedAt;

          const additionalQuestions = await prisma.preGeneratedQuestion.findMany({
              where: {
                  ...fallbackWhere,
                  id: {
                      notIn: [...seenQuestionIds, ...questions.map(q => q.id)],
                  },
              },
              take: limit - questions.length,
              orderBy: { generatedAt: "desc" },
          });
          
          questions = [...questions, ...additionalQuestions];
      }

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