/**
 * Exam Complete API - POST /api/exam/complete
 * Complete an exam and generate score report
 */

import { authenticatedEndpoint, type CloudflareContext } from '../_shared/middleware';
import { featureDisabledResponse, isFeatureEnabled } from '../_shared/feature-flags';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { ExamService } from '../../../services/domain/examService';
import { z } from 'zod';

const CompleteExamSchema = z.object({
  body: z.object({
    attemptId: z.string().min(1, 'Attempt ID is required'),
  }),
});

const completeExamHandler = authenticatedEndpoint(
  CompleteExamSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/exam/complete', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { attemptId } = validated.body;
      log.info('Completing exam', { attemptId });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId },
        select: { id: true },
      });
      if (!user) {
        log.warn('User not found', { clerkId: auth.userId });
        return { status: 404, error: 'User not found' };
      }

      // Get the attempt
      const attempt = await prisma.examAttempt.findFirst({
        where: {
          id: attemptId,
          userId: user.id,
        },
        include: {
          ExamConfig: true,
        },
      });

      if (!attempt) {
        log.warn('Exam attempt not found', { attemptId });
        return { status: 404, error: 'Exam attempt not found' };
      }

      if (attempt.status === 'completed') {
        // Already completed - return existing score report
        log.info('Exam already completed', { attemptId });

        const answers = await prisma.examAnswer.findMany({
          where: { attemptId },
        });

        const scoreReport = ExamService.generateScoreReport(
          answers as any,
          attempt.ExamConfig as any,
          attempt.totalTimeUsedSeconds || 0
        );

        return {
          success: true,
          alreadyCompleted: true,
          attempt,
          scoreReport,
        };
      }

      // Get all answers and grade them
      const answers = await prisma.examAnswer.findMany({
        where: { attemptId },
        include: {
          Question: {
            select: {
              correctAnswer: true,
            },
          },
        },
      });

      // Type for answers from Prisma query with question relation
      type AnswerWithQuestion = (typeof answers)[0];

      // Update correctness for each answer
      const updatePromises = answers.map(async (answer: AnswerWithQuestion) => {
        const isCorrect = answer.selectedAnswer === answer.Question?.correctAnswer;
        return prisma!.examAnswer.update({
          where: { id: answer.id },
          data: { isCorrect },
        });
      });

      await Promise.all(updatePromises);

      // Fetch updated answers
      const gradedAnswers = await prisma.examAnswer.findMany({
        where: { attemptId },
      });

      // Calculate total time
      const startTime = new Date(attempt.startedAt).getTime();
      const endTime = Date.now();
      const totalTimeSeconds = Math.floor((endTime - startTime) / 1000);

      // Generate score report
      const scoreReport = ExamService.generateScoreReport(
        gradedAnswers as any,
        attempt.ExamConfig as any,
        totalTimeSeconds
      );

      // Calculate system scores for storage
      const systemScores: Record<string, number> = {};
      for (const system of scoreReport.systemBreakdown) {
        systemScores[system.system] = system.percentCorrect;
      }

      // Update attempt as completed
      const completedAttempt = await prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          totalTimeUsedSeconds: totalTimeSeconds,
          score: scoreReport.overallScore,
          percentCorrect: scoreReport.percentCorrect,
          systemScores,
          passStatus: scoreReport.passStatus,
        },
      });

      log.info('Exam completed successfully', {
        attemptId,
        score: scoreReport.overallScore,
        percentCorrect: scoreReport.percentCorrect,
        passStatus: scoreReport.passStatus,
      });

      return {
        success: true,
        alreadyCompleted: false,
        attempt: completedAttempt,
        scoreReport,
      };
    } catch (error) {
      log.error('Error completing exam', error);
      return { status: 500, error: 'Failed to complete exam' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);

export const onRequestPost = (context: CloudflareContext) => {
  if (!isFeatureEnabled(context.env, 'ENABLE_LEGACY_EXAM_API')) {
    return featureDisabledResponse(
      context.request,
      'Legacy exam API is disabled for this launch.',
      410
    );
  }

  return completeExamHandler(context);
};
