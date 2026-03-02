/**
 * Peer Statistics API - Wisdom of the Crowds
 * GET /api/analytics/peer-stats?questionId=xxx
 * Returns answer distribution percentages for a question
 */

import type { PagesFunction } from '@cloudflare/workers-types';
import { PrismaClient } from '@prisma/client';
import { verifyAuth } from '../_shared/auth';

interface Env {
  DATABASE_URL: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const authResult = await verifyAuth(context);
    if (!authResult.authenticated) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(context.request.url);
    const questionId = url.searchParams.get('questionId');

    if (!questionId) {
      return new Response(JSON.stringify({ error: 'questionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prisma = new PrismaClient({
      datasourceUrl: context.env.DATABASE_URL,
    });

    try {
      const attempts = await prisma.questionAttempt.findMany({
        where: { questionId },
        select: { selectedAnswer: true },
      });

      if (attempts.length === 0) {
        return new Response(
          JSON.stringify({ data: { distribution: [] } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const counts = new Map<number, number>();
      for (const a of attempts) {
        counts.set(a.selectedAnswer, (counts.get(a.selectedAnswer) || 0) + 1);
      }

      const distribution = Array.from(counts.entries())
        .map(([index, count]) => ({
          optionLetter: ['A', 'B', 'C', 'D'][index] || 'A',
          count,
          percent: Math.round((count / attempts.length) * 100),
        }))
        .sort((a, b) => b.count - a.count);

      return new Response(
        JSON.stringify({ data: { distribution } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await prisma.$disconnect();
    }
  } catch (error) {
    console.error('[peer-stats] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
