/**
 * POST /api/questions/system-drill
 * 
 * Generate system-specific question for System Drill mode
 * Filters questions by PANCE system code
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context: any) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  // Authenticate user
  const { user, error: authError } = await authenticateRequest(context);
  if (authError) {
    return new Response(JSON.stringify({ error: authError }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const body = await context.request.json();
    const { system, difficulty, subcategory } = body;

    if (!system) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: system' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Build where clause for question query
    const where: any = {
      system,
      // Exclude questions without proper structure
      question: { not: null },
      options: { not: null },
      rationale: { not: null },
    };

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (subcategory) {
      where.subcategory = subcategory;
    }

    // Get total count for random selection
    const totalCount = await prisma.question.count({ where });

    if (totalCount === 0) {
      return new Response(
        JSON.stringify({
          error: 'No questions found for this system',
          system,
          subcategory,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Select random question using skip
    const randomSkip = Math.floor(Math.random() * totalCount);

    const question = await prisma.question.findFirst({
      where,
      skip: randomSkip,
      select: {
        id: true,
        question: true,
        options: true,
        correctAnswerIndex: true,
        rationale: true,
        pearls: true,
        condition: true,
        conditionId: true,
        system: true,
        subcategory: true,
        topic: true,
        difficulty: true,
        panceYield: true,
        imageUrl: true,
      },
    });

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve question' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    return new Response(JSON.stringify(question), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[system-drill] Error generating question:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate system drill question',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
};
