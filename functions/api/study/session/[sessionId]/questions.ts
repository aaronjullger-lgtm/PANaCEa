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

      if (session.userId !== auth.userId) {
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

      // Fetch full Question objects in the same order as questionIds
      // Use a raw query to preserve order? Prisma's findMany does not guarantee order.
      // We'll fetch and then sort manually.
      const questions = await prisma.question.findMany({
        where: { id: { in: questionIds } },
        include: {
          Condition: {
            select: {
              id: true,
              name: true,
              system: true,
            },
          },
        },
      });

      // Map to preserve order
      const questionMap = new Map(questions.map(q => [q.id, q]));
      const orderedQuestions = questionIds
        .map(id => questionMap.get(id))
        .filter((q): q is NonNullable<typeof q> => q !== undefined);

      // Transform to match the shape expected by frontend (same as /api/questions/session)
      const formattedQuestions = orderedQuestions.map(q => ({
        id: q.id,
        vignette: q.vignette,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        system: q.system,
        condition: q.Condition ? {
          id: q.Condition.id,
          name: q.Condition.name,
          system: q.Condition.system,
        } : null,
        difficulty: q.difficulty,
        source: q.source,
        tags: q.tags,
        cognitiveLevel: q.cognitiveLevel,
        clinicalSettings: q.clinicalSettings,
        relatedDrugs: q.relatedDrugs,
        relatedDiseases: q.relatedDiseases,
        taskType: q.taskType,
        questionFormat: q.questionFormat,
        mediaAssetId: q.mediaAssetId,
      }));

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