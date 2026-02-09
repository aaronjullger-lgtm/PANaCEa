/**
 * POST /api/questions/due-siblings
 *
 * Due Cards session: fetch sibling questions for missed concepts.
 * For each due item (conditionId + taskType + originalQuestionId), returns a
 * different question with the same concept and task so the user proves
 * understanding, not answer recognition.
 *
 * Strategy: same concept (conditionId), different question (id != originalQuestionId) so the user
 * proves retention, not question/answer recognition. Never returns the original question.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import type { Prisma } from '@prisma/client';

const DueItemSchema = z.object({
  conditionId: z.string().min(1),
  taskType: z.string().nullable().optional(),
  originalQuestionId: z.string().min(1),
});

const DueSiblingsPostSchema = z.object({
  dueItems: z.array(DueItemSchema).min(1).max(50),
});

function parsePreGenToQuestion(q: {
  id: string;
  system: string | null;
  conditionId: string | null;
  difficulty: string;
  questionData: unknown;
}) {
  const data = (q.questionData || {}) as Record<string, unknown>;
  const optionsData = data.options ?? data.answers ?? data.choices;
  const optionsArr = Array.isArray(optionsData) ? (optionsData as string[]) : [];
  let correctAnswerIndex = 0;
  if (typeof data.correctAnswerIndex === 'number') {
    correctAnswerIndex = data.correctAnswerIndex;
  } else if (typeof data.correctAnswer === 'string') {
    const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    correctAnswerIndex = letterToIndex[data.correctAnswer.toUpperCase()] ?? 0;
  }
  return {
    id: q.id,
    question: (data.question || data.vignette || '') as string,
    vignette: data.vignette as string | undefined,
    options: optionsArr,
    correctAnswerIndex,
    rationale: (data.rationale || data.explanation || '') as string,
    system: q.system || 'General',
    subcategory: data.subcategory as string | undefined,
    conditionId: q.conditionId ?? undefined,
    condition: data.condition as string | undefined,
    difficulty: q.difficulty,
    source: 'pool' as const,
    metadata: {},
  };
}

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(DueSiblingsPostSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/due-siblings');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return { data: { error: 'User not found' }, status: 404 };
    }

    const results: Array<{
      question: ReturnType<typeof parsePreGenToQuestion> | null;
      dueConceptKey: { conditionId: string; taskType: string | null };
    }> = [];

    for (const item of validated.dueItems) {
      const where: Prisma.PreGeneratedQuestionWhereInput = {
        conditionId: item.conditionId,
        id: { not: item.originalQuestionId },
      };

      const candidates = await prisma.preGeneratedQuestion.findMany({
        where,
        take: 5,
        orderBy: { generatedAt: 'desc' },
      });

      // Shuffle and pick one (distinct vignette is ensured by different id)
      const shuffled = [...candidates].sort(() => Math.random() - 0.5);
      const sibling = shuffled[0] ?? null;

      results.push({
        question: sibling ? parsePreGenToQuestion(sibling) : null,
        dueConceptKey: { conditionId: item.conditionId, taskType: item.taskType ?? null },
      });
    }

    logger.info('Due siblings fetched', {
      userId: auth.userId,
      requested: validated.dueItems.length,
      found: results.filter((r) => r.question !== null).length,
    });

    return { data: { results } };
  } catch (error) {
    logger.error('Due siblings error', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    return {
      data: { error: 'Failed to fetch due siblings', message: 'Please try again.' },
      status: 500,
    };
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
