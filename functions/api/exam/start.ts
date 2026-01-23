/**
 * Exam Start API - POST /api/exam/start
 * Start a new PANCE/PANRE-LA exam attempt
 */

import { authenticatedEndpoint, withCors } from '../_shared/middleware';
import {
  createEdgePrismaClient,
  safePrismaDisconnect,
  EdgePrismaClient,
} from '../_shared/prisma-edge';
import { createEndpointLogger } from '../_shared/secureLogger';
import { ExamService } from '../../../services/examService';
import { z } from 'zod';

const StartExamSchema = z.object({
  body: z.object({
    configId: z.string().min(1, 'Config ID is required'),
    resumeAttemptId: z.string().optional(),
  }),
});

export const onRequestOptions = withCors();

export const onRequestPost = authenticatedEndpoint(
  StartExamSchema,
  async ({ env, validated, auth }) => {
    const log = createEndpointLogger('/api/exam/start', auth.userId);
    let prisma: EdgePrismaClient | null = null;

    try {
      const { configId, resumeAttemptId } = validated.body;
      log.info('Starting exam', { configId, resumeAttemptId });

      prisma = createEdgePrismaClient(env.DATABASE_URL);

      // Check for resume
      if (resumeAttemptId) {
        const existingAttempt = await prisma.examAttempt.findFirst({
          where: {
            id: resumeAttemptId,
            userId: auth.userId,
            status: { in: ['in_progress', 'paused'] },
          },
          include: {
            config: true,
          },
        });

        if (existingAttempt && ExamService.canResumeExam(existingAttempt as any)) {
          log.info('Resuming existing exam', { attemptId: resumeAttemptId });

          // Get existing answers
          const answers = await prisma.examAnswer.findMany({
            where: { attemptId: existingAttempt.id },
            orderBy: [{ blockNumber: 'asc' }, { questionNumber: 'asc' }],
          });

          // Update last active time
          await prisma.examAttempt.update({
            where: { id: existingAttempt.id },
            data: {
              lastActiveAt: new Date(),
              status: 'in_progress',
            },
          });

          return {
            success: true,
            isResume: true,
            attempt: existingAttempt,
            answers,
            config: existingAttempt.config,
          };
        }
      }

      // Get exam config
      const config = await prisma.examConfig.findUnique({
        where: { id: configId },
      });

      if (!config || !config.isActive) {
        log.warn('Invalid exam configuration', { configId });
        return { status: 400, error: 'Invalid exam configuration' };
      }

      // Check for existing in-progress exam
      const inProgressExam = await prisma.examAttempt.findFirst({
        where: {
          userId: auth.userId,
          status: { in: ['in_progress', 'paused'] },
        },
      });

      if (inProgressExam) {
        log.warn('User has exam in progress', { existingAttemptId: inProgressExam.id });
        return {
          status: 409,
          error: 'You have an exam in progress',
          existingAttemptId: inProgressExam.id,
          canResume: ExamService.canResumeExam(inProgressExam as any),
        };
      }

      // Calculate blueprint distribution
      const distribution = ExamService.calculateSystemDistribution(config.totalQuestions);

      // Get available questions from pool
      const availableQuestions = await prisma.question.findMany({
        where: {
          isActive: true,
          approvalStatus: 'approved',
        },
        select: {
          id: true,
          stem: true,
          options: true,
          correctAnswer: true,
          organSystem: true,
          difficulty: true,
          conditionId: true,
        },
      });

      if (availableQuestions.length < config.totalQuestions) {
        log.error('Insufficient questions in pool', {
          available: availableQuestions.length,
          required: config.totalQuestions,
        });
        return {
          status: 503,
          error: 'Insufficient questions in pool',
          available: availableQuestions.length,
          required: config.totalQuestions,
        };
      }

      // Select questions matching blueprint
      const selectedQuestions = await ExamService.selectExamQuestions(
        availableQuestions as any,
        config.totalQuestions,
        distribution
      );

      // Create exam attempt
      const attemptId = `exam-${auth.userId.slice(0, 8)}-${Date.now()}`;
      const now = new Date();

      const attempt = await prisma.examAttempt.create({
        data: {
          id: attemptId,
          userId: auth.userId,
          configId: config.id,
          startedAt: now,
          lastActiveAt: now,
          currentBlock: 1,
          currentQuestionInBlock: 1,
          blockTimes: [{ block: 1, startedAt: now.toISOString(), timeUsedSeconds: 0 }],
          status: 'in_progress',
          totalTimeUsedSeconds: 0,
        },
      });

      // Create exam answers (pre-populate for all questions)
      const answerRecords = selectedQuestions.map((q, idx) => {
        const blockNumber = Math.floor(idx / config.questionsPerBlock) + 1;
        const questionNumber = (idx % config.questionsPerBlock) + 1;

        return {
          id: `answer-${attemptId}-${idx}`,
          attemptId: attempt.id,
          questionId: q.id,
          blockNumber,
          questionNumber,
          isFlagged: false,
          timeSpentSeconds: 0,
          organSystem: (q as any).organSystem || 'other',
        };
      });

      await prisma.examAnswer.createMany({
        data: answerRecords,
      });

      // Organize questions into blocks (for response)
      const blocks = ExamService.organizeIntoBlocks(
        selectedQuestions,
        config.blocks,
        config.questionsPerBlock
      );

      log.info('Exam started successfully', {
        attemptId,
        configId,
        totalQuestions: config.totalQuestions,
        blocks: config.blocks,
      });

      return {
        status: 201,
        success: true,
        isResume: false,
        attempt,
        config,
        blocks,
        totalQuestions: config.totalQuestions,
        timeMinutes: config.timeMinutes,
        distribution,
      };
    } catch (error) {
      log.error('Error starting exam', error);
      return { status: 500, error: 'Failed to start exam' };
    } finally {
      await safePrismaDisconnect(prisma);
    }
  }
);
