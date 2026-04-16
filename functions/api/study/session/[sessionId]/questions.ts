/**
 * GET /api/study/session/:sessionId/questions
 *
 * Fetch the full question objects for a given session ID.
 * The session must belong to the authenticated user.
 * Returns an array of Question objects in the same order as stored in questionIds.
 */

import { z } from 'zod';
import { authenticatedEndpoint } from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { createEndpointLogger } from '../../../_shared/secureLogger';

const ParamsSchema = z.object({
  sessionId: z.string().min(1, 'Missing session id'),
});

export const onRequestGet = authenticatedEndpoint(
  ParamsSchema,
  async (context) => {
    const { env, auth, validated } = context as {
      env: { DATABASE_URL: string };
      auth: { userId: string };
      validated: z.infer<typeof ParamsSchema>;
    };
    const logger = createEndpointLogger('/api/study/session/:sessionId/questions');
    const prisma = createEdgePrismaClient(env.DATABASE_URL);

    try {
      const { sessionId } = validated;

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });

      if (!user) {
        return {
          status: 404,
          error: 'User not found',
        };
      }

      // Fetch session with questionIds, ensure it belongs to the user
      const session = await prisma.studySession.findUnique({
        where: { id: sessionId },
        select: {
          userId: true,
          questionIds: true,
        },
      });

      if (!session) {
        return {
          status: 404,
          error: 'Session not found',
        };
      }

      if (session.userId !== user.id) {
        return {
          status: 403,
          error: 'Unauthorized to access this session',
        };
      }

      const questionIds = session.questionIds;
      if (!questionIds || questionIds.length === 0) {
        // No questions associated with this session (should not happen for newly generated sessions)
        return {
          data: { questions: [] },
        };
      }

      const preGenerated = await prisma.preGeneratedQuestion.findMany({
        where: { id: { in: questionIds } },
        select: {
          id: true,
          questionData: true,
          system: true,
          difficulty: true,
          conditionId: true,
        },
      });

      const preGeneratedIds = new Set(preGenerated.map((question) => question.id));
      const remainingIds = questionIds.filter((id) => !preGeneratedIds.has(id));
      const standardQuestions = remainingIds.length
        ? await prisma.question.findMany({
            where: { id: { in: remainingIds } },
            select: {
              id: true,
              question: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              system: true,
              difficulty: true,
              conditionId: true,
              category: true,
              topic: true,
              vignette: true,
            },
          })
        : [];

      const questionMap = new Map<string, Record<string, unknown>>();
      for (const question of preGenerated) {
        const data = question.questionData as Record<string, unknown> | null;
        const options = Array.isArray(data?.options)
          ? data.options.map((option) => String(option))
          : [];
        const correctAnswer = String(data?.correctAnswer ?? data?.answer ?? '');

        questionMap.set(question.id, {
          id: question.id,
          question: String(data?.question ?? data?.stem ?? ''),
          vignette: data?.vignette ?? null,
          options,
          correctAnswer,
          correctAnswerIndex: resolveCorrectAnswerIndex(
            options,
            typeof data?.correctAnswerIndex === 'number' ? data.correctAnswerIndex : null,
            correctAnswer
          ),
          explanation: data?.explanation ?? data?.rationale ?? null,
          system: question.system ?? data?.system ?? null,
          category: data?.subcategory ?? null,
          topic: data?.conditionName ?? null,
          difficulty: question.difficulty ?? data?.difficulty ?? null,
          conditionId: question.conditionId ?? null,
          source: 'reservoir',
        });
      }

      for (const question of standardQuestions) {
        const options = Array.isArray(question.options)
          ? question.options.map((option) => String(option))
          : [];

        questionMap.set(question.id, {
          id: question.id,
          question: question.question,
          vignette: question.vignette,
          options,
          correctAnswer: question.correctAnswer,
          correctAnswerIndex: resolveCorrectAnswerIndex(options, null, question.correctAnswer ?? ''),
          explanation: question.explanation,
          system: question.system,
          category: question.category,
          topic: question.topic,
          difficulty: question.difficulty,
          conditionId: question.conditionId,
          source: 'on_demand',
        });
      }

      const formattedQuestions = questionIds
        .map((id) => questionMap.get(id))
        .filter((question): question is Record<string, unknown> => Boolean(question));

      return {
        data: { questions: formattedQuestions },
      };
    } catch (error) {
      logger.error('Failed to fetch session questions', error);
      return {
        status: 500,
        error: 'Internal server error',
      };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  },
  { source: 'params', requestsPerMinute: 120 }
);

function resolveCorrectAnswerIndex(
  options: string[],
  rawIndex: number | null,
  rawCorrectAnswer: string
): number {
  if (typeof rawIndex === 'number' && Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < options.length) {
    return rawIndex;
  }

  const correctAnswer = rawCorrectAnswer.trim();
  if (!correctAnswer) return 0;

  const exactMatch = options.findIndex(
    (option) => option.trim().toLowerCase() === correctAnswer.toLowerCase()
  );
  if (exactMatch >= 0) return exactMatch;

  if (/^[A-E]$/i.test(correctAnswer)) {
    const letterIndex = correctAnswer.toUpperCase().charCodeAt(0) - 65;
    if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;
  }

  return 0;
}
