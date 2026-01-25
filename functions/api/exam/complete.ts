/**
 * Exam Complete API - POST /api/exam/complete
 * Complete an exam and generate score report
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
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

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  CompleteExamSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/exam/complete', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { attemptId } = validated.body;
      log.info('Completing exam', { attemptId });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Get the attempt
      const attempt = await prisma.examAttempt.findFirst({
        where: {
          id: attemptId,
          userId: auth.userId,
        },
        include: {
          config: true,
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
          attempt.config as any,
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
          question: {
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
        const isCorrect = answer.selectedAnswer === answer.question?.correctAnswer;
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
        attempt.config as any,
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
