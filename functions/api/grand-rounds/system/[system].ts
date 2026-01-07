/**
 * Grand Rounds System Challenge API
 * Database-first high-yield question fetching for specific organ systems
 */

import { authenticateRequest } from '../../_shared/auth';
import { createEdgePrismaClient } from '../../_shared/prisma-edge';

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);
  const system = url.pathname.split('/').pop(); // Extract system from /api/grand-rounds/system/{system}

  if (!system || system === 'system') {
    return new Response(JSON.stringify({ error: 'System parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Authenticate
  const auth = await authenticateRequest(request, env);
  if (!auth.isAuthenticated || !auth.userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    // Check if user completed this system today
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const completedToday = await prisma.grandRoundsAttempt.findFirst({
      where: {
        userId: auth.userId,
        system,
        createdAt: { gte: today },
      },
    });

    if (completedToday) {
      return new Response(
        JSON.stringify({
          status: 'completed',
          stats: {
            score: completedToday.score,
            correctCount: completedToday.correctAnswers,
            totalQuestions: completedToday.totalQuestions,
            timeSpentMs: completedToday.timeSpentMs,
            percentile: completedToday.percentile || 50,
            ranking: completedToday.globalRank || 1,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch 10 high-yield questions from MedicalContent for this system
    const questions = await prisma.medicalContent.findMany({
      where: {
        system,
        publishStatus: 'published',
        isHighYield: true,
      },
      take: 10,
      orderBy: {
        updatedAt: 'desc', // Most recently updated high-yield content
      },
      select: {
        id: true,
        condition: true,
        system: true,
        content: true,
        clinical_pearls: true,
        gold_standard_dx: true,
      },
    });

    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions available for this system' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Transform MedicalContent into Question format
    const formattedQuestions = questions.map((q) => {
      const content = (q.content as any) || {};
      const options = content.questionOptions || [
        q.gold_standard_dx || q.condition,
        ...(content.differentials || ['Option B', 'Option C', 'Option D']).slice(0, 3),
      ];

      return {
        id: q.id,
        question: content.clinicalScenario || `A patient presents with ${q.condition}. What is the most likely diagnosis?`,
        options: options.slice(0, 4),
        correctIndex: 0, // Correct answer is always first (shuffle on client if needed)
        condition: q.condition,
        topic: q.system,
        system: q.system,
        category: 'Formulating Diagnosis',
        difficulty: 'board',
        rationale: content.rationale || (q.clinical_pearls?.[0] || 'Clinical reasoning'),
        boardRelevance: 'high_yield',
        mediaType: null,
        mediaUrl: null,
      };
    });

    const challengeId = `${system}-${today.toISOString().split('T')[0]}-${auth.userId}`;

    return new Response(
      JSON.stringify({
        status: 'active',
        challengeId,
        questions: formattedQuestions,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching Grand Rounds challenge:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
