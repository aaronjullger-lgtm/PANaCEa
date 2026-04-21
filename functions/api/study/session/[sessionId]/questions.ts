/**
 * GET /api/study/session/:sessionId/questions
 *
 * Fetch the full question objects for a given session ID.
 * The session must belong to the authenticated user.
 * Returns an array of Question objects in the same order as stored in questionIds.
 */

import { z } from 'zod';
import { authenticatedEndpoint, withCors} from '../../../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../../../_shared/prisma-edge';
import { createEndpointLogger } from '../../../_shared/secureLogger';
import { normalizeSessionQuestion } from '../../../../../lib/sessionGeneration';

const ParamsSchema = z.object({
  sessionId: z.string().min(1, 'Missing session id'),
});

export const onRequestOptions = withCors();

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

      // Fetch session with questionIds and persisted study metadata.
      const session = await prisma.studySession.findUnique({
        where: { id: sessionId },
        select: {
          userId: true,
          questionIds: true,
          mode: true,
          focus: true,
          difficulty: true,
          systemsTargeted: true,
          blueprintStage: true,
          blueprintLabel: true,
          totalQuestions: true,
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
          data: {
            questions: [],
            session: {
              id: sessionId,
              mode: session.mode,
              focus: session.focus,
              difficulty: session.difficulty,
              systemsTargeted: session.systemsTargeted,
              blueprintStage: session.blueprintStage,
              blueprintLabel: session.blueprintLabel,
              totalQuestions: session.totalQuestions,
            },
          },
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
      const formattedQuestions = orderedQuestions.map((q) =>
        normalizeSessionQuestion({
          id: q.id,
          vignette: q.vignette,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          system: q.system,
          category: typeof q.category === 'string' ? q.category : null,
          topic: typeof q.topic === 'string' ? q.topic : null,
          conditionId: q.Condition?.id ?? null,
          condition: q.Condition
            ? {
                name: q.Condition.name,
                system: q.Condition.system,
              }
            : null,
          difficulty: q.difficulty,
          source: q.source,
          tags: q.tags,
          subcategory:
            typeof q.category === 'string'
              ? q.category
              : typeof q.taskType === 'string'
                ? q.taskType
                : null,
        })
      );

      return {
        data: {
          questions: formattedQuestions,
          session: {
            id: sessionId,
            mode: session.mode,
            focus: session.focus,
            difficulty: session.difficulty,
            systemsTargeted: session.systemsTargeted,
            blueprintStage: session.blueprintStage,
            blueprintLabel: session.blueprintLabel,
            totalQuestions: session.totalQuestions,
          },
        },
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
