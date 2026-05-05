/**
 * Question Curation API
 * POST: Admin endpoint for approving, rejecting, and updating pre-generated questions.
 */

import { z } from 'zod';
import { adminEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { upsertCanonicalQuestionMirror } from '../_shared/canonical-question-mirror';
import { resolveCorrectAnswerIndex } from '../../../lib/answerLetterMap';

const CurationRequestSchema = z.object({
  body: z.object({
    action: z.enum(['approve', 'delete', 'update']),
    questionId: z.string().min(1),
    question: z
      .object({
        question: z.string().min(1).max(5000),
        options: z.array(z.string().max(500)).length(4),
        correctAnswerIndex: z.number().int().min(0).max(3),
        rationale: z.string().max(5000),
        system: z.string().max(100).optional(),
        difficulty: z.string().max(20).optional(),
      })
      .optional(),
  }),
});

function normalizeOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((option) => String(option ?? '').trim()).filter(Boolean);
}

function getQuestionText(questionData: Record<string, unknown>): string {
  return String(questionData.question ?? questionData.stem ?? questionData.vignette ?? '').trim();
}

function getExplanationText(questionData: Record<string, unknown>): string {
  return String(questionData.explanation ?? questionData.rationale ?? '').trim();
}

function resolveApprovedCorrectAnswer(
  questionData: Record<string, unknown>,
  options: string[]
): string | null {
  const numericIndex =
    typeof questionData.correctAnswerIndex === 'number'
      ? questionData.correctAnswerIndex
      : typeof questionData.correctIndex === 'number'
        ? questionData.correctIndex
        : null;

  if (
    numericIndex !== null &&
    Number.isInteger(numericIndex) &&
    numericIndex >= 0 &&
    numericIndex < options.length
  ) {
    return options[numericIndex] ?? null;
  }

  const rawAnswer =
    questionData.correctAnswer ??
    questionData.answer ??
    questionData.correct_option ??
    questionData.correctChoice;
  if (typeof rawAnswer === 'string' || typeof rawAnswer === 'number') {
    const resolvedIndex = resolveCorrectAnswerIndex(String(rawAnswer), options);
    return resolvedIndex !== null ? (options[resolvedIndex] ?? null) : null;
  }

  return null;
}

function buildApprovalPayload(questionData: Record<string, unknown>) {
  const options = normalizeOptions(questionData.options ?? questionData.answers ?? questionData.choices);
  const question = getQuestionText(questionData);
  const explanation = getExplanationText(questionData);
  const correctAnswer = resolveApprovedCorrectAnswer(questionData, options);

  if (options.length < 2 || !question || !explanation || !correctAnswer) {
    return {
      error: 'Question must include text, at least two answer options, a resolvable correct answer, and an explanation before approval.',
    };
  }

  return {
    question,
    vignette: String(questionData.vignette ?? questionData.stem ?? question),
    options,
    correctAnswer,
    explanation,
  };
}

export const onRequestPost = adminEndpoint(CurationRequestSchema, async (context) => {
  const { env, auth, validated } = context;
  const logger = createEndpointLogger('/api/questions/curate');
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    const { questionId, action, question: updatedQuestion } = validated.body;

    // Fetch the pre-generated question
    const preGenQuestion = await prisma.preGeneratedQuestion.findUnique({
      where: { id: questionId },
    });

    if (!preGenQuestion) {
      return { data: { error: 'Question not found' }, status: 404 };
    }

    switch (action) {
      case 'approve': {
        const questionData = preGenQuestion.questionData as Record<string, unknown>;
        const payload = buildApprovalPayload(questionData);
        if ('error' in payload) {
          return { data: { error: payload.error }, status: 400 };
        }

        const now = new Date();
        const canonicalQuestionId = await upsertCanonicalQuestionMirror(prisma, {
          id: questionId,
          questionData: {
            ...questionData,
            question: payload.question,
            vignette: payload.vignette,
            options: payload.options,
            correctAnswer: payload.correctAnswer,
            explanation: payload.explanation,
          },
          system: preGenQuestion.system ?? String(questionData.system ?? 'General'),
          difficulty: preGenQuestion.difficulty,
          conditionId: preGenQuestion.conditionId ?? null,
          medicalContentId: preGenQuestion.medicalContentId ?? null,
        }, {
          source: 'curated_pre_generated',
          humanReviewed: true,
        });
        if (!canonicalQuestionId) {
          return { data: { error: 'Approved question could not be mirrored into the canonical question table.' }, status: 400 };
        }

        await prisma.preGeneratedQuestion.update({
          where: { id: questionId },
          data: {
            validationStatus: 'approved',
            validatedAt: now,
            validatedBy: auth.userId,
            validationNotes: 'Approved through admin curation and mirrored to canonical Question.',
            questionData: {
              ...questionData,
              question: payload.question,
              vignette: payload.vignette,
              options: payload.options,
              correctAnswer: payload.correctAnswer,
              explanation: payload.explanation,
              canonicalQuestionId: questionId,
            },
          },
        });

        logger.info('Question approved for learner pool', {
          userId: auth.userId,
          questionId,
        });

        return { data: { success: true, message: 'Question approved for learner pool' } };
      }

      case 'delete': {
        await prisma.preGeneratedQuestion.delete({
          where: { id: questionId },
        });

        logger.info('Question deleted', { userId: auth.userId, questionId });

        return { data: { success: true, message: 'Question deleted' } };
      }

      case 'update': {
        if (!updatedQuestion) {
          return { data: { error: 'Missing question data for update' }, status: 400 };
        }

        const existingData = preGenQuestion.questionData as Record<string, unknown>;

        await prisma.preGeneratedQuestion.update({
          where: { id: questionId },
          data: {
            questionData: {
              ...existingData,
              question: updatedQuestion.question,
              vignette: updatedQuestion.question,
              options: updatedQuestion.options,
              correctAnswer: updatedQuestion.options[updatedQuestion.correctAnswerIndex],
              correctAnswerIndex: updatedQuestion.correctAnswerIndex,
              rationale: updatedQuestion.rationale,
              explanation: updatedQuestion.rationale,
            },
            system: updatedQuestion.system || preGenQuestion.system,
            difficulty: updatedQuestion.difficulty || preGenQuestion.difficulty,
            validationStatus: 'pending',
            validatedAt: null,
            validatedBy: null,
            validationNotes: 'Edited through admin curation; requires approval.',
          },
        });

        logger.info('Question updated', { userId: auth.userId, questionId });

        return { data: { success: true, message: 'Question updated' } };
      }

      default:
        return { data: { error: `Unknown action: ${action}` }, status: 400 };
    }
  } catch (error) {
    logger.error('Error curating question', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    });
    throw new Error('Failed to curate question');
  } finally {
    await safePrismaDisconnect(prisma);
  }
});
