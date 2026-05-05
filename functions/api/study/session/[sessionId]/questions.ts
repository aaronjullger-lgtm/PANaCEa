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
import {
  withProductionPregeneratedSafety,
  withProductionQuestionSafety,
} from '../../../../../lib/services/questionServingSafety';

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
          StudySessionQuestion: {
            select: {
              questionId: true,
              preGeneratedQuestionId: true,
              sequenceIndex: true,
              source: true,
              metadata: true,
            },
            orderBy: { sequenceIndex: 'asc' },
          },
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

      const questionRefs = buildSessionQuestionRefs(session);
      const questionIds = questionRefs.map((ref) => ref.id);
      if (questionIds.length === 0) {
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

      const joinedRowsAvailable = hasSessionQuestionRows(session);
      const preGeneratedLookupIds = joinedRowsAvailable
        ? questionRefs
            .filter((ref) => ref.questionSource === 'pre_generated')
            .map((ref) => ref.id)
        : questionIds;

      const preGenerated = preGeneratedLookupIds.length > 0
        ? await prisma.preGeneratedQuestion.findMany({
            where: withProductionPregeneratedSafety({ id: { in: preGeneratedLookupIds } }),
            select: {
              id: true,
              questionData: true,
              system: true,
              difficulty: true,
              conditionId: true,
              medicalContentId: true,
            },
          })
        : [];

      const preGeneratedIds = new Set(preGenerated.map((question) => question.id));
      const remainingIds = joinedRowsAvailable
        ? questionRefs
            .filter((ref) => ref.questionSource === 'question')
            .map((ref) => ref.id)
        : questionIds.filter((id) => !preGeneratedIds.has(id));
      const standardQuestions = remainingIds.length
        ? await prisma.question.findMany({
            where: withProductionQuestionSafety({ id: { in: remainingIds } }),
            select: {
              id: true,
              question: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              system: true,
              difficulty: true,
              conditionId: true,
              medicalContentId: true,
              category: true,
              topic: true,
              vignette: true,
            },
          })
        : [];

      const questionById = new Map<string, ReturnType<typeof normalizeSessionQuestion>>();

      for (const row of preGenerated) {
        const data = (row.questionData ?? {}) as Record<string, any>;
        questionById.set(
          row.id,
          normalizeSessionQuestion({
            id: row.id,
            vignette: data.vignette ?? data.stem ?? null,
            question: data.question ?? data.stem ?? data.vignette ?? null,
            options: data.options ?? data.answers ?? data.choices,
            correctAnswer:
              data.correctAnswer ?? data.answer ?? data.correct_option ?? data.correctChoice ?? null,
            correctAnswerIndex:
              typeof data.correctAnswerIndex === 'number'
                ? data.correctAnswerIndex
                : typeof data.correctIndex === 'number'
                  ? data.correctIndex
                  : null,
            explanation: data.explanation ?? data.rationale ?? null,
            system: row.system ?? data.system ?? null,
            category: data.category ?? data.subcategory ?? null,
            topic: data.topic ?? data.conditionName ?? null,
            conditionId: row.conditionId ?? data.conditionId ?? null,
            medicalContentId: row.medicalContentId ?? data.medicalContentId ?? null,
            condition: data.conditionName ?? data.condition ?? null,
            difficulty: row.difficulty ?? data.difficulty ?? null,
            canonicalQuestionId: null,
            sourceQuestionId: row.id,
            questionSource: 'pre_generated',
            source: 'pre_generated',
            pearls: Array.isArray(data.pearls) ? data.pearls : [],
          })
        );
      }

      for (const row of standardQuestions) {
        if (questionById.has(row.id)) continue;
        questionById.set(
          row.id,
          normalizeSessionQuestion({
            id: row.id,
            vignette: row.vignette,
            question: row.question,
            options: row.options,
            correctAnswer: row.correctAnswer,
            explanation: row.explanation,
            system: row.system,
            category: typeof row.category === 'string' ? row.category : null,
            topic: typeof row.topic === 'string' ? row.topic : null,
            conditionId: row.conditionId,
            medicalContentId: row.medicalContentId,
            condition: null,
            difficulty: row.difficulty,
            canonicalQuestionId: row.id,
            sourceQuestionId: row.id,
            questionSource: 'question',
            source: 'question',
          })
        );
      }

      const formattedQuestions = questionRefs
        .map((ref) => questionById.get(ref.id))
        .filter((question): question is ReturnType<typeof normalizeSessionQuestion> => Boolean(question));

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

type SessionQuestionRef = {
  id: string;
  questionSource: 'question' | 'pre_generated' | null;
};

function hasSessionQuestionRows(session: { StudySessionQuestion?: unknown }): boolean {
  return Array.isArray(session.StudySessionQuestion) && session.StudySessionQuestion.length > 0;
}

function buildSessionQuestionRefs(session: {
  questionIds?: string[] | null;
  StudySessionQuestion?: unknown;
}): SessionQuestionRef[] {
  if (Array.isArray(session.StudySessionQuestion) && session.StudySessionQuestion.length > 0) {
    return session.StudySessionQuestion
      .map((row: any): SessionQuestionRef | null => {
        if (typeof row?.preGeneratedQuestionId === 'string' && row.preGeneratedQuestionId.length > 0) {
          return { id: row.preGeneratedQuestionId, questionSource: 'pre_generated' };
        }
        if (typeof row?.questionId === 'string' && row.questionId.length > 0) {
          return { id: row.questionId, questionSource: 'question' };
        }
        return null;
      })
      .filter((ref): ref is SessionQuestionRef => ref !== null);
  }

  return (session.questionIds ?? [])
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map((id) => ({ id, questionSource: null }));
}
