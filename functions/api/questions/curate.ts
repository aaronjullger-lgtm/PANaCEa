/**
 * Question Curation API
 * POST: Admin endpoint for approving, rejecting, and updating pre-generated questions.
 */

import { z } from 'zod';
import { adminEndpoint } from '../_shared/middleware';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';

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
        // Move question from pre-generated pool to main Question table
        const questionData = preGenQuestion.questionData as Record<string, unknown>;

        const opts = Array.isArray(questionData.options) ? questionData.options : [];
        const idx = Number(questionData.correctAnswerIndex ?? 0);
        const correctLetter = ['A', 'B', 'C', 'D', 'E'][idx] ?? (opts[idx] as string) ?? 'A';
        const now = new Date();
        await prisma.question.create({
          data: {
            id: crypto.randomUUID(),
            vignette: (questionData.vignette ?? questionData.question ?? '') as string,
            question: (questionData.question ?? questionData.vignette ?? '') as string,
            options: opts as object,
            correctAnswer: (questionData.correctAnswer as string) ?? correctLetter,
            explanation: (questionData.explanation ?? questionData.rationale ?? '') as string,
            system: preGenQuestion.system ?? 'General',
            difficulty: preGenQuestion.difficulty,
            source: 'curated',
            updatedAt: now,
            conditionId: preGenQuestion.conditionId ?? null,
            medicalContentId: preGenQuestion.medicalContentId ?? null,
          },
        });

        // Delete from pre-generated pool
        await prisma.preGeneratedQuestion.delete({
          where: { id: questionId },
        });

        logger.info('Question approved and moved to main pool', {
          userId: auth.userId,
          questionId,
        });

        return { data: { success: true, message: 'Question approved and moved to main pool' } };
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
              correctAnswerIndex: updatedQuestion.correctAnswerIndex,
              rationale: updatedQuestion.rationale,
              explanation: updatedQuestion.rationale,
            },
            system: updatedQuestion.system || preGenQuestion.system,
            difficulty: updatedQuestion.difficulty || preGenQuestion.difficulty,
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
