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
 * When taskType is provided, prefers siblings with matching taskType. If no sibling exists,
 * attempts on-demand variant generation (when GEMINI_API_KEY is set) then retries.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { ensureDueVariant } from '../../../lib/ensureDueVariant';
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

/** Build PreGenQuestionForVariant from a Question row for ensureDueVariant */
function questionToPreGenForVariant(q: {
  id: string;
  vignette: string;
  question: string;
  options: unknown;
  correctAnswer: string;
  explanation: string;
  system: string;
  conditionId: string | null;
  difficulty: string;
  taskType?: string | null;
}) {
  const optionsArr = Array.isArray(q.options)
    ? (q.options as string[]).map((o) =>
        typeof o === 'string'
          ? o
          : String(
              (o as { value?: string; text?: string })?.value ??
                (o as { value?: string; text?: string })?.text ??
                o
            )
      )
    : [];
  const correctIndex = optionsArr.indexOf(q.correctAnswer);
  return {
    id: q.id,
    conditionId: q.conditionId,
    system: q.system,
    difficulty: q.difficulty ?? 'medium',
    questionType: 'mcq',
    questionData: {
      question: [q.vignette, q.question].filter(Boolean).join('\n\n') || q.question,
      vignette: q.vignette,
      options: optionsArr,
      correctAnswer: q.correctAnswer,
      correctAnswerIndex: Math.max(0, correctIndex),
      rationale: q.explanation,
      explanation: q.explanation,
      taskType: q.taskType ?? undefined,
    },
  };
}

type PreGenRow = Parameters<typeof parsePreGenToQuestion>[0];

async function tryGenerateAndFetchSibling(
  prisma: ReturnType<typeof createEdgePrismaClient>,
  item: { conditionId: string; taskType: string | null; originalQuestionId: string },
  apiKey: string | undefined,
  logger: { info: (msg: string, ctx?: Record<string, unknown>) => void; warn: (msg: string, ctx?: Record<string, unknown>) => void }
): Promise<PreGenRow | null> {
  if (!apiKey) return null;
  const where: Prisma.PreGeneratedQuestionWhereInput = {
    conditionId: item.conditionId,
    id: { not: item.originalQuestionId },
  };
  const preGenOriginal = await prisma.preGeneratedQuestion.findUnique({
    where: { id: item.originalQuestionId },
    select: {
      id: true,
      questionData: true,
      conditionId: true,
      system: true,
      difficulty: true,
      questionType: true,
    },
  });
  if (preGenOriginal) {
    await ensureDueVariant(
      prisma,
      {
        id: preGenOriginal.id,
        conditionId: preGenOriginal.conditionId,
        system: preGenOriginal.system,
        difficulty: preGenOriginal.difficulty ?? 'medium',
        questionType: preGenOriginal.questionType ?? 'mcq',
        questionData: preGenOriginal.questionData,
      },
      apiKey,
      { info: logger.info.bind(logger), warn: logger.warn.bind(logger) }
    );
  } else {
    const questionOriginal = await prisma.question.findUnique({
      where: { id: item.originalQuestionId },
      select: {
        id: true,
        vignette: true,
        question: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        system: true,
        conditionId: true,
        difficulty: true,
        taskType: true,
      },
    });
    if (questionOriginal) {
      const forVariant = questionToPreGenForVariant(questionOriginal);
      await ensureDueVariant(prisma, forVariant, apiKey, {
        info: logger.info.bind(logger),
        warn: logger.warn.bind(logger),
      });
    }
  }
  const retryCandidates = await prisma.preGeneratedQuestion.findMany({
    where,
    take: 5,
    orderBy: { generatedAt: 'desc' },
  });
  return retryCandidates.length > 0
    ? retryCandidates[Math.floor(Math.random() * retryCandidates.length)]
    : null;
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

      let candidates = await prisma.preGeneratedQuestion.findMany({
        where,
        take: 10,
        orderBy: { generatedAt: 'desc' },
      });

      if (item.taskType && candidates.length > 0) {
        const withTaskType = candidates.filter((c) => {
          const data = (c.questionData as Record<string, unknown>) || {};
          return data.taskType === item.taskType;
        });
        if (withTaskType.length > 0) candidates = withTaskType;
      }

      let sibling =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null;

      if (!sibling && env.GEMINI_API_KEY) {
        sibling = await tryGenerateAndFetchSibling(
          prisma,
          { conditionId: item.conditionId, taskType: item.taskType ?? null, originalQuestionId: item.originalQuestionId },
          env.GEMINI_API_KEY as string,
          logger
        );
      }

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
