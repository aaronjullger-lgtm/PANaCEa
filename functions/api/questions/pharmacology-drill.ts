/**
 * POST /api/questions/pharmacology-drill
 * 
 * Generate pharmacology question for Pharmacology Drill mode
 * Filters questions by topic='Pharmacology' or drugClass
 */

import { createEdgePrismaClient } from '../_shared/prisma-edge';
import { handleCorsOptions, authenticateRequest } from '../_shared/auth';

export const onRequestOptions = handleCorsOptions;

export const onRequestPost = async (context: any) => {
  const corsResponse = await handleCorsOptions(context);
  if (corsResponse) return corsResponse;

  // Authenticate user
  const env = context.env as any;
  const authResult = await authenticateRequest(context.request, env);
  if (!authResult) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

  try {
    const body = await context.request.json();
    const { drugClass, difficulty } = body;

    // Build where clause for pharmacology questions
    const where: any = {
      OR: [
        { topic: 'Pharmacology' },
        { topic: 'Pharmacotherapy' },
        // Also include questions tagged with drug classes
        { tags: { hasSome: ['pharmacology', 'medications', 'drugs'] } },
      ],
      // Exclude questions without proper structure
      question: { not: null },
      options: { not: null },
      rationale: { not: null },
    };

    if (drugClass) {
      // Filter by specific drug class if provided
      where.AND = [
        {
          OR: [
            { drugClass },
            { tags: { has: drugClass.toLowerCase() } },
            { question: { contains: drugClass, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    // Get total count for random selection
    const totalCount = await prisma.question.count({ where });

    if (totalCount === 0) {
      return new Response(
        JSON.stringify({
          error: 'No pharmacology questions found',
          drugClass,
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
        drugClass: true,
        mechanism: true,
        imageUrl: true,
      },
    });

    if (!question) {
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve pharmacology question' }),
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
    console.error('[pharmacology-drill] Error generating question:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate pharmacology question',
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
