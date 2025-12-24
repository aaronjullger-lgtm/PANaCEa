/**
 * API Endpoint: /api/questions
 * 
 * Fetch questions for drill modes from the database
 * Uses tags array to filter by category (ventilator, physiology, anatomy)
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { authenticateRequest } from './_shared/auth';
import { createEdgePrismaClient } from './_shared/prisma-edge';

interface Env {
  DATABASE_URL: string;
  CLERK_SECRET_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    // Authenticate request
    const env = context.env as Env;
    const authResult = await authenticateRequest(context.request, env);
    if (!authResult) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const url = new URL(context.request.url);
    const category = url.searchParams.get('category');
    const difficulty = url.searchParams.get('difficulty');
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    // Validate query
    if (!category) {
      return new Response(JSON.stringify({ error: 'Category parameter is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create Prisma client
    const prisma = createEdgePrismaClient(context.env.DATABASE_URL);

    try {
      // Build where clause
      // For drill questions, we use tags to filter by category
      const where: any = {
        tags: {
          array_contains: category, // Prisma JSON filter for array contains
        },
      };

      if (difficulty) {
        where.difficulty = difficulty;
      }

      // Fetch questions
      const questions = await prisma.question.findMany({
        where,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          vignette: true,
          question: true,
          options: true,
          correctAnswer: true,
          explanation: true,
          system: true,
          tags: true,
          difficulty: true,
        },
      });

      // Return questions
      return new Response(JSON.stringify({ questions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('Error fetching questions:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
