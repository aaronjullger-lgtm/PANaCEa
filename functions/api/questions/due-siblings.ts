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

/**
 * Resolve a correctAnswerIndex from questionData stored in PreGeneratedQuestion.
 *
 * Handles all storage formats in use:
 *   - correctAnswerIndex: number (preferred, most generation paths)
 *   - correctAnswer: "A"|"B"|"C"|"D"|"E" (letter, generate-batch path)
 *   - correctAnswer: "full option text" (text-match, variant generator path)
 *
 * Returns null only when the answer truly cannot be determined — callers should
 * surface this as a data-quality warning rather than silently defaulting to 0.
 */
function resolveCorrectAnswerIndex(
  data: Record<string, unknown>,
  optionsArr: string[]
): number | null {
  // 1. Explicit numeric index — most reliable, always prefer
  if (typeof data.correctAnswerIndex === 'number') {
    const idx = data.correctAnswerIndex;
    if (idx >= 0 && idx < optionsArr.length) return idx;
  }

  if (typeof data.correctAnswer === 'string') {
    const ca = data.correctAnswer.trim();

    // 2. Single-letter answer A–E (generate-batch.ts format)
    const LETTER_TO_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };
    const letterIdx = LETTER_TO_INDEX[ca.toUpperCase()];
    if (letterIdx !== undefined && letterIdx < optionsArr.length) return letterIdx;

    // 3. Full-text answer — find in options array (variant generator format)
    const textIdx = optionsArr.findIndex(
      (o) => typeof o === 'string' && o.trim().toLowerCase() === ca.toLowerCase()
    );
    if (textIdx !== -1) return textIdx;
  }

  return null;
}

function parsePreGenToQuestion(q: {
  id: string;
  system: string | null;
  conditionId: string | null;
  difficulty: string;
  questionData: unknown;
}) {
  const data = (q.questionData || {}) as Record<string, unknown>;

  // Normalise options: handle string[], {A:"...",B:"..."}, or [{value,text,label}]
  const rawOptions = data.options ?? data.answers ?? data.choices;
  let optionsArr: string[] = [];
  if (Array.isArray(rawOptions)) {
    optionsArr = rawOptions.map((o) =>
      typeof o === 'string'
        ? o
        : String(
            (o as { value?: string; text?: string; label?: string })?.value ??
            (o as { value?: string; text?: string; label?: string })?.text ??
            (o as { value?: string; text?: string; label?: string })?.label ??
            o
          )
    );
  } else if (rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions)) {
    // Record<string,string> format: {A:"opt1",B:"opt2",...}
    optionsArr = Object.keys(rawOptions as Record<string, string>)
      .sort()
      .map((k) => (rawOptions as Record<string, string>)[k]);
  }

  const resolvedIndex = resolveCorrectAnswerIndex(data, optionsArr);
  // resolvedIndex=null means we genuinely cannot determine the answer.
  // We use -1 as a sentinel so the frontend can surface this to the user
  // rather than silently marking option 0 as correct.
  const correctAnswerIndex = resolvedIndex ?? -1;

  return {
    id: q.id,
    question: (data.question || data.vignette || '') as string,
    vignette: data.vignette as string | undefined,
    options: optionsArr,
    correctAnswerIndex,
    /** Raw correctAnswer string preserved for client-side fallback validation */
    correctAnswer: typeof data.correctAnswer === 'string' ? data.correctAnswer : undefined,
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
  logger: { info: (msg: string, ctx?: Record<string, unknown>) => void; warn: (msg: string, ctx?: Record<string, unknown>) => void },
  userId?: string
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
      { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
      userId
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
      await ensureDueVariant(
        prisma,
        forVariant,
        apiKey,
        { info: logger.info.bind(logger), warn: logger.warn.bind(logger) },
        userId
      );
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
    // Collect IDs of PreGeneratedQuestion rows actually served so timesServed can be incremented.
    const servedPreGenIds: string[] = [];

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
          logger,
          user.id // pass userId so confusion pairs are injected into the variant prompt
        );
      }

      if (sibling) servedPreGenIds.push(sibling.id);
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

    // Fire-and-forget: increment timesServed for all served siblings.
    if (servedPreGenIds.length > 0) {
      prisma.preGeneratedQuestion
        .updateMany({
          where: { id: { in: servedPreGenIds } },
          data: { timesServed: { increment: 1 } },
        })
        .catch((err: unknown) =>
          logger.warn('due-siblings timesServed increment failed (non-fatal)', {
            error: err instanceof Error ? err.message : String(err),
          })
        );
    }

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
